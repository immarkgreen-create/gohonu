#!/usr/bin/env node
/**
 * Hotel guides enrichment — fills real Google ratings + a real Google photo for
 * every hotel in data/hotels.json that is missing them, then writes it back.
 *
 * Uses Google Places API (New): places:searchText for rating/userRatingCount +
 * the first photo, then the /media endpoint to download the image locally to
 * assets/img/hotels/<slug>.jpg (Google photo URLs are short-lived, so we self-host).
 *
 * Idempotent: a hotel that already has both `rating` and a local `image` is
 * skipped. Pass --force to re-fetch everything.
 *
 * Run:  node fetch/hotels-enrich.js   (needs GOOGLE_PLACES_API_KEY in .env)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const FORCE = process.argv.includes("--force");

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

async function searchHotel(query, key) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount,places.displayName,places.photos",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) {
    console.warn(`  search failed (${res.status}): ${query}`);
    return null;
  }
  const data = await res.json();
  return (data.places || [])[0] || null;
}

async function downloadPhoto(photoName, key, absPath) {
  // photoName looks like "places/XXX/photos/YYY"
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=900&maxWidthPx=1400&key=${key}`;
  const r = await fetch(url); // follows the 302 redirect to the image bytes
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) return false;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buf);
  // Optimise (best-effort; sips ships with macOS).
  try {
    execSync(`sips -Z 1200 ${JSON.stringify(absPath)}`, { stdio: "ignore" });
  } catch {}
  return true;
}

async function main() {
  const env = loadEnv();
  if (!env.GOOGLE_PLACES_API_KEY) {
    console.log("No GOOGLE_PLACES_API_KEY in .env — skipping hotel enrichment.");
    return;
  }
  const key = env.GOOGLE_PLACES_API_KEY;
  const file = path.join(ROOT, "data", "hotels.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  let done = 0,
    skipped = 0,
    failed = 0;
  for (const areaKey of Object.keys(data)) {
    for (const h of data[areaKey]) {
      const rel = `/assets/img/hotels/${h.slug}.jpg`;
      const hasImg = h.image && fs.existsSync(path.join(ROOT, h.image.replace(/^\//, "")));
      if (!FORCE && h.rating && hasImg) {
        skipped++;
        continue;
      }
      const query = `${h.name}, ${h.area}, Hawaii`;
      const place = await searchHotel(query, key);
      if (!place) {
        failed++;
        console.log(`  ✗ ${h.name} — no Google match`);
        continue;
      }
      if (place.rating) h.rating = place.rating;
      if (place.userRatingCount) h.reviews = place.userRatingCount;
      const photo = (place.photos || [])[0];
      if (photo && photo.name && (FORCE || !hasImg)) {
        const ok = await downloadPhoto(photo.name, key, path.join(ROOT, rel));
        if (ok) {
          h.image = rel;
          h.photoCredit = "Google";
        }
      }
      done++;
      console.log(`  ✓ ${h.name} — ${h.rating || "?"}★ (${h.reviews || 0}) ${h.image ? "photo ✓" : "no photo"}`);
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`\nEnriched ${done}, skipped ${skipped}, failed ${failed}. Wrote data/hotels.json`);
}

main();
