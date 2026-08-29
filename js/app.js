(() => {
  const INDIA = { min: [68.0, 6.5], max: [97.5, 37.2], center: [79.0, 22.5], zoom: 4.6 };
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const OVERPASS = "https://overpass-api.de/api/interpreter";


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
  const ADMIN = [
    { id: "lgd-villages", tiles: ["https://indianopenmaps.com/not-so-open/villages/lgd/{z}/{x}/{y}.pbf"], sourceLayer: "LGD_Villages", minzoom: 11, maxzoom: 12 }
  ];

  const state = {
    lang: (typeof window.getLang === "function" ? window.getLang() : "en"),
    satellite: false,
    compare: false,
    role: "citizen",
    marker: null,
    searchAbort: null,
    reverseAbort: null,
    overpassAbort: null,
    searchTimer: null,
    overpassTimer: null,
    lastOverpassKey: "",
    overlapHint: false,
    userMoved: false,
    lastLocate: null,
    nearbyVillages: [],
    measure: false,
    pts: [],
    ptSnap: [],
    satYear: 2026,
    terrain: false,
    labels: (window.PlotUX && window.PlotUX.labelsOnAtBoot) ? window.PlotUX.labelsOnAtBoot() : true,
    verts: false,
    border: false,
    areaTheme: false,
    selFeat: null
  };
  let dragI = -1;
  let justDragged = false;
  let justDraggedTimer = 0;

  const t = () => (window.t && window.t()) || window.I18N[state.lang] || window.I18N.en;

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
      osmfeat: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      buildings: {
        type: "vector",
        tiles: ["https://indianopenmaps.com/google-buildings/{z}/{x}/{y}.pbf"],
        minzoom: 15,
        maxzoom: 15,
        attribution: "Buildings: Google Open Buildings / Datameet"
      },
      draw: { type: "geojson", data: { type: "FeatureCollection", features: [] } }
    },
    layers: [
      { id: "osm", type: "raster", source: "osm" },
      { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } },
      {
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        minzoom: 8,
        paint: { "hillshade-shadow-color": "#473B24", "hillshade-exaggeration": 0.28 }
      },
      {
        id: "farm-fill",
        type: "fill",
        source: "osmfeat",
        filter: ["==", ["get", "kind"], "farmland"],
        paint: { "fill-color": "#c4a35a", "fill-opacity": 0.28 }
      },
      {
        id: "farm-line",
        type: "line",
        source: "osmfeat",
        filter: ["==", ["get", "kind"], "farmland"],
        paint: { "line-color": "#6b5420", "line-width": 1.2 }
      },
      {
        id: "bldg-fill",
        type: "fill",
        source: "osmfeat",
        filter: ["==", ["get", "kind"], "building"],
        paint: { "fill-color": "#8a6a4a", "fill-opacity": 0.45 }
      },
      {
        id: "bldg-line",
        type: "line",
        source: "osmfeat",
        filter: ["==", ["get", "kind"], "building"],
        paint: { "line-color": "#3f2c1e", "line-width": 1 }
      },
      {
        id: "bldg-extrusion",
        type: "fill-extrusion",
        source: "osmfeat",
        filter: ["all",
          ["==", ["get", "kind"], "building"],
          [">", ["coalesce",
            ["to-number", ["get", "height"]],
            ["to-number", ["get", "building_height"]],
            ["to-number", ["get", "Height"]],
            ["to-number", ["get", "ht"]],
            0], 0]
        ],
        paint: {
          "fill-extrusion-color": "#8a6a4a",
          "fill-extrusion-opacity": 0.65,
          "fill-extrusion-height": ["coalesce",
            ["to-number", ["get", "height"]],
            ["to-number", ["get", "building_height"]],
            ["to-number", ["get", "Height"]],
            ["to-number", ["get", "ht"]],
            0]
        }
      }
    ]
  };

  CADASTRALS.forEach((c) => {
    style.sources[c.id] = {
      type: "vector",
      tiles: c.tiles,
      minzoom: 13,
      maxzoom: c.maxzoom,
      attribution: "Survey outlines / Datameet (CC0)"
    };
    style.layers.push({
      id: c.id + "-fill",
      type: "fill",
      source: c.id,
      "source-layer": c.sourceLayer,
      minzoom: 13,
      paint: { "fill-color": "#c45c26", "fill-opacity": 0.14, "fill-outline-color": "#9a3f14" }
    });
    style.layers.push({
      id: c.id + "-line",
      type: "line",
      source: c.id,
      "source-layer": c.sourceLayer,
      minzoom: 13,
      paint: { "line-color": "#9a3f14", "line-width": 1.05, "line-opacity": 0.9 }
    });
    if (window.PlotUX && window.PlotUX.plotNumberLayer) {
      style.layers.push(window.PlotUX.plotNumberLayer(c, 14));
    }
  });

  ADMIN.forEach((a) => {
    style.sources[a.id] = { type: "vector", tiles: a.tiles, minzoom: a.minzoom || 11, maxzoom: a.maxzoom, attribution: "Boundaries: LGD / Datameet (CC0)" };
    if (a.id.indexOf("village") >= 0) {
      style.layers.push({
        id: a.id + "-line", type: "line", source: a.id, "source-layer": a.sourceLayer,
        minzoom: 11, maxzoom: 13,
        paint: { "line-color": "#6b5420", "line-width": 0.8, "line-opacity": 0.55 }
      });
    }
  });
  style.layers.push({
    id: "bldg-open-fill", type: "fill", source: "buildings", "source-layer": "google-open-buildings-india-2023",
    minzoom: 15,
    paint: { "fill-color": "#8a6a4a", "fill-opacity": 0.35 }
  });
  style.layers.push({
    id: "bldg-open-line", type: "line", source: "buildings", "source-layer": "google-open-buildings-india-2023",
    minzoom: 15,
    paint: { "line-color": "#3f2c1e", "line-width": 0.6 }
  });
  style.layers.push({
    id: "bldg-open-extrusion", type: "fill-extrusion", source: "buildings", "source-layer": "google-open-buildings-india-2023",
    minzoom: 15,
    filter: [">", ["coalesce",
      ["to-number", ["get", "height"]],
      ["to-number", ["get", "building_height"]],
      ["to-number", ["get", "Height"]],
      ["to-number", ["get", "ht"]],
      0], 0],
    paint: {
      "fill-extrusion-color": "#8a6a4a",
      "fill-extrusion-opacity": 0.65,
      "fill-extrusion-height": ["coalesce",
        ["to-number", ["get", "height"]],
        ["to-number", ["get", "building_height"]],
        ["to-number", ["get", "Height"]],
        ["to-number", ["get", "ht"]],
        0]
    }
  });
  style.layers.push({
    id: "draw-fill",
    type: "fill",
    source: "draw",
    paint: { "fill-color": "#c45c26", "fill-opacity": 0.16 }
  });
  style.layers.push({
    id: "draw-line",
    type: "line",
    source: "draw",
    paint: { "line-color": "#c45c26", "line-width": 2.2 }
  });
  style.layers.push({
    id: "draw-pts",
    type: "circle",
    source: "draw",
    paint: {
      "circle-radius": ["case", ["==", ["get", "snap"], 1], 8, 7],
      "circle-color": "#c45c26",
      "circle-stroke-width": ["case", ["==", ["get", "snap"], 1], 2.2, 1.5],
      "circle-stroke-color": ["case", ["==", ["get", "snap"], 1], "#f0c36a", "#fffdf8"]
    }
  });
  style.layers.push({
    id: "draw-len",
    type: "symbol",
    source: "draw",
    filter: ["has", "len"],
    layout: {
      "text-field": ["get", "len"],
      "text-size": 11,
      "text-font": ["Noto Sans Regular"],
      "text-allow-overlap": true
    },
    paint: { "text-color": "#1c1814", "text-halo-color": "#fff8ee", "text-halo-width": 1.4 }
  });
  style.layers.push({
    id: "draw-sum",
    type: "symbol",
    source: "draw",
    filter: ["has", "sum"],
    layout: {
      "text-field": ["get", "sum"],
      "text-size": 13,
      "text-font": ["Noto Sans Regular"],
      "text-allow-overlap": true
    },
    paint: { "text-color": "#1c1814", "text-halo-color": "#fff8ee", "text-halo-width": 1.6 }
  });

  const SURVEY_FILL = CADASTRALS.map((c) => c.id + "-fill");
  const VILLAGE_FILL = ["lgd-villages-fill"];

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
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
    hash: true,
    preserveDrawingBuffer: true,
    transformRequest: window.mapLangTransformRequest
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "bottom-right");
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
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }));
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

  function applyLang() {
    const dict = t();
    const lang = window.getLang ? window.getLang() : state.lang;
    state.lang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
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
    const btnLang = document.getElementById("btn-lang");
    const langs = window.LANGS || [];
    const cur = langs.find((l) => l.id === lang) || langs[0];
    if (btnLang && cur) {
      btnLang.textContent = cur.native || cur.short || cur.name;
      btnLang.title = cur.name;
    }
    const note = document.querySelector("#sheet p.note");
    if (note) { const txt = sheetNoteText(state.overlapHint); note.textContent = txt; note.hidden = !txt; }
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
    const terBtn = document.getElementById("ly-terrain");
    if (terBtn) {
      if (dict.terrain && !terBtn.querySelector("svg")) terBtn.textContent = dict.terrain;
      terBtn.classList.toggle("on", !!state.terrain);
      terBtn.setAttribute("aria-pressed", state.terrain ? "true" : "false");
    }
    const yearIn = document.getElementById("sat-year");
    if (yearIn && dict.photoYear) yearIn.setAttribute("aria-label", dict.photoYear);
    syncYearControl();
    const oldBase = document.getElementById("btn-basemap");
    if (oldBase) {
      oldBase.textContent = state.satellite ? dict.basemapMap : dict.basemapSat;
      oldBase.classList.toggle("active", state.satellite);
    }
    if (window.applyMapLanguage) window.applyMapLanguage(map, state.lang);
    if (state.lastVillage && !state.selFeat) {
      const sheet = document.getElementById("sheet");
      if (sheet && !sheet.hidden) {
        const ll = state.lastVillageLL || {};
        villageSheet(state.lastVillage, ll.lat, ll.lon);
      }
    }
    if (window.Passport) window.Passport.refresh();
    const suggestEl = document.getElementById("suggest");
    const qInput = document.getElementById("q");
    if (suggestEl && !suggestEl.hidden) {
      const typed = (qInput && qInput.value || "").trim();
      if (!typed) renderSuggest(nearbySuggestItems());
      else if (suggestEl._items && suggestEl._items.some((it) => it && it.village)) {
        renderSuggest(suggestEl._items.map((it) => it && it.village ? localToSuggest(it.village) : it));
      }
    }
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.hidden = false;
    el.textContent = msg;
  }

  function placeMarker(lngLat) {
    if (state.marker) state.marker.remove();
    state.marker = new maplibregl.Marker({ color: "#c45c26" }).setLngLat(lngLat).addTo(map);
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

  async function loadNearbyVillages(lat, lng) {
    if (!window.LGD || !window.LGD.nearby) return;
    try {
      const items = await window.LGD.nearby(lat, lng);
      state.nearbyVillages = items || [];
    } catch (e) {
      state.nearbyVillages = [];
    }
  }

  function nearbySuggestItems() {
    return (state.nearbyVillages || []).map(localToSuggest);
  }

  function formatPlace(rev) {
    if (!rev) return t().point;
    const a = rev.address || {};
    return (
      a.village || a.hamlet || a.town || a.city || a.suburb || a.county ||
      rev.name || rev.display_name || t().point
    );
  }

  function formatWhere(rev) {
    if (!rev || !rev.address) return "";
    const a = rev.address;
    return [a.county, a.state, a.postcode].filter(Boolean).join(", ");
  }

  function surveyNumber(props) {
    if (window.PlotUX && window.PlotUX.surveyNumber) return window.PlotUX.surveyNumber(props);
    if (!props) return "";
    return "";
  }


  const SHEET_STORE = "bhoonaksha-sheet";
  function loadSheetPos() {
    try { return JSON.parse(sessionStorage.getItem(SHEET_STORE) || "null"); }
    catch (e) { return null; }
  }
  function saveSheetPos() {
    const el = document.getElementById("sheet");
    if (!el || !el.style.left) return;
    try {
      sessionStorage.setItem(SHEET_STORE, JSON.stringify({
        left: el.style.left, top: el.style.top, min: el.classList.contains("min")
      }));
    } catch (e) {}
  }
  function syncSheetMin() {
    const el = document.getElementById("sheet");
    const btn = document.getElementById("sheet-min");
    if (!el || !btn) return;
    const min = el.classList.contains("min");
    btn.textContent = min ? "▴" : "▾";
    btn.setAttribute("aria-label", min ? "Expand" : "Minimize");
    btn.title = min ? "Expand" : "Minimize";
  }
  function spawnSheet() {
    const el = document.getElementById("sheet");
    if (!el) return;
    const saved = loadSheetPos();
    if (saved && saved.left && saved.top) {
      el.style.left = saved.left;
      el.style.top = saved.top;
      el.style.right = "auto";
      el.classList.toggle("min", !!saved.min);
      syncSheetMin();
      return;
    }
    const w = Math.min(300, window.innerWidth - 28);
    el.style.width = w + "px";
    el.style.right = "auto";
    el.style.left = Math.max(8, window.innerWidth - w - 14) + "px";
    el.style.top = (window.innerWidth <= 640 ? Math.max(72, window.innerHeight - 280) : 88) + "px";
  }
  function openSheet() {
    const el = document.getElementById("sheet");
    if (!el) return;
    const first = el.hidden;
    el.hidden = false;
    if (first) spawnSheet();
    el.classList.remove("min");
    syncSheetMin();
  }
  function closeSheet() {
    const el = document.getElementById("sheet");
    if (el) el.hidden = true;
  }
  function wireSheetDrag() {
    const el = document.getElementById("sheet");
    const head = document.getElementById("sheet-head");
    if (!el || !head) return;
    let dragging = false, ox = 0, oy = 0;
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
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
      let x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - ox));
      let y = Math.max(8, Math.min(window.innerHeight - 48, e.clientY - oy));
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      try { map.dragPan.enable(); } catch (err) {}
      saveSheetPos();
    }
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
  }

  function showSheet(info) {
    const dict = t();
    openSheet();
    const toastEl = document.getElementById("toast");
    if (toastEl) toastEl.hidden = true;
    document.getElementById("sheet-kicker").textContent = info.kindLabel || dict.point;
    document.getElementById("sheet-title").textContent = info.title;
    document.getElementById("sheet-trust").textContent = info.where || "";
    const rows = info.rows && info.rows.length ? info.rows : [
      [dict.place, info.title],
      [dict.digipin, info.digipin || "—"],
      [dict.coords, (info.lat != null && info.lon != null) ? info.lat.toFixed(6) + ", " + info.lon.toFixed(6) : "—"],
      [dict.source, info.source || dict.sourceMap]
    ];
    if (info.passport && window.Passport) {
      window.Passport.paint(info.passport);
    } else {
      document.getElementById("sheet-dl").innerHTML = rows
        .map((row) => "<div><dt>" + row[0] + "</dt><dd>" + escapeHtml(row[1] == null || row[1] === "" ? "—" : String(row[1])) + "</dd></div>")
        .join("");
      if (window.Passport) window.Passport.clear();
    }
    const note = document.querySelector("#sheet p.note");
    if (note) { const txt = sheetNoteText(!!info.overlap); note.textContent = txt; note.hidden = !txt; }
    state.overlapHint = !!info.overlap;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function villageSheet(v, lat, lon, extraWhere) {
    const dict = t();
    state.lastVillage = v;
    state.lastVillageLL = { lat, lon };
    const pin = (lat != null && lon != null) ? window.getDigiPin(lat, lon) : null;
    const title = v.name_local && state.lang !== "en" ? v.name_local : v.name;
    const where = [v.subdistrict, v.district, v.state].filter(Boolean).join(", ");
    showSheet({
      title,
      where: extraWhere || where,
      lat, lon,
      kindLabel: dict.place,
      source: dict.sourceLgd,
      rows: [
        [dict.place, title],
        [dict.district, [v.district, v.state].filter(Boolean).join(", ")],
        [dict.subdistrict, v.subdistrict],
        [dict.lgd, v.lgd],
        [dict.pincode, v.pincode],
        [dict.digipin, pin || "—"],
        [dict.coords, (lat != null && lon != null) ? Number(lat).toFixed(6) + ", " + Number(lon).toFixed(6) : "—"],
        [dict.source, dict.sourceLgd]
      ]
    });
    if (state.lang !== "en" && !v.name_local && window.translateLive) {
      window.translateLive(v.name).then((tr) => {
        if (!tr || tr === v.name) return;
        const titleEl = document.getElementById("sheet-title");
        if (titleEl && titleEl.textContent === v.name) titleEl.textContent = tr;
      });
    }
  }

  async function reverse(lat, lon) {
    if (state.reverseAbort) state.reverseAbort.abort();
    state.reverseAbort = new AbortController();
    const url = NOMINATIM + "/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon + "&zoom=18&addressdetails=1";
    const res = await fetch(url, {
      signal: state.reverseAbort.signal,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function nominatimSearch(q, limit) {
    const url = NOMINATIM + "/search?format=jsonv2&q=" + encodeURIComponent(q) +
      "&countrycodes=in&limit=" + (limit || 7) + "&addressdetails=1&dedupe=1";
    const res = await fetch(url, {
      signal: state.searchAbort ? state.searchAbort.signal : undefined,
      headers: { Accept: "application/json" }
    });
    if (!res.ok) return [];
    return res.json();
  }

  async function inspectPoint(lngLat, feat, overlap) {
    const lon = lngLat.lng;
    const lat = lngLat.lat;
    placeMarker(lngLat);
    const pin = window.getDigiPin(lat, lon);
    const dict = t();

    if (feat && feat.properties && (SURVEY_FILL.indexOf(feat.layer && feat.layer.id) >= 0 || (feat.source && String(feat.source).indexOf('survey-') === 0))) {
      const sn = (window.PlotUX && window.PlotUX.surveyNumber) ? window.PlotUX.surveyNumber(feat.properties) : surveyNumber(feat.properties);
      const vname = feat.properties.v_name || feat.properties.m_name || feat.properties.d_name || dict.sourceSurvey;
      const stName = window.PlotUX ? window.PlotUX.stateNameFromLayer(feat.layer && feat.layer.id, feat.source) : "";
      const src = stName ? (dict.sourceSurvey + " · " + stName) : dict.sourceSurvey;
      const pass = window.Passport ? window.Passport.fromFeat(feat, { lat: lat, lng: lon }) : null;
      state.selFeat = feat;
      if (window.PlotUX) window.PlotUX.setHighlight(map, feat);
      refreshPlotExtras();
      showSheet({
        title: sn ? (dict.surveyNo + " " + sn) : vname,
        where: [feat.properties.v_name, feat.properties.m_name, feat.properties.d_name].filter(Boolean).join(", "),
        lat, lon,
        kindLabel: dict.sourceSurvey,
        source: src,
        overlap: !!overlap,
        passport: pass
      });
      return;
    }

    state.selFeat = null;
    if (window.PlotUX) window.PlotUX.setHighlight(map, null);
    refreshPlotExtras();

    let kindLabel = dict.point;
    const layerId = feat && feat.layer && feat.layer.id;
    if (feat && feat.properties && feat.properties.kind === "building") kindLabel = dict.building;
    if (layerId && layerId.indexOf("bldg-") === 0) kindLabel = dict.building;
    if (feat && feat.properties && feat.properties.kind === "farmland") kindLabel = dict.farmland;

    showSheet({
      title: dict.point,
      where: dict.zoomHint,
      lat, lon,
      digipin: pin,
      kindLabel,
      source: dict.sourceMap
    });

    if (window.LGD) {
      try {
        const near = await window.LGD.near(lat, lon);
        if (near && near.lgd && near.km != null && near.km <= 3) {
          villageSheet(near, lat, lon);
          return;
        }
      } catch (err) { /* ignore */ }
    }

    try {
      const rev = await reverse(lat, lon);
      if (!rev) return;
      showSheet({
        title: formatPlace(rev),
        where: formatWhere(rev),
        lat, lon,
        digipin: pin,
        kindLabel,
        source: dict.sourceMap
      });
    } catch (err) {
      if (err.name !== "AbortError") console.warn(err);
    }
  }

  function overpassQuery(s, w, n, e) {
    return [
      "[out:json][timeout:20]",
      "[bbox:" + s + "," + w + "," + n + "," + e + "];",
      "(",
      'way["landuse"~"^(farmland|farmyard|meadow|orchard)$"];',
      'way["building"];',
      ");",
      "out geom qt;"
    ].join("");
  }

  function waysToGeoJSON(elements) {
    const features = [];
    for (const el of elements) {
      if (!el.geometry || el.geometry.length < 4) continue;
      const ring = el.geometry.map((p) => [p.lon, p.lat]);
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0]);
      }
      const kind = el.tags && el.tags.building ? "building" : "farmland";
      const rawH = el.tags && (el.tags.height || el.tags.building_height || el.tags.ht);
      const height = rawH != null && rawH !== "" ? parseFloat(rawH) : NaN;
      const props = {
          kind,
          osm: "way/" + el.id,
          name: (el.tags && (el.tags.name || el.tags["name:en"])) || ""
      };
      if (Number.isFinite(height) && height > 0) props.height = height;
      features.push({
        type: "Feature",
        properties: props,
        geometry: { type: "Polygon", coordinates: [ring] }
      });
      if (features.length >= 120) break;
    }
    return { type: "FeatureCollection", features };
  }

  async function loadOsmFeatures() {
    const z = map.getZoom();
    if (z < 15) {
      const src = map.getSource("osmfeat");
      if (src) src.setData({ type: "FeatureCollection", features: [] });
      state.lastOverpassKey = "";
      return;
    }
    const b = map.getBounds();
    const key = [z.toFixed(1), b.getSouth().toFixed(3), b.getWest().toFixed(3), b.getNorth().toFixed(3), b.getEast().toFixed(3)].join("|");
    if (key === state.lastOverpassKey) return;
    state.lastOverpassKey = key;
    if (state.overpassAbort) state.overpassAbort.abort();
    state.overpassAbort = new AbortController();
    const q = overpassQuery(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
    try {
      const res = await fetch(OVERPASS, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: "data=" + encodeURIComponent(q),
        signal: state.overpassAbort.signal
      });
      if (!res.ok) return;
      const json = await res.json();
      map.getSource("osmfeat").setData(waysToGeoJSON(json.elements || []));
    } catch (err) {
      if (err.name !== "AbortError") console.warn("fields", err);
    }
  }

  map.on("load", () => {
    applyLang();
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
    runLocate({ initial: true, marker: true });
    refreshPlotPicker();
  });

  function liveLayers(ids) {
    return ids.filter((id) => map.getLayer(id));
  }
  function queryLayers(point, ids) {
    const layers = liveLayers(ids);
    if (!layers.length) return [];
    return map.queryRenderedFeatures(point, { layers });
  }
  const BLDG_QUERY = ["bldg-open-fill", "bldg-fill", "bldg-open-extrusion", "bldg-extrusion"];

  map.on("click", (e) => {
    const src = e.originalEvent && e.originalEvent.target;
    if (src && src.closest && src.closest("button, a, input, select, .search, .map-corner, .inspector, .tools-wrap, .basemap-bar, .tools")) return;
    if (justDragged) {
      justDragged = false;
      return;
    }
    if (state.measure) {
      addMeasurePt([e.lngLat.lng, e.lngLat.lat], e.point);
      return;
    }
    const surveyHits = queryLayers(e.point, SURVEY_FILL);
    const bldgHits = queryLayers(e.point, BLDG_QUERY);
    const farmHits = queryLayers(e.point, ["farm-fill"]);
    const feat = surveyHits[0] || bldgHits[0] || farmHits[0] || null;
    inspectPoint(e.lngLat, feat, !!(surveyHits[0] && bldgHits[0]));
  });

  SURVEY_FILL.concat(["bldg-fill", "bldg-open-fill", "farm-fill"]).forEach((id) => {
    map.on("mouseenter", id, () => { map.getCanvas().style.cursor = state.measure ? "crosshair" : "pointer"; });
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = state.measure ? "crosshair" : "grab"; });
  });

  map.on("moveend", () => {
    clearTimeout(state.overpassTimer);
    state.overpassTimer = setTimeout(loadOsmFeatures, 700);
    refreshPlotPicker();
    refreshPlotExtras();
    const note = document.querySelector("#sheet p.note");
    if (note && !document.getElementById("sheet").hidden && !state.measure) {
      note.textContent = sheetNoteText(state.overlapHint);
    }
  });

  const qEl = document.getElementById("q");
  const suggest = document.getElementById("suggest");

  function renderSuggest(items, emptyMsg) {
    items = items || [];
    const near = '<li data-act="near"><span>' + escapeHtml(t().locate) + "</span></li>";
    let extra = "";
    if (!items.length && emptyMsg) extra = "<li class='mute'>" + emptyMsg + "</li>";
    suggest.hidden = false;
    suggest.innerHTML = near + extra + items.map((item, i) => {
      const name = item.name;
      const rest = item.sub || "";
      return '<li data-i="' + i + '"><span>' + escapeHtml(name) + (rest ? "<br><small>" + escapeHtml(rest) + "</small>" : "") + "</span></li>";
    }).join("");
    suggest._items = items;
  }

  function localToSuggest(v) {
    const name = v.name_local && state.lang !== "en" ? v.name + " · " + v.name_local : v.name;
    const bits = [v.district, v.state].filter(Boolean);
    if (v.km != null && v.km !== "") bits.unshift(v.km + " km");
    return { kind: "lgd", name, sub: bits.join(", "), village: v };
  }

  function nominatimToSuggest(item) {
    const name = item.display_name.split(",")[0];
    const rest = item.display_name.split(",").slice(1, 4).join(",");
    return { kind: "nom", name, sub: rest, item };
  }

  async function pickVillage(v) {
    markUserMoved();
    qEl.value = v.name;
    suggest.hidden = true;
    closeSearch();
    if (v.lat != null && v.lon != null) {
      map.flyTo({ center: [Number(v.lon), Number(v.lat)], zoom: 15.5, essential: true });
      placeMarker({ lng: Number(v.lon), lat: Number(v.lat) });
      villageSheet(v, Number(v.lat), Number(v.lon));
      return;
    }
    villageSheet(v, null, null, t().noCoords);
    const q = [v.name, v.subdistrict, v.district, v.state, "India"].filter(Boolean).join(", ");
    try {
      if (state.searchAbort) state.searchAbort.abort();
      state.searchAbort = new AbortController();
      const data = await nominatimSearch(q, 1);
      if (data && data[0]) {
        const lon = Number(data[0].lon);
        const lat = Number(data[0].lat);
        map.flyTo({ center: [lon, lat], zoom: 15.5, essential: true });
        placeMarker({ lng: lon, lat });
        villageSheet(v, lat, lon);
      }
    } catch (err) {
      if (err.name !== "AbortError") console.warn(err);
    }
  }

  function pickNominatim(item) {
    markUserMoved();
    qEl.value = item.display_name.split(",")[0];
    suggest.hidden = true;
    closeSearch();
    const lon = Number(item.lon);
    const lat = Number(item.lat);
    const zoom = item.type === "village" || item.type === "hamlet" ? 15.5 : item.type === "city" ? 11 : 13;
    map.flyTo({ center: [lon, lat], zoom, essential: true });
    inspectPoint({ lng: lon, lat }, null);
  }

  async function searchPlaces(text) {
    const raw = text.trim();
    if (raw.length < 2) { renderSuggest(raw ? [] : nearbySuggestItems()); return; }
    if (window.isDigiPin(raw)) {
      const ll = window.getLatLngFromDigiPin(raw);
      if (ll) {
        markUserMoved();
        map.flyTo({ center: [ll.lon, ll.lat], zoom: 17, essential: true });
        inspectPoint({ lng: ll.lon, lat: ll.lat }, null);
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
        plot: p
      }));
    }

    if (state.searchAbort) state.searchAbort.abort();
    state.searchAbort = new AbortController();
    renderSuggest(plotItems, t().searching);

    if (window.LGD && window.LGD.count()) {
      const local = await window.LGD.search(raw);
      if (local && local.length) {
        renderSuggest(plotItems.concat(local.map(localToSuggest)));
        return;
      }
    }
    let local = [];
    try {
      const res = await fetch("/api/search?q=" + encodeURIComponent(raw), { signal: state.searchAbort.signal });
      if (res.ok) local = await res.json();
    } catch (err) {
      if (err.name === "AbortError") return;
    }
    if (local && local.length) {
      renderSuggest(plotItems.concat(local.map(localToSuggest)));
      return;
    }

    try {
      const data = await nominatimSearch(raw, 7);
      const items = plotItems.concat(data.map(nominatimToSuggest));
      renderSuggest(items, items.length ? null : t().noResults);
    } catch (err) {
      if (err.name !== "AbortError") renderSuggest(plotItems, plotItems.length ? null : t().noResults);
    }
  }

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
  async function runLocate(opts) {
    opts = opts || {};
    const [gps, ip] = await Promise.all([gpsFix(), ipFix()]);
    const loc = chooseFix(gps, ip, opts);
    if (!loc) {
      if (opts.force || (opts.initial && !gps && !ip)) toast(t().locateFail);
      return null;
    }
    state.lastLocate = loc;
    loadNearbyVillages(loc.lat, loc.lng);
    if (!opts.force && state.userMoved) return loc;
    map.flyTo({ center: [loc.lng, loc.lat], zoom: loc.zoom, essential: true });
    if (opts.sheet) inspectPoint({ lng: loc.lng, lat: loc.lat }, null);
    if (opts.marker || opts.mine) placeMe({ lng: loc.lng, lat: loc.lat });
    return loc;
  }

  function placeMe(lngLat) {
    if (state.meMarker) state.meMarker.remove();
    const el = document.createElement("div");
    el.className = "me-dot";
    state.meMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  }

  function goNear() {
    runLocate({ force: true, mine: true, marker: true });
  }

  const SURVEY_MINZOOM = 13;
  function enStr(key) {
    return (window.I18N && window.I18N.en && window.I18N.en[key]) || "";
  }
  function dictStr(key) {
    const dict = t();
    return (dict && dict[key]) || enStr(key);
  }
  function surveyVisible() {
    try { return map.getZoom() >= SURVEY_MINZOOM; }
    catch (e) { return false; }
  }
  function sheetNoteText(overlap) {
    return "";
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
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += distM(pts[i - 1], pts[i]);
    return n;
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
  function redrawMeasure() {
    const feats = [];
    if (state.pts.length >= 3) {
      const ring = state.pts.concat([state.pts[0]]);
      feats.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} });
    }
    if (state.pts.length >= 2) {
      feats.push({ type: "Feature", geometry: { type: "LineString", coordinates: state.pts }, properties: {} });
    }
    state.pts.forEach((pt, i) => {
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: pt }, properties: { i: i, snap: state.ptSnap[i] ? 1 : 0 } });
    });
    const closed = state.pts.length >= 3;
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
  }
  function showMeasureSheet() {
    const dict = t();
    const m = pathM(state.pts);
    const title = state.pts.length < 2
      ? (dictStr("measureHint") || "Tap to add, drag a point to move it.")
      : (m >= 1000 ? (m / 1000).toFixed(2) + " km" : Math.round(m) + " m");
    let rows;
    if (state.pts.length < 2) {
      rows = [[dict.measure || "Measure", String(state.pts.length) + " / 2"]];
    } else {
      rows = [["Distance", Math.round(m) + " m"], ["Kilometres", (m / 1000).toFixed(3)]];
      if (state.pts.length >= 3) {
        rows = rows.concat(measureAreaRows(areaM2(state.pts)));
      }
    }
    showSheet({
      title,
      kindLabel: dict.measure || "Measure",
      where: dictStr("measureHint"),
      rows
    });
    syncMeasureActions();
  }
  function addMeasurePt(ll, point) {
    const snapped = snapMeasure(ll, point);
    state.pts.push(snapped.ll);
    state.ptSnap.push(snapped.snap);
    redrawMeasure();
    showMeasureSheet();
  }
  function drawingOn() { return !!state.measure; }
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
    redrawMeasure();
    showMeasureSheet();
  }
  function onPtUp() {
    if (dragI < 0) return;
    dragI = -1;
    try { map.dragPan.enable(); } catch (err) {}
    try { map.getCanvas().style.cursor = state.measure ? "crosshair" : "grab"; } catch (err) {}
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
    map.getCanvas().style.cursor = state.measure ? "crosshair" : "grab";
  });
  function toggleMeasure() {
    const btn = document.getElementById("btn-measure");
    dragI = -1;
    justDragged = false;
    try { map.dragPan.enable(); } catch (e) {}
    if (state.measure) {
      state.measure = false;
      state.pts = [];
      state.ptSnap = [];
      redrawMeasure();
      if (btn) btn.classList.remove("on");
      syncMeasureActions();
      try { map.getCanvas().style.cursor = "grab"; } catch (e) {}
      return;
    }
    state.measure = true;
    state.pts = [];
    state.ptSnap = [];
    redrawMeasure();
    if (btn) btn.classList.add("on");
    syncMeasureActions();
    try { map.getCanvas().style.cursor = "crosshair"; } catch (e) {}
    const dict = t();
    showSheet({
      title: dict.measure || "Measure",
      kindLabel: dict.measure || "Measure",
      where: dictStr("measureHint"),
      rows: []
    });
    syncMeasureActions();
  }

  const btnLocate = document.getElementById("btn-locate");
  if (btnLocate) btnLocate.addEventListener("click", (e) => {
    e.stopPropagation();
    goNear();
  });
  function syncMeasureActions() {
    const measuring = !!state.measure;
    const clr = document.getElementById("btn-measure-clear");
    if (clr) clr.hidden = !measuring;
    const trash = document.getElementById("btn-measure-trash");
    if (trash) trash.hidden = !(measuring && state.pts.length >= 1);
    ["btn-copy", "btn-bank", "btn-wrong"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.hidden = measuring;
    });
  }
  function clearMeasure() {
    state.pts = [];
    state.ptSnap = [];
    dragI = -1;
    justDragged = false;
    try { map.dragPan.enable(); } catch (e) {}
    redrawMeasure();
    if (state.measure) showMeasureSheet();
    syncMeasureActions();
  }
  const btnMeasure = document.getElementById("btn-measure");
  if (btnMeasure) btnMeasure.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMeasure();
  });
  const btnClear = document.getElementById("btn-measure-clear");
  if (btnClear) btnClear.addEventListener("click", (e) => {
    e.stopPropagation();
    clearMeasure();
  });
  const btnTrash = document.getElementById("btn-measure-trash");
  if (btnTrash) btnTrash.addEventListener("click", (e) => {
    e.stopPropagation();
    clearMeasure();
  });

  function focusSearch(e) {
    e.stopPropagation();
    if (e.target.closest("#btn-search-close") || e.target.closest("#suggest")) return;
    qEl.focus();
  }
  searchForm.addEventListener("pointerdown", focusSearch);
  searchForm.addEventListener("touchstart", focusSearch, { passive: true });
  qEl.addEventListener("focus", () => {
    try { map.dragPan.disable(); map.touchZoomRotate.disable(); } catch (e) {}
  });
  qEl.addEventListener("blur", () => {
    try { map.dragPan.enable(); map.touchZoomRotate.enable(); } catch (e) {}
  });
  qEl.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    const v = qEl.value;
    if (!v.trim()) { renderSuggest(nearbySuggestItems()); return; }
    state.searchTimer = setTimeout(() => searchPlaces(v), 280);
  });

  suggest.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li || li.classList.contains("mute")) return;
    if (li.dataset.act === "near") {
      goNear();
      closeSearch();
      return;
    }
    if (li.dataset.i == null) return;
    const item = suggest._items[Number(li.dataset.i)];
    if (!item) return;
    if (item.kind === "plot") pickPlot(item.plot);
    else if (item.kind === "lgd") pickVillage(item.village);
    else if (item.kind === "nom") pickNominatim(item.item);
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(state.searchTimer);
    searchPlaces(qEl.value).then(() => {
      const items = suggest._items;
      if (items && items[0]) {
        if (items[0].kind === "plot") pickPlot(items[0].plot);
        else if (items[0].kind === "lgd") pickVillage(items[0].village);
        else if (items[0].kind === "nom") pickNominatim(items[0].item);
      }
    });
  });

  if (btnSearch) btnSearch.addEventListener("click", (e) => {
    e.stopPropagation();
    openSearch();
  });
  if (btnSearchClose) btnSearchClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSearch();
  });

  document.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);
    if (e.key === "Escape") {
      closeSearch();
      closeLangMenu();
      if (state.measure) toggleMeasure();
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

  document.getElementById("btn-india").addEventListener("click", () => {
    markUserMoved();
    map.flyTo({ center: INDIA.center, zoom: INDIA.zoom, essential: true });
  });

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

  const mapBtn = document.getElementById("ly-map");
  const satBtn = document.getElementById("ly-sat");
  const cmpBtn = document.getElementById("ly-compare");
  if (mapBtn) mapBtn.addEventListener("click", () => setSatellite(false));
  if (satBtn) satBtn.addEventListener("click", () => setSatellite(true));
  if (cmpBtn) cmpBtn.addEventListener("click", () => { setCompare(!state.compare); closeToolsMenu(); });
  const oldBase = document.getElementById("btn-basemap");
  if (oldBase) oldBase.addEventListener("click", () => setSatellite(!state.satellite));

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
  const yearInput = document.getElementById("sat-year");
  if (yearInput) yearInput.addEventListener("input", function () { setSatYear(yearInput.value); });
  const yearWrap = document.getElementById("sat-year-wrap");
  if (yearWrap) {
    yearWrap.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    yearWrap.addEventListener("touchstart", function (e) { e.stopPropagation(); }, { passive: true });
  }

  function setTerrainOn(on) {
    state.terrain = !!on;
    const btn = document.getElementById("ly-terrain");
    if (btn) {
      btn.classList.toggle("on", state.terrain);
      btn.setAttribute("aria-pressed", state.terrain ? "true" : "false");
    }
    if (state.terrain) {
      try { map.setTerrain({ source: "dem", exaggeration: 1.1 }); } catch (e) {}
      try { map.dragRotate.enable(); } catch (e) {}
      try { map.touchPitch.enable(); } catch (e) {}
      try { map.touchZoomRotate.enableRotation(); } catch (e) {}
      map.easeTo({ pitch: 50, duration: 700 });
    } else {
      try { map.setTerrain(null); } catch (e) {}
      try { map.dragRotate.disable(); } catch (e) {}
      try { map.touchPitch.disable(); } catch (e) {}
      try { map.touchZoomRotate.disableRotation(); } catch (e) {}
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }
  const terBtn = document.getElementById("ly-terrain");
  if (terBtn) terBtn.addEventListener("click", function () { setTerrainOn(!state.terrain); closeToolsMenu(); });

  const btnCopy = document.getElementById("btn-copy");
  const btnBank = document.getElementById("btn-bank");
  const btnWrong = document.getElementById("btn-wrong");
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {});
    }
  }
  function factFromSheet(want) {
    const dict = t();
    const label = dict[want] || "";
    let found = "";
    document.querySelectorAll("#sheet-dl div").forEach((row) => {
      const dt = ((row.querySelector("dt") || {}).textContent || "").trim();
      const dd = ((row.querySelector("dd") || {}).textContent || "").trim();
      if (!dt || !dd || dd === "—") return;
      if (label && dt === label) found = dd;
      else if (want === "digipin" && /digipin/i.test(dt)) found = dd;
      else if (want === "surveyNo" && /survey/i.test(dt)) found = dd;
      else if (want === "coords" && /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(dd)) found = dd;
      else if (want === "place" && (dt === dict.place)) found = dd;
    });
    return found;
  }
  function printMapCopy() {
    copyText(location.href);
    window.print();
  }
  function reportWrong() {
    const dict = t();
    const title = ((document.getElementById("sheet-title") || {}).textContent || "").trim();
    const where = ((document.getElementById("sheet-trust") || {}).textContent || "").trim();
    let coords = factFromSheet("coords");
    let digipin = factFromSheet("digipin");
    let survey = factFromSheet("surveyNo");
    let village = factFromSheet("place") || title;
    if (!coords && state.marker) {
      const ll = state.marker.getLngLat();
      coords = ll.lat.toFixed(6) + ", " + ll.lng.toFixed(6);
    }
    if (!digipin && state.marker && window.getDigiPin) {
      const ll = state.marker.getLngLat();
      digipin = window.getDigiPin(ll.lat, ll.lng) || "";
    }
    const lines = [
      "Bhoonaksha — This looks wrong",
      "Time: " + new Date().toISOString(),
      coords ? ("Coordinates: " + coords) : "",
      digipin ? ("DIGIPIN: " + digipin) : "",
      survey ? ("Survey no.: " + survey) : "",
      village ? ("Village: " + village) : "",
      where && where !== village ? ("Place: " + where) : ""
    ].filter(Boolean);
    const text = lines.join("\n");
    copyText(text);
    try {
      const key = "bhoonaksha-wrong";
      let q = [];
      try { q = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { q = []; }
      if (!Array.isArray(q)) q = [];
      q.push({ at: new Date().toISOString(), text: text });
      if (q.length > 50) q = q.slice(-50);
      localStorage.setItem(key, JSON.stringify(q));
    } catch (e) {}
    toast(dict.wrongDone);
  }
  if (btnCopy) btnCopy.addEventListener("click", printMapCopy);
  if (btnBank) btnBank.addEventListener("click", () => toast(t().bankDone));
  if (btnWrong) btnWrong.addEventListener("click", reportWrong);
  const sheetMin = document.getElementById("sheet-min");
  const sheetClose = document.getElementById("sheet-close");
  if (sheetMin) sheetMin.addEventListener("click", (e) => {
    e.stopPropagation();
    const el = document.getElementById("sheet");
    if (!el) return;
    el.classList.toggle("min");
    syncSheetMin();
    saveSheetPos();
  });
  if (sheetClose) sheetClose.addEventListener("click", (e) => { e.stopPropagation(); closeSheet(); });
  wireSheetDrag();
  syncSheetMin();

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
    if (z < SURVEY_MINZOOM) {
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
    if (window.PlotUX) {
      window.PlotUX.setHighlight(map, plot.feat);
      window.PlotUX.flyToFeat(map, plot.feat);
    }
    const ll = plot.lngLat || (window.PlotUX && window.PlotUX.centroidOf(plot.feat.geometry));
    if (ll) {
      inspectPoint({ lng: ll[0], lat: ll[1] }, plot.feat, false);
    } else {
      refreshPlotExtras();
    }
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
  }

  function setPlotFlag(name, on) {
    state[name] = !!on;
    const id = name === "verts" ? "ly-verts" : name === "border" ? "ly-border" : name === "areaTheme" ? "ly-area" : "";
    const btn = id ? document.getElementById(id) : null;
    if (btn) btn.classList.toggle("on", !!on);
    const layersBtn = document.getElementById("btn-layers");
    if (layersBtn) layersBtn.classList.toggle("on", !!(state.verts || state.border || state.areaTheme));
    refreshPlotExtras();
  }

  function closeLayerMenu() {
    const menu = document.getElementById("layer-menu");
    const btn = document.getElementById("btn-layers");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }
  function closeToolsMenu() {
    const menu = document.getElementById("tools-menu");
    const btn = document.getElementById("btn-tools");
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  const lyLabels = document.getElementById("ly-labels");
  if (lyLabels) lyLabels.addEventListener("click", () => setLabels(!state.labels));
  const plotSel = document.getElementById("plot-pick");
  if (plotSel) plotSel.addEventListener("change", () => {
    const plots = plotSel._plots || [];
    const i = Number(plotSel.value);
    if (!Number.isFinite(i) || !plots[i]) return;
    pickPlot(plots[i]);
  });
  const btnLayers = document.getElementById("btn-layers");
  const layerMenu = document.getElementById("layer-menu");
  if (btnLayers && layerMenu) {
    btnLayers.addEventListener("click", (e) => {
      e.stopPropagation();
      closeToolsMenu();
      const open = layerMenu.hidden;
      layerMenu.hidden = !open;
      btnLayers.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  const btnTools = document.getElementById("btn-tools");
  const toolsMenu = document.getElementById("tools-menu");
  if (btnTools && toolsMenu) {
    btnTools.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLayerMenu();
      const open = toolsMenu.hidden;
      toolsMenu.hidden = !open;
      btnTools.setAttribute("aria-expanded", open ? "true" : "false");
    });
    toolsMenu.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-coming]");
      if (!tile) return;
      e.stopPropagation();
      closeToolsMenu();
      toast(t().comingNeedOfficial || "No public data for this yet. Coming when a state opens it.");
    });
  }
  const lyVerts = document.getElementById("ly-verts");
  const lyBorder = document.getElementById("ly-border");
  const lyArea = document.getElementById("ly-area");
  if (lyVerts) lyVerts.addEventListener("click", (e) => { e.stopPropagation(); setPlotFlag("verts", !state.verts); });
  if (lyBorder) lyBorder.addEventListener("click", (e) => { e.stopPropagation(); setPlotFlag("border", !state.border); });
  if (lyArea) lyArea.addEventListener("click", (e) => { e.stopPropagation(); setPlotFlag("areaTheme", !state.areaTheme); });
  document.addEventListener("pointerdown", (e) => {
    if (layerMenu && !layerMenu.hidden && !layerMenu.contains(e.target) && !(btnLayers && btnLayers.contains(e.target))) {
      closeLayerMenu();
    }
    if (toolsMenu && !toolsMenu.hidden && !toolsMenu.contains(e.target) && !(btnTools && btnTools.contains(e.target))) {
      closeToolsMenu();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLayerMenu();
      closeToolsMenu();
    }
  });

  applyLang();
  if (window.Passport && window.Passport.wantDemoAtBoot()) {
    window.Passport.bind();
    window.Passport.showStandalone();
    openSheet();
  }
})();
