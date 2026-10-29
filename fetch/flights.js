#!/usr/bin/env node
/**
 * Travelpayouts cheap-flights fetcher.
 *
 * For each origin in data/flights-config.json, asks the Aviasales Data API for
 * the cheapest cached fare to the destination, and writes data/flights.json
 * with affiliate deeplinks (your TP marker attached).
 *
 * Needs TP_TOKEN (+ TP_MARKER) in .env. With USE_MOCK=1 it emits sample fares
 * so the Flights page renders before the token exists.
 *
 * Run:  node fetch/flights.js   |   USE_MOCK=1 node fetch/flights.js
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

const AIRLINE_NAMES = {
  HA: "Hawaiian Airlines", UA: "United", AS: "Alaska", DL: "Delta", WN: "Southwest",
  AA: "American", B6: "JetBlue", NK: "Spirit", F9: "Frontier", AC: "Air Canada", WS: "WestJet",
};
const airlineName = (code) => AIRLINE_NAMES[code] || code || "";

const deeplink = (origin, dest, marker) =>
  `https://www.aviasales.com/?origin_iata=${origin}&destination_iata=${dest}${marker ? `&marker=${marker}` : ""}`;

// Deterministic sample fares (varied so cheapest-first ordering is visible)
const MOCK = { LAX: 189, SFO: 205, SEA: 239, LAS: 215, ORD: 329, JFK: 398, DFW: 349, DEN: 279 };
const MOCK_AIRLINE = { LAX: "Hawaiian Airlines", SFO: "United", SEA: "Alaska", LAS: "Southwest", ORD: "United", JFK: "Delta", DFW: "American", DEN: "Southwest" };

async function fetchFare(origin, dest, env) {
  const res = await fetch(
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&destination=${dest}&currency=usd&sorting=price&limit=1&one_way=false&token=${env.TP_TOKEN}`,
    { headers: { "X-Access-Token": env.TP_TOKEN } }
  );
  if (!res.ok) {
    console.warn(`[flights] ${origin}->${dest}: HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  const row = (json.data || [])[0];
  if (!row) return null;
  return {
    price: row.price,
    airline: airlineName(row.airline),
    departureAt: row.departure_at || null,
    link: row.link ? `https://www.aviasales.com${row.link}${env.TP_MARKER ? `&marker=${env.TP_MARKER}` : ""}` : deeplink(origin, dest, env.TP_MARKER),
  };
}

async function main() {
  const env = loadEnv();
  const useMock = env.USE_MOCK === "1" || env.USE_MOCK === "true";
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "flights-config.json"), "utf8"));
  if (!useMock && !env.TP_TOKEN) {
    console.log("No TP_TOKEN set and USE_MOCK not enabled — skipping flights (data/flights.json left as-is).");
    return;
  }

  const routes = [];
  for (const o of cfg.origins) {
    let fare;
    if (useMock) {
      fare = { price: MOCK[o.iata] || 299, airline: MOCK_AIRLINE[o.iata] || "", departureAt: null, link: deeplink(o.iata, cfg.destinationIata, env.TP_MARKER), sample: true };
    } else {
      try {
        fare = await fetchFare(o.iata, cfg.destinationIata, env);
      } catch (e) {
        console.warn(`[flights] ${o.iata}: ${e.message}`);
      }
    }
    if (fare) routes.push({ originIata: o.iata, originCity: o.city, ...fare });
  }
  routes.sort((a, b) => a.price - b.price);

  const out = { destinationIata: cfg.destinationIata, destinationName: cfg.destinationName, routes };
  fs.writeFileSync(path.join(ROOT, "data", "flights.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote data/flights.json (${routes.length} routes to ${cfg.destinationName})`);
}

main();
