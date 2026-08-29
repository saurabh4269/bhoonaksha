/* Village directory search. Runs off the map thread. */
let rows = [];
let byName2 = Object.create(null);
let byPin3 = Object.create(null);
let byDistrict = Object.create(null);
let geo = [];

function rowToVillage(r) {
  return {
    lgd: r[0],
    name: r[1],
    name_local: r[2],
    district: r[3],
    state: r[4],
    subdistrict: r[5],
    pincode: r[6],
    lat: r[7],
    lon: r[8]
  };
}

async function inflate(buf) {
  const ds = new DecompressionStream("gzip");
  const stream = new Response(buf).body.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function indexRows() {
  byName2 = Object.create(null);
  byPin3 = Object.create(null);
  byDistrict = Object.create(null);
  geo = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    function addNameKey(s) {
      const key = (s || "").slice(0, 2).toLowerCase();
      if (key.length === 2) {
        if (!byName2[key]) byName2[key] = [];
        byName2[key].push(i);
      }
    }
    addNameKey(r[1]);
    addNameKey(r[2]);
    const pin = r[6] || "";
    if (pin.length >= 3) {
      const p = pin.slice(0, 3);
      if (!byPin3[p]) byPin3[p] = [];
      byPin3[p].push(i);
    }
    const dist = (r[3] || "").toLowerCase();
    if (dist) {
      if (!byDistrict[dist]) byDistrict[dist] = [];
      byDistrict[dist].push(i);
    }
    if (r[7] != null && r[8] != null) geo.push(i);
  }
}

function score(r, q, qLow) {
  const name = (r[1] || "").toLowerCase();
  const nl = r[2] || "";
  const dist = (r[3] || "").toLowerCase();
  const pin = r[6] || "";
  const lgd = String(r[0]);
  if (lgd === q || pin === q) return 100;
  if (name === qLow) return 90;
  if (name.startsWith(qLow)) return 80;
  if (nl.startsWith(q) || nl.toLowerCase().startsWith(qLow)) return 78;
  if (name.includes(qLow)) return 55;
  if (nl.includes(q)) return 52;
  if (dist === qLow) return 48;
  if (dist.startsWith(qLow)) return 40;
  if (pin.startsWith(q)) return 50;
  if (lgd.startsWith(q)) return 45;
  return 0;
}

function collect(indices, q, qLow, hits, seen) {
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    if (seen[i]) continue;
    const s = score(rows[i], q, qLow);
    if (s) {
      seen[i] = 1;
      hits.push([s, i]);
    }
  }
}

function search(q) {
  const raw = (q || "").trim();
  if (raw.length < 2 || !rows.length) return [];
  const qLow = raw.toLowerCase();
  const hits = [];
  const seen = Object.create(null);

  if (/^\d+$/.test(raw)) {
    if (raw.length >= 3 && byPin3[raw.slice(0, 3)]) {
      collect(byPin3[raw.slice(0, 3)], raw, qLow, hits, seen);
    }
    for (let i = 0; i < rows.length && hits.length < 40; i++) {
      const lgd = String(rows[i][0]);
      if (lgd === raw || lgd.startsWith(raw)) {
        if (!seen[i]) {
          seen[i] = 1;
          hits.push([lgd === raw ? 100 : 45, i]);
        }
      }
    }
  } else {
    const b = byName2[qLow.slice(0, 2)];
    if (b) collect(b, raw, qLow, hits, seen);
    const distKeys = Object.keys(byDistrict);
    for (let d = 0; d < distKeys.length; d++) {
      const dist = distKeys[d];
      if (dist === qLow || dist.startsWith(qLow)) {
        collect(byDistrict[dist].slice(0, 30), raw, qLow, hits, seen);
      }
    }
  }

  hits.sort((a, b) => b[0] - a[0] || String(rows[a[1]][1]).localeCompare(rows[b[1]][1]));
  const out = [];
  for (let i = 0; i < hits.length && out.length < 8; i++) {
    out.push(rowToVillage(rows[hits[i][1]]));
  }
  return out;
}

function distKm(lat, lon, r) {
  const R = 6371;
  const tr = Math.PI / 180;
  const p1 = lat * tr;
  const dLat = (r[7] - lat) * tr;
  const dLon = (r[8] - lon) * tr;
  const p2 = r[7] * tr;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function near(lat, lon) {
  let best = null;
  let bestD = 9e9;
  for (let k = 0; k < geo.length; k++) {
    const r = rows[geo[k]];
    const d = distKm(lat, lon, r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (!best || bestD > 8) return null;
  const v = rowToVillage(best);
  v.km = Math.round(bestD * 10) / 10;
  return v;
}

function nearby(lat, lon) {
  const dLatMax = 20 / 111;
  const cos = Math.cos(lat * Math.PI / 180);
  const dLonMax = 20 / (111 * Math.max(0.2, Math.abs(cos)));
  const hits = [];
  for (let k = 0; k < geo.length; k++) {
    const r = rows[geo[k]];
    if (Math.abs(r[7] - lat) > dLatMax || Math.abs(r[8] - lon) > dLonMax) continue;
    const d = distKm(lat, lon, r);
    if (d <= 20) hits.push([d, r]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (let i = 0; i < hits.length && out.length < 8; i++) {
    const v = rowToVillage(hits[i][1]);
    v.km = Math.round(hits[i][0] * 10) / 10;
    out.push(v);
  }
  return out;
}

self.onmessage = async (e) => {
  const d = e.data || {};
  try {
    if (d.type === "load") {
      const res = await fetch(d.url);
      if (!res.ok) throw new Error("lgd " + res.status);
      const raw = await inflate(await res.arrayBuffer());
      rows = JSON.parse(new TextDecoder().decode(raw));
      indexRows();
      self.postMessage({ type: "ready", n: rows.length, geo: geo.length });
      return;
    }
    if (d.type === "search") {
      self.postMessage({ type: "results", id: d.id, items: search(d.q) });
      return;
    }
    if (d.type === "near") {
      self.postMessage({ type: "near", id: d.id, item: near(d.lat, d.lon) });
      return;
    }
    if (d.type === "nearby") {
      self.postMessage({ type: "nearby", id: d.id, items: nearby(d.lat, d.lon) });
    }
  } catch (err) {
    self.postMessage({ type: "error", id: d.id, message: String(err && err.message ? err.message : err) });
  }
};
