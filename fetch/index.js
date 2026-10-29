#!/usr/bin/env node
/**
 * Beyond-Hawaii data fetcher — multi-network.
 *
 * For each destination in data/destinations.json, calls every enabled provider
 * adapter, merges the results, ranks by a popularity score (rating weighted by
 * review volume), de-dupes, keeps the top N, and writes data/beyond.json.
 *
 * Providers self-disable when their API key is missing, so this runs fine with
 * zero keys (producing nothing) or with USE_MOCK=1 (producing sample data).
 *
 * Run:  node fetch/index.js        (reads .env)
 *       USE_MOCK=1 node fetch/index.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TOP_N = 10;

/* ---- minimal .env loader (no dependency) ---- */
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

/* ---- popularity score: rating, weighted by how many reviews back it ---- */
function popularityScore(t) {
  const rating = Number(t.rating) || 0;
  const reviews = Number(t.reviewCount) || 0;
  return rating * Math.log10(reviews + 10); // review volume dampened so a 5.0 (3 reviews) can't beat a 4.7 (10k)
}

function dedupe(tours) {
  const seen = new Map();
  for (const t of tours) {
    const key = (t.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    const prev = seen.get(key);
    if (!prev || popularityScore(t) > popularityScore(prev)) seen.set(key, t);
  }
  return [...seen.values()];
}

async function main() {
  const env = loadEnv();
  const useMock = env.USE_MOCK === "1" || env.USE_MOCK === "true";

  const providers = useMock
    ? [require("./providers/mock")]
    : [
        require("./providers/viator"),
        require("./providers/getyourguide"),
        require("./providers/klook"),
      ];

  const active = providers.filter((p) => p.enabled(env));
  console.log(`Providers active: ${active.map((p) => p.name).join(", ") || "(none — set keys in .env or USE_MOCK=1)"}`);

  const { destinations } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "destinations.json"), "utf8"));
  const out = [];

  for (const dest of destinations) {
    let tours = [];
    for (const p of active) {
      try {
        tours.push(...(await p.search({ destination: dest, env, limit: 30 })));
      } catch (e) {
        console.warn(`[${p.name}] ${dest.name}: ${e.message}`);
      }
    }
    tours = dedupe(tours)
      .map((t) => ({ ...t, popularityScore: Number(popularityScore(t).toFixed(3)) }))
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, TOP_N);
    console.log(`  ${dest.name}: ${tours.length} tours`);
    out.push({ ...dest, tours });
  }

  const file = path.join(ROOT, "data", "beyond.json");
  fs.writeFileSync(file, JSON.stringify({ destinations: out }, null, 2) + "\n");
  console.log(`Wrote ${file} (${out.reduce((n, d) => n + d.tours.length, 0)} tours across ${out.length} destinations)`);
}

main();
