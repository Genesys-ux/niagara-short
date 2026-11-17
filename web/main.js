import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6),
  beam: texM(P.beam(2), 1, 2),
  beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  stone: texM(P.stone(4, 215, 10, 56), 1, 1),
  cliff: texM(P.cliffRock(21), 1, 1),
  snow: texM(P.snow(20), 40, 40),
  dirt: texM(P.dirt(7), 6, 30),
  roof: texM(P.roof(9), 2, 2),
  cabinWall: texM(P.planks(12), 1, 1, '#b89468'),
  rope: texM(P.ropeTex(22), 6, 1),
  cable: texM(P.cableTex(23), 8, 1),
  twine: toon({ color: '#f7f2e6' }),
  cord: toon({ color: '#c8a675' }),
  trunk: toon({ color: '#5c3d26' }),
  pine: toon({ color: '#2f5c3a' }),
  snowCap: toon({ color: '#f2f7fc' }),
  hill: toon({ color: '#6b8594' }),
  hillFar: toon({ color: '#7b93a3' }),
  mount: toon({ color: '#7e96ab' }),
  ice: toon({ color: '#d8eefc' }),
  iceEdge: toon({ color: '#a8d4f0' }),
  iron: toon({ color: '#3b4048' }),
  brass: toon({ color: '#d4a644' }),
  wood: toon({ color: '#7a5230' }),
  door: toon({ color: '#4d301d' }),
  window: toon({ color: '#ffdf85' }),
  carriage: toon({ color: '#8f2828' }),
  horse: toon({ color: '#6b4226' }),
  prizeSign: new THREE.MeshToonMaterial({ gradientMap: grad, map: (() => { const t = P.tex(P.prizeSign(), 1, 1); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })() }),
};

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = opts.recv ?? true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- world (Niagara Gorge 1848) ----------
const DECK = 8; // cliff rim height above boiling rapids (y=0)
const world = new THREE.Group(); scene.add(world);

// boiling Niagara rapids
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#235470') }, shal: { value: new THREE.Color('#4f9ab5') }, glint: { value: new THREE.Color('#f0faff') } };
const waterMat = new THREE.ShaderMaterial({
  uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...waterU }, fog: true,
  vertexShader: `#include <fog_pars_vertex>
    varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `#include <fog_pars_fragment>
    uniform float t; uniform vec3 deep, shal, glint; varying vec3 vW;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    void main(){ vec2 p = vW.xz*vec2(.42,.15) + vec2(0., -t*.95);
      float n = noise(p) * .55 + noise(p*2.6 + 7.) * .45; float edge = smoothstep(9., 17., abs(vW.x));
      vec3 c = mix(deep, shal, .35 + .45*n + .35*edge);
      float streak = smoothstep(.62, .73, noise(vW.xz*vec2(.75,.11) + vec2(0., -t*1.6))) * (1.-edge*.35);
      c = mix(c, glint, streak*.88);
      gl_FragColor = vec4(c,1.);
      #include <fog_fragment>
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(52, 2300), waterMat);
water.rotation.x = -Math.PI / 2; water.position.y = 0;
water.userData.nd = waterNd; water.receiveShadow = false; scene.add(water);

// Gorge cliffs: x <= -18 (American), x >= +18 (Canadian), flat snow top at DECK=8
const cliffGeo = (s) => {
  const shape = new THREE.Shape();
  shape.moveTo(13.5 * s, -1.5);
  shape.lineTo(18.0 * s, DECK - 0.02);
  shape.lineTo(1150 * s, DECK - 0.02);
  shape.lineTo(1150 * s, -1.5);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2300, bevelEnabled: false });
  g.translate(0, 0, -1150);
  return g;
};
const snowTopMat = M.snow.clone(); snowTopMat.map = M.snow.map.clone(); snowTopMat.map.repeat.set(30, 30); snowTopMat.map.needsUpdate = true;
const cliffSideMat = M.cliff.clone(); cliffSideMat.map = M.cliff.map.clone(); cliffSideMat.map.repeat.set(0.18, 0.18); cliffSideMat.map.needsUpdate = true;
for (const s of [-1, 1]) {
  add(cliffGeo(s), [cliffSideMat, cliffSideMat], 0, 0, 0, world, { cast: false });
  const topSnow = add(new THREE.PlaneGeometry(1132, 2300), snowTopMat, s * (18 + 1132 / 2), DECK - 0.005, 0, world, { cast: false });
  topSnow.rotation.x = -Math.PI / 2;
}

// Snow roads leading up to each cliff rim
for (const s of [-1, 1]) {
  const rd = add(new THREE.PlaneGeometry(42, 4.4), M.dirt, s * 40, DECK + 0.015, 0, world, { cast: false });
  rd.rotation.x = -Math.PI / 2;
}

// Jagged river ice floes in the gorge
const iceFloes = new THREE.Group(); world.add(iceFloes);
const iceData = [
  [0, 0.35, 0.4, 2.2, 1.3, 0.3],
  [-4.2, 0.18, -3.5, 1.8, 0.7, -0.4],
  [3.8, 0.22, 3.2, 1.9, 0.85, 0.5],
  [-2.5, 0.2, 5.8, 1.6, 0.65, 0.1],
  [2.8, 0.18, -6.2, 1.7, 0.6, -0.2],
];
for (const [x, y, z, r, h, rot] of iceData) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; iceFloes.add(g);
  const slab = add(new THREE.CylinderGeometry(r * 0.85, r, 0.45, 7), M.ice, 0, 0, 0, g, { cast: false });
  slab.scale.set(1.2, 1, 0.85);
  const spike = add(new THREE.ConeGeometry(r * 0.45, h, 5), M.iceEdge, 0.2, h * 0.45, 0, g);
  spike.rotation.z = -0.15;
}

// Twin stone masonry towers on both rims (x = ±18.8, z = ±3.6 — wide stage corridor clear of faces)
for (const s of [-1, 1]) {
  const tx = s * 18.8;
  for (const z of [-3.6, 3.6]) {
    add(tbox(1.5, 6.2, 1.5, 1.6), M.stone, tx, DECK + 3.1, z, world);
    add(tbox(1.9, 0.45, 1.9, 1.6), M.stone, tx, DECK + 6.3, z, world);
    add(tbox(1.8, 0.2, 1.8, 1.6), M.snowCap, tx, DECK + 6.62, z, world);
  }
  add(tbox(1.1, 0.65, 8.8, 1.6), M.beamDark, tx, DECK + 5.95, 0, world);
}

// Capstan winch & wire reel on American rim (x = -21.2, z = -2.0)
const winchG = new THREE.Group(); winchG.position.set(-21.2, DECK, -2.0); world.add(winchG);
add(tbox(1.3, 0.2, 1.3, 1), M.beamDark, 0, 0.1, 0, winchG);
add(tbox(0.22, 1.15, 0.22, 1), M.beam, -0.45, 0.65, 0, winchG);
add(tbox(0.22, 1.15, 0.22, 1), M.beam, 0.45, 0.65, 0, winchG);
const winchDrum = new THREE.Group(); winchDrum.position.set(0, 0.95, 0); winchG.add(winchDrum);
const drumCyl = add(new THREE.CylinderGeometry(0.32, 0.32, 0.82, 14), M.rope, 0, 0, 0, winchDrum);
drumCyl.rotation.z = Math.PI / 2;
for (const x of [-0.42, 0.42]) {
  const fl = add(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 14), M.wood, x, 0, 0, winchDrum);
  fl.rotation.z = Math.PI / 2;
}
add(tbox(0.1, 1.35, 0.1, 1), M.wood, 0.56, 0, 0, winchDrum);

// Cliff worktable on Canadian rim for Shot 10 (progressive twine -> cord -> rope -> cable)
const tableG = new THREE.Group(); tableG.position.set(21.6, DECK, 0.9); world.add(tableG);
add(tbox(1.65, 0.12, 1.85, 1), M.plank, 0, 0.88, 0, tableG);
for (const dx of [-0.65, 0.65]) for (const dz of [-0.75, 0.75]) add(tbox(0.14, 0.88, 0.14, 1), M.beam, dx, 0.44, dz, tableG);
// Four progressive specimens lying across the table top (y = 0.98)
const specTwine = add(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8), M.twine, 0, 0.96, -0.55, tableG); specTwine.rotation.z = Math.PI / 2;
const specCord = add(new THREE.CylinderGeometry(0.045, 0.045, 1.35, 10), M.cord, 0, 0.98, -0.18, tableG); specCord.rotation.z = Math.PI / 2;
const specRope = add(new THREE.CylinderGeometry(0.085, 0.085, 1.35, 12), M.rope, 0, 1.02, 0.20, tableG); specRope.rotation.z = Math.PI / 2;
const specCable = add(new THREE.CylinderGeometry(0.13, 0.13, 1.35, 12), M.cable, 0, 1.06, 0.58, tableG); specCable.rotation.z = Math.PI / 2;
// Warm brass lantern on table corner
const lanternG = new THREE.Group(); lanternG.position.set(-0.56, 0.94, -0.68); tableG.add(lanternG);
add(new THREE.CylinderGeometry(0.12, 0.15, 0.08, 10), M.iron, 0, 0.04, 0, lanternG);
add(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 10), M.window, 0, 0.2, 0, lanternG);
add(new THREE.ConeGeometry(0.15, 0.12, 10), M.iron, 0, 0.36, 0, lanternG);

// Prize notice board (Shot 7) on American rim
const signG = new THREE.Group(); signG.position.set(-21.3, DECK, -1.35); signG.rotation.y = 0.06; world.add(signG);
add(tbox(0.18, 2.5, 0.18, 1), M.beamDark, 0, 1.25, 0, signG);
add(tbox(1.55, 1.55, 0.14, 1), M.wood, 0, 1.75, 0.04, signG);
const signFace = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.42), M.prizeSign);
signFace.position.set(0, 1.75, 0.12);
signFace.userData.nd = ndMat;
signG.add(signFace);

// Cliff cannon (Shot 5) on American rim
const cannonG = new THREE.Group(); cannonG.position.set(-19.6, DECK, 0.4); world.add(cannonG);
add(tbox(1.4, 0.45, 0.9, 1), M.wood, 0, 0.45, 0, cannonG);
for (const z of [-0.52, 0.52]) {
  const wh = add(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 14), M.beamDark, 0.2, 0.38, z, cannonG);
  wh.rotation.x = Math.PI / 2;
}
const barrel = add(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 14), M.iron, 0.2, 0.92, 0, cannonG);
barrel.rotation.z = -Math.PI / 2 + 0.38;
const cannonBall = add(new THREE.SphereGeometry(0.24, 14, 12), M.iron, 0, 0, 0, world);

// Rapids rowboat (Shot 4) in the river
const boatG = new THREE.Group(); boatG.position.set(-2.5, 0.32, 0.5); world.add(boatG);
const boatL = new THREE.Group(), boatR = new THREE.Group();
boatG.add(boatL); boatG.add(boatR);
add(tbox(1.3, 0.45, 1.25, 1), M.wood, -0.65, 0.25, 0, boatL);
add(tbox(1.3, 0.45, 1.25, 1), M.wood, 0.65, 0.25, 0, boatR);
add(tbox(0.2, 0.22, 1.4, 1), M.plank, -0.35, 0.52, 0, boatL);
add(tbox(0.2, 0.22, 1.4, 1), M.plank, 0.35, 0.52, 0, boatR);

// Progressive span lines across the gorge (x = -19.2 .. +19.2)
const makeSpan = (r, mat, sag = 2.6, y0 = DECK + 1.2) => {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, x = -19.2 + u * 38.4;
    const y = y0 - Math.sin(u * Math.PI) * sag;
    pts.push(new THREE.Vector3(x, y, 0));
  }
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, r, 8, false), mat);
  mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
  return mesh;
};
const spanTwine = makeSpan(0.032, M.twine, 2.2);
const spanCord = makeSpan(0.068, M.cord, 2.5);
const spanRope = makeSpan(0.115, M.rope, 2.9);
const spanCable = makeSpan(0.17, M.cable, 3.3);

// Night ice snap line segments (Shot 9)
const snapUpper = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(19.2, DECK + 1.3, 0.1), new THREE.Vector3(10.0, 4.8, 0.3), new THREE.Vector3(0.4, 1.55, 0.4)]), 18, 0.036, 8, false),
  M.twine
);
const snapLower = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, 1.55, 0.4), new THREE.Vector3(-2.5, 3.0, 0.3), new THREE.Vector3(-5.2, 4.6, 0.2)]), 16, 0.036, 8, false),
  M.twine
);
world.add(snapUpper); world.add(snapLower);

// Completed Suspension Bridge (Shot 11 late & Shot 12)
const bridgeG = new THREE.Group(); world.add(bridgeG);
const bridgeDeck = add(tbox(39.0, 0.32, 4.5, 1), M.plank, 0, DECK - 0.16, 0, bridgeG);
for (const z of [-2.18, 2.18]) {
  add(tbox(39.0, 0.16, 0.16, 2), M.beamDark, 0, DECK + 0.92, z, bridgeG);
  add(tbox(39.0, 0.1, 0.12, 2), M.beam, 0, DECK + 0.46, z, bridgeG);
  for (let x = -18; x <= 18; x += 3.0) add(tbox(0.16, 0.95, 0.16, 1), M.beam, x, DECK + 0.48, z, bridgeG);
}
for (const z of [-3.1, 3.1]) {
  const cPts = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28, x = -18.8 + u * 37.6;
    const y = DECK + 6.0 - Math.sin(u * Math.PI) * 4.5;
    cPts.push(new THREE.Vector3(x, y, z));
  }
  const mainCab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cPts), 36, 0.18, 8, false), M.cable);
  mainCab.castShadow = true; bridgeG.add(mainCab);
  for (const s of [-1, 1]) {
    const bPts = [new THREE.Vector3(s * 18.8, DECK + 6.0, z), new THREE.Vector3(s * 25.5, DECK + 0.1, z)];
    bridgeG.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bPts), 8, 0.15, 8, false), M.cable));
  }
  for (let x = -16.5; x <= 16.5; x += 2.75) {
    const u = (x + 18.8) / 37.6;
    const topY = DECK + 6.0 - Math.sin(u * Math.PI) * 4.5;
    const rodH = topY - DECK;
    add(new THREE.CylinderGeometry(0.035, 0.035, rodH, 6), M.iron, x, DECK + rodH / 2, z, bridgeG);
  }
}

// Horse-drawn Carriage (Shot 12)
const carriageG = new THREE.Group(); carriageG.position.set(0, DECK, 0); world.add(carriageG);
add(tbox(2.4, 1.35, 1.5, 1), M.carriage, -0.8, 1.25, 0, carriageG);
add(tbox(2.6, 0.16, 1.65, 1), M.beamDark, -0.8, 1.98, 0, carriageG);
for (const s of [-1, 1]) add(box(0.75, 0.58, 1.54), M.window, -0.8, 1.42, 0, carriageG, { cast: false });
const wheels = [];
for (const [wx, r] of [[-1.65, 0.55], [0.05, 0.46]]) for (const wz of [-0.82, 0.82]) {
  const wg = new THREE.Group(); wg.position.set(wx, r, wz); carriageG.add(wg);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 16), M.wood);
  wg.add(rim);
  add(tbox(r * 1.9, 0.06, 0.06, 1), M.wood, 0, 0, 0, wg);
  add(tbox(0.06, r * 1.9, 0.06, 1), M.wood, 0, 0, 0, wg);
  wheels.push(wg);
}
// Stylized 3D horse in front of carriage (+x)
const horseG = new THREE.Group(); horseG.position.set(1.85, 0, 0); carriageG.add(horseG);
add(tbox(1.5, 0.72, 0.62, 1), M.horse, 0, 1.12, 0, horseG);
const neck = add(tbox(0.38, 0.78, 0.36, 1), M.horse, 0.65, 1.58, 0, horseG); neck.rotation.z = -0.35;
add(tbox(0.55, 0.32, 0.32, 1), M.horse, 0.92, 1.85, 0, horseG);
add(tbox(0.15, 0.35, 0.15, 1), M.beamDark, -0.82, 1.15, 0, horseG);
const horseLegs = [];
for (const lx of [-0.52, 0.52]) for (const lz of [-0.2, 0.2]) {
  const leg = add(tbox(0.14, 0.82, 0.14, 1), M.horse, lx, 0.41, lz, horseG);
  horseLegs.push({ m: leg, ph: (lx > 0 ? 0 : Math.PI) + (lz > 0 ? 0.5 : 0) });
}
// Hitch shafts
for (const z of [-0.36, 0.36]) add(tbox(1.5, 0.06, 0.06, 1), M.wood, 1.1, 0.95, z, carriageG);

// Frontier timber cabins (well clear of camera stage z = -7..+7)
const cabin = (x, z, w, d, h, rot) => {
  const g = new THREE.Group(); g.position.set(x, DECK, z); g.rotation.y = rot; world.add(g);
  add(tbox(w, h, d, 2), M.cabinWall, 0, h / 2, 0, g);
  const rf = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.5, 1.9, 4), M.roof, 0, h + 0.95, 0, g);
  rf.rotation.y = Math.PI / 4; rf.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  const srf = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.55, 1.9, 4), M.snowCap, 0, h + 1.05, 0, g);
  srf.rotation.y = Math.PI / 4; srf.scale.set(w / Math.hypot(w, d) * 1.38, 0.92, d / Math.hypot(w, d) * 1.38);
  add(box(0.9, 1.75, 0.1), M.door, 0, 0.88, d / 2 + 0.03, g, { cast: false });
  for (const s of [-1, 1]) add(box(0.65, 0.65, 0.1), M.window, s * w * 0.28, h * 0.62, d / 2 + 0.03, g, { cast: false });
};
[[-36, -15, 5.2, 4.2, 3.6, 0.2], [-44, 14, 4.8, 4.0, 3.4, -2.9], [-55, -22, 6.0, 4.6, 4.0, 0.4],
 [36, -16, 5.0, 4.2, 3.5, -0.3], [45, 15, 5.4, 4.4, 3.8, 2.8]].forEach((a) => cabin(...a));

// Snow-dusted pine trees
const snowPine = (x, z, h = 6.5, y = DECK) => {
  const g = new THREE.Group(); g.position.set(x, y, z); world.add(g);
  add(new THREE.CylinderGeometry(0.18, 0.28, h * 0.35, 6), M.trunk, 0, h * 0.17, 0, g);
  for (let k = 0; k < 3; k++) {
    const r = (1.9 - k * 0.45) * (h / 6.5), cy = h * (0.4 + k * 0.24);
    add(new THREE.ConeGeometry(r, h * 0.36, 7), M.pine, 0, cy, 0, g);
    add(new THREE.ConeGeometry(r * 0.72, h * 0.2, 7), M.snowCap, 0, cy + h * 0.1, 0, g);
  }
};
const rt = P.rng(44);
for (let i = 0; i < 36; i++) {
  const s = i % 2 ? 1 : -1;
  const x = s * (25 + rt() * 75), z = (rt() - 0.5) * 140;
  if (Math.abs(z) < 9) continue;
  snowPine(x, z, 5.5 + rt() * 4.5);
}

// Rolling snow hills & distant mountains
for (let i = 0; i < 16; i++) {
  const a = rt() * Math.PI * 2, d = 170 + rt() * 160;
  const h = add(new THREE.SphereGeometry(42 + rt() * 38, 20, 10), i % 2 ? M.hill : M.hillFar, Math.cos(a) * d, -12, Math.sin(a) * d, world, { cast: false });
  h.scale.y = 0.5 + rt() * 0.3;
}
for (let i = 0; i < 14; i++) {
  const a = rt() * Math.PI * 2, d = 520 + rt() * 200, hh = 130 + rt() * 120, r_ = 110 + rt() * 70;
  const g = new THREE.Group(); g.position.set(Math.cos(a) * d, -5, Math.sin(a) * d); world.add(g);
  add(new THREE.ConeGeometry(r_, hh, 7), M.mount, 0, hh / 2, 0, g, { cast: false });
  add(new THREE.ConeGeometry(r_ * 0.36, hh * 0.34, 7), M.snowCap, 0, hh * 0.85, 0, g, { cast: false });
}

// Clouds: painted billboards far away (no fog, no ink)
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 650 + r() * 250; m.position.set(Math.cos(a) * d, 120 + r() * 160, Math.sin(a) * d); m.scale.setScalar(160 + r() * 140);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  }
}

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(W_, f) {
  // Winch spin
  winchG.visible = W_.showWinch ?? true;
  winchDrum.rotation.x = W_.winchRot || 0;

  // Progressive cable table (Shot 10)
  tableG.visible = !!W_.showTable;

  // Prize sign (Shot 7)
  signG.visible = !!W_.showSign;

  // Cannon & iron ball (Shot 5)
  cannonG.visible = !!W_.showCannon;
  cannonBall.visible = W_.cannonBallProg > 0;
  if (cannonBall.visible) {
    const p = W_.cannonBallProg;
    const x = -18.3 + p * 21.0;
    const y = DECK + 1.25 + p * 4.5 - p * p * 11.5;
    cannonBall.position.set(x, y, 0.4);
  }

  // Rowboat in rapids (Shot 4)
  boatG.visible = !!W_.showBoat;
  if (boatG.visible) {
    const b = W_.boatBreak || 0;
    boatG.position.set(-2.5 + Math.sin(f * 0.25) * 0.3, 0.35 - b * 0.3, 0.5 + (f - 583) * 0.05);
    boatG.rotation.z = Math.sin(f * 0.45) * 0.18;
    boatL.position.set(-b * 1.4, -b * 0.2, -b * 0.4);
    boatL.rotation.set(b * 0.6, b * 0.5, b * 1.1);
    boatR.position.set(b * 1.5, -b * 0.25, b * 0.5);
    boatR.rotation.set(-b * 0.5, -b * 0.6, -b * 1.2);
  }

  // Span modes across gorge
  spanTwine.visible = W_.spanMode === 'twine';
  spanCord.visible = W_.spanMode === 'cord';
  spanRope.visible = W_.spanMode === 'rope';
  spanCable.visible = W_.spanMode === 'cable';

  // Night ice snap lines (Shot 9)
  const isSnap = W_.spanMode === 'kite_snap';
  snapUpper.visible = isSnap;
  snapLower.visible = isSnap;
  if (isSnap) {
    const sp = W_.snapSep || 0;
    snapUpper.position.set(sp * 3.5, sp * 1.2, 0);
    snapUpper.rotation.z = -sp * 0.22;
    snapLower.position.set(-sp * 2.8, sp * 1.8, 0);
    snapLower.rotation.z = sp * 0.28;
  }

  // Completed bridge & horse-drawn carriage (Shot 11 late & Shot 12)
  bridgeG.visible = !!W_.bridgeBuilt;
  carriageG.visible = !!W_.showCarriage;
  if (carriageG.visible) {
    const cx = W_.carriageX ?? 0;
    carriageG.position.set(cx, DECK, 0);
    wheels.forEach((w) => { w.rotation.z = -cx * 1.9; });
    horseLegs.forEach((hl) => { hl.m.rotation.z = Math.sin(f * 0.42 + hl.ph) * 0.32; });
  }

  waterU.t.value = f / 30;
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
