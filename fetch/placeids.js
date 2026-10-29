#!/usr/bin/env node
/**
 * Harvest each operator's Google Place ID from FareHarbor's PUBLIC company API
 * (no key needed). FareHarbor stores google_place_id per company; with it, the
 * Google ratings lookup (fetch/ratings.js) becomes exact + cheap.
 *
 * Writes data/placeids.json  { company(lowercased): {shortname, placeId, googleMapUrl} }
 *
 * Run:  node fetch/placeids.js
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

async function companyInfo(shortname) {
  const res = await fetch(`https://fareharbor.com/api/v1/companies/${shortname}/`, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const c = (await res.json()).company;
  return {
    placeId: c?.primary_location?.google_place_id || "",
    googleMapUrl: c?.url_google_map || "",
    googleEnabled: !!c?.features?.is_google_rating_enabled,
    name: c?.name || "",
  };
}

async function main() {
  const tours = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fareharbor.json"), "utf8")).tours;
  // unique operators by shortname, with display company name
  const ops = new Map();
  for (const t of tours) if (t.shortname && !ops.has(t.shortname)) ops.set(t.shortname, t.company);

  console.log(`Fetching Google Place IDs for ${ops.size} operators...`);
  const out = {};
  let withPid = 0;
  for (const [shortname, company] of ops) {
    try {
      const info = await companyInfo(shortname);
      if (info) {
        out[(company || shortname).toLowerCase()] = { shortname, placeId: info.placeId, googleMapUrl: info.googleMapUrl };
        if (info.placeId) withPid++;
      }
    } catch (e) {
      console.warn(`[${shortname}] ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(ROOT, "data", "placeids.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote data/placeids.json — ${withPid}/${ops.size} operators have a Google Place ID`);
}

main();
