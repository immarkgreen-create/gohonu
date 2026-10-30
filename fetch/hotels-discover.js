#!/usr/bin/env node
/**
 * Auto-discover the top hotels for every destination (so each Stays page gets real
 * hotel CARDS like the curated Waikiki guide, not just a map). Uses Google Places
 * (New) Text Search to find prominent, well-rated hotels per place, grabs the real
 * rating + review count + a real photo (self-hosted), and writes data/dest-hotels.json
 * keyed by place slug.
 *
 * Oahu is skipped (it has the hand-curated guides in data/hotels.json).
 *
 * Run:  node fetch/hotels-discover.js            (all places)
 *       node fetch/hotels-discover.js tokyo bali (only these slugs)
 *       node fetch/hotels-discover.js --force     (re-fetch places already done)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes("--force");
const ONLY = ARGS.filter((a) => !a.startsWith("--"));
const PER_DEST = 8; // hotel cards per destination
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

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

const PRICE_MAP = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// The places to discover hotels for (islands minus Oahu + all Beyond/Polynesia dests).
function placeList() {
  const islands = [
    { slug: "maui", name: "Maui", query: "best hotels and resorts in Maui, Hawaii" },
    { slug: "kauai", name: "Kauai", query: "best hotels and resorts in Kauai, Hawaii" },
    { slug: "big-island", name: "Big Island", query: "best hotels and resorts on the Big Island of Hawaii (Kona and Kohala Coast)" },
  ];
  const dests = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "destinations.json"), "utf8")).destinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    query: `best hotels in ${d.name}, ${d.country}`,
  }));
  let all = [...islands, ...dests];
  if (ONLY.length) all = all.filter((p) => ONLY.includes(p.slug));
  return all;
}

async function searchHotels(query, key) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount,places.photos,places.priceLevel,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20, includedType: "lodging" }),
  });
  if (!res.ok) {
    console.warn(`  search failed (${res.status}) for: ${query}`);
    return [];
  }
  return (await res.json()).places || [];
}

async function downloadPhoto(photoName, key, absPath) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=720&maxWidthPx=1080&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) return false;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buf);
  try {
    execSync(`sips -Z 900 ${JSON.stringify(absPath)}`, { stdio: "ignore" });
  } catch {}
  return true;
}

const score = (p) => (p.rating || 0) * Math.log10((p.userRatingCount || 0) + 10);

async function main() {
  const env = loadEnv();
  if (!env.GOOGLE_PLACES_API_KEY) {
    console.log("No GOOGLE_PLACES_API_KEY in .env — skipping.");
    return;
  }
  const key = env.GOOGLE_PLACES_API_KEY;
  const outFile = path.join(ROOT, "data", "dest-hotels.json");
  const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
  const places = placeList();
  console.log(`Discovering hotels for ${places.length} destinations (${PER_DEST} each)...`);

  for (const p of places) {
    if (!FORCE && out[p.slug] && out[p.slug].length) {
      console.log(`  = ${p.slug} (cached ${out[p.slug].length})`);
      continue;
    }
    let found = [];
    try {
      found = await searchHotels(p.query, key);
    } catch (e) {
      console.warn(`  ${p.slug}: ${e.message}`);
    }
    const ranked = found
      .filter((h) => (h.rating || 0) >= 4.0 && (h.userRatingCount || 0) >= 80)
      .sort((a, b) => score(b) - score(a))
      .slice(0, PER_DEST);
    const hotels = [];
    for (let i = 0; i < ranked.length; i++) {
      const h = ranked[i];
      const name = h.displayName?.text || "Hotel";
      const rel = `/assets/img/dest-hotels/${p.slug}/${i + 1}.jpg`;
      let image = null;
      const photo = (h.photos || [])[0];
      if (photo?.name && (await downloadPhoto(photo.name, key, path.join(ROOT, rel)))) image = rel;
      hotels.push({
        slug: `${p.slug}-${slugify(name).slice(0, 40)}`,
        name,
        area: p.name,
        rating: h.rating,
        reviews: h.userRatingCount,
        priceLevel: PRICE_MAP[h.priceLevel] || null,
        image,
        expediaDest: `${name}, ${p.name}`,
      });
    }
    out[p.slug] = hotels;
    console.log(`  ✓ ${p.slug}: ${hotels.length} hotels (${hotels.filter((h) => h.image).length} with photos)`);
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n"); // checkpoint after each
  }
  console.log(`\nWrote data/dest-hotels.json (${Object.keys(out).length} destinations)`);
}

main();
