import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, lerp3, ramp } from './motion.js';

export const FPS = 30, TOTAL = 2302, DECK = 8;

export const SHOTS = [
  { id: 'hook',     a: 0,    b: 165,  light: 'day' },
  { id: 'promise',  a: 166,  b: 440,  light: 'day' },
  { id: 'problem',  a: 441,  b: 582,  light: 'day' },
  { id: 'boats',    a: 583,  b: 658,  light: 'golden' },
  { id: 'cannon',   a: 659,  b: 768,  light: 'golden' },
  { id: 'rivals',   a: 769,  b: 959,  light: 'golden' },
  { id: 'prize',    a: 960,  b: 1130, light: 'day' },
  { id: 'hike',     a: 1131, b: 1302, light: 'golden' },
  { id: 'snap_ice', a: 1303, b: 1558, light: 'night' },
  { id: 'explain',  a: 1559, b: 1795, light: 'night' },
  { id: 'haul',     a: 1796, b: 2125, light: 'day' },
  { id: 'payoff',   a: 2126, b: 2301, light: 'day' },
];

export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

// ---------- lights ----------
export const LIGHTS = {
  day: {
    az: 135, el: 44, sky: '#cde0f7', ground: '#8c99a6', hemi: 1.22,
    sun: '#fff4e0', sunI: 2.45, fog: '#d4e4f5', fogNear: 75, fogFar: 900,
    skyTop: '#3e82d4', skyHor: '#cce0f5', sat: 1.08,
    waterDeep: '#245875', waterShal: '#4fa2bd', glint: '#f2fbff', vig: 0.18, shadowExt: 22,
  },
  golden: {
    az: 14, el: 12, sky: '#b5a8d4', ground: '#6d584d', hemi: 1.05,
    sun: '#ffb974', sunI: 2.8, fog: '#f0be92', fogNear: 65, fogFar: 780,
    skyTop: '#686ba8', skyHor: '#ffc484', sunDisc: '#fff2cc', sunSize: 0.0035, sat: 1.12,
    gain: '#fff2e4', waterDeep: '#335378', waterShal: '#c98e6b', glint: '#ffe3ad', vig: 0.24, shadowExt: 22,
  },
  night: {
    az: 215, el: 28, sky: '#49689c', ground: '#1f2c42', hemi: 0.95,
    sun: '#a8c8ff', sunI: 1.55, fog: '#1b2b47', fogNear: 45, fogFar: 620,
    skyTop: '#0d182e', skyHor: '#263e6b', sat: 0.95, gain: '#b8d0f5', lift: '#081020',
    waterDeep: '#10243d', waterShal: '#28527a', glint: '#cce4ff', vig: 0.30, shadowExt: 24,
  },
};

export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'hook') L.shadowExt = lerp(10, 48, M.smooth(ramp(f, 18, 125)));
  if (S.id === 'snap_ice' || S.id === 'payoff') L.shadowExt = 34;
  return L;
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0,   pos: [-20.8, DECK + 1.65, 5.4],  look: [-20.5, DECK + 1.55, 0], fov: 40 },
    { f: 18,  pos: [-20.8, DECK + 1.65, 5.4],  look: [-20.5, DECK + 1.55, 0], fov: 40 },
    { f: 135, pos: [-29.5, DECK + 5.8, 17.5],  look: [0.0,   DECK + 0.5,  0], fov: 45, path: [[-24.5, DECK + 3.2, 10.5]] },
    { f: 165, pos: [-29.2, DECK + 5.7, 17.1],  look: [0.0,   DECK + 0.5,  0], fov: 44 },
  ],
  promise: [
    { f: 166, pos: [-24.8, DECK + 1.9, 6.2],   look: [-21.2, DECK + 1.35, -0.3], fov: 39 },
    { f: 440, pos: [-23.6, DECK + 2.05, 5.8],  look: [-20.0, DECK + 1.2,  -0.1], fov: 38 },
  ],
  problem: [
    { f: 441, pos: [-20.3, DECK + 1.55, 5.3],  look: [-21.1, DECK + 1.25, -0.7], fov: 36 },
    { f: 582, pos: [-20.5, DECK + 1.52, 5.0],  look: [-21.0, DECK + 1.25, -0.7], fov: 34.5 },
  ],
  boats: [
    { f: 583, pos: [-6.5, 4.2, 7.6],  look: [-2.5, 0.8, 1.5], fov: 38 },
    { f: 658, pos: [-5.1, 3.3, 6.2],  look: [-2.3, 0.5, 2.8], fov: 35, roll: 2.5 },
  ],
  cannon: [
    { f: 659, pos: [-24.2, DECK + 2.0, 2.1],  look: [-14.0, DECK + 1.4, 0.4], fov: 42 },
    { f: 768, pos: [-23.4, DECK + 1.9, 2.0],  look: [-11.5, DECK + 1.4, 0.4], fov: 40 },
  ],
  rivals: [
    { f: 769, pos: [-21.8, DECK + 1.8, 7.8], look: [-21.9, DECK + 1.85, 0.0], fov: 43 },
    { f: 959, pos: [-21.8, DECK + 1.95, 7.5], look: [-21.8, DECK + 2.05, 0.0], fov: 41 },
  ],
  prize: [
    { f: 960,  pos: [-21.1, DECK + 1.7, 6.8], look: [-21.1, DECK + 1.45, -0.4], fov: 41 },
    { f: 1130, pos: [-21.2, DECK + 1.65, 5.8], look: [-21.1, DECK + 1.45, -0.5], fov: 38 },
  ],
  hike: [
    { f: 1131, pos: [24.2, DECK + 1.65, 5.6], look: [25.6, DECK + 1.25, 0], fov: 37 },
    { f: 1302, pos: [20.7, DECK + 1.7,  5.2], look: [21.3, DECK + 1.25, 0], fov: 35 },
  ],
  snap_ice: [
    { f: 1303, pos: [21.8, DECK + 2.3, 6.5],  look: [10.0, 5.2, 0.2], fov: 42 },
    { f: 1485, pos: [6.5,  4.8,        8.8],  look: [0.5,  2.3, 0.4], fov: 36, path: [[14.0, 6.8, 8.2]] },
    { f: 1558, pos: [5.4,  4.2,        7.8],  look: [0.4,  2.0, 0.4], fov: 34, roll: -2 },
  ],
  explain: [
    { f: 1559, pos: [21.8, DECK + 1.75, 4.6], look: [21.7, DECK + 1.35, -0.1], fov: 38 },
    { f: 1685, pos: [21.8, DECK + 1.72, 4.5], look: [21.7, DECK + 1.35, -0.1], fov: 37 },
    { f: 1730, pos: [21.6, DECK + 1.95, 4.8], look: [21.6, DECK + 1.2,   0.7], fov: 38 },
    { f: 1795, pos: [21.6, DECK + 1.9,  4.4], look: [21.6, DECK + 1.15,  0.8], fov: 36 },
  ],
  haul: [
    { f: 1796, pos: [-22.6, DECK + 1.75, 5.8], look: [-21.0, DECK + 1.2, 0.0], fov: 39 },
    { f: 2085, pos: [-22.8, DECK + 1.8,  5.6], look: [-20.8, DECK + 1.2, -0.4], fov: 38 },
    { f: 2125, pos: [-25.5, DECK + 3.8,  9.8], look: [-2.0,  DECK + 2.2, 0.0], fov: 42, path: [[-24.0, DECK + 2.6, 7.2]] },
  ],
  payoff: [
    { f: 2126, pos: [-4.5,  DECK + 4.8, 22.5], look: [0.0,  DECK + 2.0, 0.0], fov: 42 },
    { f: 2224, pos: [-6.5,  DECK + 4.5, 21.5], look: [-1.2, DECK + 2.0, 0.0], fov: 40 },
    { f: 2225, pos: [-21.1, DECK + 1.65, 6.4], look: [-21.0, DECK + 1.4, 0.3], fov: 38, ease: 'easeOut' },
    { f: 2301, pos: [-21.0, DECK + 1.6,  5.3], look: [-21.0, DECK + 1.42, 0.3], fov: 35, roll: -3.5, ease: 'easeOut' },
  ],
};

const KICKS = [
  { f: 502, a: 0.05 },
  { f: 612, a: 0.06 },
  { f: 685, a: 0.05 },
  { f: 725, a: 0.05 },
  { f: 1496, a: 0.06 },
  { f: 2002, a: 0.04 },
  { f: 2068, a: 0.05 },
  { f: 2225, a: 0.04 },
];

export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f, { kicks: KICKS });
  // 6-frame white flashes on place/time jumps
  c.flash =
    (f >= 1131 && f < 1137) ? (1 - (f - 1131) / 6) * 0.85 :
    (f >= 1796 && f < 1802) ? (1 - (f - 1796) / 6) * 0.85 : 0;
  if (S.id === 'boats' || S.id === 'snap_ice') c.shadowAt = [0, 1, 0];
  if (S.id === 'hike' || S.id === 'explain') c.shadowAt = [22, DECK, 0];
  if (S.id === 'payoff' && f < 2225) c.shadowAt = [0, DECK, 0];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook':     return { focus: dist(C.pos, [-20.8, DECK + 1.4, 0]), cinf: lerp(11, 0, M.smooth(ramp(f, 20, 95))) };
    case 'promise':  return { focus: dist(C.pos, [-20.6, DECK + 1.4, -0.2]), cinf: 8 };
    case 'problem':  return { focus: dist(C.pos, [-20.8, DECK + 1.4, -0.4]), cinf: 10 };
    case 'boats':    return { focus: dist(C.pos, [-2.5, 0.5, 1.0]), cinf: 6 };
    case 'cannon':   return { focus: dist(C.pos, [-19.5, DECK + 1.0, 1.2]), cinf: 7 };
    case 'rivals':   return { focus: dist(C.pos, [-21.5, DECK + 1.5, 0.0]), cinf: 7 };
    case 'prize':    return { focus: dist(C.pos, [-21.2, DECK + 1.5, -0.5]), cinf: 10 };
    case 'hike':     return { focus: dist(C.pos, C.look), cinf: 9 };
    case 'snap_ice': return { focus: dist(C.pos, [0.4, 1.8, 0.4]), cinf: 6 };
    case 'explain': {
      const t = M.smooth(ramp(f, 1685, 1730));
      return { focus: lerp(dist(C.pos, [21.6, DECK + 1.4, -0.2]), dist(C.pos, [20.6, DECK + 1.0, 1.4]), t), cinf: 12 };
    }
    case 'haul':     return { focus: dist(C.pos, [-21.0, DECK + 1.2, -0.5]), cinf: lerp(9, 2, M.smooth(ramp(f, 2040, 2115))) };
    case 'payoff':   return { focus: dist(C.pos, f < 2225 ? [0, DECK + 1.5, 0] : [-21.2, DECK + 1.4, 0.4]), cinf: f < 2225 ? 0 : 12 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    showWinch: S.id !== 'payoff',
    winchRot: S.id === 'haul' ? (f - 1909) * 0.14 : 0,
    showTable: S.id === 'explain',
    showSign: S.id === 'prize',
    showCannon: S.id === 'cannon',
    cannonBallProg: S.id === 'cannon' && f >= 685 ? clamp((f - 685) / 68, 0, 1.2) : 0,
    showBoat: S.id === 'boats',
    boatBreak: S.id === 'boats' && f >= 612 ? clamp((f - 612) / 36, 0, 1) : 0,
    spanMode: 'none',
    snapSep: 0,
    bridgeBuilt: false,
    showCarriage: false,
    carriageX: 0,
  };
  if (S.id === 'snap_ice') {
    W.spanMode = 'kite_snap';
    W.snapSep = f >= 1496 ? clamp((f - 1496) / 24, 0, 1) : 0;
  } else if (S.id === 'haul') {
    if (f < 1909) W.spanMode = 'twine';
    else if (f < 2002) W.spanMode = 'cord';
    else if (f < 2068) W.spanMode = 'rope';
    else if (f < 2110) W.spanMode = 'cable';
    else W.bridgeBuilt = true;
  } else if (S.id === 'payoff') {
    W.bridgeBuilt = true;
    W.showCarriage = f < 2225;
    W.carriageX = lerp(11, -11, ramp(f, 2126, 2224));
  }
  return W;
};

// ---------- actors (2D cards) ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const C = (key, draw, pos, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = S.light === 'golden' ? '#ffe6cc' : S.light === 'night' ? '#b8cef0' : '#ffffff';
  const idl = (seed) => { const d = idle(f, seed); return { bob: q(d.bob, 3), tilt: q(d.tilt, 1), headTilt: q(d.headTilt, 1) }; };

  switch (S.id) {
    case 'hook': {
      out.push(R(T, 'homan', { seed: 3, ...idl(3), expr: 'smile', look: 0.3, R: 'hold', spool: true, blink: blinkAt(f, 3) }, [-20.8, DECK, 0], { tint }));
      out.push(C('kite_' + q(f * 0.2, 1), (p) => T.kiteCard(p, f * 0.2), [-20.05, DECK + 1.85 + Math.sin(f * 0.12) * 0.08, -0.35], { s: 0.65, blob: false, tint, roll: q(Math.sin(f * 0.09) * 0.08, 2) }));
      break;
    }
    case 'promise': {
      out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: 'smile', facing: 1, look: 0.6, L: 'hold', R: 'point', scroll: true, blink: blinkAt(f, 5) }, [-20.6, DECK, -0.2], { tint }));
      out.push(R(T, 'civA', { seed: 11, ...idl(11), expr: 'nervous', facing: 1, look: 0.5, blink: blinkAt(f, 11) }, [-22.1, DECK, 0.75], { tint }));
      out.push(R(T, 'civB', { seed: 12, ...idl(12), expr: 'nervous', facing: 1, look: 0.4, L: 'cheek', blink: blinkAt(f, 12) }, [-21.8, DECK, -1.15], { tint }));
      break;
    }
    case 'problem': {
      const stamp = f >= 500 && f < 507 ? 0.035 : 0;
      const d = idl(5);
      out.push(R(T, 'ellet', { seed: 5, ...d, bob: q(d.bob + stamp, 3), expr: 'stubborn', facing: 1, L: 'hip', R: 'hip', blink: blinkAt(f, 5) }, [-20.5, DECK, -0.2], { tint }));
      out.push(R(T, 'workA', { seed: 41, ...idl(41), expr: 'nervous', L: 'up', R: 'hang', facing: 1, blink: blinkAt(f, 41) }, [-21.7, DECK, -1.05], { tint }));
      break;
    }
    case 'boats': {
      out.push(R(T, 'workB', { seed: 42, ...idl(42), expr: 'shock', L: 'cheek', R: 'cheek', blink: 0 }, [-18.8, DECK, 0.0], { tint }));
      break;
    }
    case 'cannon': {
      const sh = f >= 725;
      out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: sh ? 'shock' : 'stern', L: sh ? 'cheek' : 'hip', R: sh ? 'cheek' : 'point', facing: 1, blink: sh ? 0 : blinkAt(f, 5) }, [-21.0, DECK, -0.4], { tint }));
      out.push(R(T, 'workA', { seed: 41, ...idl(41), expr: sh ? 'shock' : 'nervous', L: sh ? 'cheek' : 'hang', R: 'hang', facing: 1, blink: sh ? 0 : blinkAt(f, 41) }, [-21.4, DECK, 1.35], { tint }));
      break;
    }
    case 'rivals': {
      const lb = (s) => q(Math.abs(Math.sin((f + s) * 0.52)) * 0.028, 3);
      out.push(R(T, 'rivalA', { seed: 31, expr: 'laugh', L: 'point', R: 'belly', facing: 1, bob: lb(0), tilt: q(-3 + 3.5 * Math.sin(f * 0.45), 1) }, [-20.6, DECK, 0.25], { tint }));
      out.push(R(T, 'rivalB', { seed: 32, expr: 'grin', L: 'temple', R: 'hip', facing: 1, swirl: q((f * 0.35) % 6.283, 1), bob: lb(4), blink: blinkAt(f, 32) }, [-21.8, DECK, -0.85], { tint }));
      out.push(R(T, 'rivalC', { seed: 33, expr: 'laugh', L: 'belly', R: 'belly', facing: -1, bob: lb(8), tilt: q(4 * Math.sin(f * 0.5 + 1), 1) }, [-22.8, DECK, 0.55], { tint }));
      const ex1 = -24.0 + ((f - 769) / 190) * 6.5;
      out.push(C('eagle1_' + q(f * 0.4, 1), (p) => T.eagleCard(p, f * 0.45), [ex1, DECK + 2.95 + Math.sin(f * 0.2) * 0.15, -0.3], { s: 0.65, blob: false, tint }));
      out.push(C('eagle2_' + q(f * 0.4 + 1, 1), (p) => T.eagleCard(p, f * 0.45 + 1.5), [ex1 - 1.8, DECK + 3.35 + Math.cos(f * 0.22) * 0.15, 0.4], { s: 0.58, blob: false, tint }));
      break;
    }
    case 'prize': {
      out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: 'grin', L: 'point', R: 'up', facing: -1, blink: blinkAt(f, 5) }, [-19.8, DECK, -0.25], { tint }));
      out.push(C('bill', (p) => T.billCard(p), [-19.85, DECK + 1.55 + Math.sin(f * 0.12) * 0.04, -0.05], { s: 0.44, blob: false, tint }));
      const wv = q(Math.sin(f * 0.45), 1);
      out.push(R(T, 'kidA', { seed: 61, ...idl(61), expr: 'grin', L: 'wave', R: 'up', wv, facing: 1, blink: blinkAt(f, 61) }, [-21.1, DECK, 0.45], { s: 0.84, tint }));
      out.push(R(T, 'kidB', { seed: 62, ...idl(62), expr: 'grin', L: 'up', R: 'wave', wv, facing: 1, blink: blinkAt(f, 62) }, [-22.0, DECK, 0.65], { s: 0.82, tint }));
      break;
    }
    case 'hike': {
      const wk = walk(f, 1131, 0.9, 0.75);
      const hx = clamp(26.5 - wk.dist, 21.0, 26.5);
      out.push(R(T, 'homan', { seed: 3, expr: 'stubborn', facing: -1, step: hx > 21.05 ? q(wk.phase, 2) : 0, ...idl(3), L: 'hold', R: 'hip', blink: blinkAt(f, 3) }, [hx, DECK, 0], { tint }));
      out.push(C('kite_' + q(f * 0.25, 1), (p) => T.kiteCard(p, f * 0.25), [hx + 0.65, DECK + 0.48 + Math.sin(f * 0.16) * 0.05, 0.35], { s: 0.62, roll: -0.22, blob: false, tint }));
      break;
    }
    case 'snap_ice': {
      const sh = f >= 1496;
      out.push(R(T, 'homan', { seed: 3, ...idl(3), expr: sh ? 'shock' : 'stubborn', facing: -1, L: sh ? 'cheek' : 'hold', R: sh ? 'cheek' : 'hip', blink: sh ? 0 : blinkAt(f, 3) }, [19.8, DECK, 0], { tint }));
      const ky = sh ? 5.2 + (f - 1496) * 0.08 : lerp(5.6, 4.2, ramp(f, 1303, 1496));
      out.push(C('kite_n_' + q(f * 0.25, 1), (p) => T.kiteCard(p, f * 0.3), [-5.2, ky, 0.2], { s: 0.75, roll: q(Math.sin(f * 0.22) * 0.22, 2), blob: false, tint }));
      break;
    }
    case 'explain': {
      const pt = f >= 1690;
      out.push(R(T, 'homan', { seed: 3, ...idl(3), expr: 'smile', facing: 1, L: pt ? 'point' : 'hold', R: 'hold', spool: true, blink: blinkAt(f, 3) }, [21.3, DECK, -0.35], { tint }));
      out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: 'smile_closed', facing: -1, L: 'hip', R: 'hang', blink: blinkAt(f, 5) }, [22.4, DECK, -0.1], { tint }));
      break;
    }
    case 'haul': {
      const reach = M.smooth(ramp(f, 1900, 1960));
      const lift = q(0.5 + 0.5 * Math.sin((f - 1960) * 0.22), 2);
      out.push(R(T, 'workA', { seed: 41, ...idl(41), expr: f > 2068 ? 'grin' : 'stubborn', L: 'reach', R: 'reach', lift: f > 1909 ? lift : reach, facing: 1, blink: blinkAt(f, 41) }, [-20.5, DECK, 0.35], { tint }));
      out.push(R(T, 'workB', { seed: 42, ...idl(42), expr: f > 2068 ? 'grin' : 'stubborn', L: 'reach', R: 'reach', lift: f > 1909 ? lift : reach, facing: 1, blink: blinkAt(f, 42) }, [-21.6, DECK, -0.55], { tint }));
      out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: 'grin', R: 'up', L: 'point', facing: 1, blink: blinkAt(f, 5) }, [-22.5, DECK, 0.65], { tint }));
      if (f < 1915) {
        out.push(C('kite_land', (p) => T.kiteCard(p, 0), [-19.4, DECK + 0.75, 0.1], { s: 0.55, roll: 0.4, blob: false, tint }));
      }
      break;
    }
    case 'payoff': {
      if (f < 2225) {
        out.push(R(T, 'civA', { seed: 11, ...idl(11), expr: 'grin', L: 'wave', R: 'hang', wv: q(Math.sin(f * 0.35), 1), blink: blinkAt(f, 11) }, [-19.8, DECK, -1.2], { tint }));
        out.push(R(T, 'civB', { seed: 12, ...idl(12), expr: 'grin', L: 'hang', R: 'wave', wv: q(Math.cos(f * 0.35), 1), blink: blinkAt(f, 12) }, [-19.5, DECK, 1.3], { tint }));
      } else {
        out.push(R(T, 'homan', { seed: 3, ...idl(3), expr: 'grin', L: 'up', R: 'up', blink: blinkAt(f, 3) }, [-21.0, DECK, 0.35], { tint }));
        out.push(R(T, 'ellet', { seed: 5, ...idl(5), expr: 'grin', L: 'hip', R: 'wave', wv: q(Math.sin(f * 0.3), 1), facing: 1, blink: blinkAt(f, 5) }, [-22.1, DECK, -0.75], { tint }));
        out.push(C('bill_win', (p) => T.billCard(p), [-21.48, DECK + 1.28 + Math.sin(f * 0.14) * 0.04, 0.5], { s: 0.40, blob: false, tint }));
        out.push(C('kite_win_' + q(f * 0.2, 1), (p) => T.kiteCard(p, f * 0.2), [-20.45, DECK + 1.12 + Math.cos(f * 0.14) * 0.04, 0.35], { s: 0.60, roll: -0.12, blob: false, tint }));
      }
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];

  // Continuous winter snow flurries in outdoor shots (keeps motion alive on every frame!)
  if (S.id === 'hook' || S.id === 'promise' || S.id === 'hike' || S.id === 'snap_ice') {
    const cx = (S.id === 'hike' || S.id === 'snap_ice') ? 21 : -21;
    const cy = S.id === 'snap_ice' ? 4 : DECK;
    for (let i = 0; i < 8; i++) {
      const t = ((f * 0.015) + i / 8) % 1;
      const x = cx - 4 + t * 8 + Math.sin(f * 0.08 + i) * 0.5;
      const y = cy + 4.2 - t * 4.5;
      const z = -2.2 + i * 0.65;
      out.push(FX('snow', (p) => T.fxSnow(p), [x, y, z], 0.08));
    }
  }

  // Stamp dust puff (Shot 3)
  if (S.id === 'problem' && f >= 502 && f < 520) {
    const t = q((f - 502) / 18);
    out.push(FX('puff_' + t, (p) => { p.g.translate(150, 700); T.fxPuff(p, t); }, [-20.5, DECK, 0.1], 0.6));
  }

  // Rowboat splash & wood planks (Shot 4)
  if (S.id === 'boats' && f >= 612) {
    const t = q(clamp((f - 612) / 28, 0, 1));
    out.push(FX('splash_' + t, (p) => { p.g.translate(0, 200); p.g.scale(0.75, 0.75); T.fxSplash(p, t); }, [-2.5, -0.05, 1.5], 2.0));
    if (f < 645) {
      for (const [dx, dy, r] of [[-1.1, 1.3, 0.4], [1.2, 1.5, -0.5]]) {
        out.push(FX('wood', (p) => T.fxWood(p), [-2.5 + dx * t * 1.6, 0.5 + dy * Math.sin(t * Math.PI), 1.5], 0.5, { roll: q(r * t * 6, 1) }));
      }
    }
  }

  // Cannon smoke & mid-air snap (Shot 5)
  if (S.id === 'cannon') {
    if (f >= 685 && f < 720) {
      const k = q((f - 685) / 35);
      out.push(FX('cdust_' + k, (p) => T.fxDust(p, k, '#e8e8e8'), [-18.3, DECK + 1.2, 0.4], 1.8));
    }
    if (f >= 725 && f < 750) {
      const t = q((f - 725) / 25);
      out.push(FX('csnap_' + t, (p) => T.fxSnap(p, t), [-7.5, DECK + 2.8, 0.4], 1.2));
    }
  }

  // Night ice snap starburst & puff (Shot 9)
  if (S.id === 'snap_ice' && f >= 1496 && f < 1526) {
    const t = q((f - 1496) / 30);
    out.push(FX('isnap_' + t, (p) => T.fxSnap(p, t), [0.4, 1.6, 0.5], 1.3));
    out.push(FX('ipuff_' + t, (p) => { p.g.translate(150, 400); T.fxPuff(p, t); }, [0.4, 1.5, 0.5], 0.8));
  }

  // Winch strain creaks (Shot 11)
  if (S.id === 'haul' && ((f >= 2002 && f < 2032) || (f >= 2068 && f < 2100))) {
    const f0 = f < 2050 ? 2002 : 2068;
    const t = q((f - f0) / 30);
    out.push(FX('creak_' + t, (p) => { p.g.translate(150, 380); T.fxCreak(p, t); }, [-21.2, DECK + 1.4, -1.6], 0.65));
  }

  return out;
};
