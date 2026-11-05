// The coil machine's console, laid out at 1600 x 900: the badge and the title, the cycle state with a live circuit,
// the scope (stroke and coil current over the last cycles), the readouts, the power, the views, the display toggles,
// the cycle bar with the time scale, floor notes and the labels with leaders into the machine.
// update(s) redraws every live part from the frame's state.
import {M} from './kin.js';

export const C = {ink: '#24221f', mute: '#958c80', faint: '#d6cfc4', line: '#e6e0d6', panel: 'rgba(251,249,246,.95)', or: '#e8452c', blue: '#3a6fb0', green: '#2f9d6a'};
export const VIEWS = ['hero', 'side', 'coils', 'contact', 'needle', 'top'];
export const VIEW_LABEL = {hero: 'HERO', side: 'SIDE', coils: 'COILS', contact: 'CONTACT', needle: 'NEEDLE', top: 'TOP ¾'};
export const DISPLAY = ['labels', 'field', 'xray', 'skin', 'exploded', 'orbit'];
export const DISPLAY_LABEL = {labels: 'LABELS', field: 'FIELD', xray: 'X-RAY', skin: 'SKIN', exploded: 'EXPLODED', orbit: 'ORBIT'};
export const VOLT = [5, 10];
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(90,70,50,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:21px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fffdfa;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const f1 = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:24px" width="44" height="44" viewBox="0 0 44 44"><g fill="none" stroke="#fff" stroke-width="2.4"><rect x="6" y="14" width="9" height="16" rx="2"/><rect x="18" y="14" width="9" height="16" rx="2"/><path d="M3 10h30l4 4M33 10v28"/></g><path d="M33 38l-2 5h4z" fill="#fff"/></svg>`);
  add(`<div class="mo" style="position:absolute;left:82px;top:35px;color:#fff;font-size:15px;font-weight:600;letter-spacing:3px">CM-8</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:22px;letter-spacing:2.4px">ELECTROMAGNETIC TOOLS</div>`);
  add(`<div style="position:absolute;left:181px;top:37px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Coil Tattoo Machine <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:77px;font-size:11.2px;letter-spacing:2.2px;color:#665d52">DUAL 8-WRAP LINER / MAKE-AND-BREAK OSCILLATOR</div>`);
  add(`<div class="sm" style="position:absolute;left:1087px;top:49px;letter-spacing:2.6px;font-size:9.6px">NO MOTOR · NO CAM · ONE CONTACT</div>`);
  add(`<div class="mo" style="position:absolute;left:1352px;top:47px;color:${C.or};font-size:12px;letter-spacing:-1px">//////</div>`);
  const hzBig = add(`<div style="position:absolute;left:1408px;top:34px;color:${C.or};font-size:39px;font-weight:700;letter-spacing:-.8px;line-height:1">115</div>`);
  add(`<div style="position:absolute;left:1500px;top:33px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1516px;top:34px;line-height:14px;letter-spacing:2.2px">MAKE<br>BREAK<br>REPEAT</div>`);
  {
    let h = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) h += `<path d="M${c * 25.5 + 4} ${r * 25.5}v8M${c * 25.5} ${r * 25.5 + 4}h8" stroke="${C.or}" stroke-width="1.1" opacity=".7"/>`;
    add(`<svg style="position:absolute;left:808px;top:80px" width="300" height="64">${h}</svg>`);
  }

  // ------------------------------------------------------------ 01 cycle state: the chip and the live circuit
  panel(28, 126, 282, 254, 'CYCLE STATE', '01');
  const chip = add(`<div style="position:absolute;left:42px;top:166px;width:13px;height:24px;border-radius:2px"></div>`);
  const stTitle = add(`<div style="position:absolute;left:66px;top:164px;font-size:15px;font-weight:600"></div>`);
  const stSub = add(`<div class="sm" style="position:absolute;left:67px;top:183px"></div>`);
  add(`<div style="position:absolute;left:42px;top:202px;width:254px;height:1px;background:${C.line}"></div>`);
  const sch = add(`<svg style="position:absolute;left:42px;top:212px" width="254" height="160"></svg>`);

  // ------------------------------------------------------------ 02 scope
  panel(28, 394, 282, 232, 'SCOPE', '02');
  add(`<div class="sm" style="position:absolute;left:120px;top:409px;display:flex;gap:12px"><span><b style="color:${C.ink}">—</b> STROKE</span><span><b style="color:${C.or}">—</b> CURRENT</span></div>`);
  const scope = add(`<svg style="position:absolute;left:42px;top:434px" width="254" height="128"></svg>`);
  add(`<div style="position:absolute;left:42px;top:572px;width:254px;height:1px;background:${C.line}"></div>`);
  const scopeVals = ['FREQUENCY', 'DUTY', 'PEAK'].map((n, i) => {
    const x = 42 + i * 86;
    if (i) add(`<div style="position:absolute;left:${x - 8}px;top:582px;width:1px;height:34px;background:${C.line}"></div>`);
    const v = add(`<div style="position:absolute;left:${x}px;top:582px;font-size:17px;font-weight:700"></div>`);
    add(`<div class="sm" style="position:absolute;left:${x}px;top:604px">${n}</div>`);
    return v;
  });

  // ------------------------------------------------------------ 03 readouts
  panel(1313, 126, 258, 210, 'READOUT', '03');
  const rows = [['STROKE', 'mm'], ['CONTACT GAP', 'mm'], ['NEEDLE OUT', 'mm'], ['SKIN DEPTH', 'mm']].map(([n, u], i) => {
    const y = 163 + i * 41;
    add(`<div class="sm" style="position:absolute;left:1327px;top:${y}px">${n}</div>`);
    const v = add(`<div class="mo" style="position:absolute;right:${1600 - 1557}px;top:${y - 4}px;font-size:15px;font-weight:700"></div>`);
    add(`<div style="position:absolute;left:1327px;top:${y + 17}px;width:230px;height:4px;background:#efe9df;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:1327px;top:${y + 17}px;height:4px;background:${C.or};border-radius:2px"></div>`);
    void u;
    return {v, f};
  });
  // the dermis band on the depth bar: 0.1 to 2 mm of 3 mm
  add(`<div style="position:absolute;left:${1327 + (0.1 / 3) * 230}px;top:${163 + 3 * 41 + 23}px;width:${(1.9 / 3) * 230}px;height:2px;background:#e9a6a0"></div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:${163 + 3 * 41 + 28}px;font-size:7.6px">DERMIS 0.1 – 2 MM</div>`);

  // ------------------------------------------------------------ 04 power, 05 views, 06 display
  const btn = {};
  panel(1313, 353, 258, 82, 'POWER', '04');
  const VS = {x: 1329, w: 160};
  add(`<div class="sm" style="position:absolute;left:1327px;top:388px">SUPPLY</div>`);
  add(`<div class="sm" style="position:absolute;left:1327px;top:418px;font-size:7.6px">5 V</div><div class="sm" style="position:absolute;left:1474px;top:418px;font-size:7.6px">10 V</div>`);
  add(`<div style="position:absolute;left:${VS.x}px;top:407px;width:${VS.w}px;height:3px;background:#efe9df;border-radius:2px"></div>`);
  const vFill = add(`<div style="position:absolute;left:${VS.x}px;top:407px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const vKnob = add(`<div style="position:absolute;top:401px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const vVal = add(`<div class="mo" style="position:absolute;left:1500px;top:396px;font-size:19px;font-weight:700"></div>`);
  const btnRow = (keys, labels, x0, y, wmax = 230) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 7.1 + 22);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 31;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px;height:23px">${labels[k]}</div>`);
      x += w + 6;
    }
  };
  panel(1313, 450, 258, 107, 'VIEWS', '05');
  btnRow(VIEWS, VIEW_LABEL, 1327, 487);
  panel(1313, 572, 258, 138, 'DISPLAY', '06');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 609);

  // ------------------------------------------------------------ 07 the cycle bar and the time scale
  panel(430, 752, 740, 108, 'ONE CYCLE', '07');
  btn.play = add(`<div class="bt" style="left:445px;top:795px;width:44px;height:44px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:15px"></div>`);
  const opPhase = add(`<div class="mo" style="position:absolute;left:506px;width:506px;top:788px;text-align:center;font-size:9.6px;font-weight:700;letter-spacing:1.6px;color:${C.or}"></div>`);
  const TL = {x: 508, w: 504};
  add(`<div style="position:absolute;left:${TL.x}px;top:820px;width:${TL.w}px;height:3px;background:#efe9df;border-radius:2px"></div>`);
  const tlClosed = add(`<div style="position:absolute;left:${TL.x}px;top:818px;height:7px;background:rgba(232,69,44,.22);border-radius:2px"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:820px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:814px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:506px;top:834px;font-size:9.6px;color:${C.mute};letter-spacing:1px"></div>`);
  const tlClosedLbl = add(`<div class="sm" style="position:absolute;top:805px;font-size:7.6px;color:${C.or}">CLOSED</div>`);
  add(`<div class="sm" style="position:absolute;right:${1600 - 1012}px;top:834px;font-size:7.6px">ONE MAKE-AND-BREAK</div>`);
  add(`<div class="sm" style="position:absolute;left:1029px;top:805px">TIME</div>`);
  const SP = {x: 1031, w: 92};
  add(`<div style="position:absolute;left:${SP.x}px;top:823px;width:${SP.w}px;height:3px;background:#efe9df;border-radius:2px"></div>`);
  const spFill = add(`<div style="position:absolute;left:${SP.x}px;top:823px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const spKnob = add(`<div style="position:absolute;top:817px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const spVal = add(`<div class="mo" style="position:absolute;left:1128px;top:818px;font-size:10px;font-weight:700"></div>`);

  // ------------------------------------------------------------ footer and floor notes
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">MECHANISM STUDY &nbsp;·&nbsp; SIMULATED CIRCUIT &nbsp;·&nbsp; ONE DEGREE OF FREEDOM</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">RLC + SPRING-MASS, 0.2 µS STEPS <span style="color:${C.or}">//////</span></div>`);
  add(`<svg style="position:absolute;left:398px;top:162px" width="90" height="80"><path d="M0 80V0h80" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<svg style="position:absolute;left:1088px;top:606px" width="80" height="80"><path d="M80 0v76H0" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:367px;top:672px;line-height:16px;letter-spacing:2px">LINER SET-UP<br>3RL · 0.35 MM</div>`);

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const k = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / k, (r.top - a.top + r.height / 2) / k];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const voltK = (v) => (v - VOLT[0]) / (VOLT[1] - VOLT[0]);

  // the circuit, drawn once; update() only recolours and moves the switch blade and the charge dots
  const W = 254;
  const PATH_CLOSED = 'M22 30H112 M150 30H214 V130 H22 V82 M22 58 V30';
  const PATH_OPEN = 'M22 30H86 V64 H116 M124 64 H176 V30 H214 V130 H22 V82 M22 58 V30';

  return {
    spots,
    btn,
    root: ui,
    TL,
    SP,
    VS,
    voltKnob: (v) => [VS.x + voltK(v) * VS.w, 408],
    update(s) {
      const m = s.m;
      // ---------------------------------------------------- state chip
      const [title, sub, closed] = s.state;
      chip.style.background = closed ? C.or : C.blue;
      stTitle.textContent = title;
      stSub.textContent = sub;
      hzBig.textContent = Math.round(m.f);
      // ---------------------------------------------------- the circuit
      {
        const ik = Math.min(1, Math.abs(m.i) / Math.max(0.3, m.iPeak));
        const on = (a) => (a ? C.or : C.ink);
        const gap = Math.min(1, s.gap / 1.4);
        const live = closed ? PATH_CLOSED : PATH_OPEN;
        let h = '';
        // the wires
        h += `<path d="M22 30H112 M150 30H214 V130 H22 V82 M22 58 V30" fill="none" stroke="${C.faint}" stroke-width="1.6"/>`;
        h += `<path d="M86 30V64H116 M124 64H176V30" fill="none" stroke="${C.faint}" stroke-width="1.6"/>`;
        h += `<path d="${live}" fill="none" stroke="${C.or}" stroke-width="1.8" stroke-opacity="${(0.25 + 0.75 * ik).toFixed(2)}"/>`;
        // the moving charge
        h += `<path d="${live}" fill="none" stroke="${C.or}" stroke-width="3.2" stroke-dasharray="1.5 13" stroke-linecap="round" stroke-dashoffset="${(-s.flow * 60).toFixed(1)}" stroke-opacity="${ik.toFixed(2)}"/>`;
        // supply
        h += `<line x1="10" x2="34" y1="58" y2="58" stroke="${C.ink}" stroke-width="2"/><line x1="15" x2="29" y1="66" y2="66" stroke="${C.ink}" stroke-width="2"/>`;
        h += `<line x1="10" x2="34" y1="74" y2="74" stroke="${C.ink}" stroke-width="2"/><line x1="15" x2="29" y1="82" y2="82" stroke="${C.ink}" stroke-width="2"/>`;
        h += `<text x="40" y="72" font-size="8.5" font-weight="700" fill="${C.ink}" font-family="JetBrains Mono">${f1(s.volt)} V</text>`;
        // the contact: the front spring as a blade hinged at 112, the screw at 150
        const blade = -gap * 22;
        h += `<circle cx="112" cy="30" r="2.6" fill="${C.ink}"/><circle cx="150" cy="30" r="2.6" fill="${C.ink}"/>`;
        h += `<line x1="112" y1="30" x2="${(112 + 37 * Math.cos((blade * Math.PI) / 180)).toFixed(1)}" y2="${(30 + 37 * Math.sin((blade * Math.PI) / 180)).toFixed(1)}" stroke="${on(closed)}" stroke-width="2.4" stroke-linecap="round"/>`;
        h += `<text x="104" y="16" font-size="7.4" letter-spacing="1" fill="${C.mute}" font-family="JetBrains Mono">CONTACT</text>`;
        // the capacitor across it
        h += `<line x1="116" x2="116" y1="54" y2="74" stroke="${on(!closed && ik > 0.05)}" stroke-width="2.4"/><line x1="124" x2="124" y1="54" y2="74" stroke="${on(!closed && ik > 0.05)}" stroke-width="2.4"/>`;
        h += `<text x="96" y="88" font-size="7.4" letter-spacing="1" fill="${C.mute}" font-family="JetBrains Mono">47 µF · ${f1(Math.max(0, m.vc))} V</text>`;
        // the coils: two inductors
        let coil = '';
        for (let k = 0; k < 4; k++) coil += `a5 5 0 0 1 0 10 `;
        h += `<rect x="208" y="44" width="12" height="74" fill="#fbf9f6"/>`;
        h += `<path d="M214 46 ${coil} M214 88 ${coil}" fill="none" stroke="${C.ink}" stroke-width="1.8"/>`;
        h += `<text x="168" y="148" font-size="7.4" letter-spacing="1" fill="${C.mute}" font-family="JetBrains Mono">COILS 6.6 Ω</text>`;
        h += `<text x="0" y="148" font-size="7.4" letter-spacing="1" fill="${C.mute}" font-family="JetBrains Mono">SUPPLY</text>`;
        h += `<text x="40" y="118" font-size="17" font-weight="700" fill="${C.or}" font-family="Inter">${f1(Math.abs(m.i), 2)}<tspan font-size="9" fill="${C.mute}" font-family="JetBrains Mono"> A</tspan></text>`;
        sch.innerHTML = h;
      }
      // ---------------------------------------------------- the scope: the last 1.5 cycles and the next half
      {
        const H = 128;
        const X = (k) => 4 + k * (W - 8);
        const Yy = (y) => 10 + (y / 4.5) * (H - 30);
        const Yi = (i) => H - 14 - (i / 1.6) * (H - 34);
        let py = '';
        let pi = '';
        let band = '';
        let inBand = null;
        const N = 90;
        for (let n = 0; n <= N; n++) {
          const k = n / N;
          const u = s.phi - 1.5 + 2 * k;
          const q = s.at(u);
          py += `${n ? 'L' : 'M'}${X(k).toFixed(1)} ${Yy(q.y).toFixed(1)}`;
          pi += `${n ? 'L' : 'M'}${X(k).toFixed(1)} ${Yi(Math.abs(q.i)).toFixed(1)}`;
          if (q.closed && inBand === null) inBand = k;
          if ((!q.closed || n === N) && inBand !== null) {
            band += `<rect x="${X(inBand).toFixed(1)}" y="2" width="${(X(k) - X(inBand)).toFixed(1)}" height="${H - 14}" fill="${C.or}" opacity=".07"/>`;
            inBand = null;
          }
        }
        let h = band;
        for (const yy of [0, 2, 4]) h += `<line x1="0" x2="${W}" y1="${Yy(yy).toFixed(1)}" y2="${Yy(yy).toFixed(1)}" stroke="${C.line}" stroke-width="1"/><text x="${W - 2}" y="${(Yy(yy) - 2).toFixed(1)}" text-anchor="end" font-size="7" fill="${C.mute}" font-family="JetBrains Mono">${yy} mm</text>`;
        h += `<path d="${pi}" fill="none" stroke="${C.or}" stroke-width="1.6"/>`;
        h += `<path d="${py}" fill="none" stroke="${C.ink}" stroke-width="1.6"/>`;
        const xn = X(0.75);
        const now = s.at(s.phi);
        h += `<line x1="${xn}" x2="${xn}" y1="0" y2="${H - 12}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="2 2"/>`;
        h += `<circle cx="${xn}" cy="${Yy(now.y).toFixed(1)}" r="3.4" fill="${C.ink}"/><circle cx="${xn}" cy="${Yi(Math.abs(now.i)).toFixed(1)}" r="3.4" fill="${C.or}"/>`;
        h += `<text x="2" y="${H - 2}" font-size="7" fill="${C.mute}" font-family="JetBrains Mono" letter-spacing="1">ARMATURE DOWN ↓ · ${f1(1000 / m.f, 2)} MS PER CYCLE</text>`;
        scope.innerHTML = h;
        scopeVals[0].innerHTML = `${Math.round(m.f)}<span class="mo" style="font-size:9px;color:${C.mute};font-weight:500"> HZ</span>`;
        scopeVals[1].innerHTML = `${Math.round(m.duty * 100)}<span class="mo" style="font-size:9px;color:${C.mute};font-weight:500"> %</span>`;
        scopeVals[2].innerHTML = `${f1(m.iPeak, 2)}<span class="mo" style="font-size:9px;color:${C.mute};font-weight:500"> A</span>`;
      }
      // ---------------------------------------------------- readouts
      {
        const vals = [
          [m.stroke / 4.5, `${f1(m.stroke, 2)}`],
          [s.gap / 1.5, `${f1(s.gap, 2)}`],
          [s.out / 5, `${f1(s.out, 2)}`],
          [s.depth / 3, s.skin > 0.5 ? `${f1(s.depth, 2)}` : '—'],
        ];
        rows.forEach((r, i) => {
          r.f.style.width = `${(Math.min(1, Math.max(0, vals[i][0])) * 230).toFixed(1)}px`;
          r.v.textContent = vals[i][1];
        });
        rows[3].f.style.background = s.depth > 2 ? '#b8322a' : C.or;
      }
      // ---------------------------------------------------- power, views, display
      const vk = voltK(s.volt);
      vFill.style.width = `${(vk * VS.w).toFixed(1)}px`;
      vKnob.style.left = `${(VS.x + vk * VS.w).toFixed(1)}px`;
      vVal.innerHTML = `${f1(s.volt)}<span class="mo" style="font-size:10px;color:${C.mute}"> V</span>`;
      const onBtn = (k, on) => {
        btn[k].style.background = on ? C.or : '#fffdfa';
        btn[k].style.color = on ? '#fff' : C.ink;
        btn[k].style.borderColor = on ? C.or : C.faint;
      };
      for (const k of VIEWS) onBtn(k, s.view === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // ---------------------------------------------------- the cycle bar
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      opPhase.textContent = s.phase;
      const u = ((s.phi % 1) + 1) % 1;
      tlClosed.style.width = `${(m.duty * TL.w).toFixed(1)}px`;
      tlClosedLbl.style.left = `${(TL.x + (m.duty * TL.w) / 2 - 16).toFixed(1)}px`;
      tlFill.style.width = `${(u * TL.w).toFixed(1)}px`;
      tlKnob.style.left = `${(TL.x + u * TL.w).toFixed(1)}px`;
      tlTime.textContent = `${f1((u * 1000) / m.f, 2)} / ${f1(1000 / m.f, 2)} MS`;
      const sk = s.rateK;
      spFill.style.width = `${(sk * SP.w).toFixed(1)}px`;
      spKnob.style.left = `${(SP.x + sk * SP.w).toFixed(1)}px`;
      spVal.textContent = s.rate > 0.95 ? '1×' : `1/${Math.round(1 / s.rate)}×`;
      // ---------------------------------------------------- labels
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
void M;
