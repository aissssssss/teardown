// The coil machine's physics, in SI units and millimetres for the geometry. No three.js in here.
//
// The circuit: supply (+) → frame → back spring → armature → front spring → silver contact → contact screw →
// binding post → coils → supply (−). A capacitor sits across the contact. With the contact closed, current builds in
// the coils (L/R), the cores pull the armature down, the front spring lifts off the screw and the circuit opens; the
// coil current rings out through the capacitor while the springs throw the armature back up until the contact closes
// again. The machine finds its own rhythm: nothing here is a keyframe. One input drives everything on screen: the
// armature's displacement y at the needle-bar nipple, read from the steady cycle at phase u.
//
// The armature pivots on the back spring's flex line, P. Every downstream number (the core gap, the contact gap, the
// needle's travel past the tube tip, its depth in the skin) is a lever off that one rotation.

export const M = {
  // geometry, mm, machine frame: x toward the needle, y up, z out of the frame plate
  pivot: [-28, 38.5], // back spring flex line
  nipple: 26, // x of the needle-bar nipple on the armature
  coilX: [-11.5, 11.5], // the two coil axes
  contactX: 4, // x of the silver contact under the contact screw
  gap0: 3.3, // front core to armature at rest, mm
  preload: 0.85, // front spring pressed into the screw at rest, mm at the contact
  hang: 0.5, // needle out of the tube tip at rest, mm
  skinGap: 2.2, // tube tip to the skin surface, mm
  // mechanics
  mass: 0.0058, // kg: armature, nipple, upper needle bar, effective at the nipple
  k: 1200, // N/m: back spring + front spring, at the nipple
  f0: 0.6, // N: spring preload holding the contact closed at rest
  c: 0.7, // N·s/m: air and spring hysteresis
  // electrics
  R: 6.6, // ohm, both coils (8 wraps of 23 AWG)
  L: 0.0062, // H, both coils, armature down
  C: 47e-6, // F, across the contact
  Km: 5e-5, // N·m²/A²: core pull constant, F = Km i² / (gap + fringe)²
  fringe: 0.0009, // m
  // skin, when the tube is on it
  kSkin: 900, // N/m
  cSkin: 1.6, // N·s/m
};
const D = (x) => x - M.pivot[0];
/** lever ratios from the nipple's travel to a point on the armature at x */
export const lever = (x) => D(x) / D(M.nipple);
export const LV = {core: lever(M.coilX[1]), contact: lever(M.contactX), rearCore: lever(M.coilX[0])};
/** armature angle (rad, nose down positive) for nipple travel y mm */
export const armAngle = (y) => Math.atan2(y, D(M.nipple));
export const coreGap = (y) => M.gap0 - LV.core * y;
export const contactGap = (y) => Math.max(0, LV.contact * y - M.preload);
export const needleOut = (y) => M.hang + y; // mm past the tube tip
export const depthOf = (y, skin) => (skin ? Math.max(0, needleOut(y) - M.skinGap) : 0);

/**
 * Integrates the machine at supply voltage V until its cycle settles, and returns one steady period, sampled N times,
 * starting at the instant the contact closes. Arrays: y (mm), v (m/s), i (A), vc (V across the contact), closed (0/1).
 */
export function simulate(V, skin = false, N = 400) {
  const dt = 2e-7;
  let y = 0; // m
  let v = 0;
  let i = 0;
  let q = 0; // capacitor charge
  let t = 0;
  const closes = [];
  let wasClosed = true;
  const rec = [];
  const T_END = 0.24;
  const yMax = (M.gap0 - 0.12) / LV.core / 1000;
  const sStart = (M.skinGap - M.hang) / 1000;
  let rk = 0;
  while (t < T_END) {
    const ymm = y * 1000;
    const closed = LV.contact * ymm <= M.preload;
    const gap = Math.max(0.05, coreGap(ymm)) / 1000;
    const F = (M.Km * i * i) / ((gap + M.fringe) * (gap + M.fringe));
    let a = (F - M.f0 - M.k * y - M.c * v) / M.mass;
    if (skin && y > sStart) a -= (M.kSkin * (y - sStart) + M.cSkin * v) / M.mass;
    // the coils' inductance rises as the gap closes
    const L = M.L * (0.72 + 0.28 * (M.gap0 / 1000 - gap) / (M.gap0 / 1000));
    if (closed) {
      q = 0;
      i += ((V - M.R * i) / L) * dt;
    } else {
      i += ((V - M.R * i - q / M.C) / L) * dt;
      q += i * dt;
    }
    v += a * dt;
    y += v * dt;
    if (y < 0) {
      // the front spring lands on the screw: the stop, with a little bounce
      y = 0;
      v = v < 0 ? -0.08 * v : v;
    }
    if (y > yMax) {
      y = yMax;
      v = Math.min(0, -0.2 * v);
    }
    if (closed && !wasClosed) closes.push(t);
    wasClosed = closed;
    t += dt;
    if (t > T_END - 0.06 && rk++ % 10 === 0) rec.push([t, y * 1000, v, i, closed ? 0 : q / M.C, closed ? 1 : 0]);
  }
  const late = closes.filter((c) => c > T_END - 0.06);
  if (late.length < 3) return {V, f: 0, period: 0, stalled: true};
  const t0 = late[late.length - 3];
  const t1 = late[late.length - 2];
  const period = t1 - t0;
  const out = {V, skin, period, f: 1 / period, y: new Float32Array(N), v: new Float32Array(N), i: new Float32Array(N), vc: new Float32Array(N), closed: new Uint8Array(N)};
  let j = 0;
  for (let n = 0; n < N; n++) {
    const tt = t0 + (n / N) * period;
    while (j < rec.length - 2 && rec[j + 1][0] < tt) j++;
    const r = rec[j];
    out.y[n] = r[1];
    out.v[n] = r[2];
    out.i[n] = r[3];
    out.vc[n] = r[4];
    out.closed[n] = r[5];
  }
  let s = 0;
  let mx = 0;
  let im = 0;
  let irms = 0;
  for (let n = 0; n < N; n++) {
    s += out.closed[n];
    mx = Math.max(mx, out.y[n]);
    im = Math.max(im, Math.abs(out.i[n]));
    irms += out.i[n] * out.i[n];
  }
  out.duty = s / N;
  out.stroke = mx;
  out.iPeak = im;
  out.iRms = Math.sqrt(irms / N);
  out.depth = depthOf(mx, skin);
  return out;
}

/** the steady cycles for a voltage range, tabulated once */
export const VOLTS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
export function tabulate(skin) {
  return VOLTS.map((V) => simulate(V, skin));
}
/** the state at phase u (0..1, 0 = contact closes) of a cycle, linearly interpolated */
export function sample(cyc, u) {
  const N = cyc.y.length;
  const x = (((u % 1) + 1) % 1) * N;
  const n = Math.floor(x);
  const k = x - n;
  const n1 = (n + 1) % N;
  return {
    y: cyc.y[n] + (cyc.y[n1] - cyc.y[n]) * k,
    v: cyc.v[n] + (cyc.v[n1] - cyc.v[n]) * k,
    i: cyc.i[n] + (cyc.i[n1] - cyc.i[n]) * k,
    vc: cyc.vc[n] + (cyc.vc[n1] - cyc.vc[n]) * k,
    closed: cyc.closed[n],
  };
}
