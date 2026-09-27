import * as THREE from 'three';

// The film pass: the scene renders into an HDR target, then
//   bloom   — soft-knee bright pass, blurred at two scales (sun, moon, fireflies)
//   rays    — light scattered from the sun or moon through canopy gaps
//   grade   — lift / gamma / gain per time of day
//   lens    — vignette and fine animated grain
// All passes are fullscreen triangles; bloom and rays run at reduced size.

const FS_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FS = /* glsl */ `
  uniform sampler2D tMap; uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float knee = 0.25;
    float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, l - uThreshold) / max(l, 1e-4);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FS = /* glsl */ `
  uniform sampler2D tMap; uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb * 0.2270270;
    c += texture2D(tMap, vUv + uDir * 1.3846154).rgb * 0.3162162;
    c += texture2D(tMap, vUv - uDir * 1.3846154).rgb * 0.3162162;
    c += texture2D(tMap, vUv + uDir * 3.2307692).rgb * 0.0702703;
    c += texture2D(tMap, vUv - uDir * 3.2307692).rgb * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

// light scattering: march from each pixel toward the light, gathering the
// bright gaps between leaves — shafts appear only where the canopy lets light through
const RAYS_FS = /* glsl */ `
  uniform sampler2D tMap; uniform vec2 uLight; uniform float uThreshold; uniform float uDecay;
  varying vec2 vUv;
  const int N = SAMPLES;
  void main() {
    vec2 d = (uLight - vUv) / float(N) * 0.92;
    // dithered start hides banding between the samples
    vec2 p = vUv + d * fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
    float w = 1.0, acc = 0.0;
    for (int i = 0; i < N; i++) {
      p += d;
      vec3 c = texture2D(tMap, clamp(p, 0.0, 1.0)).rgb;
      float l = dot(c, vec3(0.3, 0.59, 0.11));
      acc += smoothstep(uThreshold, uThreshold + 0.07, l) * w;
      w *= uDecay;
    }
    gl_FragColor = vec4(vec3(acc / float(N)), 1.0);
  }
`;

const COMPOSITE_FS = /* glsl */ `
  uniform sampler2D tScene; uniform sampler2D tBloomA; uniform sampler2D tBloomB; uniform sampler2D tRays;
  uniform float uBloom; uniform float uRays; uniform vec3 uRayColor;
  uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain; uniform float uSat;
  uniform float uVignette; uniform float uGrain; uniform float uTime; uniform vec2 uRes;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    c += (texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.8) * uBloom;
    c += texture2D(tRays, vUv).r * uRayColor * uRays;
    // grade: lift / gamma / gain, then a touch of saturation control
    c = max(c, 0.0);
    c = uGain * (c + uLift * (1.0 - c));
    c = pow(max(c, 0.0), 1.0 / uGamma);
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    c = mix(vec3(l), c, uSat);
    // lens: gentle vignette, fine grain that doesn't crawl in flat areas
    vec2 q = vUv - 0.5;
    q.x *= uRes.x / uRes.y;
    c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
    float n = hash(vUv * uRes + fract(uTime * 7.13) * 91.7) - 0.5;
    c += n * uGrain * (0.35 + 0.65 * (1.0 - l));
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createPost(renderer, { quality = 'high' } = {}) {
  const hi = quality === 'high';
  const low = quality === 'low';
  const gl2 = renderer.capabilities.isWebGL2;
  const floatType = gl2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const target = (o = {}) => new THREE.WebGLRenderTarget(1, 1, { type: floatType, depthBuffer: false, ...o });

  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: floatType, samples: gl2 && !low ? 4 : 0 });
  const rtBright = target(), rtA1 = target(), rtA2 = target(), rtB1 = target(), rtB2 = target(), rtRays = target();

  const quad = new THREE.Mesh(new THREE.BufferGeometry(), null);
  quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quad.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.Camera();
  const mat = (fs, uniforms, defines) => new THREE.ShaderMaterial({ vertexShader: FS_VS, fragmentShader: fs, uniforms, defines, depthTest: false, depthWrite: false });

  const bright = mat(BRIGHT_FS, { tMap: { value: null }, uThreshold: { value: 0.82 } });
  const blur = mat(BLUR_FS, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
  const rays = mat(RAYS_FS, { tMap: { value: null }, uLight: { value: new THREE.Vector2(0.7, 0.9) }, uThreshold: { value: 0.72 }, uDecay: { value: 0.965 } }, { SAMPLES: hi ? 56 : 32 });
  const U = {
    tScene: { value: rtScene.texture }, tBloomA: { value: rtA1.texture }, tBloomB: { value: rtB1.texture }, tRays: { value: rtRays.texture },
    uBloom: { value: 0.55 }, uRays: { value: 0 }, uRayColor: { value: new THREE.Vector3(1, 0.93, 0.78) },
    uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 },
    uVignette: { value: 0.32 }, uGrain: { value: 0.035 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  };
  const composite = mat(COMPOSITE_FS, U);

  const size = new THREE.Vector2();
  function setSize() {
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, size.x), h = Math.max(1, size.y);
    rtScene.setSize(w, h);
    rtBright.setSize(w >> 1, h >> 1);
    rtA1.setSize(w >> 1, h >> 1); rtA2.setSize(w >> 1, h >> 1);
    rtB1.setSize(w >> 3, h >> 3); rtB2.setSize(w >> 3, h >> 3);
    rtRays.setSize(w >> 1, h >> 1);
    U.uRes.value.set(w, h);
  }

  function pass(material, out) {
    quad.material = material;
    renderer.setRenderTarget(out);
    renderer.render(scene, cam);
  }
  function blurInto(src, tmp, dst, w, h) {
    blur.uniforms.tMap.value = src.texture;
    blur.uniforms.uDir.value.set(1 / w, 0);
    pass(blur, tmp);
    blur.uniforms.tMap.value = tmp.texture;
    blur.uniforms.uDir.value.set(0, 1 / h);
    pass(blur, dst);
  }

  let raysEnabled = !low;
  function render(worldScene, camera, time) {
    renderer.setRenderTarget(rtScene);
    renderer.render(worldScene, camera);

    // bloom at two scales
    bright.uniforms.tMap.value = rtScene.texture;
    pass(bright, rtBright);
    blurInto(rtBright, rtA2, rtA1, rtA1.width, rtA1.height);
    blurInto(rtA1, rtB2, rtB1, rtB1.width, rtB1.height);
    blurInto(rtB1, rtB2, rtB1, rtB1.width, rtB1.height);

    // light scattering through the canopy
    if (raysEnabled && U.uRays.value > 0.001) {
      rays.uniforms.tMap.value = rtScene.texture;
      pass(rays, rtRays);
    } else {
      U.uRays.value = 0;
    }

    U.uTime.value = time;
    pass(composite, null);
  }

  return {
    uniforms: U,
    rays: rays.uniforms,
    bright: bright.uniforms,
    setSize,
    render,
    set raysEnabled(v) { raysEnabled = v; },
    get raysEnabled() { return raysEnabled; },
  };
}
