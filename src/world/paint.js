// Procedural painterly textures. Everything in the forest is painted here at
// runtime with Canvas 2D — no external art other than the final Krishna scene.

const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export function ramp(stops, t) {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

// Palettes sampled to sit comfortably next to the Krishna artwork.
export const LEAF = ['#0d1a17', '#14281f', '#1f3a22', '#304f24', '#476726', '#618232', '#86a13f', '#b3c25a', '#e2dc8a'].map(hex);
export const LEAF_BACK = ['#0a1413', '#0f1e19', '#16291d', '#213a20', '#344f24', '#4f6d2f', '#7f9a43', '#c9ce70'].map(hex);
export const HAZE = ['#5f7555', '#6d8360', '#7c916b', '#8d9f76', '#a3b184', '#bcc596'].map(hex);
const BARK = ['#1a130d', '#271d14', '#382a1d', '#4b3a28', '#604d36', '#7a6746', '#998660', '#bca97c'].map(hex);
const GRASS = ['#1b2d10', '#284216', '#36581b', '#4a7222', '#62902b', '#86ad37', '#b4cb4f', '#dbe07a'].map(hex);

// ---------------------------------------------------------------- leaves ---

function leafPath(ctx, x, y, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const tx = x + c * len, ty = y + s * len;
  const bx = x - c * len * 0.6, by = y - s * len * 0.6;
  const px = -s * wid * 2, py = c * wid * 2;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(x + px, y + py, tx, ty);
  ctx.quadraticCurveTo(x - px, y - py, bx, by);
}

/**
 * A clump of foliage painted as thousands of individual leaf dabs, lit from
 * the upper right, the same sun that lights Krishna.
 */
export function drawFoliage(ctx, r, cx, cy, R, o = {}) {
  const pal = o.palette || LEAF;
  const leaf = o.leaf ?? Math.max(2.5, R * 0.07);
  const L = o.light || [0.55, -0.83];
  const shade = o.shade ?? 0;
  const alpha = o.alpha ?? 1;
  const orange = o.orange ?? 0.012;
  const blobs = [];
  const nb = o.blobs ?? 4 + ((r() * 5) | 0);
  for (let i = 0; i < nb; i++) {
    const a = r() * TAU, d = R * 0.5 * Math.sqrt(r());
    blobs.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.72, r: R * (0.36 + r() * 0.3) });
  }
  blobs.push({ x: cx, y: cy, r: R * 0.55 });

  const count = Math.floor(((Math.PI * R * R) / (leaf * leaf * 0.9)) * (o.density ?? 1.6));
  const passes = [
    { f: 0.5, bias: -0.42 },
    { f: 0.32, bias: -0.05 },
    { f: 0.2, bias: 0.32, litOnly: true },
  ];
  for (const pass of passes) {
    const n = (count * pass.f) | 0;
    for (let k = 0; k < n; k++) {
      const b = blobs[(r() * blobs.length) | 0];
      const a = r() * TAU;
      const d = Math.sqrt(r());
      const px = b.x + Math.cos(a) * d * b.r;
      const py = b.y + Math.sin(a) * d * b.r * 0.85;
      const nx = Math.cos(a) * d, ny = Math.sin(a) * d;
      const gy = (py - cy) / R;
      let lit = -(nx * L[0] + ny * L[1]) * 0.55 - gy * 0.32 + (r() - 0.5) * 0.5 + pass.bias - shade;
      if (pass.litOnly && lit < 0.12) continue;
      let col = ramp(pal, 0.5 + lit * 0.5);
      if (r() < orange) col = mix(hex('#d97a2e'), hex('#e9b048'), r());
      const size = leaf * (0.55 + r() * 0.75) * (d > 0.85 ? 1.1 : 1);
      const ang = a + (r() - 0.5) * 1.8 + 0.5; // leaves point outward & droop
      ctx.fillStyle = rgba(col, alpha);
      leafPath(ctx, px, py, size, size * 0.3, ang);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------- rim light ---

/**
 * Paints a warm rim along every edge that faces the upper-right sun — the
 * signature of the Krishna artwork's lighting — so procedural foliage, bark
 * and grass read as part of the same illustration.
 */
export function addRimLight(c, o = {}) {
  const w = c.width, h = c.height;
  const d = o.width ?? Math.max(1.5, w / 320);
  const rim = makeCanvas(w, h), g = rim.getContext('2d');
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.drawImage(c, -d, d); // keep only pixels whose upper-right neighbour is empty
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = o.color ?? '#ffe6a6';
  g.fillRect(0, 0, w, h);
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = o.alpha ?? 0.55;
  if (o.soft) ctx.filter = `blur(${o.soft}px)`;
  ctx.drawImage(rim, 0, 0);
  ctx.restore();
  return c;
}

// ---------------------------------------------------------- branch system ---

function growBranches(r, x, y, ang, len, wid, o, s) {
  const segs = [], ends = [];
  const maxDepth = o.depth ?? 3;
  const up = o.upward ?? 1;
  function grow(x, y, ang, len, wid, depth) {
    const n = 10;
    const pts = [[x, y]];
    let a = ang, px = x, py = y;
    for (let i = 1; i <= n; i++) {
      a += (r() - 0.5) * (o.wiggle ?? 0.2) + (-Math.PI / 2 - a) * 0.035 * up;
      px += (Math.cos(a) * len) / n;
      py += (Math.sin(a) * len) / n;
      pts.push([px, py]);
    }
    segs.push({ pts, w0: wid, w1: wid * 0.64, depth });
    if (depth >= maxDepth || wid < 2.2 * s) {
      ends.push([px, py, wid, depth, a]);
      return;
    }
    // occasional side twig halfway along
    if (depth > 0 && r() < 0.5) {
      const m = pts[5];
      ends.push([m[0], m[1], wid * 0.5, depth + 1, a]);
    }
    const kids = depth === 0 ? o.split ?? 3 : 2 + (r() < 0.3 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const spread = (kids === 1 ? 0 : k / (kids - 1) - 0.5) * (depth === 0 ? o.spread ?? 1.5 : 1.05) + (r() - 0.5) * 0.4;
      grow(px, py, a + spread, len * (o.ratio ?? 0.64) * (0.85 + r() * 0.3), wid * 0.62, depth + 1);
    }
  }
  grow(x, y, ang, len, wid, 0);
  return { segs, ends };
}

function segOutline(seg, flare) {
  const { pts, w0, w1 } = seg;
  const n = pts.length - 1;
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    let w = lerp(w0, w1, i / n) / 2;
    if (flare) w *= 1 + flare * Math.pow(1 - i / n, 7);
    left.push([p[0] - ty * w, p[1] + tx * w, -ty, tx, w]);
    right.push([p[0] + ty * w, p[1] - tx * w]);
  }
  return { left, right };
}

function drawBark(ctx, r, segs, s, o = {}) {
  const pal = BARK;
  // silhouette
  ctx.fillStyle = rgba(pal[2]);
  const outlines = segs.map((seg) => segOutline(seg, seg.depth === 0 ? o.flare ?? 1.3 : 0));
  for (const { left, right } of outlines) {
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  // bark strokes that also carry the lighting: lit on the left edge
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineCap = 'round';
  segs.forEach((seg, si) => {
    const { left } = outlines[si];
    const avgW = left.reduce((a, p) => a + p[4], 0) / left.length;
    const count = Math.max(3, Math.min(60, ((avgW * 2) / (2.2 * s)) | 0));
    for (let k = 0; k < count; k++) {
      const off = -1 + (2 * (k + 0.5)) / count + (r() - 0.5) * 0.12;
      const lit = off; // the sun is to the upper right
      const t = 0.38 + lit * 0.32 + (r() - 0.5) * 0.28 + (o.light ?? 0);
      ctx.strokeStyle = rgba(ramp(pal, t), 0.55 + r() * 0.35);
      ctx.lineWidth = Math.max(0.8, ((avgW * 2) / count) * (0.8 + r() * 0.9));
      ctx.beginPath();
      const start = (r() * 3) | 0, end = left.length - ((r() * 3) | 0);
      for (let i = start; i < end; i++) {
        const p = left[i];
        const w = p[4];
        const cx = p[0] - p[2] * w; // centre line (left point minus normal*w)
        const cy = p[1] - p[3] * w;
        const x = cx + p[2] * w * off + (r() - 0.5) * 1.2 * s;
        const y = cy + p[3] * w * off;
        i === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  // moss & lichen on the shaded side, knots
  for (let i = 0; i < 90 * (o.moss ?? 1); i++) {
    const seg = segs[(r() * Math.min(segs.length, 4)) | 0];
    const { left } = outlines[segs.indexOf(seg)];
    const p = left[(r() * left.length) | 0];
    const w = p[4];
    const off = 0.2 + r() * 0.9;
    const x = p[0] - p[2] * w + p[2] * w * off, y = p[1] - p[3] * w + p[3] * w * off;
    ctx.fillStyle = rgba(r() < 0.7 ? hex('#4d6428') : hex('#7e8a4a'), 0.05 + r() * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, (2 + r() * 5) * s, (10 + r() * 30) * s, 0, 0, TAU);
    ctx.fill();
  }
  // ambient occlusion toward the ground + warm rim of sunlight
  const g = ctx.createLinearGradient(0, ctx.canvas.height, 0, ctx.canvas.height * 0.55);
  g.addColorStop(0, 'rgba(10,8,4,0.45)');
  g.addColorStop(1, 'rgba(10,8,4,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  if (o.barkDetail) overlayDetail(ctx, o.barkDetail, o.barkScale ?? 1, o.barkDetailAmt ?? 1);
}

/** Overlays a neutral-grey detail texture onto the bark, keeping its lighting. */
function overlayDetail(ctx, detail, scale, amount) {
  const { width: W, height: H } = ctx.canvas;
  const tmp = makeCanvas(W, H), t = tmp.getContext('2d');
  const pat = t.createPattern(detail, 'repeat');
  pat.setTransform(new DOMMatrix().translate(W * 0.37, H * 0.21).scale(scale));
  t.fillStyle = pat;
  t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(ctx.canvas, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.drawImage(tmp, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Tileable bark grain on neutral grey, for overlay on large trunks: long
 * vertical fibres, ridges and a few knots.
 */
export function paintBarkDetail(seed = 9, w = 256, h = 512) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  const wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy); };
  for (let i = 0; i < 900; i++) {
    const x = r() * w, y = r() * h, len = 20 + r() * 150, wid = 1 + r() * 3.5;
    const v = r() < 0.5 ? 160 + r() * 70 : 40 + r() * 60;
    const ph = r() * 6, amp = 1 + r() * 3;
    ctx.strokeStyle = `rgba(${v | 0},${v | 0},${v | 0},${0.25 + r() * 0.4})`;
    ctx.lineWidth = wid;
    wrap((dx, dy) => {
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const yy = y + (len * k) / 8, xx = x + Math.sin(ph + k * 0.8) * amp;
        k ? ctx.lineTo(xx + dx, yy + dy) : ctx.moveTo(xx + dx, yy + dy);
      }
      ctx.stroke();
    });
  }
  for (let i = 0; i < 8; i++) {
    const x = r() * w, y = r() * h, rx = 4 + r() * 7, ry = rx * (1.6 + r());
    wrap((dx, dy) => {
      ctx.fillStyle = 'rgba(80,80,80,0.28)';
      ctx.beginPath(); ctx.ellipse(x + dx, y + dy, rx * 0.5, ry * 0.5, 0, 0, TAU); ctx.fill();
    });
  }
  return c;
}

/** A complete tree: trunk + branches + a baked canopy. */
export function paintTree(seed, w, h, opts = {}) {
  const o = { depth: 4, ...opts };
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const r = rng(seed);
  const s = w / 512;
  const { segs, ends } = growBranches(
    r,
    w / 2 + (r() - 0.5) * w * 0.04,
    h * 0.998,
    -Math.PI / 2 + (r() - 0.5) * 0.06,
    h * (o.trunkLen ?? 0.4),
    w * (o.trunk ?? 0.11),
    o,
    s,
  );
  // fit the whole structure inside the canvas by scaling about the base
  fitStructure(segs, ends, w, h, w / 2, h * 0.998, o.margin ?? 0.13);

  const pal = o.palette || LEAF;
  const clump = (o.clump ?? 0.12) * w;
  const minD = o.minLeafDepth ?? 1;
  // leaf sites: branch ends plus points along the finer branches
  const sites = ends.filter((e) => e[3] >= minD && r() < 0.8).map((e) => [e[0], e[1], 1]);
  for (const seg of segs) {
    if (seg.depth < Math.max(1, minD) || seg.depth > 2) continue;
    const m = seg.pts[5];
    sites.push([m[0], m[1], 0.85]);
  }
  const bark = makeCanvas(w, h), bctx = bark.getContext('2d');
  drawBark(bctx, r, segs, s, o);
  if (!o.bare) {
    // back of the crown, in shade
    for (const [x, y, k] of sites) {
      drawFoliage(ctx, r, x + (r() - 0.5) * clump * 0.5, y - clump * 0.3, clump * k * (0.85 + r() * 0.5), { palette: pal, shade: 0.42, leaf: clump * 0.085, density: o.density ?? 1.3 });
    }
  }
  ctx.drawImage(bark, 0, 0);
  if (!o.bare) {
    // front of the crown: covers most of the branches, leaves gaps to see through
    for (const [x, y, k] of sites) {
      if (r() < (o.gaps ?? 0.35)) continue;
      drawFoliage(ctx, r, x + (r() - 0.5) * clump * 0.6, y + clump * 0.08, clump * k * (0.6 + r() * 0.45), { palette: pal, leaf: clump * 0.08, density: o.density ?? 1.3 });
    }
    // crown-scale light: sun from the upper right, shadow core lower left
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (const [x, y] of sites) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cw = x1 - x0 + clump * 2, ch = y1 - y0 + clump * 2;
    const ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2;
    ctx.globalCompositeOperation = 'source-atop';
    let g = ctx.createRadialGradient(ccx - cw * 0.28, ccy + ch * 0.32, 0, ccx - cw * 0.28, ccy + ch * 0.32, Math.max(cw, ch) * 0.75);
    g.addColorStop(0, 'rgba(6,14,5,0.42)');
    g.addColorStop(1, 'rgba(6,14,5,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(ccx + cw * 0.3, ccy - ch * 0.4, 0, ccx + cw * 0.3, ccy - ch * 0.4, Math.max(cw, ch) * 0.6);
    g.addColorStop(0, 'rgba(250,236,160,0.16)');
    g.addColorStop(1, 'rgba(250,236,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  return addRimLight(c, { alpha: 0.5, soft: 0.6 });
}

function fitStructure(segs, ends, w, h, bx, by, m) {
  let minX = bx, maxX = bx, minY = by;
  for (const seg of segs) for (const [x, y] of seg.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); }
  const ky = Math.min(1, (by - h * m) / Math.max(1, by - minY));
  const kx = Math.min(1, (w * (0.5 - m)) / Math.max(1, bx - minX, maxX - bx));
  const apply = (p) => { p[0] = bx + (p[0] - bx) * kx; p[1] = by - (by - p[1]) * ky; };
  for (const seg of segs) { seg.pts.forEach(apply); seg.w0 *= Math.min(1, (kx + ky) / 2 + 0.2); seg.w1 *= Math.min(1, (kx + ky) / 2 + 0.2); }
  ends.forEach(apply);
}

/** Foreground branch reaching in from the left edge (flip for the right). */
export function paintBranch(seed, w, h, o = {}) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const r = rng(seed);
  const s = w / 1024;
  const bx = 0, by = h * (o.y ?? 0.42);
  const { segs, ends } = growBranches(r, bx, by, o.angle ?? -0.1, w * 0.4, h * 0.075, { depth: 4, upward: -0.12, split: 3, spread: 1.0, ratio: 0.7, wiggle: 0.16 }, s);
  // fit to the canvas, anchored at the left edge
  let maxX = 0, minY = by, maxY = by;
  for (const seg of segs) for (const [x, y] of seg.pts) { maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const kx = Math.min(1, (w * 0.9) / maxX);
  const ky = Math.min(1, (by - h * 0.12) / Math.max(1, by - minY), (h * 0.7 - by) / Math.max(1, maxY - by));
  const fit = (p) => { p[0] *= kx; p[1] = by + (p[1] - by) * ky; };
  segs.forEach((seg) => seg.pts.forEach(fit));
  ends.forEach(fit);

  const bark = makeCanvas(w, h);
  drawBark(bark.getContext('2d'), r, segs, s, { flare: 0, light: -0.1, moss: 0.3 });
  const pal = LEAF_BACK;
  const R = h * 0.1;
  const sites = ends.map((e) => [e[0], e[1]]);
  for (const seg of segs) if (seg.depth >= 1) for (let i = 3; i < seg.pts.length; i += 5) sites.push(seg.pts[i]);
  for (const [x, y] of sites) drawFoliage(ctx, r, x, y + R * 0.3, R * (0.8 + r() * 0.5), { palette: pal, shade: 0.3, leaf: R * 0.2, density: 1.2 });
  ctx.drawImage(bark, 0, 0);
  for (const [x, y] of sites) {
    if (r() < 0.3) continue;
    drawFoliage(ctx, r, x, y + R * 0.4, R * (0.55 + r() * 0.4), { palette: pal, leaf: R * 0.19, density: 1.1 });
  }
  // hanging strands of leaves
  for (const [x0, y0] of sites) {
    if (r() < 0.75) continue;
    let x = x0, y = y0 + R * 0.6;
    const n = 3 + ((r() * 5) | 0);
    for (let k = 0; k < n && y < h * 0.97; k++) {
      x += Math.sin(k * 0.9 + x0) * R * 0.1;
      y += R * 0.26;
      for (const side of [-1, 0, 1]) {
        const lit = (r() - 0.35) * 0.8;
        ctx.fillStyle = rgba(ramp(pal, 0.4 + lit * 0.5));
        leafPath(ctx, x + side * R * 0.12, y + (r() - 0.5) * R * 0.1, R * 0.22 * (1 - k / (n + 3)), R * 0.075, Math.PI / 2 + side * 0.55 + (r() - 0.5) * 0.5);
        ctx.fill();
      }
    }
  }
  return addRimLight(c, { alpha: 0.42, soft: 0.8 });
}

// ------------------------------------------------------------- clumps ------

export function paintClump(seed, size, o = {}) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const r = rng(seed);
  drawFoliage(ctx, r, size / 2, size / 2, size * 0.36, { leaf: size * 0.02, density: 1.5, ...o });
  return addRimLight(c, { alpha: 0.5, width: 2 });
}

export function blurred(src, px, scale = 0.5) {
  const c = makeCanvas(Math.round(src.width * scale), Math.round(src.height * scale));
  const ctx = c.getContext('2d');
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// -------------------------------------------------------------- grass ------

export function paintGrass(seed, w, h, o = {}) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const r = rng(seed);
  const s = w / 512;
  const n = o.count ?? 520;
  const blades = [];
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const edge = 1 - Math.pow(Math.abs(x / w - 0.5) * 2, 2) * 0.75;
    blades.push({ x, hgt: h * (0.25 + r() * 0.68) * edge, lean: (r() - 0.5) * 0.7 + (o.wind ?? 0.1), wid: (2.4 + r() * 4) * s, z: r() });
  }
  blades.sort((a, b) => a.z - b.z);
  for (const b of blades) {
    const tipX = b.x + b.lean * b.hgt, tipY = h - b.hgt;
    const lit = b.z * 0.6 + (r() - 0.5) * 0.35 + (o.light ?? 0);
    const g = ctx.createLinearGradient(0, h, 0, tipY);
    g.addColorStop(0, rgba(ramp(GRASS, 0.05 + lit * 0.25)));
    g.addColorStop(1, rgba(ramp(GRASS, 0.35 + lit * 0.6)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - b.wid / 2, h);
    ctx.quadraticCurveTo(b.x - b.wid * 0.2 + b.lean * b.hgt * 0.3, h - b.hgt * 0.55, tipX, tipY);
    ctx.quadraticCurveTo(b.x + b.wid * 0.2 + b.lean * b.hgt * 0.3, h - b.hgt * 0.5, b.x + b.wid / 2, h);
    ctx.fill();
  }
  // tiny wildflowers and fallen marigold-coloured leaves
  const flowers = o.flowers ?? 14;
  for (let i = 0; i < flowers; i++) {
    const x = w * (0.1 + r() * 0.8), y = h - h * (0.12 + r() * 0.45);
    const col = r() < 0.75 ? mix(hex('#e07a2f'), hex('#f0a641'), r()) : hex('#f2ead2');
    const rad = (2.2 + r() * 2.5) * s;
    ctx.strokeStyle = rgba(hex('#3d5a1c'), 0.9);
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6 * s, h); ctx.stroke();
    ctx.fillStyle = rgba(col);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad, rad * 0.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = rgba(hex('#f6d36a'));
    ctx.beginPath(); ctx.arc(x, y, rad * 0.6, 0, TAU); ctx.fill();
  }
  addRimLight(c, { alpha: 0.45, width: 1.5, color: '#fff0b8' });
  // feather the roots so tufts sit into the ground instead of on a hard line
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(0, h * 0.8, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.8, w, h * 0.2);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/** Tileable ground seen at a grazing angle. */
export function paintGround(seed, size) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = rgba(hex('#3f5d22'));
  ctx.fillRect(0, 0, size, size);
  const wrap = (fn, x, y, m) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      if (x + dx < -m || x + dx > size + m || y + dy < -m || y + dy > size + m) continue;
      fn(x + dx, y + dy);
    }
  };
  for (let i = 0; i < 70; i++) {
    const x = r() * size, y = r() * size, rad = size * (0.04 + r() * 0.12);
    const light = r() < 0.5;
    wrap((px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, light ? 'rgba(128,160,58,0.35)' : 'rgba(26,42,14,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }, x, y, rad);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 16000; i++) {
    const x = r() * size, y = r() * size;
    const len = 4 + r() * 12, a = -Math.PI / 2 + (r() - 0.5) * 1.3;
    ctx.strokeStyle = rgba(ramp(GRASS, 0.15 + r() * 0.65), 0.55 + r() * 0.4);
    ctx.lineWidth = 1 + r() * 1.6;
    wrap((px, py) => {
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); ctx.stroke();
    }, x, y, 20);
  }
  for (let i = 0; i < 140; i++) {
    const x = r() * size, y = r() * size;
    const col = mix(hex('#cf6a26'), hex('#eaa23f'), r());
    wrap((px, py) => {
      ctx.fillStyle = rgba(col, 0.85);
      leafPath(ctx, px, py, 3 + r() * 4, 1.4 + r(), r() * TAU);
      ctx.fill();
    }, x, y, 10);
  }
  return c;
}

// -------------------------------------------------------------- atmosphere -

/** Sky + atmospheric backdrop mapped to world height (top = y 500, bottom = y -260). */
export function paintSky(w, h, top = 500, bottom = -260) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const v = (y) => (top - y) / (top - bottom);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  [
    [500, '#86b2cb'], [320, '#a9cad8'], [210, '#d3e2dc'], [150, '#efe6c2'], [112, '#f4e2ad'],
    [80, '#dfdca3'], [48, '#bfcd8c'], [15, '#9db26e'], [-40, '#7f9757'], [-260, '#5b7340'],
  ].forEach(([y, col]) => g.addColorStop(clamp01(v(y)), col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sun bloom (upper right, matching Krishna's light)
  const sx = w * 0.7, sy = h * v(150);
  let rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.55);
  rg.addColorStop(0, 'rgba(255,246,214,0.95)');
  rg.addColorStop(0.18, 'rgba(255,236,180,0.55)');
  rg.addColorStop(1, 'rgba(255,236,180,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  // painted cumulus, lit from the upper right. The sky plate stretches this
  // canvas ~9.5× wider than tall in the world, so puffs are drawn narrow.
  const r = rng(11);
  const squash = 1 / 9.5;
  for (let cl = 0; cl < 9; cl++) {
    const cx = r() * w, cy = h * v(175 + r() * 120), size = h * (0.012 + r() * 0.014);
    const puffs = Array.from({ length: 9 + ((r() * 8) | 0) }, () => {
      const a = r() * TAU, d = Math.sqrt(r());
      return [cx + Math.cos(a) * d * size * 3.2 * squash * 1.8, cy + Math.sin(a) * d * size * 0.7, size * (0.55 + r() * 0.6)];
    });
    ctx.filter = 'blur(2px)';
    const draw = (col, ox, oy, k) => {
      ctx.fillStyle = col;
      for (const [x, y, rr] of puffs) { ctx.beginPath(); ctx.ellipse(x + ox * squash, y + oy, rr * k * squash * 1.8, rr * k, 0, 0, TAU); ctx.fill(); }
    };
    draw('rgba(168,186,204,0.32)', -size * 0.25, size * 0.28, 1.0); // cool shaded underside
    draw('rgba(250,246,236,0.5)', 0, 0, 0.92); // body
    draw('rgba(255,236,196,0.55)', size * 0.3, -size * 0.3, 0.62); // sunlit tops
  }
  ctx.filter = 'blur(10px)';
  for (let i = 0; i < 18; i++) {
    const cx = r() * w, cy = h * v(230 + r() * 220);
    ctx.fillStyle = `rgba(255,252,240,${0.12 + r() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * (0.08 + r() * 0.16), h * (0.006 + r() * 0.01), 0, 0, TAU);
    ctx.fill();
  }
  ctx.filter = 'none';
  return c;
}

/** Long band of hazy distant forest. */
export function paintDistant(seed, w, h) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const r = rng(seed);
  // soft, tapered trunks that dissolve into ground mist
  for (let i = 0; i < 110; i++) {
    const x = r() * w, tw = 2 + r() * 7, top = h * (0.34 + r() * 0.16);
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, rgba(HAZE[r() < 0.5 ? 0 : 1], 0.5 + r() * 0.25));
    g.addColorStop(0.7, rgba(HAZE[2], 0.3));
    g.addColorStop(1, rgba(HAZE[3], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - tw * 0.3, top); ctx.lineTo(x + tw * 0.3, top);
    ctx.lineTo(x + tw * 0.7, h); ctx.lineTo(x - tw * 0.7, h);
    ctx.fill();
  }
  // an uneven line of crowns
  for (let i = 0; i < 70; i++) {
    const x = (i / 70) * w + (r() - 0.5) * 40;
    const y = h * (0.2 + r() * 0.26);
    drawFoliage(ctx, r, x, y, h * (0.1 + r() * 0.12), { palette: HAZE, leaf: h * 0.016, density: 1.1, orange: 0 });
  }
  addRimLight(c, { alpha: 0.3, width: 1.5, color: '#f3ecc4' });
  // mist pooling at the bottom
  const mg = ctx.createLinearGradient(0, h * 0.5, 0, h);
  mg.addColorStop(0, rgba(HAZE[4], 0));
  mg.addColorStop(1, rgba(HAZE[4], 0.55));
  ctx.fillStyle = mg;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  return c;
}

export function paintRay(w = 128, h = 512) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const r = rng(3);
  const streak = Array.from({ length: w }, () => 0.75 + r() * 0.25);
  for (let x = 1; x < w; x++) streak[x] = streak[x] * 0.3 + streak[x - 1] * 0.7;
  for (let y = 0; y < h; y++) {
    const fy = y / h;
    const vert = Math.pow(1 - fy, 1.25) * smooth(0, 0.08, fy);
    for (let x = 0; x < w; x++) {
      const fx = (x - w / 2) / (w * 0.24);
      const I = Math.exp(-fx * fx) * vert * streak[x];
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 238; img.data[i + 2] = 196;
      img.data[i + 3] = Math.min(255, I * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function paintLeafAtlas() {
  const c = makeCanvas(256, 64), ctx = c.getContext('2d');
  const cols = ['#d9762c', '#e8a33e', '#a9b845', '#5f8a2f'];
  cols.forEach((col, i) => {
    const x = i * 64 + 32, y = 32;
    ctx.fillStyle = col;
    leafPath(ctx, x, y, 24, 7, -Math.PI / 2 + 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,20,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(-1.27) * 14, y - Math.sin(-1.27) * 14);
    ctx.lineTo(x + Math.cos(-1.27) * 22, y + Math.sin(-1.27) * 22);
    ctx.stroke();
  });
  return c;
}

// wing colourings of butterflies common in Indian forests
export const BUTTERFLIES = {
  tiger: { base: '#b6581f', mid: '#e9923a', edge: '#2a1a10', dots: '#fbf2dc' },
  blue: { base: '#10284f', mid: '#3a86c8', edge: '#0b1424', dots: '#dff0ff' },
  yellow: { base: '#c98f14', mid: '#f4d35a', edge: '#3b2a0e', dots: '#fff6cf' },
  white: { base: '#b9b8a8', mid: '#f3f1e6', edge: '#55564a', dots: '#ffffff' },
};

export function paintButterfly(scheme = BUTTERFLIES.tiger) {
  const c = makeCanvas(128, 96), ctx = c.getContext('2d');
  const wing = (dir) => {
    ctx.save();
    ctx.translate(64, 50);
    ctx.scale(dir, 1);
    const g = ctx.createLinearGradient(0, 0, 60, 0);
    g.addColorStop(0, scheme.base); g.addColorStop(0.7, scheme.mid); g.addColorStop(1, scheme.edge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(2, -2); ctx.bezierCurveTo(20, -46, 62, -44, 58, -16); ctx.bezierCurveTo(52, 0, 22, 2, 2, 2); ctx.fill();
    // hindwing, a shade deeper
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(2, 2); ctx.bezierCurveTo(30, 4, 44, 26, 30, 38); ctx.bezierCurveTo(18, 44, 6, 22, 2, 6); ctx.fill();
    ctx.globalAlpha = 1;
    // veins
    ctx.strokeStyle = scheme.edge;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.8;
    for (const [x, y] of [[50, -34], [56, -22], [40, -38], [34, 30], [26, 36]]) { ctx.beginPath(); ctx.moveTo(3, 0); ctx.quadraticCurveTo(x * 0.5, y * 0.4, x, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = scheme.dots;
    [[46, -26, 2.6], [52, -18, 2.2], [40, -32, 2]].forEach(([x, y, rr]) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); });
    ctx.restore();
  };
  wing(1); wing(-1);
  ctx.fillStyle = '#20150d';
  ctx.beginPath(); ctx.ellipse(64, 52, 2.5, 16, 0, 0, TAU); ctx.fill();
  return c;
}

export function paintBird() {
  const c = makeCanvas(64, 32), ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(40,48,40,0.9)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(4, 12); ctx.quadraticCurveTo(18, 4, 32, 18); ctx.quadraticCurveTo(46, 4, 60, 12);
  ctx.stroke();
  return c;
}

// ------------------------------------------------------------- decals ----

/** The moon: a softly shaded disc with faint maria, inside its own halo. */
export function paintMoon(size = 256) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const r = rng(12);
  const m = size / 2, R = size * 0.16;
  let g = ctx.createRadialGradient(m, m, R * 0.8, m, m, m);
  g.addColorStop(0, 'rgba(210,225,255,0.55)');
  g.addColorStop(0.35, 'rgba(170,195,240,0.16)');
  g.addColorStop(1, 'rgba(150,180,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  g = ctx.createRadialGradient(m - R * 0.3, m - R * 0.3, 0, m, m, R);
  g.addColorStop(0, '#fbfaf2');
  g.addColorStop(0.8, '#e6e9e2');
  g.addColorStop(1, '#c9cfd2');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(m, m, R, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(m, m, R, 0, TAU); ctx.clip();
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, d = r() * R * 0.7, rr = R * (0.12 + r() * 0.22);
    ctx.fillStyle = `rgba(150,160,170,${0.18 + r() * 0.2})`;
    ctx.beginPath(); ctx.ellipse(m + Math.cos(a) * d, m + Math.sin(a) * d, rr, rr * (0.7 + r() * 0.3), r() * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
  return c;
}

/** Soft elliptical contact shadow for decals on the ground. */
export function paintShadow(w = 256, h = 128) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, 'rgba(12,18,6,0.75)');
  g.addColorStop(0.45, 'rgba(12,18,6,0.42)');
  g.addColorStop(1, 'rgba(12,18,6,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, TAU); ctx.fill();
  return c;
}
