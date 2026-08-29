(() => {
  const OSM_ID = { od: "or" };
  const DEVANAGARI = { hi: 1, mr: 1, ne: 1, sa: 1, mai: 1, bho: 1, doi: 1, kok: 1 };
  const RARE = { sat: 1, brx: 1, mni: 1, doi: 1 };
  const PGF_STARTS = [
    63488, 63232, 62976, 62720, 62464, 62208, 61952, 61696, 61440, 61184,
    60928, 60672, 60416, 60160, 59904, 59648, 59392, 59136, 58880, 58624,
    58368, 58112, 57856, 57600, 3072, 2816, 2560, 2304, 10240, 10752
  ];
  const PGF_BASE = "https://wipfli.github.io/pgf-glyph-ranges/font/NotoSansMultiscript-Regular-v1/";
  const COMPLEX_TEXT = "https://wipfli.github.io/maplibre-gl-complex-text/dist/maplibre-gl-complex-text.js";
  const OFM_STYLE = "https://tiles.openfreemap.org/styles/liberty";
  const OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
  const OFM_SPRITE = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";
  const SKIP_LAYERS = { building: 1, "building-3d": 1 };

  const ofm = { ready: false, attaching: false, fillIds: [], labelIds: [], labels: true };

  function osmLangCode(id) {
    if (!id) return "en";
    return OSM_ID[id] || id;
  }

  function nameTextField(langId) {
    const code = osmLangCode(langId);
    const parts = ["coalesce"];
    if (code === "en") {
      parts.push(["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]);
      return parts;
    }
    parts.push(["get", "name:" + code]);
    if ((DEVANAGARI[langId] || DEVANAGARI[code] || RARE[langId] || RARE[code]) && code !== "hi") {
      parts.push(["get", "name:hi"]);
    }
    parts.push(["get", "name"], ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"]);
    return parts;
  }

  function fieldMentionsName(tf) {
    if (tf == null) return false;
    function walk(node) {
      if (!node) return false;
      if (Array.isArray(node)) {
        if (node[0] === "get" && typeof node[1] === "string") {
          const k = node[1];
          if (k === "name" || k === "name_en" || k.indexOf("name:") === 0) return true;
        }
        for (let i = 0; i < node.length; i++) if (walk(node[i])) return true;
      }
      return false;
    }
    return walk(tf);
  }

  function applyMapLanguage(map, langId) {
    if (!map) return;
    try {
      if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) return;
    } catch (e) {
      return;
    }
    let style;
    try { style = map.getStyle(); } catch (e) { return; }
    if (!style || !style.layers) return;
    const expr = nameTextField(langId);
    for (let i = 0; i < style.layers.length; i++) {
      const layer = style.layers[i];
      if (!layer || layer.type !== "symbol") continue;
      if (layer.id && (/-num$/.test(layer.id) || layer.id === "plot-edges")) continue;
      const tf = layer.layout && layer.layout["text-field"];
      if (!fieldMentionsName(tf)) continue;
      try { map.setLayoutProperty(layer.id, "text-field", expr); } catch (err) {}
    }
  }

  function applyStreetVisibility(map, satellite, labels, compare) {
    if (!map) return;
    if (labels == null) labels = ofm.labels !== false;
    else ofm.labels = !!labels;
    const hideStreet = !!satellite && !compare;
    let i, id;
    if (ofm.ready) {
      for (i = 0; i < ofm.fillIds.length; i++) {
        id = ofm.fillIds[i];
        if (map.getLayer(id)) {
          try { map.setLayoutProperty(id, "visibility", hideStreet ? "none" : "visible"); } catch (e) {}
        }
      }
      for (i = 0; i < ofm.labelIds.length; i++) {
        id = ofm.labelIds[i];
        if (map.getLayer(id)) {
          try { map.setLayoutProperty(id, "visibility", labels ? "visible" : "none"); } catch (e) {}
        }
      }
      if (map.getLayer("osm")) {
        try { map.setLayoutProperty("osm", "visibility", "none"); } catch (e) {}
      }
    } else if (map.getLayer("osm")) {
      try { map.setLayoutProperty("osm", "visibility", hideStreet ? "none" : "visible"); } catch (e) {}
    }
  }

  function stripAttrib(src) {
    const copy = JSON.parse(JSON.stringify(src));
    delete copy.attribution;
    return copy;
  }

  function installComplexText() {
    if (!window.maplibregl || !window.maplibregl.setRTLTextPlugin) return;
    try {
      const st = window.maplibregl.getRTLTextPluginStatus && window.maplibregl.getRTLTextPluginStatus();
      if (st && st !== "unavailable") return;
    } catch (e) {}
    try {
      window.maplibregl.setRTLTextPlugin(COMPLEX_TEXT, false);
    } catch (e) {}
  }

  function mapLangTransformRequest(url, resourceType) {
    if (resourceType === "Glyphs") {
      const match = String(url || "").match(/(\d+)-(\d+)\.pbf$/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        if (PGF_STARTS.indexOf(start) >= 0) {
          return { url: PGF_BASE + start + "-" + end + ".pbf" };
        }
      }
    }
    return undefined;
  }

  function prepareMapLangStyle(style) {
    if (!style) return style;
    style.glyphs = OFM_GLYPHS;
    style.sprite = OFM_SPRITE;
    return style;
  }

  function attachOpenFreeMap(map, opts) {
    opts = opts || {};
    if (!map || ofm.ready || ofm.attaching) return Promise.resolve(ofm.ready);
    ofm.attaching = true;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(OFM_STYLE, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error("ofm");
        return res.json();
      })
      .then(function (liberty) {
        if (!liberty || !liberty.sources || !liberty.layers) throw new Error("ofm-style");
        if (liberty.sources.ne2_shaded && !map.getSource("ne2_shaded")) {
          map.addSource("ne2_shaded", stripAttrib(liberty.sources.ne2_shaded));
        }
        if (liberty.sources.openmaptiles && !map.getSource("openmaptiles")) {
          map.addSource("openmaptiles", stripAttrib(liberty.sources.openmaptiles));
        }
        const beforeFill = map.getLayer("osm") ? "osm" : (map.getLayer("sat") ? "sat" : undefined);
        ofm.fillIds = [];
        ofm.labelIds = [];
        for (let i = 0; i < liberty.layers.length; i++) {
          const raw = liberty.layers[i];
          if (!raw || !raw.id || SKIP_LAYERS[raw.id]) continue;
          const layer = JSON.parse(JSON.stringify(raw));
          layer.id = "ofm-" + raw.id;
          if (map.getLayer(layer.id)) continue;
          try {
            if (layer.type === "symbol") {
              map.addLayer(layer);
              ofm.labelIds.push(layer.id);
            } else {
              map.addLayer(layer, beforeFill);
              ofm.fillIds.push(layer.id);
            }
          } catch (err) {}
        }
        ofm.ready = ofm.fillIds.length + ofm.labelIds.length > 0;
        const langId = opts.getLang ? opts.getLang() : (window.getLang ? window.getLang() : "en");
        const sat = opts.getSatellite ? !!opts.getSatellite() : false;
        const labels = opts.getLabels ? !!opts.getLabels() : (ofm.labels !== false);
        const compare = opts.getCompare ? !!opts.getCompare() : false;
        if (ofm.ready) {
          applyMapLanguage(map, langId);
          applyStreetVisibility(map, sat, labels, compare);
        }
        return ofm.ready;
      })
      .catch(function () {
        ofm.ready = false;
        return false;
      })
      .then(function (ok) {
        clearTimeout(timer);
        ofm.attaching = false;
        return ok;
      });
  }

  installComplexText();

  window.osmLangCode = osmLangCode;
  window.nameTextField = nameTextField;
  window.applyMapLanguage = applyMapLanguage;
  window.applyStreetVisibility = applyStreetVisibility;
  window.attachOpenFreeMap = attachOpenFreeMap;
  window.prepareMapLangStyle = prepareMapLangStyle;
  window.mapLangTransformRequest = mapLangTransformRequest;
  window.MAP_LANG_GLYPHS = OFM_GLYPHS;
  window.MAP_LANG_SPRITE = OFM_SPRITE;
})();
