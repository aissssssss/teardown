// CM-8 coil tattoo machine, the film: the machine (machine.js) in the studio (stage.js) under the console
// (console.js). It opens buzzing at full speed, slows to 1/120 so each make-and-break cycle takes a second, walks the
// coils with the field on, the contact, the needle in a block of skin, turns the supply up until the armature bottoms
// on the cores, labels the parts, explodes them, and speeds back up to a buzz. A pure function of t.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {createConsole, DISPLAY} from './console.js';
import {contactGap, depthOf, needleOut} from './kin.js';
import {NEEDLE_Z} from './machine.js';
import {createStage} from './stage.js';
import {BLUR_CPS, displayOn, DURATION, easedDisplay, machineAt, phaseAt, RATE, rateAt, SCRIPT, shownPhase, skinAt, ss, viewAt, voltAt} from './timing.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'coil machine', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;

// ------------------------------------------------------------ views (world units, degrees), u = seconds on the view
export const VIEW_FN = {
  hero: (u) => ({tx: 0.03, ty: 1.02, tz: 0, az: 32 + 2 * u, el: 14, d: 5.6, sx: 0, sy: 18}),
  side: (u) => ({tx: 0.0, ty: 1.02, tz: 0, az: 2 + 1 * u, el: 4, d: 6.2, sx: 0, sy: 14}),
  coils: (u) => ({tx: 0.0, ty: 1.46, tz: 0.02, az: 22 + 2 * u, el: 10, d: 2.7, sx: 0, sy: 16}),
  contact: (u) => ({tx: 0.05, ty: 1.6, tz: 0.0, az: 26 + 2 * u, el: 10, d: 0.98, sx: 0, sy: -6}),
  needle: (u) => ({tx: 0.258, ty: 0.128, tz: 0.07, az: 16 + 1.2 * u, el: 4, d: 0.3, sx: 0, sy: -40}),
  top: (u) => ({tx: 0.0, ty: 1.05, tz: 0.0, az: 40 + 2 * u, el: 48, d: 6.0, sx: 0, sy: 10}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  // distance blends in log space so a long dolly does not crawl at one end
  o.d = Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k);
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  // a long move pulls back so the camera never threads through the machine
  const move = Math.hypot(b.tx - a.tx, b.ty - a.ty, b.tz - a.tz) / Math.max(a.d, b.d);
  o.d *= 1 + (0.25 * swing + 1.4 * Math.min(1, move)) * Math.sin(Math.PI * k);
  return o;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const camAt = (t, orbit = 0, explode = 0) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.6, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 14 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  // the exploded set is taller: back off and look a little higher
  if (explode > 0) o = {...o, d: o.d * (1 + 0.16 * explode), ty: o.ty + 0.26 * explode};
  return o;
};
export const displayAt = (t) => Object.fromEntries(DISPLAY.map((k) => [k, displayOn(k, t)]));
export const rateK = (r) => Math.log(r / RATE[0]) / Math.log(RATE[1] / RATE[0]);

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 470], [760, 420], [940, 520], [820, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    let spot = ui.spots[e.view || e.display];
    if (e.rate) spot = [ui.SP.x + rateK(e.rate) * ui.SP.w, 824];
    if (e.volt) spot = ui.voltKnob(e.volt);
    // a drag starts at the knob's old place
    let from = null;
    if (e.rate) from = [ui.SP.x + rateK(rateAt(e.t - 0.01)) * ui.SP.w, 824];
    if (e.volt) from = ui.voltKnob(voltAt(e.t - 0.01));
    return {t: e.t, spot, from};
  });
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    if (e.from) WP.push([e.t - 0.3, ...e.from], [e.t - 0.05, ...e.from], [e.t + 0.95, ...e.spot]);
    else WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + (e.from ? 2.0 : 1.4), ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      const t2 = e.from ? e.t + 0.95 : e.t + 0.09;
      if (t >= e.t - 0.07 && t < t2) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.from ?? e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ the labels: parts in machine millimetres
const PARTS = [
  {name: 'FRONT COIL', sub: '8 WRAPS · 9.5 MM IRON CORE', at: () => [11.5, 18, 11.2]},
  {name: 'REAR COIL', sub: 'IN SERIES WITH THE FRONT', at: () => [-11.5, 8, 11.2]},
  {name: 'YOKE', sub: 'CLOSES THE MAGNETIC LOOP', at: () => [-18, -3, 11]},
  {name: 'ARMATURE BAR', sub: 'PULLED DOWN BY THE CORES', at: () => [16, 34, 5], arm: true},
  {name: 'BACK SPRING', sub: 'THE HINGE · THROWS IT BACK', at: () => [-30, 38.6, 4.5]},
  {name: 'FRONT SPRING', sub: 'CARRIES THE SILVER CONTACT', at: () => [-6, 38.8, 3.7], arm: true},
  {name: 'CONTACT SCREW', sub: 'SETS THE GAP · MAKE / BREAK', at: () => [4, 46, 3.2]},
  {name: 'CAPACITOR', sub: '47 µF · EATS THE SPARK', at: () => [-5.5, 45, 10.3]},
  {name: 'FRAME', sub: 'CAST SIDE PLATE · CARRIES CURRENT', at: () => [-36, 18, -12]},
  {name: 'NEEDLE BAR', sub: 'RIDES THE NIPPLE', at: (s) => [26, 10 - s.y, NEEDLE_Z + 1]},
  {name: 'TUBE VISE', sub: 'CLAMPS THE GRIP', at: () => [41, -16, NEEDLE_Z]},
  {name: 'GRIP & TUBE', sub: '25 MM KNURLED STEEL', at: () => [38.4, -62, NEEDLE_Z]},
];
export function makeLabels(st) {
  return (s, o) => {
    if (o < 0.02) return [];
    const ex = s.explode ?? 0;
    const pts = PARTS.map((p) => {
      const [x, y, z] = p.at(s);
      let q = [x, y, z];
      // exploded: follow the part's group
      const g = {FRAME: 'frame', 'FRONT COIL': 'coils', 'REAR COIL': 'coils', YOKE: 'coils', 'CONTACT SCREW': 'screw', CAPACITOR: 'post', 'TUBE VISE': 'frame', 'GRIP & TUBE': 'tube', 'ARMATURE BAR': 'armEx', 'FRONT SPRING': 'armEx', 'NEEDLE BAR': 'armEx', 'BACK SPRING': 'frame'}[p.name];
      if (g && ex > 0 && !p.arm) {
        const e = st.mc.parts[g].userData.ex;
        q = [x + e.x * ex, y + e.y * ex, z + e.z * ex];
      }
      return {p, at: st.project(q[0], q[1], q[2], !!p.arm)};
    }).filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1290 && x.at[1] > 130 && x.at[1] < 745);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 150;
      for (const c of col) {
        y = Math.max(y, Math.min(710, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o});
        y += 36;
      }
    };
    stack(L, 340, 176);
    stack(R, 1104, 176);
    return out;
  };
}

// ------------------------------------------------------------ the machine at a moment
/** everything one frame needs, from the clock (phi, rate), the supply, the skin load and the displays */
export function machineFrame({phi, rate, volt, skinK, frameIndex, inkN}) {
  const probe = machineAt(volt, skinK, 0);
  const cps = probe.f * rate;
  const buzzing = cps >= BLUR_CPS;
  const u = shownPhase(phi, cps, frameIndex);
  const m = machineAt(volt, skinK, u);
  const y = m.y;
  const skinOn = skinK > 0.5;
  const out = needleOut(y);
  const depth = skinOn ? depthOf(y, true) : 0;
  let state;
  let phase;
  if (buzzing) {
    state = ['Running', `${Math.round(m.f)} STROKES A SECOND`, m.closed];
    phase = `${Math.round(m.f)} MAKE-AND-BREAK CYCLES EVERY SECOND`;
  } else if (m.closed && m.v < 0.02 && y < 0.2) {
    state = ['Contact closed', 'CURRENT BUILDS IN THE COILS', 1];
    phase = 'CONTACT CLOSED · CURRENT BUILDS IN THE COILS';
  } else if (m.closed) {
    state = ['Cores pull', 'ARMATURE DRIVES DOWN', 1];
    phase = 'THE CORES PULL THE ARMATURE DOWN';
  } else if (m.v > 0) {
    state = ['Contact open', depth > 0 ? 'NEEDLE IN THE SKIN' : 'ARMATURE COASTS · NEEDLE OUT', 0];
    phase = depth > 0 ? 'CONTACT OPEN · THE NEEDLE PUNCHES THE SKIN' : 'CONTACT OPEN · THE ARMATURE COASTS, NEEDLE OUT';
  } else {
    state = ['Springs return', 'ARMATURE THROWN BACK UP', 0];
    phase = 'THE SPRINGS THROW THE ARMATURE BACK UP';
  }
  if (!buzzing && m.stroke > 4.25 && y > 4.2) phase = 'TOO MUCH VOLTAGE · THE ARMATURE HITS THE CORES';
  const ink = skinOn ? 1 - Math.exp(-Math.max(0, inkN) / 9) : 0;
  return {m, u, y, buzzing, state, phase, gap: contactGap(y), out, depth, ink, sp: buzzing ? u : phi};
}

export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const mf = s.mf;
    const at = (uu) => machineAt(s.volt, s.skinK, uu);
    ui.update({
      m: mf.m,
      state: mf.state,
      phase: mf.phase,
      phi: mf.sp,
      at,
      gap: mf.gap,
      out: mf.out,
      depth: mf.depth,
      skin: s.skinK,
      volt: s.volt,
      flow: s.flow,
      rate: s.rate,
      rateK: rateK(s.rate),
      view: s.view,
      display: s.display,
      paused: s.paused ?? false,
      callouts: labels({y: mf.y, explode: s.explode}, s.labels),
      cursor: s.cursor,
    });
  };
}
/** machine state for the stage */
export const stageState = (mf, d) => ({
  y: mf.y,
  i: mf.m.i,
  vc: mf.m.vc,
  iPeak: mf.m.iPeak,
  current: 1,
  field: d.field,
  xray: d.xray,
  explode: d.explode,
  flow: d.flow,
  skin: d.skin,
  ink: mf.ink,
  depth: mf.depth,
  sparkOn: mf.buzzing ? 0.5 : 1,
});

export function makeFilm() {
  return async ({cfg, canvas, capture}) => {
    const st = createStage({canvas});
    // a render farm without a GPU can trade multisampling, shadow size and AO for time: --config {"quality": {...}}
    if (cfg?.quality) st.setQuality(cfg.quality);
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    const skinT = SCRIPT.find((e) => e.display === 'skin').t + 0.9;
    const phiSkin = phaseAt(skinT);
    window.TM = st;
    return {
      resize,
      render(t) {
        const phi = phaseAt(t);
        const rate = rateAt(t);
        const volt = voltAt(t);
        const skinK = skinAt(t);
        const mf = machineFrame({phi, rate, volt, skinK, frameIndex: Math.round(t * 60), inkN: phi - phiSkin});
        const disp = displayAt(t);
        const explode = easedDisplay('exploded', t, 0.9);
        const cam = camAt(t, disp.orbit, explode);
        const flow = t * 1.4;
        st.frame(stageState(mf, {field: easedDisplay('field', t), xray: easedDisplay('xray', t), explode, flow, skin: skinK}), {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const [vt0, view] = viewAt(t);
        frame({mf, volt, skinK, flow, rate, view, display: disp, explode, labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 0.4, vt0 + 1.0, t), cursor: cursorAt(t)});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
void THREE;
