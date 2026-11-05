// The film's operator script and its clock, without three.js so node can read the same numbers for the score.
//
// Two clocks run here. Film time t is what the viewer watches. Machine time is film time times the playback rate
// (1 = real time, 1/120 = slow motion). The machine's phase is the integral of its own frequency over machine time,
// so a change of voltage or of rate never jumps the armature: phi(t) = ∫ f(V, skin) · rate dt.
import {sample, simulate, VOLTS} from './kin.js';

export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: 1.6, rate: 1 / 120},
  {t: 3.2, view: 'coils'},
  {t: 3.8, display: 'field'},
  {t: 6.6, display: 'field'},
  {t: 7.0, view: 'contact'},
  {t: 10.2, view: 'needle'},
  {t: 10.8, display: 'skin'},
  {t: 13.6, volt: 9.5},
  {t: 15.4, volt: 7.5},
  {t: 16.6, view: 'hero'},
  {t: 17.0, display: 'labels'},
  {t: 19.0, display: 'exploded'},
  {t: 21.0, display: 'exploded'},
  {t: 21.4, display: 'labels'},
  {t: 21.8, rate: 1},
];
export const DURATION = 24.6;
export const V0 = 7.5;
export const RATE = [1 / 240, 1];
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the steady cycles, simulated on first use
const CACHE = new Map();
export function cycleAt(V, skin) {
  const key = `${V}|${skin ? 1 : 0}`;
  if (!CACHE.has(key)) CACHE.set(key, simulate(V, skin));
  return CACHE.get(key);
}
/** the machine at voltage V (blended between the tabulated volts) and skin load 0..1, at phase u */
export function machineAt(V, skinK, u) {
  const v = Math.min(VOLTS[VOLTS.length - 1], Math.max(VOLTS[0], V));
  let j = 0;
  while (j < VOLTS.length - 2 && VOLTS[j + 1] <= v) j++;
  const kv = (v - VOLTS[j]) / (VOLTS[j + 1] - VOLTS[j]);
  const parts = [];
  for (const [skin, ws] of [[false, 1 - skinK], [true, skinK]]) {
    if (ws < 1e-4) continue;
    for (const [jj, wv] of [[j, 1 - kv], [j + 1, kv]]) if (wv > 1e-4) parts.push([cycleAt(VOLTS[jj], skin), ws * wv]);
  }
  const o = {y: 0, v: 0, i: 0, vc: 0, closed: 0, f: 0, stroke: 0, duty: 0, iPeak: 0, iRms: 0, depthMax: 0};
  for (const [c, w] of parts) {
    const s = sample(c, u);
    o.y += s.y * w;
    o.v += s.v * w;
    o.i += s.i * w;
    o.vc += s.vc * w;
    o.closed += s.closed * w;
    o.f += c.f * w;
    o.stroke += c.stroke * w;
    o.duty += c.duty * w;
    o.iPeak += c.iPeak * w;
    o.iRms += c.iRms * w;
    o.depthMax += c.depth * w;
  }
  o.closed = o.closed > 0.5 ? 1 : 0;
  o.parts = parts;
  return o;
}

// ------------------------------------------------------------ the script as functions of film time
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const displayOn = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).length % 2;
export const easedDisplay = (key, t, dur = 0.7) => {
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return displayOn(key, t) ? k : 1 - k;
};
const keyedBy = (field, v0, dur, t, log = false) => {
  const ev = SCRIPT.filter((e) => e[field] !== undefined);
  let v = v0;
  for (const e of ev) {
    if (e.t > t) break;
    const k = ss(e.t, e.t + dur, t);
    v = log ? Math.exp(Math.log(v) + (Math.log(e[field]) - Math.log(v)) * k) : v + (e[field] - v) * k;
  }
  return v;
};
export const rateAt = (t) => keyedBy('rate', 1, 1.2, t, true);
export const voltAt = (t) => keyedBy('volt', V0, 0.9, t);
export const skinAt = (t) => easedDisplay('skin', t, 0.9);
export const viewAt = (t) => {
  const e = SCRIPT.filter((x) => x.view && x.t <= t).pop();
  return [e.t, e.view];
};

// the phase, integrated once at load
const DT = 1 / 600;
const PHI = new Float64Array(Math.ceil((DURATION + 1) / DT) + 2);
let built = false;
function buildPhase() {
  for (let n = 1; n < PHI.length; n++) {
    const t = (n - 0.5) * DT;
    const m = machineAt(voltAt(t), skinAt(t) > 0.5 ? 1 : 0, 0);
    PHI[n] = PHI[n - 1] + m.f * rateAt(t) * DT;
  }
  built = true;
}
export function phaseAt(t) {
  if (!built) buildPhase();
  const x = Math.max(0, Math.min(PHI.length - 2, t / DT));
  const n = Math.floor(x);
  return PHI[n] + (PHI[n + 1] - PHI[n]) * (x - n);
}
/** cycles per second of film: above ~7 the eye sees a buzz, so the frame shows a scattered phase instead of a crawl */
export const BLUR_CPS = 7;
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** the phase a frame shows: the true one in slow motion, a frame-hashed one when the machine buzzes */
export function shownPhase(phi, cps, frameIndex) {
  const b = ss(BLUR_CPS * 0.6, BLUR_CPS, cps);
  if (b <= 0) return phi % 1;
  if (b >= 1) return hash(frameIndex);
  return hash(frameIndex) < b ? hash(frameIndex + 0.5) : phi % 1;
}

/** everything the score needs: contact closes and needle strikes in slow motion, buzz spans at speed */
export function timeline() {
  if (!built) buildPhase();
  const closes = [];
  const strikes = [];
  const buzz = [];
  let inBuzz = null;
  const step = 1 / 600;
  let prev = 0;
  for (let t = step; t <= DURATION; t += step) {
    const phi = phaseAt(t);
    const m = machineAt(voltAt(t), skinAt(t), 0);
    const cps = m.f * rateAt(t);
    const slow = cps < BLUR_CPS;
    if (slow && Math.floor(phi) > Math.floor(prev)) closes.push(+t.toFixed(3));
    // the strike: the bottom of the stroke, at the phase where y peaks
    const c = m.parts[0][0];
    let un = 0;
    for (let n = 1; n < c.y.length; n++) if (c.y[n] > c.y[un]) un = n;
    const us = un / c.y.length;
    if (slow && Math.floor(phi - us) > Math.floor(prev - us)) strikes.push([+t.toFixed(3), +skinAt(t).toFixed(2), +voltAt(t).toFixed(2)]);
    if (!slow && !inBuzz) inBuzz = [t, m.f];
    if (slow && inBuzz) {
      buzz.push([+inBuzz[0].toFixed(3), +t.toFixed(3), +inBuzz[1].toFixed(1)]);
      inBuzz = null;
    }
    prev = phi;
  }
  if (inBuzz) buzz.push([+inBuzz[0].toFixed(3), DURATION, +inBuzz[1].toFixed(1)]);
  const clicks = SCRIPT.filter((e) => e.t > 0).map((e) => e.t);
  // the machine's cycles per film second, every 10 ms: the score integrates it to place every contact snap
  const cps = [];
  for (let t = 0; t <= DURATION; t += 0.01) cps.push(+(machineAt(voltAt(t), skinAt(t), 0).f * rateAt(t)).toFixed(3));
  const volts = [];
  for (let t = 0; t <= DURATION; t += 0.1) volts.push(+voltAt(t).toFixed(2));
  return {duration: DURATION, clicks, closes, strikes, buzz, cps, cpsStep: 0.01, volts, voltStep: 0.1, rateChanges: SCRIPT.filter((e) => e.rate).map((e) => [e.t, e.rate])};
}
