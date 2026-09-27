// Krishna: the cut-out artwork (assets/krishna.webp, made with
// tools/cutout.js) and the 2D rig that lets him play the flute.
//
// Rig coordinates are pixels in the original 1200×1310 artwork; CROP says
// which part of it the exported texture covers.

export const CROP = { x: 31, y: 120, w: 1144, h: 1133 };
// where he sits: the lowest fold of the dhoti, in source pixels
export const SEAT_Y = 1238;
export const SEAT_X = 650;

const FLUTE = { a: [145, 610], b: [715, 365] };
const len = Math.hypot(FLUTE.b[0] - FLUTE.a[0], FLUTE.b[1] - FLUTE.a[1]);
const DIR = [(FLUTE.b[0] - FLUTE.a[0]) / len, (FLUTE.b[1] - FLUTE.a[1]) / len];
const UP = [DIR[1], -DIR[0]]; // perpendicular to the flute, away from it

// finger pads resting over the holes: three on each hand
const FINGERS = [
  [321, 534], [338, 527], [357, 517], // far hand
  [430, 473], [446, 467], [461, 460], // near hand
];

const RIG = {
  hands: [[322, 540, 48, 56], [488, 482, 70, 46]],
  head: { pivot: [650, 455], c: [610, 300], r: [165, 175] },
  chest: { c: [670, 650], r: [115, 100] },
  shoulders: [[545, 610, 52], [850, 520, 56]],
  hair: [[468, 420, 48], [792, 400, 50]],
  // the two free ends of the silk dupatta, and where each is held
  silk: [
    { c: [190, 880], r: [175, 190], anchor: [330, 720], amp: 4.5, ph: 0 },
    { c: [1010, 720], r: [175, 235], anchor: [860, 560], amp: 5, ph: 1.7 },
  ],
  tassel: { pivot: [190, 615], c: [192, 672], r: [20, 58] },
};

/** GLSL for the inverse warp. `p` is in source pixels; returns displaced pixels. */
export function rigGLSL() {
  const v2 = (a) => `vec2(${a[0].toFixed(1)}, ${a[1].toFixed(1)})`;
  const fingers = FINGERS.map((f, i) => {
    const ph = (i * 2.399).toFixed(3), sp = (0.55 + ((i * 37) % 7) * 0.09).toFixed(3);
    return `  { float s = smoothstep(0.42, 0.78, 0.5 + 0.5 * sin(t * ${sp} + ${ph}) * sin(t * ${(Number(sp) * 0.61).toFixed(3)} + ${ph} * 1.7));
    p -= ${v2(UP)} * (3.4 * s * uRigAmt) * blob(p, ${v2(f)}, vec2(7.5, 8.5)); }`;
  }).join('\n');
  const silk = RIG.silk.map((s) => `  { float w = blob(p, ${v2(s.c)}, ${v2(s.r)});
    float reach = clamp(distance(p, ${v2(s.anchor)}) / 260.0, 0.0, 1.0);
    p -= vec2(sin(t * 0.9 + p.y * 0.012 + ${s.ph.toFixed(2)}), cos(t * 0.7 + p.x * 0.01 + ${s.ph.toFixed(2)})) * ${s.amp.toFixed(1)} * reach * w * uRigAmt; }`).join('\n');
  return /* glsl */ `
  float blob(vec2 p, vec2 c, vec2 r) { vec2 d = (p - c) / r; return exp(-dot(d, d) * 1.6); }
  float segBlob(vec2 p, vec2 a, vec2 b, float r) {
    vec2 ab = b - a; float h = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    float d = length(p - a - ab * h) / r; return exp(-d * d * 1.6);
  }
  vec2 rotAbout(vec2 p, vec2 c, float a) { float s = sin(a), co = cos(a); vec2 d = p - c; return c + vec2(co * d.x - s * d.y, s * d.x + co * d.y); }
  vec2 rig(vec2 p, float t) {
    // fingers lifting from the holes, each on its own slow phrase
${fingers}
    // hands and flute: tiny shared adjustments as the phrase changes
    float phrase = sin(t * 0.47) * 0.6 + sin(t * 0.21 + 1.3) * 0.4;
    float fl = segBlob(p, ${v2(FLUTE.a)}, ${v2(FLUTE.b)}, 16.0);
    float hands = max(blob(p, ${v2(RIG.hands[0])}, vec2(${RIG.hands[0][2]}.0, ${RIG.hands[0][3]}.0)), blob(p, ${v2(RIG.hands[1])}, vec2(${RIG.hands[1][2]}.0, ${RIG.hands[1][3]}.0)));
    p -= vec2(0.7, -0.9) * phrase * uRigAmt * max(fl * 0.9, hands);
    // the tassel hanging from the flute swings a little
    float ts = blob(p, ${v2(RIG.tassel.c)}, ${v2(RIG.tassel.r)});
    p = rotAbout(p, ${v2(RIG.tassel.pivot)}, -sin(t * 1.1) * 0.05 * ts * uRigAmt);
    // breathing: chest and shoulders rise a fraction
    float br = sin(t * 1.05) * 0.5 + 0.5;
    br = br * br * (3.0 - 2.0 * br) * uRigAmt;
    float ch = blob(p, ${v2(RIG.chest.c)}, ${v2(RIG.chest.r)});
    p.y += (p.y - ${RIG.chest.c[1]}.0) * 0.011 * br * ch;
    p.x += (p.x - ${RIG.chest.c[0]}.0) * 0.005 * br * ch;
    float sh = max(blob(p, ${v2(RIG.shoulders[0])}, vec2(${RIG.shoulders[0][2]}.0)), blob(p, ${v2(RIG.shoulders[1])}, vec2(${RIG.shoulders[1][2]}.0)));
    p.y += 1.7 * br * sh;
    // head: a degree or two, slow; the flute at his lips moves with it
    float hw = blob(p, ${v2(RIG.head.c)}, ${v2(RIG.head.r)});
    float ang = (sin(t * 0.31) * 0.014 + sin(t * 0.73 + 0.9) * 0.006) * uRigAmt;
    p = rotAbout(p, ${v2(RIG.head.pivot)}, -ang * hw);
    p.y -= (sin(t * 0.27 + 2.0) * 1.0 + br * 0.8) * hw * uRigAmt;
    // loose curls and the silk catching the breeze
    float hr = max(blob(p, ${v2(RIG.hair[0])}, vec2(${RIG.hair[0][2]}.0)), blob(p, ${v2(RIG.hair[1])}, vec2(${RIG.hair[1][2]}.0)));
    p.x -= sin(t * 1.3 + p.y * 0.1) * 1.1 * hr * uRigAmt;
${silk}
    return p;
  }
  `;
}
