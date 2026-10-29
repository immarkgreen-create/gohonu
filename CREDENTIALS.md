# Credentials checklist — Everything Hawaii

Single source of truth for every API key / ID the site can use.
**Secrets go in `.env`** (gitignored, never committed). IDs/markers that appear in public
links are not secret. To hand me a secret: paste it in chat and I'll place it, OR edit `.env`
yourself (`open -e ~/everything-hawaii/.env`).

Legend: ✅ have it · 🟢 easy self-serve · 🟡 approval-gated · ⚪ not needed

| Credential | Status | Unlocks | Where to get it | Secret? | .env var |
|---|---|---|---|---|---|
| Travelpayouts token | ✅ | Flights (live), future hotels/car | travelpayouts.com → Profile → API token | **yes** | `TP_TOKEN` |
| Travelpayouts marker | ✅ `541388` | Attribution/earnings on all TP links | TP dashboard (partner ID) | no | `TP_MARKER` |
| FareHarbor FHDN ref | ✅ `everythinghawaiitravel` | FareHarbor bookings + attribution | already yours (embed links) | no | `FAREHARBOR_REF` |
| Viator affiliate IDs | ✅ | Affiliate tagging on Viator links | Viator partner dashboard | no | `VIATOR_AFFILIATE_PID/UID/MCID` |
| Pixabay key | 🟢 | Real licensed tour photos | pixabay.com/api/docs (instant) | yes | `PIXABAY_API_KEY` |
| Unsplash key | 🟢 | Real photos (alt to Pixabay) | unsplash.com/developers (instant) | yes | `UNSPLASH_ACCESS_KEY` |
| Viator Partner API key | 🟡 | **Beyond Hawaii real ranked tours** | partners.viator.com → request Basic API via support | yes | `VIATOR_API_KEY` |
| GetYourGuide API | 🟡 | More Beyond-Hawaii activities | partner.getyourguide.com (enroll) | yes | `GYG_API_KEY` + `GYG_PARTNER_ID` |
| Klook API | 🟡 | More Beyond-Hawaii activities | Klook affiliate program | yes | `KLOOK_API_KEY` + `KLOOK_AFFILIATE_ID` |
| Travelpayouts sub-programs | 🟢 | WeGoTrip / Tiqets activities, hotels | "Join" each program inside TP (uses same token+marker) | no | (uses `TP_TOKEN`/`TP_MARKER`) |
| FareHarbor External API | ⚪ | NOT needed — FHDN embed links already work | application + approval only | — | — |
| Pexels | ⚪ | (new keys paused by Pexels) | pexels.com/api | yes | `PEXELS_API_KEY` |

## Priority order
1. **Pixabay** (🟢, 2 min) → real images site-wide now.
2. **Viator Basic API** (🟡, request now) → Beyond Hawaii goes live when approved.
3. **Join WeGoTrip/Tiqets in Travelpayouts** (🟢) → extra activities under marker 541388.
4. **GetYourGuide / Klook** (🟡) → breadth, when you want it.

Rotate any secret anytime from its dashboard. Nothing here is required for the site to
build — every integration self-disables if its key is absent.
