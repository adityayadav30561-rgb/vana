import { initMusic } from './music.js';
import { initWork } from './work.js';
import { initShowcase } from './showcase.js';
import { splitWords, prepareCounters, countUp, magnetic } from './ui.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
document.documentElement.classList.add('js');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ------------------------------------------------------------ split text --

$$('[data-split]').forEach(splitWords);

// a hand-drawn quill flourish beneath the hero's italic word
{
  const word = $('.hero__title em.w__i');
  if (word) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'flourish');
    svg.setAttribute('viewBox', '0 0 200 24');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 16 C 40 6, 70 22, 104 14 S 160 4, 176 12 C 184 16, 190 12, 196 6');
    svg.appendChild(path);
    word.parentElement.appendChild(svg);
    path.style.setProperty('--len', String(path.getTotalLength?.() || 260));
  }
}

// stagger sibling reveals
$$('.reveal, [data-split]').forEach((el) => {
  const sibs = [...el.parentElement.children].filter((c) => c.matches('.reveal, [data-split]'));
  el.style.setProperty('--d', `${sibs.indexOf(el) * 0.09}s`);
});

// -------------------------------------------------------------- reveals ---

const heroEls = $$('.hero .reveal, .hero [data-split]');
// section headlines wait for the feather: they appear as it drifts past them
const cueHeadlines = $$('main section:not(.hero) h2[data-split]');
const pendingHeadlines = new Set(cueHeadlines);
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      if (e.target.matches('.metric, .figure')) countUp(e.target, reduced);
      io.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
);
$$('.reveal, [data-split], .slide .figure').forEach((el) => { if (!heroEls.includes(el) && !cueHeadlines.includes(el)) io.observe(el); });

// ------------------------------------------------------------- count-up ---

prepareCounters();

// ----------------------------------------------------------------- nav ----

const nav = $('#nav');
const navLinks = $$('.nav__links a');
const sections = $$('main > section');
const menu = $('#menu');
const toggle = $('#menuToggle');

function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  } else {
    menu.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 500);
  }
}
toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
$$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });

// ------------------------------------------------------ micro-interactions -

if (finePointer && !reduced) {
  document.documentElement.classList.add('has-cursor');
  const cursor = $('.cursor');
  const dot = $('.cursor__dot'), ring = $('.cursor__ring');
  let mx = -100, my = -100, rx = -100, ry = -100;
  addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
  }, { passive: true });
  const loop = () => {
    rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener('pointerover', (e) => {
    cursor.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt]'));
    cursor.classList.toggle('is-dark', !!e.target.closest('.loader') || (!!e.target.closest('.nav') && !nav.classList.contains('is-scrolled')));
  });

  $$('[data-magnetic]').forEach(magnetic);

  const tilt = (el, amt) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - y) * amt}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * amt * 1.2}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  };
  $$('[data-tilt]').forEach((el) => tilt(el, 7));
  $$('.project__media').forEach((el) => tilt(el, 3));
}

// ------------------------------------------------------------- layout -----

let vw = innerWidth, vh = innerHeight, maxScroll = 1;
let anchors = [];
const track = $('#journeyTrack');
const pathSvg = $('#journeyPath');
const pathBase = $('.journey__base', pathSvg), pathLine = $('.journey__line', pathSvg);
let pathLen = 0, trackTop = 0, trackH = 1;
let headlineLines = [];
const lineParallax = finePointer && !reduced;
const stages = $$('.stage');
const parallaxEls = $$('[data-parallax]');

function measure() {
  vw = innerWidth;
  vh = innerHeight;
  maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
  const sy = scrollY;
  anchors = $$('[data-feather]')
    .map((el) => {
      const r = el.getBoundingClientRect();
      const docY = r.top + r.height / 2 + sy;
      const land = el.hasAttribute('data-land');
      let fy = parseFloat(el.dataset.fy ?? 0.5);
      let act = docY - fy * vh;
      if (land) { act = maxScroll; fy = (docY - maxScroll) / vh; }
      const mobile = vw < 720;
      return {
        el, land,
        act: clamp(act, 0, maxScroll),
        fx: clamp((r.left + r.width / 2) / vw, mobile ? 0.16 : 0.06, mobile ? 0.84 : 0.94),
        fy,
        fd: parseFloat(el.dataset.fd ?? (land ? 21 : 26)) * (mobile ? 1.1 : 1),
      };
    })
    .sort((a, b) => a.act - b.act);

  // group each headline's words into lines, for per-line parallax
  headlineLines = cueHeadlines.map((h) => {
    const words = [...h.querySelectorAll('.w')];
    words.forEach((w) => (w.style.transform = ''));
    const tops = [...new Set(words.map((w) => w.offsetTop))].sort((a, b) => a - b);
    return { h, words: words.map((w) => ({ el: w, line: tops.indexOf(w.offsetTop) })) };
  });

  // journey path through the stage nodes
  const tr = track.getBoundingClientRect();
  trackTop = tr.top + sy;
  trackH = tr.height;
  pathSvg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`);
  const pts = stages.map((s) => {
    const n = $('.stage__node', s).getBoundingClientRect();
    return [n.left + n.width / 2 - tr.left, n.top + n.height / 2 - tr.top];
  });
  const first = [vw < 720 ? pts[0][0] : tr.width / 2, 0];
  const last = [vw < 720 ? pts[pts.length - 1][0] : tr.width / 2, tr.height];
  const all = [first, ...pts, last];
  let d = `M${all[0][0]},${all[0][1]}`;
  for (let i = 1; i < all.length; i++) {
    const [x0, y0] = all[i - 1], [x1, y1] = all[i];
    const dy = (y1 - y0) * 0.5;
    d += ` C${x0},${y0 + dy} ${x1},${y1 - dy} ${x1},${y1}`;
  }
  pathBase.setAttribute('d', d);
  pathLine.setAttribute('d', d);
  pathLen = pathLine.getTotalLength();
  pathLine.style.strokeDasharray = `${pathLen}`;
  world?.planPath((f) => featherTarget(f * maxScroll));
}

// -------------------------------------------------------- feather path ---

function featherTarget(s) {
  if (!anchors.length) return { fx: 0.62, fy: 0.34, fd: 14, land: 0 };
  let i = anchors.findIndex((a) => a.act > s);
  if (i === -1) { const a = anchors[anchors.length - 1]; return { fx: a.fx, fy: a.fy, fd: a.fd, land: a.land ? 1 : 0 }; }
  if (i === 0) { const a = anchors[0]; return { fx: a.fx, fy: a.fy, fd: a.fd, land: 0 }; }
  const a = anchors[i - 1], b = anchors[i];
  const e = ease(clamp((s - a.act) / Math.max(1, b.act - a.act), 0, 1));
  return { fx: lerp(a.fx, b.fx, e), fy: lerp(a.fy, b.fy, e), fd: lerp(a.fd, b.fd, e), land: b.land ? e : 0 };
}

const springs = { fx: { x: 0.63, v: 0 }, fy: { x: 0.34, v: 0 }, fd: { x: 14, v: 0 } };
function spring(s, target, dt, w = 5.5, z = 0.82) {
  const a = w * w * (target - s.x) - 2 * z * w * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return s.x;
}

// ------------------------------------------------------------ main loop --

const zones = [
  [100, 'The sky'], [82, 'The canopy'], [56, 'Among the branches'], [32, 'The understorey'], [15, 'The forest floor'], [-99, 'The clearing'],
];
const altValue = $('#altValue'), altZone = $('#altZone'), altFill = $('#altFill'), altimeter = $('.altimeter');
const cue = $('#scrollCue');
const resultsEl = $('#results');

let world = null;
let sY = scrollY, lastSY = sY, vel = 0;
let time = 0, last = performance.now();
const pointer = { x: 0, y: 0, tx: 0, ty: 0, speed: 0, active: false, last: 0 };
addEventListener('pointermove', (e) => {
  const nx = (e.clientX / vw) * 2 - 1, ny = -((e.clientY / vh) * 2 - 1);
  const now = performance.now(), dtm = Math.max(8, now - pointer.last) / 1000;
  if (e.pointerType === 'mouse') {
    pointer.speed = lerp(pointer.speed, Math.hypot(nx - pointer.tx, ny - pointer.ty) / dtm, 0.5);
    pointer.active = true;
  }
  pointer.tx = nx; pointer.ty = ny; pointer.last = now;
}, { passive: true });
addEventListener('pointerleave', () => { pointer.active = false; });
// a click on empty space may land on a shaft of light
addEventListener('click', (e) => {
  if (!world || e.target.closest('a, button, input, textarea, [data-tilt], .glass, .card, .project__media, .nav, .menu')) return;
  world.poke((e.clientX / vw) * 2 - 1, -((e.clientY / vh) * 2 - 1));
});

let lastZone = '', lastAlt = -1, lastActive = null;
let glide = 0, lastGlideY = scrollY;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  const target = scrollY;
  sY = reduced ? target : lerp(sY, target, 1 - Math.exp(-dt * 8));
  if (Math.abs(sY - target) < 0.05) sY = target;
  const rawVel = (sY - lastSY) / Math.max(dt, 1e-3);
  vel = lerp(vel, rawVel, 0.12);
  lastSY = sY;
  const p = clamp(sY / maxScroll, 0, 1);

  pointer.x = lerp(pointer.x, pointer.tx, 0.05);
  pointer.y = lerp(pointer.y, pointer.ty, 0.05);
  pointer.speed *= Math.exp(-dt * 6);
  if (performance.now() - pointer.last > 2500) pointer.active = false;

  // nav + cue
  nav.classList.toggle('is-scrolled', target > 30);
  cue.classList.toggle('is-hidden', target > 12);
  altimeter.classList.toggle('is-visible', target > vh * 0.3);

  // active nav link
  let current = sections[0];
  for (const s of sections) if (s.offsetTop <= target + vh * 0.45) current = s;
  if (current !== lastActive) {
    lastActive = current;
    navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${current.id}`));
  }

  // journey path + stages
  const jp = clamp((sY + vh * 0.5 - trackTop) / trackH, 0, 1);
  pathLine.style.strokeDashoffset = `${pathLen * (1 - jp)}`;
  for (const a of anchors) {
    const stage = a.el.closest('.stage');
    if (stage) stage.classList.toggle('is-active', sY >= a.act - vh * 0.18);
  }

  // image parallax (read then write)
  const rects = parallaxEls.map((el) => el.parentElement.getBoundingClientRect());
  parallaxEls.forEach((el, i) => {
    const r = rects[i];
    if (r.bottom < -200 || r.top > vh + 200) return;
    const off = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
    el.style.transform = `translate3d(0, ${(-off).toFixed(1)}px, 0)`;
  });

  // headlines in view reveal when the feather reaches their height (or as a
  // fallback once they're well up the screen)
  for (const h of pendingHeadlines) {
    const r = h.getBoundingClientRect();
    if (r.top > vh || r.bottom < 0) continue;
    const featherY = world ? springs.fy.x * vh : vh * 0.5;
    if (r.top + r.height * 0.35 <= featherY + vh * 0.05 || r.top < vh * 0.22) { h.classList.add('is-in'); pendingHeadlines.delete(h); }
  }

  // headline lines drift apart a little with depth as they cross the screen
  if (lineParallax) {
    for (const { h, words } of headlineLines) {
      const r = h.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const k = (r.top + r.height / 2 - vh / 2) / vh;
      for (const w of words) w.el.style.transform = `translate3d(0, ${(k * w.line * 18).toFixed(1)}px, 0)`;
    }
  }

  // light: the clearing brightens around the results section
  const rr = resultsEl.getBoundingClientRect();
  const bright = clamp(1 - Math.abs(rr.top + rr.height / 2 - vh / 2) / (vh * 0.9), 0, 1);

  if (world) {
    const t = featherTarget(sY);
    const k = reduced ? 1 : Math.min(1, dt * 60);
    const land = t.land;
    const fx = spring(springs.fx, t.fx, dt * k), fy = spring(springs.fy, t.fy, dt * k), fd = spring(springs.fd, t.fd, dt * k);
    // one glide swing per ~2.6 viewports scrolled, drifting on when idle
    glide += (Math.abs(sY - lastGlideY) / vh) * 2.4 + dt * 0.3;
    lastGlideY = sY;
    const la = anchors[anchors.length - 1];
    const out = world.update({
      p,
      time,
      dt,
      reduced,
      bright: ease(bright),
      pointer,
      feather: {
        // scroll sways it gently side to side; the world adds wind and banking
        fx,
        phase: glide,
        fy,
        d: fd,
        land,
        landFx: la?.fx,
        landFy: la?.fy,
        vel,
        windAmt: vw < 720 ? 0.6 : 1,
        scale: vw < 720 ? 0.9 : 1,
      },
    });
    // the song swells a little as Krishna comes into view
    music.setLevel(0.85 + 0.6 * clamp((p - 0.78) / 0.2, 0, 1));
    const alt = Math.max(0, Math.round(out.altitude));
    if (alt !== lastAlt) {
      lastAlt = alt;
      altValue.textContent = `Alt. ${alt} m`;
      altFill.style.transform = `scaleY(${p.toFixed(3)})`;
      const z = zones.find(([h]) => out.altitude > h)[1];
      if (z !== lastZone) { lastZone = z; altZone.textContent = z; }
    }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot ----

const music = initMusic($('#soundToggle'));
initShowcase({ reduced });
initWork({ reduced });
const loader = $('#loader');
const intro = $('#introFeather');
function finishLoading() {
  // the eye completes, then the forest appears
  loader.classList.add('is-drawn');
  setTimeout(() => loader.classList.add('is-done'), reduced ? 0 : 650);
  document.body.classList.remove('is-loading');
  measure();
  setTimeout(() => heroEls.forEach((el) => el.classList.add('is-in')), reduced ? 0 : 850);
  music.begin();
}

const android = /Android/i.test(navigator.userAgent);
if (android) document.documentElement.classList.add('lite');

function pickQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  // Android GPUs vary wildly (some crash the browser under load), so every
  // Android device gets the lean forest, whatever its screen size
  if (vw < 720 || mem <= 2 || android) return 'low';
  if (vw < 1100 || cores <= 4) return 'medium';
  return 'high';
}

// ------------------------------------------------------- crash guard ----
// If the 3D forest ever takes the browser down on a device, later visits
// remember and show the still forest instead of crashing again. A visit that
// ends normally (the page is closed, left or backgrounded) clears the mark;
// only a crash leaves it behind. ?forest=on in the address tries the 3D forest again.
//
// A visit can also end without a word when the browser is swiped away or the
// phone discards the tab, which looks just like a crash. So one unclean ending
// is forgiven: only two in a row rest the device, and only for a day.

// (renamed from 'vana:forest-v2', which rested a device after a single unclean
// ending; devices marked by it get the 3D forest back)
const GL_KEY = 'vana:forest-v3';
const GL_STRIKES = 2; // unclean endings in a row before a device rests
const GL_REST = 24 * 3600 * 1000; // how long a device that crashed rests on the still forest
try { ['vana:forest', 'vana:forest-v2'].forEach((k) => localStorage.removeItem(k)); } catch { /* storage unavailable */ }
const glRead = () => { try { return JSON.parse(localStorage.getItem(GL_KEY) || 'null'); } catch { return null; } };
const glWrite = (v) => { try { v ? localStorage.setItem(GL_KEY, JSON.stringify(v)) : localStorage.removeItem(GL_KEY); } catch { /* storage unavailable */ } };

let glStrikes = 0; // unclean endings before this visit
function forestAllowed() {
  if (new URLSearchParams(location.search).get('forest') === 'on') { glWrite(null); return true; }
  const mark = glRead();
  if (mark?.state === 'off') {
    if (Date.now() < mark.until) return false;
    glWrite(null); // rested long enough: try again with a clean slate
    return true;
  }
  // the last visit started the forest and never finished
  if (mark?.state === 'starting') {
    glStrikes = (mark.strikes || 0) + 1;
    if (glStrikes >= GL_STRIKES) { glWrite({ state: 'off', until: Date.now() + GL_REST }); return false; }
  }
  return true;
}

let glLost = false, lostTimer = 0;
function awaitRestore() {
  const wait = () => { clearTimeout(lostTimer); lostTimer = setTimeout(() => { if (glLost) stillForest(); }, 4000); };
  if (!document.hidden) { wait(); return; }
  const onVisible = () => {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', onVisible);
    if (glLost) wait();
  };
  document.addEventListener('visibilitychange', onVisible);
}

function stillForest() {
  world = null;
  document.body.classList.remove('has-post');
  document.body.classList.add('no-webgl');
}

async function boot() {
  measure();
  requestAnimationFrame(frame);
  if (!forestAllowed()) {
    stillForest();
    setTimeout(finishLoading, reduced ? 0 : 350);
    return;
  }
  glWrite({ state: 'starting', at: Date.now(), strikes: glStrikes });
  // leaving the page, or putting it in the background, means it didn't crash
  // (a crash freezes the page before either can run)
  const cleared = () => { if (glRead()?.state === 'starting') glWrite(null); };
  addEventListener('pagehide', cleared);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cleared(); });
  try {
    // three.js and the painter load as their own chunk, after the page is up
    const { createWorld } = await import('./world/world.js');
    world = await createWorld($('#world'), {
      quality: pickQuality(),
      imageUrl: new URL('../assets/krishna.webp', import.meta.url).href,
      featherUrl: new URL('../assets/feather.webp', import.meta.url).href,
      onProgress: (f) => {
        intro.style.setProperty('--p', f.toFixed(3));
        loader.style.setProperty('--p', f.toFixed(3));
      },
      // Android takes the GPU away when the tab is backgrounded or the screen locks,
      // and gives it back on return. That's not a crash: wait for it. Only if it
      // hasn't come back a few seconds after the page is visible again does the
      // visit carry on over the still forest (without marking the device).
      onLost: () => { glLost = true; awaitRestore(); },
      onRestored: () => { glLost = false; clearTimeout(lostTimer); },
    });
    // the forest has been running for a while without trouble: clear the mark
    setTimeout(() => { if (world && glRead()?.state === 'starting') glWrite(null); }, 8000);
    // the film pass draws its own vignette and grain
    document.body.classList.add('has-post');
  } catch (err) {
    console.warn('WebGL forest unavailable, using the static fallback.', err);
    glWrite(null);
    stillForest();
  }
  setTimeout(finishLoading, reduced ? 0 : 350);
}

let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { world?.resize(); measure(); }, 120);
});
new ResizeObserver(() => measure()).observe($('main'));
document.fonts?.ready.then(measure);

boot();
