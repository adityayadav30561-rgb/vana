// Renders the Work showcase (tabs + sliders) from projects.js into HTML, and
// holds the pieces the work pages share. Runs in Node at build time and in
// the dev server, never in the browser.

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const fmt = (v, dec = 0) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const pad = (n) => String(n).padStart(2, '0');
export const host = (url) => new URL(url).hostname.replace(/^www\./, '');
/** '*word*' → gold italic */
export const emph = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

export const ICONS = {
  websites: '<rect x="7" y="10" width="34" height="26" rx="3" /><path d="M7 16h34" opacity=".45" /><path d="M16 42h16M24 36v6" /><path d="M14 30c4-6 7-9 10-6s6 1 10-5" />',
  apps: '<rect x="14" y="5" width="20" height="38" rx="4" /><path d="M21 9h6" opacity=".45" /><path d="M19 17h10M19 22h10M19 27h6" opacity=".45" />',
  custom: '<path d="M17 14 7 24l10 10M31 14l10 10-10 10" /><path d="M27 9 21 39" opacity=".45" />',
};

/** '+7,245%' → { prefix: '+', value: 7245, decimals: 0, suffix: '%' } */
export function parseFigure(v) {
  const m = String(v).match(/^([+\-−]?)([\d,]*\.?\d+)(.*)$/);
  if (!m) return null;
  const digits = m[2].replace(/,/g, '');
  return { prefix: m[1], value: parseFloat(digits), decimals: (digits.split('.')[1] || '').length, suffix: m[3] };
}

/** A figure that counts up when it comes into view. */
export function countingFigure(v) {
  const f = parseFigure(v);
  if (!f) return esc(v);
  return `<span data-count="${f.value}" data-decimals="${f.decimals}" data-prefix="${esc(f.prefix)}" data-suffix="${esc(f.suffix)}">${esc(v)}</span>`;
}

/**
 * A rising gold line, like the Journey's path, different for every project.
 * Drawn in a 1000 × 400 box; the path climbs from lower left to upper right.
 */
export function growthPath(id) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pts = [[0, 372]];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const y = 372 - Math.pow(k, 1.9 + r() * 0.5) * 320 + (r() - 0.5) * 60 * (1 - k);
    pts.push([Math.round(k * 1000), Math.round(Math.max(26, Math.min(385, y)))]);
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${Math.round(c1[0])} ${Math.round(c1[1])} ${Math.round(c2[0])} ${Math.round(c2[1])} ${p2[0]} ${p2[1]}`;
  }
  return { d, end: pts[pts.length - 1][1] / 400 };
}

export function growthLine(id, cls = '') {
  const { d, end } = growthPath(id);
  return `<span class="growth ${cls}" aria-hidden="true" style="--end: ${(end * 100).toFixed(1)}%">
            <svg viewBox="0 0 1000 400" preserveAspectRatio="none"><path class="growth__base" d="${d}" /><path class="growth__line" pathLength="1" d="${d}" /></svg>
            <i class="growth__dot"></i>
          </span>`;
}

/**
 * One screenshot as a print: matted paper, a strip of tape, a caption.
 * `shot` marks it as a source for the lightbox.
 */
export function print(s, k, root = './', { shot = true, name = '', eager = false } = {}) {
  return `<span class="print print--${k + 1}${shot ? ' shot' : ''}" data-shot="${k}" data-label="${esc(s.label)}"${name ? ` style="view-transition-name: ${name}"` : ''}>
                <span class="print__mat">
                  <img src="${root}assets/work/${esc(s.file)}.webp" width="${s.w}" height="${s.h}" alt="${esc(s.alt)}"${eager ? '' : ' loading="lazy"'} decoding="async" />
                  <span class="print__cap">${esc(s.label)}</span>
                </span>
              </span>`;
}

/** The fan of prints for a project. `interactive` makes it open the lightbox. */
export function prints(p, root = './', { interactive = true, shot = true, eager = false, name = true, cls = '' } = {}) {
  const items = p.shots.slice(0, 3).map((s, k) => print(s, k, root, { shot, eager, name: name && k === 0 ? `vt-print-${p.id}` : '' })).join('\n              ');
  const n = p.shots.length;
  if (!interactive) return `<span class="prints ${cls}" aria-hidden="true">${items}</span>`;
  return `<button class="prints project__media ${cls}" type="button" data-open="0" aria-label="${esc(p.name)}: view the ${n} screenshots">
              ${items}
              <span class="prints__hint" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" /></svg>View ${n} screenshots</span>
            </button>`;
}

/** Blank prints for a discipline whose case studies are still being written. */
export function blankPrints(id) {
  return `<span class="prints prints--blank" aria-hidden="true">
              <span class="print print--1"><span class="print__mat"><span class="print__blank"><svg class="print__icon" viewBox="0 0 48 48">${ICONS[id] || ICONS.custom}</svg></span><span class="print__cap">Coming soon</span></span></span>
              <span class="print print--2"><span class="print__mat"><span class="print__blank"></span><span class="print__cap">&nbsp;</span></span></span>
              <span class="print print--3"><span class="print__mat"><span class="print__blank"></span><span class="print__cap">&nbsp;</span></span></span>
            </span>`;
}

function slide(p, i, total) {
  return `
          <article class="slide case" data-case="${esc(p.id)}" data-name="${esc(p.name)}"${p.site ? ` data-site="${esc(p.site)}"` : ''} style="--accent: ${esc(p.accent || '#e2b35f')}; --i: ${i}" aria-roledescription="slide" aria-label="${i + 1} of ${total}: ${esc(p.name)}">
            ${growthLine(p.id)}
            <div class="slide__story scrim">
              <p class="project__meta">${esc(p.meta)}</p>
              ${p.badge ? `<p class="figure">${countingFigure(p.badge.value)}</p>
              <p class="figure__label">${esc(p.badge.label)}</p>` : ''}
              <h3 class="slide__name" style="view-transition-name: vt-name-${esc(p.id)}">${esc(p.name)}</h3>
              <p class="slide__text">${esc(p.summary)}</p>
              <div class="case__links">
                <a class="link-arrow" href="./work/${esc(p.id)}/">Read the case study <svg aria-hidden="true"><use href="#arrow" /></svg></a>
                ${p.site ? `<a class="case__site" href="${esc(p.site)}" target="_blank" rel="noopener">${esc(host(p.site))}<svg aria-hidden="true"><use href="#arrow-out" /></svg></a>` : ''}
              </div>
            </div>
            ${prints(p)}
          </article>`;
}

function emptySlide(c) {
  return `
          <article class="slide slide--empty" style="--i: 0">
            ${growthLine(c.id, 'growth--faint')}
            <div class="slide__story scrim">
              <p class="project__meta">${esc(c.label)} · Coming soon</p>
              <p class="slide__soon">${esc(c.empty.title)}</p>
              <p class="slide__text">${esc(c.empty.text)}</p>
              <div class="case__links">
                <a class="link-arrow" href="#contact">Ask for a walkthrough <svg aria-hidden="true"><use href="#arrow" /></svg></a>
              </div>
            </div>
            ${blankPrints(c.id)}
          </article>`;
}

export function renderShowcase(categories, projects) {
  const groups = categories.map((c) => ({ ...c, items: projects.filter((p) => p.category === c.id) }));
  const shown = groups.filter((g) => g.items.length || g.empty);
  const first = shown.findIndex((g) => g.items.length);
  const active = first < 0 ? 0 : first;

  const tabs = shown.map((g, i) => `
            <button class="tabs__tab" type="button" role="tab" id="tab-${g.id}" aria-controls="panel-${g.id}" aria-selected="${i === active}" tabindex="${i === active ? 0 : -1}">${esc(g.label)}${g.items.length ? `<span class="tabs__count">${pad(g.items.length)}</span>` : ''}</button>`).join('');

  const panels = shown.map((g, i) => {
    const slides = g.items.length ? g.items.map((p, k) => slide(p, k, g.items.length)).join('\n') : emptySlide(g);
    return `
        <div class="showcase__panel${i === active ? ' is-active' : ''}" role="tabpanel" id="panel-${g.id}" aria-labelledby="tab-${g.id}"${i === active ? '' : ' inert'}>
          <div class="showcase__track" aria-roledescription="carousel" aria-label="${esc(g.label)} work">${slides}
          </div>
        </div>`;
  }).join('');

  return `<div class="showcase reveal" data-showcase>
        <div class="showcase__bar">
          <div class="tabs" role="tablist" aria-label="Work by discipline">${tabs}
            <span class="tabs__ink" aria-hidden="true"></span>
          </div>
          <div class="showcase__nav">
            <p class="showcase__counter" aria-live="polite"><b>01</b><span>/</span><span class="showcase__total">${pad(shown[active]?.items.length || 1)}</span></p>
            <button class="showcase__btn" type="button" data-dir="-1" aria-label="Previous project"><svg aria-hidden="true"><use href="#arrow" /></svg></button>
            <button class="showcase__btn" type="button" data-dir="1" aria-label="Next project"><svg aria-hidden="true"><use href="#arrow" /></svg></button>
          </div>
        </div>
        <div class="showcase__panels">${panels}
        </div>
        <div class="showcase__progress" aria-hidden="true"><i></i></div>
        <p class="showcase__all"><a class="btn btn--ghost" href="./work/" data-magnetic><span>View all work</span><svg aria-hidden="true"><use href="#arrow" /></svg></a></p>
      </div>`;
}
