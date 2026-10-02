// Work: the SEO case studies. Each case opens its dashboards in a lightbox;
// the screenshots are read straight from the case's own markup.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function initWork({ reduced = false } = {}) {
  const dialog = $('#lightbox');
  const cases = $$('.case');

  // the growth line draws itself as each case comes into view
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-seen');
      seen.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -18% 0px', threshold: 0.15 });
  cases.forEach((c) => seen.observe(c));
  if (!dialog) return;

  const img = $('#lbImg'), cap = $('#lbCap'), thumbs = $('#lbThumbs'), count = $('#lbCount');
  const print = $('.lightbox__figure', dialog);
  const site = $('#lbSite');
  const pad = (n) => String(n).padStart(2, '0');
  let shots = [], index = 0, opener = null;

  function show(i, dir = 0) {
    index = (i + shots.length) % shots.length;
    const s = shots[index];
    img.src = s.src;
    img.alt = s.alt;
    img.width = s.w;
    img.height = s.h;
    cap.textContent = s.label;
    if (count) count.textContent = `${pad(index + 1)} / ${pad(shots.length)}`;
    $$('button', thumbs).forEach((b, k) => b.setAttribute('aria-current', k === index ? 'true' : 'false'));
    // the next print slides in from the side it comes from, settling as it lands
    if (dir && !reduced) {
      print.animate(
        [
          { opacity: 0, transform: `translateX(${dir * 60}px) rotate(${dir * 1.6}deg) scale(0.97)` },
          { opacity: 1, transform: 'rotate(-0.4deg)' },
        ],
        { duration: 640, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    }
    dialog.classList.toggle('is-single', shots.length < 2);
  }

  function open(article, at = 0, from = null) {
    opener = from;
    shots = $$('.shot', article)
      .sort((a, b) => a.dataset.shot - b.dataset.shot)
      .map((el) => {
        const im = $('img', el);
        return { src: im.currentSrc || im.src, alt: im.alt, w: im.width, h: im.height, label: el.dataset.label };
      });
    // the name is carried on the project itself: layouts differ in how they show it
    $('#lbTitle').textContent = article.dataset.name || $('h3', article)?.textContent || '';
    $('#lbMeta').textContent = $('.project__meta', article)?.textContent || '';
    // a project without a live site has no link to show
    const url = article.dataset.site;
    site.hidden = !url;
    if (url) {
      site.href = url;
      $('span', site).textContent = new URL(url).hostname.replace(/^www\./, '');
    } else site.removeAttribute('href');
    thumbs.replaceChildren(...shots.map((s, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lightbox__thumb';
      b.setAttribute('aria-label', s.label);
      const t = document.createElement('img');
      t.src = s.src;
      t.alt = '';
      const l = document.createElement('span');
      l.textContent = s.label.includes('AI features') ? 'AI features' : s.label.split(' · ')[0];
      b.append(t, l);
      b.addEventListener('click', () => show(k, Math.sign(k - index)));
      return b;
    }));
    show(at);
    dialog.classList.remove('is-closing');
    dialog.showModal();
    $('#lbClose').focus({ preventScroll: true });
  }

  function close() {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    if (reduced) { dialog.close(); return; }
    dialog.classList.add('is-closing');
    setTimeout(() => { dialog.close(); dialog.classList.remove('is-closing'); }, 260);
  }
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

  for (const article of cases) {
    $$('[data-open]', article).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        // open on the screenshot that was clicked, when it was one
        const s = e.target.closest('.shot');
        open(article, s ? +s.dataset.shot : +btn.dataset.open || 0, btn);
      });
    });
  }

  $('#lbClose').addEventListener('click', close);
  $('#lbPrev').addEventListener('click', () => show(index - 1, -1));
  $('#lbNext').addEventListener('click', () => show(index + 1, 1));
  // a click on the dimmed backdrop (the dialog itself, outside the panel) closes
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1, 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1, -1); }
  });

  // the page behind stays put while the lightbox is open
  dialog.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  dialog.addEventListener('touchmove', (e) => { if (e.touches.length < 2) e.preventDefault(); }, { passive: false });

  // swipe between screenshots
  let sx = null;
  const stage = $('.lightbox__stage', dialog);
  stage.addEventListener('pointerdown', (e) => { if (e.isPrimary) sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50 && shots.length > 1) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
}
