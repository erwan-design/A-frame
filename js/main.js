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

// « Scroll to » Figma : le runtime délègue au défilement fluide natif du navigateur.
function scrollToSection(target) {
  window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    renderClock(clock);
    setInterval(() => renderClock(clock), 1000);
  }

  // Les trois vidéos tournent en boucle : hors écran, on les met en pause pour que le
  // décodage ne ralentisse pas le défilement.
  const videos = document.querySelectorAll("video[autoplay]");
  if ("IntersectionObserver" in window && videos.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (isIntersecting) target.play().catch(() => {});
          else target.pause();
        });
      },
      { rootMargin: "200px 0px" }
    );
    videos.forEach((video) => observer.observe(video));
  }

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
