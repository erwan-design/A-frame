// Prototype « défilement horizontal » : arrivé aux chapitres, l'écran se fige et la lecture part
// vers la droite. Chaque chapitre devient une suite de colonnes : l'ouverture (bandeau, titre,
// texte, données) puis les photos, vidéos et citations, ramenées à la hauteur de l'écran si besoin. La molette,
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

  // Composition de chaque chapitre en colonnes : l'ouverture regroupe bandeau, titre, texte et
  // données ; les colonnes suivantes portent photos, vidéos, croquis et citations.
  // `split` : chaque élément trouvé a sa propre colonne.
  const COMPOSITION = {
    "chapitre-01": [
      { intro: [".terrain__left-in > .body", ".terrain__right > .badge"] },
      { items: [".terrain__left-in > .fig"], width: 560 },
      { items: [".terrain__right > .fig"], width: 480 },
      { items: [".quote"], width: 720 },
    ],
    "chapitre-02": [
      { intro: [".fondations__left-in > .body", ".fondations__left-in > .table"] },
      { items: [".fondations__right > .fig"], width: 440 },
      { items: [".plancher__left-in > .fig"], width: 460 },
      { items: [".plancher__right > .fig"], width: 620 },
    ],
    "chapitre-03": [
      { intro: [".versions__list", ".versions__quote"] },
      { items: [".montage__left-in > .body", ".montage__right > .table", ".montage__right > .plus"], width: 560 },
      { items: [".board"], width: 1240 },
      { items: [".ossature__left-in > .fig"], width: 690 },
      { items: [".ossature__right > .fig"], width: 440 },
    ],
    "chapitre-04": [
      { intro: [".isolation__col-in > .body"] },
      { items: [".isolation__logo"], width: 220 },
      { items: [".toiture > .toiture__fig"], width: 381, split: true },
    ],
    "chapitre-05": [
      { intro: [".amenagement__text"] },
      { items: [".amenagement__figs"], width: 560 },
      { items: [".amenagement__sketch"], width: 408 },
    ],
    "chapitre-06": [
      { intro: [".resultat-quote"] },
      { items: [".resultat__stats--left"], width: 280 },
      { items: [".resultat__video"], width: 560 },
      { items: [".resultat__stats--right"], width: 280 },
      { items: [".epilogue"], width: 720 },
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

  const column = (className, width) => {
    const col = document.createElement("div");
    col.className = `hs__col ${className || ""}`.trim();
    if (width) col.style.width = `${width}px`;
    return col;
  };
  const hasContent = (element) =>
    (element.textContent || "").trim() !== "" || element.querySelector("img, video, svg, canvas, picture");

  sections.forEach((section) => {
    const original = [...section.children];
    const columns = [];
    const plan = COMPOSITION[section.id] || [];
    plan.forEach((entry) => {
      if (entry.intro) {
        const intro = column("hs__col--intro");
        [":scope > .ctop", ":scope > .ctitle", ...entry.intro].forEach((selector) =>
          section.querySelectorAll(selector).forEach((element) => intro.append(element))
        );
        columns.push(intro);
        return;
      }
      const found = entry.items.flatMap((selector) => [...section.querySelectorAll(selector)]);
      if (!found.length) return;
      const groups = entry.split ? found.map((element) => [element]) : [found];
      groups.forEach((elements) => {
        const col = column("", entry.width);
        col.append(...elements);
        columns.push(col);
      });
    });
    // filet de sécurité : tout contenu non prévu dans la composition garde sa place, en fin de chapitre
    original.forEach((block) => {
      if (block.parentNode === section && hasContent(block)) {
        const rest = column("hs__col--rest", 1240);
        rest.append(block);
        columns.push(rest);
      }
    });
    original.forEach((block) => { if (block.parentNode === section) block.remove(); });
    section.append(...columns);
    track.append(section);
  });
  root.classList.add("is-horizontal");

  const panels = [...track.querySelectorAll(".hs__col")];
  let travel = 0; // distance horizontale à parcourir
  let wrapTop = 0;

  // chaque panneau tient dans la hauteur de l'écran (zoom réduit si besoin), puis on mesure le trajet
  const titles = [...track.querySelectorAll(".hs__col--intro .ctitle h2")];
  const layout = () => {
    const available = window.innerHeight - 150;
    // titres : la plus grande taille (96 px au plus) qui tient sur la largeur de la colonne
    titles.forEach((title) => {
      const width = title.closest(".hs__col").clientWidth;
      let size = 96;
      title.style.fontSize = `${size}px`;
      while (title.scrollWidth > width && size > 48) {
        size -= 2;
        title.style.fontSize = `${size}px`;
      }
    });
    panels.forEach((panel) => {
      panel.style.zoom = "1";
    });
    panels.forEach((panel) => {
      const height = panel.getBoundingClientRect().height;
      panel.style.zoom = height > available ? (available / height).toFixed(4) : "1";
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
