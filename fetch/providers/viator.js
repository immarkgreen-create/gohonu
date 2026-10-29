/**
 * Viator Partner API adapter (Basic/Full affiliate access).
 * Returns normalized, top-rated tours for a destination.
 *
 * Auth: exp-api-key header. The product's own `productUrl` already carries the
 * affiliate tracking for your API key's account, so we use it as-is (never
 * rewrite it). Needs env.VIATOR_API_KEY and destination.viatorDestId.
 *
 * Base defaults to production; set VIATOR_API_BASE to the sandbox host to test.
 */
const SOURCE = "viator";

function durationText(d) {
  if (!d) return "";
  if (d.fixedDurationInMinutes) {
    const m = d.fixedDurationInMinutes;
    return m >= 60 ? `${+(m / 60).toFixed(1)} hours` : `${m} min`;
  }
  if (d.variableDurationFromMinutes) {
    const a = Math.round(d.variableDurationFromMinutes / 60);
    const b = Math.round(d.variableDurationToMinutes / 60);
    return a === b ? `${a} hours` : `${a}–${b} hours`;
  }
  return "";
}

function bestImage(images) {
  const im = (images || []).find((x) => x.isCover) || (images || [])[0];
  const vars = (im && im.variants) || [];
  const sized = vars.filter((v) => v.width).sort((a, b) => a.width - b.width);
  const pick = sized.reverse().find((v) => v.width <= 720) || sized[0] || vars.slice(-1)[0];
  return (pick && pick.url) || "";
}

module.exports = {
  name: SOURCE,
  enabled: (env) => !!env.VIATOR_API_KEY,
  async search({ destination, env, limit = 30 }) {
    if (!env.VIATOR_API_KEY || !destination.viatorDestId) return [];
    const base = env.VIATOR_API_BASE || "https://api.viator.com/partner";
    const res = await fetch(`${base}/products/search`, {
      method: "POST",
      headers: {
        "exp-api-key": env.VIATOR_API_KEY,
        Accept: "application/json;version=2.0",
        "Accept-Language": "en-US",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filtering: { destination: String(destination.viatorDestId) },
        sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
        pagination: { start: 1, count: limit },
        currency: "USD",
      }),
    });
    if (!res.ok) {
      console.warn(`[viator] ${destination.name}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.products || []).map((p) => ({
      source: SOURCE,
      name: p.title,
      destination: destination.name,
      region: destination.region,
      country: destination.country,
      category: (p.flags || []).includes("PRIVATE_TOUR") ? "Private tour" : "Tours & Activities",
      priceFrom: p.pricing?.summary?.fromPrice ?? null,
      currency: p.pricing?.currency || "USD",
      rating: p.reviews?.combinedAverageRating ?? 0,
      reviewCount: p.reviews?.totalReviews ?? 0,
      duration: durationText(p.duration),
      freeCancellation: (p.flags || []).includes("FREE_CANCELLATION"),
      image: bestImage(p.images),
      bookingUrl: p.productUrl, // already affiliate-tracked for your key
    }));
  },
};
