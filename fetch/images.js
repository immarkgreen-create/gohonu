#!/usr/bin/env node
/**
 * Stock-photo fetcher — fills a licensed photo for each Hawaii tour.
 *
 * Supports Pixabay, Unsplash, or Pexels (uses whichever key is in .env, in that
 * order). All three licenses allow free commercial use. Put ONE of these in .env:
 *   PIXABAY_API_KEY     (instant key, no approval: pixabay.com/api/docs)
 *   UNSPLASH_ACCESS_KEY (instant key: unsplash.com/developers)
 *   PEXELS_API_KEY      (pexels.com/api — new keys currently paused)
 *
 * Writes data/images.json { slug: imageUrl }. Tours that already have an
 * "image" set (your own photo) are skipped.
 *
 * Run:  node fetch/images.js
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

// Build a focused search query per tour so the photo actually matches.
function queryFor(t) {
  const base = `${t.island} Hawaii`;
  const c = (t.category || "").toLowerCase();
  if (/snorkel|dive|turtle|manta|reef/.test(t.name.toLowerCase() + c)) return `${base} snorkeling ocean`;
  if (/parasail/.test(t.name.toLowerCase())) return `parasailing ocean tropical`;
  if (/shark/.test(t.name.toLowerCase())) return `shark diving ocean`;
  if (/submarine/.test(t.name.toLowerCase())) return `underwater reef ocean`;
  if (/atv|off-road|ranch/.test(t.name.toLowerCase() + c)) return `${base} jungle adventure`;
  if (/zip/.test(t.name.toLowerCase())) return `zipline jungle`;
  if (/air|flight|helicopter|wings/.test(t.name.toLowerCase())) return `${base} aerial coast`;
  if (/butterfly/.test(t.name.toLowerCase())) return `butterfly tropical garden`;
  if (/pearl harbor|history/.test(t.name.toLowerCase() + c)) return `Pearl Harbor Honolulu`;
  if (/luau|cultural|polynesian/.test(t.name.toLowerCase() + c)) return `Hawaii luau polynesian`;
  if (/hana|sightsee/.test(t.name.toLowerCase() + c)) return `Maui road to Hana waterfall`;
  return `${base} ${t.category}`;
}

// Each provider returns an ARRAY of candidate URLs so we can skip duplicates.
async function pixabay(query, key) {
  const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=30&safesearch=true`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.hits || []).map((h) => h.largeImageURL || h.webformatURL).filter(Boolean);
}
async function unsplash(query, key) {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results || []).map((r) => r.urls?.regular).filter(Boolean);
}
async function pexels(query, key) {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`, {
    headers: { Authorization: key },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.photos || []).map((p) => p.src?.large).filter(Boolean);
}

// Download an image to a local file (Pixabay URLs are temporary — must self-host).
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

function pickProvider(env) {
  if (env.PIXABAY_API_KEY) return { name: "pixabay", fn: (q) => pixabay(q, env.PIXABAY_API_KEY) };
  if (env.UNSPLASH_ACCESS_KEY) return { name: "unsplash", fn: (q) => unsplash(q, env.UNSPLASH_ACCESS_KEY) };
  if (env.PEXELS_API_KEY) return { name: "pexels", fn: (q) => pexels(q, env.PEXELS_API_KEY) };
  return null;
}

async function main() {
  const env = loadEnv();
  const provider = pickProvider(env);
  if (!provider) {
    console.log("No image key in .env (PIXABAY_API_KEY / UNSPLASH_ACCESS_KEY / PEXELS_API_KEY) — skipping.");
    console.log("Easiest: get an instant Pixabay key at https://pixabay.com/api/docs/");
    return;
  }
  console.log(`Image provider: ${provider.name}`);
  const tours = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tours.json"), "utf8")).tours;
  const out = {};
  const used = new Set();
  for (const t of tours) {
    if (t.image) continue; // respect your own photos
    let candidates = [];
    try {
      candidates = await provider.fn(queryFor(t));
    } catch (e) {
      console.warn(`[${provider.name}] ${t.slug}: ${e.message}`);
    }
    const url = candidates.find((u) => !used.has(u)) || candidates[0];
    if (url) {
      used.add(url);
      const rel = `/assets/img/tours/${t.slug}.jpg`;
      out[t.slug] = (await download(url, path.join(ROOT, rel))) ? rel : url;
      console.log(`  ${t.slug} <- ${out[t.slug]}`);
    } else {
      console.log(`  ${t.slug} <- (no photo found)`);
    }
  }
  // ---- Phase 2: FareHarbor catalog — pool photos by island+category ----
  let fh = [];
  try {
    fh = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fareharbor.json"), "utf8")).tours;
  } catch {}
  const missing = fh.filter((t) => !t.image && !out[t.slug]);
  if (missing.length) {
    const groups = {};
    missing.forEach((t) => {
      const k = `${t.island}||${t.category}`;
      (groups[k] = groups[k] || []).push(t);
    });
    const keys = Object.keys(groups);
    console.log(`FareHarbor images: ${missing.length} tours across ${keys.length} island+category groups (downloading…)`);
    const dlCache = new Map();
    let pIdx = 0;
    for (const key of keys) {
      const [island, category] = key.split("||");
      let pool = [];
      try {
        pool = await provider.fn(fhQuery(island, category));
      } catch (e) {
        console.warn(`[pool] ${key}: ${e.message}`);
      }
      if (!pool.length) continue;
      for (let i = 0; i < groups[key].length; i++) {
        const t = groups[key][i];
        const url = pool[i % pool.length]; // round-robin for variety within the category
        let rel = dlCache.get(url);
        if (!rel) {
          const cand = `/assets/img/pool/p${pIdx}.jpg`;
          if (await download(url, path.join(ROOT, cand))) {
            rel = cand;
            pIdx++;
            dlCache.set(url, rel);
          }
        }
        out[t.slug] = rel || url;
      }
    }
  }

  // ---- Phase 2b: guarantee — any FH tour STILL without an image gets a
  // per-island Hawaii fallback, so no card is ever a bare gradient. ----
  const stillMissing = fh.filter((t) => !t.image && !out[t.slug]);
  if (stillMissing.length) {
    const byIsland = {};
    stillMissing.forEach((t) => (byIsland[t.island] = byIsland[t.island] || []).push(t));
    console.log(`Fallback images: ${stillMissing.length} tours with no category match (filling)`);
    for (const island of Object.keys(byIsland)) {
      let pool = [];
      try {
        pool = await provider.fn(`${island} Hawaii tropical landscape scenic`);
      } catch (e) {
        console.warn(`[fallback] ${island}: ${e.message}`);
      }
      if (!pool.length) continue;
      let i = 0;
      for (const t of byIsland[island]) {
        const url = pool[i % pool.length];
        i++;
        const rel = `/assets/img/fill/${t.slug}.jpg`;
        out[t.slug] = (await download(url, path.join(ROOT, rel))) ? rel : url;
      }
    }
  }

  fs.writeFileSync(path.join(ROOT, "data", "images.json"), JSON.stringify(out, null, 2) + "\n");
  const noneLeft = fh.filter((t) => !t.image && !out[t.slug]).length;
  console.log(`Wrote data/images.json (${Object.keys(out).length} images; ${noneLeft} FareHarbor tours still without an image)`);
}

function fhQuery(island, category) {
  const c = category.toLowerCase();
  const map = {
    "boat tour": "boat ocean tropical", "boat rental": "boat ocean", snorkel: "snorkeling reef ocean",
    scuba: "scuba diving ocean", luau: "hawaii luau fire dance", surf: "surfing wave ocean",
    "bus tour": "scenic tour coach", attraction: "hawaii landmark scenic", farm: "tropical farm plantation",
    "eco tour": "hawaii nature jungle waterfall", "guided tour": "hawaii scenic coast", private: "yacht ocean sunset",
    sup: "paddleboard ocean", helicopter: "helicopter aerial coast", zipline: "zipline jungle canopy",
    fishing: "deep sea fishing boat", kayak: "kayak ocean", hike: "hawaii hiking trail", atv: "atv offroad jungle",
    whale: "whale watching ocean", dolphin: "dolphin ocean", sail: "sailboat ocean sunset",
  };
  const kw = map[c] || `${c}`;
  return `${island} Hawaii ${kw}`;
}

main();
