/**
 * GetYourGuide Partner API adapter (stub).
 * Wire the real endpoint + response mapping once GYG_API_KEY is available and
 * the account's feed access is confirmed. Returns [] until then.
 */
const SOURCE = "getyourguide";
module.exports = {
  name: SOURCE,
  enabled: (env) => !!env.GYG_API_KEY,
  async search({ destination, env }) {
    if (!env.GYG_API_KEY) return [];
    // TODO: call GetYourGuide partner feed for destination; map to the
    // normalized shape below (same fields as the viator adapter).
    return [];
  },
};
