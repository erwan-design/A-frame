// Croquis de l'aménagement (chapitre 05) : il est affiché terminé ; quand on le survole, il
// s'efface et se redessine trait par trait, depuis une page vierge. Sur écran tactile, il se
// dessine une fois en arrivant à l'écran.
//
// Les traits (assets/data/sketch-interieur.json) ont été relevés sur l'image elle-même :
// chaque trait dévoile l'image d'origine le long de son tracé, dans l'ordre d'un dessinateur
// (lignes de construction, structure, hachures). À la fin, l'image d'origine reprend sa place :
// le rendu final est celui de la maquette.

(() => {
  if (!document.documentElement.classList.contains("motion")) return;
  const block = document.querySelector(".amenagement__sketch[data-strokes]");
  const holder = block && block.firstElementChild;
  const img = holder && holder.querySelector("img");
  if (!img) return;

  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const BRUSH = 7; // largeur du trait qui dévoile l'image, en pixels de l'image source

  let data = null;
  let canvas, context, mask, maskContext;
  let fit = { scale: 1, x: 0, y: 0, width: 0, height: 0, ratio: 1 };
  let drawn = null; // avancement de chaque trait (0 → 1)
  let state = "idle"; // idle → blank / drawn ⇄ drawing
  let startedAt = 0;
  let frame = 0;
  let clearTimer = 0;

  const clamp = (value) => Math.max(0, Math.min(1, value));

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(holder.clientWidth * ratio));
    const height = Math.max(1, Math.round(holder.clientHeight * ratio));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = mask.width = width;
    canvas.height = mask.height = height;
    // même cadrage que l'image (object-fit: cover, centré)
    const scale = Math.max(width / data.w, height / data.h);
    fit = { scale, ratio, width: data.w * scale, height: data.h * scale, x: (width - data.w * scale) / 2, y: (height - data.h * scale) / 2 };
    // le masque est à refaire à la nouvelle taille : on retrace ce qui l'était déjà
    const progress = drawn ? drawn.slice() : null;
    if (progress) {
      drawn.fill(0);
      strokeUpTo(progress);
    }
    paint();
  };

  const strokeUpTo = (targets) => {
    maskContext.lineCap = "round";
    maskContext.lineWidth = BRUSH * fit.scale;
    maskContext.strokeStyle = "#fff";
    maskContext.beginPath();
    data.strokes.forEach(([x1, y1, x2, y2], i) => {
      const to = targets[i];
      const from = drawn[i];
      if (to <= from) return;
      maskContext.moveTo(fit.x + (x1 + (x2 - x1) * from) * fit.scale, fit.y + (y1 + (y2 - y1) * from) * fit.scale);
      maskContext.lineTo(fit.x + (x1 + (x2 - x1) * to) * fit.scale, fit.y + (y1 + (y2 - y1) * to) * fit.scale);
      drawn[i] = to;
    });
    maskContext.stroke();
  };

  // partie déjà dessinée, et la pointe des traits en cours
  const paint = (heads) => {
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.drawImage(img, fit.x, fit.y, fit.width, fit.height);
    context.globalCompositeOperation = "source-over";
    if (heads && heads.length) {
      context.fillStyle = "rgba(251, 255, 254, 0.9)";
      context.beginPath();
      heads.forEach(([x, y]) => {
        context.moveTo(x + 1.6 * fit.ratio, y);
        context.arc(x, y, 1.6 * fit.ratio, 0, Math.PI * 2);
      });
      context.fill();
    }
  };

  const tick = (now) => {
    const elapsed = now - startedAt;
    const targets = new Float32Array(data.strokes.length);
    const heads = [];
    data.strokes.forEach(([x1, y1, x2, y2, start, duration], i) => {
      const t = clamp((elapsed - start) / duration);
      // chaque trait accélère puis ralentit, comme une main
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      targets[i] = Math.max(drawn[i], eased);
      if (t > 0 && t < 1) heads.push([fit.x + (x1 + (x2 - x1) * eased) * fit.scale, fit.y + (y1 + (y2 - y1) * eased) * fit.scale]);
    });
    strokeUpTo(targets);
    paint(heads);
    if (elapsed < data.duration + 60) {
      frame = requestAnimationFrame(tick);
      return;
    }
    // l'image d'origine reprend sa place (fondu CSS), le rendu final est celui de la maquette ;
    // la toile est vidée ensuite, pour ne pas s'additionner aux bords adoucis de l'image
    state = "drawn";
    holder.classList.add("is-drawn");
    clearTimer = setTimeout(() => {
      if (state === "drawn") context.clearRect(0, 0, canvas.width, canvas.height);
    }, 600);
  };

  // repart d'une page vierge et dessine tout le croquis
  const draw = () => {
    if (!data || state === "drawing") return;
    clearTimeout(clearTimer);
    cancelAnimationFrame(frame);
    drawn.fill(0);
    maskContext.clearRect(0, 0, mask.width, mask.height);
    paint();
    state = "drawing";
    holder.classList.remove("is-drawn");
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const setup = () => {
    canvas = document.createElement("canvas");
    canvas.className = "amenagement__canvas";
    canvas.setAttribute("aria-hidden", "true");
    context = canvas.getContext("2d");
    mask = document.createElement("canvas");
    maskContext = mask.getContext("2d");
    drawn = new Float32Array(data.strokes.length);
    holder.prepend(canvas);
    resize();
    // avec une souris, le croquis reste affiché terminé jusqu'au survol
    state = finePointer.matches ? "drawn" : "blank";
    holder.classList.toggle("is-drawn", state === "drawn");
    holder.classList.add("is-sketch");
    new ResizeObserver(resize).observe(holder);

    block.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      draw();
    });

    // sans survol possible : le croquis se dessine une fois, quand il est bien visible
    if (!finePointer.matches) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        draw();
      }, { threshold: 0.45 });
      observer.observe(block);
    }
  };

  // chargement à l'approche du bloc : les traits et l'image
  const loader = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    loader.disconnect();
    img.loading = "eager";
    Promise.all([
      fetch(block.dataset.strokes).then((response) => response.json()),
      img.complete && img.naturalWidth ? Promise.resolve() : img.decode(),
    ])
      .then(([strokes]) => {
        data = strokes;
        setup();
      })
      .catch(() => {}); // en cas d'échec, l'image reste telle quelle
  }, { rootMargin: "800px 0px" });
  loader.observe(block);
})();
