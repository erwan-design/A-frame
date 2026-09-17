// Horloge virtuelle, injectée avant les scripts du site : le temps n'avance que quand
// l'enregistreur appelle window.__advance(ms). Tout ce qui dépend du temps suit :
// requestAnimationFrame (Lenis, repère, étiquettes…), setTimeout / setInterval (horloge,
// apparitions), animations CSS et Web Animations (repris image par image), vidéos.
// Les animations pilotées par le défilement (parallaxe) suivent le défilement, pas l'horloge.
(() => {
  let now = 0;
  const startDate = Date.now();
  const realTimeout = window.setTimeout.bind(window);
  performance.now = () => now;
  Date.now = () => startDate + Math.round(now);

  let rafSeq = 0;
  let rafQueue = new Map();
  window.requestAnimationFrame = (cb) => { rafQueue.set(++rafSeq, cb); return rafSeq; };
  window.cancelAnimationFrame = (id) => { rafQueue.delete(id); };

  let timerSeq = 1e6;
  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...args) => {
    timers.set(++timerSeq, { at: now + Math.max(0, +ms || 0), fn, args });
    return timerSeq;
  };
  window.setInterval = (fn, ms = 0, ...args) => {
    const every = Math.max(1, +ms || 0);
    timers.set(++timerSeq, { at: now + every, fn, args, every });
    return timerSeq;
  };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  // vidéos : lecture simulée, position recalée sur l'horloge à chaque image
  HTMLMediaElement.prototype.play = function () {
    if (!this.__playing) { this.__playing = true; this.__from = now - (this.currentTime || 0) * 1000; }
    return Promise.resolve();
  };
  HTMLMediaElement.prototype.pause = function () { this.__playing = false; };

  const runTimers = () => {
    for (;;) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= now && (!next || t.at < next[1].at)) next = [id, t];
      if (!next) return;
      const [id, t] = next;
      if (t.every) t.at += t.every; else timers.delete(id);
      try { typeof t.fn === "function" ? t.fn(...t.args) : null; } catch (e) { console.error(e); }
    }
  };

  const syncAnimations = () => {
    for (const a of document.getAnimations()) {
      if (a.timeline && a.timeline !== document.timeline) continue; // défilement
      if (a.__start === undefined) { a.__start = now; a.pause(); }
      const t = now - a.__start;
      const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
      if (Number.isFinite(end) && t >= end) { try { a.finish(); } catch (e) {} }
      else a.currentTime = t;
    }
  };

  const seekVideos = () => Promise.all([...document.querySelectorAll("video")].map((v) => {
    if (!v.__playing || !(v.duration > 0)) return null;
    const target = (((now - v.__from) / 1000) % v.duration + v.duration) % v.duration;
    if (Math.abs(v.currentTime - target) < 0.004) return null;
    return new Promise((resolve) => {
      const done = () => { v.removeEventListener("seeked", done); resolve(); };
      v.addEventListener("seeked", done);
      v.currentTime = target;
      realTimeout(done, 400);
    });
  }));

  window.__advance = async (ms) => {
    now += ms;
    runTimers();
    const queue = rafQueue;
    rafQueue = new Map();
    queue.forEach((cb) => { try { cb(now); } catch (e) { console.error(e); } });
    syncAnimations();
    await seekVideos();
    return now;
  };
  window.__clock = () => now;
})();
