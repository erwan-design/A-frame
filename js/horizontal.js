// Prototype « défilement horizontal » : arrivé aux chapitres, l'écran se fige et la lecture part
// vers la droite. Chaque chapitre est une page composée dans Figma (positions reprises dans PAGES),
// mise à l'échelle de la hauteur de l'écran. La molette,
// le trackpad (dans les deux sens) et les flèches ← → font avancer ; après le chapitre 06, la
// page reprend verticalement (journal, pied de page).
// Réservé aux écrans d'au moins 1280 × 780 (MacBook 13" compris) : les textes gardent partout les
// tailles du reste du site ; sous 900 px de haut, les blocs sont resserrés pour ne pas se chevaucher.
//
// window.__hs : { open(élément) → vrai si l'élément appartient à un chapitre, state() }

(() => {
  const root = document.documentElement;
  const sections = [...document.querySelectorAll("section.chapter")];
  if (!sections.length || !matchMedia("(min-width: 1280px) and (min-height: 780px)").matches) return;

  // Mise en page de chaque chapitre, reprise du fichier Figma « Tests » (page Test 04) : une page de
  // 900 px de haut où chaque bloc a sa position ; la page est mise à l'échelle de la hauteur de
  // l'écran (zoom = hauteur / 900). Grille : colonne 1 à 100 px, colonne 8 à 840, 14 à 1474…
  //   s : sélecteur (i : rang si plusieurs), x / y : position, w : largeur, h : hauteur du bloc,
  //   m : hauteur du cadre photo, c : classe en plus ; width : largeur de la page (dernier bloc + marge)
  const PAGES = {
    "chapitre-01": { width: 2119, items: [
      { s: ".ctop", x: 100, y: 60, w: 610 },
      { s: ".ctitle", x: 100, y: 144, w: 610 },
      { s: ".terrain__left-in > .body", x: 100, y: 252, w: 505 },
      { s: ".terrain__right > .badge", x: 100, y: 588 },
      { s: ".terrain__right > .fig", x: 840, y: 60, w: 399, m: 443 },
      { s: ".quote", x: 1368, y: 60, w: 611 },
      { s: ".terrain__left-in > .fig", x: 1368, y: 365, w: 610, m: 432 },
    ] },
    "chapitre-02": { width: 2119, items: [
      { s: ".ctop", x: 101, y: 64, w: 610 },
      { s: ".ctitle", x: 101, y: 144, w: 609, c: "ctitle--inline" },
      { s: ".fondations__left-in > .body", x: 101, y: 252, w: 505 },
      { s: ".fondations__left-in > .table", x: 101, y: 520, w: 503 },
      { s: ".fondations__right > .fig", x: 840, y: 64, w: 399, m: 587 },
      { s: ".plancher__left-in > .fig", x: 1368, y: 100, w: 399, m: 293 },
      { s: ".plancher__right > .fig", x: 1474, y: 581, w: 505, m: 215 },
    ] },
    "chapitre-03": { width: 2753, items: [
      { s: ".ctop", x: 101, y: 64, w: 610 },
      { s: ".ctitle", x: 101, y: 144, w: 610, c: "ctitle--inline" },
      { s: ".montage__left-in > .body", x: 101, y: 252, w: 505 },
      { s: ".versions__list", x: 101, y: 705 },
      { s: ".board", x: 840, y: 60, w: 610, h: 780 },
      { s: ".montage__right > .table", x: 1581, y: 202, w: 399 },
      { s: ".versions__quote", x: 1581, y: 474, w: 399 },
      { s: ".ossature__left-in > .fig", x: 2109, y: 64, w: 504, m: 306 },
      { s: ".ossature__right > .fig", x: 2109, y: 506, w: 399, m: 272 },
    ] },
    "chapitre-04": { width: 1907, items: [
      { s: ".ctop", x: 101, y: 64, w: 610 },
      { s: ".ctitle", x: 101, y: 144, w: 610 },
      { s: ".isolation__col-in > .body", i: 0, x: 101, y: 252, w: 610 },
      { s: ".isolation__col-in > .body", i: 1, x: 101, y: 475, w: 610 }, // Figma : 449 ; +26 car le texte précédent fait une ligne de plus avec la vraie police
      { s: ".isolation__logo", x: 101, y: 687, w: 293, h: 153 },
      { s: ".toiture > .toiture__fig", i: 0, x: 840, y: 124, w: 505, m: 590 },
      { s: ".toiture > .toiture__fig", i: 1, x: 1474, y: 60, w: 293, m: 267 },
      { s: ".toiture > .toiture__fig", i: 2, x: 1474, y: 488, w: 293, m: 267 },
    ] },
    "chapitre-05": { width: 2118, items: [
      { s: ".ctop", x: 101, y: 64, w: 610 },
      { s: ".ctitle", x: 101, y: 144, w: 610 },
      { s: ".amenagement__text", x: 101, y: 294, w: 505 },
      { s: ".amenagement__fig", i: 1, x: 946, y: 64, w: 398, m: 262 },
      { s: ".amenagement__fig", i: 0, x: 840, y: 503, w: 398, m: 272 },
      { s: ".amenagement__sketch", x: 1474, y: 144, w: 504, h: 652 },
    ] },
    "chapitre-06": { width: 2224, items: [
      { s: ".ctop", x: 101, y: 64, w: 610 },
      { s: ".ctitle", x: 101, y: 144, w: 610 },
      { s: ".resultat__stats--left", x: 101, y: 303, w: 253 },
      { s: ".resultat__stats--right", x: 457, y: 303, w: 253 },
      { s: ".resultat-quote", x: 101, y: 616, w: 606 },
      { s: ".resultat__video", x: 840, y: 144, w: 504, h: 652 },
      { s: ".epilogue", x: 1474, y: 263, w: 610 },
    ] },
  };

  // structure : .hs (hauteur = longueur du trajet) > .hs__stage (collant, plein écran) > .hs__track
  const wrap = document.createElement("div");
  wrap.className = "hs";
  const stage = document.createElement("div");
  stage.className = "hs__stage";
  const track = document.createElement("div");
  track.className = "hs__track";
  stage.append(track);
  wrap.append(stage);
  sections[0].before(wrap);

  // textes courants (taille fixe) et textes d'affichage (titres, citations : grandissent un peu)
  const TEXT = ".ctop, .body, .amenagement__text, .table, .badge, .versions__list, .resultat__stats, .epilogue";
  const DISPLAY = ".ctitle, .quote, .versions__quote, .resultat-quote";

  const hasContent = (element) =>
    (element.textContent || "").trim() !== "" || element.querySelector("img, video, svg, canvas, picture");

  sections.forEach((section) => {
    const original = [...section.children];
    const page = PAGES[section.id] || { width: 1440, items: [] };
    let width = page.width;
    // on repère tous les éléments avant d'en déplacer un seul : les rangs (i) restent justes
    const plan = page.items.map((item) => ({ item, element: section.querySelectorAll(item.s)[item.i || 0] }));
    const placed = [];
    plan.forEach(({ item, element }) => {
      if (!element) return;
      if (item.c) element.classList.add(item.c);
      // blocs de texte : un emplacement suit la mise en page, le texte garde sa taille (voir layout)
      const kind = element.matches(TEXT) ? "hs__text" : element.matches(DISPLAY) ? "hs__display" : null;
      let box = element;
      if (kind) {
        box = document.createElement("div");
        box.className = "hs__slot";
        element.classList.add(kind);
        box.append(element);
      }
      box.classList.add("hs__abs");
      box.dataset.y = item.y;
      Object.assign(box.style, { left: `${item.x}px`, top: `${item.y}px` });
      if (item.w) box.style.width = `${item.w}px`;
      if (item.h) box.style.height = `${item.h}px`;
      element = box;
      if (item.m) {
        const media = element.querySelector(".fig__media");
        if (media) media.style.height = `${item.m}px`;
      }
      placed.push(element);
    });
    // filet de sécurité : tout contenu non prévu est ajouté à droite de la page
    original.forEach((block) => {
      if (placed.includes(block) || !hasContent(block)) return;
      const leftovers = [...block.querySelectorAll("*")].some((el) => !placed.some((p) => p.contains(el) || el.contains(p)) && el.children.length === 0 && hasContent(el));
      if (!leftovers) return;
      block.classList.add("hs__abs");
      Object.assign(block.style, { left: `${width}px`, top: "144px", width: "1240px" });
      placed.push(block);
      width += 1380;
    });
    section.style.width = `${width}px`;
    section.append(...placed);
    original.forEach((block) => { if (!placed.includes(block) && block.parentNode === section) block.remove(); });
    track.append(section);
  });
  root.classList.add("is-horizontal");

  let travel = 0; // distance horizontale à parcourir
  let wrapTop = 0;

  // Écrans moins hauts que 900 px : la page rétrécit mais les textes gardent leur taille, un bloc de
  // texte peut donc déborder sur celui du dessous. Chaque bloc qui en chevaucherait un autre (ou s'en
  // approcherait à moins de GAP) est descendu juste en dessous. Sur 900 px et plus, rien ne bouge.
  // Mesures en unités de la page (offsetTop / offsetHeight), indépendantes des animations.
  const GAP = 16;
  const BOTTOM = 880; // limite basse de la page (sur 900)
  const settle = () => {
    sections.forEach((section) => {
      const items = [...section.querySelectorAll(":scope > .hs__abs")];
      items.forEach((el) => {
        if (el.dataset.y) el.style.top = `${el.dataset.y}px`;
        el.style.scale = "";
      });
      const boxes = items
        .map((el) => ({ el, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth, top: el.offsetTop, height: el.offsetHeight }))
        .sort((a, b) => a.top - b.top);
      const done = [];
      boxes.forEach((box) => {
        let top = box.top;
        let moved = true;
        while (moved) {
          moved = false;
          for (const other of done) {
            const sideBySide = Math.min(box.right, other.right) - Math.max(box.left, other.left) > 2;
            if (sideBySide && top < other.bottom + GAP && top + box.height > other.top && other.bottom + GAP > top) {
              if (top < other.bottom + GAP && box.top >= other.top) {
                top = other.bottom + GAP;
                moved = true;
              }
            }
          }
        }
        if (top !== box.top) box.el.style.top = `${top}px`;
        // une image poussée sous le bas de la page est réduite juste assez pour y tenir
        let height = box.height;
        if (top + height > BOTTOM && !box.el.classList.contains("hs__slot")) {
          const scale = Math.max(0.5, (BOTTOM - top) / height);
          box.el.style.transformOrigin = "top left";
          box.el.style.scale = scale.toFixed(3);
          height *= scale;
        }
        done.push({ left: box.left, right: box.right, top, bottom: top + height });
      });
    });
  };

  const layout = () => {
    // chaque page de 900 px est mise à l'échelle de la hauteur de l'écran
    const s = window.innerHeight / 900;
    track.style.setProperty("--s", s.toFixed(4));
    // les photos et les positions suivent la hauteur de l'écran ; les textes gardent les tailles du
    // reste du site (zoom inverse)
    const text = (1 / s).toFixed(4);
    track.style.setProperty("--tz", text);
    track.style.setProperty("--dz", text);
    settle();
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    wrap.style.height = `${travel + window.innerHeight}px`;
    wrapTop = wrap.getBoundingClientRect().top + window.scrollY;
    update();
  };

  const offset = () => Math.max(0, Math.min(travel, window.scrollY - wrapTop));
  const update = () => {
    scheduled = false;
    track.style.transform = `translate3d(${-offset().toFixed(1)}px, 0, 0)`;
  };
  let scheduled = false;
  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", layout);
  document.fonts?.ready.then(layout);
  addEventListener("load", layout);

  const pinned = () => {
    const box = wrap.getBoundingClientRect();
    return box.top <= 1 && box.bottom >= window.innerHeight - 1;
  };
  const scrollToY = (y, smooth = true) => {
    if (window.__lenis) window.__lenis.scrollTo(y, smooth ? { duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4) } : { immediate: true });
    else window.scrollTo({ top: y, behavior: smooth ? "smooth" : "instant" });
  };

  // trackpad sans défilement lissé (animations réduites) : le glissement horizontal fait avancer
  addEventListener("wheel", (event) => {
    if (window.__lenis || !pinned() || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    window.scrollBy(0, event.deltaX);
  }, { passive: false });

  // flèches ← → : un écran vers la droite ou la gauche
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
    if (event.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]") || !pinned()) return;
    event.preventDefault();
    const target = window.__lenis ? window.__lenis.targetScroll : window.scrollY;
    scrollToY(target + (event.key === "ArrowRight" ? 1 : -1) * window.innerWidth * 0.8);
  });

  window.__hs = {
    open(element) {
      const section = element && element.closest ? element.closest("section.chapter") : null;
      if (!section || !track.contains(section)) return false;
      const x = section.getBoundingClientRect().left - track.getBoundingClientRect().left;
      scrollToY(wrapTop + Math.min(travel, x));
      return true;
    },
    state() {
      const box = wrap.getBoundingClientRect();
      const viewport = window.innerHeight;
      let index = 0;
      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().left < window.innerWidth * 0.5) index = i;
      });
      return { active: box.top < viewport * 0.4 && box.bottom > viewport * 0.6, index, progress: travel ? offset() / travel : 0 };
    },
  };

  layout();
})();
