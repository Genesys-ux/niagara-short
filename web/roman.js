FACE.snore = { eye: ["dash", "dash"], brow: [0, -1], mouth: "o" };
FACE.stubborn = { eye: ["lid", "lid"], brow: [4, -3], mouth: "frown" };
FACE.squint = { eye: ["slit", "slit"], brow: [3, -2], mouth: "dash" };

// ---------------- 1848 Niagara Gorge Cast (built on Pen / blob / face helpers in toonbase.js) ----------------
const LEATHER = "#6e4326", BRASS = "#d9a845";

export const OUTFITS = {
  homan:  { tunic: "#a83c2b", cape: "#7a281d", skin: SKIN, cap: "#365b85", scarf: "#d42c2c", hair: "#4a3222" },
  ellet:  { tunic: "#263852", cape: "#1a2638", skin: "#f5c9a0", tophat: "#1e1e26", tophatBand: "#8f2c2c", hair: "#3b2a20", moustache: "#3b2a20" },
  rivalA: { tunic: "#453254", skin: "#f5c9a0", tophat: "#221f29", tophatBand: "#7d4b8c", hair: "#2b211c", stout: true },
  rivalB: { tunic: "#364f42", skin: SKIN, tophat: "#1e2622", tophatBand: "#c9963a", moustache: "#3b2a20" },
  rivalC: { tunic: "#59412e", skin: "#e8be96", tophat: "#29211b", tophatBand: "#a84632", beard: "#4a3525", stout: true },
  workA:  { tunic: "#8a5d3b", skin: "#f5c9a0", cap: "#c2733a", apron: "#d8c9a6" },
  workB:  { tunic: "#3f6a6f", skin: "#ecd0b6", cap: "#5b4a8a", moustache: "#4a3020" },
  civA:   { tunic: "#4f7fb8", skin: "#f5c9a0", cap: "#3a4f66", hair: "#5a3b2a" },
  civB:   { tunic: "#d9a441", skin: SKIN, hair: "#2b211c", dress: "#9e4662", bonnet: true },
  kidA:   { tunic: "#4d8a47", skin: SKIN, cap: "#c94a38", hair: "#5a3b2a" },
  kidB:   { tunic: "#d4882a", skin: "#f5c9a0", cap: "#3b6e8c", hair: "#2b211c" },
};

/** Front-facing 1848 character. opts: expr, blink, look, facing, seed, L/R arm poses, tilt, headTilt, bob, step, swirl, wv, lift, scroll, spool */
export const romanFront = (p, key, opts = {}) => {
  const O = typeof key === "string" ? OUTFITS[key] : key;
  const { expr = "neutral", blink = 0, look = 0, facing = 0, seed = 3, L = "hang", R = "hang", tilt = 0, headTilt = 0,
    bob = 0, light = rad(-120), step = 0, scroll = false, spool = false } = opts;
  const lid = lidOf(blink), skin = O.skin ?? SKIN;
  const H = headBlob(seed, 118, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const torsoL = O.stout ? 1.12 : 1.08, legsL = 1.38, sole = 975;
  const torsoBot = sole - legsL * HH - bob * HH, chin = torsoBot - torsoL * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u, cx = 300;
  const legCol = mix(O.tunic, INK, 0.62), armCol = mix(O.tunic, INK, 0.5);
  p.rot = null;

  // ---- coat / cape behind ----
  if (O.cape) {
    const cp = [[cx - 0.48 * W, chin + 0.08 * HH], [cx + 0.48 * W, chin + 0.08 * HH], [cx + 0.60 * W, sole - 0.52 * HH], [cx + 0.2 * W, sole - 0.44 * HH], [cx - 0.2 * W, sole - 0.48 * HH], [cx - 0.60 * W, sole - 0.52 * HH]];
    p.gradFill(cp, O.cape, mul(O.cape, [0.6, 0.6, 0.7]), light); p.inkRing(cp, ow * 0.8, thick);
  }

  // ---- legs & winter boots ----
  const dress = !!O.dress;
  for (const side of [-1, 1]) {
    const up = Math.max(0, Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0)))) * 30 * (step ? 1 : 0);
    const hx = cx + side * 16 * u, fx = cx + side * 22 * u, fy = sole - 4 * u - up;
    p.stroke(curve([hx, hipY], [(hx + fx) / 2 + side * 2 * u, (hipY + fy) / 2], [fx, fy]), 6.4 * u, legCol);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 8.0 * u + 3, INK);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 8.0 * u, LEATHER);
  }

  // ---- upper body ----
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const T = { a: (0.4 * W) / 1.06 * (O.stout ? 1.14 : 1), b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: O.stout ? 0.19 : 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = cx + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const S = (side) => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const arm = (side, pose) => {
    const s = S(side), X = (k) => tcx + side * (T.a * 1.1 + k * u);
    switch (pose) {
      case "point": return { pts: [s, [X(28), s[1] - 0.02 * HH], [X(62), s[1] - 0.1 * HH]], front: false, finger: true };
      case "up": return { pts: [s, [X(14), s[1] - 0.3 * HH], [X(22), s[1] - 0.75 * HH]], front: false };
      case "wave": return { pts: [s, [X(16), s[1] - 0.2 * HH], [X(30 + 10 * Math.sin(opts.wv || 0)), s[1] - 0.62 * HH]], front: false };
      case "hip": return { pts: [s, [X(22), s[1] + 0.3 * HH], [tcx + side * T.a * 0.95, torsoBot - 0.3 * HH]], front: false };
      case "belly": return { pts: [s, [X(8), s[1] + 0.45 * HH], [tcx + side * 0.25 * T.a, torsoBot - 0.35 * HH]], front: true };
      case "temple": return { pts: [s, [X(26), s[1] + 0.05 * HH], [cx + side * (H.a + 16 * u), hc - 0.1 * HH]], front: false, swirl: true };
      case "lift": return { pts: [s, [X(20), s[1] - 0.25 * HH], [X(4), s[1] - 0.82 * HH]], front: false };
      case "cross": return { pts: [s, [X(2), s[1] + 0.38 * HH], [tcx - side * 0.45 * T.a, s[1] + 0.32 * HH]], front: true };
      case "reach": { const lf = (opts.lift || 0) * 0.62 * HH; return { pts: [s, [X(42), s[1] - 0.12 * HH - lf * 0.6], [X(82), s[1] - 0.5 * HH - lf]], front: false }; }
      case "cheek": return { pts: [s, [X(16), s[1] + 0.05 * HH], [cx + side * (H.a + 2 * u), hc + 0.25 * H.b]], front: false };
      case "thumb": return { pts: [s, [X(20), s[1] + 0.12 * HH], [X(44), s[1] - 0.12 * HH]], front: false, thumb: true };
      case "hold": return { pts: [s, [X(14), s[1] + 0.32 * HH], [X(24), s[1] + 0.10 * HH]], front: true, hold: true };
      default: return { pts: [s, [X(4), s[1] + 0.48 * HH], [X(3), chin + 1.04 * HH]], front: false };
    }
  };
  const arms = [arm(-1, L), arm(1, R)];
  const drawArm = (a) => {
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.4 * u, armCol);
    const [hx, hy] = a.pts[2];
    p.dot(hx, hy, 5.5 * u);
    if (a.finger) { const dx = a.pts[2][0] - a.pts[1][0], dy = a.pts[2][1] - a.pts[1][1], l = Math.hypot(dx, dy); p.stroke([[hx, hy], [hx + dx / l * 14 * u, hy + dy / l * 14 * u]], 2.6 * u); }
    if (a.thumb) p.stroke([[hx, hy], [hx + Math.sign(hx - cx) * 6 * u, hy - 12 * u]], 2.6 * u);
  };
  for (const a of arms) if (!a.front) drawArm(a);

  // torso / coat
  if (dress) {
    const D = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(cx, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, O.dress, mul(O.dress, SH_CLOTH), light); p.inkRing(dp, ow, thick);
  } else {
    const sk = [[tcx - 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 1.0 * T.a, torsoBot + 0.3 * HH], [tcx - 1.0 * T.a, torsoBot + 0.3 * HH]];
    p.gradFill(sk, O.tunic, mul(O.tunic, SH_CLOTH), light); p.poly(sk, null, ow * 0.8);
  }
  p.gradFill(tp, O.tunic, mul(O.tunic, SH_CLOTH), light);
  p.clip(tp, () => {
    p.band([[tcx - 1.4 * T.a, torsoBot - 0.24 * HH], [tcx + 1.4 * T.a, torsoBot - 0.24 * HH]], O.apron ? "#5a3b2a" : "#d8c08a", 0.05 * HH, 1.2 * u);
    if (O.apron) p.poly([[tcx - 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.6 * T.a, torsoBot + 0.2 * HH], [tcx - 0.6 * T.a, torsoBot + 0.2 * HH]], O.apron, 1.6 * u);
    if (O.tophat) { // Victorian coat lapels & brass buttons
      for (let i = 0; i < 3; i++) p.dot(tcx + 2 * u * facing, chin + (0.28 + i * 0.2) * HH, 2.4 * u, BRASS);
    }
    p.stroke([[tcx - 0.2 * T.a, chin + 0.02 * HH], [tcx, chin + 0.16 * HH], [tcx + 0.2 * T.a, chin + 0.02 * HH]], 2 * u);
  });
  p.inkRing(tp, ow, thick);

  // winter scarf around neck
  if (O.scarf) {
    const scCol = O.scarf;
    p.poly(rrect(tcx - 0.42 * T.a, chin - 0.02 * HH, tcx + 0.12 * T.a, chin + 0.44 * HH, 6 * u), mul(scCol, [0.85, 0.85, 0.9]), 2.5 * u);
    p.poly(rrect(tcx - 0.62 * T.a, chin - 0.06 * HH, tcx + 0.62 * T.a, chin + 0.13 * HH, 8 * u), scCol, 2.8 * u);
  }

  for (const a of arms) if (a.front) drawArm(a);

  // held props: blueprint scroll or kite string spool
  if (scroll) {
    const [hx, hy] = arms[0].pts[2];
    p.poly(rrect(hx - 14 * u, hy - 34 * u, hx + 14 * u, hy + 18 * u, 6 * u), "#d8ecff", 3 * u);
    p.ell(hx, hy - 32 * u, 14 * u, 5 * u, "#8cb8e6", 2.5 * u);
    p.band([[hx - 14 * u, hy - 8 * u], [hx + 14 * u, hy - 8 * u]], "#b8322f", 4 * u, 1 * u);
  }
  if (spool) {
    const [hx, hy] = arms[1].pts[2];
    p.poly(rrect(hx - 14 * u, hy - 14 * u, hx + 14 * u, hy + 14 * u, 4 * u), "#f5f0e4", 2.8 * u);
    for (const dy of [-14, 14]) p.poly(rrect(hx - 18 * u, hy + dy * u - 4 * u, hx + 18 * u, hy + dy * u + 4 * u, 2 * u), "#8a5a34", 2.4 * u);
  }

  // ---- head ----
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  p.rot = Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null;
  const hp = blobPts(cx, hc, H);
  if (O.hair) { const hb = blobPts(cx, hc - 0.03 * HH, { ...H, a: H.a * 1.04, b: H.b * 1.05 }); p.poly(hb, O.hair, 0); }
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);

  if (O.tophat) {
    hatOn(p, { hat: "tophat", jacket: O.tophatBand || O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  } else if (O.cap) {
    hatOn(p, { hat: "cap", cap: O.cap, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  } else if (O.bonnet) {
    hatOn(p, { hat: "bonnet", jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  } else if (O.hair) {
    hatOn(p, { hat: "hair", hair: O.hair, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  }

  if (O.beard) {
    const bd = blobPts(cx + 6 * u * facing, hc + 0.85 * H.b, { a: 0.62 * H.a, b: 0.75 * H.b, nTop: 2.4, nBot: 1.6, egg: -0.35, asym: 0, rot: 0, noise: 0.02, seed: seed + 4 });
    p.shadedFill(bd, O.beard, mul(O.beard, [0.86, 0.86, 0.92]), light, 0.6 * H.a, 0.3);
    p.inkRing(bd, ow * 0.8, thick);
  }
  faceFront(p, cx, hc, W, expr, facing, look, lid, !!O.tophat || !!O.cap, skin, O.beard ? O.beard : O.moustache, !!O.stout);
  p.rot = null;

  if (arms.some((a) => a.swirl)) {
    const a = arms.find((x) => x.swirl), [hx, hy] = a.pts[2], ph = opts.swirl || 0, pts = [];
    for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 4 + ph, r = (4 + i * 0.7) * u; pts.push([hx + Math.cos(t) * r, hy - 40 * u + Math.sin(t) * r]); }
    p.stroke(pts, 3 * u, "#ffffff"); p.stroke(pts, 1.4 * u, INK);
  }
};

/** 2D Red Kite "THE UNION" on 600x1000 canvas (unmirrored text!) */
export const kiteCard = (p, tailPhase = 0) => {
  const cx = 300, cy = 340;
  // Ribbon tail waving beneath
  const tpts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    tpts.push([cx + Math.sin(t * 7 + tailPhase) * (18 + t * 28), cy + 250 + t * 340]);
  }
  p.stroke(tpts, 10, INK);
  p.stroke(tpts, 5, "#f2c144");
  for (const k of [4, 8, 12]) {
    const [bx, by] = tpts[k];
    p.poly([[bx - 24, by - 12], [bx + 24, by + 12], [bx + 24, by - 12], [bx - 24, by + 12]], "#d93b32", 6);
  }
  // Diamond kite body
  const pts = [[cx, cy - 260], [cx + 205, cy - 40], [cx, cy + 250], [cx - 205, cy - 40]];
  p.gradFill(pts, "#e34234", "#9e221b", rad(-120));
  p.poly(pts, null, 12);
  // Wooden cross spars
  p.stroke([[cx, cy - 255], [cx, cy + 245]], 10, "#754b28");
  p.stroke([[cx - 200, cy - 40], [cx + 200, cy - 40]], 10, "#754b28");
  // Cream banner across center reading "THE UNION"
  p.poly(rrect(cx - 172, cy - 82, cx + 172, cy + 2, 12), "#fdf4dc", 8);
  const g = p.g;
  g.save();
  g.font = "900 44px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = INK;
  g.fillText("THE UNION", cx, cy - 38);
  g.restore();
};

/** 2D $5 banknote card on 600x1000 canvas (unmirrored!) */
export const billCard = (p) => {
  const cx = 300, cy = 500;
  p.poly(rrect(60, cy - 125, 540, cy + 125, 18), "#4c8f56", 12);
  p.poly(rrect(88, cy - 97, 512, cy + 97, 10), "#d9edd3", 6);
  p.ell(cx, cy, 86, 86, "#559e60", 6);
  const g = p.g;
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#ffffff";
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.font = "900 98px Georgia, serif";
  g.strokeText("$5", cx, cy + 4);
  g.fillText("$5", cx, cy + 4);
  g.font = "900 28px Georgia, serif";
  g.fillStyle = INK;
  g.fillText("PRIZE", cx, cy - 108);
  g.restore();
};

/** 2D Cartoon Eagle carrying wire loop on 600x1000 canvas */
export const eagleCard = (p, flap = 0) => {
  const cx = 300, cy = 480, wy = -120 * Math.sin(flap);
  // Wings
  p.poly([[cx - 20, cy - 20], [cx - 220, cy - 80 + wy], [cx - 180, cy + 30 + wy * 0.4], [cx - 30, cy + 20]], "#5c3b24", 10);
  p.poly([[cx + 20, cy - 20], [cx + 220, cy - 80 + wy], [cx + 180, cy + 30 + wy * 0.4], [cx + 30, cy + 20]], "#5c3b24", 10);
  // Body & white head
  p.ell(cx, cy + 10, 62, 74, "#6e472b", 10);
  p.ell(cx, cy - 68, 48, 46, "#ffffff", 10);
  // Hooked yellow beak
  p.poly([[cx + 34, cy - 76], [cx + 84, cy - 62], [cx + 36, cy - 48]], "#f2b830", 8);
  p.dot(cx + 18, cy - 74, 6, INK);
  // Wire coil in talons
  p.arc(cx, cy + 122, 68, 34, 0, 360, 10, "#4e5766");
};

export const fxZ = (p, t) => {
  const g = p.g; g.save(); g.font = "900 120px Arial Black, Arial"; g.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const k = (t + i / 3) % 1, x = 220 + i * 70 + Math.sin(k * 6) * 20, y = 700 - k * 500, s = 0.5 + k * 0.7;
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = Math.min(1, (1 - k) * 2.5);
    g.lineWidth = 16; g.strokeStyle = INK; g.strokeText("Z", 0, 0); g.fillStyle = "#ffffff"; g.fillText("Z", 0, 0); g.restore();
  }
  g.restore();
};
export const fxLeaf = (p, col) => { p.poly([[300, 380], [420, 470], [300, 620], [180, 470]], col, 14); p.stroke([[300, 400], [300, 600]], 8); };
export const fxDust = (p, k, col = "#e8dcc4") => {
  const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - k * k);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = 90 + 150 * k; p.ell(300 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.6, 120 + 60 * k, 100 + 50 * k, col, 12); }
  p.ell(300, 520, 170 + 110 * k, 140 + 80 * k, col, 0);
  g.restore();
};
export const fxDrip = (p) => p.ell(300, 500, 40, 64, "#9fd4ff", 10);
export const fxWood = (p) => { p.poly([[200, 420], [400, 400], [420, 560], [230, 600]], "#8a5a34", 14); p.stroke([[240, 450], [380, 440]], 6, "#4d311b"); };
export const fxSnap = (p, t) => {
  const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - t);
  const r0 = 35 + 40 * t, r1 = 170 + 90 * t;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.2;
    p.stroke([[300 + Math.cos(a) * r0, 500 + Math.sin(a) * r0], [300 + Math.cos(a) * r1, 500 + Math.sin(a) * r1]], 14, "#fff275");
    p.stroke([[300 + Math.cos(a) * r0, 500 + Math.sin(a) * r0], [300 + Math.cos(a) * r1, 500 + Math.sin(a) * r1]], 6, INK);
  }
  g.restore();
};
export const fxSnow = (p) => p.ell(300, 500, 44, 44, "#ffffff", 10);

export const headCenter = (seed = 3) => { const H = headBlob(seed, 118, 0), HH = 2 * H.b; return 975 - 1.38 * HH - 1.08 * HH - H.b; };
