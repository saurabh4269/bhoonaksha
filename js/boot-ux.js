(() => {
  const html = document.documentElement;
  html.classList.add("booting");

  function reveal() {
    html.classList.remove("booting");
    html.classList.add("ready");
  }

  window.revealMap = reveal;

  /* Hashed refresh (after tapping a parcel) used to skip the camera
     timeout and leave html.booting with #map { opacity: 0 }. Always
     reveal — even if map.load throws or never fires. */
  window.setTimeout(reveal, 700);
  window.setTimeout(reveal, 2200);
  window.addEventListener("error", reveal);
  window.addEventListener("unhandledrejection", reveal);

  function go(href) {
    html.classList.add("leaving");
    window.setTimeout(function () { location.href = href; }, 240);
  }
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("a.chip[href], a[data-i18n='desk'], a[data-i18n='citizenMap']");
    if (!a) return;
    const raw = a.getAttribute("href") || "";
    if (!/^(index|lekpal)\.html/.test(raw.split("?")[0].split("#")[0])) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    e.preventDefault();
    const path = raw.split("?")[0].split("#")[0];
    go(path + location.search + location.hash);
  });
})();
