#!/usr/bin/env node
/**
 * Destination hero/card images — scenic, iconic shots per destination (Pixabay /
 * Unsplash / Pexels), so Polynesia & Beyond cards look like travel postcards
 * instead of a random tour photo. Writes data/dest-images.json { slug: url }.
 *
 * Run:  node fetch/dest-images.js   (uses the same image key as fetch/images.js)
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

// Each returns [{id, url}] so we can dedupe by true image id (URLs are unreliable).
async function pixabay(q, key) {
  const r = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&orientation=horizontal&category=travel&per_page=20&safesearch=true&order=popular&min_width=1000`);
  if (!r.ok) return [];
  return ((await r.json()).hits || []).map((h) => ({ id: "px" + h.id, url: h.largeImageURL || h.webformatURL })).filter((x) => x.url);
}
async function unsplash(q, key) {
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}` } });
  if (!r.ok) return [];
  return ((await r.json()).results || []).map((x) => ({ id: "un" + x.id, url: x.urls?.regular })).filter((x) => x.url);
}
async function pexels(q, key) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=20&orientation=landscape`, { headers: { Authorization: key } });
  if (!r.ok) return [];
  return ((await r.json()).photos || []).map((x) => ({ id: "pe" + x.id, url: x.src?.large })).filter((x) => x.url);
}

async function download(url, absPath) {
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) return false;
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buf);
    return true;
  } catch {
    return false;
  }
}

// Iconic, postcard-style query per destination.
function queryFor(d) {
  const custom = {
    "bora-bora": "Bora Bora overwater bungalow lagoon",
    tahiti: "Tahiti black sand beach palm",
    moorea: "Moorea island green mountains lagoon",
    fiji: "Fiji tropical island resort palm",
    rarotonga: "Rarotonga Cook Islands aerial lagoon",
    samoa: "Samoa waterfall tropical beach",
    cancun: "Cancun beach turquoise",
    "las-vegas": "Las Vegas strip skyline night",
    rome: "Rome Colosseum",
    bali: "Bali rice terraces temple",
    paris: "Paris Eiffel Tower",
    london: "London Tower Bridge",
    tokyo: "Tokyo skyline Shibuya night",
    "new-york": "New York City skyline Manhattan",
    barcelona: "Barcelona Sagrada Familia",
    dubai: "Dubai skyline Burj Khalifa",
    bangkok: "Bangkok temple grand palace",
    sydney: "Sydney Opera House harbour",
    reykjavik: "Iceland northern lights landscape",
    athens: "Athens Acropolis Parthenon",
    amsterdam: "Amsterdam canal houses",
    marrakech: "Marrakech medina market morocco",
  };
  return custom[d.slug] || `${d.name} landmark scenic`;
}

async function main() {
  const env = loadEnv();
  const prov = env.PIXABAY_API_KEY
    ? { name: "pixabay", fn: (q) => pixabay(q, env.PIXABAY_API_KEY) }
    : env.UNSPLASH_ACCESS_KEY
    ? { name: "unsplash", fn: (q) => unsplash(q, env.UNSPLASH_ACCESS_KEY) }
    : env.PEXELS_API_KEY
    ? { name: "pexels", fn: (q) => pexels(q, env.PEXELS_API_KEY) }
    : null;
  if (!prov) {
    console.log("No image key in .env — skipping destination images.");
    return;
  }
  const dests = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "destinations.json"), "utf8")).destinations;
  console.log(`Destination images via ${prov.name} for ${dests.length} destinations...`);
  const out = {};
  const used = new Set();
  for (const d of dests) {
    let cands = [];
    try {
      cands = await prov.fn(queryFor(d));
    } catch (e) {
      console.warn(`[${prov.name}] ${d.slug}: ${e.message}`);
    }
    const pick = cands.find((c) => !used.has(c.id)) || cands[0];
    if (pick) {
      used.add(pick.id);
      const rel = `/assets/img/dest/${d.slug}.jpg`;
      out[d.slug] = (await download(pick.url, path.join(ROOT, rel))) ? rel : pick.url;
      console.log(`  ${d.slug} <- ${out[d.slug]}`);
    } else {
      console.log(`  ${d.slug} <- (none found)`);
    }
  }
  fs.writeFileSync(path.join(ROOT, "data", "dest-images.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote data/dest-images.json (${Object.keys(out).length}/${dests.length})`);
}

main();
