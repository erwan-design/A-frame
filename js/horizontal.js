// Prototype « défilement horizontal » : arrivé aux chapitres, l'écran se fige et la lecture part
// vers la droite. Chaque chapitre est une page composée dans Figma (positions reprises dans PAGES),
// mise à l'échelle de la hauteur de l'écran. La molette,
// le trackpad (dans les deux sens) et les flèches ← → font avancer ; après le chapitre 06, la
// page reprend verticalement (journal, pied de page).
// Réservé aux écrans d'au moins 1440 × 720 (mise en page ordinateur : aucun panneau réduit sous
// ~78 %) ; en dessous, les colonnes s'empilent et le texte deviendrait trop petit : lecture verticale.
//
// window.__hs : { open(élément) → vrai si l'élément appartient à un chapitre, state() }

(() => {
  const root = document.documentElement;
  const sections = [...document.querySelectorAll("section.chapter")];
  if (!sections.length || !matchMedia("(min-width: 1440px) and (min-height: 720px)").matches) return;

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
      { s: ".ctitle", x: 101, y: 144, w: 610 },
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
      element.classList.add("hs__abs");
      Object.assign(element.style, { left: `${item.x}px`, top: `${item.y}px` });
      if (item.c) element.classList.add(item.c);
      if (item.w) element.style.width = `${item.w}px`;
      if (item.h) element.style.height = `${item.h}px`;
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

  const layout = () => {
    // chaque page de 900 px est mise à l'échelle de la hauteur de l'écran
    track.style.setProperty("--s", (window.innerHeight / 900).toFixed(4));
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
