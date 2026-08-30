(() => {
  /* Official public RoR pages from DoLR (dolr.gov.in citizen-centric services).
     Only .gov.in / .nic.in hosts. No unofficial land APIs. No invented hosts.
     MP omitted: DoLR listed a .com. Puducherry omitted: broken DoLR href.
     Arunachal, Meghalaya, Mizoram, Nagaland: DoLR marks NA. */
  const OFFICIAL = {
    "Andaman and Nicobar Islands": "https://dweepbhoomi.andamannicobar.gov.in/process/html/index.php",
    "Andhra Pradesh": "https://meebhoomi.ap.gov.in/",
    "Assam": "https://ilrms.assam.gov.in/dhar/index.php/Welcome/SelectLOC",
    "Bihar": "https://biharbhumi.bihar.gov.in/Biharbhumi/",
    "Chandigarh": "https://revenue.chd.gov.in/",
    "Chhattisgarh": "https://bhuiyan.cg.nic.in/",
    "Goa": "https://dslr.goa.gov.in/",
    "Gujarat": "https://anyror.gujarat.gov.in/",
    "Haryana": "https://jamabandi.nic.in/defaultpages/default",
    "Himachal Pradesh": "https://himbhoomilmk.nic.in/viewlandrecords.aspx",
    "Jammu and Kashmir": "https://jkrevenue.nic.in/",
    "Jharkhand": "https://jharbhoomi.jharkhand.gov.in/",
    "Karnataka": "https://rdservices.karnataka.gov.in/",
    "Kerala": "https://revenue.kerala.gov.in/",
    "Ladakh": "https://landrecords.ladakh.gov.in/lalr",
    "Lakshadweep": "https://land.utl.gov.in/Process/Login-Page",
    "Maharashtra": "https://mahabhumi.gov.in/mahabhumilink",
    "Manipur": "https://louchapathap.nic.in/egras/frmPayTax.aspx",
    "Delhi": "https://dlrc.delhi.gov.in/Default.aspx",
    "Odisha": "https://bhulekh.ori.nic.in/",
    "Punjab": "https://revenue.punjab.gov.in/",
    "Rajasthan": "https://apnakhata.raj.nic.in/LRCLogin.aspx",
    "Sikkim": "https://ilrms.sikkim.gov.in/",
    "Tamil Nadu": "https://eservices.tn.gov.in/eservicesnew/home.html",
    "Telangana": "https://bhubharati.telangana.gov.in/",
    "Dadra and Nagar Haveli and Daman and Diu": "https://sugam.dddgov.in/",
    "Tripura": "https://jami.tripura.gov.in/site/index_eng.htm",
    "Uttarakhand": "https://bhulekh.uk.gov.in/",
    "Uttar Pradesh": "https://upbhulekh.gov.in/#/home",
    "West Bengal": "https://banglarbhumi.gov.in/BanglarBhumi/Home.action"
  };

  const KHATA_KEYS = ["khata", "Khata", "KHATA", "khata_no", "KHATA_NO", "khatano", "KhataNo", "khata_num", "Khata_No", "khatian", "Khatian"];
  const KISAM_KEYS = ["kisam", "Kisam", "KISAM", "land_class", "LandClass", "landclass", "land_type", "LandType"];
  const HOLDER_KEYS = ["holder", "Holder", "HOLDER", "khatadar", "Khatadar", "KHATADAR", "pattadar", "Pattadar", "occupant", "Occupant"];
  const VILLAGE_KEYS = ["v_name", "village", "Village", "VILLAGE", "vil_name"];
  const DISTRICT_KEYS = ["d_name", "district", "District", "DISTRICT"];
  const TEHSIL_KEYS = ["m_name", "tehsil", "tahasil", "Tahasil", "mandal", "taluk", "Taluk"];

  let last = null;
  let demoOn = false;
  let standalone = false;

  function tr(key, fallback) {
    const d = (window.t && window.t()) || {};
    const en = (window.I18N && window.I18N.en) || {};
    if (typeof d[key] === "string") return d[key];
    if (typeof en[key] === "string") return en[key];
    return fallback || key;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function firstProp(props, keys) {
    if (!props) return "";
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (props[k] != null && String(props[k]).trim()) return String(props[k]).trim();
    }
    return "";
  }

  function formatArea(m2) {
    if (!(m2 > 0)) return "";
    const acre = m2 / 4046.8564224;
    const ha = m2 / 10000;
    const bigha = m2 / 1338;
    const biswa = m2 / 66.9;
    const guntha = m2 / 101.17;
    const sqYd = m2 * 1.19599;
    const sq = Math.round(m2).toLocaleString("en-IN") + " m²";
    const yd = Math.round(sqYd).toLocaleString("en-IN") + " sq yd";
    if (ha >= 1) return ha.toFixed(2) + " ha · " + sq;
    if (bigha >= 0.15) return bigha.toFixed(2) + " bigha · " + biswa.toFixed(1) + " biswa · " + sq;
    if (guntha >= 1) return guntha.toFixed(1) + " guntha · " + yd + " · " + sq;
    if (acre >= 0.05) return acre.toFixed(2) + " acre · " + yd + " · " + sq;
    return sqYd >= 1 ? yd + " · " + sq : sq;
  }

  function els() {
    return {
      dl: document.getElementById("sheet-dl") || document.getElementById("ins-dl"),
      banner: document.getElementById("pass-banner"),
      source: document.getElementById("pass-source"),
      links: document.getElementById("pass-links"),
      ror: document.getElementById("ror-link"),
      mute: document.getElementById("ror-mute"),
      demo: document.getElementById("btn-demo-ror"),
      dir: document.getElementById("dir-link"),
      kicker: document.getElementById("sheet-kicker") || document.getElementById("ins-kicker"),
      title: document.getElementById("sheet-title") || document.getElementById("ins-title"),
      trust: document.getElementById("sheet-trust") || document.getElementById("ins-body")
    };
  }

  function isOdisha(feat, stateName) {
    if (stateName === "Odisha") return true;
    const src = feat && feat.source ? String(feat.source) : "";
    const layer = feat && feat.layer && feat.layer.id ? String(feat.layer.id) : "";
    return src === "survey-od" || /odisha/i.test(src + " " + layer);
  }

  function officialOf(stateName) {
    return (stateName && OFFICIAL[stateName]) || "";
  }

  function wantFamilyStory() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("story") === "family" || q.get("demo") === "family") return true;
    } catch (e) {}
    return false;
  }

  function showFamilyStory(view) {
    if (wantFamilyStory()) return true;
    return !!(view && view.state === "Jharkhand");
  }

  function familyStoryHtml() {
    return (
      '<div class="land-story">' +
        "<dt>" + escapeHtml(tr("familyLand", "Our family's land")) + "</dt>" +
        "<dd>" +
          '<span class="beat">' +
            '<span class="when">' + escapeHtml(tr("then", "Then")) + "</span>" +
            '<span class="val">' + escapeHtml(tr("raiyati", "Raiyati")) + "</span>" +
          "</span>" +
          '<span class="beat now">' +
            '<span class="when">' + escapeHtml(tr("today", "Today")) + "</span>" +
            '<span class="val">' + escapeHtml(tr("gairMazarua", "Gair Mazarua")) + "</span>" +
          "</span>" +
        "</dd>" +
      "</div>"
    );
  }

  function fromFeat(feat, ll) {
    const p = (feat && feat.properties) || {};
    const ux = window.PlotUX;
    const sn = ux ? ux.surveyNumber(p) : "";
    const st = ux ? ux.stateNameFromLayer(feat && feat.layer && feat.layer.id, feat && feat.source) : "";
    let areaM2 = 0;
    if (ux && typeof ux.areaValue === "function") areaM2 = ux.areaValue(p, feat && feat.geometry);
    let lat = null, lon = null;
    if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
      lat = ll.lat; lon = ll.lng;
    } else if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lon)) {
      lat = ll.lat; lon = ll.lon;
    } else if (ux && feat && feat.geometry) {
      const c = ux.centroidOf(feat.geometry);
      if (c) { lon = c[0]; lat = c[1]; }
    }
    const pin = (lat != null && lon != null && window.getDigiPin) ? window.getDigiPin(lat, lon) : "";
    return {
      survey: sn,
      state: st,
      village: firstProp(p, VILLAGE_KEYS),
      district: firstProp(p, DISTRICT_KEYS),
      tehsil: firstProp(p, TEHSIL_KEYS),
      khata: firstProp(p, KHATA_KEYS),
      kisam: firstProp(p, KISAM_KEYS),
      holder: firstProp(p, HOLDER_KEYS),
      ulpin: ux ? ux.ulpinOf(p) : "",
      area: formatArea(areaM2),
      lat: lat,
      lon: lon,
      digipin: pin || "",
      odisha: isOdisha(feat, st),
      official: officialOf(st),
      plot: true
    };
  }

  function applyDemo(model) {
    if (!demoOn) return model;
    const out = Object.assign({}, model);
    if (!out.khata) out.khata = tr("demoKhata", "— demo —");
    if (!out.holder) out.holder = tr("demoHolder", "Example holder");
    if (!out.kisam) out.kisam = tr("demoKisam", "— demo —");
    if (standalone) {
      if (!out.survey) out.survey = tr("demoKhata", "— demo —");
      if (!out.village) out.village = tr("demoVillage", "Example village");
      if (!out.district) out.district = tr("demoDistrict", "Example district");
      if (!out.state) out.state = "Odisha";
      out.odisha = true;
      out.official = OFFICIAL.Odisha;
      out.plot = true;
    }
    return out;
  }

  function rowHtml(label, value) {
    const empty = !value;
    return "<div" + (empty ? " class=\"empty\"" : "") + "><dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(empty ? "—" : value) + "</dd></div>";
  }

  function paint(model) {
    const isNew = !last || last !== model;
    if (isNew && model && !model._standalone) {
      standalone = false;
      demoOn = false;
    }
    last = model;
    const e = els();
    const view = applyDemo(model);
    if (e.kicker && model.plot) e.kicker.textContent = "";
    if (e.title && model.plot) {
      e.title.textContent = view.survey
        ? (tr("surveyNo", "Survey no.") + " " + view.survey)
        : (view.village || tr("point", "This plot"));
    }
    if (e.trust && model.plot) {
      e.trust.textContent = [view.village, view.tehsil, view.district, view.state].filter(Boolean).join(", ");
    }
    if (e.dl) {
      const parts = [];
      parts.push(rowHtml(tr("surveyNo", "Survey no."), view.survey));
      parts.push(rowHtml(tr("place", "Village"), view.village));
      parts.push(rowHtml(tr("district", "District"), view.district));
      parts.push(rowHtml(tr("state", "State"), view.state));
      parts.push(rowHtml(tr("area", "Area"), view.area));
      parts.push(rowHtml(tr("digipin", "DIGIPIN"), view.digipin));
      if (showFamilyStory(view)) parts.push(familyStoryHtml());
      parts.push(rowHtml(tr("khata", "Khata"), view.khata));
      parts.push(rowHtml(tr("holder", "Holder"), view.holder));
      parts.push(rowHtml(tr("kisam", "Kisam"), view.kisam));
      if (view.ulpin) parts.push(rowHtml(tr("ulpin", "ULPIN"), view.ulpin));
      e.dl.innerHTML = parts.join("");
      e.dl.classList.add("passport");
    }
    if (e.source) {
      if (showFamilyStory(view)) {
        e.source.hidden = false;
        e.source.textContent = tr("familyLandNote", "Family account — not a live Record of Rights.");
      } else {
        e.source.hidden = true;
        e.source.textContent = "";
      }
    }
    if (e.banner) {
      if (demoOn) {
        e.banner.hidden = false;
        e.banner.textContent = tr("demoBanner", "Example only. Not a live extract.");
      } else {
        e.banner.hidden = true;
        e.banner.textContent = "";
      }
    }
    if (e.links) e.links.hidden = false;
    if (e.dir) {
      if (view.lat != null && view.lon != null && Number.isFinite(view.lat) && Number.isFinite(view.lon)) {
        e.dir.hidden = false;
        e.dir.href = "https://www.google.com/maps/dir/?api=1&destination=" + view.lat + "," + view.lon;
        e.dir.textContent = tr("directions", "Directions");
      } else {
        e.dir.hidden = true;
        e.dir.removeAttribute("href");
      }
    }
    if (e.ror) {
      if (view.official) {
        e.ror.hidden = false;
        e.ror.href = view.official;
        e.ror.textContent = tr("officialRor", "Official RoR");
        e.ror.target = "_blank";
        e.ror.rel = "noopener noreferrer";
      } else {
        e.ror.hidden = true;
        e.ror.removeAttribute("href");
      }
    }
    if (e.mute) {
      e.mute.hidden = true;
      e.mute.textContent = "";
    }
    if (e.demo) {
      e.demo.hidden = !(view.odisha || standalone);
      e.demo.textContent = demoOn ? tr("hideExample", "Hide example") : tr("showExample", "Show example record");
    }
  }

  function hideChrome() {
    const e = els();
    if (e.dl) e.dl.classList.remove("passport");
    if (e.banner) { e.banner.hidden = true; e.banner.textContent = ""; }
    if (e.source) { e.source.hidden = true; e.source.textContent = ""; }
    if (e.links) e.links.hidden = true;
    if (e.dir) { e.dir.hidden = true; e.dir.removeAttribute("href"); }
    if (e.ror) { e.ror.hidden = true; e.ror.removeAttribute("href"); }
    if (e.mute) e.mute.hidden = true;
    if (e.demo) e.demo.hidden = true;
  }

  function clear() {
    last = null;
    standalone = false;
    demoOn = false;
    hideChrome();
  }

  function refresh() {
    if (last) paint(last);
  }

  function toggleDemo() {
    if (!last) {
      showStandalone();
      return;
    }
    if (standalone && demoOn) {
      demoOn = false;
      standalone = false;
      last = null;
      hideChrome();
      return;
    }
    demoOn = !demoOn;
    paint(last);
  }

  function showStandalone() {
    demoOn = true;
    standalone = true;
    const model = {
      survey: "",
      state: "Odisha",
      village: "",
      district: "",
      tehsil: "",
      khata: "",
      kisam: "",
      holder: "",
      ulpin: "",
      area: "",
      digipin: "",
      odisha: true,
      official: OFFICIAL.Odisha,
      plot: true,
      _standalone: true
    };
    paint(model);
    const sheet = document.getElementById("sheet");
    const ins = document.getElementById("inspector");
    if (sheet) sheet.hidden = false;
    if (ins) ins.hidden = false;
  }

  function wantDemoAtBoot() {
    try { return new URLSearchParams(location.search).get("demo") === "ror"; }
    catch (e) { return false; }
  }

  function bind() {
    const e = els();
    if (e.demo && !e.demo._passBound) {
      e.demo._passBound = 1;
      e.demo.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleDemo();
      });
    }
  }

  window.Passport = {
    OFFICIAL: OFFICIAL,
    fromFeat: fromFeat,
    paint: paint,
    clear: clear,
    refresh: refresh,
    showStandalone: showStandalone,
    wantDemoAtBoot: wantDemoAtBoot,
    bind: bind,
    isOdisha: isOdisha
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
