import * as THREE from 'three';
import * as P from './paint.js';
import { createFeather, prepareFeatherArt } from './feather.js';
import { rigGLSL, CROP, SEAT_X, SEAT_Y } from './krishna.js';
import { TIME_GRADE } from './grade.js';
import { createPost } from './post.js';

THREE.ColorManagement.enabled = false;

// Everything renders in sRGB "as painted" — textures are uploaded without
// colour-space conversion and shaders output raw values, so the canvas
// paintings look exactly as authored. One sun (upper left) lights the world:
// it is painted into every texture and drives the feather's real shading.

const vec3 = (h) => {
  const [r, g, b] = P.hex(h);
  return new THREE.Vector3(r / 255, g / 255, b / 255);
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ shaders

const FOG = /* glsl */ `
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uExposure;
  uniform float uFocus; uniform float uDof;
  float fogF(float d) { float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0); return f * (2.0 - f); }
  // circle of confusion relative to the focus plane → extra mip bias (cheap depth of field)
  float dofBias(float d) { return uDof * clamp(abs(1.0 - uFocus / max(d, 0.5)), 0.0, 1.4); }
  ${TIME_GRADE}
`;

const BILLBOARD_VS = /* glsl */ `
  uniform float uTime; uniform float uSway; uniform float uPhase;
  varying vec2 vUv; varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    float bend = uv.y * uv.y * uSway;
    p.x += (sin(uTime * 0.8 + uPhase) * 0.7 + sin(uTime * 1.9 + uPhase * 1.3) * 0.3) * bend;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const BILLBOARD_FS = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uTint; uniform float uOpacity; uniform float uFogAmt; uniform float uSharp; uniform float uGrade;
  ${FOG}
  varying vec2 vUv; varying float vDepth;
  void main() {
    vec4 t = texture2D(uMap, vUv, dofBias(vDepth) * (1.0 - uSharp));
    if (t.a < 0.012) discard;
    vec3 c = t.rgb * uTint * uExposure;
    c = mix(c, timeGrade(c), uGrade);
    c = mix(c, uFogColor * t.a, fogF(vDepth) * uFogAmt);
    gl_FragColor = vec4(c, t.a) * uOpacity;
  }
`;

const LEAF_VS = /* glsl */ `
  attribute float aIdx;
  varying vec2 vUv; varying float vDepth;
  void main() {
    vUv = vec2((uv.x + aIdx) / 4.0, uv.y);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const RAY_FS = /* glsl */ `
  uniform sampler2D uMap; uniform float uOpacity; uniform float uRays; uniform float uTime; uniform float uPhase;
  ${FOG}
  varying vec2 vUv; varying float vDepth;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    float shimmer = 0.72 + 0.28 * sin(uTime * 0.35 + uPhase) * sin(uTime * 0.13 + uPhase * 2.0);
    float fade = 1.0 - fogF(vDepth) * 0.7;
    vec3 tone = mix(vec3(1.0), vec3(0.5, 0.64, 0.95) * 0.5, uNight) * mix(vec3(1.0), vec3(1.1, 0.88, 0.7), uDusk);
    gl_FragColor = vec4(t.rgb * tone * uOpacity * uRays * shimmer * fade * uExposure, 0.0);
  }
`;

const GROUND_VS = /* glsl */ `
  uniform vec2 uRepeat;
  varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
  void main() {
    vUv = uv * uRepeat;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;


// particles: size, softness and brightness follow the same depth of field
const POINTS_VS = /* glsl */ `
  attribute float aSeed;
  uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uSize; uniform float uPR;
  uniform float uAhead; uniform float uDrift; uniform float uFadeFar; uniform float uFocus; uniform float uDof;
  varying float vA; varying float vSoft;
  void main() {
    vec3 p = position * uBox;
    p += vec3(sin(uTime * 0.23 + aSeed * 31.0) * 1.4, uTime * uDrift * (0.3 + aSeed), cos(uTime * 0.19 + aSeed * 17.0) * 1.4) * (uBox.z < 8.0 ? 0.35 : 1.0);
    vec3 center = uCam + vec3(0.0, 0.0, -uAhead);
    vec3 rel = mod(p - center + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = viewMatrix * vec4(center + rel, 1.0);
    float d = -mv.z;
    float blur = clamp(abs(1.0 - uFocus / max(d, 0.5)), 0.0, 1.5) * uDof;
    gl_PointSize = uSize * uPR * (0.35 + aSeed) * (30.0 / max(d, 0.6)) * (1.0 + blur * 0.9);
    vSoft = mix(0.2, 0.5, clamp(blur, 0.0, 1.0));
    vA = smoothstep(1.2, 4.0, d) * (1.0 - smoothstep(uFadeFar * 0.7, uFadeFar, d))
       * (0.55 + 0.45 * sin(uTime * 1.1 + aSeed * 40.0)) / (1.0 + blur * 1.2);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINTS_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vA; varying float vSoft;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.5 - vSoft, d);
    gl_FragColor = vec4(uColor * a * vA * uOpacity, 0.0);
  }
`;

// stars: fixed points in the night sky, twinkling
const STAR_VS = /* glsl */ `
  attribute float aSeed;
  uniform float uTime; uniform float uPR; uniform float uNight;
  varying float vA;
  void main() {
    vA = uNight * (0.45 + 0.55 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0) * 0.5 + 0.275);
    gl_PointSize = (1.2 + aSeed * 2.2) * uPR;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;
const STAR_FS = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * smoothstep(0.5, 0.1, d) * vA, 0.0);
  }
`;

// fireflies: a soft glow that wanders, with slow, brief brightenings
const FIREFLY_VS = /* glsl */ `
  attribute float aSeed;
  uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform float uSize; uniform float uPR;
  uniform float uCeil; uniform float uFadeFar; uniform vec3 uAttract; uniform float uAttractAmt;
  varying float vGlow;
  void main() {
    float s = aSeed * 6.2831;
    vec3 p = position * uBox;
    p += vec3(sin(uTime * 0.31 + s * 3.1) * 2.2 + sin(uTime * 0.73 + s) * 0.9,
              sin(uTime * 0.43 + s * 1.7) * 1.1 + sin(uTime * 1.3 + s * 4.0) * 0.25,
              cos(uTime * 0.27 + s * 2.3) * 2.0);
    vec3 wp = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
    // curious ones drift partway toward the cursor
    vec3 toC = uAttract - wp;
    wp += toC * uAttractAmt * smoothstep(10.0, 0.0, length(toC)) * (0.25 + 0.45 * aSeed);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    float d = -mv.z;
    float pulse = pow(max(0.0, sin(uTime * (0.55 + aSeed * 0.9) + s * 5.0)), 8.0);
    vGlow = (0.32 + 0.95 * pulse)
          * smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(uFadeFar * 0.7, uFadeFar, d))
          * (1.0 - smoothstep(uCeil - 12.0, uCeil, wp.y)) * smoothstep(0.2, 1.0, wp.y);
    gl_PointSize = uSize * uPR * (0.7 + aSeed * 0.6) * (30.0 / max(d, 0.8)) * (0.85 + pulse * 0.4);
    gl_Position = projectionMatrix * mv;
  }
`;

const FIREFLY_FS = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uCore; uniform float uOpacity;
  varying float vGlow;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r2 = dot(q, q) * 4.0;
    vec3 c = uCore * exp(-r2 * 14.0) * 1.4 + uColor * exp(-r2 * 3.0) * 0.75;
    gl_FragColor = vec4(c * vGlow * uOpacity, 0.0);
  }
`;

// Krishna: the cut-out artwork, animated by a local 2D rig and graded into
// the forest's light and atmosphere.
// light that isn't painted in: fireflies glowing on whatever is near them
const FIREFLY_LIGHT = /* glsl */ `
  uniform vec4 uFly[8];
  vec3 fireflyLight(vec3 wp, float reach) {
    float acc = 0.0;
    for (int i = 0; i < 8; i++) { vec3 d = wp - uFly[i].xyz; acc += uFly[i].w * exp(-dot(d, d) / reach); }
    return acc * vec3(0.78, 1.0, 0.42);
  }
`;

const GROUND_FS = /* glsl */ `
  uniform sampler2D uMap; uniform float uTime;
  ${FOG}
  ${FIREFLY_LIGHT}
  varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
  void main() {
    vec3 c = texture2D(uMap, vUv, dofBias(vDepth) * 0.6).rgb;
    vec2 w = vWorld.xz;
    float d = sin(w.x * 0.33 + uTime * 0.18) * sin(w.y * 0.29 - uTime * 0.13)
            + 0.6 * sin((w.x + w.y) * 0.12 + uTime * 0.09) + 0.4 * sin(w.x * 0.9 - w.y * 0.7 + uTime * 0.25);
    float dapple = smoothstep(0.35, 1.25, d);
    dapple *= 1.0 - uNight * 0.85;
    c *= 0.78 + 0.42 * dapple;
    c += vec3(0.07, 0.06, 0.0) * dapple;
    c = timeGrade(c * uExposure);
    c += fireflyLight(vWorld, 6.0) * 0.3 * uNight;
    c = mix(c, uFogColor, fogF(vDepth));
    gl_FragColor = vec4(c, 1.0);
  }
`;

const SCENE_VS = /* glsl */ `
  varying vec2 vUv; varying float vDepth; varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const SCENE_FS = /* glsl */ `
  uniform sampler2D uMap; uniform float uTime; uniform float uOpacity; uniform float uHaze; uniform float uRigAmt;
  ${FOG}
  ${FIREFLY_LIGHT}
  varying vec2 vUv; varying float vDepth; varying vec3 vWorld;
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // sunlight through moving leaves: soft-edged patches that drift and sway
  float leafLight(vec2 w, float t) {
    vec2 q = w * 0.55 + vec2(t * 0.05, -t * 0.03);
    q += 0.35 * vec2(sin(t * 0.6 + w.y * 0.8), cos(t * 0.5 + w.x * 0.7));
    float n = vnoise(q * 1.7) * 0.65 + vnoise(q * 3.9 + 7.1) * 0.35;
    return smoothstep(0.42, 0.64, n);
  }
  ${rigGLSL()}
  void main() {
    const vec4 CROP = vec4(${CROP.x}.0, ${CROP.y}.0, ${CROP.w}.0, ${CROP.h}.0);
    vec2 px = CROP.xy + vec2(vUv.x, 1.0 - vUv.y) * CROP.zw;
    px = rig(px, uTime);
    vec2 uv = (px - CROP.xy) / CROP.zw;
    uv.y = 1.0 - uv.y;
    vec4 t = texture2D(uMap, uv);
    float a = t.a * uOpacity;
    if (a < 0.004) discard;
    vec3 col = t.rgb / max(t.a, 0.001);
    // same palette as the forest: a touch less saturated and warm, shadows lifted by green bounce
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(vec3(lum), col, 0.86);
    col *= vec3(0.97, 1.0, 0.99);
    col += vec3(0.018, 0.034, 0.01) * (1.0 - lum);
    // dappled sunlight moving across him as the leaves above sway
    float day = (1.0 - uNight) * (1.0 - 0.45 * uDusk);
    float lit = leafLight(vWorld.xy, uTime);
    col *= mix(1.0, mix(0.8, 1.1, lit), day);
    col += vec3(0.05, 0.035, 0.0) * lit * day;
    col *= uExposure;
    col *= mix(vec3(1.0), vec3(1.06, 0.94, 0.82), uDusk);
    vec3 moonlit = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 0.62) * vec3(0.62, 0.74, 1.0) * 0.62;
    col = mix(col, moonlit, uNight);
    col += fireflyLight(vWorld, 2.4) * 0.85 * uNight;
    col = mix(col, uFogColor, clamp(0.07 + fogF(vDepth) * 0.5 + uHaze, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }
`;

// ------------------------------------------------------------ camera rig ---

function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

function makeTrack(keys) {
  const props = ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'fov'];
  const xs = keys.map((k) => k.p);
  const fns = {};
  for (const prop of props) {
    const ys = [];
    keys.forEach((k, i) => ys.push(k[prop] ?? (i ? ys[i - 1] : 0)));
    fns[prop] = monotone(xs, ys);
  }
  return (p) => {
    const o = {};
    for (const prop of props) o[prop] = fns[prop](p);
    return o;
  };
}

// The camera descends from the sky, through the canopy and understorey, then
// eases right and forward to reveal the ancient tree, settling slowly.
const LAYOUTS = {
  wide: {
    image: { x: 6.5, z: -6 },
    moon: { x: 140, y: 84, z: -300, size: 58 },
    keys: [
      { p: 0, x: 0, y: 112, z: 40, pitch: 0.035, yaw: 0, roll: 0, fov: 45 },
      { p: 0.07, x: -0.5, y: 109, pitch: 0.012, yaw: 0.004, roll: 0.004 },
      { p: 0.2, x: -2, y: 95, pitch: -0.02, yaw: 0.014, roll: -0.006 },
      { p: 0.36, x: -5, y: 74, pitch: -0.01, yaw: 0.02, roll: 0.005 },
      { p: 0.43, x: -7, y: 59, pitch: -0.04, yaw: 0.024 },
      { p: 0.5, x: -8.4, y: 55.5, z: 39, pitch: -0.07, yaw: 0.028, roll: -0.004 },
      { p: 0.56, x: -10.5, y: 46, pitch: -0.03 },
      { p: 0.63, x: -13, y: 34, z: 38, pitch: -0.01, yaw: 0.02, roll: 0.004 },
      { p: 0.76, x: -16, y: 21, z: 35, pitch: -0.03, yaw: 0.004, roll: 0 },
      { p: 0.88, x: -6.5, y: 13, z: 30.5, pitch: -0.05, yaw: -0.006 },
      { p: 0.95, x: -0.2, y: 9.4, z: 25.6, pitch: -0.07, yaw: -0.002 },
      { p: 1, x: 0.8, y: 8.8, z: 24, pitch: -0.075, yaw: 0, roll: 0, fov: 43 },
    ],
    // moments where the feather drifts behind a leafy branch
    occluders: [
      { p: 0.15, kind: 'branch', gap: 5, reach: 0.5 },
      { p: 0.26, kind: 'branch', gap: 4, reach: 1.6, behind: true },
      { p: 0.35, kind: 'branch', gap: 5, reach: -0.2 },
    ],
  },
  tall: {
    image: { x: 0, z: -6 },
    moon: { x: 24, y: 40, z: -300, size: 50 },
    keys: [
      { p: 0, x: 0, y: 112, z: 40, pitch: -0.07, yaw: 0, roll: 0, fov: 56 },
      { p: 0.1, x: -0.5, y: 108, pitch: -0.05 },
      { p: 0.25, x: -2, y: 92, pitch: -0.01 },
      { p: 0.42, x: -4, y: 70, pitch: 0 },
      { p: 0.49, x: -4.8, y: 57, pitch: -0.06 },
      { p: 0.55, x: -5.4, y: 53.5, pitch: -0.08 },
      { p: 0.6, x: -6, y: 45, z: 39, pitch: -0.02 },
      { p: 0.72, x: -8, y: 28, z: 37, pitch: -0.03 },
      { p: 0.86, x: -5, y: 19, z: 33, pitch: -0.14 },
      { p: 0.95, x: -1, y: 16.9, z: 30.6, pitch: -0.3 },
      { p: 1, x: 0, y: 16.5, z: 30, pitch: -0.34, yaw: 0, roll: 0, fov: 52 },
    ],
    occluders: [
      { p: 0.18, kind: 'branch', gap: 5, reach: 0.4 },
      { p: 0.3, kind: 'branch', gap: 4, reach: 1.2, behind: true },
    ],
  },
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ----------------------------------------------------------------- world ---

export async function createWorld(canvas, { quality = 'high', imageUrl, featherUrl, onProgress = () => {}, onLost = () => {} } = {}) {
  const hi = quality === 'high';
  const mid = quality === 'medium';
  const Q = hi ? 1 : mid ? 0.7 : 0.45;
  // phones get the same forest painted at a smaller size (a quarter of the memory
  // on the low tier), so the GPU is never asked for more than it can hold
  const lean = !hi && !mid;
  const TS = hi ? 1 : mid ? 0.8 : 0.5;
  const px = (n) => Math.max(32, Math.round(n * TS));

  // antialiasing happens in the post pipeline's multisampled scene target
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: lean ? 'default' : 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : mid ? 1.5 : 1.25));
  // if the GPU gives up (a driver reset, memory pressure), say so, so the page can
  // fall back to the still forest instead of freezing on a dead canvas
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost(); }, { once: true });
  const post = createPost(renderer, { quality });
  renderer.setClearColor(0xb9c78f, 1);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1400);
  camera.rotation.order = 'YXZ';

  const U = {
    uTime: { value: 0 },
    uFogColor: { value: vec3('#c9d6bd') },
    uFogNear: { value: 40 },
    uFogFar: { value: 460 },
    uExposure: { value: 1 },
    uRays: { value: 0.5 },
    uFocus: { value: 30 },
    uDof: { value: hi ? 1.5 : 1 },
    uNight: { value: 0 },
    uDusk: { value: 0 },
    uFly: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  };
  // the one sun: upper right (as in Krishna's artwork), a little toward the viewer, with green bounce
  const sun = {
    dir: { value: new THREE.Vector3(0.5, 0.75, 0.45).normalize() },
    color: { value: new THREE.Vector3(0.92, 0.86, 0.72) },
    ambient: { value: new THREE.Vector3(0.36, 0.42, 0.3) },
  };

  // --- paint every texture, yielding so the loader keeps animating
  const T = {};
  const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
  const jobs = [
    ['sky', () => P.paintSky(px(512), px(2048))],
    ['distant', () => P.paintDistant(5, px(2048), px(512))],
    ['tree0', () => P.paintTree(101, px(768), px(1024), { clump: 0.1, spread: 2.0, trunk: 0.07, trunkLen: 0.42 })],
    ['tree1', () => P.paintTree(202, px(512), px(1024), { split: 2, trunk: 0.1, spread: 1.2, trunkLen: 0.46, clump: 0.12 })],
    ['tree2', () => P.paintTree(303, px(640), px(1024), { trunk: 0.075, clump: 0.1, trunkLen: 0.5, ratio: 0.62, spread: 1.6 })],
    ['treeBig', () => P.paintTree(404, px(1024), px(2048), { trunk: 0.12, clump: 0.12, trunkLen: 0.44, density: 1.1 })],
    ['clump0', () => P.paintClump(11, px(512))],
    ['clump1', () => P.paintClump(12, px(512), { palette: P.LEAF_BACK, shade: 0.15 })],
    ['clump2', () => P.paintClump(13, px(512), { shade: -0.1 })],
    ['branch0', () => P.paintBranch(21, px(1024), px(512))],
    ['branch1', () => P.paintBranch(22, px(1024), px(512), { y: 0.5, angle: -0.05 })],
    ['ground', () => P.paintGround(41, px(1024))],
    ['ray', () => P.paintRay()],
    ['leaves', () => P.paintLeafAtlas()],
    ['bird', () => P.paintBird()],
  ];
  // only needed further down the page: painted after the first view is up,
  // with transparent stand-ins (of the right proportions) until then
  const later = [
    ['shadow', [256, 128], () => P.paintShadow()],
    ['grass0', [512, 256], () => P.paintGrass(31, px(512), px(256))],
    ['grass1', [512, 256], () => P.paintGrass(32, px(512), px(256), { light: 0.25, flowers: 8 })],
    ['grassB', [512, 256], () => P.blurred(T.grass1, 3)],
    ...Object.entries(P.BUTTERFLIES).map(([k, s]) => ['bf_' + k, [128, 96], () => P.paintButterfly(s)]),
    ['moon', [256, 256], () => P.paintMoon()],
    ['ancient', [1024, 1536], () => P.paintTree(505, px(1024), px(1536), {
      trunk: 0.15, trunkLen: 0.55, split: 3, spread: 1.9, flare: 2.2, clump: 0.1, minLeafDepth: 2, density: 1.1,
      barkDetail: P.paintBarkDetail(), barkScale: 1, barkDetailAmt: 1,
    })],
  ];
  const imagePromise = loadImage(imageUrl);
  const featherPromise = loadImage(featherUrl);
  for (let i = 0; i < jobs.length; i++) {
    const [name, fn] = jobs[i];
    T[name] = fn();
    onProgress((i + 1) / (jobs.length + 2));
    await yieldFrame();
  }
  T.clumpB0 = P.blurred(T.clump0, 5);
  T.clumpB1 = P.blurred(T.clump1, 5);
  T.branchB0 = P.blurred(T.branch0, 3);
  T.branchB1 = P.blurred(T.branch1, 3);
  const featherArt = prepareFeatherArt(await featherPromise, hi ? 1536 : mid ? 1024 : 768);
  T.feather = featherArt.canvas;
  onProgress(1);

  const toTexture = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    t.premultiplyAlpha = true;
    t.anisotropy = aniso;
    t.aspect = c.width / c.height;
    return t;
  };
  const TX = {};
  for (const [k, c] of Object.entries(T)) TX[k] = toTexture(c);
  TX.ground.wrapS = TX.ground.wrapT = THREE.RepeatWrapping;

  // on phones, once a texture is on the GPU its painted canvas is emptied, so the
  // forest isn't held twice (Android keeps large 2D canvases in GPU memory too)
  function release(t) {
    if (!lean || !(t.image instanceof HTMLCanvasElement) || t.image.width <= 2) return;
    renderer.initTexture(t);
    t.image.width = t.image.height = 1;
  }
  for (const [k, t] of Object.entries(TX)) if (k !== 'feather') release(t);

  // stand-ins for textures that are still to come; materials using them are
  // remembered and re-pointed once the real texture is ready
  const waiting = new Map();
  const blank = document.createElement('canvas');
  blank.width = blank.height = 2;
  for (const [name, [pw, ph]] of later) {
    const t = toTexture(blank);
    t.aspect = pw / ph;
    TX[name] = t;
    waiting.set(name, []);
  }
  TX.krishna = toTexture(blank);
  waiting.set('krishna', []);
  const needs = (name, material) => waiting.get(name)?.push(material);
  function arrive(name, canvas) {
    const t = toTexture(canvas);
    for (const m of waiting.get(name) || []) m.uniforms.uMap.value = t;
    waiting.delete(name);
    TX[name] = t;
  }

  // --- materials
  function billboardMat(map, o = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: map },
        uTint: { value: o.tint || new THREE.Vector3(1, 1, 1) },
        uOpacity: { value: o.opacity ?? 1 },
        uSway: { value: o.sway ?? 0 },
        uPhase: { value: Math.random() * 20 },
        uFogAmt: { value: o.fog ?? 1 },
        uSharp: { value: o.sharp ?? 0 },
        uGrade: { value: o.grade ?? 1 },
        ...U,
      },
      vertexShader: o.vs || BILLBOARD_VS,
      fragmentShader: BILLBOARD_FS,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
    });
  }

  const geoBottom = new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
  const geoCenter = new THREE.PlaneGeometry(1, 1, 1, 4);
  const geoFlat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const r = P.rng(2026);
  const rand = (a, b) => a + r() * (b - a);
  const tint = (b = 1, warm = 0) => new THREE.Vector3(b * (1 + warm * 0.06), b, b * (1 - warm * 0.06));

  // Every layer faces +z and the camera always looks down -z, so painter's
  // order by world z is exact — more reliable than bounding-sphere sorting.
  const depthOrder = (z) => Math.round(z * 20);
  function sprite(tex, o) {
    const m = new THREE.Mesh(o.centered ? geoCenter : o.flat ? geoFlat : geoBottom, billboardMat(TX[tex], o));
    needs(tex, m.material);
    const h = o.h, w = o.w ?? h * TX[tex].aspect;
    if (o.flat) m.scale.set(w, 1, h);
    else m.scale.set(o.flip ? -w : w, h, 1);
    m.position.set(o.x, o.y ?? 0, o.z);
    m.rotation.z = o.rot ?? 0;
    m.renderOrder = depthOrder(o.z);
    scene.add(m);
    return m;
  }
  function rayMesh(o) {
    const m = new THREE.Mesh(
      geoCenter,
      new THREE.ShaderMaterial({
        uniforms: { uMap: { value: TX.ray }, uOpacity: { value: o.opacity }, uPhase: { value: r() * 10 }, uSway: { value: 0 }, ...U },
        vertexShader: BILLBOARD_VS,
        fragmentShader: RAY_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
        side: THREE.DoubleSide,
      }),
    );
    m.scale.set(o.w, o.h, 1);
    m.position.set(o.x, o.y, o.z);
    m.rotation.z = o.rot ?? -0.36;
    m.renderOrder = depthOrder(o.z);
    m.userData = { base: o.opacity, boost: 0 };
    shafts.push(m);
    scene.add(m);
    return m;
  }
  const shafts = [];

  // --- backdrop
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1800, 760), billboardMat(TX.sky, { fog: 0, sharp: 1 }));
  skyMesh.position.set(0, 120, -520);
  skyMesh.renderOrder = depthOrder(-520);
  scene.add(skyMesh);
  // the night sky: stars, and a moon rising where the sun stood
  const starCount = hi ? 520 : 300;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3), starSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = rand(-880, 880); starPos[i * 3 + 1] = rand(20, 480); starPos[i * 3 + 2] = -512;
    starSeed[i] = r();
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: STAR_VS,
    fragmentShader: STAR_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = depthOrder(-512);
  scene.add(stars);
  const moon = sprite('moon', { centered: true, x: 0, y: 0, z: -300, h: 40, w: 40, fog: 0, grade: 0, sharp: 1, opacity: 0 });
  sprite('distant', { x: 0, y: -8, z: -420, w: 1500, h: 190, fog: 0.55, tint: tint(0.98) });
  sprite('distant', { x: 260, y: -6, z: -380, w: 1100, h: 150, fog: 0.5, flip: true, tint: tint(0.94) });

  // --- ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 700),
    new THREE.ShaderMaterial({
      uniforms: { uMap: { value: TX.ground }, uRepeat: { value: new THREE.Vector2(900 / 14, 700 / 14) }, ...U },
      vertexShader: GROUND_VS,
      fragmentShader: GROUND_FS,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -300);
  scene.add(ground);

  // --- one forest: far, mid and near layers of the same trees
  const trees = ['tree0', 'tree1', 'tree2'];
  const nFar = Math.round(26 * Q);
  for (let i = 0; i < nFar; i++) {
    const x = -280 + (i + r()) * (560 / nFar);
    sprite(trees[i % 3], { x, z: rand(-330, -190), h: rand(80, 112), sway: 0.02, tint: tint(rand(0.85, 1)), flip: r() < 0.5 });
  }
  const nMid = Math.round(18 * Q);
  for (let i = 0; i < nMid; i++) {
    const x = -180 + (i + r()) * (340 / nMid);
    sprite(trees[(i + 1) % 3], { x, z: rand(-170, -75), h: rand(90, 122), sway: 0.025, tint: tint(rand(0.82, 1), 0.3), flip: r() < 0.5 });
  }
  // near trees stay out of the camera's path: a clearing opens down the middle
  const nNear = Math.round(10 * Q);
  for (let i = 0; i < nNear; i++) {
    const left = i % 2 === 0;
    const x = left ? rand(-120, -52) : rand(24, 90);
    sprite(i % 3 === 0 ? 'treeBig' : trees[i % 3], { x, z: rand(-66, -24), h: rand(105, 128), sway: 0.02, tint: tint(rand(0.8, 0.95)), flip: r() < 0.5 });
  }
  // hero framing trees
  sprite('treeBig', { x: -46, z: -22, h: 134, sway: 0.015, tint: tint(0.9) });
  sprite('treeBig', { x: 52, z: -34, h: 128, sway: 0.015, tint: tint(0.92), flip: true });

  // the ancient tree: its trunk continues the one in the painting upward
  const ancient = sprite('ancient', { x: 0, z: -9, h: 108, sway: 0.008, tint: tint(0.9, 0.2) });

  // canopy mass
  const clumps = ['clump0', 'clump1', 'clump2'];
  for (let i = 0; i < Math.round(60 * Q); i++) {
    const s = rand(14, 36);
    const z = rand(-180, 12);
    let x = rand(-170, 130);
    if (z > -80 && x > -60 && x < 30) x = x < -15 ? x - 55 : x + 50;
    sprite(clumps[i % 3], { centered: true, x, y: rand(52, z > -70 ? 92 : 106), z, h: s, w: s, sway: 0.03, tint: tint(rand(0.78, 1.05), 0.2), flip: r() < 0.5, rot: rand(-0.3, 0.3) });
  }
  // understorey bushes
  for (let i = 0; i < Math.round(38 * Q); i++) {
    const s = rand(8, 20);
    const x = rand(-150, 110), z = rand(-160, -12);
    if (z > -20 && x > -2 && x < 16) continue;
    sprite(clumps[(i + 1) % 3], { centered: true, x, y: s * 0.32, z, h: s * 0.8, w: s, sway: 0.02, tint: tint(rand(0.62, 0.85)), flip: r() < 0.5 });
  }
  // soft foreground leaves drifting past the lens in the canopy
  for (let i = 0; i < Math.round(9 * Q) + 2; i++) {
    const s = rand(2.8, 5);
    const y = 62 + (i % 8) * 3.4 + rand(-1, 1);
    const side = i % 2 ? 1 : -1;
    sprite(i % 2 ? 'clumpB0' : 'clumpB1', { centered: true, x: -4 - (100 - y) * 0.12 + side * rand(2, 6), y, z: rand(29, 33), h: s, w: s, sway: 0.05, tint: tint(rand(0.55, 0.8)), fog: 0.15, sharp: 1, flip: r() < 0.5, rot: rand(-1, 1) });
  }
  // hero branches framing the sky
  sprite('branchB0', { centered: true, x: -12.5, y: 111.2, z: 29.5, h: 5, fog: 0.1, sway: 0.03, tint: tint(0.62), rot: 0.05, sharp: 1 });
  sprite('branchB1', { centered: true, x: 9, y: 105.5, z: 31, h: 4.6, fog: 0.1, sway: 0.03, tint: tint(0.66), flip: true, rot: 0.1, sharp: 1 });
  sprite('branch0', { centered: true, x: 25, y: 113.5, z: 12, h: 12, fog: 0.2, sway: 0.02, tint: tint(0.78), flip: true, rot: 0.18 });
  sprite('branch1', { centered: true, x: -26, y: 84, z: 18, h: 11, fog: 0.2, sway: 0.02, tint: tint(0.75) });
  sprite('branch0', { centered: true, x: 14, y: 62, z: 20, h: 10, fog: 0.2, sway: 0.02, tint: tint(0.72), flip: true });

  // god rays, all slanting from the same upper-right sun
  for (let i = 0; i < Math.round(10 * (hi ? 1 : 0.6)); i++) {
    rayMesh({ x: rand(-70, 45), y: rand(35, 80), z: rand(-140, -8), w: rand(10, 26), h: rand(120, 170), opacity: rand(0.16, 0.34), rot: rand(-0.42, -0.3) });
  }

  // --- the destination: Krishna beneath the ancient tree
  // his seated height (hair to seat) is about 12 units in this world
  const UNIT = 12 / (SEAT_Y - 140);
  const IMG_H = CROP.h * UNIT, IMG_W = CROP.w * UNIT;
  const IMG_Y = -(CROP.y + CROP.h - SEAT_Y) * UNIT - 0.12; // seat settles just into the grass
  const imgX = (px) => (px - CROP.x - CROP.w / 2) * UNIT;
  const TRUNK_DX = 1.6; // the ancient trunk stands behind him, a little to the right
  const sceneMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: TX.krishna }, uOpacity: { value: 1 }, uHaze: { value: 1 }, uRigAmt: { value: 1 }, ...U },
    vertexShader: SCENE_VS,
    fragmentShader: SCENE_FS,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });
  needs('krishna', sceneMat);
  const destination = new THREE.Mesh(geoBottom, sceneMat);
  destination.scale.set(IMG_W, IMG_H, 1);
  scene.add(destination);

  // everything that grounds him in the forest is rebuilt per layout
  const destGroup = new THREE.Group();
  scene.add(destGroup);
  function placeDestination(ix, iz) {
    for (const m of [...destGroup.children]) {
      destGroup.remove(m);
      m.material.dispose();
      const s = shafts.indexOf(m);
      if (s >= 0) shafts.splice(s, 1);
    }
    const add = (m) => { destGroup.add(m); return m; };
    const gr = P.rng(99);
    const g = (a, b) => a + gr() * (b - a);
    const sx = ix + imgX(SEAT_X);
    // contact shadow under him, falling left, away from the upper-right sun
    add(sprite('shadow', { flat: true, x: sx - 0.8, y: 0.03, z: iz + 0.7, w: 11.5, h: 3.6, opacity: 0.6 }));
    add(sprite('shadow', { flat: true, x: sx - 0.25, y: 0.035, z: iz + 0.35, w: 7.2, h: 1.9, opacity: 0.45 }));
    // where the roots meet the ground, and his shadow on the bark behind him
    add(sprite('shadow', { flat: true, x: ix + TRUNK_DX, y: 0.03, z: iz - 0.6, w: 14, h: 3.4, opacity: 0.4 }));
    add(sprite('shadow', { centered: true, x: sx - 1.1, y: 5, z: iz - 1.45, w: 9, h: 10.2, opacity: 0.34, fog: 0.5 }));
    // grass behind him, and around the trunk's roots
    const tx = ix + TRUNK_DX;
    for (let i = 0; i < 14; i++) add(sprite(i % 2 ? 'grass1' : 'grass0', { x: tx - 17 + i * 2.6 + g(-0.6, 0.6), y: -0.08, z: iz - 1.15 + g(-0.1, 0.1), h: g(1.3, 2.3), sway: 0.08, tint: tint(g(0.7, 0.88)), flip: gr() < 0.5 }));
    for (let i = 0; i < 7; i++) add(sprite(i % 2 ? 'grass0' : 'grass1', { x: sx - 6 + i * 2 + g(-0.4, 0.4), y: -0.08, z: iz - 0.35, h: g(1.2, 1.9), sway: 0.08, tint: tint(g(0.72, 0.86)) }));
    // in front: grass over the hem of his dhoti and his feet, taller at the sides
    for (let i = 0; i < 11; i++) {
      const u = i / 10 - 0.5;
      const nearHim = Math.abs(u) < 0.32;
      add(sprite(i % 2 ? 'grass0' : 'grass1', { x: sx + u * IMG_W * 1.05 + g(-0.3, 0.3), y: -0.08, z: iz + 0.35 + g(-0.1, 0.25), h: nearHim ? g(0.85, 1.3) : g(1.3, 2), sway: 0.09, tint: tint(g(0.82, 0.96)), flip: gr() < 0.5 }));
    }
    for (let i = 0; i < Math.round(60 * Q + 10); i++) {
      const x = g(-40, 40), z = g(-14, 16);
      if (z > -4 && z < 11 && Math.abs(x - ix + 3) < 5) continue; // leave the landing spot open
      if (z > iz - 2 && z < iz + 3 && Math.abs(x - sx) < IMG_W * 0.6) continue; // keep his space clear
      add(sprite(i % 2 ? 'grass0' : 'grass1', { x, z, h: g(2, 3.4), sway: 0.1, tint: tint(g(0.72, 1)), flip: gr() < 0.5 }));
    }
    for (let i = 0; i < 8; i++) add(sprite('grassB', { x: g(-16, 16) + ix * 0.3, z: g(8, 13), h: g(3.2, 4.4), sway: 0.12, tint: tint(0.62), fog: 0.1, flip: gr() < 0.5, sharp: 1 }));
    // sunlight from the upper right: a shaft behind him, a fainter one in front
    add(rayMesh({ x: ix + 2.8, y: 13, z: iz - 5, w: 9, h: 42, opacity: 0.32 }));
    add(rayMesh({ x: ix - 0.6, y: 9, z: iz + 2.5, w: 5, h: 30, opacity: 0.14 }));
  }

  // --- particles: far dust, mid pollen, near bokeh, and pollen around Krishna
  function particles(count, o) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: U.uTime,
          uFocus: U.uFocus,
          uDof: U.uDof,
          uCam: { value: new THREE.Vector3(...(o.center || [0, 0, 0])) },
          uBox: { value: new THREE.Vector3(...o.box) },
          uSize: { value: o.size },
          uPR: { value: renderer.getPixelRatio() },
          uAhead: { value: o.ahead ?? 0 },
          uFadeFar: { value: o.fadeFar ?? (o.ahead ?? 0) + o.box[2] * 0.48 },
          uDrift: { value: o.drift ?? 0.15 },
          uColor: { value: vec3(o.color) },
          uOpacity: { value: o.opacity },
        },
        vertexShader: POINTS_VS,
        fragmentShader: POINTS_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    );
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  const dust = particles(Math.round(500 * Q), { box: [140, 80, 170], size: 1.3, ahead: 95, color: '#fff4d8', opacity: 0.55 });
  const pollen = particles(Math.round(600 * Q), { box: [46, 34, 56], size: 2.2, ahead: 26, color: '#fff1c8', opacity: 0.85 });
  const bokeh = particles(Math.round(26 * Q), { box: [16, 12, 10], size: 22, ahead: 7, color: '#f6e7b0', opacity: 0.1, drift: 0.05 });
  const localBack = particles(Math.round(90 * Q) + 20, { box: [18, 13, 1.2], size: 1.6, color: '#fff0c4', opacity: 0.9, fadeFar: 1000, drift: 0.08 });
  const localFront = particles(Math.round(90 * Q) + 20, { box: [20, 13, 7], size: 1.7, color: '#fff0c4', opacity: 0.9, fadeFar: 1000, drift: 0.08 });

  // --- falling leaves: around the camera, and in front of / behind Krishna
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const dummy = new THREE.Object3D();
  function leafSystem(n, box, fog = 0.8) {
    const geo = leafGeo.clone();
    const idx = new Float32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i % 4;
    geo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
    const mesh = new THREE.InstancedMesh(geo, billboardMat(TX.leaves, { vs: LEAF_VS, fog }), n);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const B = new THREE.Vector3(...box);
    const items = Array.from({ length: n }, () => ({
      p: new THREE.Vector3((Math.random() - 0.5) * B.x, (Math.random() - 0.5) * B.y, (Math.random() - 0.5) * B.z),
      fall: 0.5 + Math.random() * 0.8,
      amp: 0.5 + Math.random() * 1.2,
      freq: 0.4 + Math.random() * 0.8,
      ph: Math.random() * 10,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      rs: 0.8 + Math.random() * 2,
      s: 0.26 + Math.random() * 0.28,
    }));
    return {
      mesh,
      update(center, dt, time, reduced) {
        for (let i = 0; i < items.length; i++) {
          const L = items[i];
          if (!reduced) {
            L.p.y -= L.fall * dt;
            L.p.x += Math.sin(time * L.freq + L.ph) * L.amp * dt;
            L.p.z += Math.cos(time * L.freq * 0.7 + L.ph) * L.amp * 0.3 * dt;
          }
          for (const ax of ['x', 'y', 'z']) {
            const rel = L.p[ax] - center[ax];
            const b = B[ax];
            L.p[ax] = center[ax] + ((((rel + b / 2) % b) + b) % b) - b / 2;
          }
          dummy.position.copy(L.p);
          dummy.quaternion.setFromAxisAngle(L.spin, time * L.rs + L.ph);
          dummy.scale.setScalar(L.s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.renderOrder = depthOrder(center.z);
      },
    };
  }
  const camLeaves = leafSystem(Math.round(44 * Q), [40, 32, 44]);
  const backLeaves = leafSystem(hi ? 6 : 4, [16, 16, 1.2], 0.5);
  const frontLeaves = leafSystem(hi ? 7 : 4, [18, 16, 6], 0.5);

  // --- birds & butterflies
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const m = sprite('bird', { centered: true, x: -70 + i * 9 + Math.random() * 6, y: 150 + Math.random() * 18, z: -250, h: 1.6, fog: 0.4 });
    m.userData = { base: m.position.clone(), ph: Math.random() * 6, s: 1.6 };
    birds.push(m);
  }
  // butterflies: some along the way down, a few around Krishna (placed per layout)
  const kinds = Object.keys(P.BUTTERFLIES);
  const nButterflies = hi ? 16 : mid ? 12 : 8;
  const flutterers = Array.from({ length: nButterflies }, (_, i) => {
    const tex = 'bf_' + kinds[i % kinds.length];
    const h = 0.7 + Math.random() * 0.35;
    const m = sprite(tex, { centered: true, x: 0, y: -99, z: 0, h, fog: 0.35 });
    m.userData = {
      a: new THREE.Vector3(), r: 1.6 + Math.random() * 2.4, ph: Math.random() * 20,
      speed: 0.35 + Math.random() * 0.3, flap: 9 + Math.random() * 6, w: h * TX[tex].aspect, lastX: 0,
      flee: new THREE.Vector3(), fright: 0,
    };
    return m;
  });
  function placeButterflies(ix, iz) {
    const br = P.rng(7);
    const near = Math.min(4, Math.ceil(nButterflies / 4));
    flutterers.forEach((m, i) => {
      const a = m.userData.a;
      if (i < near) {
        // around Krishna and the ancient tree
        a.set(ix + (br() - 0.5) * 16, 1.5 + br() * 7, iz + 1.5 + br() * 8);
      } else {
        // below the canopy, somewhere the camera will pass on its way down
        const k = track(0.34 + ((i - near) / Math.max(1, nButterflies - near - 1)) * 0.56);
        a.set(k.x + (br() - 0.5) * 26, Math.min(58, Math.max(1.5, k.y + (br() - 0.65) * 12)), k.z - 12 - br() * 20);
      }
    });
  }

  // fireflies: drifting with the camera under the canopy, and gathered near Krishna
  function fireflies(count, o) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(...o.box) },
        uSize: { value: o.size },
        uPR: { value: renderer.getPixelRatio() },
        uCeil: { value: o.ceil },
        uFadeFar: { value: o.fadeFar },
        uColor: { value: new THREE.Vector3(0.78, 1.0, 0.32) },
        uCore: { value: new THREE.Vector3(1.0, 1.0, 0.82) },
        uOpacity: { value: o.opacity ?? 1 },
        uAttract: { value: new THREE.Vector3() },
        uAttractAmt: { value: 0 },
      },
      vertexShader: FIREFLY_VS,
      fragmentShader: FIREFLY_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    }));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  const camFireflies = fireflies(Math.round(170 * Q) + 24, { box: [64, 28, 56], size: 5.5, ceil: 62, fadeFar: 60 });
  const backFireflies = fireflies(hi ? 22 : 12, { box: [22, 11, 1.2], size: 4.6, ceil: 30, fadeFar: 1000 });
  const frontFireflies = fireflies(hi ? 48 : 26, { box: [26, 11, 8], size: 4.6, ceil: 30, fadeFar: 1000 });

  // --- the feather: real geometry, lit by the same sun
  const feather = createFeather({ tex: TX.feather, art: featherArt, U, sun });
  scene.add(feather.group);
  const featherShadow = sprite('shadow', { flat: true, x: 0, y: 0.04, z: 0, w: 3.2, h: 1.1, opacity: 0 });

  // --- leafy branches the feather slips behind (placed along its planned path)
  const occluders = Array.from({ length: 6 }, (_, i) => {
    const m = sprite(i % 2 ? 'branch0' : 'branch1', { centered: true, x: 0, y: -999, z: 0, h: 1, sway: 0.03, tint: tint(0.8 + (i % 3) * 0.06, 0.2), fog: 0.9 });
    m.visible = false;
    return m;
  });

  // ------------------------------------------------------------ layout ---
  let layout = LAYOUTS.wide, track = makeTrack(layout.keys), mode = '';
  let pathFn = null;
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    layout = LAYOUTS[next];
    track = makeTrack(layout.keys);
    const { x, z } = layout.image;
    destination.position.set(x, IMG_Y, z);
    destination.renderOrder = depthOrder(z);
    ancient.position.set(x + TRUNK_DX, -1, z - 1.6);
    ancient.renderOrder = depthOrder(z - 1.6);
    placeDestination(x, z);
    placeButterflies(x, z);
    const mo = layout.moon;
    moon.position.set(mo.x, mo.y, mo.z);
    moon.scale.set(mo.size, mo.size, 1);
    backFireflies.material.uniforms.uCenter.value.set(x, 5.5, z - 0.8);
    backFireflies.renderOrder = depthOrder(z - 0.8);
    frontFireflies.material.uniforms.uCenter.value.set(x, 5.5, z + 4.5);
    frontFireflies.renderOrder = depthOrder(z + 4.5);
    localBack.material.uniforms.uCam.value.set(x, 7, z - 0.8);
    localBack.renderOrder = depthOrder(z - 0.8);
    localFront.material.uniforms.uCam.value.set(x, 7, z + 3.8);
    localFront.renderOrder = depthOrder(z + 3.8);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    post.setSize();
    camera.aspect = w / h;
    setMode(w / h < 0.85 ? 'tall' : 'wide');
    camera.updateProjectionMatrix();
    if (pathFn) planPath(pathFn);
  }

  // ------------------------------------------------------------- helpers -
  const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3();
  function rayFrom(cam, fx, fy) {
    _v.set(fx * 2 - 1, -(fy * 2 - 1), 0.5).unproject(cam);
    return _d.copy(_v).sub(cam.position).normalize();
  }
  function screenToWorld(cam, fx, fy, dist, out) {
    const dir = rayFrom(cam, fx, fy);
    cam.getWorldDirection(_f);
    return out.copy(cam.position).addScaledVector(dir, dist / Math.max(0.2, dir.dot(_f)));
  }
  function screenToGround(cam, fx, fy, gy, out) {
    const dir = rayFrom(cam, fx, fy);
    if (dir.y > -0.02) return null;
    return out.copy(cam.position).addScaledVector(dir, (gy - cam.position.y) / dir.y);
  }
  function poseCamera(cam, p) {
    const k = track(p);
    cam.fov = k.fov;
    cam.aspect = camera.aspect;
    cam.updateProjectionMatrix();
    cam.position.set(k.x, k.y, k.z);
    cam.rotation.set(k.pitch, k.yaw, k.roll);
    cam.updateMatrixWorld();
    return cam;
  }

  // Places leaves and trunks between the camera and the feather at a few
  // moments of its journey, so it drifts behind the forest and out again.
  const planCam = new THREE.PerspectiveCamera(45, 1, 0.5, 1400);
  planCam.rotation.order = 'YXZ';
  const checkCam = planCam.clone();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _ndc = new THREE.Vector3();
  function visibleAt(p, pos) {
    poseCamera(checkCam, p);
    _ndc.copy(pos).project(checkCam);
    return _ndc.z < 1 && Math.abs(_ndc.x) < 1.2 && Math.abs(_ndc.y) < 1.2;
  }
  function planPath(fn) {
    pathFn = fn;
    for (const m of occluders) m.visible = false;
    let used = 0;
    const fwd = new THREE.Vector3(), pos = new THREE.Vector3(), probe = new THREE.Vector3();
    for (const ev of layout.occluders) {
      const t = fn(ev.p);
      if (!t || t.land > 0) continue;
      poseCamera(planCam, ev.p);
      planCam.getWorldDirection(fwd);
      const fp = screenToWorld(planCam, t.fx, t.fy, t.fd, _a);
      const dir = _d.copy(fp).sub(planCam.position);
      const dist = dir.length();
      dir.normalize();
      // a branch in front of the feather, and sometimes one just behind it
      const layers = ev.behind ? [[-ev.gap, 1], [6, -1]] : [[-ev.gap, 1]];
      for (const [off, side] of layers) {
        const m = occluders[used];
        if (!m) break;
        pos.copy(planCam.position).addScaledVector(dir, dist + off);
        // the branch reaches in from beyond the frame edge on the feather's side,
        // so its cut limb is never seen and only the leafy spray crosses the view
        const depth = probe.copy(pos).sub(planCam.position).dot(fwd);
        const halfW = depth * Math.tan(THREE.MathUtils.degToRad(planCam.fov / 2)) * planCam.aspect;
        const centerX = planCam.position.x + fwd.x * depth;
        const fromRight = (t.fx > 0.5) === (side > 0);
        const outer = centerX + (fromRight ? 1 : -1) * (halfW + 3);
        // how far the leafy tip reaches past the feather (negative: just short of it)
        const inner = pos.x + (fromRight ? -1 : 1) * (side > 0 ? ev.reach : 1.5);
        const w = Math.max(6, Math.abs(outer - inner) / 0.9);
        if (w > 26) continue; // would stretch across the frame; skip rather than look staged

        const h = w / TX.branch0.aspect;
        const cx = outer + (fromRight ? -1 : 1) * w * 0.5;
        const cy = pos.y + h * 0.06;
        // never part of the opening sky or the final clearing
        const tipX = outer + (fromRight ? -1 : 1) * w * 0.95;
        if ([0, 1].some((q) => visibleAt(q, probe.set(tipX, cy, pos.z)) || visibleAt(q, probe.set(cx, cy, pos.z)))) continue;
        used++;
        m.position.set(cx, cy, pos.z);
        m.scale.set(fromRight ? -w : w, h, 1);
        m.rotation.z = (fromRight ? 1 : -1) * 0.06;
        m.renderOrder = depthOrder(pos.z);
        m.visible = true;
      }
    }
  }

  resize();

  const FOG_HI = vec3('#cfdcd2'), FOG_MID = vec3('#bcc893'), FOG_LO = vec3('#98ad6c');
  const FOG_DUSK = vec3('#d6a879'), FOG_NIGHT = vec3('#1a2839');
  const floatPos = new THREE.Vector3(), groundPos = new THREE.Vector3(), target = new THREE.Vector3();
  const fp = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), rel: new THREE.Vector3(), relVel: new THREE.Vector3(), quat: new THREE.Quaternion(), init: false };
  const qTarget = new THREE.Quaternion(), qRest = new THREE.Quaternion(), qTumble = new THREE.Quaternion();
  const AXIS_Y = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3(), _up = new THREE.Vector3();
  const eTarget = new THREE.Euler(0, 0, 0, 'YXZ');
  // resting in the grass, propped on the blades so the eye stays visible
  qRest.setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.42, -1.1, 0.1, 'YXZ')).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.55));
  let lastFov = 0;
  const corner = new THREE.Vector3();
  const quad = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  const inQuad = (x, y) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4];
      const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
    }
    return true;
  };
  // adaptive resolution: hold ~60fps by trading pixels for frames
  const perf = { acc: 0, n: 0, cool: 3, pr: renderer.getPixelRatio(), max: renderer.getPixelRatio(), min: 0.7 };
  function applyPixelRatio() {
    renderer.setPixelRatio(perf.pr);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    post.setSize();
    scene.traverse((o) => { if (o.material?.uniforms?.uPR) o.material.uniforms.uPR.value = perf.pr; });
  }
  function adapt(dt) {
    if (dt > 0.1) return; // background or throttled frames say nothing about the GPU
    perf.acc += dt; perf.n++; perf.cool -= dt;
    if (perf.n < 60) return;
    const avg = perf.acc / perf.n;
    perf.acc = 0; perf.n = 0;
    if (perf.cool > 0) return;
    if (avg > 0.0195 && perf.pr > perf.min) { perf.pr = Math.max(perf.min, perf.pr - 0.15); applyPixelRatio(); perf.cool = 2; }
    else if (avg > 0.0195 && post.raysEnabled) { post.raysEnabled = false; perf.cool = 2; }
    else if (avg < 0.0125 && perf.pr < perf.max) { perf.pr = Math.min(perf.max, perf.pr + 0.1); applyPixelRatio(); perf.cool = 5; }
  }
  const PUSH_SECONDS = 8;
  let restT = 0;
  const landLock = new THREE.Vector3();
  const SUN_AT = new THREE.Vector3(360, 150, -520); // where the sun sits on the sky plate
  const lightPos = new THREE.Vector3();
  const flySources = [[frontFireflies, 6], [backFireflies, 2]];
  // film grade per time of day: lift / gamma / gain / saturation
  const GRADES = {
    day: { lift: [0.01, 0.012, 0.0], gamma: [1, 1, 0.98], gain: [1.02, 1.01, 0.97], sat: 1.05 },
    dusk: { lift: [0.022, 0.01, 0.0], gamma: [1.03, 0.98, 0.93], gain: [1.06, 0.97, 0.86], sat: 1.08 },
    night: { lift: [0.0, 0.01, 0.026], gamma: [0.95, 0.98, 1.04], gain: [0.97, 1.0, 1.07], sat: 0.92 },
  };
  const mix3 = (out, a, b, t) => out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  const gradeTmp = { lift: [0, 0, 0], gamma: [0, 0, 0], gain: [0, 0, 0] };
  function applyGrade(dusk, night) {
    const P = post.uniforms;
    for (const k of ['lift', 'gamma', 'gain']) {
      const a = GRADES.day[k], b = GRADES.dusk[k], c = GRADES.night[k], o = gradeTmp[k];
      for (let i = 0; i < 3; i++) o[i] = lerp(lerp(a[i], b[i], dusk), c[i], night);
    }
    mix3(P.uLift.value, gradeTmp.lift, gradeTmp.lift, 0);
    mix3(P.uGamma.value, gradeTmp.gamma, gradeTmp.gamma, 0);
    mix3(P.uGain.value, gradeTmp.gain, gradeTmp.gain, 0);
    P.uSat.value = lerp(lerp(GRADES.day.sat, GRADES.dusk.sat, dusk), GRADES.night.sat, night);
    // bloom: gentle by day (only the sun's glare), generous at night (moon, fireflies)
    P.uBloom.value = lerp(0.32, 0.95, night);
    post.bright.uThreshold.value = lerp(0.9, 0.5, night);
    P.uGrain.value = lerp(0.032, 0.048, night);
    P.uVignette.value = lerp(0.28, 0.42, night);
  }
  const clearColor = new THREE.Color();
  const krishnaAt = new THREE.Vector3();

  function update(s) {
    const { p, time, pointer, feather: F, bright = 0, reduced } = s;
    const dt = Math.max(1e-3, s.dt);
    adapt(s.dt);
    U.uTime.value = time;

    // camera
    const k = track(p);
    if (Math.abs(k.fov - lastFov) > 0.01) { camera.fov = k.fov; camera.updateProjectionMatrix(); lastFov = k.fov; }
    const pw = reduced ? 0 : 1 - p * 0.5;
    camera.position.set(k.x + pointer.x * 0.6 * pw, k.y + pointer.y * 0.35 * pw, k.z);
    camera.rotation.set(k.pitch - pointer.y * 0.006 * pw, k.yaw - pointer.x * 0.01 * pw, k.roll);
    restT = p > 0.995 ? Math.min(PUSH_SECONDS, restT + dt) : Math.max(0, restT - dt * 4);
    const push = reduced ? 0 : smooth(0, 1, restT / PUSH_SECONDS);
    camera.position.z -= push * 2.6;
    camera.position.y -= push * 0.7;
    camera.rotation.x += push * 0.014;
    camera.updateMatrixWorld();

    // time of day: morning at the top, golden hour midway, night at the end
    const night = smooth(0.6, 0.97, p);
    const dusk = smooth(0.34, 0.7, p) * (1 - smooth(0.78, 0.97, p));
    U.uNight.value = night;
    U.uDusk.value = dusk;

    // atmosphere follows altitude, and thins as the clearing opens at the end
    const hy = camera.position.y;
    const tHi = smooth(40, 105, hy);
    const clear = smooth(0.8, 0.97, p);
    const fog = U.uFogColor.value;
    fog.copy(FOG_LO).lerp(FOG_MID, smooth(8, 45, hy)).lerp(FOG_HI, tHi);
    fog.lerp(FOG_DUSK, dusk * 0.55).lerp(FOG_NIGHT, night);
    U.uFogNear.value = lerp(18, 50, tHi) * lerp(1, 1.7, clear);
    U.uFogFar.value = lerp(250, 470, tHi) * lerp(1, 1.45, clear);
    U.uExposure.value = 1 + bright * 0.1;
    U.uRays.value = lerp(1, 0.45, tHi) * (1 + bright * 0.7) * lerp(1, 0.8, clear);
    clearColor.setRGB(fog.x, fog.y, fog.z);
    renderer.setClearColor(clearColor, 1);

    // the destination: hazy and hidden until the forest opens, then clear
    sceneMat.uniforms.uHaze.value = lerp(0.28, 0, smooth(0.72, 0.9, p));
    sceneMat.uniforms.uOpacity.value = smooth(0.6, 0.68, p);
    sceneMat.uniforms.uRigAmt.value = reduced ? 0.4 : 1;


    dust.material.uniforms.uCam.value.copy(camera.position);
    pollen.material.uniforms.uCam.value.copy(camera.position);
    bokeh.material.uniforms.uCam.value.copy(camera.position);
    dust.renderOrder = depthOrder(camera.position.z - 95);
    pollen.renderOrder = depthOrder(camera.position.z - 20);
    bokeh.renderOrder = depthOrder(camera.position.z - 5);

    camLeaves.update(_v.copy(camera.position).add(_f.set(0, -4, -18)), dt, time, reduced);
    const dz = layout.image.z;
    backLeaves.update(_v.set(layout.image.x, 9, dz - 0.8), dt, time, reduced);
    frontLeaves.update(_v.set(layout.image.x, 9, dz + 4.2), dt, time, reduced);

    for (const b of birds) {
      const u = b.userData;
      b.position.x = u.base.x + ((time * 2.2 + u.ph * 10) % 160);
      b.position.y = u.base.y + Math.sin(time * 0.6 + u.ph) * 2;
      b.scale.y = u.s * (0.45 + 0.55 * Math.abs(Math.sin(time * 5 + u.ph)));
    }
    for (const m of flutterers) {
      const u = m.userData;
      const t = time * u.speed + u.ph;
      const x = u.a.x + Math.sin(t * 1.3) * u.r + Math.sin(t * 0.37) * u.r * 0.6;
      m.position.set(x, u.a.y + Math.sin(t * 2.1) * u.r * 0.3 + Math.sin(time * 9 + u.ph) * 0.06, u.a.z + Math.cos(t * 0.9) * u.r * 0.6);
      // a quick sweep of the cursor nearby startles it away; it drifts back later
      if (pointer.active && pointer.speed > 2.2) {
        _ndc.copy(m.position).project(camera);
        const dx = (_ndc.x - pointer.x) * camera.aspect, dy = _ndc.y - pointer.y;
        const dd = Math.hypot(dx, dy);
        if (_ndc.z < 1 && dd < 0.28) {
          _right.setFromMatrixColumn(camera.matrixWorld, 0);
          _up.setFromMatrixColumn(camera.matrixWorld, 1);
          const k = (0.28 - dd) * 30 * dt;
          u.flee.addScaledVector(_right, (dx / (dd + 1e-3)) * k).addScaledVector(_up, (dy / (dd + 1e-3)) * k + k * 0.4);
          u.fright = 1;
        }
      }
      u.flee.multiplyScalar(Math.exp(-dt * 0.45));
      u.fright *= Math.exp(-dt * 1.2);
      m.position.add(u.flee);
      // bank into the turn; now and then glide with wings held open
      m.rotation.z = THREE.MathUtils.clamp(-(x - u.lastX) / Math.max(dt, 1e-3) * 0.12, -0.45, 0.45);
      u.lastX = x;
      const glide = smooth(0.55, 0.95, Math.sin(time * 0.45 + u.ph * 3));
      const open = lerp(Math.abs(Math.cos(time * u.flap * (1 + u.fright * 0.8) + u.ph)), 0.9, glide * (1 - u.fright));
      m.scale.x = u.w * (0.15 + 0.85 * open);
      m.renderOrder = depthOrder(m.position.z);
    }
    camFireflies.material.uniforms.uCenter.value.copy(camera.position).add(_f.set(0, -3, -22));
    const ff = camFireflies.material.uniforms;
    ff.uAttractAmt.value = lerp(ff.uAttractAmt.value, pointer.active && !reduced ? 1 : 0, 1 - Math.exp(-dt * 2));
    if (pointer.active) screenToWorld(camera, (pointer.x + 1) / 2, (1 - pointer.y) / 2, 22, ff.uAttract.value);
    for (const s of shafts) {
      s.userData.boost *= Math.exp(-dt * 1.3);
      s.material.uniforms.uOpacity.value = s.userData.base * (1 + s.userData.boost * 2.4);
    }
    const glow = 1 + night * 1.8;
    for (const ff of [camFireflies, backFireflies, frontFireflies]) ff.material.uniforms.uOpacity.value = glow;
    const day = 1 - night * 0.85;
    dust.material.uniforms.uOpacity.value = 0.55 * day;
    pollen.material.uniforms.uOpacity.value = 0.85 * day;
    bokeh.material.uniforms.uOpacity.value = 0.1 * day;
    const wings = 1 - smooth(0.72, 0.92, p);
    for (const m of flutterers) { m.material.uniforms.uOpacity.value = wings; m.visible = wings > 0.01; }
    moon.material.uniforms.uOpacity.value = smooth(0.72, 0.95, p);
    camFireflies.renderOrder = depthOrder(camera.position.z - 22);

    // --- feather: carried by air toward its scroll-driven target
    const land = F.land;
    const lw = smooth(0.3, 1, land);
    screenToWorld(camera, F.fx, F.fy, F.d, floatPos);
    // wind: layered, incommensurate gusts — never a single clean sine
    const wind = (1 - lw) * (reduced ? 0.3 : F.windAmt ?? 1) * (F.d / 22);
    floatPos.x += (Math.sin(time * 0.31) * 0.3 + Math.sin(time * 1.9 + 0.4) * 0.05) * wind;
    floatPos.y += (Math.sin(time * 0.47 + 0.7) * 0.15) * wind;
    floatPos.z += (Math.sin(time * 0.27 + 2.1) * 0.4) * wind;

    // the glide cycle — how a feather really falls: it swings like a pendulum,
    // banking into each glide, slowing and pitching up at the ends of a swing,
    // and every third swing it flips over. The phase advances with scroll.
    const phi = F.phase ?? time * 0.35;
    const swing = Math.sin(phi), sweep = Math.cos(phi);
    const stall = 1 - Math.abs(sweep);
    const cycle = Math.floor(phi / (Math.PI * 2));
    const within = phi / (Math.PI * 2) - cycle;
    const tumbling = ((cycle % 3) + 3) % 3 === 2;
    const tumble = tumbling ? smooth(0.18, 0.82, within) * Math.PI * 2 : 0;
    _right.setFromMatrixColumn(camera.matrixWorld, 0);
    floatPos.addScaledVector(_right, swing * 1.6 * wind);
    floatPos.y += (stall - 0.5) * 0.6 * wind;
    const g = screenToGround(camera, F.landFx ?? F.fx, F.landFy ?? F.fy, 1.15, groundPos) || floatPos;
    if (g === groundPos) g.z = Math.max(g.z, layout.image.z + 3); // never behind the painting
    if (restT <= 0.001) landLock.copy(g);
    else g.copy(landLock);
    target.copy(floatPos).lerp(g, lw);
    if (!fp.init) { fp.pos.copy(target); fp.rel.copy(target).sub(camera.position); fp.quat.setFromEuler(new THREE.Euler(0.15, 0, -0.35, 'YXZ')); fp.init = true; }
    // critically-damped spring; it slows as it nears the ground
    const w = lerp(6.5, 2.6, lw);
    const steps = Math.ceil(dt / 0.016);
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      _a.copy(target).sub(fp.pos).multiplyScalar(w * w).addScaledVector(fp.vel, -2 * 0.95 * w);
      fp.vel.addScaledVector(_a, h);
      fp.pos.addScaledVector(fp.vel, h);
    }
    // motion as seen from the camera drives banking
    _b.copy(fp.pos).sub(camera.position);
    _a.copy(_b).sub(fp.rel).divideScalar(dt);
    fp.relVel.lerp(_a, 1 - Math.exp(-dt * 4));
    fp.rel.copy(_b);
    const free = 1 - lw;
    const bank = THREE.MathUtils.clamp(-fp.relVel.x * 0.04, -0.3, 0.3) * free;
    const dive = THREE.MathUtils.clamp(-fp.vel.y * 0.01, -0.08, 0.2) * free;
    const wob = reduced ? 0.3 : 1;
    eTarget.set(
      (0.1 + stall * 0.38 + dive) * free,
      (Math.sin(time * 0.23) * 0.3 + sweep * 0.3) * wob * free,
      (-0.3 - sweep * 0.55 + bank) * free,
      'YXZ',
    );
    qTarget.setFromEuler(eTarget).multiply(qTumble.setFromAxisAngle(AXIS_Y, tumble * free * wob));
    qTarget.slerp(qRest, smooth(0.45, 1, land));
    fp.quat.slerp(qTarget, 1 - Math.exp(-dt * lerp(6, 1.6, lw)));
    feather.group.position.copy(fp.pos);
    // the lift just before touchdown comes from air under the vane
    feather.group.position.y += Math.sin(clamp01((land - 0.7) / 0.3) * Math.PI) * 0.22;
    feather.group.quaternion.copy(fp.quat);
    feather.group.scale.setScalar((F.scale ?? 1) * lerp(1, 1.2, lw));
    const speed = fp.relVel.length() + Math.abs(F.vel) * 0.004;
    feather.uniforms.uFlutter.value = lerp(0.28 + Math.min(1.3, speed * 0.05) + (tumbling ? 0.5 * Math.sin(within * Math.PI) : 0) + stall * 0.2, 0.08, lw);
    feather.setOrder(depthOrder(fp.pos.z));
    // its shadow appears as it nears the grass
    featherShadow.position.set(fp.pos.x, 0.04, fp.pos.z);
    featherShadow.rotation.y = -1.1;
    featherShadow.material.uniforms.uOpacity.value = 0.5 * smooth(7, 1, fp.pos.y);
    featherShadow.renderOrder = depthOrder(fp.pos.z) - 2;

    // focus follows the feather, then settles on Krishna
    krishnaAt.set(layout.image.x, 5, layout.image.z);
    U.uFocus.value = lerp(camera.position.distanceTo(fp.pos), camera.position.distanceTo(krishnaAt), smooth(0.84, 0.98, p));

    // god rays scatter from wherever the sun (or later the moon) actually is
    lightPos.copy(SUN_AT).lerp(moon.position, night);
    _ndc.copy(lightPos).project(camera);
    const lu = _ndc.x * 0.5 + 0.5, lv = _ndc.y * 0.5 + 0.5;
    const outside = Math.max(0, Math.max(Math.abs(lu - 0.5), Math.abs(lv - 0.5)) - 0.5);
    post.rays.uLight.value.set(lu, lv);
    // only what is clearly brighter than the haze counts as a gap in the canopy
    const fogLum = fog.x * 0.3 + fog.y * 0.59 + fog.z * 0.11;
    post.rays.uThreshold.value = lerp(Math.min(0.92, fogLum + 0.05), 0.55, night);
    post.uniforms.uRays.value = (_ndc.z < 1 ? 1 : 0) * (1 - smooth(0, 0.9, outside)) * lerp(2.6, 0.4, tHi) * lerp(1, 0.4, night) * (1 + bright * 0.5);
    post.uniforms.uRayColor.value.set(lerp(lerp(1, 1, dusk), 0.55, night), lerp(lerp(0.92, 0.76, dusk), 0.68, night), lerp(lerp(0.76, 0.5, dusk), 1, night));

    // the few fireflies near Krishna whose light falls on him and the grass
    let fi = 0;
    for (const [sys, n] of flySources) {
      const pos = sys.geometry.attributes.position.array, seed = sys.geometry.attributes.aSeed.array;
      const c = sys.material.uniforms.uCenter.value, B = sys.material.uniforms.uBox.value;
      for (let i = 0; i < n; i++) {
        const sd = seed[i], s = sd * Math.PI * 2;
        const px = pos[i * 3] * B.x + Math.sin(time * 0.31 + s * 3.1) * 2.2 + Math.sin(time * 0.73 + s) * 0.9;
        const py = pos[i * 3 + 1] * B.y + Math.sin(time * 0.43 + s * 1.7) * 1.1 + Math.sin(time * 1.3 + s * 4) * 0.25;
        const pz = pos[i * 3 + 2] * B.z + Math.cos(time * 0.27 + s * 2.3) * 2;
        const wrap = (v, ctr, b) => { const x = v - ctr + b / 2; return ctr + (x - b * Math.floor(x / b)) - b / 2; };
        const pulse = Math.pow(Math.max(0, Math.sin(time * (0.55 + sd * 0.9) + s * 5)), 8);
        U.uFly.value[fi++].set(wrap(px, c.x, B.x), wrap(py, c.y, B.y), wrap(pz, c.z, B.z), (0.32 + 0.95 * pulse) * night);
      }
    }

    applyGrade(dusk, night);
    post.render(scene, camera, time);
    return { altitude: camera.position.y };
  }

  /** A click on an empty spot: if it lands on a shaft of light, the shaft blooms. */
  function poke(nx, ny) {
    let hit = false;
    for (const s of shafts) {
      [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].forEach(([x, y], i) => {
        corner.set(x, y, 0).applyMatrix4(s.matrixWorld).project(camera);
        quad[i].set(corner.x, corner.y);
      });
      if (corner.z < 1 && inQuad(nx, ny)) { s.userData.boost = 1; hit = true; }
    }
    return hit;
  }

  const ready = (async () => {
    await yieldFrame();
    for (const [name, , paint] of later) {
      const c = paint();
      if (name === 'grass1') T.grass1 = c;
      arrive(name, c);
      if (name !== 'grass1') release(TX[name]); // the blurred grass still needs it
      await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 120 }) : setTimeout(r, 16)));
    }
    release(TX.grass1);
    arrive('krishna', await imagePromise);
  })();

  return { update, resize, planPath, poke, ready, renderer, post, get mode() { return mode; } };
}
