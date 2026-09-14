// Ambiance calme de forêt au bord de l'eau, entièrement synthétisée (Web Audio API, aucun
// fichier) : léger bruissement de feuilles, souffle très doux, murmure de la rivière à gauche,
// quelques oiseaux au loin dans un peu d'écho. Utilisée par js/story.js (bouton son du repère).
//
// window.forestAmbience(context, destination) → { schedule(until) }
// schedule() programme rafales et chants d'oiseaux jusqu'à l'instant `until` (secondes du
// contexte) : appelée régulièrement en direct, ou une fois pour un rendu hors ligne.

(() => {
  const random = (min, max) => min + Math.random() * (max - min);

  const noiseBuffer = (context, seconds, color) => {
    const length = Math.round(context.sampleRate * seconds);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, brown = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (color === "brown") {
          brown = (brown + 0.02 * white) / 1.02;
          data[i] = brown * 3.5;
        } else {
          // bruit rose (filtre de Paul Kellet) : le souffle naturel du feuillage
          b0 = 0.99765 * b0 + white * 0.099046;
          b1 = 0.963 * b1 + white * 0.2965164;
          b2 = 0.57 * b2 + white * 1.0526913;
          data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
        }
      }
      // fondu aux extrémités : pas de clic quand la boucle repart
      const fade = Math.min(2000, length / 4);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        data[length - 1 - i] = data[length - 1 - i] * k + data[i] * (1 - k);
      }
    }
    return buffer;
  };

  // signal lent et aléatoire, pour faire trembler un volume (clapotis, frémissement des feuilles)
  const flutterBuffer = (context, seconds, rate) => {
    const length = Math.round(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    const step = Math.round(context.sampleRate / rate);
    let from = 0, to = random(-1, 1);
    for (let i = 0; i < length; i++) {
      if (i % step === 0) { from = to; to = random(-1, 1); }
      const k = (i % step) / step;
      data[i] = from + (to - from) * (k * k * (3 - 2 * k));
    }
    return buffer;
  };

  const loop = (context, buffer) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  };

  const filter = (context, type, frequency, q = 0.707) => {
    const node = context.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };

  const gain = (context, value) => {
    const node = context.createGain();
    node.gain.value = value;
    return node;
  };

  const panner = (context, pan) => {
    if (!context.createStereoPanner) return context.createGain();
    const node = context.createStereoPanner();
    node.pan.value = pan;
    return node;
  };

  // réponse impulsionnelle d'un sous-bois : bruit qui décroît en 2 s
  const reverbBuffer = (context) => {
    const length = Math.round(context.sampleRate * 2);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
    }
    return buffer;
  };

  window.forestAmbience = (context, destination) => {
    const pink = noiseBuffer(context, 7.3, "pink");
    const brown = noiseBuffer(context, 6.1, "brown");
    const started = [];
    const start = (source) => { started.push(source); return source; };

    // Feuillage : léger bruissement, filtré entre 900 Hz et ~3 kHz (au-delà, ça siffle comme une tempête)
    const leavesSource = start(loop(context, pink));
    const leavesLow = filter(context, "highpass", 900);
    const leavesHigh = filter(context, "lowpass", 3000);
    const leaves = gain(context, 0.07);
    const leavesFlutter = start(loop(context, flutterBuffer(context, 5.7, 4)));
    const leavesFlutterDepth = gain(context, 0.02);
    leavesFlutter.connect(leavesFlutterDepth).connect(leaves.gain);
    leavesSource.connect(leavesLow).connect(leavesHigh).connect(leaves).connect(destination);

    // Souffle grave, à peine perceptible
    const windSource = start(loop(context, brown));
    const windBody = filter(context, "lowpass", 300);
    const wind = gain(context, 0.07);
    windSource.connect(windBody).connect(wind).connect(destination);

    // Rivière, sur la gauche : un murmure doux et quelques clapotis
    const river = panner(context, -0.4);
    river.connect(destination);
    const riverSource = start(loop(context, pink));
    riverSource.playbackRate.value = 0.93;
    const riverBand = filter(context, "bandpass", 700, 0.7);
    const riverGain = gain(context, 0.1);
    const riverFlutter = start(loop(context, flutterBuffer(context, 4.3, 12)));
    const riverFlutterDepth = gain(context, 0.03);
    riverFlutter.connect(riverFlutterDepth).connect(riverGain.gain);
    riverSource.connect(riverBand).connect(riverGain).connect(river);

    const splashBand = filter(context, "bandpass", 2300, 1.4);
    const splashGain = gain(context, 0.015);
    const splashFlutter = start(loop(context, flutterBuffer(context, 3.1, 18)));
    const splashFlutterDepth = gain(context, 0.015);
    splashFlutter.connect(splashFlutterDepth).connect(splashGain.gain);
    riverSource.connect(splashBand).connect(splashGain).connect(river);

    // Oiseaux : un peu étouffés par la distance, avec l'écho du sous-bois
    const birds = filter(context, "lowpass", 6000);
    const birdsDry = gain(context, 0.55);
    const reverb = context.createConvolver();
    reverb.buffer = reverbBuffer(context);
    const birdsWet = gain(context, 0.3);
    birds.connect(birdsDry).connect(destination);
    birds.connect(reverb).connect(birdsWet).connect(destination);

    started.forEach((source) => source.start(0));

    const note = (time, duration, pan, level, shape) => {
      const osc = context.createOscillator();
      osc.type = "sine";
      shape(osc.frequency, time, duration);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.02, duration * 0.25));
      envelope.gain.setTargetAtTime(0, time + duration * 0.55, duration * 0.18);
      const place = panner(context, pan);
      osc.connect(envelope).connect(place).connect(birds);
      osc.start(time);
      osc.stop(time + duration + 0.3);
    };

    // trois manières de chanter, choisies au hasard
    const songs = [
      // sifflement en deux notes descendantes
      (time, pan, level) => {
        const pitch = random(2500, 3300);
        [0, 0.3].forEach((offset, i) => {
          note(time + offset, 0.22, pan, level, (f, t, d) => {
            f.setValueAtTime(pitch * (i ? 0.9 : 1), t);
            f.exponentialRampToValueAtTime(pitch * (i ? 0.72 : 0.84), t + d);
          });
        });
        return 0.6;
      },
      // série de petits cris qui montent
      (time, pan, level) => {
        const count = Math.round(random(4, 9));
        const base = random(3900, 5000);
        let t = time;
        for (let i = 0; i < count; i++) {
          const pitch = base * random(0.95, 1.05);
          note(t, 0.06, pan, level * 0.8, (f, t0, d) => {
            f.setValueAtTime(pitch, t0);
            f.exponentialRampToValueAtTime(pitch * 1.18, t0 + d);
          });
          t += random(0.09, 0.13);
        }
        return t - time;
      },
      // trille rapide
      (time, pan, level) => {
        const duration = random(0.5, 0.9);
        const pitch = random(3400, 4300);
        const osc = context.createOscillator();
        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.linearRampToValueAtTime(pitch * random(0.85, 1.1), time + duration);
        const vibrato = context.createOscillator();
        vibrato.frequency.value = random(28, 42);
        const depth = gain(context, pitch * 0.12);
        vibrato.connect(depth).connect(osc.frequency);
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(level * 0.6, time + 0.08);
        envelope.gain.setValueAtTime(level * 0.6, time + duration - 0.12);
        envelope.gain.linearRampToValueAtTime(0, time + duration);
        osc.connect(envelope).connect(panner(context, pan)).connect(birds);
        [osc, vibrato].forEach((o) => { o.start(time); o.stop(time + duration + 0.05); });
        return duration;
      },
    ];

    let nextGust = 0;
    let nextBird = 2.5;
    return {
      schedule(until) {
        // brise : toutes les 7 à 14 s, les feuilles bruissent un peu plus ou un peu moins
        while (nextGust < until) {
          const at = nextGust + random(7, 14);
          const strength = random(0, 1);
          leaves.gain.linearRampToValueAtTime(0.04 + strength * 0.06, at);
          leavesHigh.frequency.linearRampToValueAtTime(2400 + strength * 1000, at);
          wind.gain.linearRampToValueAtTime(0.04 + strength * 0.05, at);
          nextGust = at;
        }
        // oiseaux : un chant toutes les 6 à 16 s, parfois une réponse de l'autre côté
        while (nextBird < until) {
          const pan = random(-0.8, 0.8);
          const level = random(0.05, 0.11);
          const length = songs[Math.floor(Math.random() * songs.length)](nextBird, pan, level);
          if (Math.random() < 0.35) {
            songs[Math.floor(Math.random() * songs.length)](nextBird + length + random(0.4, 1.2), -pan * 0.8, level * 0.7);
          }
          nextBird += length + random(6, 16);
        }
      },
    };
  };
})();
