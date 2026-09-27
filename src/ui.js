// Small interface pieces shared by the home page (main.js) and the work pages (pages.js).

/** Splits a headline into words that can rise into view one after another. */
export function splitWords(el) {
  let i = 0;
  const frag = document.createDocumentFragment();
  const wrap = (word, tag = 'span') => {
    const w = document.createElement('span');
    w.className = 'w';
    const inner = document.createElement(tag);
    inner.className = 'w__i';
    inner.style.setProperty('--i', i++);
    inner.textContent = word;
    w.appendChild(inner);
    return w;
  };
  el.childNodes.forEach((node) => {
    const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : 'span';
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      frag.append(/^\s+$/.test(part) ? ' ' : wrap(part, tag));
    });
  });
  el.setAttribute('aria-label', el.textContent.trim());
  el.textContent = '';
  el.append(frag);
  el.querySelectorAll('.w').forEach((w) => w.setAttribute('aria-hidden', 'true'));
}

/** Resets every [data-count] figure to zero, ready to count up when seen. */
export function prepareCounters(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    el.dataset.final = el.textContent;
    el.textContent = `${el.dataset.prefix || ''}0${el.dataset.suffix || ''}`;
  });
}

/** Counts up every [data-count] figure inside `container`. */
export function countUp(container, reduced = false) {
  container.querySelectorAll('[data-count]').forEach((el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const dur = reduced ? 1 : 1900;
    const t0 = performance.now() + 250;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const v = target * (1 - Math.pow(1 - t, 4));
      el.textContent = `${el.dataset.prefix || ''}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${el.dataset.suffix || ''}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/** Buttons that lean toward the pointer. */
export function magnetic(el) {
  const inner = el.querySelector('span');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28 - 2}px)`;
    if (inner) inner.style.transform = `translate(${dx * 0.06}px, ${dy * 0.08}px)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = '';
    if (inner) inner.style.transform = '';
  });
}
