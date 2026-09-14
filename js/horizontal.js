// Prototype « défilement horizontal » : arrivé aux chapitres, l'écran se fige et la lecture part
// vers la droite. Chaque chapitre devient une double page qui se déroule en largeur : textes,
// photos et citations en quinconce sur une grille à deux étages, comme la version verticale. La molette,
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

  // Mise en page de chaque chapitre : une double page qui se déroule en largeur, sur une grille de
  // colonnes (unité --u) et deux étages. Comme dans la version verticale, les éléments sont en
  // quinconce : calés en haut, en bas ou au centre, textes et photos alternés.
  //   s : sélecteur (i : rang si plusieurs), c : première colonne, n : nombre de colonnes,
  //   r : "band" (bandeau), "top" (étage haut), "bottom" (étage bas), "full" (les deux),
  //   a : alignement vertical dans la zone ("start", "center", "end")
  const SPREADS = {
    "chapitre-01": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".terrain__left-in > .body", c: 1, n: 6, r: "bottom", a: "start" },
      { s: ".terrain__right > .badge", c: 1, n: 4, r: "bottom", a: "end" },
      { s: ".terrain__left-in > .fig", c: 9, n: 6, r: "full", a: "end" },
      { s: ".terrain__right > .fig", c: 16, n: 5, r: "full", a: "start" },
      { s: ".quote", c: 22, n: 7, r: "full", a: "center" },
    ],
    "chapitre-02": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".fondations__left-in > .body", c: 1, n: 6, r: "bottom", a: "start" },
      { s: ".fondations__left-in > .table", c: 8, n: 5, r: "bottom", a: "end" },
      { s: ".fondations__right > .fig", c: 14, n: 5, r: "full", a: "start" },
      { s: ".plancher__left-in > .fig", c: 20, n: 5, r: "full", a: "end" },
      { s: ".plancher__right > .fig", c: 26, n: 7, r: "full", a: "center" },
    ],
    "chapitre-03": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".versions__list", c: 1, n: 3, r: "bottom", a: "start" },
      { s: ".versions__quote", c: 1, n: 7, r: "bottom", a: "end" },
      { s: ".board", c: 9, n: 12, r: "full", a: "center" },
      { s: ".montage__left-in > .body", c: 22, n: 6, r: "top", a: "start" },
      { s: ".montage__right > .table", c: 22, n: 5, r: "bottom", a: "end" },
      { s: ".montage__right > .plus", c: 27, n: 1, r: "bottom", a: "end" },
      { s: ".ossature__left-in > .fig", c: 29, n: 7, r: "full", a: "end" },
      { s: ".ossature__right > .fig", c: 37, n: 5, r: "full", a: "start" },
    ],
    "chapitre-04": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".isolation__col-in > .body", i: 0, c: 1, n: 6, r: "bottom", a: "start" },
      { s: ".isolation__logo", c: 8, n: 3, r: "top", a: "start" },
      { s: ".isolation__col-in > .body", i: 1, c: 8, n: 5, r: "bottom", a: "end" },
      { s: ".toiture > .toiture__fig", i: 0, c: 14, n: 4, r: "full", a: "start" },
      { s: ".toiture > .toiture__fig", i: 1, c: 19, n: 4, r: "full", a: "end" },
      { s: ".toiture > .toiture__fig", i: 2, c: 24, n: 4, r: "full", a: "start" },
    ],
    "chapitre-05": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".amenagement__text", c: 1, n: 6, r: "bottom", a: "start" },
      { s: ".amenagement__figs", c: 9, n: 6, r: "full", a: "end" },
      { s: ".amenagement__sketch", c: 16, n: 5, r: "full", a: "center" },
    ],
    "chapitre-06": [
      { s: ".ctop", c: 1, n: 7, r: "band" },
      { s: ".ctitle", c: 1, n: 7, r: "top", a: "start" },
      { s: ".resultat-quote", c: 1, n: 7, r: "bottom", a: "start" },
      { s: ".resultat__stats--left", c: 9, n: 3, r: "full", a: "end" },
      { s: ".resultat__video", c: 12, n: 5, r: "full", a: "center" },
      { s: ".resultat__stats--right", c: 17, n: 3, r: "full", a: "start" },
      { s: ".epilogue", c: 21, n: 7, r: "full", a: "center" },
    ],
  };
  const ROWS = { band: "1", top: "2", bottom: "3", full: "2 / 4" };

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
    const placed = [];
    let lastColumn = 1;
    (SPREADS[section.id] || []).forEach(({ s, i = 0, c, n, r, a = "start" }) => {
      const element = section.querySelectorAll(s)[i];
      if (!element) return;
      element.classList.add("hs__item");
      Object.assign(element.style, { gridColumn: `${c} / span ${n}`, gridRow: ROWS[r], alignSelf: r === "band" ? "start" : a });
      placed.push(element);
      lastColumn = Math.max(lastColumn, c + n);
    });
    // filet de sécurité : tout contenu non prévu garde sa place, à la suite du chapitre
    original.forEach((block) => {
      if (block.parentNode !== section || placed.includes(block) || !hasContent(block)) return;
      const leftovers = [...block.querySelectorAll("*")].some((el) => !placed.some((p) => p.contains(el) || el.contains(p)) && el.children.length === 0 && hasContent(el));
      if (!leftovers) return;
      block.classList.add("hs__item");
      Object.assign(block.style, { gridColumn: `${lastColumn + 1} / span 12`, gridRow: ROWS.full, alignSelf: "center" });
      placed.push(block);
      lastColumn += 13;
    });
    section.append(...placed);
    original.forEach((block) => { if (!placed.includes(block) && block.parentNode === section) block.remove(); });
    track.append(section);
  });
  root.classList.add("is-horizontal");

  const panels = [...track.querySelectorAll(".hs__item")];
  const titles = [...track.querySelectorAll(".chapter > .ctitle h2")];
  let travel = 0; // distance horizontale à parcourir
  let wrapTop = 0;

  const layout = () => {
    // unité de colonne proportionnelle à la hauteur disponible : même composition sur tout écran
    const unit = Math.max(90, Math.min(150, (window.innerHeight - 160) / 7));
    track.style.setProperty("--u", `${unit.toFixed(1)}px`);
    // titres : la plus grande taille (96 px au plus) qui tient sur la largeur de leur zone
    panels.forEach((panel) => { panel.style.zoom = "1"; });
    titles.forEach((title) => {
      const width = title.closest(".hs__item").clientWidth;
      let size = 96;
      title.style.fontSize = `${size}px`;
      while (title.scrollWidth > width && size > 48) {
        size -= 2;
        title.style.fontSize = `${size}px`;
      }
    });
    // un élément plus haut que sa zone (un étage ou les deux) est réduit pour y tenir
    const band = track.querySelector(".chapter > .ctop");
    const area = track.querySelector(".chapter").clientHeight - 168 - (band ? band.offsetHeight + 24 : 0);
    panels.forEach((panel) => {
      const row = panel.style.gridRow;
      if (row === "1") return;
      const limit = row === "2 / 4" ? area : (area - 24) / 2;
      const height = panel.getBoundingClientRect().height;
      panel.style.zoom = height > limit ? (limit / height).toFixed(4) : "1";
    });
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
