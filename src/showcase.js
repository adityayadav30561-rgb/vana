// The Work showcase: tabs switch discipline, each discipline is a slider.
// The markup is rendered at build time from src/content/projects.js.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, '0');

export function initShowcase({ reduced = false } = {}) {
  const root = $('[data-showcase]');
  if (!root) return;
  const tablist = $('.tabs', root);
  const tabs = $$('[role="tab"]', root);
  const panels = $$('[role="tabpanel"]', root);
  const ink = $('.tabs__ink', root);
  const count = $('.showcase__counter b', root), total = $('.showcase__total', root);
  const [prev, next] = $$('.showcase__btn', root);
  const bar = $('.showcase__progress i', root);
  let active = Math.max(0, panels.findIndex((p) => p.classList.contains('is-active')));

  // lets the track bleed to the window edges while lining up with the page
  const setScrollbar = () => document.documentElement.style.setProperty('--sbw', `${innerWidth - document.documentElement.clientWidth}px`);
  setScrollbar();

  const track = (k = active) => $('.showcase__track', panels[k]);
  const slides = (k = active) => $$('.slide', panels[k]);
  const offset = (ss, i) => ss[i].offsetLeft - ss[0].offsetLeft;

  function nearest(k = active) {
    const tr = track(k), ss = slides(k);
    let best = 0, d = Infinity;
    ss.forEach((_, i) => {
      const dd = Math.abs(offset(ss, i) - tr.scrollLeft);
      if (dd < d) { d = dd; best = i; }
    });
    return best;
  }

  function go(i) {
    const tr = track(), ss = slides();
    i = Math.max(0, Math.min(ss.length - 1, i));
    tr.scrollTo({ left: offset(ss, i), behavior: reduced ? 'auto' : 'smooth' });
  }

  function update() {
    const tr = track(), n = slides().length;
    const max = tr.scrollWidth - tr.clientWidth;
    const p = max > 1 ? tr.scrollLeft / max : 1;
    const i = nearest();
    count.textContent = pad(i + 1);
    // the slide in view is the current one: it comes forward and draws its line
    slides().forEach((s, k) => s.classList.toggle('is-current', k === i));
    total.textContent = pad(n);
    bar.style.setProperty('--p', ((1 + p * (n - 1)) / n).toFixed(4));
    prev.disabled = tr.scrollLeft <= 2;
    next.disabled = max <= 2 || tr.scrollLeft >= max - 2;
  }

  function placeInk() {
    const t = tabs[active];
    ink.style.setProperty('--x', `${t.offsetLeft}px`);
    ink.style.setProperty('--w', `${t.offsetWidth}px`);
  }

  function select(k, focus = false) {
    if (k === active) { if (focus) tabs[k].focus(); return; }
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === k));
      t.tabIndex = i === k ? 0 : -1;
    });
    panels.forEach((p, i) => {
      p.classList.toggle('is-active', i === k);
      p.inert = i !== k;
    });
    active = k;
    track().scrollLeft = 0;
    placeInk();
    update();
    if (focus) tabs[k].focus();
    tabs[k].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  tablist.addEventListener('keydown', (e) => {
    const k = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (k == null) return;
    e.preventDefault();
    select((k + tabs.length) % tabs.length, true);
  });
  prev.addEventListener('click', () => go(nearest() - 1));
  next.addEventListener('click', () => go(nearest() + 1));

  panels.forEach((panel, k) => {
    const tr = track(k);
    let raf = 0;
    tr.addEventListener('scroll', () => {
      if (k !== active || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; update(); });
    }, { passive: true });

    // drag with the mouse, like a touch swipe; a drag never counts as a click
    let id = null, sx = 0, sl = 0, from = 0, moved = false;
    tr.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      id = e.pointerId; sx = e.clientX; sl = tr.scrollLeft; from = nearest(k); moved = false;
    });
    tr.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        tr.setPointerCapture(id);
        tr.classList.add('is-dragging');
      }
      if (moved) tr.scrollLeft = sl - dx;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!moved) return;
      const dx = e.clientX - sx;
      // snapping resumes at once, and the track glides to the chosen slide
      tr.classList.remove('is-dragging');
      go(dx < -50 ? from + 1 : dx > 50 ? from - 1 : from);
    };
    tr.addEventListener('pointerup', end);
    tr.addEventListener('pointercancel', end);
    tr.addEventListener('click', (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    }, true);
  });

  addEventListener('resize', () => { setScrollbar(); placeInk(); update(); });
  document.fonts?.ready.then(() => { placeInk(); update(); });
  placeInk();
  update();
  requestAnimationFrame(() => tablist.classList.add('is-ready'));
}
