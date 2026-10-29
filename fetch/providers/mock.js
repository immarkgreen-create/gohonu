/**
 * Mock provider — deterministic SAMPLE data so the Beyond-Hawaii pages render
 * before any real API keys exist. Every tour is flagged sample:true so the UI
 * can label it. Booking links go to Viator with your affiliate IDs attached,
 * so even sample cards are real, attributable links (just not a specific tour).
 */
const SOURCE = "mock";

const CATALOG = {
  cancun: [
    ["Chichén Itzá, Cenote & Valladolid Day Trip", "Day Trips", 79, 4.6, 8421, "12 hours"],
    ["Isla Mujeres Catamaran with Open Bar & Snorkel", "Water Activities", 89, 4.7, 6190, "7 hours"],
    ["Tulum & Cenote Dos Ojos Tour", "Day Trips", 69, 4.5, 5533, "9 hours"],
    ["Xcaret Park All-Inclusive Admission", "Theme Parks", 139, 4.8, 12044, "Full day"],
    ["Cancún Jungle Tour: Speedboat & Snorkel", "Water Activities", 64, 4.4, 3120, "2.5 hours"],
    ["Swim with Whale Sharks (Seasonal)", "Water Activities", 195, 4.9, 1890, "6 hours"],
    ["Scuba Diving for Beginners (2 Reef Dives)", "Water Activities", 120, 4.7, 980, "4 hours"],
    ["Coba Ruins, Cenote & Mayan Village", "Day Trips", 95, 4.6, 2740, "8 hours"],
  ],
  "las-vegas": [
    ["Grand Canyon West Rim & Skywalk by Bus", "Day Trips", 139, 4.6, 9210, "11 hours"],
    ["Grand Canyon Helicopter Landing Tour", "Scenic Flights", 399, 4.8, 4455, "4 hours"],
    ["High Roller Observation Wheel Ticket", "Attractions", 37, 4.7, 15300, "30 min"],
    ["Hoover Dam Half-Day Tour", "Day Trips", 69, 4.5, 3880, "5 hours"],
    ["Cirque du Soleil 'O' at Bellagio", "Shows", 129, 4.9, 6700, "90 min"],
    ["Las Vegas Strip Night Helicopter Flight", "Scenic Flights", 109, 4.8, 5120, "15 min"],
    ["Antelope Canyon & Horseshoe Bend Day Trip", "Day Trips", 199, 4.7, 2610, "14 hours"],
  ],
  rome: [
    ["Colosseum, Roman Forum & Palatine Skip-the-Line", "Cultural", 59, 4.7, 24110, "3 hours"],
    ["Vatican Museums & Sistine Chapel Guided Tour", "Cultural", 69, 4.6, 19880, "3 hours"],
    ["Pantheon Fast-Track Entry & Audio Guide", "Cultural", 25, 4.5, 4300, "1 hour"],
    ["Rome Food Tour in Trastevere", "Food & Drink", 89, 4.9, 5240, "3.5 hours"],
    ["Catacombs & Crypts Underground Tour", "Cultural", 55, 4.6, 3110, "3 hours"],
    ["Day Trip to Pompeii & Amalfi Coast", "Day Trips", 145, 4.5, 2870, "13 hours"],
    ["Borghese Gallery Skip-the-Line Ticket", "Cultural", 45, 4.8, 6020, "2 hours"],
  ],
  bali: [
    ["Ubud: Rice Terraces, Temples & Waterfall", "Day Trips", 49, 4.7, 7810, "10 hours"],
    ["Mount Batur Sunrise Trek with Breakfast", "Outdoor", 45, 4.8, 9240, "9 hours"],
    ["Nusa Penida Island Day Tour & Snorkel", "Day Trips", 75, 4.6, 5600, "12 hours"],
    ["Bali ATV Quad Bike Jungle Ride", "Outdoor", 55, 4.7, 4120, "3 hours"],
    ["White Water Rafting on Ayung River", "Outdoor", 39, 4.6, 3380, "4 hours"],
    ["Uluwatu Temple & Kecak Fire Dance", "Cultural", 35, 4.5, 2990, "6 hours"],
    ["Snorkeling at Blue Lagoon & Tanjung Jepun", "Water Activities", 60, 4.7, 1740, "5 hours"],
  ],
};

function affiliate(destName, env) {
  const q = encodeURIComponent(destName + " tours");
  return `https://www.viator.com/searchResults/all?text=${q}&pid=${env.VIATOR_AFFILIATE_PID || "P00167800"}&uid=${env.VIATOR_AFFILIATE_UID || "U00485633"}&mcid=${env.VIATOR_AFFILIATE_MCID || "58086"}`;
}

module.exports = {
  name: SOURCE,
  enabled: () => true,
  async search({ destination, env }) {
    const rows = CATALOG[destination.slug] || [];
    return rows.map(([name, category, priceFrom, rating, reviewCount, duration]) => ({
      source: SOURCE,
      sample: true,
      name,
      destination: destination.name,
      region: destination.region,
      country: destination.country,
      category,
      priceFrom,
      currency: "USD",
      rating,
      reviewCount,
      duration,
      freeCancellation: true,
      image: "",
      bookingUrl: affiliate(destination.name, env),
    }));
  },
};
