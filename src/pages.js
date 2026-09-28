// The /work page and the project pages. Instead of the 3D world they get a
// living still of the forest (parallax layers, light rays, drifting motes),
// the same feather drifting down the page to rest in the grass, and the same
// type, reveals, counters, lightbox and music as the home page.

import { initMusic } from './music.js';
import { initWork } from './work.js';
import { splitWords, prepareCounters, countUp, magnetic, steadyHeight } from './ui.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');
// Android: no frosted-glass blurs (see .lite in style.css)
if (/Android/i.test(navigator.userAgent)) document.documentElement.classList.add('lite');

// ---------------------------------------------------------- reveals -----

$$('[data-split]').forEach(splitWords);
$$('.reveal, [data-split]').forEach((el) => {
  if (el.style.getPropertyValue('--d')) return;
  const sibs = [...el.parentElement.children].filter((c) => c.matches('.reveal, [data-split]'));
  el.style.setProperty('--d', `${sibs.indexOf(el) * 0.09}s`);
});
prepareCounters();
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    countUp(e.target, reduced);
    io.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
$$('.reveal, [data-split], .section-num, .project-figure').forEach((el) => io.observe(el));

if (finePointer && !reduced) $$('[data-magnetic]').forEach(magnetic);

// ------------------------------------------------ the living forest -----

const nav = $('#nav');
const far = $('.forest-bg__far');
const nearL = $('.forest-bg__near--l'), nearR = $('.forest-bg__near--r');
const body = document.body;

// fireflies and pollen, each on its own slow drift
{
  const motes = $('.forest-bg__motes');
  const n = reduced ? 0 : innerWidth < 720 ? 14 : 28;
  const r = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < n; i++) {
    const m = document.createElement('i');
    const pollen = i % 3 === 0;
    m.className = pollen ? 'mote mote--pollen' : 'mote';
    const s = pollen ? r(1.5, 3) : r(3, 6);
    m.style.cssText = `--x:${r(0, 100).toFixed(1)}%;--y:${r(10, 100).toFixed(1)}%;--s:${s.toFixed(1)}px;--t:${r(9, 20).toFixed(1)}s;--dx:${r(-50, 50).toFixed(0)}px;--dy:${r(-70, 30).toFixed(0)}px;--dl:-${r(0, 20).toFixed(1)}s`;
    motes.appendChild(m);
  }
}

function onScroll() {
  const y = scrollY;
  // the steady height, so a phone's address bar sliding in and out doesn't jolt anything
  const vhSteady = steadyHeight();
  const max = Math.max(1, document.documentElement.scrollHeight - vhSteady);
  nav.classList.toggle('is-scrolled', y > 30);
  // light at the top; toward the foot of the page it drifts into dusk
  body.style.setProperty('--night', (Math.pow(clamp((y / max - 0.3) / 0.7, 0, 1), 1.3) * 0.85).toFixed(3));
  if (reduced) return;
  // the still drifts across the page's length, but never past the 6% it overhangs the window
  far.style.transform = `translate3d(0, ${((0.5 - y / max) * vhSteady * 0.1).toFixed(1)}px, 0)`;
  nearL.style.transform = `translate3d(0, ${(y * -0.42).toFixed(1)}px, 0)`;
  nearR.style.transform = `translate3d(0, ${(y * -0.3).toFixed(1)}px, 0)`;
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// --------------------------------------------------------- the feather --
// It follows elements marked data-feather, as on the home page: it reaches
// each one as it scrolls to data-fy of the window (at data-fx across it),
// and comes to rest on the one marked data-feather-land.

function initFeather() {
  const el = $('.page-feather');
  if (!el) return;
  if (reduced) { el.remove(); return; }
  let points = [];
  let vw = innerWidth, vh = steadyHeight();

  function measure() {
    vw = innerWidth; vh = steadyHeight();
    const max = document.documentElement.scrollHeight - vh;
    points = $$('[data-feather]').map((a) => {
      const r = a.getBoundingClientRect();
      const top = r.top + scrollY;
      const land = a.hasAttribute('data-feather-land');
      const fy = parseFloat(a.dataset.fy || '0.5');
      const x = a.dataset.fx ? parseFloat(a.dataset.fx) * vw : r.left + r.width / 2;
      // the landing is reached when the page reaches its end
      const at = land ? max : clamp(top - fy * vh, 0, max);
      return { x, y: top, at, land };
    }).sort((a, b) => a.at - b.at);
  }

  const pos = { x: vw * 0.7, y: -80 }, vel = { x: 0, y: 0 };
  let phase = 0, lastY = scrollY, last = performance.now(), landK = 0, ready = false;

  function target(s) {
    if (!points.length) return { x: vw * 0.8, y: vh * 0.3, k: 0 };
    let i = 0;
    while (i < points.length - 1 && points[i + 1].at <= s) i++;
    const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
    const t = b === a ? 0 : smooth(clamp((s - a.at) / Math.max(1, b.at - a.at), 0, 1));
    // points live in the document; the feather lives in the window
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t) - s;
    const k = b.land ? t : a.land ? 1 : 0;
    return { x, y, k };
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const s = scrollY;
    const tg = target(s);
    landK = lerp(landK, tg.k, 1 - Math.exp(-dt * 6));
    if (!ready) { pos.x = tg.x; pos.y = tg.y - vh * 0.4; }
    // a soft spring toward the path
    const k = 18, d = 7.5;
    vel.x += ((tg.x - pos.x) * k - vel.x * d) * dt;
    vel.y += ((tg.y - pos.y) * k - vel.y * d) * dt;
    pos.x += vel.x * dt; pos.y += vel.y * dt;
    // how a feather falls: a pendulum swing, driven by scrolling and a little by time
    phase += (Math.abs(s - lastY) / vh) * 2.6 + dt * 0.45;
    lastY = s;
    const free = 1 - smooth(clamp(landK, 0, 1));
    const swing = Math.sin(phase) * 18 * free;
    const drift = Math.sin(phase + 1.3) * 20 * free + Math.sin(now / 1300) * 3 * free;
    const bob = Math.sin(now / 900) * 4 * free;
    // at rest it lies across the grass
    const rot = lerp(swing + clamp(vel.x * 0.02, -12, 12), -76, 1 - free);
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.transform = `translate3d(${(pos.x + drift - w / 2).toFixed(1)}px, ${(pos.y + bob - h / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${lerp(1, 1.4, 1 - free).toFixed(3)})`;
    if (!ready) { ready = true; el.classList.add('is-ready'); }
    // once it has settled it lies on top of the grass, not behind it
    el.classList.toggle('is-landed', landK > 0.6);
    requestAnimationFrame(frame);
  }

  const start = () => { measure(); requestAnimationFrame(frame); };
  if (el.complete) start(); else el.addEventListener('load', start, { once: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  new ResizeObserver(measure).observe(document.body);
}
initFeather();

// ---------------------------------------------------- /work: filters ----

const filters = $$('.filter');
if (filters.length) {
  const rows = $$('.index__row');
  const empties = $$('.index__empty');
  const apply = (id, push = true) => {
    if (!filters.some((f) => f.dataset.filter === id)) id = 'all';
    const run = () => {
      filters.forEach((f) => f.setAttribute('aria-pressed', String(f.dataset.filter === id)));
      rows.forEach((c) => { c.hidden = id !== 'all' && c.dataset.category !== id; });
      empties.forEach((e) => { e.hidden = e.dataset.empty !== id; });
    };
    // rows glide into their new places where the browser supports it
    if (document.startViewTransition && !reduced && push) document.startViewTransition(run);
    else run();
    if (push) {
      const url = new URL(location.href);
      if (id === 'all') url.searchParams.delete('c'); else url.searchParams.set('c', id);
      history.replaceState(null, '', url);
    }
  };
  filters.forEach((f) => f.addEventListener('click', () => apply(f.dataset.filter)));
  apply(new URLSearchParams(location.search).get('c') || 'all', false);
}

// --------------------------------- /work: a print follows the cursor ----

const preview = $('.index-preview');
if (preview && finePointer) {
  const items = $$('.index-preview__item', preview);
  let tx = 0, ty = 0, x = 0, y = 0, on = false, raf = 0, placed = false;
  const loop = () => {
    const px = x;
    x = lerp(x, tx, reduced ? 1 : 0.14);
    y = lerp(y, ty, reduced ? 1 : 0.14);
    const w = preview.offsetWidth;
    // keep to the open side of the cursor
    const side = tx > innerWidth * 0.58 ? -w - 48 : 48;
    const tilt = clamp((x - px) * 0.5, -8, 8);
    preview.style.transform = `translate3d(${(x + side).toFixed(1)}px, ${(y - w * 0.4).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    raf = on || Math.abs(tx - x) > 0.5 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    if (!placed) { x = tx; y = ty; placed = true; }
  }, { passive: true });
  $$('.index__row').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      items.forEach((i) => i.classList.toggle('is-active', i.dataset.for === row.dataset.id));
      preview.classList.add('is-on');
      on = true;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    row.addEventListener('pointerleave', () => { preview.classList.remove('is-on'); on = false; });
  });
  // load the previews once the page is settled, so the first hover isn't empty
  addEventListener('load', () => $$('img', preview).forEach((img) => { img.loading = 'eager'; }));
}

// -------------------------------------------------- lightbox, music -----

initWork({ reduced });
const soundToggle = $('#soundToggle');
if (soundToggle) initMusic(soundToggle).begin();
