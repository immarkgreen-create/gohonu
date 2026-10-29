#!/usr/bin/env node
/**
 * Google ratings fetcher — real visitor ratings per tour operator.
 *
 * The FareHarbor CSV has no ratings, so we look each operator up on Google
 * (Places API "New" — Text Search) by name + location, and store the star
 * rating + review count. Ratings are per BUSINESS, so every tour by the same
 * operator shows that operator's rating.
 *
 * Needs a Google Cloud key with "Places API (New)" enabled, in .env as
 * GOOGLE_PLACES_API_KEY. ~178 lookups — well inside Google's free monthly credit.
 * Google ToS: you may display the aggregate rating on your own site (attribution
 * shown via "Ratings by Google"); place_id may be cached, refresh ratings monthly.
 *
 * Run:  node fetch/ratings.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

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

// Exact lookup by Google Place ID (cheapest call, no name ambiguity).
async function detailsByPlaceId(placeId, key) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,rating,userRatingCount,displayName" },
  });
  if (!res.ok) return null;
  const p = await res.json();
  if (p.rating == null) return null;
  return { rating: p.rating, reviews: p.userRatingCount || 0, placeId, matchedName: p.displayName?.text || "" };
}

// Fallback: text search by name + location (for the rare operator with no place_id).
async function searchByName(company, location, lat, lng, key) {
  const city = (location || "").split("/")[2] || "Hawaii";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount,places.displayName",
    },
    body: JSON.stringify({
      textQuery: `${company}, ${city}, Hawaii`,
      locationBias: lat && lng ? { circle: { center: { latitude: +lat, longitude: +lng }, radius: 30000 } } : undefined,
    }),
  });
  if (!res.ok) return null;
  const p = ((await res.json()).places || [])[0];
  if (!p || p.rating == null) return null;
  return { rating: p.rating, reviews: p.userRatingCount || 0, placeId: p.id, matchedName: p.displayName?.text || "" };
}

async function main() {
  const env = loadEnv();
  if (!env.GOOGLE_PLACES_API_KEY) {
    console.log("No GOOGLE_PLACES_API_KEY in .env — skipping. Enable 'Places API (New)' in Google Cloud and add the key.");
    return;
  }
  const tours = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fareharbor.json"), "utf8")).tours;
  let placeIds = {};
  try {
    placeIds = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "placeids.json"), "utf8"));
  } catch {}

  // one lookup per unique operator
  const ops = new Map();
  for (const t of tours) {
    const key = (t.company || "").toLowerCase();
    if (key && !ops.has(key)) ops.set(key, t);
  }
  console.log(`Looking up ${ops.size} operators on Google (${Object.values(placeIds).filter((p) => p.placeId).length} via exact Place ID)...`);

  const out = {};
  for (const [key, t] of ops) {
    try {
      const pid = placeIds[key]?.placeId;
      const r = pid
        ? await detailsByPlaceId(pid, env.GOOGLE_PLACES_API_KEY)
        : await searchByName(t.company, t.location || t.island, t.locationLat, t.locationLong, env.GOOGLE_PLACES_API_KEY);
      if (r) {
        out[key] = r;
        console.log(`  ${t.company}: ${r.rating}★ (${r.reviews})`);
      }
    } catch (e) {
      console.warn(`[google] ${t.company}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(ROOT, "data", "ratings.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote data/ratings.json (${Object.keys(out).length}/${ops.size} operators rated)`);
}

main();
