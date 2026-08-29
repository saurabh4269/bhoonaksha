(() => {
  const PLOT_KEYS = [
    "KIDE", "kide", "Kide",
    "revenue_plot", "Revenue_Plot", "REVENUE_PLOT",
    "parcel_num", "par_num", "Parcel_num",
    "survey_number", "SurveyNumber", "Surveynumber_Old", "surveyno", "survey_no",
    "plotno", "plot_no", "Plot_No", "PLOT_NO",
    "khasra", "khasra_no", "Khasra",
    "dag", "dag_no", "Dag", "dagno",
    "1survey_number", "2survey_number", "028survey_number"
  ];
  const ULPIN_KEYS = ["ulpin", "ULPIN", "Ulpin", "ulpin_no", "ULPIN_NO", "ulpin_id", "ULPIN_ID", "ulpin_code", "ULPIN_CODE"];
  const AREA_KEYS = ["area_m2", "AREA_M2", "shape_area", "Shape_Area", "SHAPE_AREA", "gis_area", "GIS_AREA", "area_ha", "Area_Ha", "AREA_HA", "area", "Area", "AREA"];
  const SURVEY_STATES = {
    "survey-ap": "Andhra Pradesh",
    "survey-tn": "Tamil Nadu",
    "survey-kl": "Kerala",
    "survey-tg": "Telangana",
    "survey-ka": "Karnataka",
    "survey-mh": "Maharashtra",
    "survey-od": "Odisha",
    "survey-hr": "Haryana",
    "survey-mp": "Madhya Pradesh",
    "survey-ga": "Goa",
    "survey-as": "Assam",
    "survey-jh": "Jharkhand"
  };
  const EMPTY = { type: "FeatureCollection", features: [] };
  const PLOT_CAP = 80;
  const VERT_CAP = 400;
  const THEME_CAP = 150;
  const VERT_MINZOOM = 14;

  function surveyNumber(props) {
    if (!props) return "";
    for (let i = 0; i < PLOT_KEYS.length; i++) {
      const k = PLOT_KEYS[i];
      if (props[k] != null && String(props[k]).trim()) return String(props[k]).trim();
    }
    const keys = Object.keys(props);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (/survey|khasra|plot|kide|dag/i.test(k) && props[k] != null && String(props[k]).trim()) {
        return String(props[k]).trim();
      }
    }
    return "";
  }

  function ulpinOf(props) {
    if (!props) return "";
    for (let i = 0; i < ULPIN_KEYS.length; i++) {
      const k = ULPIN_KEYS[i];
      if (props[k] != null && String(props[k]).trim()) return String(props[k]).trim();
    }
    return "";
  }

  function stateNameFromLayer(layerId, sourceId) {
    const raw = String(sourceId || layerId || "");
    const key = raw.replace(/-fill$/, "").replace(/-line$/, "");
    return SURVEY_STATES[key] || "";
  }

  function looksLikePlotQuery(q) {
    const s = String(q || "").trim();
    if (!s) return false;
    if (/^(dag|khasra|survey|sy\.?|plot|kide|gata|khasra no\.?|s\.?no\.?)\b/i.test(s)) return true;
    if (/^\d{1,6}[A-Za-z]?$/.test(s)) return true;
    if (/^\d+[\/\-]\d+[A-Za-z0-9\/\-]*$/.test(s)) return true;
    if (/^\d+[A-Za-z]?\s*[\/\-]\s*\d+/.test(s)) return true;
    return false;
  }

  function normPlot(s) {
    return String(s || "").replace(/\s+/g, "").replace(/^0+(?=\d)/, "").toLowerCase();
  }

  function distM(a, b) {
    const R = 6371000, tr = Math.PI / 180;
    const p1 = a[1] * tr, p2 = b[1] * tr, dP = (b[1] - a[1]) * tr, dL = (b[0] - a[0]) * tr;
    const s = Math.sin(dP / 2) * Math.sin(dP / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dL / 2) * Math.sin(dL / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function areaRingM2(ring) {
    if (!ring || ring.length < 3) return 0;
    const R = 6371000, tr = Math.PI / 180;
    let a = 0;
    const n = ring.length;
    const closed = ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
    const count = closed ? n - 1 : n;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      a += (ring[j][0] - ring[i][0]) * tr * (2 + Math.sin(ring[i][1] * tr) + Math.sin(ring[j][1] * tr));
    }
    return Math.abs(a * R * R / 2);
  }

  function ringsOf(geom) {
    if (!geom) return [];
    const t = geom.type;
    const c = geom.coordinates;
    if (t === "Polygon") return c || [];
    if (t === "MultiPolygon") {
      const out = [];
      (c || []).forEach(function (poly) {
        (poly || []).forEach(function (r) { out.push(r); });
      });
      return out;
    }
    if (t === "LineString") return [c];
    if (t === "MultiLineString") return c || [];
    return [];
  }

  function areaOfGeom(geom) {
    const rings = ringsOf(geom);
    if (!rings.length) return 0;
    let a = areaRingM2(rings[0]);
    for (let i = 1; i < rings.length; i++) a -= areaRingM2(rings[i]);
    return Math.abs(a);
  }

  function existingAreaM2(props) {
    if (!props) return 0;
    for (let i = 0; i < AREA_KEYS.length; i++) {
      const k = AREA_KEYS[i];
      if (props[k] == null || props[k] === "") continue;
      const n = Number(props[k]);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (/ha/i.test(k)) return n * 10000;
      return n;
    }
    return 0;
  }

  function areaValue(props, geom) {
    const fromProp = existingAreaM2(props);
    if (fromProp > 0) return fromProp;
    return areaOfGeom(geom);
  }

  function centroidOf(geom) {
    const rings = ringsOf(geom);
    if (!rings.length || !rings[0] || !rings[0].length) return null;
    const ring = rings[0];
    let sx = 0, sy = 0, n = ring.length;
    if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) n -= 1;
    if (n < 1) return null;
    for (let i = 0; i < n; i++) { sx += ring[i][0]; sy += ring[i][1]; }
    return [sx / n, sy / n];
  }

  function bboxOf(geom) {
    const rings = ringsOf(geom);
    let minX = 180, minY = 90, maxX = -180, maxY = -90, ok = false;
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r] || [];
      for (let i = 0; i < ring.length; i++) {
        const x = ring[i][0], y = ring[i][1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        ok = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    return ok ? [[minX, minY], [maxX, maxY]] : null;
  }

  function liveLayers(map, ids) {
    return (ids || []).filter(function (id) { return map && map.getLayer(id); });
  }

  function queryVisible(map, layerIds) {
    const layers = liveLayers(map, layerIds);
    if (!layers.length) return [];
    try { return map.queryRenderedFeatures({ layers: layers }); }
    catch (e) { return []; }
  }

  function collectVisiblePlots(map, layerIds, cap) {
    cap = cap || PLOT_CAP;
    const feats = queryVisible(map, layerIds);
    const seen = Object.create(null);
    const out = [];
    for (let i = 0; i < feats.length && out.length < cap; i++) {
      const f = feats[i];
      const id = surveyNumber(f && f.properties);
      if (!id) continue;
      const key = normPlot(id);
      if (!key || seen[key]) continue;
      seen[key] = 1;
      const c = centroidOf(f.geometry);
      out.push({
        id: id,
        feat: f,
        lngLat: c,
        village: (f.properties && (f.properties.v_name || f.properties.village || f.properties.m_name)) || "",
        layerId: f.layer && f.layer.id,
        source: f.source
      });
    }
    out.sort(function (a, b) {
      return String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" });
    });
    return out;
  }

  function matchVisiblePlots(map, layerIds, q, cap) {
    const qn = normPlot(q.replace(/^(dag|khasra|survey|sy\.?|plot|kide|gata|s\.?no\.?)\s*/i, ""));
    if (!qn) return [];
    const all = collectVisiblePlots(map, layerIds, 200);
    const hits = [];
    for (let i = 0; i < all.length && hits.length < (cap || 12); i++) {
      const pn = normPlot(all[i].id);
      if (pn === qn || pn.indexOf(qn) === 0 || qn.indexOf(pn) === 0) hits.push(all[i]);
    }
    return hits;
  }

  function vertsFromGeom(geom, seen, out, cap) {
    const rings = ringsOf(geom);
    for (let r = 0; r < rings.length && out.length < cap; r++) {
      const ring = rings[r] || [];
      let n = ring.length;
      if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) n -= 1;
      for (let k = 0; k < n && out.length < cap; k++) {
        const x = ring[k][0], y = ring[k][1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const key = x.toFixed(6) + "," + y.toFixed(6);
        if (seen[key]) continue;
        seen[key] = 1;
        out.push({ type: "Feature", geometry: { type: "Point", coordinates: [x, y] }, properties: {} });
      }
    }
  }

  function edgeLabelsFromGeom(geom) {
    const rings = ringsOf(geom);
    const out = [];
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r] || [];
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        if (!a || !b) continue;
        const m = distM(a, b);
        if (m < 2) continue;
        out.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] },
          properties: { len: m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m" }
        });
      }
    }
    return out;
  }

  function setSrc(map, id, feats) {
    const src = map && map.getSource(id);
    if (src) src.setData({ type: "FeatureCollection", features: feats || [] });
  }

  function ensureOverlays(map) {
    if (!map) return;
    try {
      if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) return;
    } catch (e) { return; }
    if (!map.getSource("plot-theme")) {
      map.addSource("plot-theme", { type: "geojson", data: EMPTY });
      const beforeFill = map.getLayer("draw-fill") || map.getLayer("plot-hl-fill") ? (map.getLayer("draw-fill") ? "draw-fill" : "plot-hl-fill") : undefined;
      try {
        map.addLayer({
          id: "plot-theme",
          type: "fill",
          source: "plot-theme",
          paint: {
            "fill-color": ["match", ["get", "bucket"], "s", "#c8d5c0", "m", "#d4b483", "l", "#c45c26", "#d4b483"],
            "fill-opacity": 0.26
          }
        }, beforeFill);
      } catch (err) {}
    }
    if (!map.getSource("plot-hl")) {
      map.addSource("plot-hl", { type: "geojson", data: EMPTY });
      try {
        map.addLayer({
          id: "plot-hl-fill",
          type: "fill",
          source: "plot-hl",
          paint: { "fill-color": "#c45c26", "fill-opacity": 0.16 }
        });
        map.addLayer({
          id: "plot-hl-line",
          type: "line",
          source: "plot-hl",
          paint: { "line-color": "#c45c26", "line-width": 2.4, "line-opacity": 0.95 }
        });
      } catch (err) {}
    }
    if (!map.getSource("plot-verts")) {
      map.addSource("plot-verts", { type: "geojson", data: EMPTY });
      try {
        map.addLayer({
          id: "plot-verts",
          type: "circle",
          source: "plot-verts",
          paint: {
            "circle-radius": 3.4,
            "circle-color": "#fffdf8",
            "circle-stroke-width": 1.4,
            "circle-stroke-color": "#c45c26"
          }
        });
      } catch (err) {}
    }
    if (!map.getSource("plot-edges")) {
      map.addSource("plot-edges", { type: "geojson", data: EMPTY });
      try {
        map.addLayer({
          id: "plot-edges",
          type: "symbol",
          source: "plot-edges",
          layout: {
            "text-field": ["get", "len"],
            "text-size": 11,
            "text-font": ["Noto Sans Regular"],
            "text-allow-overlap": false,
            "text-ignore-placement": false
          },
          paint: {
            "text-color": "#1c1814",
            "text-halo-color": "#fffdf8",
            "text-halo-width": 1.5
          }
        });
      } catch (err) {
        try {
          map.addLayer({
            id: "plot-edges",
            type: "symbol",
            source: "plot-edges",
            layout: { "text-field": ["get", "len"], "text-size": 11 },
            paint: { "text-color": "#1c1814", "text-halo-color": "#fffdf8", "text-halo-width": 1.5 }
          });
        } catch (err2) {}
      }
    }
  }

  function setHighlight(map, feat) {
    ensureOverlays(map);
    if (!feat || !feat.geometry) { setSrc(map, "plot-hl", []); return; }
    setSrc(map, "plot-hl", [{ type: "Feature", geometry: feat.geometry, properties: feat.properties || {} }]);
  }

  function setVertices(map, feat, visibleFeats, zoom) {
    ensureOverlays(map);
    const seen = Object.create(null);
    const out = [];
    if (feat && feat.geometry) {
      vertsFromGeom(feat.geometry, seen, out, VERT_CAP);
    } else if (zoom >= VERT_MINZOOM && visibleFeats && visibleFeats.length) {
      for (let i = 0; i < visibleFeats.length && out.length < VERT_CAP; i++) {
        vertsFromGeom(visibleFeats[i].geometry, seen, out, VERT_CAP);
      }
    }
    setSrc(map, "plot-verts", out);
  }

  function setBorder(map, feat) {
    ensureOverlays(map);
    if (!feat || !feat.geometry) { setSrc(map, "plot-edges", []); return; }
    setSrc(map, "plot-edges", edgeLabelsFromGeom(feat.geometry));
  }

  function setAreaTheme(map, visibleFeats) {
    ensureOverlays(map);
    const items = [];
    const list = visibleFeats || [];
    for (let i = 0; i < list.length && items.length < THEME_CAP; i++) {
      const f = list[i];
      if (!f || !f.geometry) continue;
      const a = areaValue(f.properties, f.geometry);
      if (!(a > 0)) continue;
      items.push({ f: f, a: a });
    }
    if (!items.length) { setSrc(map, "plot-theme", []); return; }
    items.sort(function (x, y) { return x.a - y.a; });
    const n = items.length;
    const t1 = items[Math.max(0, Math.floor(n / 3) - (n >= 3 ? 0 : 0))].a;
    const t2 = items[Math.min(n - 1, Math.floor((2 * n) / 3))].a;
    const feats = items.map(function (it) {
      let bucket = "m";
      if (it.a <= t1) bucket = "s";
      else if (it.a > t2) bucket = "l";
      return { type: "Feature", geometry: it.f.geometry, properties: { bucket: bucket } };
    });
    setSrc(map, "plot-theme", feats);
  }

  function clearExtras(map) {
    setSrc(map, "plot-hl", []);
    setSrc(map, "plot-verts", []);
    setSrc(map, "plot-edges", []);
    setSrc(map, "plot-theme", []);
  }

  function refreshExtras(map, flags) {
    flags = flags || {};
    ensureOverlays(map);
    let zoom = 0;
    try { zoom = map.getZoom(); } catch (e) {}
    const layers = flags.surveyLayers || [];
    let visible = null;
    const needVisible = (flags.verts && !flags.selFeat && zoom >= VERT_MINZOOM) || (flags.theme && zoom >= VERT_MINZOOM);
    if (needVisible) visible = queryVisible(map, layers);
    if (flags.selFeat) setHighlight(map, flags.selFeat);
    else setHighlight(map, null);
    if (flags.verts) setVertices(map, flags.selFeat, visible, zoom);
    else setSrc(map, "plot-verts", []);
    if (flags.border && flags.selFeat) setBorder(map, flags.selFeat);
    else setSrc(map, "plot-edges", []);
    if (flags.theme && zoom >= VERT_MINZOOM) setAreaTheme(map, visible || queryVisible(map, layers));
    else setSrc(map, "plot-theme", []);
  }

  function flyToFeat(map, feat) {
    if (!map || !feat) return;
    const b = bboxOf(feat.geometry);
    if (b) {
      const dx = b[1][0] - b[0][0];
      const dy = b[1][1] - b[0][1];
      if (dx > 0.00004 && dy > 0.00004) {
        try { map.fitBounds(b, { padding: 56, maxZoom: 17, duration: 700 }); return; }
        catch (e) {}
      }
    }
    const c = centroidOf(feat.geometry);
    if (c) {
      try { map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 16), essential: true }); }
      catch (e) {}
    }
  }


  function plotNumberExpr() {
    const parts = ["case"];
    for (let i = 0; i < PLOT_KEYS.length; i++) {
      const k = PLOT_KEYS[i];
      parts.push(["has", k]);
      parts.push(["to-string", ["get", k]]);
    }
    parts.push("");
    return parts;
  }

  function plotNumberLayer(c, minzoom) {
    const expr = plotNumberExpr();
    return {
      id: c.id + "-num",
      type: "symbol",
      source: c.id,
      "source-layer": c.sourceLayer,
      minzoom: minzoom == null ? 14 : minzoom,
      filter: ["all", ["!=", expr, ""], ["!=", expr, "null"]],
      layout: {
        "text-field": expr,
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 16, 13],
        "text-font": ["Noto Sans Regular"],
        "text-padding": 1,
        "symbol-placement": "point",
        "text-allow-overlap": ["step", ["zoom"], false, 16, true],
        "text-ignore-placement": ["step", ["zoom"], false, 16.5, true],
        "text-optional": true
      },
      paint: {
        "text-color": "#3a1f10",
        "text-halo-color": "#fff8ee",
        "text-halo-width": 1.6
      }
    };
  }

  function labelsOnAtBoot() {
    try {
      if (window.readShareParam && window.readShareParam("labels") === "0") return false;
      if (localStorage.getItem("bhoonaksha-labels") === "0") return false;
    } catch (e) {}
    return true;
  }

  function persistLabels(on) {
    try { localStorage.setItem("bhoonaksha-labels", on ? "1" : "0"); } catch (e) {}
    if (window.writeShareParams) window.writeShareParams({ labels: on ? "" : "0" });
  }

  window.PlotUX = {
    PLOT_CAP: PLOT_CAP,
    VERT_MINZOOM: VERT_MINZOOM,
    surveyNumber: surveyNumber,
    ulpinOf: ulpinOf,
    stateNameFromLayer: stateNameFromLayer,
    looksLikePlotQuery: looksLikePlotQuery,
    collectVisiblePlots: collectVisiblePlots,
    matchVisiblePlots: matchVisiblePlots,
    queryVisible: queryVisible,
    ensureOverlays: ensureOverlays,
    setHighlight: setHighlight,
    refreshExtras: refreshExtras,
    clearExtras: clearExtras,
    flyToFeat: flyToFeat,
    centroidOf: centroidOf,
    areaValue: areaValue,
    labelsOnAtBoot: labelsOnAtBoot,
    persistLabels: persistLabels,
    plotNumberExpr: plotNumberExpr,
    plotNumberLayer: plotNumberLayer,
    SURVEY_STATES: SURVEY_STATES
  };
})();
