(() => {
  /* One-map street/sat curtain. Clips only listed raster ids (sat).
     No second map instance. No layer panel. */

  function clipRect(gl, pos) {
    const bufW = gl.drawingBufferWidth;
    const bufH = gl.drawingBufferHeight;
    const cssW = (gl.canvas && gl.canvas.clientWidth) || bufW;
    const scale = cssW ? bufW / cssW : 1;
    const x0 = Math.round(pos * cssW * scale);
    return { x0: x0, y0: 0, w: Math.max(0, bufW - x0), h: bufH };
  }

  function wrapScissor(gl, pos) {
    const orig = gl.scissor.bind(gl);
    const r = clipRect(gl, pos);
    const wasOn = gl.isEnabled(gl.SCISSOR_TEST);
    let prev = null;
    try { prev = gl.getParameter(gl.SCISSOR_BOX); } catch (e) {}
    function intersect(x, y, w, h) {
      const x0 = Math.max(x, r.x0);
      const y0 = Math.max(y, r.y0);
      const x1 = Math.min(x + w, r.x0 + r.w);
      const y1 = Math.min(y + h, r.y0 + r.h);
      orig(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    }
    gl.scissor = function (x, y, w, h) { intersect(x, y, w, h); };
    gl.enable(gl.SCISSOR_TEST);
    intersect(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    return function () {
      gl.scissor = orig;
      if (prev && prev.length >= 4) orig(prev[0], prev[1], prev[2], prev[3]);
      if (!wasOn) gl.disable(gl.SCISSOR_TEST);
    };
  }

  function clippedSet(map, extra) {
    const ids = { sat: 1 };
    if (map.getLayer("sat-labels")) ids["sat-labels"] = 1;
    if (map.getLayer("sat-wayback")) ids["sat-wayback"] = 1;
    (extra || []).forEach(function (id) { if (id) ids[id] = 1; });
    return ids;
  }

  function layerIdFromArgs(args, map) {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a || typeof a.id !== "string") continue;
      try {
        if (map.getLayer(a.id) === a || (a.type && map.getLayer(a.id))) return a.id;
      } catch (e) {}
    }
    return "";
  }

  function hookPainter(map, isOn, getPos, isClipped) {
    const painter = map.painter;
    if (!painter || typeof painter.renderLayer !== "function") return false;
    if (painter._bnSwipe) return true;
    const orig = painter.renderLayer;
    painter._bnSwipe = true;
    painter.renderLayer = function () {
      const id = layerIdFromArgs(arguments, map);
      const gl = painter.context && painter.context.gl;
      let restore;
      if (isOn() && id && isClipped(id) && gl) restore = wrapScissor(gl, getPos());
      try { return orig.apply(this, arguments); }
      finally { if (restore) restore(); }
    };
    return true;
  }

  function ensureHandle() {
    let el = document.getElementById("compare-handle");
    if (el) return el;
    el = document.createElement("div");
    el.id = "compare-handle";
    el.hidden = true;
    el.setAttribute("role", "slider");
    el.setAttribute("aria-orientation", "horizontal");
    el.setAttribute("aria-valuemin", "0");
    el.setAttribute("aria-valuemax", "100");
    el.setAttribute("aria-valuenow", "50");
    el.innerHTML = '<div class="compare-line"></div><div class="compare-grab" aria-hidden="true"><span>‹</span><span>›</span></div>';
    document.body.appendChild(el);
    return el;
  }

  function create(map, opts) {
    opts = opts || {};
    if (!map) return null;
    let pos = opts.position == null ? 0.5 : Number(opts.position);
    if (!Number.isFinite(pos)) pos = 0.5;
    pos = Math.max(0.04, Math.min(0.96, pos));
    let active = false;
    const extra = opts.layers || [];
    const handle = ensureHandle();

    function ids() { return clippedSet(map, extra); }
    function isClipped(id) { return !!ids()[id]; }

    let hooked = false;
    let bookendRestore = null;
    function tryHook() {
      if (hooked) return;
      hooked = hookPainter(map, function () { return active; }, function () { return pos; }, isClipped);
    }
    tryHook();

    const clipOn = {
      id: "sat-clip-on",
      type: "custom",
      renderingMode: "2d",
      render: function (gl) {
        if (!active || hooked) return;
        bookendRestore = wrapScissor(gl, pos);
      }
    };
    const clipOff = {
      id: "sat-clip-off",
      type: "custom",
      renderingMode: "2d",
      render: function () {
        if (bookendRestore) { bookendRestore(); bookendRestore = null; }
      }
    };

    function installBookends() {
      if (!map.getLayer("sat")) return;
      try {
        if (!map.getLayer("sat-clip-on")) map.addLayer(clipOn, "sat");
        if (!map.getLayer("sat-clip-off")) {
          const layers = (map.getStyle() || {}).layers || [];
          let after = null;
          for (let i = 0; i < layers.length; i++) {
            if (layers[i].id === "sat") { after = layers[i + 1] ? layers[i + 1].id : null; break; }
          }
          if (after) map.addLayer(clipOff, after);
          else map.addLayer(clipOff);
        }
      } catch (e) {}
    }

    function placeHandle() {
      handle.style.left = (pos * 100) + "%";
      handle.setAttribute("aria-valuenow", String(Math.round(pos * 100)));
    }

    function setPosition(t) {
      t = Number(t);
      if (!Number.isFinite(t)) return pos;
      pos = Math.max(0.04, Math.min(0.96, t));
      placeHandle();
      if (active && map.triggerRepaint) map.triggerRepaint();
      return pos;
    }

    function setActive(on) {
      active = !!on;
      handle.hidden = !active;
      if (active) {
        installBookends();
        placeHandle();
        if (map.triggerRepaint) map.triggerRepaint();
      } else if (map.triggerRepaint) {
        map.triggerRepaint();
      }
      return active;
    }

    let dragging = false;
    function fromEvent(e) {
      const box = map.getContainer().getBoundingClientRect();
      if (!box.width) return pos;
      return (e.clientX - box.left) / box.width;
    }
    function onDown(e) {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      try { (e.target || handle).setPointerCapture(e.pointerId); } catch (err) {}
      setPosition(fromEvent(e));
    }
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      setPosition(fromEvent(e));
    }
    function onUp() { dragging = false; }
    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
    handle.addEventListener("lostpointercapture", onUp);

    map.on("load", function () { tryHook(); installBookends(); });
    map.on("styledata", function () { tryHook(); if (active) installBookends(); });
    try { if (map.isStyleLoaded && map.isStyleLoaded()) installBookends(); } catch (e) {}

    placeHandle();
    handle.hidden = true;

    return {
      setActive: setActive,
      isActive: function () { return active; },
      setPosition: setPosition,
      getPosition: function () { return pos; },
      layers: function () { return Object.keys(ids()); }
    };
  }

  window.MapSwipe = { create: create };
})();
