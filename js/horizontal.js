// Prototype « défilement horizontal » : arrivé aux chapitres, l'écran se fige et la lecture part
// vers la droite. Chaque chapitre devient une double page qui se déroule en largeur : titre et
// texte en colonne, photos par deux avec un léger décalage, comme la version verticale. La molette,
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
  // colonnes (unité --u). Comme dans la version verticale : titre, texte et données forment une
  // colonne continue ; les photos vont par deux, l'une sous l'autre avec un léger décalage, ou en
  // cascade quand elles sont en portrait.
  //   c : première colonne, n : nombre de colonnes, a : alignement vertical ("start", "center", "end")
  //   s : sélecteur (i : rang si plusieurs) — ou stack : éléments empilés dans la même zone, chacun
  //   avec sa largeur (n) et son décalage vers la droite (shift), en colonnes
  //   h : hauteur du cadre photo, en part de la hauteur disponible
  const SPREADS = {
    "chapitre-01": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".terrain__left-in > .body" }, { s: ".terrain__right > .badge" }] },
      { c: 8, n: 6, a: "center", stack: [{ s: ".terrain__left-in > .fig", n: 5, h: 0.5 }, { s: ".quote", n: 5, shift: 1 }] },
      { c: 15, n: 5, a: "start", s: ".terrain__right > .fig", h: 0.78 },
    ],
    "chapitre-02": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".fondations__left-in > .body" }, { s: ".fondations__left-in > .table" }] },
      { c: 8, n: 5, a: "end", s: ".fondations__right > .fig", h: 0.8 },
      { c: 14, n: 6, a: "start", stack: [{ s: ".plancher__left-in > .fig", n: 4, h: 0.42 }, { s: ".plancher__right > .fig", n: 5, shift: 1, h: 0.3 }] },
    ],
    "chapitre-03": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".versions__list" }, { s: ".versions__quote" }] },
      { c: 8, n: 11, a: "center", s: ".board" },
      { c: 20, n: 6, a: "start", stack: [{ s: ".montage__left-in > .body" }, { s: ".montage__right > .table", n: 5 }] },
      { c: 27, n: 6, a: "end", stack: [{ s: ".ossature__left-in > .fig", n: 6, h: 0.38 }, { s: ".ossature__right > .fig", n: 4, shift: 2, h: 0.34 }] },
    ],
    "chapitre-04": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".isolation__col-in > .body", i: 0 }, { s: ".isolation__col-in > .body", i: 1 }] },
      { c: 8, n: 2, a: "start", s: ".isolation__logo" },
      { c: 10, n: 4, a: "start", s: ".toiture > .toiture__fig", i: 0, h: 0.7 },
      { c: 14, n: 4, a: "center", s: ".toiture > .toiture__fig", i: 1, h: 0.7 },
      { c: 18, n: 4, a: "end", s: ".toiture > .toiture__fig", i: 2, h: 0.7 },
    ],
    "chapitre-05": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".amenagement__text" }] },
      { c: 8, n: 5, a: "center", stack: [{ s: ".amenagement__fig", i: 0, n: 4, h: 0.45 }, { s: ".amenagement__fig", i: 1, n: 4, shift: 1, h: 0.32 }] },
      { c: 14, n: 5, a: "center", s: ".amenagement__sketch" },
    ],
    "chapitre-06": [
      { c: 1, n: 6, a: "start", stack: [{ s: ".ctitle" }, { s: ".resultat-quote" }] },
      { c: 8, n: 3, a: "center", stack: [{ s: ".resultat__stats--left" }, { s: ".resultat__stats--right" }] },
      { c: 11, n: 5, a: "center", s: ".resultat__video" },
      { c: 17, n: 6, a: "center", s: ".epilogue" },
    ],
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

  const columns = (n) => `calc(var(--u) * ${n} - 24px)`;
  const figures = []; // [cadre photo, part de la hauteur disponible]
  const take = (section, { s, i = 0, h }) => {
    const element = section.querySelectorAll(s)[i];
    if (element && h) {
      const media = element.querySelector(".fig__media");
      if (media) figures.push([media, h]);
    }
    return element;
  };

  sections.forEach((section) => {
    const original = [...section.children];
    const placed = [];
    let lastColumn = 1;
    const place = (element, c, n, row, align) => {
      element.classList.add("hs__item");
      Object.assign(element.style, { gridColumn: `${c} / span ${n}`, gridRow: row, alignSelf: align });
      placed.push(element);
      lastColumn = Math.max(lastColumn, c + n);
    };
    const band = section.querySelector(":scope > .ctop");
    if (band) place(band, 1, 6, "1", "start");
    (SPREADS[section.id] || []).forEach((entry) => {
      const { c, n, a = "start" } = entry;
      if (!entry.stack) {
        const element = take(section, entry);
        if (element) place(element, c, n, "2", a);
        return;
      }
      const stack = document.createElement("div");
      stack.className = "hs__stack";
      // on repère tous les éléments avant d'en déplacer un : les rangs (i) restent justes
      const elements = entry.stack.map((part) => take(section, part));
      entry.stack.forEach((part, index) => {
        const element = elements[index];
        if (!element) return;
        const width = part.n || n;
        element.classList.add("hs__part");
        element.style.width = columns(width);
        if (part.shift) element.style.marginLeft = `calc(var(--u) * ${part.shift})`;
        stack.append(element);
      });
      if (stack.children.length) place(stack, c, n, "2", a);
    });
    // filet de sécurité : tout contenu non prévu garde sa place, à la suite du chapitre
    original.forEach((block) => {
      if (block.parentNode !== section || placed.includes(block) || !hasContent(block)) return;
      const leftovers = [...block.querySelectorAll("*")].some((el) => !placed.some((p) => p.contains(el) || el.contains(p)) && el.children.length === 0 && hasContent(el));
      if (leftovers) place(block, lastColumn + 1, 12, "2", "center");
    });
    section.append(...placed);
    original.forEach((block) => { if (!placed.includes(block) && block.parentNode === section) block.remove(); });
    track.append(section);
  });
  root.classList.add("is-horizontal");

  const panels = [...track.querySelectorAll(".hs__item")];
  const titles = [...track.querySelectorAll(".chapter .ctitle h2")];
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
    // hauteur disponible sous le bandeau ; cadres photo à leur part de cette hauteur
    const chapter = track.querySelector(".chapter");
    const bandHeight = chapter.querySelector(":scope > .ctop")?.offsetHeight || 0;
    const area = chapter.clientHeight - 168 - bandHeight - 24;
    figures.forEach(([media, share]) => { media.style.height = `${Math.round(area * share)}px`; });
    // un élément ou une pile plus haut que la zone est réduit pour y tenir
    panels.forEach((panel) => {
      if (panel.style.gridRow === "1") return;
      const height = panel.getBoundingClientRect().height;
      panel.style.zoom = height > area ? (area / height).toFixed(4) : "1";
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
