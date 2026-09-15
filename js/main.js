// Horloge « HH:MM UTC+2 » — même calcul que le composant de code Figma (décalage fixe).
const TIMEZONE_OFFSET = 2;

function renderClock(el) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + TIMEZONE_OFFSET * 3600000);
  const hours = String(local.getHours()).padStart(2, "0");
  const minutes = String(local.getMinutes()).padStart(2, "0");
  const label = `${hours}:${minutes} UTC${TIMEZONE_OFFSET >= 0 ? "+" : ""}${TIMEZONE_OFFSET}`;
  if (el.dataset.label === label) return;
  el.dataset.label = label;
  // deux-points dans un span : ils battent la seconde (voir css, .clock__colon)
  el.innerHTML = `${hours}<span class="clock__colon">:</span>${label.slice(3)}`;
}

// Défilement lissé (Lenis) : la molette et la Magic Mouse envoient le défilement par à-coups,
// que le parallax et les photos qui glissent rendent visibles. Lenis interpole la position à
// chaque image de l'écran. Actif seulement avec une souris ou un trackpad (le tactile garde son
// défilement natif) et si les animations ne sont pas réduites (classe « motion »).
let lenis = null;

function startSmoothScroll() {
  const pointer = matchMedia("(hover: hover) and (pointer: fine)");
  if (!window.Lenis || !document.documentElement.classList.contains("motion") || !pointer.matches) return;
  lenis = new window.Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true, syncTouch: false, gestureOrientation: document.documentElement.classList.contains("is-horizontal") ? "both" : "vertical" });
  window.__lenis = lenis;
}

// « Scroll to » Figma : défilement fluide jusqu'à la section (Lenis s'il est actif).
function scrollToSection(target) {
  // prototype « défilement horizontal » : un chapitre s'ouvre à sa place dans la bande (js/horizontal.js)
  if (window.__hs && window.__hs.open(target)) return;
  if (lenis) {
    lenis.scrollTo(target, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    return;
  }
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    renderClock(clock);
    setInterval(() => renderClock(clock), 1000);
  }

  startSmoothScroll();

  // Vidéos : rien n'est téléchargé à l'ouverture (preload="none"). Elles se chargent et se
  // lancent à l'approche de l'écran, et se mettent en pause quand elles en sortent.
  const videos = document.querySelectorAll("video[data-autoplay]");
  if ("IntersectionObserver" in window && videos.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) target.play().catch(() => {});
          else target.pause();
        });
      },
      { rootMargin: "600px 0px" }
    );
    videos.forEach((video) => observer.observe(video));
  }

  // navigation de l'en-tête (Prologue, Chapitres, Aujourd'hui) : défilement fluide jusqu'à la section
  document.querySelectorAll('.nav a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      scrollToSection(target);
    });
  });

  document.querySelectorAll(".row[data-target]").forEach((row) => {
    const go = () => {
      const target = document.getElementById(row.dataset.target);
      if (target) scrollToSection(target);
    };
    row.addEventListener("click", go);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  });
});
