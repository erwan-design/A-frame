// Vent dans les arbres : la photo du héros est redessinée en WebGL et son feuillage ondule.
// La structure en A et le sol restent immobiles (masque dans le shader). La toile hérite de
// la classe .hero__photo : même cadrage, même opacité, même parallax que la photo d'origine.
// Sans WebGL, ou si le système demande de réduire les animations, la photo reste telle quelle.

(() => {
  if (!document.documentElement.classList.contains("motion")) return;
  const bg = document.querySelector(".hero__bg");
  const img = bg && bg.querySelector("img.hero__photo");
  if (!img) return;

  const VERTEX = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Coordonnées image normalisées, y vers le bas. Triangle de la structure relevé sur la photo.
  const FRAGMENT = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_canvas;
    uniform vec2 u_image;
    uniform float u_time;
    uniform float u_strength;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p *= 2.03;
        amplitude *= 0.5;
      }
      return value;
    }
    // distance signée à un triangle (négative à l'intérieur)
    float sdTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
      vec2 e0 = b - a, e1 = c - b, e2 = a - c;
      vec2 v0 = p - a, v1 = p - b, v2 = p - c;
      vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
      vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
      vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
      float s = sign(e0.x * e2.y - e0.y * e2.x);
      vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                       vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                       vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
      return -sqrt(d.x) * sign(d.y);
    }

    void main() {
      // object-fit: cover, centré
      float canvasRatio = u_canvas.x / u_canvas.y;
      float imageRatio = u_image.x / u_image.y;
      vec2 fit = canvasRatio > imageRatio ? vec2(1.0, imageRatio / canvasRatio) : vec2(canvasRatio / imageRatio, 1.0);
      vec2 uv = (v_uv - 0.5) * fit + 0.5;

      // le feuillage bouge d'autant plus qu'il est haut ; le sol est immobile
      float foliage = smoothstep(0.62, 0.16, uv.y);
      vec2 aspect = vec2(imageRatio, 1.0);
      float frame = sdTriangle(uv * aspect, vec2(0.5, 0.0) * aspect, vec2(0.27, 0.7) * aspect, vec2(0.745, 0.7) * aspect);
      float away = smoothstep(0.015, 0.09, frame);

      float t = u_time;
      vec2 q = uv * vec2(3.0, 2.2);
      float n1 = fbm(q + vec2(t * 0.16, -t * 0.05));
      float n2 = fbm(q * 1.7 + vec2(-t * 0.11, t * 0.08) + 4.3);
      float gust = 0.65 + 0.35 * sin(t * 0.33 + uv.x * 2.4);
      float sway = sin(t * 1.05 + uv.y * 7.0 + n1 * 6.2831) * 0.55 + (n2 - 0.5) * 1.4;
      float weight = foliage * away * gust * u_strength;
      vec2 offset = vec2(sway * 0.0048, (n1 - 0.5) * 0.0022) * weight;

      gl_FragColor = vec4(texture2D(u_texture, uv + offset).rgb, 1.0);
    }
  `;

  const canvas = document.createElement("canvas");
  canvas.className = "hero__photo hero__photo--gl";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn("Vent WebGL désactivé :", error);
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = { canvas: uniform("u_canvas"), image: uniform("u_image"), time: uniform("u_time"), strength: uniform("u_strength") };

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(u.canvas, canvas.clientWidth, canvas.clientHeight);
  };

  let visible = true;
  let running = false;
  let startedAt = 0;

  const draw = (now) => {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    if (!startedAt) startedAt = now;
    const elapsed = (now - startedAt) / 1000;
    gl.uniform1f(u.time, elapsed + 7.0);
    gl.uniform1f(u.strength, Math.min(1, elapsed / 2.0) ** 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(draw);
  };
  const start = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    requestAnimationFrame(draw);
  };

  const ready = img.complete && img.naturalWidth ? Promise.resolve() : img.decode();
  ready
    .then(() => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform2f(u.image, img.naturalWidth, img.naturalHeight);
      img.after(canvas);
      resize();
      gl.uniform1f(u.time, 7.0);
      gl.uniform1f(u.strength, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(() => bg.classList.add("has-wind"));

      new ResizeObserver(resize).observe(canvas);
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        start();
      }).observe(bg);
      document.addEventListener("visibilitychange", start);
      canvas.addEventListener("webglcontextlost", () => bg.classList.remove("has-wind"));
      start();
    })
    .catch(() => {});
})();
