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

function island(loc) {
  if (/Lahaina|Kihei|Wailuku|Kahului|Kaanapali|Makena|Paia|\bHana\b|Napili|Kapalua|Maui/.test(loc)) return "Maui";
  if (/Kona|Hilo|Waikoloa|Kamuela|Volcano|Big Island|Captain Cook|Pahoa/.test(loc)) return "Big Island";
  if (/Lihue|Kapaa|Koloa|Hanalei|Princeville|Poipu|Kauai|Waimea Kauai/.test(loc)) return "Kauai";
  return "Oahu";
}

const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());
function category(tags) {
  const first = (tags || "").split(/[,\-–]/)[0].trim();
  return first ? titleCase(first) : "Tours & Activities";
}

const rows = parseCSV(fs.readFileSync(path.join(ROOT, csvPath), "utf8"));
const H = rows[0];
const col = Object.fromEntries(H.map((h, i) => [h, i]));
const get = (r, name) => r[col[name]] || "";

const tours = rows
  .slice(1)
  .filter((r) => r[0] && get(r, "item_id"))
  .map((r) => {
    const shortname = get(r, "company_shortname");
    const itemId = get(r, "item_id");
    return {
      slug: `${shortname}-${itemId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name: get(r, "item_name"),
      company: get(r, "company_name"),
      island: island(get(r, "location")),
      location: get(r, "location"),
      locationLat: get(r, "location_lat"),
      locationLong: get(r, "location_long"),
      category: category(get(r, "tags")),
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
