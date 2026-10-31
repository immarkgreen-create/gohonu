#!/usr/bin/env node
/**
 * Generate GoHonu social promo cards (1080x1350 Instagram portrait) from a config
 * list. Renders each via headless Chrome into assets/img/promo/.
 * Run:  node fetch/promo-cards.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const abs = (p) => "file://" + path.join(ROOT, p);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CORAL = "#ff7a5c";
const AQUA = "#4cc3e0";

const CARDS = [
  { name: "01-hawaii-trip", bg: "assets/img/hero-napali.jpg", accent: CORAL,
    h1: ["Your whole", "Hawaii trip,"], acc: "all in one place.",
    sub: "Hand-picked tours, hotels, flights & cars across every island — booked with trusted local partners.",
    pills: ["🎟️ Tours", "🏨 Hotels", "✈️ Flights", "🚗 Cars"],
    cta: "Plan your trip at gohonu.com →", foot: "🌺 Hand-picked by Hawaii locals  ·  ✅ Free cancellation on most tours" },

  { name: "02-tours", bg: "assets/img/promo/bg/turtle.jpg", accent: CORAL,
    h1: ["The best of", "Hawaii,"], acc: "hand-picked by locals.",
    sub: "Snorkel with turtles, chase waterfalls and watch the sunrise from Haleakalā — the tours we'd send our own friends on.",
    pills: ["🐠 Snorkel", "🌋 Volcano", "🔥 Luau", "🚁 Air tours"],
    cta: "Book tours at gohonu.com →", foot: "⭐ Real traveler ratings  ·  ✅ Free cancellation on most" },

  { name: "03-stays", bg: "assets/img/hotels/moana-surfrider-a-westin-resort-spa.jpg", accent: AQUA,
    h1: ["Where to stay", "in Hawaii —"], acc: "the best of every island.",
    sub: "From Waikiki high-rises to North Shore hideaways and Maui resorts — compare top-rated stays and book with free cancellation.",
    pills: ["🏖️ Oahu", "🌈 Maui", "🌴 Kauai", "🌋 Big Island"],
    cta: "Find your stay at gohonu.com →", foot: "🏨 Top-rated hotels & resorts  ·  💛 Best areas on every island" },

  { name: "04-worldwide", bg: "assets/img/dest/bali.jpg", accent: CORAL,
    h1: ["From Waikiki", "to the world —"], acc: "beyond Hawaii.",
    sub: "Tours, hotels & activities in 40+ destinations worldwide — Bali, Tokyo, Rome, Tahiti and more. One place for every trip.",
    pills: ["🌏 Worldwide", "🎟️ Tours", "🏨 Hotels", "✈️ Flights"],
    cta: "Explore the world at gohonu.com →", foot: "🌺 Hawaii-rooted, world-wide  ·  ✅ Trusted partners" },

  { name: "05-polynesia", bg: "assets/img/dest/bora-bora.jpg", accent: AQUA,
    h1: ["Island-hop across", "Polynesia."], acc: "Tahiti · Bora Bora · Fiji.",
    sub: "Overwater bungalows, turquoise lagoons and the islands of the Pacific triangle — tours and stays, all in one place.",
    pills: ["🏝️ Bora Bora", "🌺 Tahiti", "🐠 Fiji", "🌴 Moorea"],
    cta: "Discover Polynesia at gohonu.com →", foot: "🌊 The South Pacific, hand-picked" },

  { name: "06-packages", bg: "assets/img/promo/bg/beach.jpg", accent: CORAL,
    h1: ["Flight + Hotel,"], acc: "bundled & saved.",
    sub: "Book your flight and hotel together and often pay less — one booking, one confirmation, less hassle.",
    pills: ["✈️ Flights", "🏨 Hotels", "💰 Save", "🧳 Bundle"],
    cta: "Build a package at gohonu.com →", foot: "💰 Often cheaper than booking separately" },

  { name: "07-oahu", bg: "assets/img/promo/bg/waikiki.jpg", accent: AQUA,
    h1: ["Oahu,"], acc: "done right.",
    sub: "Pearl Harbor, Diamond Head, North Shore surf and Waikiki nights — the best tours and stays on the island we call home.",
    pills: ["🤙 Tours", "🏨 Stays", "🚗 Cars", "🎟️ Attractions"],
    cta: "Explore Oahu at gohonu.com →", foot: "🏝️ From our backyard to your trip" },

  { name: "08-maui", bg: "assets/img/promo/bg/maui.jpg", accent: CORAL,
    h1: ["Maui magic —"], acc: "sunrise to sunset.",
    sub: "Road to Hana, Molokini snorkeling, Haleakalā sunrises and Wailea resorts — plan your whole Maui trip in one place.",
    pills: ["🌅 Sunrise", "🐢 Snorkel", "🛣️ Hana", "🏨 Resorts"],
    cta: "Plan Maui at gohonu.com →", foot: "🌈 The Valley Isle, hand-picked" },

  { name: "09-experiences", bg: "assets/img/promo/bg/luau.jpg", accent: CORAL,
    h1: ["More than a beach."], acc: "It's an experience.",
    sub: "Luaus, fire dancers, volcano hikes and manta-ray night dives — hand-picked Hawaii experiences, booked in seconds.",
    pills: ["🔥 Luau", "🌋 Volcano", "🐠 Manta", "🏄 Surf"],
    cta: "Find experiences at gohonu.com →", foot: "🎆 Make it a trip to remember" },

  { name: "10-local", bg: "assets/img/promo/bg/snorkel.jpg", accent: AQUA,
    h1: ["Hawaii,"], acc: "by people who live here.",
    sub: "We're Honolulu locals. We hand-pick the tours, stays and operators worth your time — and you book direct with trusted partners.",
    pills: ["🌺 Local", "✅ Trusted", "⭐ Top-rated", "🐢 GoHonu"],
    cta: "See our picks at gohonu.com →", foot: "🐢 Built by Hawaii locals, for your trip" },
];

function html(c) {
  return `<!doctype html><html><head><meta charset="utf8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px}
.card{position:relative;width:1080px;height:1350px;overflow:hidden;background:#06313f url('${abs(c.bg)}') center/cover no-repeat;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,43,56,.62) 0%,rgba(6,43,56,.20) 32%,rgba(6,43,56,.82) 100%)}
.content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:70px 72px 64px}
.brand{display:flex;align-items:center;gap:14px;font-size:50px;font-weight:800;color:#fff;letter-spacing:-.5px}
.brand img{width:62px;height:62px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
.brand em{font-style:normal;color:${AQUA}}
.mid{margin-top:6px}
h1{font-size:96px;line-height:1.02;font-weight:800;color:#fff;letter-spacing:-1.5px;text-shadow:0 3px 24px rgba(0,0,0,.4)}
h1 .accent{color:${c.accent}}
.sub{margin-top:26px;font-size:33px;line-height:1.4;color:rgba(255,255,255,.95);max-width:660px;font-weight:500;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.pills{display:flex;flex-wrap:wrap;gap:14px;margin-top:34px}
.pills span{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:999px;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.4);color:#fff;font-size:28px;font-weight:700}
.cta{display:inline-flex;align-items:center;gap:12px;margin-top:42px;padding:26px 44px;border-radius:18px;background:#ff5a36;color:#fff;font-size:35px;font-weight:800;box-shadow:0 16px 40px rgba(255,90,54,.45);letter-spacing:-.3px}
.foot{display:flex;align-items:center;font-size:26px;font-weight:600;color:rgba(255,255,255,.95);text-shadow:0 2px 10px rgba(0,0,0,.5);flex-wrap:wrap}
.handle{margin-top:14px;font-size:26px;color:${AQUA};font-weight:700}
</style></head><body>
<div class="card"><div class="scrim"></div><div class="content">
  <div class="brand"><img src="${abs("assets/img/logo.png")}"> Go<em>Honu</em></div>
  <div class="mid">
    <h1>${c.h1.map(esc).join("<br>")}<br><span class="accent">${esc(c.acc)}</span></h1>
    <p class="sub">${esc(c.sub)}</p>
    <div class="pills">${c.pills.map((p) => `<span>${esc(p)}</span>`).join("")}</div>
    <a class="cta">${esc(c.cta)}</a>
  </div>
  <div><div class="foot">${esc(c.foot)}</div><div class="handle">🐢 @gohonutours</div></div>
</div></div>
</body></html>`;
}

const outDir = path.join(ROOT, "assets", "img", "promo");
fs.mkdirSync(outDir, { recursive: true });
for (const c of CARDS) {
  const htmlPath = path.join(require("os").tmpdir(), `promo-${c.name}.html`);
  fs.writeFileSync(htmlPath, html(c));
  const out = path.join(outDir, `card-${c.name}.png`);
  execSync(
    `${JSON.stringify(CHROME)} --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1350 --virtual-time-budget=5000 --screenshot=${JSON.stringify(out)} "file://${htmlPath}"`,
    { stdio: "ignore" }
  );
  console.log(`  ✓ card-${c.name}.png`);
}
console.log(`\nWrote ${CARDS.length} promo cards -> assets/img/promo/`);
