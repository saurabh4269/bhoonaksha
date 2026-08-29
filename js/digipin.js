window.DIGIPIN_GRID = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"]
];
window.DIGIPIN_BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };

window.getDigiPin = function getDigiPin(lat, lon) {
  const B = window.DIGIPIN_BOUNDS;
  if (lat < B.minLat || lat > B.maxLat || lon < B.minLon || lon > B.maxLon) return null;
  let minLat = B.minLat, maxLat = B.maxLat, minLon = B.minLon, maxLon = B.maxLon;
  let pin = "";
  for (let level = 1; level <= 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    let row = 3 - Math.floor((lat - minLat) / latDiv);
    let col = Math.floor((lon - minLon) / lonDiv);
    row = Math.max(0, Math.min(row, 3));
    col = Math.max(0, Math.min(col, 3));
    pin += window.DIGIPIN_GRID[row][col];
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return pin;
};

window.getLatLngFromDigiPin = function getLatLngFromDigiPin(digiPin) {
  if (typeof digiPin !== "string") return null;
  const pin = digiPin.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[23456789CJKLMPFT]{10}$/.test(pin)) return null;
  const B = window.DIGIPIN_BOUNDS;
  let minLat = B.minLat, maxLat = B.maxLat, minLon = B.minLon, maxLon = B.maxLon;
  const GRID = window.DIGIPIN_GRID;
  for (let i = 0; i < 10; i++) {
    let ri = -1, ci = -1;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (GRID[r][c] === pin[i]) { ri = r; ci = c; }
      }
    }
    if (ri < 0) return null;
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    const lat1 = maxLat - latDiv * (ri + 1);
    const lat2 = maxLat - latDiv * ri;
    const lon1 = minLon + lonDiv * ci;
    const lon2 = minLon + lonDiv * (ci + 1);
    minLat = lat1; maxLat = lat2; minLon = lon1; maxLon = lon2;
  }
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
};

window.isDigiPin = function isDigiPin(s) {
  return /^[23456789CJKLMPFTcjklmpft]{10}$/.test(String(s).replace(/[\s-]/g, ""));
};
