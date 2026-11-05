// The dual-coil machine, built from code in millimetres (the root scales it to metres ÷ 10): the cast side frame with
// its spring deck and tube vise, the iron yoke, two 8-wrap coils on 9.5 mm cores, the armature bar hung on the back
// spring, the front spring with its silver contact, the binding post and contact screw, the capacitor across the
// contact, the needle bar on the nipple, the grip, the tube and a 3-round-liner needle group.
//
// Frame: x toward the needle, y up, z out of the frame plate (the coils sit in front of it at z = 0).
// update(st) poses everything from the nipple travel st.y (mm) and the coil current st.i (A).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {armAngle, LV, M} from './kin.js';

const V2 = THREE.Vector2;
const V3 = THREE.Vector3;
export const SCALE = 0.01; // world units per mm
export const LIFT = 1.222; // root height, world units: puts the floor at y = 0
export const NEEDLE_Z = 7; // the needle line sits on the nipple, beside the armature
export const TIP_Y = -108; // tube tip
export const SKIN_Y = TIP_Y - M.skinGap; // the skin's surface
export const FLOOR_Y = SKIN_Y - 12;
export const ACCENT = new THREE.Color('#e8452c');
const P = new V3(M.pivot[0], M.pivot[1], 0);
const CORE_TOP = 29.2;
const ARM_BOT = CORE_TOP + M.gap0; // 32.5
const ARM_TOP = 38;

const mat = (o) => new THREE.MeshStandardMaterial({envMapIntensity: 0.6, ...o});
export const MAT = {
  frame: mat({color: '#34373d', metalness: 0.75, roughness: 0.42}),
  frameEdge: mat({color: '#4a4e55', metalness: 0.8, roughness: 0.38}),
  iron: mat({color: '#5b5f66', metalness: 0.85, roughness: 0.4}),
  steel: mat({color: '#c7cbd0', metalness: 0.9, roughness: 0.32}),
  bright: mat({color: '#e3e6ea', metalness: 0.95, roughness: 0.22}),
  spring: mat({color: '#2c3f63', metalness: 0.8, roughness: 0.35}),
  copper: mat({color: '#8e5a3d', metalness: 0.92, roughness: 0.3, emissive: '#000000', envMapIntensity: 0.55}),
  washer: mat({color: '#1d1f22', metalness: 0.1, roughness: 0.55}),
  brass: mat({color: '#c49a45', metalness: 0.9, roughness: 0.32}),
  silver: mat({color: '#f1f1ee', metalness: 1, roughness: 0.18, emissive: '#000000'}),
  insul: mat({color: '#18191b', metalness: 0.05, roughness: 0.5}),
  rubber: mat({color: '#7a2a20', metalness: 0, roughness: 0.7}),
  cap: mat({color: '#2d6db5', metalness: 0.2, roughness: 0.38}),
  wire: mat({color: '#9e3b25', metalness: 0.1, roughness: 0.5}),
  grip: mat({color: '#b9bec4', metalness: 0.92, roughness: 0.36}),
  needle: mat({color: '#d9dcdf', metalness: 1, roughness: 0.2}),
};
MAT.windGhost = MAT.copper.clone();
MAT.windGhost.transparent = true;

const mesh = (geo, m, parent, f) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  if (f) f(o);
  parent.add(o);
  return o;
};
const cylY = (r0, r1, h, seg = 40) => new THREE.CylinderGeometry(r0, r1, h, seg);
const box = (w, h, d, r = 0.6) => new RoundedBoxGeometry(w, h, d, 2, r);
const lathe = (prof, seg = 48) => new THREE.LatheGeometry(prof.map(([r, y]) => new V2(Math.max(0.001, r), y)), seg);
// a screw head: a domed cylinder with a slot
function screwHead(parent, x, y, z, r = 1.9, axis = 'y', m = MAT.steel) {
  const g = new THREE.Group();
  mesh(lathe([[0, 0], [r, 0], [r, r * 0.45], [r * 0.82, r * 0.8], [r * 0.4, r * 0.95], [0, r * 0.97]], 24), m, g);
  mesh(new THREE.BoxGeometry(r * 2.1, r * 0.5, r * 0.32), MAT.washer, g, (o) => (o.position.y = r * 0.92));
  g.position.set(x, y, z);
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  if (axis === '-y') g.rotation.x = Math.PI;
  parent.add(g);
  return g;
}

// ------------------------------------------------------------ the frame: one cast side plate
function frameShape() {
  const outer = [
    [-36, -14], [-36, 29], [-41.5, 33.5], [-41.5, 38], [-30, 38], [-24, 47], [-12, 55.5], [3, 59.5], [13, 58], [19, 52],
    [23, 40], [27, 26], [31.5, 10], [36, -4], [36, -19], [32, -24.5], [20, -24.5], [16, -16], [-28, -16],
  ];
  const hole = [[-28.5, 2], [-28.5, 27.5], [-20, 38.5], [-7, 47.5], [5, 50.5], [12.5, 46], [17.5, 31], [23, 10], [21, 1.5], [-2, 0], [-20, 0]];
  const sh = new THREE.Shape();
  outer.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  const h = new THREE.Path();
  hole.forEach(([x, y], i) => (i ? h.lineTo(x, y) : h.moveTo(x, y)));
  h.closePath();
  sh.holes.push(h);
  // two lightening ports in the rear upright
  for (const [x, y] of [[-32, 8], [-32, 19]]) {
    const c = new THREE.Path();
    c.absarc(x, y, 2.2, 0, Math.PI * 2, true);
    sh.holes.push(c);
  }
  return sh;
}

// ------------------------------------------------------------ a coil: core, two washers, the winding
function buildCoil(x) {
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  // the iron core and its pole face
  mesh(cylY(4.75, 4.75, CORE_TOP + 1, 32), MAT.iron, g, (o) => (o.position.y = (CORE_TOP - 1) / 2));
  mesh(cylY(4.75, 4.6, 0.6, 32), MAT.steel, g, (o) => (o.position.y = CORE_TOP - 0.3));
  // washers
  mesh(cylY(11.6, 11.6, 1.6, 48), MAT.washer, g, (o) => (o.position.y = 0.8));
  mesh(cylY(11.6, 11.6, 1.6, 48), MAT.washer, g, (o) => (o.position.y = 26.8));
  // the winding: a rippled lathe, one ripple per layer of turns
  const prof = [[4.8, 1.6]];
  for (let k = 0; k <= 160; k++) {
    const y = 1.7 + (k / 160) * 24.4;
    prof.push([10.55 + 0.14 * Math.abs(Math.sin((y / 0.62) * Math.PI)), y]);
  }
  prof.push([4.8, 26.1]);
  const wind = mesh(lathe(prof, 72), MAT.copper, g);
  // a band of tape round the middle
  mesh(cylY(10.82, 10.82, 4.2, 64), mat({color: '#d9c58f', metalness: 0, roughness: 0.6, transparent: true, opacity: 0.85}), g, (o) => (o.position.y = 13.8));
  // the coil screw from under the yoke
  screwHead(g, 0, -6, 0, 2.4, '-y');
  return {g, wind};
}

// ------------------------------------------------------------ the front spring: a strip bent by the screw's push
const FS = {x0: -16, x1: 7, clampEnd: -10, cx: M.contactX, w: 7.4, t: 0.55};
function frontSpringGeo() {
  const g = new THREE.BoxGeometry(FS.x1 - FS.x0, FS.t, FS.w, 60, 1, 1);
  g.translate((FS.x0 + FS.x1) / 2, ARM_TOP + FS.t / 2, 0);
  const base = g.attributes.position.array.slice();
  return {g, base};
}
// rest shape: flat on the armature to the clamp, then a soft rise to the contact
const restRise = (x) => (x <= FS.clampEnd ? 0 : 1.15 * Math.pow(Math.min(1, (x - FS.clampEnd) / (FS.cx - FS.clampEnd)), 1.6) + Math.max(0, x - FS.cx) * 0.12);
// cantilever deflection, 1 at the contact, carried on straight past it
const deflect = (x) => {
  if (x <= FS.clampEnd) return 0;
  const s = (x - FS.clampEnd) / (FS.cx - FS.clampEnd);
  return s <= 1 ? (s * s * (3 - s)) / 2 : 1 + 1.5 * (s - 1);
};

// ------------------------------------------------------------ a tube along a path
const tube = (pts, r, m, parent, seg = 64) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), seg, r, 10, false), m, parent);

// ------------------------------------------------------------ field lines: the magnetic circuit through cores, armature and yoke
const FIELD_VERT = /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FIELD_FRAG = /* glsl */ `uniform vec3 uCol; uniform float uA; uniform float uFlow; uniform float uN; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    float d = fract(vUv.x * uN - uFlow);
    float dash = 1.0 - smoothstep(0.42, 0.5, abs(d - 0.5));
    float rim = 0.55 + 0.45 * abs(dot(normalize(vN), normalize(vV)));
    gl_FragColor = vec4(uCol * (0.75 + 0.5 * dash), uA * (0.18 + 0.6 * dash) * rim);
  }`;

export function buildMachine() {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  root.position.y = LIFT;
  const parts = {};
  const grp = (name, ex) => {
    const g = new THREE.Group();
    g.userData.ex = new V3(...ex);
    parts[name] = g;
    root.add(g);
    return g;
  };

  // ---------------------------------------------------------- frame, deck, vise
  const frame = grp('frame', [0, 0, -34]);
  mesh(new THREE.ExtrudeGeometry(frameShape(), {depth: 5.5, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 3, curveSegments: 24}), MAT.frame, frame, (o) => (o.position.z = -18));
  // the spring deck, a tab out of the plate under the back spring
  mesh(box(11.5, 5, 24.5, 0.8), MAT.frameEdge, frame, (o) => o.position.set(-35.75, 35.5, -5.75));
  // the yoke mount
  mesh(box(52, 6, 7, 0.8), MAT.frameEdge, frame, (o) => o.position.set(-3, -9.5, -15));
  // the tube vise: a block on the plate's foot, the clamp round the tube, the thumbscrew
  const vise = new THREE.Group();
  frame.add(vise);
  mesh(box(13, 13, 22, 1.2), MAT.frameEdge, vise, (o) => o.position.set(28, -16, -7));
  mesh(cylY(6.2, 6.2, 13, 40), MAT.frameEdge, vise, (o) => o.position.set(26, -16, NEEDLE_Z));
  mesh(cylY(1.8, 1.8, 12, 16), MAT.steel, vise, (o) => {
    o.rotation.z = Math.PI / 2;
    o.position.set(37, -16, NEEDLE_Z);
  });
  mesh(lathe([[0, 0], [5.4, 0], [5.8, 1.5], [5.4, 4.5], [0, 4.6]], 28), MAT.brass, vise, (o) => {
    o.rotation.z = -Math.PI / 2;
    o.position.set(41, -16, NEEDLE_Z);
  });
  // plate screws
  for (const [x, y] of [[-33, 35], [-20, -12.5], [10, -12.5], [30, -10]]) screwHead(frame, x, y, -18.6, 1.7, 'z');

  // ---------------------------------------------------------- yoke and coils
  const coils = grp('coils', [0, -16, 30]);
  mesh(box(50, 6, 23.5, 1), MAT.iron, coils, (o) => o.position.set(0, -3, -0.75));
  const coilF = buildCoil(M.coilX[1]);
  const coilR = buildCoil(M.coilX[0]);
  coils.add(coilF.g, coilR.g);
  // coil leads: rear coil to front coil over the top washers, front coil up to the binding post
  tube([[-11.5 + 6, 27.6, 9], [-2, 30.5, 11], [6, 27.8, 9.5]], 0.5, MAT.wire, coils, 24);
  const leadTop = [[15, 27.8, 9.5], [18.5, 33, 8.5], [17, 41.5, 6.5], [11, 46.5, -1], [7.1, 47, -1.6]];

  // ---------------------------------------------------------- the armature assembly, pivoting on the back spring
  const armEx = grp('armEx', [0, 26, 0]);
  const arm = new THREE.Group();
  arm.position.copy(P);
  armEx.add(arm);
  const inArm = new THREE.Group();
  inArm.position.copy(P).multiplyScalar(-1);
  arm.add(inArm);
  const armBar = mesh(box(54, ARM_TOP - ARM_BOT, 10, 0.9), MAT.steel, inArm, (o) => o.position.set(1, (ARM_TOP + ARM_BOT) / 2, 0));
  // the nipple and the rubber grommet on it
  mesh(cylY(1.6, 1.6, 6.5, 20), MAT.bright, inArm, (o) => {
    o.rotation.x = Math.PI / 2;
    o.position.set(M.nipple, 35.25, 7.4);
  });
  mesh(new THREE.TorusGeometry(2.0, 0.75, 12, 28), MAT.rubber, inArm, (o) => o.position.set(M.nipple, 35.25, 9.6));
  // back spring, the part screwed to the armature
  mesh(new THREE.BoxGeometry(8, 0.55, 9, 1, 1, 1), MAT.spring, inArm, (o) => o.position.set(-24, ARM_TOP + 0.28, 0));
  for (const x of [-25, -22]) screwHead(inArm, x, ARM_TOP + 0.55, 0, 1.5);
  // front spring: clamped behind, bent by the screw in front
  const fs = frontSpringGeo();
  const fsMesh = mesh(fs.g, MAT.spring, inArm);
  screwHead(inArm, -13, ARM_TOP + FS.t, 0, 1.6);
  const contact = mesh(cylY(1.7, 1.7, 0.7, 24), MAT.silver, inArm);
  // back spring, the fixed part on the deck and the short flexing span
  mesh(new THREE.BoxGeometry(10, 0.55, 9, 1, 1, 1), MAT.spring, frame, (o) => o.position.set(-35, ARM_TOP + 0.28, 0));
  for (const x of [-38, -33]) screwHead(frame, x, ARM_TOP + 0.55, 0, 1.6);
  const flex = new THREE.Group();
  flex.position.set(-30, ARM_TOP + 0.28, 0);
  armEx.add(flex);
  mesh(new THREE.BoxGeometry(4.4, 0.55, 9, 1, 1, 1), MAT.spring, flex, (o) => (o.position.x = 2.2));

  // ---------------------------------------------------------- binding post, contact screw, capacitor
  const post = grp('post', [0, 34, 8]);
  const blk = mesh(box(13, 11, 13, 1.4), MAT.insul, post, (o) => o.position.set(M.contactX, 51.5, -6));
  void blk;
  // the post itself: a brass sleeve through the block with rubber grommets
  mesh(cylY(3.2, 3.2, 16, 32), MAT.brass, post, (o) => o.position.set(M.contactX, 50.5, 0));
  for (const y of [43.6, 57.6]) mesh(new THREE.TorusGeometry(3.6, 1.05, 12, 32), MAT.rubber, post, (o) => {
    o.rotation.x = Math.PI / 2;
    o.position.set(M.contactX, y, 0);
  });
  mesh(box(3, 3.2, 14, 0.5), MAT.frameEdge, post, (o) => o.position.set(M.contactX, 52, -12));
  const screw = grp('screw', [0, 58, 8]);
  const SCREW_TIP = ARM_TOP + FS.t + restRise(FS.cx) + 0.7;
  {
    const prof = [[0, 0], [0.9, 0], [1.4, 0.4]];
    for (let k = 0; k <= 60; k++) prof.push([1.55 + 0.12 * Math.abs(Math.sin(k * 1.3)), 0.5 + k * 0.4]);
    prof.push([1.5, 25], [0, 25]);
    mesh(lathe(prof, 20), MAT.brass, screw, (o) => o.position.set(M.contactX, SCREW_TIP, 0));
    // the silver tip and the knurled lock nut and head
    mesh(cylY(1.2, 1.2, 0.6, 18), MAT.silver, screw, (o) => o.position.set(M.contactX, SCREW_TIP + 0.3, 0));
    const knurl = [];
    for (let k = 0; k <= 24; k++) knurl.push([4.2 + 0.25 * (k % 2), k * 0.25]);
    mesh(lathe([[0, 0], ...knurl, [0, 6]], 36), MAT.brass, screw, (o) => o.position.set(M.contactX, 62, 0));
    mesh(new THREE.CylinderGeometry(3.4, 3.4, 2.6, 6), MAT.steel, screw, (o) => o.position.set(M.contactX, 59.6, 0));
  }
  // the capacitor across the contact: post terminal to the frame
  const capG = new THREE.Group();
  post.add(capG);
  const CAP = [-5.5, 44, 7.6];
  mesh(cylY(2.7, 2.7, 7.5, 28), MAT.cap, capG, (o) => o.position.set(...CAP));
  mesh(cylY(2.72, 2.72, 1.2, 28), mat({color: '#c7d6ea', metalness: 0.2, roughness: 0.4}), capG, (o) => o.position.set(CAP[0], CAP[1] + 2.6, CAP[2]));
  tube([[CAP[0], 47.8, CAP[2]], [-3.5, 50, 5], [0.9, 50.5, 1.6]], 0.32, MAT.steel, capG, 16);
  tube([[CAP[0], 40.2, CAP[2]], [-7, 41.6, 2.5], [-7.5, 43, -7], [-7.5, 48.5, -12.4]], 0.32, MAT.steel, capG, 24);
  tube(leadTop, 0.5, MAT.wire, post, 24);

  // ---------------------------------------------------------- the needle bar, the needles
  const needle = grp('needle', [0, 0, 0]);
  const NB_TOP = 33.0;
  mesh(new THREE.TorusGeometry(2.1, 0.55, 12, 28), MAT.needle, needle, (o) => o.position.set(M.nipple, 35.25, NEEDLE_Z + 1.4));
  tube([[M.nipple, 33.6, NEEDLE_Z + 1.4], [M.nipple, 31.5, NEEDLE_Z + 0.4], [M.nipple, 29.5, NEEDLE_Z]], 0.55, MAT.needle, needle, 12);
  mesh(cylY(1.0, 1.0, NB_TOP + 72, 14), MAT.needle, needle, (o) => o.position.set(M.nipple, (NB_TOP - 72) / 2 - 3.5, NEEDLE_Z));
  // a 3-round-liner group soldered to the bar: three needles converging on the tip
  const NEED_TOP = -75.5;
  const tipY = TIP_Y - M.hang;
  mesh(cylY(1.3, 1.3, 4, 14), MAT.brass, needle, (o) => o.position.set(M.nipple, NEED_TOP + 1.5, NEEDLE_Z));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const top = new V3(M.nipple + Math.cos(a) * 0.55, NEED_TOP, NEEDLE_Z + Math.sin(a) * 0.55);
    const bot = new V3(M.nipple + Math.cos(a) * 0.22, tipY + 1.6, NEEDLE_Z + Math.sin(a) * 0.22);
    const len = top.distanceTo(bot);
    const n = mesh(new THREE.CylinderGeometry(0.2, 0.2, len, 10), MAT.needle, needle);
    n.position.copy(top).add(bot).multiplyScalar(0.5);
    n.quaternion.setFromUnitVectors(new V3(0, 1, 0), bot.clone().sub(top).normalize());
    const tip = mesh(new THREE.ConeGeometry(0.2, 1.6, 10), MAT.needle, needle);
    tip.position.set(bot.x + (M.nipple - bot.x) * 0.5, tipY + 0.8, bot.z + (NEEDLE_Z - bot.z) * 0.5);
    tip.rotation.x = Math.PI;
  }

  // ---------------------------------------------------------- tube and grip
  const tubeG = grp('tube', [0, -30, 0]);
  const ghostable = [];
  const gripProf = [[4.1, -8], [4.1, -28], [7.2, -30], [11.8, -32]];
  for (let k = 0; k <= 120; k++) {
    const y = -33 - (k / 120) * 52;
    gripProf.push([12.4 - 0.45 * (Math.abs(Math.sin((y / 1.6) * Math.PI)) > 0.82 ? 1 : 0), y]);
  }
  gripProf.push([11.8, -86], [7.5, -89], [6.0, -92], [2.6, TIP_Y + 0.6], [1.9, TIP_Y], [1.2, TIP_Y]);
  // a lathe of the outside, then the bore back up the inside so the cut shows a wall
  const back = [[1.2, TIP_Y + 1.5], [2.2, -92], [2.2, -8]];
  const gripMat = MAT.grip.clone();
  const grip = mesh(lathe([...gripProf, ...back, [4.1, -8]], 64), gripMat, tubeG, (o) => o.position.set(M.nipple, 0, NEEDLE_Z));
  gripMat.side = THREE.DoubleSide;
  ghostable.push(gripMat);

  // ---------------------------------------------------------- field lines
  const fieldMat = new THREE.ShaderMaterial({
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {uCol: {value: ACCENT.clone()}, uA: {value: 0}, uFlow: {value: 0}, uN: {value: 9}},
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const fieldMatArm = fieldMat.clone();
  fieldMatArm.uniforms = fieldMat.uniforms;
  const field = new THREE.Group();
  const fieldArm = new THREE.Group();
  coils.add(field);
  inArm.add(fieldArm);
  for (const [dz, dx] of [[-2.6, 1.4], [0, 0], [2.6, 1.4], [0, 2.8]]) {
    const xf = M.coilX[1] - dx * 0.6;
    const xr = M.coilX[0] + dx * 0.6;
    // up the front core, down the rear core, back through the yoke (fixed)
    const low = [[xr, 30, dz], [xr, 14, dz], [xr, 1, dz], [xr + 2, -3 + dx * 0.3, dz], [0, -3.2 + dx * 0.3, dz], [xf - 2, -3 + dx * 0.3, dz], [xf, 1, dz], [xf, 14, dz], [xf, 30, dz]];
    const c = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(low.map((p) => new V3(...p))), 80, 0.45, 8, false), fieldMat, field);
    c.castShadow = false;
    c.receiveShadow = false;
    c.renderOrder = 8;
    // across the gaps and along the armature (moves with it)
    const high = [[xf, 30, dz], [xf + 1.5, ARM_BOT + 1.5, dz], [xf - 3, ARM_BOT + 2.6 - dx * 0.2, dz], [0, ARM_BOT + 2.8 - dx * 0.2, dz], [xr + 3, ARM_BOT + 2.6 - dx * 0.2, dz], [xr - 1.5, ARM_BOT + 1.5, dz], [xr, 30, dz]];
    const c2 = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(high.map((p) => new V3(...p))), 60, 0.45, 8, false), fieldMatArm, fieldArm);
    c2.castShadow = false;
    c2.receiveShadow = false;
    c2.renderOrder = 8;
    // the fringe bulging out at the gap
    for (const s of [-1, 1]) {
      const x0 = M.coilX[1];
      const fr = [[x0 + s * 4.6, CORE_TOP - 0.5, dz], [x0 + s * (7.5 + dx), CORE_TOP + 1.6, dz], [x0 + s * 4.8, ARM_BOT + 0.4, dz]];
      const f = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fr.map((p) => new V3(...p))), 16, 0.3, 6, false), fieldMat, field);
      f.castShadow = false;
      f.renderOrder = 8;
    }
  }
  field.visible = false;
  fieldArm.visible = false;

  // ---------------------------------------------------------- the spark at the contact
  const sparkMat = new THREE.SpriteMaterial({color: '#ffd9a8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,214,170,0.85)');
    gr.addColorStop(0.5, 'rgba(232,69,44,0.25)');
    gr.addColorStop(1, 'rgba(232,69,44,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    sparkMat.map = new THREE.CanvasTexture(c);
  }
  const spark = new THREE.Sprite(sparkMat);
  spark.scale.setScalar(7);
  spark.renderOrder = 9;
  root.add(spark);

  // ---------------------------------------------------------- posing
  const pos = fs.g.attributes.position;
  const tmp = new V3();
  /** world position (metres) of a point given in machine millimetres, through the armature if onArm */
  const world = (x, y, z, onArm = false) => {
    tmp.set(x, y, z);
    if (onArm) inArm.localToWorld(tmp);
    else root.localToWorld(tmp);
    return tmp.clone();
  };
  let lastLift = -1;
  const update = (st) => {
    const y = st.y ?? 0;
    const th = armAngle(y);
    arm.rotation.z = -th;
    flex.rotation.z = -th * 0.5;
    // the front spring: pressed up by the screw while the contact is closed, free once it opens
    const lift = Math.min(LV.contact * y, M.preload);
    if (Math.abs(lift - lastLift) > 1e-4) {
      lastLift = lift;
      for (let k = 0; k < pos.count; k++) {
        const x = fs.base[k * 3];
        pos.array[k * 3 + 1] = fs.base[k * 3 + 1] + restRise(x) + lift * deflect(x);
      }
      pos.needsUpdate = true;
      fs.g.computeVertexNormals();
    }
    contact.position.set(FS.cx, ARM_TOP + FS.t + restRise(FS.cx) + lift + 0.35, 0);
    // the needle bar rides the nipple
    const ex = st.explode ?? 0;
    for (const k in parts) parts[k].position.copy(parts[k].userData.ex).multiplyScalar(ex);
    const ang = -th;
    const rx = M.nipple - P.x;
    const ry = 35.25 - P.y;
    const nx = P.x + rx * Math.cos(ang) - ry * Math.sin(ang);
    const ny = P.y + rx * Math.sin(ang) + ry * Math.cos(ang);
    needle.position.set(nx - M.nipple, ny - 35.25, 0).add(parts.armEx.position);
    // current: the windings warm to the accent, the field flows
    const ik = Math.min(1, Math.abs(st.i ?? 0) / Math.max(0.2, st.iPeak ?? 1.1));
    const glow = ACCENT.clone().multiplyScalar(0.55 * ik * (st.current ?? 1));
    MAT.copper.emissive.copy(glow);
    MAT.windGhost.emissive.copy(glow);
    const ghostK = Math.max(st.field ?? 0, st.xray ?? 0);
    for (const c of [coilF, coilR]) {
      c.wind.material = ghostK > 0.01 ? MAT.windGhost : MAT.copper;
      c.wind.castShadow = ghostK < 0.5;
    }
    MAT.windGhost.opacity = 1 - 0.82 * ghostK;
    MAT.windGhost.depthWrite = ghostK < 0.5;
    gripMat.transparent = (st.xray ?? 0) > 0.01;
    gripMat.opacity = 1 - 0.8 * (st.xray ?? 0);
    gripMat.depthWrite = (st.xray ?? 0) < 0.5;
    grip.castShadow = (st.xray ?? 0) < 0.5;
    const fk = (st.field ?? 0) * Math.min(1, ik * 1.4);
    field.visible = fieldArm.visible = (st.field ?? 0) > 0.01;
    fieldMat.uniforms.uA.value = fk;
    fieldMat.uniforms.uFlow.value = st.flow ?? 0;
    // the spark: the instant the contact parts, the capacitor's charge jumps
    const gap = Math.max(0, LV.contact * y - M.preload);
    const sk = (st.vc ?? 0) > 0.5 && gap < 0.35 ? Math.min(1, (st.vc ?? 0) / 9) * (1 - gap / 0.35) : 0;
    sparkMat.opacity = sk * (st.sparkOn ?? 1);
    spark.position.set(FS.cx, SCREW_TIP + 0.1, 0);
    MAT.silver.emissive.copy(ACCENT).multiplyScalar(0.8 * sk);
    spark.position.add(parts.armEx.position);
  };
  update({y: 0});
  return {root, parts, update, world, armBar, ARM_TOP, SCREW_TIP};
}
