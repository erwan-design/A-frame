// Le récit : repère de progression dans les chapitres, citations lues au fil du défilement,
// zoom de la carte de l'Oise vers le terrain, photos en plein écran, ambiance sonore et
// invitation à commencer. Le repère, la visionneuse et le son marchent aussi avec les
// animations réduites ; les effets liés au défilement, eux, sont réservés à la classe « motion ».

(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smooth = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  // Défilement vers un élément : Lenis s'il est actif, sinon défilement fluide natif.
  const goTo = (target) => {
    if (window.__lenis) window.__lenis.scrollTo(target, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: motion ? "smooth" : "auto" });
  };

  const tasks = []; // fonctions appelées à chaque image où la page a défilé
  let scheduled = false;
  const update = () => {
    scheduled = false;
    const viewport = window.innerHeight;
    tasks.forEach((task) => task(viewport));
  };
  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };
  addEventListener("scroll", requestUpdate, { passive: true });
  addEventListener("resize", requestUpdate, { passive: true });

  // ---------------------------------------------------------------------------
  // Commencer le récit
  // ---------------------------------------------------------------------------
  const start = document.querySelector(".start");
  if (start) {
    start.addEventListener("click", (event) => {
      const target = document.querySelector(start.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      goTo(target);
    });
    tasks.push(() => start.classList.toggle("is-hidden", window.scrollY > 60));
  }

  // ---------------------------------------------------------------------------
  // Repère de progression : « 03 / 06 · La structure · avril 2024 », trait de progression
  // sur l'ensemble des chapitres, menu pour sauter d'un chapitre à l'autre.
  // ---------------------------------------------------------------------------
  const chapters = [...document.querySelectorAll("section.chapter")].map((section, index) => ({
    section,
    number: String(index + 1).padStart(2, "0"),
    title: section.querySelector(".ctitle h2").textContent.trim(),
    date: section.querySelector(".ctop__date p").textContent.trim(),
  }));

  let story = null;
  if (chapters.length) {
    story = document.createElement("nav");
    story.className = "story";
    story.setAttribute("aria-label", "Chapitres du récit");
    story.innerHTML = `
      <div class="story__bar" aria-hidden="true"><span class="story__fill"></span></div>
      <button class="story__toggle" type="button" aria-expanded="false" aria-controls="story-menu">
        <span class="story__num"><span class="story__current">01</span><span class="story__total">/${String(chapters.length).padStart(2, "0")}</span></span>
        <span class="story__title"></span>
        <span class="story__date"></span>
        <span class="story__chevron" aria-hidden="true"></span>
      </button>
      <button class="story__sound" type="button" aria-pressed="false" aria-label="Activer l'ambiance sonore" title="Ambiance sonore">
        <span></span><span></span><span></span><span></span>
      </button>
      <ol class="story__menu" id="story-menu" hidden>
        ${chapters
          .map(
            (chapter, i) => `<li><button type="button" data-index="${i}">
              <span class="story__menu-num">${chapter.number}</span>
              <span class="story__menu-title">${chapter.title}</span>
              <span class="story__menu-date">${chapter.date}</span>
            </button></li>`
          )
          .join("")}
      </ol>`;
    document.body.append(story);

    const toggle = story.querySelector(".story__toggle");
    const menu = story.querySelector(".story__menu");
    const fill = story.querySelector(".story__fill");
    const current = story.querySelector(".story__current");
    const title = story.querySelector(".story__title");
    const date = story.querySelector(".story__date");
    const menuButtons = [...menu.querySelectorAll("button")];

    const setMenu = (open) => {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      story.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", () => setMenu(menu.hidden));
    menuButtons.forEach((button) =>
      button.addEventListener("click", () => {
        setMenu(false);
        goTo(chapters[Number(button.dataset.index)].section);
      })
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!menu.hidden && !story.contains(event.target)) setMenu(false);
    });

    let active = -1;
    const show = (index) => {
      if (index === active) return;
      const chapter = chapters[index];
      active = index;
      current.textContent = chapter.number;
      title.textContent = chapter.title;
      date.textContent = chapter.date;
      menuButtons.forEach((button, i) => button.toggleAttribute("aria-current", i === index));
      if (motion) {
        story.classList.remove("is-changing");
        void story.offsetWidth; // relance l'animation de changement de titre
        story.classList.add("is-changing");
      }
    };

    tasks.push((viewport) => {
      const line = viewport * 0.4;
      const first = chapters[0].section.getBoundingClientRect();
      const last = chapters[chapters.length - 1].section.getBoundingClientRect();
      const inStory = first.top < line && last.bottom > line;
      story.classList.toggle("is-visible", inStory);
      if (!inStory && !menu.hidden) setMenu(false);

      let index = 0;
      chapters.forEach((chapter, i) => {
        if (chapter.section.getBoundingClientRect().top < line) index = i;
      });
      show(index);
      fill.style.transform = `scaleX(${clamp((line - first.top) / (last.bottom - first.top)).toFixed(4)})`;
    });
  }

  // ---------------------------------------------------------------------------
  // Citations lues au fil du défilement : chaque mot s'éclaire à son tour.
  // ---------------------------------------------------------------------------
  if (motion) {
    document.querySelectorAll("[data-scrub]").forEach((quote) => {
      const words = [];
      const text = quote.textContent;
      quote.setAttribute("aria-label", text);
      quote.textContent = "";
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          quote.append(part);
          return;
        }
        const word = document.createElement("span");
        word.className = "scrub-word";
        word.setAttribute("aria-hidden", "true");
        word.textContent = part;
        quote.append(word);
        words.push(word);
      });
      let last = -1;
      tasks.push((viewport) => {
        const box = quote.getBoundingClientRect();
        if (box.bottom < -viewport || box.top > viewport * 2) return;
        // commence quand la citation entre par le bas, finit quand son bas atteint 60 % de l'écran
        // (sur mobile la citation est haute : les derniers mots s'éclairent quand on les lit)
        const progress = clamp((viewport * 0.9 - box.top) / (viewport * 0.3 + box.height));
        const lit = progress * words.length;
        if (Math.abs(lit - last) < 0.01) return;
        last = lit;
        words.forEach((word, i) => {
          word.style.opacity = (0.16 + 0.84 * clamp(lit - i)).toFixed(3);
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Du département au terrain : sur la vue drone du chapitre 01, la carte de l'Oise zoome
  // sur son repère puis s'efface pour laisser place à la photo.
  // ---------------------------------------------------------------------------
  const droneFigure = document.querySelector("#chapitre-01 .terrain__left .fig__media");
  const heroMap = document.querySelector(".hero .map");
  if (motion && droneFigure && heroMap) {
    const overlay = document.createElement("div");
    overlay.className = "zoom-map";
    overlay.setAttribute("aria-hidden", "true");
    const map = heroMap.cloneNode(true);
    map.classList.add("zoom-map__map");
    // le repère et son onde gardent leur taille : la carte grossit autour d'eux
    const markers = [...map.querySelectorAll(".map__pin, .map__pulse")];
    const label = document.createElement("p");
    label.className = "zoom-map__label";
    label.textContent = "Oise, France";
    overlay.append(map, label);
    droneFigure.append(overlay);

    // Le repère atterrit sur la cabane de la photo (37,1 % × 41,3 % de l'image), en tenant
    // compte du recadrage object-fit: cover qui varie avec la largeur de la colonne.
    const photo = droneFigure.querySelector("img");
    const CABIN = { x: 0.371, y: 0.413 };
    const PIN = { x: 0.532 * 278, y: 0.564 * 218 };
    let placedFor = "";
    const placeMap = (box) => {
      const key = `${box.width}x${box.height}x${photo && photo.naturalWidth}`;
      if (key === placedFor) return;
      placedFor = key;
      let x = box.width / 2;
      let y = box.height / 2;
      if (photo && photo.naturalWidth) {
        const scale = Math.max(box.width / photo.naturalWidth, box.height / photo.naturalHeight);
        const width = photo.naturalWidth * scale;
        const height = photo.naturalHeight * scale;
        x = CABIN.x * width - (width - box.width) / 2;
        y = CABIN.y * height - (height - box.height) / 2;
      }
      map.style.left = `${(x - PIN.x).toFixed(1)}px`;
      map.style.top = `${(y - PIN.y).toFixed(1)}px`;
    };

    tasks.push((viewport) => {
      const box = droneFigure.getBoundingClientRect();
      if (box.bottom < 0 || box.top > viewport) return;
      placeMap(box);
      // 0 quand la photo entre par le bas, 1 quand son haut atteint 30 % de l'écran
      const progress = clamp((viewport - box.top) / (viewport * 0.7));
      const zoom = 1 + Math.pow(smooth(0.1, 0.85, progress), 2.2) * 22;
      map.style.transform = `scale(${zoom.toFixed(3)})`;
      markers.forEach((marker) => (marker.style.transform = `scale(${(1 / zoom).toFixed(4)})`));
      map.style.opacity = (1 - smooth(0.55, 0.85, progress)).toFixed(3);
      label.style.opacity = (1 - smooth(0.15, 0.4, progress)).toFixed(3);
      overlay.style.backgroundColor = `rgba(16, 24, 25, ${(1 - smooth(0.6, 0.95, progress)).toFixed(3)})`;
    });
  }

  // ---------------------------------------------------------------------------
  // Photos en plein écran : clic sur une photo, légende, photo précédente / suivante dans
  // la même partie du récit (flèches, balayage), fermeture par Échap ou clic.
  // ---------------------------------------------------------------------------
  const photoSelector = [
    ".prologue__photo > img:last-child",
    ".fig__media > img",
    ".jcard__media > img.jcard__photo:last-of-type",
  ].join(",");
  const photos = [...document.querySelectorAll(photoSelector)];

  const captionFor = (img) => {
    const figure = img.closest("figure, .jcard");
    if (!figure) return { label: "", text: "" };
    const tag = figure.querySelector(".cap__label, .jtag > p");
    const text = figure.querySelector(".cap__text, .jcard__text");
    return { label: tag ? tag.textContent.trim() : "", text: text ? text.textContent.trim() : "" };
  };
  const groupOf = (img) => img.closest("section, article.journal, header");

  if (photos.length) {
    const box = document.createElement("dialog");
    box.className = "lightbox";
    box.setAttribute("aria-label", "Photo en plein écran");
    box.innerHTML = `
      <figure class="lightbox__figure">
        <img class="lightbox__img" alt="">
        <figcaption class="lightbox__caption"><span class="lightbox__label"></span><span class="lightbox__text"></span></figcaption>
      </figure>
      <p class="lightbox__count"></p>
      <button class="lightbox__close" type="button" aria-label="Fermer">Fermer</button>
      <button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Photo précédente">←</button>
      <button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Photo suivante">→</button>`;
    document.body.append(box);

    const view = box.querySelector(".lightbox__img");
    const labelEl = box.querySelector(".lightbox__label");
    const textEl = box.querySelector(".lightbox__text");
    const count = box.querySelector(".lightbox__count");
    const prev = box.querySelector(".lightbox__nav--prev");
    const next = box.querySelector(".lightbox__nav--next");
    let group = [];
    let index = 0;

    const render = (from) => {
      const img = group[index];
      view.removeAttribute("src");
      view.srcset = img.srcset;
      view.sizes = "100vw";
      view.src = img.currentSrc || img.src;
      const { label, text } = captionFor(img);
      labelEl.textContent = label;
      textEl.textContent = text;
      count.textContent = group.length > 1 ? `${index + 1} / ${group.length}` : "";
      prev.hidden = next.hidden = group.length < 2;
      if (motion && from) {
        // la photo part de sa place dans la page
        const start = from.getBoundingClientRect();
        requestAnimationFrame(() => {
          const end = view.getBoundingClientRect();
          if (!end.width) return;
          const dx = start.left + start.width / 2 - (end.left + end.width / 2);
          const dy = start.top + start.height / 2 - (end.top + end.height / 2);
          const scale = Math.max(start.width / end.width, start.height / end.height);
          view.animate(
            [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 }, { transform: "none", opacity: 1 }],
            { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
          );
        });
      } else if (motion) {
        view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
      }
    };

    const open = (img) => {
      group = photos.filter((photo) => groupOf(photo) === groupOf(img) && photo.getClientRects().length);
      index = Math.max(0, group.indexOf(img));
      box.showModal();
      root.classList.add("has-lightbox");
      window.__lenis?.stop();
      render(img);
    };
    const close = () => {
      if (box.open) box.close();
    };
    box.addEventListener("close", () => {
      root.classList.remove("has-lightbox");
      window.__lenis?.start();
    });
    const step = (delta) => {
      index = (index + delta + group.length) % group.length;
      render(null);
    };

    photos.forEach((img) => {
      img.classList.add("is-zoomable");
      const trigger = img.closest(".fig__media, .prologue__photo, .jcard__media");
      trigger.setAttribute("role", "button");
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("aria-label", `Agrandir la photo${captionFor(img).text ? " : " + captionFor(img).text : ""}`);
      trigger.addEventListener("click", () => open(img));
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(img);
        }
      });
    });
    box.querySelector(".lightbox__close").addEventListener("click", close);
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    box.addEventListener("click", (event) => {
      if (event.target === box) close();
    });
    box.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    });
    let swipeX = null;
    box.addEventListener("pointerdown", (event) => { swipeX = event.clientX; });
    box.addEventListener("pointerup", (event) => {
      if (swipeX === null || group.length < 2) return;
      const dx = event.clientX - swipeX;
      swipeX = null;
      if (Math.abs(dx) > 50) step(dx > 0 ? -1 : 1);
    });
  }

  // ---------------------------------------------------------------------------
  // Ambiance sonore (coupée par défaut) : du vent dans les arbres, synthétisé avec la
  // Web Audio API — un bruit filtré dont l'intensité varie lentement, par rafales.
  // ---------------------------------------------------------------------------
  const soundButton = story && story.querySelector(".story__sound");
  if (soundButton && (window.AudioContext || window.webkitAudioContext)) {
    let audio = null;

    const build = () => {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const length = context.sampleRate * 6;
      const buffer = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let last = 0;
        for (let i = 0; i < length; i++) {
          // bruit « brun » : grave et doux, proche du souffle du vent
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          data[i] = last * 3.5;
        }
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const body = context.createBiquadFilter();
      body.type = "lowpass";
      body.frequency.value = 520;
      const leaves = context.createBiquadFilter();
      leaves.type = "bandpass";
      leaves.frequency.value = 2400;
      leaves.Q.value = 0.7;
      const leavesGain = context.createGain();
      leavesGain.gain.value = 0.05;
      const gust = context.createGain();
      gust.gain.value = 0.7;
      const master = context.createGain();
      master.gain.value = 0;

      source.connect(body).connect(gust);
      source.connect(leaves).connect(leavesGain).connect(gust);
      gust.connect(master).connect(context.destination);
      source.start();

      // rafales : toutes les 2 à 5 s, nouvelle intensité et nouvelle couleur du souffle
      const breathe = () => {
        if (!audio || audio.context.state === "closed") return;
        const now = context.currentTime;
        const duration = 2 + Math.random() * 3;
        gust.gain.linearRampToValueAtTime(0.45 + Math.random() * 0.55, now + duration);
        body.frequency.linearRampToValueAtTime(320 + Math.random() * 700, now + duration);
        leavesGain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.08, now + duration);
        audio.timer = setTimeout(breathe, duration * 1000);
      };
      audio = { context, master, timer: 0 };
      breathe();
    };

    const setSound = (on) => {
      soundButton.setAttribute("aria-pressed", String(on));
      soundButton.setAttribute("aria-label", on ? "Couper l'ambiance sonore" : "Activer l'ambiance sonore");
      story.classList.toggle("has-sound", on);
      if (on) {
        if (!audio) build();
        audio.context.resume();
        audio.master.gain.cancelScheduledValues(audio.context.currentTime);
        audio.master.gain.setTargetAtTime(0.32, audio.context.currentTime, 0.6);
      } else if (audio) {
        audio.master.gain.cancelScheduledValues(audio.context.currentTime);
        audio.master.gain.setTargetAtTime(0, audio.context.currentTime, 0.25);
        const context = audio.context;
        setTimeout(() => { if (soundButton.getAttribute("aria-pressed") === "false") context.suspend(); }, 1200);
      }
    };
    soundButton.addEventListener("click", () => setSound(soundButton.getAttribute("aria-pressed") !== "true"));
    document.addEventListener("visibilitychange", () => {
      if (!audio) return;
      if (document.hidden) audio.context.suspend();
      else if (soundButton.getAttribute("aria-pressed") === "true") audio.context.resume();
    });
  } else if (soundButton) {
    soundButton.remove();
  }

  requestUpdate();
})();
