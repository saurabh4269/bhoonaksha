/* Village search now uses GET /api/search against data/mera.sqlite (LGD).
   This file is unused. It used to hold a Sitapur prototype with invented
   owner names and a fake khasra grid — those are gone on purpose. */
window.VILLAGES = [];
window.OWNERS = [];
window.buildPlots = function buildPlots() {
  return { type: "FeatureCollection", features: [] };
};
