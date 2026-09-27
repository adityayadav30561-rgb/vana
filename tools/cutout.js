// Dev tool: cuts the Krishna artwork (tools/krishna-source.webp) out of its
// baked-in checkerboard background and downloads the web-ready cut-out.
// With the dev server running, open the site and run in the console:
//   (await import('/tools/cutout.js')).download();
// Save the result as assets/krishna.webp. If the crop printed to the console
// changes, update CROP in src/world/krishna.js. Not part of the site bundle.

const SRC = '/tools/krishna-source.webp';
const OUT_H = 900;

// Generous outline of the figure: near-white details inside it (pearls,
// tilak, sunlit skin) are kept; outside it they're treated as background.
const OUTLINE = [
  [560, 135], [700, 150], [790, 230], [815, 330], [800, 430], [790, 455], [860, 462], [908, 478], [922, 560], [908, 650],
  [880, 700], [820, 760], [790, 800], [1000, 860], [1150, 950], [1160, 1100], [1080, 1230], [900, 1250], [700, 1240],
  [500, 1245], [300, 1230], [170, 1150], [145, 1000], [190, 880], [330, 830], [310, 790], [270, 760], [260, 650],
  [250, 560], [280, 490], [380, 470], [430, 440], [440, 430], [430, 330], [470, 220], [520, 160],
];
// The peacock feather in his hair.
const CROWN = [[330, 160], [400, 115], [475, 135], [490, 230], [425, 265], [345, 235]];
// Conservative interior: always opaque, whatever its colour.
const SOLID = [
  // face and inner hair (the outer strands are backlit and translucent)
  [[560, 210], [660, 215], [720, 270], [730, 360], [700, 440], [600, 440], [520, 410], [500, 320], [520, 240]],
  // torso and the sunlit shoulder and arm on the right
  [[600, 450], [760, 445], [800, 462], [842, 463], [884, 483], [896, 520], [899, 620], [872, 690], [810, 760], [700, 800], [560, 790], [520, 700], [540, 560]],
  // dhoti, kept inside its uneven hem
  [[220, 920], [420, 850], [700, 850], [980, 900], [1100, 980], [1100, 1080], [1000, 1150], [800, 1150], [700, 1100], [560, 1120], [400, 1170], [250, 1130], [190, 1030]],
];

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function polyMask(W, H, polys, blur) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillStyle = '#fff';
  for (const poly of polys) {
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  return g.getImageData(0, 0, W, H).data;
}

export async function cut() {
  const img = await load(SRC + '?' + Date.now());
  const W = img.width, H = img.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const im = g.getImageData(0, 0, W, H), d = im.data;
  // blurred over one checker period (~10.5px), for the translucent silk
  const bc = document.createElement('canvas');
  bc.width = W; bc.height = H;
  const bgc = bc.getContext('2d', { willReadFrequently: true });
  bgc.filter = 'blur(6px)';
  bgc.drawImage(img, 0, 0);
  const bd = bgc.getImageData(0, 0, W, H).data;

  const outline = polyMask(W, H, [OUTLINE, CROWN], 6);
  const solid = polyMask(W, H, SOLID, 2);

  const A = new Float32Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const sat = Math.max(r, gg, b) - Math.min(r, gg, b), mean = (r + gg + b) / 3;
    const T = Math.min(254, Math.max(204, mean)); // nearest checker grey
    const dev = Math.max(Math.abs(r - T), Math.abs(gg - T), Math.abs(b - T));
    const inside = outline[i + 3] / 255, core = solid[i + 3] / 255;
    let a = sm(7, 34, dev);
    if (sat < 16 && mean > 165) a *= inside; // stray wisps and checker blends
    // translucent silk over the checker: work from the blurred copy, so the
    // pattern averages out, and un-mix against the checker's mean grey
    const br = bd[i], bgg = bd[i + 1], bb = bd[i + 2], bmean = (br + bgg + bb) / 3;
    const silk = core < 0.5 && inside < 0.6 && sat >= 18 && br > bb + 18 && bmean > 150;
    if (silk) {
      const devb = Math.max(Math.abs(br - 230), Math.abs(bgg - 230), Math.abs(bb - 230));
      a = Math.max(0.26, Math.min(1, devb / 95));
      for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (bd[i + ch] - (1 - a) * 230) / a));
    } else {
      a = Math.max(a, core);
      if (a > 0.001 && a < 1) for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (d[i + ch] - (1 - a) * T) / a));
    }
    A[p] = a;
  }
  // drop isolated specks
  const out = new Float32Array(A);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const p = y * W + x;
    if (A[p] < 0.02) continue;
    let s = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += A[p + dy * W + dx] > 0.2 ? 1 : 0;
    if (s < 6) out[p] = 0;
  }
  for (let p = 0; p < out.length; p++) d[p * 4 + 3] = Math.round(out[p] * 255);
  g.putImageData(im, 0, 0);
  return c;
}

/** Trims empty margins, scales to OUT_H tall and returns the canvas + crop. */
export function finish(c) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const { width: W, height: H } = c;
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] < 8) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(W - 1, x1 + 4); y1 = Math.min(H - 1, y1 + 4);
  const k = OUT_H / (y1 - y0 + 1);
  const o = document.createElement('canvas');
  o.width = Math.round((x1 - x0 + 1) * k); o.height = OUT_H;
  const og = o.getContext('2d');
  og.imageSmoothingQuality = 'high';
  og.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, o.width, o.height);
  return { canvas: o, crop: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
}

/** Cuts, trims and downloads the cut-out as a WebP; logs the crop. */
export async function download(quality = 0.8) {
  const { canvas, crop } = finish(await cut());
  console.log('CROP', crop);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'krishna.webp';
    a.click();
  }, 'image/webp', quality);
}
