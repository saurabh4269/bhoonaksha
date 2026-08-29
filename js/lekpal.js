(() => {
  const INDIA = { min: [68.0, 6.5], max: [97.5, 37.2], center: [79.0, 22.5], zoom: 4.6 };
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const OVERLAP_NOTE = "A building sits on this plot in this view. Overlay only — not a court finding.";
  const HEIGHT_EXPR = ["coalesce",
    ["to-number", ["get", "height"]],
    ["to-number", ["get", "building_height"]],
    ["to-number", ["get", "Height"]],
    ["to-number", ["get", "ht"]],
    0
  ];
  const CADASTRALS = [
    { id: "survey-ap", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/andhra-pradesh/apsac/{z}/{x}/{y}.pbf"], sourceLayer: "APSAC_AP_Cadastrals", maxzoom: 13 },
    { id: "survey-tn", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/tamil-nadu/tngis/{z}/{x}/{y}.pbf"], sourceLayer: "TNGIS_TN_Cadastrals", maxzoom: 14 },
    { id: "survey-kl", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/kerala/bhuvan/{z}/{x}/{y}.pbf"], sourceLayer: "Bhuvan_Kerala_Cadastrals", maxzoom: 13 },
    { id: "survey-tg", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/telangana/bhunaksha/tracgis/{z}/{x}/{y}.pbf"], sourceLayer: "TRACGIS_Bhunaksha_Cadastrals", maxzoom: 13 },
    { id: "survey-ka", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/karnataka/kgismaps/{z}/{x}/{y}.pbf"], sourceLayer: "KGISMAPS_KN_Cadastrals", maxzoom: 13 },
    { id: "survey-mh", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/maharashtra/mrsac/{z}/{x}/{y}.pbf"], sourceLayer: "MRSAC_Cadastrals", maxzoom: 13 },
    { id: "survey-od", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/odisha/odisha4kgeo/{z}/{x}/{y}.pbf"], sourceLayer: "Odisha4kgeo_OD_Cadastrals", maxzoom: 14 },
    { id: "survey-hr", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/haryana/hrsac/{z}/{x}/{y}.pbf"], sourceLayer: "HRSAC_HR_Cadastrals", maxzoom: 14 },
    { id: "survey-mp", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/madhya-pradesh/mpssdi/{z}/{x}/{y}.pbf"], sourceLayer: "MPSSDI_MP_Cadastrals", maxzoom: 14 },
    { id: "survey-ga", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/goa/bhunaksha/{z}/{x}/{y}.pbf"], sourceLayer: "Goa_Bhunaksha_Cadastrals", maxzoom: 14 },
    { id: "survey-as", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/assam/bhuvan/{z}/{x}/{y}.pbf"], sourceLayer: "Bhuvan_Assam_Cadastrals", maxzoom: 14 },
    { id: "survey-jh", tiles: ["https://indianopenmaps.com/not-so-open/cadastrals/jharkhand/jsac/{z}/{x}/{y}.pbf"], sourceLayer: "JSAC_JH_Cadastrals", maxzoom: 14 }
  ];

  const state = {
    tool: "identify",
    satellite: false,
    compare: false,
    survey: true,
    terrain: false,
    pts: [],
    ptSnap: [],
    satYear: 2026,
    lastFeat: null,
    lastLL: null,
    marker: null,
    searchAbort: null,
    lang: (typeof window.getLang === "function" ? window.getLang() : "en"),
    userMoved: false,
    lastLocate: null,
    nearbyVillages: [],
    labels: (window.PlotUX && window.PlotUX.labelsOnAtBoot) ? window.PlotUX.labelsOnAtBoot() : true,
    verts: false,
    border: false,
    areaTheme: false,
    selFeat: null,
    view3d: false,
    plotNums: true,
    buildings: true,
    villages: true
  };
  let dragI = -1;
  let justDragged = false;
  let justDraggedTimer = 0;

  const t = () => (window.t && window.t()) || (window.I18N && window.I18N[state.lang]) || (window.I18N && window.I18N.en) || {};

  const style = {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Tiles © Esri",
        maxzoom: 17
      },
      sat: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Tiles © Esri",
        maxzoom: 17
      },
      dem: {
        type: "raster-dem",
        tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
        encoding: "terrarium",
        tileSize: 512,
        maxzoom: 12
      },
      draw: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      shp: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      villages: {
        type: "vector",
        tiles: ["https://indianopenmaps.com/not-so-open/villages/lgd/{z}/{x}/{y}.pbf"],
        minzoom: 8, maxzoom: 12,
        attribution: "Villages: LGD / Datameet (CC0)"
      },
      buildings: {
        type: "vector",
        tiles: ["https://indianopenmaps.com/google-buildings/{z}/{x}/{y}.pbf"],
        minzoom: 14, maxzoom: 15,
        attribution: "Buildings: Google Open Buildings"
      }
    },
    layers: [
      { id: "osm", type: "raster", source: "osm" },
      { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } },
      {
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        layout: { visibility: "none" },
        paint: { "hillshade-shadow-color": "#473B24", "hillshade-exaggeration": 0.4 }
      }
    ]
  };

  CADASTRALS.forEach((c) => {
    style.sources[c.id] = { type: "vector", tiles: c.tiles, minzoom: 13, maxzoom: c.maxzoom };
    style.layers.push({
      id: c.id + "-fill", type: "fill", source: c.id, "source-layer": c.sourceLayer, minzoom: 14,
      paint: { "fill-color": "#c45c26", "fill-opacity": 0.14, "fill-outline-color": "#9a3f14" }
    });
    style.layers.push({
      id: c.id + "-line", type: "line", source: c.id, "source-layer": c.sourceLayer, minzoom: 14,
      paint: { "line-color": "#9a3f14", "line-width": 1.05, "line-opacity": 0.9 }
    });
    if (window.PlotUX && window.PlotUX.plotNumberLayer) {
      style.layers.push(window.PlotUX.plotNumberLayer(c, 14));
    }
  });
  style.layers.push(
    { id: "shp-fill", type: "fill", source: "shp", paint: { "fill-color": "#2f6b4f", "fill-opacity": 0.18 } },
    { id: "shp-line", type: "line", source: "shp", paint: { "line-color": "#2f6b4f", "line-width": 1.4 } },
    { id: "draw-fill", type: "fill", source: "draw", paint: { "fill-color": "#c45c26", "fill-opacity": 0.16 } },
    { id: "draw-line", type: "line", source: "draw", paint: { "line-color": "#c45c26", "line-width": 2 } },
    { id: "draw-pts", type: "circle", source: "draw", paint: {
      "circle-radius": ["case", ["==", ["get", "snap"], 1], 8, 7],
      "circle-color": "#c45c26",
      "circle-stroke-width": ["case", ["==", ["get", "snap"], 1], 2.2, 1.5],
      "circle-stroke-color": ["case", ["==", ["get", "snap"], 1], "#f0c36a", "#fffdf8"]
    } },
    { id: "draw-len", type: "symbol", source: "draw", filter: ["has", "len"], layout: { "text-field": ["get", "len"], "text-size": 11, "text-font": ["Noto Sans Regular"], "text-allow-overlap": true }, paint: { "text-color": "#1c1814", "text-halo-color": "#fff8ee", "text-halo-width": 1.4 } },
    { id: "draw-sum", type: "symbol", source: "draw", filter: ["has", "sum"], layout: { "text-field": ["get", "sum"], "text-size": 13, "text-font": ["Noto Sans Regular"], "text-allow-overlap": true }, paint: { "text-color": "#1c1814", "text-halo-color": "#fff8ee", "text-halo-width": 1.6 } },
    { id: "vil-fill", type: "fill", source: "villages", "source-layer": "LGD_Villages", minzoom: 8, maxzoom: 12.5, paint: { "fill-color": "#2f6b4f", "fill-opacity": 0.08 } },
    { id: "vil-line", type: "line", source: "villages", "source-layer": "LGD_Villages", minzoom: 8, maxzoom: 12.5, paint: { "line-color": "#2f6b4f", "line-width": 0.8 } },
    { id: "bldg-open-fill", type: "fill", source: "buildings", "source-layer": "google-open-buildings-india-2023", minzoom: 15, paint: { "fill-color": "#8a6a4a", "fill-opacity": 0.35 } },
    {
      id: "bldg-open-extrusion",
      type: "fill-extrusion",
      source: "buildings",
      "source-layer": "google-open-buildings-india-2023",
      minzoom: 15,
      filter: [">", HEIGHT_EXPR, 0],
      paint: {
        "fill-extrusion-color": "#8a6a4a",
        "fill-extrusion-height": HEIGHT_EXPR,
        "fill-extrusion-opacity": 0.7
      }
    }
  );

  const SURVEY_FILL = CADASTRALS.map((c) => c.id + "-fill");
  const BLDG_LAYERS = ["bldg-open-fill", "bldg-open-extrusion"];

  if (window.shareHashAtBoot) state.userMoved = true;

  const map = new maplibregl.Map({
    container: "map",
    style: window.prepareMapLangStyle ? window.prepareMapLangStyle(style) : style,
    center: INDIA.center,
    zoom: INDIA.zoom,
    minZoom: 1,
    maxZoom: 19,
    maxPitch: 85,
    dragRotate: false,
    pitchWithRotate: true,
    touchPitch: false,
    hash: true,
    preserveDrawingBuffer: true,
    attributionControl: false,
    transformRequest: window.mapLangTransformRequest
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl({
    onAdd: function () {
      const box = document.createElement("div");
      box.className = "maplibregl-ctrl maplibregl-ctrl-group";
      const btn = document.getElementById("btn-locate");
      if (btn) box.appendChild(btn);
      return box;
    },
    onRemove: function () {}
  }, "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }));
  function mapRatio() {
    try {
      const z = map.getZoom();
      const lat = map.getCenter().lat;
      const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
      return Math.max(1, Math.round(mpp / (0.0254 / 96)));
    } catch (e) { return 0; }
  }
  function refreshScaleHud() {
    const ratioEl = document.getElementById("scale-ratio");
    const meta = document.getElementById("print-meta");
    const r = mapRatio();
    const c = map.getCenter();
    const ratioTxt = r ? ("1 : " + r.toLocaleString("en-IN")) : "1 : —";
    if (ratioEl) ratioEl.textContent = ratioTxt;
    if (meta) meta.textContent = "Bhoonaksha  ·  " + ratioTxt + "  ·  " + c.lat.toFixed(5) + ", " + c.lng.toFixed(5) + "  ·  N";
  }
  map.on("zoomend", refreshScaleHud);
  map.on("moveend", refreshScaleHud);
  map.on("load", refreshScaleHud);

  function markUserMoved() { state.userMoved = true; }
  map.on("dragstart", markUserMoved);
  map.on("wheel", markUserMoved);
  map.on("boxzoomstart", markUserMoved);
  map.on("zoomstart", (e) => { if (e && e.originalEvent) markUserMoved(); });
  document.addEventListener("click", (e) => {
    if (e.target.closest(".maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out")) markUserMoved();
  }, true);

  function on(id, ev, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
    return el;
  }
  function liveLayers(ids) {
    return ids.filter((id) => map.getLayer(id));
  }
  function queryLayers(point, ids) {
    const layers = liveLayers(ids);
    if (!layers.length) return [];
    return map.queryRenderedFeatures(point, { layers });
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function inIndia(lat, lng) {
    return lng >= INDIA.min[0] && lng <= INDIA.max[0] && lat >= INDIA.min[1] && lat <= INDIA.max[1];
  }

  function gpsFix() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
      );
    });
  }

  async function ipFix() {
    async function read(url, pick) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("ip");
        return pick(await res.json());
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      return await read("https://get.geojs.io/v1/ip/geo.json", (j) => {
        const lat = Number(j.latitude), lng = Number(j.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("coords");
        return { lat, lng, country: String(j.country_code || "").toUpperCase() };
      });
    } catch (e) {
      try {
        return await read("https://ipwho.is/", (j) => {
          if (j && j.success === false) throw new Error("ipwho");
          const lat = Number(j.latitude), lng = Number(j.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("coords");
          return { lat, lng, country: String(j.country_code || "").toUpperCase() };
        });
      } catch (e2) {
        return null;
      }
    }
  }

  function chooseFix(gps, ip, opts) {
    opts = opts || {};
    if (opts.mine && gps) {
      return { lat: gps.lat, lng: gps.lng, zoom: 16.2, source: "gps" };
    }
    if (gps && inIndia(gps.lat, gps.lng)) {
      return { lat: gps.lat, lng: gps.lng, zoom: 15.5, source: "gps" };
    }
    if (ip && (ip.country === "IN" || inIndia(ip.lat, ip.lng))) {
      return { lat: ip.lat, lng: ip.lng, zoom: 12, source: "ip" };
    }
    return null;
  }

  function nearbyToSuggest(v) {
    const lang = state.lang;
    const name = v.name_local && lang !== "en" ? v.name + " · " + v.name_local : v.name;
    const bits = [v.district, v.state].filter(Boolean);
    if (v.km != null && v.km !== "") bits.unshift(v.km + " km");
    return {
      name,
      sub: bits.join(", "),
      display_name: [v.name, v.subdistrict, v.district, v.state].filter(Boolean).join(", "),
      lon: v.lon, lat: v.lat, village: v
    };
  }

  function nearbySuggestItems() {
    return (state.nearbyVillages || []).map(nearbyToSuggest);
  }

  async function loadNearbyVillages(lat, lng) {
    if (!window.LGD || !window.LGD.nearby) return;
    try {
      const items = await window.LGD.nearby(lat, lng);
      state.nearbyVillages = items || [];
    } catch (e) {
      state.nearbyVillages = [];
    }
  }

  async function runLocate(opts) {
    opts = opts || {};
    const [gps, ip] = await Promise.all([gpsFix(), ipFix()]);
    const loc = chooseFix(gps, ip, opts);
    if (!loc) {
      if (opts.force || (opts.initial && !gps && !ip)) toast(t().locateFail || "Could not read your location.");
      return null;
    }
    state.lastLocate = loc;
    loadNearbyVillages(loc.lat, loc.lng);
    if (!opts.force && state.userMoved) return loc;
    map.flyTo({ center: [loc.lng, loc.lat], zoom: loc.zoom, essential: true });
    if (opts.mine) placeMe({ lng: loc.lng, lat: loc.lat });
    return loc;
  }

  function placeMe(lngLat) {
    if (state.meMarker) state.meMarker.remove();
    const el = document.createElement("div");
    el.className = "me-dot";
    state.meMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  }


  const INS_STORE = "mera-plot-inspector";
  function loadInsPos() {
    try { return JSON.parse(sessionStorage.getItem(INS_STORE) || "null"); }
    catch (e) { return null; }
  }
  function saveInsPos() {
    const el = document.getElementById("inspector");
    if (!el || !el.style.left) return;
    try {
      sessionStorage.setItem(INS_STORE, JSON.stringify({
        left: el.style.left,
        top: el.style.top,
        min: el.classList.contains("min")
      }));
    } catch (e) { /* ignore */ }
  }
  function spawnInspector() {
    const el = document.getElementById("inspector");
    if (!el) return;
    const saved = loadInsPos();
    if (saved && saved.left && saved.top) {
      el.style.left = saved.left;
      el.style.top = saved.top;
      el.style.right = "auto";
      el.classList.toggle("min", !!saved.min);
      syncMinBtn();
      return;
    }
    if (window.innerWidth <= 720) {
      const w = Math.min(280, window.innerWidth - 24);
      el.style.width = w + "px";
      el.style.left = (window.innerWidth - w - 12) + "px";
      el.style.right = "auto";
      el.style.top = Math.max(72, window.innerHeight - 260) + "px";
    }
  }
  function syncMinBtn() {
    const el = document.getElementById("inspector");
    const btn = document.getElementById("ins-min");
    if (!el || !btn) return;
    const min = el.classList.contains("min");
    btn.textContent = min ? "▴" : "▾";
    btn.setAttribute("aria-label", min ? "Expand" : "Minimize");
    btn.title = min ? "Expand" : "Minimize";
  }
  function openInspector(opts) {
    const el = document.getElementById("inspector");
    if (!el) return;
    const first = el.hidden;
    el.hidden = false;
    if (first) spawnInspector();
    if (!opts || !opts.keepMin) {
      el.classList.remove("min");
      syncMinBtn();
    }
  }
  function closeInspector() {
    const el = document.getElementById("inspector");
    if (el) el.hidden = true;
  }
  function toggleMinInspector() {
    const el = document.getElementById("inspector");
    if (!el) return;
    el.classList.toggle("min");
    syncMinBtn();
    saveInsPos();
  }
  function wireInspectorDrag() {
    const el = document.getElementById("inspector");
    const head = document.getElementById("ins-head");
    if (!el || !head) return;
    let dragging = false, ox = 0, oy = 0;
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      if (el.classList.contains("min") && e.target.closest(".ins-head-text")) {
        el.classList.remove("min");
        syncMinBtn();
      }
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      el.style.left = r.left + "px";
      el.style.top = r.top + "px";
      el.style.right = "auto";
      try { map.dragPan.disable(); } catch (err) {}
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const w = el.offsetWidth;
      let x = e.clientX - ox;
      let y = e.clientY - oy;
      x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
      y = Math.max(8, Math.min(window.innerHeight - 48, y));
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      try { map.dragPan.enable(); } catch (err) {}
      saveInsPos();
    }
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
  }

  function inspect(kicker, title, body, rows, note, pass) {
    const k = document.getElementById("ins-kicker");
    const t = document.getElementById("ins-title");
    const b = document.getElementById("ins-body");
    const dl = document.getElementById("ins-dl");
    const n = document.getElementById("ins-note");
    if (k) k.textContent = kicker;
    if (t) t.textContent = title;
    if (b) b.textContent = body || "";
    if (n) n.textContent = note || "";
    if (pass && window.Passport) {
      window.Passport.paint(pass);
    } else {
      if (dl) {
        dl.innerHTML = (rows || [])
          .map((r) => "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("");
      }
      if (window.Passport) window.Passport.clear();
    }
    const acts = document.getElementById("measure-actions");
    if (acts) acts.hidden = !(state.tool === "measure" || state.tool === "area");
    openInspector();
  }

  const swipe = window.MapSwipe ? window.MapSwipe.create(map, { layers: ["sat"] }) : null;

  function syncBasemapChips() {
    const mapBtn = document.getElementById("ly-map");
    const satBtn = document.getElementById("ly-sat");
    const cmpBtn = document.getElementById("ly-compare");
    if (mapBtn) mapBtn.classList.toggle("on", !state.compare && !state.satellite);
    if (satBtn) satBtn.classList.toggle("on", !state.compare && !!state.satellite);
    if (cmpBtn) {
      cmpBtn.classList.toggle("on", !!state.compare);
      cmpBtn.setAttribute("aria-pressed", state.compare ? "true" : "false");
    }
    const handle = document.getElementById("compare-handle");
    const dict = t();
    if (handle && dict && dict.compare) handle.setAttribute("aria-label", dict.compare);
  }

  function applyBasemap() {
    const compare = !!state.compare;
    try { map.setLayoutProperty("sat", "visibility", (compare || state.satellite) ? "visible" : "none"); } catch (e) {}
    if (window.applyStreetVisibility) window.applyStreetVisibility(map, state.satellite, state.labels !== false, compare);
    else {
      try { map.setLayoutProperty("osm", "visibility", (compare || !state.satellite) ? "visible" : "none"); } catch (e) {}
    }
    if (swipe) swipe.setActive(compare);
    const handle = document.getElementById("compare-handle");
    if (handle) handle.hidden = !compare;
    syncBasemapChips();
    syncYearControl();
  }

  function setSatellite(on) {
    state.satellite = !!on;
    if (state.compare) {
      state.compare = false;
      if (window.writeShareParams) window.writeShareParams({ compare: "" });
    }
    applyBasemap();
    if (window.writeShareParams) window.writeShareParams({ sat: state.satellite ? "1" : "" });
  }

  function setCompare(on) {
    state.compare = !!on;
    applyBasemap();
    if (window.writeShareParams) window.writeShareParams({ compare: state.compare ? "1" : "" });
  }

  function setLayerVis(id, on) {
    if (map.getLayer(id)) {
      try { map.setLayoutProperty(id, "visibility", on ? "visible" : "none"); } catch (e) {}
    }
  }
  function setSurvey(on) {
    state.survey = on;
    CADASTRALS.forEach((c) => {
      setLayerVis(c.id + "-fill", on);
      setLayerVis(c.id + "-line", on);
      setLayerVis(c.id + "-num", on && state.plotNums);
    });
    const btn = document.getElementById("btn-survey");
    if (btn) btn.classList.toggle("on", on);
    const box = document.getElementById("cat-survey");
    if (box) box.checked = !!on;
    document.querySelectorAll("#cat-states input[data-survey]").forEach(function (el) {
      el.checked = !!on;
    });
  }
  function setOneSurvey(id, on) {
    setLayerVis(id + "-fill", on);
    setLayerVis(id + "-line", on);
    setLayerVis(id + "-num", on && state.plotNums);
    const any = Array.prototype.some.call(document.querySelectorAll("#cat-states input[data-survey]"), function (el) { return el.checked; });
    state.survey = any;
    const btn = document.getElementById("btn-survey");
    if (btn) btn.classList.toggle("on", any);
    const box = document.getElementById("cat-survey");
    if (box) box.checked = any;
  }
  function fillCatalogStates() {
    const host = document.getElementById("cat-states");
    if (!host || host._done) return;
    host._done = 1;
    const names = (window.PlotUX && window.PlotUX.SURVEY_STATES) || {};
    CADASTRALS.forEach(function (c) {
      const lab = document.createElement("label");
      const short = (names[c.id] || c.id).replace(" Pradesh", "").replace("Madhya", "MP");
      lab.innerHTML = "<input type=\"checkbox\" checked data-survey=\"" + c.id + "\"/><span>" + short + "</span>";
      host.appendChild(lab);
      lab.querySelector("input").addEventListener("change", function (e) {
        setOneSurvey(c.id, e.target.checked);
      });
    });
  }
  function setPlotNums(on) {
    state.plotNums = !!on;
    CADASTRALS.forEach((c) => setLayerVis(c.id + "-num", on && state.survey));
    const box = document.getElementById("cat-nums");
    if (box) box.checked = !!on;
  }
  function setBuildings(on) {
    state.buildings = !!on;
    ["bldg-open-fill", "bldg-open-extrusion"].forEach((id) => setLayerVis(id, on));
    const box = document.getElementById("cat-bldg");
    if (box) box.checked = !!on;
  }
  function setVillages(on) {
    state.villages = !!on;
    ["vil-fill", "vil-line"].forEach((id) => setLayerVis(id, on));
    const box = document.getElementById("cat-vil");
    if (box) box.checked = !!on;
  }
  function setView3d(on) {
    state.view3d = !!on;
    const btn = document.getElementById("btn-3d");
    if (btn) btn.classList.toggle("on", on);
    if (on) {
      map.dragRotate.enable();
      try { map.touchPitch.enable(); } catch (e) {}
      try { map.touchZoomRotate.enableRotation(); } catch (e) {}
      setLayerVis("bldg-open-extrusion", state.buildings);
      map.easeTo({ pitch: 60, duration: 700 });
    } else if (!state.terrain) {
      map.dragRotate.disable();
      try { map.touchPitch.disable(); } catch (e) {}
      try { map.touchZoomRotate.disableRotation(); } catch (e) {}
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }

  function setTerrainOn(on) {
    state.terrain = !!on;
    const btn = document.getElementById("btn-terrain");
    if (btn) btn.classList.toggle("on", on);
    const box = document.getElementById("cat-terrain");
    if (box) box.checked = !!on;
    if (map.getLayer("hillshade")) {
      map.setLayoutProperty("hillshade", "visibility", on ? "visible" : "none");
    }
    if (on) {
      map.setTerrain({ source: "dem", exaggeration: 1.1 });
      map.dragRotate.enable();
      try { map.touchPitch.enable(); } catch (e) {}
      try { map.touchZoomRotate.enableRotation(); } catch (e) {}
      map.easeTo({ pitch: 50, duration: 700 });
    } else {
      map.setTerrain(null);
      if (!state.view3d) {
        map.dragRotate.disable();
        try { map.touchPitch.disable(); } catch (e) {}
        try { map.touchZoomRotate.disableRotation(); } catch (e) {}
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      }
    }
  }

  function setTool(name) {
    dragI = -1;
    justDragged = false;
    try { map.dragPan.enable(); } catch (e) {}
    state.tool = name;
    state.pts = [];
    state.ptSnap = [];
    if (name !== "identify" && state.marker) {
      try { state.marker.remove(); } catch (e) {}
      state.marker = null;
    }
    document.querySelectorAll(".tools [data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === name));
    const dict = t();
    const labels = {
      identify: [dict.identify || "Identify", dict.tapPlot || "Tap a plot", "Survey number and place if the outline is on this map. Ownership is not here."],
      measure: [dict.measure || "Measure", "Tap along a boundary", "Each tap adds a vertex. Distance is in metres and kilometres."],
      area: [dict.area || "Area", "Tap around a plot", "Close the shape with at least 3 points. Area in hectare and acre."]
    };
    const L = labels[name] || labels.identify;
    const k = document.getElementById("ins-kicker");
    const titleEl = document.getElementById("ins-title");
    const b = document.getElementById("ins-body");
    const dl = document.getElementById("ins-dl");
    const n = document.getElementById("ins-note");
    if (k) k.textContent = L[0];
    if (titleEl) titleEl.textContent = L[1];
    if (b) b.textContent = L[2];
    if (dl) dl.innerHTML = "";
    if (n) n.textContent = "";
    redraw();
  }


  const SNAP_PX = 14;
  const SURVEY_SNAP = CADASTRALS.reduce(function (ids, c) {
    ids.push(c.id + "-line", c.id + "-fill");
    return ids;
  }, []);
  function eachGeomCoord(geom, fn) {
    if (!geom || !geom.coordinates) return;
    const typ = geom.type;
    if (typ === "Point") fn(geom.coordinates);
    else if (typ === "MultiPoint" || typ === "LineString") geom.coordinates.forEach(fn);
    else if (typ === "Polygon" || typ === "MultiLineString") geom.coordinates.forEach(function (r) { r.forEach(fn); });
    else if (typ === "MultiPolygon") geom.coordinates.forEach(function (p) { p.forEach(function (r) { r.forEach(fn); }); });
  }
  function eachGeomSeg(geom, fn) {
    if (!geom || !geom.coordinates) return;
    function ring(coords) {
      for (let i = 1; i < coords.length; i++) fn(coords[i - 1], coords[i]);
    }
    const typ = geom.type;
    if (typ === "LineString") ring(geom.coordinates);
    else if (typ === "Polygon" || typ === "MultiLineString") geom.coordinates.forEach(ring);
    else if (typ === "MultiPolygon") geom.coordinates.forEach(function (p) { p.forEach(ring); });
  }
  function screenDist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function closestOnSeg(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-8) return { x: a.x, y: a.y };
    let u = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    return { x: a.x + u * abx, y: a.y + u * aby };
  }
  function snapMeasure(ll, point) {
    if (!ll) return { ll: ll, snap: 0 };
    if (!point) {
      try { point = map.project(ll); } catch (e) { return { ll: ll, snap: 0 }; }
    }
    const layers = liveLayers(SURVEY_SNAP);
    if (!layers.length) return { ll: ll, snap: 0 };
    let feats = [];
    try {
      feats = map.queryRenderedFeatures([
        [point.x - SNAP_PX, point.y - SNAP_PX],
        [point.x + SNAP_PX, point.y + SNAP_PX]
      ], { layers: layers });
    } catch (e) { return { ll: ll, snap: 0 }; }
    let bestV = SNAP_PX + 1, bestVll = null;
    let bestL = SNAP_PX + 1, bestLll = null;
    for (let i = 0; i < feats.length; i++) {
      const g = feats[i] && feats[i].geometry;
      if (!g) continue;
      eachGeomCoord(g, function (c) {
        if (!c || c.length < 2) return;
        let scr;
        try { scr = map.project(c); } catch (err) { return; }
        const d = screenDist(point, scr);
        if (d < bestV) { bestV = d; bestVll = [c[0], c[1]]; }
      });
      eachGeomSeg(g, function (a, b) {
        if (!a || !b || a.length < 2 || b.length < 2) return;
        let sa, sb;
        try { sa = map.project(a); sb = map.project(b); } catch (err) { return; }
        const p = closestOnSeg(point, sa, sb);
        const d = screenDist(point, p);
        if (d < bestL) {
          bestL = d;
          try {
            const u = map.unproject([p.x, p.y]);
            bestLll = [u.lng, u.lat];
          } catch (err) {}
        }
      });
    }
    if (bestVll && bestV <= SNAP_PX) return { ll: bestVll, snap: 1 };
    if (bestLll && bestL <= SNAP_PX) return { ll: bestLll, snap: 1 };
    return { ll: ll, snap: 0 };
  }
  function measureAreaRows(a) {
    const dict = t();
    const m2 = Math.round(a);
    const bigha = (a / 1338).toFixed(2);
    const biswa = (a / 66.9).toFixed(1);
    const guntha = (a / 101.17).toFixed(1);
    const acre = (a / 4046.86).toFixed(2);
    const ha = (a / 10000).toFixed(3);
    const sqYd = Math.round(a * 1.19599);
    const bL = dict.bigha || "Bigha";
    const biL = dict.biswa || "Biswa";
    const gL = dict.guntha || "Guntha";
    const yL = dict.sqYard || "Sq. yard";
    return [
      [dict.area || "Area", m2 + " m² · " + bigha + " " + bL + " · " + biswa + " " + biL],
      ["\u00a0", acre + " acre · " + ha + " ha · " + guntha + " " + gL + " · " + sqYd + " " + yL]
    ];
  }
  function distM(a, b) {
    const R = 6371000, tr = Math.PI / 180;
    const p1 = a[1] * tr, p2 = b[1] * tr, dP = (b[1] - a[1]) * tr, dL = (b[0] - a[0]) * tr;
    const s = Math.sin(dP / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dL / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function pathM(pts) {
    let t = 0;
    for (let i = 1; i < pts.length; i++) t += distM(pts[i - 1], pts[i]);
    return t;
  }
  function fmtLen(m) {
    return m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m";
  }
  function fmtAreaShort(a) {
    return a >= 1e6 ? (a / 1e6).toFixed(2) + " km²" : Math.round(a) + " m²";
  }
  function measureSumLabel(pts) {
    if (pts.length < 3) return "";
    const peri = pathM(pts) + distM(pts[pts.length - 1], pts[0]);
    return fmtAreaShort(areaM2(pts)) + " / " + fmtLen(peri);
  }
  function areaM2(pts) {
    if (pts.length < 3) return 0;
    const R = 6371000, tr = Math.PI / 180;
    let a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const j = (i + 1) % n;
      a += (pts[j][0] - pts[i][0]) * tr * (2 + Math.sin(pts[i][1] * tr) + Math.sin(pts[j][1] * tr));
    }
    return Math.abs(a * R * R / 2);
  }

  function redraw() {
    const feats = [];
    if (state.pts.length > 1) {
      const closed = state.tool === "area" && state.pts.length >= 3;
      const ring = closed ? state.pts.concat([state.pts[0]]) : state.pts;
      feats.push({
        type: "Feature",
        geometry: closed ? { type: "Polygon", coordinates: [ring] } : { type: "LineString", coordinates: ring },
        properties: {}
      });
    }
    state.pts.forEach((pt, i) => {
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: pt }, properties: { i: i, snap: state.ptSnap[i] ? 1 : 0 } });
    });
    const closed = state.tool === "area" && state.pts.length >= 3;
    const last = closed ? state.pts.length : state.pts.length - 1;
    for (let i = 0; i < last; i++) {
      const a = state.pts[i], b = state.pts[(i + 1) % state.pts.length];
      const m = pathM([a, b]);
      if (m < 2) continue;
      feats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] },
        properties: { len: m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m" }
      });
    }
    if (state.pts.length >= 3) {
      let cx = 0, cy = 0;
      state.pts.forEach(function (pt) { cx += pt[0]; cy += pt[1]; });
      feats.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [cx / state.pts.length, cy / state.pts.length] },
        properties: { sum: measureSumLabel(state.pts) }
      });
    }
    const src = map.getSource("draw");
    if (src) src.setData({ type: "FeatureCollection", features: feats });
    syncDrawTrash();
  }
  function syncDrawTrash() {
    const trash = document.getElementById("btn-measure-trash");
    if (trash) trash.hidden = !((state.tool === "measure" || state.tool === "area") && state.pts.length >= 1);
  }

  function placeMarker(lngLat) {
    if (state.marker) {
      try { state.marker.remove(); } catch (e) {}
      state.marker = null;
    }
    if (!lngLat) return;
    const lng = lngLat.lng != null ? lngLat.lng : lngLat[0];
    const lat = lngLat.lat != null ? lngLat.lat : lngLat[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    state.marker = new maplibregl.Marker({ color: "#c45c26" }).setLngLat([lng, lat]).addTo(map);
  }

  function surveyNumber(props) {
    if (window.PlotUX && window.PlotUX.surveyNumber) return window.PlotUX.surveyNumber(props);
    if (!props) return "";
    return "";
  }

  function identifyAt(e) {
    const surveyHits = queryLayers(e.point, SURVEY_FILL.concat(["shp-fill"]));
    const bldgHits = queryLayers(e.point, BLDG_LAYERS);
    const vilHits = queryLayers(e.point, ["vil-fill"]);
    const feat = surveyHits[0] || vilHits[0] || bldgHits[0] || null;
    const { lng, lat } = e.lngLat;
    state.lastLL = [lng, lat];
    placeMarker({ lng: lng, lat: lat });
    state.lastFeat = surveyHits[0] || feat;
    const pin = window.getDigiPin ? window.getDigiPin(lat, lng) : "";
    const overlap = !!(surveyHits[0] && bldgHits[0]);
    if (surveyHits[0]) {
      const p = surveyHits[0].properties || {};
      const sn = (window.PlotUX && window.PlotUX.surveyNumber) ? window.PlotUX.surveyNumber(p) : surveyNumber(p);
      const v = p.v_name || p.village || "";
      const stName = window.PlotUX ? window.PlotUX.stateNameFromLayer(surveyHits[0].layer && surveyHits[0].layer.id, surveyHits[0].source) : "";
      const ulpin = window.PlotUX ? window.PlotUX.ulpinOf(p) : "";
      const rows = [
        [t().surveyNo || "Survey no.", sn || "—"],
        [t().place || "Village", v || "—"]
      ];
      if (ulpin) rows.push([t().ulpin || "ULPIN", ulpin]);
      rows.push(
        [t().digipin || "DIGIPIN", pin || "—"],
        [t().coords || "Coordinates", lat.toFixed(6) + ", " + lng.toFixed(6)]
      );
      /* no source / overlap copy on the card */
      state.selFeat = surveyHits[0];
      state.lastFeat = surveyHits[0];
      if (window.PlotUX) window.PlotUX.setHighlight(map, surveyHits[0]);
      refreshPlotExtras();
      const pass = window.Passport ? window.Passport.fromFeat(surveyHits[0], { lat: lat, lng: lng }) : null;
      inspect(t().identify || "Identify", sn ? ((t().surveyNo || "Survey no.") + " " + sn) : (t().point || "This plot"),
        [v, p.m_name, p.d_name].filter(Boolean).join(", ") || (t().sourceSurvey || "Survey outline"),
        rows,
        "",
        pass);
      return;
    }
    state.selFeat = null;
    if (window.PlotUX) window.PlotUX.setHighlight(map, null);
    refreshPlotExtras();
    if (bldgHits[0]) {
      inspect(t().identify || "Identify", t().building || "Building",
        "Building footprint on this map.",
        [
          [t().digipin || "DIGIPIN", pin || "—"],
          [t().coords || "Coordinates", lat.toFixed(6) + ", " + lng.toFixed(6)]
        ],
        "");
      return;
    }
    if (vilHits[0]) {
      const p = vilHits[0].properties || {};
      const name = p.v_name || p.name || "Village";
      inspect(t().identify || "Identify", name,
        [p.m_name, p.d_name].filter(Boolean).join(", ") || "Village outline",
        [
          [t().place || "Village", name],
          [t().digipin || "DIGIPIN", pin || "—"],
          [t().coords || "Coordinates", lat.toFixed(6) + ", " + lng.toFixed(6)]
        ],
        "");
      return;
    }
    inspect(t().identify || "Identify", t().point || "This point", t().zoomHint || "No survey outline at this zoom. Try Andhra, Tamil Nadu, or Kerala, or zoom in.",
      [[t().digipin || "DIGIPIN", pin || "—"], [t().coords || "Coordinates", lat.toFixed(6) + ", " + lng.toFixed(6)]], "");
  }

  function showDrawStats() {
    if (state.tool === "measure") {
      const m = pathM(state.pts);
      let rows = state.pts.length >= 2
        ? [["Distance", Math.round(m) + " m"], ["Kilometres", (m / 1000).toFixed(3)]]
        : [["Distance", "—"]];
      if (state.pts.length >= 3) {
        rows = rows.concat(measureAreaRows(areaM2(state.pts)));
      }
      inspect(t().measure || "Measure",
        state.pts.length < 2 ? (t().measure || "Measure") : (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m"),
        state.pts.length + " points. Tap to add. Use Clear to wipe the line.",
        rows, "");
      return;
    }
    if (state.tool === "area") {
      const a = areaM2(state.pts);
      inspect(t().area || "Area", (a / 10000).toFixed(3) + " ha",
        "Need 3 or more points. " + state.pts.length + " so far.",
        measureAreaRows(a), "");
    }
  }

  function drawingOn() { return state.tool === "measure" || state.tool === "area"; }
  function onPtDown(e) {
    if (!drawingOn()) return;
    const f = e.features && e.features[0];
    if (!f || f.properties == null || f.properties.i == null) return;
    const i = Number(f.properties.i);
    if (!Number.isFinite(i) || i < 0 || i >= state.pts.length) return;
    if (e.preventDefault) e.preventDefault();
    if (e.originalEvent && e.originalEvent.preventDefault) e.originalEvent.preventDefault();
    dragI = i;
    justDragged = true;
    clearTimeout(justDraggedTimer);
    try { map.dragPan.disable(); } catch (err) {}
    try { map.getCanvas().style.cursor = "grabbing"; } catch (err) {}
  }
  function onPtMove(e) {
    if (dragI < 0) return;
    if (!e.lngLat) return;
    const snapped = snapMeasure([e.lngLat.lng, e.lngLat.lat], e.point);
    state.pts[dragI] = snapped.ll;
    state.ptSnap[dragI] = snapped.snap;
    redraw();
    showDrawStats();
  }
  function onPtUp() {
    if (dragI < 0) return;
    dragI = -1;
    try { map.dragPan.enable(); } catch (err) {}
    try { map.getCanvas().style.cursor = drawingOn() ? "crosshair" : ""; } catch (err) {}
    clearTimeout(justDraggedTimer);
    justDraggedTimer = setTimeout(() => { justDragged = false; }, 400);
  }
  map.on("mousedown", "draw-pts", onPtDown);
  map.on("touchstart", "draw-pts", onPtDown);
  map.on("mousemove", onPtMove);
  map.on("touchmove", onPtMove);
  map.on("mouseup", onPtUp);
  map.on("touchend", onPtUp);
  map.on("touchcancel", onPtUp);
  window.addEventListener("mouseup", onPtUp);
  window.addEventListener("touchend", onPtUp);
  map.on("mouseenter", "draw-pts", () => {
    if (drawingOn() && dragI < 0) map.getCanvas().style.cursor = "grab";
  });
  map.on("mouseleave", "draw-pts", () => {
    if (dragI >= 0) return;
    map.getCanvas().style.cursor = drawingOn() ? "crosshair" : "";
  });

  map.on("click", (e) => {
    if (justDragged) {
      justDragged = false;
      return;
    }
    const ll = [e.lngLat.lng, e.lngLat.lat];
    if (state.tool === "identify") return identifyAt(e);
    if (state.tool === "measure" || state.tool === "area") {
      const snapped = snapMeasure(ll, e.point);
      state.pts.push(snapped.ll);
      state.ptSnap.push(snapped.snap);
      redraw();
      showDrawStats();
    }
  });

  const toolsEl = document.getElementById("tools");
  if (toolsEl) {
    toolsEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tool]");
      if (!b) return;
      const name = b.dataset.tool;
      if (name === state.tool) { state.pts = []; state.ptSnap = []; }
      setTool(name);
    });
  }

  on("ly-map", "click", () => setSatellite(false));
  on("ly-sat", "click", () => setSatellite(true));
  on("ly-compare", "click", () => setCompare(!state.compare));

  const LIVE_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const WAYBACK = {
    2014: 10, 2015: 24007, 2016: 5097, 2017: 4073, 2018: 11334,
    2019: 645, 2020: 18289, 2021: 13534, 2022: 4905, 2023: 47963,
    2024: 39767, 2025: 48925
  };
  function satTilesForYear(year) {
    if (year >= 2026) return [LIVE_SAT];
    const rel = WAYBACK[year] || WAYBACK[2014];
    return ["https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/" + rel + "/{z}/{y}/{x}"];
  }
  function replaceSatTiles(tiles) {
    if (!map.getSource("sat") && !map.getLayer("sat")) return;
    const vis = map.getLayer("sat") ? map.getLayoutProperty("sat", "visibility") : "none";
    ["sat-clip-off", "sat-clip-on", "sat"].forEach(function (id) {
      if (map.getLayer(id)) { try { map.removeLayer(id); } catch (e) {} }
    });
    if (map.getSource("sat")) { try { map.removeSource("sat"); } catch (e) {} }
    map.addSource("sat", { type: "raster", tiles: tiles, tileSize: 256, attribution: "Tiles © Esri", maxzoom: 17 });
    const before = map.getLayer("hillshade") ? "hillshade" : undefined;
    map.addLayer({ id: "sat", type: "raster", source: "sat", layout: { visibility: vis || "none" } }, before);
  }
  function syncYearControl() {
    const wrap = document.getElementById("sat-year-wrap");
    const input = document.getElementById("sat-year");
    const val = document.getElementById("sat-year-val");
    const on = !!(state.satellite || state.compare);
    if (wrap) wrap.hidden = !on;
    if (input && String(input.value) !== String(state.satYear)) input.value = String(state.satYear);
    if (val) val.textContent = String(state.satYear);
    const dict = t();
    if (input && dict.photoYear) input.setAttribute("aria-label", dict.photoYear);
  }
  function setSatYear(year) {
    year = Number(year);
    if (!Number.isFinite(year)) year = 2026;
    year = Math.max(2014, Math.min(2026, Math.round(year)));
    const tiles = satTilesForYear(year);
    const key = tiles[0];
    if (state.satYear !== year || state.satTilesKey !== key) {
      state.satYear = year;
      try { replaceSatTiles(tiles); } catch (e) {}
      state.satTilesKey = key;
    } else {
      state.satYear = year;
    }
    applyBasemap();
    if (window.writeShareParams) window.writeShareParams({ year: year < 2026 ? String(year) : "" });
  }
  on("sat-year", "input", function (e) { setSatYear(e.target.value); });
  on("sat-year-wrap", "pointerdown", function (e) { e.stopPropagation(); });
  on("btn-survey", "click", () => setSurvey(!state.survey));
  on("btn-print", "click", () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(location.href).catch(function () {});
    }
    window.print();
  });
  on("btn-terrain", "click", () => setTerrainOn(!state.terrain));
  on("btn-3d", "click", () => setView3d(!state.view3d));
  on("btn-catalog", "click", () => {
    const el = document.getElementById("catalog");
    if (!el) return;
    el.hidden = !el.hidden;
    const btn = document.getElementById("btn-catalog");
    if (btn) btn.classList.toggle("on", !el.hidden);
  });
  on("cat-survey", "change", (e) => setSurvey(e.target.checked));
  on("cat-nums", "change", (e) => setPlotNums(e.target.checked));
  on("cat-bldg", "change", (e) => setBuildings(e.target.checked));
  on("cat-vil", "change", (e) => setVillages(e.target.checked));
  on("cat-terrain", "change", (e) => setTerrainOn(e.target.checked));
  on("cat-labels", "change", (e) => setLabels(e.target.checked));
  fillCatalogStates();
  function clearDraw() {
    state.pts = [];
    state.ptSnap = [];
    dragI = -1;
    justDragged = false;
    try { map.dragPan.enable(); } catch (e) {}
    redraw();
    if (state.tool === "measure" || state.tool === "area") showDrawStats();
  }
  on("btn-measure-clear", "click", (e) => {
    e.stopPropagation();
    clearDraw();
  });
  on("btn-measure-trash", "click", (e) => {
    e.stopPropagation();
    clearDraw();
  });
  function flyIndia() {
    markUserMoved();
    map.flyTo({
      center: INDIA.center,
      zoom: INDIA.zoom,
      pitch: state.terrain ? map.getPitch() : 0,
      essential: true
    });
    toast("India");
  }
  on("btn-india", "click", flyIndia);
  on("btn-details", "click", () => openInspector());
  on("ins-close", "click", (e) => { e.stopPropagation(); closeInspector(); });
  on("ins-min", "click", (e) => { e.stopPropagation(); toggleMinInspector(); });

  on("shp", "change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      let geo;
      if (/\.json$/i.test(file.name) || /\.geojson$/i.test(file.name)) {
        geo = JSON.parse(new TextDecoder().decode(buf));
      } else if (window.shp) {
        geo = await window.shp(buf);
      } else {
        toast("Shapefile reader did not load.");
        return;
      }
      if (geo.type === "Topology") { toast("That file is not GeoJSON/SHP."); return; }
      const fc = geo.type === "FeatureCollection" ? geo : (Array.isArray(geo) ? { type: "FeatureCollection", features: geo.flatMap((g) => g.features || [g]) } : { type: "FeatureCollection", features: [geo] });
      map.getSource("shp").setData(fc);
      toast("Shapefile on the map. " + (fc.features || []).length + " features.");
      inspect("Shapefile", file.name, "Drawn on top of the basemap. This is your file, not Bhulekh.",
        [["Features", String((fc.features || []).length)]], "");
    } catch (err) {
      toast("Could not read that file.");
    }
  });


  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const qEl = document.getElementById("q");
  const suggest = document.getElementById("suggest");
  const searchForm = document.getElementById("search-form");
  const btnSearch = document.getElementById("btn-search");
  const btnSearchClose = document.getElementById("btn-search-close");
  const btnLang = document.getElementById("btn-lang");
  const langMenu = document.getElementById("lang-menu");

  function openSearch() {
    if (!searchForm) return;
    searchForm.hidden = false;
    closeLangMenu();
    try { map.keyboard.disable(); } catch (err) {}
    const v = qEl && qEl.value.trim();
    if (v) searchPlaces(v);
    else renderSuggest(nearbySuggestItems());
    requestAnimationFrame(function () {
      if (qEl) qEl.focus();
    });
  }
  function closeSearch() {
    if (!searchForm) return;
    searchForm.hidden = true;
    if (suggest) suggest.hidden = true;
    try { map.keyboard.enable(); } catch (err) {}
  }
  function openLangMenu() {
    if (!langMenu) return;
    langMenu.hidden = false;
    if (btnLang) btnLang.setAttribute("aria-expanded", "true");
  }
  function closeLangMenu() {
    if (!langMenu) return;
    langMenu.hidden = true;
    if (btnLang) btnLang.setAttribute("aria-expanded", "false");
  }
  function goNear() {
    runLocate({ force: true, mine: true });
  }
  const btnLocate = document.getElementById("btn-locate");
  if (btnLocate) btnLocate.addEventListener("click", (e) => {
    e.stopPropagation();
    goNear();
  });

  function dictHas(key, text) {
    if (!window.I18N) return false;
    return Object.keys(window.I18N).some((id) => window.I18N[id][key] === text);
  }

  function applyLang() {
    const dict = t();
    const lang = window.getLang ? window.getLang() : state.lang;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      if (el.id === "ins-kicker" && el.textContent && !dictHas("identify", el.textContent) && !dictHas("measure", el.textContent) && !dictHas("area", el.textContent)) return;
      if (el.id === "ins-title" && el.textContent && !dictHas("tapPlot", el.textContent)) return;
      const key = el.getAttribute("data-i18n");
      if (typeof dict[key] === "string") el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (typeof dict[key] === "string") el.placeholder = dict[key];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      if (typeof dict[key] === "string") el.setAttribute("aria-label", dict[key]);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (typeof dict[key] === "string") el.title = dict[key];
    });
    if (window.fillLangMenu) window.fillLangMenu();
    const langs = window.LANGS || [];
    const cur = langs.find((l) => l.id === lang) || langs[0];
    if (btnLang && cur) {
      btnLang.textContent = cur.native || cur.short || cur.name;
      btnLang.title = cur.name;
    }
    const mapBtn = document.getElementById("ly-map");
    const satBtn = document.getElementById("ly-sat");
    if (mapBtn && dict.basemapMap) mapBtn.textContent = dict.basemapMap;
    if (satBtn && dict.basemapSat) satBtn.textContent = dict.basemapSat;
    syncBasemapChips();
    const labBtn = document.getElementById("ly-labels");
    if (labBtn) {
      if (dict.labels) labBtn.textContent = dict.labels;
      labBtn.classList.toggle("on", state.labels !== false);
      labBtn.setAttribute("aria-pressed", state.labels !== false ? "true" : "false");
    }
    const yearIn = document.getElementById("sat-year");
    if (yearIn && dict.photoYear) yearIn.setAttribute("aria-label", dict.photoYear);
    syncYearControl();
    const toolKeys = ["identify", "measure", "area", "shapefile", "print", "survey", "terrain", "details", "vertices", "borderLen", "areaTheme", "view3d", "catalog", "measureClear"];
    document.querySelectorAll(".tools [data-tool], .tools .file-btn, #btn-print, #btn-survey, #btn-verts, #btn-border, #btn-atheme, #btn-terrain, #btn-details, #btn-3d, #btn-catalog, #btn-measure-clear").forEach((el) => {
      const key = el.dataset.tool || (el.id === "btn-print" ? "print" : el.id === "btn-survey" ? "survey" : el.id === "btn-verts" ? "vertices" : el.id === "btn-border" ? "borderLen" : el.id === "btn-atheme" ? "areaTheme" : el.id === "btn-terrain" ? "terrain" : el.id === "btn-details" ? "details" : el.id === "btn-3d" ? "view3d" : el.id === "btn-catalog" ? "catalog" : el.id === "btn-measure-clear" ? "measureClear" : (el.classList.contains("file-btn") ? "shapefile" : ""));
      if (key && dict[key]) {
        el.title = dict[key];
        el.setAttribute("aria-label", dict[key]);
      }
    });
    if (window.applyMapLanguage) window.applyMapLanguage(map, state.lang);
    if (window.Passport) window.Passport.refresh();
    if (state.lastVillage && !state.selFeat) {
      const ins = document.getElementById("inspector");
      const titleEl = document.getElementById("ins-title");
      if (ins && !ins.hidden && titleEl) {
        const v = state.lastVillage;
        titleEl.textContent = v.name_local && state.lang !== "en" ? v.name_local : v.name;
      }
    }
    if (suggest && !suggest.hidden) {
      const typed = (qEl && qEl.value || "").trim();
      if (!typed) renderSuggest(nearbySuggestItems());
      else if (suggest._items && suggest._items.some((it) => it && it.village)) {
        renderSuggest(suggest._items.map((it) => it && it.village ? nearbyToSuggest(it.village) : it));
      }
    }
  }

  if (searchForm && qEl) {
    searchForm.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.target.closest("#btn-search-close") || e.target.closest("#suggest")) return;
      qEl.focus();
    });
    qEl.addEventListener("focus", () => { try { map.dragPan.disable(); } catch (e) {} });
    qEl.addEventListener("blur", () => { try { map.dragPan.enable(); } catch (e) {} });
  }

  function renderSuggest(items, emptyMsg) {
    if (!suggest) return;
    items = items || [];
    const near = '<li data-act="near"><span>' + escapeHtml(t().locate || "Near me") + "</span></li>";
    let extra = "";
    if (!items.length && emptyMsg) extra = "<li class='mute'>" + emptyMsg + "</li>";
    suggest.hidden = false;
    suggest.innerHTML = near + extra + items.map((it, i) => {
      const name = it.name || (it.display_name || "").split(",")[0];
      const rest = it.sub || (it.display_name || "").split(",").slice(1, 3).join(",");
      return '<li data-i="' + i + '"><span>' + escapeHtml(name) + (rest ? "<br><small>" + escapeHtml(rest) + "</small>" : "") + "</span></li>";
    }).join("");
    suggest._items = items;
  }

  async function searchPlaces(text) {
    const raw = text.trim();
    if (raw.length < 2) { renderSuggest(raw ? [] : nearbySuggestItems()); return; }
    if (window.isDigiPin && window.isDigiPin(raw) && window.getLatLngFromDigiPin) {
      const ll = window.getLatLngFromDigiPin(raw);
      if (ll) {
        markUserMoved();
        map.flyTo({ center: [ll.lon, ll.lat], zoom: 17 });
        inspect(t().digipin || "DIGIPIN", raw, "", [[t().coords || "Coordinates", ll.lat.toFixed(6) + ", " + ll.lon.toFixed(6)]], "");
        renderSuggest([]);
        closeSearch();
        return;
      }
    }
    let plotItems = [];
    if (window.PlotUX && window.PlotUX.looksLikePlotQuery(raw)) {
      const hits = window.PlotUX.matchVisiblePlots(map, SURVEY_FILL, raw, 12);
      plotItems = hits.map((p) => ({
        kind: "plot",
        name: (t().surveyNo || "Survey no.") + " " + p.id,
        sub: [p.village, t().plotSearch || "Plot"].filter(Boolean).join(" · "),
        plot: p,
        lat: p.lngLat ? p.lngLat[1] : null,
        lon: p.lngLat ? p.lngLat[0] : null
      }));
    }
    if (state.searchAbort) state.searchAbort.abort();
    state.searchAbort = new AbortController();
    renderSuggest(plotItems, t().searching || "Searching…");
    try {
      if (window.LGD) {
        const local = await window.LGD.search(raw);
        if (local && local.length) {
          const lang = state.lang;
          renderSuggest(plotItems.concat(local.map((v) => ({
            kind: "lgd",
            name: v.name_local && lang !== "en" ? v.name + " · " + v.name_local : v.name,
            sub: [v.district, v.state].filter(Boolean).join(", "),
            display_name: [v.name, v.subdistrict, v.district, v.state].filter(Boolean).join(", "),
            lon: v.lon, lat: v.lat, village: v
          }))));
          return;
        }
      }
      const url = NOMINATIM + "/search?format=jsonv2&q=" + encodeURIComponent(raw) + "&countrycodes=in&limit=7";
      const res = await fetch(url, { signal: state.searchAbort.signal, headers: { Accept: "application/json" } });
      const data = res.ok ? await res.json() : [];
      const items = plotItems.concat(data);
      renderSuggest(items, items.length ? null : (t().noResults || "No place found in India"));
    } catch (err) {
      if (err.name !== "AbortError") renderSuggest(plotItems, plotItems.length ? null : (t().noResults || "No place found in India"));
    }
  }
  if (qEl) {
    qEl.addEventListener("input", () => {
      clearTimeout(searchPlaces._t);
      const v = qEl.value;
      if (!v.trim()) { renderSuggest(nearbySuggestItems()); return; }
      searchPlaces._t = setTimeout(() => searchPlaces(v), 280);
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (qEl) searchPlaces(qEl.value);
    });
  }
  if (suggest) {
    suggest.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (!li || li.classList.contains("mute")) return;
      if (li.dataset.act === "near") {
        goNear();
        closeSearch();
        return;
      }
      const item = suggest._items[Number(li.dataset.i)];
      if (!item) return;
      suggest.hidden = true;
      closeSearch();
      markUserMoved();
      if (item.kind === "plot" && item.plot) { pickPlot(item.plot); return; }
      const lat = Number(item.lat), lon = Number(item.lon);
      if (!lat || !lon) { toast(t().noCoords || "No map point for that village yet."); return; }
      map.flyTo({ center: [lon, lat], zoom: 15.5 });
      placeMarker({ lng: lon, lat: lat });
      if (item.village) state.lastVillage = item.village;
      inspect(t().place || "Village", item.name || (item.display_name || "").split(",")[0], item.display_name, [], "");
    });
  }

  if (btnSearch) btnSearch.addEventListener("click", (e) => { e.stopPropagation(); openSearch(); });
  if (btnSearchClose) btnSearchClose.addEventListener("click", (e) => { e.stopPropagation(); closeSearch(); });
  if (btnLang) btnLang.addEventListener("click", (e) => {
    e.stopPropagation();
    if (langMenu && langMenu.hidden) { closeSearch(); openLangMenu(); }
    else closeLangMenu();
  });
  if (langMenu) langMenu.addEventListener("click", (e) => {
    const li = e.target.closest("[data-lang]");
    if (!li) return;
    if (window.setLang) window.setLang(li.dataset.lang);
    state.lang = window.getLang ? window.getLang() : li.dataset.lang;
    closeLangMenu();
    applyLang();
  });
  document.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
    if (e.key === "Escape") {
      closeSearch();
      closeLangMenu();
      if (state.tool === "measure" || state.tool === "area") setTool("identify");
      return;
    }
    if (!typing && searchForm && !searchForm.hidden && qEl && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      qEl.focus();
    }
  });
  document.addEventListener("pointerdown", (e) => {
    if (searchForm && !searchForm.hidden && !searchForm.contains(e.target) && !(btnSearch && btnSearch.contains(e.target))) {
      closeSearch();
    }
    if (langMenu && !langMenu.hidden && !langMenu.contains(e.target) && !(btnLang && btnLang.contains(e.target))) {
      closeLangMenu();
    }
  });

  wireInspectorDrag();
  syncMinBtn();
  applyLang();
  if (window.Passport && window.Passport.wantDemoAtBoot()) {
    window.Passport.bind();
    window.Passport.showStandalone();
    openInspector();
  }

  function refreshPlotExtras() {
    if (!window.PlotUX) return;
    window.PlotUX.refreshExtras(map, {
      verts: !!state.verts,
      border: !!state.border,
      theme: !!state.areaTheme,
      selFeat: state.selFeat,
      surveyLayers: SURVEY_FILL
    });
    const legend = document.getElementById("area-legend");
    if (legend) legend.hidden = !state.areaTheme;
  }

  function refreshPlotPicker() {
    const wrap = document.getElementById("plot-pick-wrap");
    const sel = document.getElementById("plot-pick");
    if (!wrap || !sel || !window.PlotUX) return;
    let z = 0;
    try { z = map.getZoom(); } catch (e) {}
    if (z < 14) {
      wrap.hidden = true;
      sel.innerHTML = "";
      sel._plots = [];
      return;
    }
    const plots = window.PlotUX.collectVisiblePlots(map, SURVEY_FILL, 80);
    if (!plots.length) {
      wrap.hidden = true;
      sel.innerHTML = "";
      sel._plots = [];
      return;
    }
    wrap.hidden = false;
    const dict = t();
    const prev = sel.value;
    sel.innerHTML = '<option value="">' + escapeHtml((dict.plotPick || "Plot in view") + " (" + plots.length + ")") + "</option>" +
      plots.map(function (p, i) {
        return '<option value="' + i + '">' + escapeHtml(p.id) + (p.village ? " · " + escapeHtml(p.village) : "") + "</option>";
      }).join("");
    sel._plots = plots;
    if (prev) sel.value = prev;
  }

  function pickPlot(plot) {
    if (!plot || !plot.feat) return;
    markUserMoved();
    closeSearch();
    state.selFeat = plot.feat;
    state.lastFeat = plot.feat;
    if (window.PlotUX) {
      window.PlotUX.setHighlight(map, plot.feat);
      window.PlotUX.flyToFeat(map, plot.feat);
    }
    const p = plot.feat.properties || {};
    const sn = (window.PlotUX && window.PlotUX.surveyNumber) ? window.PlotUX.surveyNumber(p) : surveyNumber(p);
    const v = p.v_name || p.village || "";
    const stName = window.PlotUX ? window.PlotUX.stateNameFromLayer(plot.feat.layer && plot.feat.layer.id, plot.feat.source) : "";
    const ulpin = window.PlotUX ? window.PlotUX.ulpinOf(p) : "";
    const ll = plot.lngLat || (window.PlotUX && window.PlotUX.centroidOf(plot.feat.geometry));
    const lat = ll ? ll[1] : 0, lng = ll ? ll[0] : 0;
    const pin = (lat && window.getDigiPin) ? window.getDigiPin(lat, lng) : "";
    const rows = [
      [t().surveyNo || "Survey no.", sn || "—"],
      [t().place || "Village", v || "—"]
    ];
    if (ulpin) rows.push([t().ulpin || "ULPIN", ulpin]);
    if (lat) {
      rows.push([t().digipin || "DIGIPIN", pin || "—"]);
      rows.push([t().coords || "Coordinates", lat.toFixed(6) + ", " + lng.toFixed(6)]);
    }
    /* no source row */
    const pass = window.Passport ? window.Passport.fromFeat(plot.feat, { lat: lat, lng: lng }) : null;
    if (lat) placeMarker({ lng: lng, lat: lat });
    inspect(t().identify || "Identify", sn ? ((t().surveyNo || "Survey no.") + " " + sn) : (t().point || "This plot"),
      [v, p.m_name, p.d_name].filter(Boolean).join(", ") || (t().sourceSurvey || "Survey outline"),
      rows, "",
      pass);
    refreshPlotExtras();
  }

  function setLabels(on) {
    state.labels = !!on;
    if (window.applyStreetVisibility) window.applyStreetVisibility(map, state.satellite, state.labels, state.compare);
    if (window.PlotUX) window.PlotUX.persistLabels(state.labels);
    const btn = document.getElementById("ly-labels");
    if (btn) {
      btn.classList.toggle("on", state.labels);
      btn.setAttribute("aria-pressed", state.labels ? "true" : "false");
    }
    const box = document.getElementById("cat-labels");
    if (box) box.checked = !!state.labels;
  }

  function setPlotFlag(name, on, btnId) {
    state[name] = !!on;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.toggle("on", !!on);
    refreshPlotExtras();
  }

  on("ly-labels", "click", () => setLabels(!state.labels));
  on("btn-verts", "click", () => setPlotFlag("verts", !state.verts, "btn-verts"));
  on("btn-border", "click", () => setPlotFlag("border", !state.border, "btn-border"));
  on("btn-atheme", "click", () => setPlotFlag("areaTheme", !state.areaTheme, "btn-atheme"));
  const plotSel = document.getElementById("plot-pick");
  if (plotSel) plotSel.addEventListener("change", () => {
    const plots = plotSel._plots || [];
    const i = Number(plotSel.value);
    if (!Number.isFinite(i) || !plots[i]) return;
    pickPlot(plots[i]);
  });

    map.on("load", () => {
    if (window.PlotUX) window.PlotUX.ensureOverlays(map);
    if (window.readShareParam && window.readShareParam("sat") === "1") setSatellite(true);
    if (window.readShareParam && window.readShareParam("compare") === "1") setCompare(true);
    if (window.readShareParam) {
      const y0 = Number(window.readShareParam("year"));
      if (y0 >= 2014 && y0 <= 2026) setSatYear(y0);
    }
    if (state.labels === false && window.applyStreetVisibility) {
      window.applyStreetVisibility(map, state.satellite, false, state.compare);
    }
    if (window.attachOpenFreeMap) {
      window.attachOpenFreeMap(map, {
        getLang: () => state.lang,
        getSatellite: () => state.satellite,
        getLabels: () => state.labels !== false,
        getCompare: () => !!state.compare
      });
    }
    runLocate({ initial: true });
    refreshPlotPicker();
  });
  map.on("moveend", () => {
    refreshPlotPicker();
    refreshPlotExtras();
  });
})();
