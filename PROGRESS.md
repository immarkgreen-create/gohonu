# Everything Hawaii — build progress & state

Static tours/activities site, off Wix, Netlify-ready. Hawaii (Oahu-forward) is the
curated hub; "Beyond Hawaii" is a multi-network global catalog; plus a live Flights page.

## Working now
- **Oahu-forward Hawaii hub** — home, 4 island pages, 15 tour landing pages. FareHarbor
  "Book Now" (lightframe) carries affiliate ref `everythinghawaiitravel`. Viator/Polynesia link out.
- **✈️ Flights to Hawaii** — **LIVE** real data via Travelpayouts (Aviasales) token. Cheapest-first.
- **🌏 Beyond Hawaii** — engine + pages built; currently SAMPLE data (4 destinations).
- **Image system** — 3 ways to add photos (see below); gradient fallback until then.
- 404 page, sitemap, robots, OG/meta.

## Pipelines (run then `node build.js`)
- `node fetch/flights.js`  — Travelpayouts flights (live with TP_TOKEN)
- `node fetch/index.js`    — Beyond-Hawaii activities (USE_MOCK=1 for samples)
- `node fetch/images.js`   — Pexels photos per tour (needs PEXELS_API_KEY)

## Images — precedence per tour
1. `image` field in data/tours.json
2. your own file at `assets/img/tours/<slug>.jpg|png|webp`  ← best: authentic Oahu photos
3. Pexels auto-fill (data/images.json via fetch/images.js)
4. gradient placeholder

## BLOCKERS / open asks
- **TP_MARKER** (partner ID) — NOTHING earns commission without it. Flights/activities links need it. Put in .env.
- **Viator Basic API key** — to make Beyond Hawaii real (requested via partner support; dashboard only shows Widgets/Curated lists).
- **PEXELS_API_KEY** (free) OR own photos — to replace gradient placeholders.
- Beyond-Hawaii activities: Travelpayouts WeGoTrip API is reachable but has no reviews/booking-URLs
  in the open API and is cultural-city-only; Hotellook (hotels) is shut down. Viator API is the right source.

## Secrets
All keys live in `.env` (gitignored). `.env.example` documents them. Never commit `.env`.
Current .env has a working TP_TOKEN. Rotate anytime from the Travelpayouts dashboard.
