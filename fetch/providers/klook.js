/**
 * Klook affiliate adapter (stub).
 * Wire up once KLOOK_API_KEY / feed access is confirmed. Returns [] until then.
 */
const SOURCE = "klook";
module.exports = {
  name: SOURCE,
  enabled: (env) => !!env.KLOOK_API_KEY,
  async search({ destination, env }) {
    if (!env.KLOOK_API_KEY) return [];
    return [];
  },
};
