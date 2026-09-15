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

  // Chiffres du héros (2024, 1 an, >2500€) : chaque chiffre défile comme un compteur
  // mécanique jusqu'à sa valeur. Le texte d'origine est remis à la fin : rendu final identique.
  const rollDigits = (el, delay) => {
    const text = el && el.textContent;
    if (!text || !/\d/.test(text) || el.dataset.rolling) return;
    el.dataset.rolling = "true";
    el.setAttribute("aria-label", text);

    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    el.append(probe);
    const widths = {};
    for (const digit of "0123456789") {
      probe.textContent = digit;
      widths[digit] = probe.getBoundingClientRect().width;
    }
    probe.remove();

    const fragment = document.createDocumentFragment();
    const animations = [];
    let index = 0;
    for (const char of text) {
      if (char < "0" || char > "9") {
        fragment.append(char);
        continue;
      }
      const wheel = document.createElement("span");
      wheel.className = "odo";
      wheel.setAttribute("aria-hidden", "true");
      wheel.style.width = `${widths[char]}px`;
      const strip = document.createElement("span");
      strip.className = "odo__strip";
      const stops = 10 + Number(char); // un tour complet, puis jusqu'au chiffre voulu
      for (let i = 0; i <= stops; i++) {
        const line = document.createElement("span");
        line.textContent = String(i % 10);
        strip.append(line);
      }
      wheel.append(strip);
      fragment.append(wheel);
      animations.push({ strip, stops, order: index++ });
    }
    el.textContent = "";
    el.append(fragment);

    const running = animations.map(({ strip, stops, order }) =>
      strip.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-stops}em)` }], {
        duration: 1500 + order * 150,
        delay: delay + 150 + order * 90,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      }).finished
    );
    Promise.all(running).then(() => {
      el.textContent = text;
      el.removeAttribute("aria-label");
      delete el.dataset.rolling;
    });
  };

  const reveal = (el, delay) => {
    if (el.classList.contains("fact")) rollDigits(el.querySelector(".fact__value"), delay);
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
      if (box.top < limit && box.bottom > 0 && box.left < window.innerWidth * 0.94 && box.right > 0) {
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
    // en défilement horizontal, les éléments entrent par la droite : marge à droite, pas en bas
    { rootMargin: root.classList.contains("is-horizontal") ? "0px -6% 0px 0px" : "0px 0px -6% 0px", threshold: 0.06 }
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
  // Écriture à la main : les textes manuscrits (et leurs traits) s'écrivent de gauche à droite,
  // l'un après l'autre, derrière un masque au bord adouci. Durée selon la longueur du texte.
  //  - carte « Prochaine aventure à venir » du journal et annotations de la planche du chapitre 03 :
  //    vides au départ, écrites à l'arrivée à l'écran, puis réécrites au survol.
  // Sur écran tactile : une fois, à l'arrivée à l'écran.
  // ---------------------------------------------------------------------------
  const handwriting = (group, selectors, { onView, onHover, start = 0.1 }) => {
    const items = selectors.flatMap((selector) => [...group.querySelectorAll(selector)]).filter((el) => el.getClientRects().length);
    if (!items.length) return;
    let delay = start;
    items.forEach((el) => {
      const length = (el.textContent || "").trim().length;
      const duration = length ? Math.min(0.85, Math.max(0.3, length * 0.055)) : 0.4; // traits : 0,4 s
      el.classList.add("hw");
      el.style.setProperty("--hw-delay", `${delay.toFixed(2)}s`);
      el.style.setProperty("--hw-duration", `${duration.toFixed(2)}s`);
      delay += duration * 0.85;
    });
    const last = items[items.length - 1];
    last.addEventListener("animationend", () => group.classList.remove("is-writing"));
    const write = () => {
      group.classList.remove("hw-pending", "is-writing");
      void group.offsetWidth; // relance l'animation
      group.classList.add("is-writing");
    };
    if (onView || !finePointer.matches) {
      group.classList.add("hw-pending"); // caché jusqu'à la première écriture
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        write();
      }, { threshold: 0.45 });
      observer.observe(group);
    }
    if (onHover && finePointer.matches) {
      group.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse" && !group.classList.contains("is-writing") && !group.classList.contains("hw-pending")) write();
      });
    }
  };
  const nextCard = document.querySelector(".jnext");
  if (nextCard) handwriting(nextCard, [".jnext__words p", ".jnext__swoosh"], { onView: true, onHover: true, start: 0.3 });
  const board = document.querySelector(".board");
  if (board) {
    handwriting(board, [
      ".sketch--structure .sketch__cross", ".sketch--structure .sketch__note p",
      ".sketch--face .sketch__note p", ".sketch--face .sketch__circle",
      ".sketch__auvent p", ".sketch__auvent svg, .sketch__auvent img",
      ".sketch--terrasse .sketch__note p", ".sketch--terrasse .sketch__cross",
      ".fold__title p", ".fold__version p",
    ], { onView: true, onHover: true, start: 0.5 });
  }

  // ---------------------------------------------------------------------------
  // Badge « Frame Oise » (chapitre 04) : un objet en relief. Il flotte doucement, et quand la
  // souris passe dans la section, il se tourne vers elle ; un reflet glisse sur sa surface.
  // ---------------------------------------------------------------------------
  const badge = document.querySelector(".isolation__badge");
  if (badge) {
    const stage = document.createElement("div");
    stage.className = "badge3d";
    badge.before(stage);
    // épaisseur : copies assombries empilées derrière la face avant
    for (let depth = 7; depth >= 1; depth--) {
      const edge = badge.cloneNode(true);
      edge.classList.add("badge3d__edge");
      edge.setAttribute("aria-hidden", "true");
      edge.style.transform = `translateZ(${(-depth * 1.1).toFixed(1)}px)`;
      stage.append(edge);
    }
    stage.append(badge);
    const glare = document.createElement("span");
    glare.className = "badge3d__glare";
    glare.setAttribute("aria-hidden", "true");
    badge.append(glare);
    const photo = badge.querySelector("img");
    const setMask = () => {
      const url = `url("${photo.currentSrc || photo.src}")`;
      glare.style.webkitMaskImage = url;
      glare.style.maskImage = url;
    };
    if (photo.complete) setMask();
    else photo.addEventListener("load", setMask, { once: true });

    const zone = badge.closest(".isolation") || stage.parentElement;
    const state = { rx: 0, ry: 0, lift: 0 };
    let pointer = null;
    let lifted = false;
    let visible = false;
    let running = false;
    const startedAt = performance.now();

    zone.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" && finePointer.matches) pointer = [event.clientX, event.clientY];
    });
    zone.addEventListener("pointerleave", () => { pointer = null; });
    stage.addEventListener("pointerenter", () => { lifted = true; });
    stage.addEventListener("pointerleave", () => { lifted = false; });

    const tick = (now) => {
      if (!visible) {
        running = false;
        return;
      }
      const t = (now - startedAt) / 1000;
      let targetX;
      let targetY;
      if (pointer) {
        const box = stage.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (pointer[0] - (box.left + box.width / 2)) / 360));
        const dy = Math.max(-1, Math.min(1, (pointer[1] - (box.top + box.height / 2)) / 360));
        targetY = dx * 28;
        targetX = -dy * 20;
      } else {
        targetY = Math.sin(t * 0.7) * 16;
        targetX = Math.sin(t * 0.53 + 1) * 7;
      }
      state.rx = lerp(state.rx, targetX, 0.07);
      state.ry = lerp(state.ry, targetY, 0.07);
      state.lift = lerp(state.lift, lifted ? 1 : 0, 0.1);
      const float = Math.sin(t * 1.1) * 3 * (1 - state.lift);
      stage.style.transform = `perspective(700px) translate3d(0, ${float.toFixed(2)}px, ${(state.lift * 18).toFixed(2)}px) rotateX(${state.rx.toFixed(2)}deg) rotateY(${state.ry.toFixed(2)}deg)`;
      glare.style.setProperty("--glare-x", `${(50 + state.ry * 2.4).toFixed(1)}%`);
      glare.style.setProperty("--glare-y", `${(40 - state.rx * 2.8).toFixed(1)}%`);
      glare.style.opacity = (0.55 + state.lift * 0.35).toFixed(3);
      requestAnimationFrame(tick);
    };
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !running) {
        running = true;
        requestAnimationFrame(tick);
      }
    }, { rootMargin: "100px 0px" }).observe(stage);
  }

  // Cercles du badge « 1,45 ha » : l'onde ne tourne que lorsqu'elle est à l'écran
  document.querySelectorAll(".badge__icon").forEach((icon) => {
    new IntersectionObserver(([entry]) => icon.classList.toggle("is-live", entry.isIntersecting)).observe(icon);
  });

  // ---------------------------------------------------------------------------
  // Carte de l'Oise (héros) : en relief, comme le blason du chapitre 04. Épaisseur (copies du
  // contour empilées derrière), repère qui flotte au-dessus, ombre en retrait, reflet découpé à la
  // forme du département. À plat au repos, elle s'oriente vers la souris au survol du bloc lieu.
  // Les couches ajoutées restent hors de .map : le clone de la carte (zoom du chapitre 01) reste propre.
  // ---------------------------------------------------------------------------
  const heroMap = document.querySelector(".hero .map");
  const outlineSvg = heroMap && heroMap.querySelector(".map__outline svg");
  if (heroMap && outlineSvg) {
    const stage = document.createElement("div");
    stage.className = "map3d";
    heroMap.before(stage);
    for (let depth = 7; depth >= 1; depth--) {
      const edge = document.createElement("span");
      edge.className = "map3d__edge";
      edge.setAttribute("aria-hidden", "true");
      edge.append(outlineSvg.cloneNode(true));
      edge.style.transform = `translateZ(${(-depth * 1.5).toFixed(1)}px)`;
      stage.append(edge);
    }
    stage.append(heroMap);
    const glare = document.createElement("span");
    glare.className = "map3d__glare";
    glare.setAttribute("aria-hidden", "true");
    const shape = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${outlineSvg.getAttribute("viewBox")}' preserveAspectRatio='none'><path d='${outlineSvg.querySelector("path").getAttribute("d")}'/></svg>`;
    const maskUrl = `url("data:image/svg+xml,${encodeURIComponent(shape)}")`;
    glare.style.webkitMaskImage = maskUrl;
    glare.style.maskImage = maskUrl;
    stage.append(glare);

    // à plat au repos ; au survol du bloc lieu, la carte se tourne vers la souris et se soulève
    const hoverZone = stage.closest(".hero__place") || stage;
    const mapState = { rx: 0, ry: 0, lift: 0 };
    let mapPointer = null;
    let mapVisible = false;
    let mapRunning = false;
    const mapRun = () => {
      if (mapRunning || !mapVisible) return;
      mapRunning = true;
      requestAnimationFrame(mapTick);
    };
    hoverZone.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse" || !finePointer.matches) return;
      mapPointer = [event.clientX, event.clientY];
      mapRun();
    });
    hoverZone.addEventListener("pointerleave", () => {
      mapPointer = null;
      mapRun();
    });

    const mapTick = () => {
      let targetX = 0;
      let targetY = 0;
      if (mapPointer) {
        const box = stage.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (mapPointer[0] - (box.left + box.width / 2)) / (box.width / 2)));
        const dy = Math.max(-1, Math.min(1, (mapPointer[1] - (box.top + box.height / 2)) / (box.height / 2)));
        targetY = dx * 22;
        targetX = -dy * 18;
      }
      mapState.rx += (targetX - mapState.rx) * 0.1;
      mapState.ry += (targetY - mapState.ry) * 0.1;
      mapState.lift += ((mapPointer ? 1 : 0) - mapState.lift) * 0.1;
      const settled = !mapPointer && Math.abs(mapState.rx) < 0.02 && Math.abs(mapState.ry) < 0.02 && mapState.lift < 0.005;
      if (settled) {
        stage.style.transform = "";
        glare.style.opacity = "0";
        mapRunning = false;
        return;
      }
      stage.style.transform = `perspective(900px) translate3d(0, ${(-mapState.lift * 6).toFixed(2)}px, ${(mapState.lift * 20).toFixed(2)}px) rotateX(${mapState.rx.toFixed(2)}deg) rotateY(${mapState.ry.toFixed(2)}deg)`;
      glare.style.opacity = mapState.lift.toFixed(3);
      glare.style.setProperty("--glare-x", `${(50 + mapState.ry * 2.2).toFixed(1)}%`);
      glare.style.setProperty("--glare-y", `${(40 - mapState.rx * 2.6).toFixed(1)}%`);
      requestAnimationFrame(mapTick);
    };
    new IntersectionObserver(([entry]) => {
      mapVisible = entry.isIntersecting;
      if (mapVisible && mapPointer) mapRun();
    }).observe(stage);
  }
})();
