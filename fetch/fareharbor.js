#!/usr/bin/env node
/**
 * FareHarbor FHDN marketplace importer.
 *
 * Parses marketplace-top-items-*.csv (exported from the FareHarbor Distribution
 * Network) into data/fareharbor.json — the live Hawaii catalog. Every item is
 * currently bookable, carries your affiliate ref in the booking link, and has
 * NO price (the FareHarbor Lightframe shows the live price at booking time, so
 * nothing ever goes stale).
 *
 * Run:  node fetch/fareharbor.js [path-to-csv]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const csvPath =
  process.argv[2] ||
  fs.readdirSync(ROOT).find((f) => /^marketplace-top-items.*\.csv$/.test(f));
if (!csvPath) {
  console.error("No marketplace CSV found. Pass the path or drop it in the project root.");
  process.exit(1);
}

function parseCSV(s) {
  const rows = [];
  let f = "", row = [], q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

// Island from coordinates (reliable). Boxes: [latMin,latMax,lngMin,lngMax].
const ISLAND_BOX = {
  Kauai: [21.7, 22.3, -159.9, -159.2],
  Oahu: [21.2, 21.78, -158.35, -157.6],
  Maui: [20.5, 21.1, -156.8, -155.95],
  "Big Island": [18.9, 20.35, -156.2, -154.7],
  _molokai: [21.0, 21.25, -157.35, -156.7], // Maui County -> Maui
  _lanai: [20.7, 20.95, -157.1, -156.8],
};
function islandFromCoords(lat, lng) {
  for (const [k, b] of Object.entries(ISLAND_BOX)) {
    if (lat >= b[0] && lat <= b[1] && lng >= b[2] && lng <= b[3]) return k.startsWith("_") ? "Maui" : k;
  }
  return null;
}
function islandFromText(loc) {
  if (/Lahaina|Kihei|Wailuku|Kahului|Kaanapali|Makena|Paia|\bHana\b|Napili|Kapalua|Lanai|Molokai|Maui/i.test(loc)) return "Maui";
  if (/Kona|Hilo|Waikoloa|Kamuela|Volcano|Big Island|Captain Cook|Pahoa|Kohala/i.test(loc)) return "Big Island";
  if (/Lihue|Kapaa|Koloa|Hanalei|Princeville|Poipu|Kauai|Nawiliwili|Hanapepe|Eleele|Napali/i.test(loc)) return "Kauai";
  return "Oahu";
}
// Strong island-specific landmarks in the tour NAME override the coords (operators
// sometimes list a cross-island day-trip under their HQ coordinates).
const LANDMARKS = [
  [/road to hana|haleakala|molokini/i, "Maui"],
  [/na\s?pali|napali|waimea canyon|kalalau/i, "Kauai"],
  [/volcanoes national park|kilauea|mauna kea|mauna loa/i, "Big Island"],
];
function landmarkIsland(name) {
  for (const [re, isl] of LANDMARKS) if (re.test(name || "")) return isl;
  return null;
}
// FareHarbor 'tags' is a hyphen-joined LIST of categories (names can contain hyphens/
// spaces, e.g. "E-Bike", "Self-Guided Tour"). Match a known vocabulary (priority
// order = specific activities first, generic last), preferring the activity named in
// the title — so "Popoi'a Island Kayak Trip" becomes Kayak, not Bike Rental.
const CATS = ["Luau","Whale Watch","Snorkel","Scuba","Dolphin","Kayak","SUP","Surf","Zipline","Parasail","Sailing","Catamaran","Rafting","Canoe","Fishing","ATV/UTV","Horse","Helicopter","Air Tour","Air Activities","Airplane","E-Bike","Bike Tour","Hiking","Eco Tour","Food Tour","Photography Tour","History Tour","City Tour","Walking Tour","Farm","Brewery","Distillery","Wellness","Paint And Sip","Rage Room","VR","Sports","Water Activities","Sightseeing Tour","Bus Tour","Boat Tour","Shuttle","Transportation","Boat Rental","Bike Rental","Rentals","Self-Guided Tour","Guided Tour","Private","Pop Up Attraction","Attraction","Events","Tours & Activities","Other"];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
function category(name, tags) {
  const t = tags || "";
  const present = CATS.filter((c) => new RegExp("(^|-)" + reEsc(c) + "(-|$)", "i").test(t));
  if (!present.length) return "Tours & Activities";
  const nameL = (name || "").toLowerCase();
  const kw = (c) => c.toLowerCase().replace(/\/.*$/, "").split(" ")[0]; // "atv", "e-bike", "boat"
  const named = present.filter((c) => kw(c).length >= 3 && nameL.includes(kw(c)));
  const pool = named.length ? named : present;
  pool.sort((a, b) => CATS.indexOf(a) - CATS.indexOf(b));
  return pool[0];
}

const rows = parseCSV(fs.readFileSync(path.join(ROOT, csvPath), "utf8"));
const H = rows[0];
const col = Object.fromEntries(H.map((h, i) => [h, i]));
const get = (r, name) => r[col[name]] || "";

const tours = rows
  .slice(1)
  .filter((r) => r[0] && get(r, "item_id"))
  .filter((r) => !/[぀-ヿ㐀-䶿一-鿿가-힯]/.test(get(r, "item_name"))) // drop non-English (CJK) listings
  .map((r) => {
    const shortname = get(r, "company_shortname");
    const itemId = get(r, "item_id");
    const name = get(r, "item_name");
    const loc = get(r, "location");
    // CSV stores lat/lng swapped: location_lat actually holds the longitude.
    const lat = parseFloat(get(r, "location_long"));
    const lng = parseFloat(get(r, "location_lat"));
    const isl = landmarkIsland(name) || (lat && lng && islandFromCoords(lat, lng)) || islandFromText(loc);
    return {
      slug: `${shortname}-${itemId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name,
      company: get(r, "company_name"),
      island: isl,
      location: loc,
      locationLat: lat || null,
      locationLong: lng || null,
      category: category(name, get(r, "tags")),
      tags: get(r, "tags"),
      shortname,
      itemId,
      bookingUrl: get(r, "regular_link"),
      calendarUrl: get(r, "calendar_link"),
      image: get(r, "image_url") || "",
      qualityScore: Number(get(r, "quality_score")) || 0,
      availNextWeek: Number(get(r, "availability_next_week")) || 0,
      availNext30: Number(get(r, "availability_next_30days")) || 0,
    };
  })
  // bookable + de-dupe by slug (keep highest quality)
  .filter((t) => t.bookingUrl);

const bySlug = new Map();
for (const t of tours) {
  const prev = bySlug.get(t.slug);
  if (!prev || t.qualityScore > prev.qualityScore) bySlug.set(t.slug, t);
}
const out = [...bySlug.values()].sort(
  (a, b) => b.qualityScore - a.qualityScore || b.availNext30 - a.availNext30
);

fs.writeFileSync(path.join(ROOT, "data", "fareharbor.json"), JSON.stringify({ tours: out }, null, 2) + "\n");
const byIsland = out.reduce((m, t) => ((m[t.island] = (m[t.island] || 0) + 1), m), {});
console.log(`Wrote data/fareharbor.json — ${out.length} tours`, byIsland);
console.log(`With images: ${out.filter((t) => t.image).length} / ${out.length}`);
