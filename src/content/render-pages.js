// Renders the /work index and one page per project from projects.js.
// Runs in Node (vite.config.js writes the results to work/), never in the browser.

import { esc, pad, host, emph, ICONS, parseFigure, countingFigure, growthLine, print, prints } from './render-work.js';

const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 31C15 20 13 10 16 2c3 8 1 18 0 29z' fill='%236f9a3a'/%3E%3Cellipse cx='16' cy='9' rx='5' ry='6.5' fill='%232aa38a'/%3E%3Cellipse cx='16' cy='9.4' rx='2.6' ry='3.6' fill='%23143f93'/%3E%3C/svg%3E`;
const FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..600,0..100,0..1;1,9..144,300..600,0..100,0..1&family=Manrope:wght@400;500;600;700&display=swap';
const LIGHTS = ['morning', 'noon', 'golden'];

const abs = (site, path) => (site.url ? new URL(path, site.url.replace(/\/?$/, '/')).href : '');
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// ------------------------------------------------------------ figures ---

const UNIT = { K: 1e3, M: 1e6 };
function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}
/**
 * The figure for the previous period, worked out from the reported change:
 * previous = current ÷ (1 + change). Returns its text and its share of now.
 */
function previous(value, change) {
  const v = parseFigure(value), c = parseFigure(change);
  if (!v || !c) return null;
  const ratio = 1 + ((c.prefix === '-' || c.prefix === '−') ? -c.value : c.value) / 100;
  if (ratio <= 0) return null;
  if (v.suffix.trim() === '%') {
    const b = v.value / ratio;
    return { text: `${b.toFixed(1)}%`, share: b / v.value };
  }
  const cur = v.value * (UNIT[v.suffix.trim().toUpperCase()] || 1);
  return { text: compact(cur / ratio), share: 1 / ratio };
}

// -------------------------------------------------------------- frame ---

/** The living forest behind every work page: a still, light rays, motes and near branches. */
function forest(root, light) {
  const rays = [[14, 0, 8], [31, 2.6, 5], [52, 1.2, 10], [68, 4, 6], [84, 2, 7]]
    .map(([x, d, w]) => `<i style="--x: ${x}%; --d: -${d}s; --w: ${w}vw"></i>`).join('');
  return `<div class="forest-bg" aria-hidden="true">
      <div class="forest-bg__far"><img src="${root}assets/backdrop-${light}.webp" alt="" width="1600" height="900" fetchpriority="high" /></div>
      <div class="forest-bg__rays">${rays}</div>
      <div class="forest-bg__motes"></div>
      <div class="forest-bg__near forest-bg__near--l"><img src="${root}assets/layers/branch-a.webp" alt="" width="1100" height="550" /></div>
      <div class="forest-bg__near forest-bg__near--r"><img src="${root}assets/layers/branch-b.webp" alt="" width="1100" height="550" /></div>
      <div class="forest-bg__shade"></div>
    </div>
    <div class="atmos" aria-hidden="true"></div>
    <img class="page-feather" src="${root}assets/feather.webp" alt="" width="512" height="768" aria-hidden="true" />`;
}

/** Grass at the foot of the page, where the feather comes to rest. */
const landing = (root) => `
      <div class="landing" aria-hidden="true">
        <img class="landing__grass" src="${root}assets/layers/grass.webp" alt="" width="1200" height="240" loading="lazy" />
        <span class="feather-anchor landing__spot" data-feather data-feather-land></span>
      </div>`;

const anchor = (fx, fy) => `<span class="feather-anchor" data-feather data-fx="${fx}" data-fy="${fy}"></span>`;

/** The page frame shared by /work and every project page. `root` climbs back to the site root. */
function shell({ site, root, path, title, description, light, current, image, ld, body, bodyClass, lightbox = false }) {
  const canonical = abs(site, path);
  const ogImage = image ? abs(site, image) : '';
  const home = root;
  const mail = `mailto:${site.email}?subject=A%20new%20project`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#12281c" />
    ${canonical ? `<link rel="canonical" href="${esc(canonical)}" />\n    ` : ''}<meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(site.name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    ${canonical ? `<meta property="og:url" content="${esc(canonical)}" />\n    ` : ''}${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />\n    <meta name="twitter:card" content="summary_large_image" />\n    ` : ''}<link rel="icon" href="${FAVICON}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${FONTS}" rel="stylesheet" />
    <link rel="stylesheet" href="${root}src/style.css" />
    ${ld ? jsonLd(ld) : ''}
  </head>
  <body class="page ${bodyClass}" data-light="${light}">
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <symbol id="feather-mark" viewBox="0 0 32 32">
        <ellipse cx="16" cy="9.6" rx="4.4" ry="5.6" fill="none" stroke="currentColor" stroke-width="1" />
        <ellipse cx="16" cy="10" rx="2" ry="2.8" fill="currentColor" />
      </symbol>
      <symbol id="arrow-out" viewBox="0 0 24 24"><path d="M8 16 16 8M9.5 8H16v6.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
      <symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></symbol>
      <symbol id="rise" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></symbol>
    </svg>

    ${forest(root, light)}

    <a class="skip" href="#main">Skip to content</a>

    <header class="nav nav--page" id="nav">
      <div class="nav__inner">
        <a class="brand" href="${home}" aria-label="${esc(site.name)} — home">
          <svg class="brand__mark" aria-hidden="true"><use href="#feather-mark" /></svg>
          <span class="brand__word">${esc(site.name)}</span>
        </a>
        <nav class="nav__links" aria-label="Primary">
          <a href="${home}">Home</a>
          <a href="${home}#services">Services</a>
          <a href="${root}work/" class="is-active"${current === 'work' ? ' aria-current="page"' : ''}>Work</a>
          <a href="${home}#contact">Contact</a>
        </nav>
        <button class="sound" id="soundToggle" type="button" aria-pressed="false" aria-label="Play music" hidden>
          <span class="sound__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="sound__label">Sound off</span>
        </button>
        <a class="nav__cta" href="${mail}" data-magnetic><span>Start a project</span></a>
      </div>
    </header>

    <main id="main">
${body}
      <section class="page-cta container">
        ${anchor(0.88, 0.4)}
        <div class="page-cta__inner glass reveal">
          <h2 class="display h2">Let’s grow something <em>together</em>.</h2>
          <p class="lead">SEO, websites, Android &amp; iOS apps and custom software. Tell us where you are, and we’ll help you find the first step.</p>
          <div class="page-cta__actions">
            <a class="btn btn--solid" href="${mail}" data-magnetic><span>Start a project</span></a>
            <a class="btn btn--ghost" href="${home}#services" data-magnetic><span>Our services</span><svg aria-hidden="true"><use href="#arrow" /></svg></a>
          </div>
        </div>
      </section>
${current === 'project' ? '%%NEXT%%' : ''}${landing(root)}
    </main>

    <footer class="footer container">
      <span>© 2026 ${esc(site.name)} Studio</span>
      <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
      <span class="footer__place">Bengaluru · Working worldwide</span>
      <nav class="footer__social" aria-label="Social"><a href="#" rel="noopener">Instagram</a><a href="#" rel="noopener">LinkedIn</a><a href="#" rel="noopener">Behance</a></nav>
    </footer>
${lightbox ? LIGHTBOX : ''}
    <script type="module" src="${root}src/pages.js"></script>
  </body>
</html>
`;
}

const LIGHTBOX = `
    <dialog class="lightbox" id="lightbox" aria-labelledby="lbTitle">
      <div class="lightbox__panel">
        <header class="lightbox__head">
          <div class="lightbox__heading">
            <p class="project__meta" id="lbMeta"></p>
            <h3 class="lightbox__title" id="lbTitle"></h3>
          </div>
          <a class="case__site" id="lbSite" href="#" target="_blank" rel="noopener"><span></span><svg aria-hidden="true"><use href="#arrow-out" /></svg></a>
          <button class="lightbox__close" id="lbClose" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </header>
        <div class="lightbox__stage">
          <button class="lightbox__nav lightbox__nav--prev" id="lbPrev" type="button" aria-label="Previous screenshot"><svg aria-hidden="true"><use href="#arrow" /></svg></button>
          <figure class="lightbox__figure">
            <img id="lbImg" alt="" />
            <figcaption id="lbCap"></figcaption>
          </figure>
          <button class="lightbox__nav lightbox__nav--next" id="lbNext" type="button" aria-label="Next screenshot"><svg aria-hidden="true"><use href="#arrow" /></svg></button>
        </div>
        <div class="lightbox__foot"><p class="lightbox__count" id="lbCount" aria-live="polite"></p><div class="lightbox__thumbs" id="lbThumbs"></div></div>
      </div>
    </dialog>
`;

const crumbs = (items) => `<nav class="crumbs reveal" aria-label="Breadcrumb"><ol>${items.map(([label, href], i) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}${i < items.length - 1 ? '<span class="crumbs__sep" aria-hidden="true">/</span>' : ''}</li>`).join('')}</ol></nav>`;

/** A chapter heading. */
const chapterHead = (title, aside = '') => `
          <header class="chapter__head">
            <h2 class="display h2" data-split>${emph(title)}</h2>
            ${aside ? `<p class="chapter__aside reveal">${esc(aside)}</p>` : ''}
          </header>`;

// ---------------------------------------------------------------- /work ---

export function renderWorkPage({ SITE, CATEGORIES, PROJECTS }) {
  const root = '../';
  const groups = CATEGORIES.map((c) => ({ ...c, items: PROJECTS.filter((p) => p.category === c.id) }))
    .filter((g) => g.items.length || g.empty);

  const filters = [`<button class="filter" type="button" data-filter="all" aria-pressed="true">All<span class="filter__count">${pad(PROJECTS.length)}</span></button>`]
    .concat(groups.map((g) => `<button class="filter" type="button" data-filter="${g.id}" aria-pressed="false">${esc(g.label)}${g.items.length ? `<span class="filter__count">${pad(g.items.length)}</span>` : ''}</button>`))
    .join('\n            ');

  const rows = PROJECTS.map((p) => `
          <li class="index__row reveal" data-category="${esc(p.category)}" data-id="${esc(p.id)}" style="--accent: ${esc(p.accent || '#e2b35f')}; view-transition-name: row-${esc(p.id)}">
            <a class="index__link" href="./${esc(p.id)}/">
              <span class="index__name" style="view-transition-name: vt-name-${esc(p.id)}">${esc(p.name)}</span>
              <span class="index__meta">${esc(p.meta)}</span>
              ${p.badge ? `<span class="index__figure"><b>${esc(p.badge.value)}</b><small>${esc(p.badge.label)}</small></span>` : ''}
              <span class="index__arrow" aria-hidden="true"><svg><use href="#arrow" /></svg></span>
              <span class="index__thumb">${prints(p, root, { interactive: false, shot: false, name: false, cls: 'prints--thumb' })}</span>
            </a>
          </li>`).join('');

  const empties = groups.filter((g) => !g.items.length).map((g) => `
        <div class="index__empty" data-empty="${g.id}" hidden>
          <svg class="index__empty-icon" viewBox="0 0 48 48" aria-hidden="true">${ICONS[g.id] || ICONS.custom}</svg>
          <div class="scrim">
            <p class="project__meta">${esc(g.label)} · Coming soon</p>
            <h2 class="index__empty-title">${esc(g.empty.title)}</h2>
            <p>${esc(g.empty.text)}</p>
            <a class="link-arrow" href="${root}#contact">Ask for a walkthrough <svg aria-hidden="true"><use href="#arrow" /></svg></a>
          </div>
        </div>`).join('');

  const previews = PROJECTS.map((p) => `<span class="index-preview__item" data-for="${esc(p.id)}">${prints(p, root, { interactive: false, shot: false, name: true, cls: 'prints--preview' })}</span>`).join('');

  const body = `
      <header class="page-hero container">
        ${anchor(0.74, 0.3)}
        <div class="scrim page-hero__text">
          ${crumbs([['Home', root], ['Work']])}
          <h1 class="display page-title" data-split>Work that takes <em>root</em>.</h1>
          <p class="lead page-hero__lead reveal">Real results for real brands. Every SEO figure here comes straight from our clients’ own Google Analytics and Search Console, and each project has the screenshots to prove it.</p>
        </div>
        <div class="filters reveal" role="group" aria-label="Filter by discipline">
            ${filters}
        </div>
      </header>

      <section class="container work-index" aria-label="Projects">
        ${anchor(0.93, 0.5)}
        <ol class="index">${rows}
        </ol>${empties}
        ${anchor(0.08, 0.55)}
      </section>
      <div class="index-preview" aria-hidden="true">${previews}</div>
`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Work — ${SITE.name}`,
    description: 'SEO, website, app and custom software case studies.',
    ...(SITE.url ? { url: abs(SITE, 'work/') } : {}),
    hasPart: PROJECTS.map((p) => ({ '@type': 'CreativeWork', name: p.name, ...(SITE.url ? { url: abs(SITE, `work/${p.id}/`) } : {}) })),
  };

  return shell({
    site: SITE, root, path: 'work/', current: 'work', light: 'morning', bodyClass: 'page--work',
    title: `Work — SEO, websites & apps | ${SITE.name}`,
    description: `Case studies from ${SITE.name}: SEO growth backed by real Google Analytics and Search Console data, plus websites, Android & iOS apps and custom software.`,
    image: PROJECTS[0] ? `assets/work/${PROJECTS[0].shots[0].file}.webp` : '',
    ld, body,
  });
}

// ------------------------------------------------------ /work/<project>/ ---

export function renderProjectPage({ SITE, CATEGORIES, PROJECTS }, p) {
  const root = '../../';
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const caseLabel = cat?.caseLabel || 'Case study';
  const i = PROJECTS.indexOf(p);
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  const light = LIGHTS.includes(p.light) ? p.light : LIGHTS[i % LIGHTS.length];

  // chapters appear only when there's something to say; the feather crosses from side to side between them
  const chapters = [];

  if (p.challenge) {
    chapters.push(`
        <section class="container chapter" aria-label="The challenge">
          ${anchor(chapters.length % 2 ? 0.08 : 0.92, 0.42)}${chapterHead('Where they *were*.')}
          <div class="chapter__body scrim reveal"><p class="lead">${esc(p.challenge)}</p></div>
        </section>`);
  }
  if (p.approach) {
    const body = Array.isArray(p.approach)
      ? `<ol class="steps">${p.approach.map((s, k) => `<li class="reveal"><span class="steps__n">${pad(k + 1)}</span><p>${esc(s)}</p></li>`).join('')}</ol>`
      : `<p class="lead">${esc(p.approach)}</p>`;
    chapters.push(`
        <section class="container chapter" aria-label="What we did">
          ${anchor(chapters.length % 2 ? 0.08 : 0.92, 0.42)}${chapterHead('How we got *there*.')}
          <div class="chapter__body scrim reveal">${body}</div>
        </section>`);
  }

  const groups = p.highlights || [];
  const growing = groups.filter((g) => g.items.some((it) => it.change));
  const steady = groups.filter((g) => !g.items.some((it) => it.change));
  if (groups.length) {
    const bars = growing.map((g) => `
          <div class="growthbars reveal">
            <p class="growthbars__head"><b>${esc(g.source)}</b><span>${esc(g.period)}</span></p>
            <ul class="growthbars__list">
${g.items.map((it) => {
    const b = it.change ? previous(it.value, it.change) : null;
    if (!b) return '';
    return `              <li class="growthbar" style="--before: ${Math.max(0.008, b.share).toFixed(4)}">
                <p class="growthbar__label">${esc(it.label)}<span class="growthbar__change"><svg aria-hidden="true"><use href="#rise" /></svg>${esc(it.change.replace(/^\+/, ''))}</span></p>
                <div class="growthbar__row growthbar__row--before"><span class="growthbar__tag">Before</span><span class="growthbar__bar"><i></i></span><span class="growthbar__value">${esc(b.text)}</span></div>
                <div class="growthbar__row"><span class="growthbar__tag">After</span><span class="growthbar__bar"><i></i></span><span class="growthbar__value">${esc(it.value)}</span></div>
              </li>`;
  }).join('\n')}
            </ul>
            <p class="growthbars__note">“Before” is calculated from the change Google Analytics reports against the previous period of the same length.</p>
          </div>`).join('');

    const ledgers = steady.map((g) => `
          <div class="ledger-group reveal">
            <p class="ledger-group__head"><b>${esc(g.source)}</b><span>${esc(g.period)}</span></p>
            <dl class="ledger">
${g.items.map((it) => `              <div><dt>${esc(it.label)}</dt><dd>${esc(it.value)}</dd></div>`).join('\n')}
            </dl>
          </div>`).join('');

    chapters.push(`
        <section class="container chapter" aria-label="The result">
          ${anchor(chapters.length % 2 ? 0.08 : 0.92, 0.42)}${chapterHead('What *changed*.')}
          <div class="chapter__body">${bars}${ledgers}
          </div>
        </section>`);
  }

  const sheet = p.shots.map((s, k) => `
            <li class="sheet__item reveal" style="--r: ${[-2.2, 1.6, -0.8, 2.4][k % 4]}deg">
              <button class="sheet__btn" type="button" data-open="${k}" aria-label="Enlarge: ${esc(s.label)}">
              ${print(s, k, root, { shot: true })}
              </button>
            </li>`).join('');
  chapters.push(`
        <section class="container chapter" aria-label="The evidence">
          ${anchor(chapters.length % 2 ? 0.08 : 0.92, 0.42)}${chapterHead('Straight from the *dashboards*.', `Unedited screenshots from ${p.name}’s own accounts. Select any of them to see it full size.`)}
          <ul class="sheet">${sheet}
          </ul>
        </section>`);

  const stats = (p.stats || []).map((s) => {
    const dec = s.decimals || 0, suf = s.suffix || '';
    return `<div><dt>${esc(s.label)}</dt><dd><span data-count="${s.value}" data-decimals="${dec}" data-suffix="${esc(suf)}">${s.value.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${esc(suf)}</span></dd></div>`;
  }).join('\n              ');

  const body = `
      <article class="case case-page" data-case="${esc(p.id)}" data-name="${esc(p.name)}"${p.site ? ` data-site="${esc(p.site)}"` : ''} style="--accent: ${esc(p.accent || '#e2b35f')}">
        <header class="page-hero project-hero container">
          ${anchor(0.62, 0.26)}
          <div class="project-hero__text scrim">
            ${crumbs([['Home', root], ['Work', '../'], [cat?.label || 'Work', `../?c=${esc(p.category)}`], [p.name]])}
            <p class="project-hero__client reveal"><span class="project-hero__name" style="view-transition-name: vt-name-${esc(p.id)}">${esc(p.name)}</span><span class="project__meta">${esc(p.meta)}</span></p>
            <h1 class="display page-title project-hero__title" data-split>${emph(p.headline || p.name)}</h1>
            <p class="lead reveal">${esc(p.summary)}</p>
            <div class="project-hero__actions reveal">
              ${p.site ? `<a class="btn btn--solid" href="${esc(p.site)}" target="_blank" rel="noopener" data-magnetic><span>Visit ${esc(host(p.site))}</span><svg aria-hidden="true"><use href="#arrow-out" /></svg></a>` : ''}
              <button class="btn btn--ghost" type="button" data-open="0" data-magnetic><span>View the screenshots</span></button>
            </div>
          </div>
          <div class="project-hero__prints reveal">
            ${prints(p, root, { shot: false, eager: true })}
          </div>
        </header>

        <section class="container project-figure" aria-label="Headline result">
          ${growthLine(p.id, 'growth--wide')}
          ${anchor(0.1, 0.5)}
          ${p.badge ? `<div class="project-figure__main scrim reveal">
            <p class="figure figure--xl">${countingFigure(p.badge.value)}</p>
            <p class="figure__label">${esc(p.badge.label)}</p>
          </div>` : ''}
          ${stats ? `<dl class="ledger ledger--stats reveal">
              ${stats}
          </dl>` : ''}
        </section>
${chapters.join('')}
      </article>
`;

  const nextBlock = `
      <nav class="container project-next" aria-label="More work">
        <a class="project-next__link reveal" href="../${esc(next.id)}/" style="--accent: ${esc(next.accent || '#e2b35f')}">
          <span class="eyebrow">Next project</span>
          <span class="project-next__name">${esc(next.name)}</span>
          <span class="project-next__line"><span class="project__meta">${esc(next.meta)}</span>${next.badge ? `<span class="project-next__figure">${esc(next.badge.value)} <em>${esc(next.badge.label)}</em></span>` : ''}</span>
          <svg class="project-next__arrow" aria-hidden="true"><use href="#arrow" /></svg>
        </a>
        <a class="link-arrow project-next__all reveal" href="../">All work <svg aria-hidden="true"><use href="#arrow" /></svg></a>
      </nav>`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        name: `${p.name} — ${caseLabel}`,
        headline: (p.headline || p.name).replace(/\*/g, ''),
        description: p.summary,
        creator: { '@type': 'Organization', name: SITE.name, ...(SITE.url ? { url: SITE.url } : {}) },
        about: { '@type': 'Organization', name: p.name, ...(p.site ? { url: p.site } : {}) },
        ...(SITE.url ? { url: abs(SITE, `work/${p.id}/`), image: p.shots.map((s) => abs(SITE, `assets/work/${s.file}.webp`)) } : {}),
      },
      ...(SITE.url ? [{
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: abs(SITE, '') },
          { '@type': 'ListItem', position: 2, name: 'Work', item: abs(SITE, 'work/') },
          { '@type': 'ListItem', position: 3, name: p.name, item: abs(SITE, `work/${p.id}/`) },
        ],
      }] : []),
    ],
  };

  return shell({
    site: SITE, root, path: `work/${p.id}/`, current: 'project', light, bodyClass: 'page--project',
    title: `${p.name} — ${caseLabel} | ${SITE.name}`,
    description: p.summary,
    image: `assets/work/${p.shots[0].file}.webp`,
    ld, body, lightbox: true,
  }).replace('%%NEXT%%', nextBlock);
}
