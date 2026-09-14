// Animations du site : apparitions au défilement, aperçu des chapitres au curseur,
// inclinaison des cartes du journal. Rien ne s'exécute si le système demande de réduire
// les animations (la classe « motion » n'est alors pas posée, voir le <head>).

(() => {
  const root = document.documentElement;
  window.__motionReady = true;
  if (!root.classList.contains("motion")) return;

  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------------------
  // Apparitions : les éléments qui entrent ensemble à l'écran sont décalés de 70 ms,
  // dans l'ordre du document. .is-done retire ensuite les transitions d'apparition pour
  // rendre la main aux transitions propres à l'élément (survol, etc.).
  // ---------------------------------------------------------------------------
  const STAGGER = 70;
  const MAX_STAGGER_STEPS = 8;
  const DURATION = 1800;

  const reveal = (el, delay) => {
    el.style.setProperty("--reveal-delay", `${delay}ms`);
    el.classList.add("is-in");
    setTimeout(() => {
      el.classList.add("is-done");
      el.style.removeProperty("--reveal-delay");
    }, DURATION + delay);
  };

  const targets = [...document.querySelectorAll("[data-reveal]")];
  const byDocumentOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

  // Les éléments entrés à l'écran pendant la même image partent ensemble, en cascade.
  const pending = new Set();
  let flushScheduled = false;
  const flush = () => {
    flushScheduled = false;
    [...pending].sort(byDocumentOrder).forEach((el, index) => reveal(el, Math.min(index, MAX_STAGGER_STEPS) * STAGGER));
    pending.clear();
  };
  const enqueue = (el) => {
    pending.add(el);
    if (!flushScheduled) {
      flushScheduled = true;
      requestAnimationFrame(flush);
    }
  };

  // Déjà passés au-dessus de l'écran (rechargement en milieu de page) : affichés sans animation.
  targets.forEach((el) => {
    if (el.getBoundingClientRect().bottom < 0) el.classList.add("is-in", "is-done");
  });
  const waiting = targets.filter((el) => !el.classList.contains("is-in"));

  // Titres et photos sont entièrement découpés (clip-path) tant qu'ils sont cachés : Chrome les
  // considère alors sans surface et IntersectionObserver ne les signale jamais. Pour eux, on
  // compare leur boîte (qui ignore clip-path) au bas de l'écran, une fois par image.
  const clipped = new Set(waiting.filter((el) => el.dataset.reveal === "title" || el.dataset.reveal === "media"));
  const checkClipped = () => {
    const limit = window.innerHeight * 0.94;
    clipped.forEach((el) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return; // masqué à cette largeur
      if (box.top < limit && box.bottom > 0) {
        clipped.delete(el);
        enqueue(el);
      }
    });
    if (!clipped.size) {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    }
  };
  let checkScheduled = false;
  const onScroll = () => {
    if (checkScheduled) return;
    checkScheduled = true;
    requestAnimationFrame(() => {
      checkScheduled = false;
      checkClipped();
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  checkClipped();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        enqueue(entry.target);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
  );
  waiting.filter((el) => !clipped.has(el)).forEach((el) => observer.observe(el));

  // ---------------------------------------------------------------------------
  // Sommaire : une photo du chapitre suit le curseur, avec un léger retard et une
  // inclinaison qui dépend de la vitesse horizontale.
  // ---------------------------------------------------------------------------
  const rows = [...document.querySelectorAll(".row[data-preview]")];
  if (rows.length) {
    const preview = document.createElement("div");
    preview.className = "preview";
    preview.setAttribute("aria-hidden", "true");
    const frame = document.createElement("div");
    frame.className = "preview__frame";
    preview.append(frame);

    const images = new Map();
    rows.forEach((row) => {
      const img = document.createElement("img");
      img.alt = "";
      img.decoding = "async";
      img.dataset.src = row.dataset.preview;
      frame.append(img);
      images.set(row, img);
    });
    document.body.append(preview);

    const state = { x: 0, y: 0, tx: 0, ty: 0, rotate: 0, visible: false, running: false };
    let active = null;
    let z = 1;

    const loadAll = () => images.forEach((img) => { if (!img.src) img.src = img.dataset.src; });

    const tick = () => {
      const prevX = state.x;
      state.x = lerp(state.x, state.tx, 0.14);
      state.y = lerp(state.y, state.ty, 0.14);
      const velocity = state.x - prevX;
      state.rotate = lerp(state.rotate, Math.max(-9, Math.min(9, velocity * 0.6)), 0.12);
      preview.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotate}deg)`;
      const settled = Math.abs(state.tx - state.x) < 0.3 && Math.abs(state.ty - state.y) < 0.3 && Math.abs(state.rotate) < 0.05;
      if (state.visible || !settled) requestAnimationFrame(tick);
      else state.running = false;
    };
    const run = () => {
      if (!state.running) {
        state.running = true;
        requestAnimationFrame(tick);
      }
    };

    const place = (event) => {
      // la photo se place à droite du curseur, centrée verticalement sur lui
      state.tx = event.clientX + 36;
      state.ty = event.clientY - 190;
    };

    rows.forEach((row) => {
      row.addEventListener("pointerenter", (event) => {
        if (!finePointer.matches) return;
        loadAll();
        place(event);
        if (!state.visible) {
          state.x = state.tx;
          state.y = state.ty;
        }
        const img = images.get(row);
        if (active !== img) {
          img.style.zIndex = String(++z);
          img.classList.add("is-active");
          const previous = active;
          if (previous) setTimeout(() => { if (active !== previous) previous.classList.remove("is-active"); }, 700);
          active = img;
        }
        state.visible = true;
        preview.classList.add("is-visible");
        run();
      });
      row.addEventListener("pointermove", (event) => {
        if (!state.visible) return;
        place(event);
        run();
      });
      row.addEventListener("pointerleave", (event) => {
        const next = event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest(".row[data-preview]");
        if (next) return;
        state.visible = false;
        preview.classList.remove("is-visible");
        run();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Journal : les cartes s'inclinent vers le curseur (5° au plus).
  // ---------------------------------------------------------------------------
  document.querySelectorAll(".journal__grid .jcard").forEach((card) => {
    let frame = 0;
    card.addEventListener("pointermove", (event) => {
      if (!finePointer.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        const px = (event.clientX - box.left) / box.width - 0.5;
        const py = (event.clientY - box.top) / box.height - 0.5;
        card.classList.add("is-tilting");
        card.classList.remove("is-tilting-out");
        card.style.transform = `rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`;
      });
    });
    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      card.classList.remove("is-tilting");
      card.classList.add("is-tilting-out");
      card.style.transform = "";
      setTimeout(() => card.classList.remove("is-tilting-out"), 500);
    });
  });
})();
