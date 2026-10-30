#!/usr/bin/env node
/**
 * iOS PWA launch screens (apple-touch-startup-image). Renders one responsive
 * green splash design (ocean->green gradient + turtle tile + wordmark) at each
 * device's pixel resolution via headless Chrome, writing assets/img/splash/<label>.png.
 *
 * build.js emits the matching <link rel="apple-touch-startup-image"> tags from the
 * same data/splash-devices.json, so the two always stay in sync.
 *
 * Run:  node fetch/splash.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const HTML = `<!doctype html><html><head><meta charset="utf8"><style>
html,body{margin:0;height:100%}
.sp{width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:linear-gradient(160deg,#0a7ea4 0%,#0e9488 46%,#15b36a 100%);
  font-family:-apple-system,"Segoe UI",Roboto,sans-serif}
.tile{width:min(40vw,34vh);aspect-ratio:1;background:#fff;border-radius:24%;
  display:flex;align-items:center;justify-content:center;box-shadow:0 14px 46px rgba(0,0,0,.22)}
.tile span{font-size:min(28vw,24vh);line-height:1;
  font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}
.name{margin-top:min(7vh,40px);color:#fff;font-weight:800;font-size:min(10vw,6vh);letter-spacing:.5px}
.name em{font-style:normal;color:#bdf5df}
.tag{margin-top:10px;color:rgba(255,255,255,.92);font-weight:600;font-size:min(4.4vw,2.6vh)}
</style></head><body>
<div class="sp"><div class="tile"><span>&#128034;</span></div>
<div class="name">Go<em>Honu</em></div><div class="tag">Hawaii tours &amp; activities</div></div>
</body></html>`;

function main() {
  if (!fs.existsSync(CHROME)) {
    console.log("Google Chrome not found — skipping splash generation.");
    return;
  }
  const { devices } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "splash-devices.json"), "utf8"));
  const htmlPath = path.join(require("os").tmpdir(), "gohonu-splash.html");
  fs.writeFileSync(htmlPath, HTML);
  const outDir = path.join(ROOT, "assets", "img", "splash");
  fs.mkdirSync(outDir, { recursive: true });

  for (const d of devices) {
    const pw = d.w * d.dpr;
    const ph = d.h * d.dpr;
    const out = path.join(outDir, `${d.label}.png`);
    try {
      execSync(
        `${JSON.stringify(CHROME)} --headless=new --disable-gpu --hide-scrollbars ` +
          `--force-device-scale-factor=1 --virtual-time-budget=3000 ` +
          `--window-size=${pw},${ph} --screenshot=${JSON.stringify(out)} "file://${htmlPath}"`,
        { stdio: "ignore" }
      );
      console.log(`  ✓ ${d.label}  ${pw}x${ph}`);
    } catch (e) {
      console.log(`  ✗ ${d.label} — ${e.message.split("\n")[0]}`);
    }
  }
  console.log(`\nWrote ${devices.length} splash images -> assets/img/splash/`);
}

main();
