import * as THREE from 'three';
import { TIME_GRADE } from './grade.js';

// A physical peacock feather built around the supplied artwork
// (assets/feather.webp). The image is stood upright and mapped onto a cupped,
// bent and slightly twisted vane, with a real tapered rachis tube along its
// quill. Shading uses the scene's single sun, anisotropic sheen along the
// barbs, translucency when backlit, and the shared fog.

export const FEATHER_LEN = 4;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Stands the artwork upright: finds the quill's end and the eye, rotates so
 * that line is vertical with the tip up, centres the quill and crops tightly.
 * Returns the canvas plus where the quill starts and the eye sits (0..1 up).
 */
export function prepareFeatherArt(img, maxH = 1536) {
  const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
  const src = document.createElement('canvas');
  src.width = sw; src.height = sh;
  const sg = src.getContext('2d', { willReadFrequently: true });
  sg.drawImage(img, 0, 0);
  const d = sg.getImageData(0, 0, sw, sh).data;
  // the eye: centroid of the deep blue heart
  let ex = 0, ey = 0, en = 0;
  for (let y = 0; y < sh; y += 2) for (let x = 0; x < sw; x += 2) {
    const i = (y * sw + x) * 4, r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    if (d[i + 3] > 200 && b > r + 0.25 && b > g && 0.3 * r + 0.59 * g + 0.11 * b < 0.35) { ex += x; ey += y; en++; }
  }
  if (!en) throw new Error('feather artwork: eye not found');
  ex /= en; ey /= en;
  // the quill's end: the opaque pixel farthest below the eye
  let bx = ex, by = ey, best = 0;
  for (let y = Math.ceil(ey); y < sh; y += 2) for (let x = 0; x < sw; x += 2) {
    if (d[(y * sw + x) * 4 + 3] < 160) continue;
    const dd = (x - ex) ** 2 + (y - ey) ** 2;
    if (dd > best) { best = dd; bx = x; by = y; }
  }
  const theta = -Math.PI / 2 - Math.atan2(ey - by, ex - bx);
  const c = Math.cos(theta), s = Math.sin(theta);
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let y = 0; y < sh; y += 2) for (let x = 0; x < sw; x += 2) {
    if (d[(y * sw + x) * 4 + 3] < 12) continue;
    const dx = x - bx, dy = y - by;
    const qx = dx * c - dy * s, qy = dx * s + dy * c;
    if (qx < minX) minX = qx; if (qx > maxX) maxX = qx;
    if (qy < minY) minY = qy; if (qy > maxY) maxY = qy;
  }
  const half = Math.max(-minX, maxX) + 6, top = -minY + 6, bottom = maxY + 6;
  const k = Math.min(1, maxH / (top + bottom));
  const W = Math.ceil(2 * half * k), H = Math.ceil((top + bottom) * k);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const og = out.getContext('2d');
  og.translate(W / 2, top * k);
  og.scale(k, k);
  og.rotate(theta);
  og.translate(-bx, -by);
  og.drawImage(img, 0, 0);
  const eyeUp = Math.hypot(ex - bx, ey - by);
  return { canvas: out, aspect: W / H, baseT: (bottom * k) / H, eyeT: ((bottom + eyeUp) * k) / H };
}

/** Rest shape of the feather surface at (x across, t along 0..1). */
function shape(x, t, cupAmt, wid, out) {
  const cup = -cupAmt * Math.pow((2 * x) / wid, 2) * (0.3 + 0.7 * smooth(0.12, 0.8, t));
  const z = cup + 0.46 * t * t;
  const px = x + 0.07 * Math.sin(t * Math.PI) - 0.04 * t;
  const tw = 0.3 * t; // gentle twist toward the tip
  const c = Math.cos(tw), s = Math.sin(tw);
  out.set(px * c + z * s, (t - 0.5) * FEATHER_LEN, -px * s + z * c);
  return out;
}

function sheet(wid, segX, segY, cupAmt) {
  const g = new THREE.PlaneGeometry(wid, FEATHER_LEN, segX, segY);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    shape(pos.getX(i), uv.getY(i), cupAmt, wid, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function rachis(fromT, toT, wid, seg = 72, radial = 8) {
  const verts = [], norms = [], uvs = [], idx = [];
  const c = new THREE.Vector3(), n = new THREE.Vector3(), tan = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const t = fromT + u * (toT - fromT);
    shape(0, t, 0, wid, c);
    shape(0, Math.min(1, t + 0.01), 0, wid, tan).sub(c).normalize();
    a.set(1, 0, 0).addScaledVector(tan, -tan.x).normalize();
    b.crossVectors(tan, a);
    const rad = 0.026 * Math.pow(1 - u, 0.7) + 0.004;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      n.copy(a).multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang));
      verts.push(c.x + n.x * rad, c.y + n.y * rad, c.z + n.z * rad);
      norms.push(n.x, n.y, n.z);
      uvs.push(j / radial, t);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const p = i * (radial + 1) + j, q = p + radial + 1;
    idx.push(p, q, p + 1, q, q + 1, p + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const COMMON = /* glsl */ `
  uniform float uTime; uniform float uFlutter; uniform float uPhase;
  varying vec2 vUv; varying vec3 vN; varying vec3 vT; varying vec3 vView; varying float vDepth;
`;

const VANE_VS = /* glsl */ `
  ${COMMON}
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uv.y;
    float edge = abs(uv.x - 0.5) * 2.0;
    // air moving through the vane: slow bending wave plus finer edge ripples
    p.z += sin(t * 6.5 - uTime * 4.0 + uPhase) * uFlutter * (0.2 + t) * 0.05;
    p.z += sin(t * 19.0 + uTime * 3.1 + uPhase) * 0.028 * uFlutter * edge * edge;
    p.x += sin(t * 9.0 - uTime * 2.4) * 0.014 * uFlutter * edge;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vT = normalize(mat3(modelMatrix) * vec3(sign(uv.x - 0.5) * 0.75, 0.66, 0.0));
    vView = cameraPosition - wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const LIGHTING = /* glsl */ `
  ${TIME_GRADE}
  uniform vec3 uLight; uniform vec3 uSun; uniform vec3 uAmb; uniform float uExposure; uniform float uOpacity;
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
  float fogF(float d) { float f = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0); return f * (2.0 - f); }
`;

const VANE_FS = /* glsl */ `
  uniform sampler2D uMap;
  ${COMMON}
  ${LIGHTING}
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.015) discard;
    vec3 base = tex.rgb / tex.a;
    vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(vView);
    vec3 L = uLight;
    float ndl = dot(N, L);
    float diff = clamp(ndl * 0.55 + 0.45, 0.0, 1.0);
    // light passing through thin barbs when the sun is behind the feather
    float trans = pow(clamp(-ndl, 0.0, 1.0), 1.5) * 0.6 * (1.0 - tex.a * 0.35);
    // anisotropic sheen along the barb direction (Kajiya-Kay)
    vec3 T = normalize(vT - N * dot(vT, N));
    vec3 H = normalize(L + V);
    float th = dot(T, H);
    float aniso = pow(sqrt(max(0.0, 1.0 - th * th)), 48.0);
    float sat = max(base.r, max(base.g, base.b)) - min(base.r, min(base.g, base.b));
    // restrained structural colour: a small hue drift with viewing angle
    float ndv = abs(dot(N, V));
    vec3 irid = mix(vec3(0.16, 0.5, 0.42), vec3(0.55, 0.45, 0.18), 0.5 + 0.5 * sin(ndv * 5.0 + vUv.y * 7.0));
    vec3 col = base * (uAmb + uSun * diff) + base * uSun * trans;
    col += irid * sat * 0.12 * (1.0 - ndv);
    col += vec3(1.0, 0.95, 0.82) * aniso * (0.1 + sat * 0.35) * max(ndl, 0.15);
    col = mix(timeGrade(col * uExposure), col * vec3(0.7, 0.8, 1.0) * 0.72, uNight * 0.45); // keeps a little moonlight on it
    col = mix(col, uFogColor, fogF(vDepth));
    float a = tex.a * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

const RACHIS_VS = /* glsl */ `
  ${COMMON}
  void main() {
    vUv = uv;
    vec3 p = position;
    float t = uv.y;
    p.z += sin(t * 6.5 - uTime * 4.0 + uPhase) * uFlutter * (0.2 + t) * 0.05;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vT = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    vView = cameraPosition - wp.xyz;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const RACHIS_FS = /* glsl */ `
  ${COMMON}
  ${LIGHTING}
  void main() {
    vec3 N = normalize(vN), V = normalize(vView), L = uLight;
    vec3 base = mix(vec3(0.93, 0.89, 0.78), vec3(0.62, 0.55, 0.36), smoothstep(0.1, 0.95, vUv.y));
    float diff = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float th = dot(normalize(vT), H);
    float spec = pow(sqrt(max(0.0, 1.0 - th * th)), 40.0) * 0.35;
    vec3 col = timeGrade((base * (uAmb + uSun * diff) + spec) * uExposure);
    col = mix(col, uFogColor, fogF(vDepth));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createFeather({ tex, art, U, sun }) {
  const shared = {
    uTime: U.uTime,
    uExposure: U.uExposure,
    uFogColor: U.uFogColor,
    uFogNear: U.uFogNear,
    uFogFar: U.uFogFar,
    uFlutter: { value: 0.3 },
    uPhase: { value: 0 },
    uOpacity: { value: 1 },
    uNight: U.uNight,
    uDusk: U.uDusk,
    uLight: sun.dir,
    uSun: sun.color,
    uAmb: sun.ambient,
  };
  const vaneMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uMap: { value: tex } },
    vertexShader: VANE_VS,
    fragmentShader: VANE_FS,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  // the vane takes its proportions from the artwork; the quill runs up to the eye
  const wid = FEATHER_LEN * art.aspect;
  const vane = new THREE.Mesh(sheet(wid, 24, 120, 0.1 * wid), vaneMat);
  const shaft = new THREE.Mesh(
    rachis(art.baseT, art.eyeT - 0.02, wid),
    new THREE.ShaderMaterial({ uniforms: shared, vertexShader: RACHIS_VS, fragmentShader: RACHIS_FS }),
  );
  for (const m of [vane, shaft]) m.frustumCulled = false;
  group.add(vane, shaft);

  return {
    group,
    uniforms: shared,
    setOrder(order) {
      vane.renderOrder = order;
      shaft.renderOrder = order + 1;
    },
  };
}
