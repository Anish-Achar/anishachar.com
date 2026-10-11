// Hero drawing: a front section through cylinders 1 and 2 of the V8, drawn from the
// same dimensions as the CAD model (Parts.cs → Spec) and animated with the slider-crank equation.

const NS = 'http://www.w3.org/2000/svg';
const S = Math.SQRT1_2;
const H = 234.95, W = 72, BORE_R = 49.5, THROW = 46, ROD = 154.8, COMP_HT = 33.8, HEAD_H = 105, COVER_H = 48;
// compression-TDC crank angle (0–720°) of cylinders 1 and 2 in the 1-8-7-2-6-5-4-3 firing order
const FIRE = { 1: 45, [-1]: 315 };

const bank = (sg, a, b) => [sg * S * (a + b), S * (a - b)];
const P = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
const poly = (pts) => 'M' + pts.map(P).join('L') + 'Z';

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function crankPin(deg) {
  const ph = (deg * Math.PI) / 180;
  return [THROW * Math.sin(ph), THROW * Math.cos(ph)];
}
function pinDist(sg, deg) {
  const c = crankPin(deg), u = [sg * S, S];
  const along = c[0] * u[0] + c[1] * u[1], perp = u[0] * c[1] - u[1] * c[0];
  return along + Math.sqrt(ROD * ROD - perp * perp);
}
// strip of width h around a polyline (same idea as PartBuilder.Strip)
function tube(pts, w, parent, cls) {
  const d = 'M' + pts.map(P).join('L');
  el('path', { d, class: cls + ' tube-o', 'stroke-width': w + 2.4 }, parent);
  el('path', { d, class: cls + ' tube-i', 'stroke-width': w }, parent);
}

export function initHero() {
  const svg = document.getElementById('hero-svg');
  if (!svg) return;
  const thetaEl = document.getElementById('hero-theta');
  const stateEl = document.getElementById('hero-state');

  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,255,255,0.13)" stroke-width="1.3"/>
    </pattern>
    <radialGradient id="flame" cx="50%" cy="20%" r="80%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`;

  const style = el('style', {}, svg);
  style.textContent = `
    .st { fill: none; stroke: rgba(255,255,255,0.42); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    .st-f { fill: url(#hatch); stroke: rgba(255,255,255,0.42); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    .hole { fill: #0c0c0c; stroke: rgba(255,255,255,0.42); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
    .faint { fill: none; stroke: rgba(255,255,255,0.16); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .cl { fill: none; stroke: rgba(255,255,255,0.22); stroke-width: 1; stroke-dasharray: 22 5 3 5; vector-effect: non-scaling-stroke; }
    .mv { fill: rgba(255,255,255,0.05); stroke: #ffffff; stroke-width: 1.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .mv-solid { fill: #141414; stroke: #ffffff; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .pin { fill: #0c0c0c; stroke: #ffffff; stroke-width: 1.3; vector-effect: non-scaling-stroke; }
    .tube-o { fill: none; stroke: rgba(255,255,255,0.42); stroke-linecap: butt; stroke-linejoin: round; }
    .tube-i { fill: none; stroke: #0c0c0c; stroke-linecap: butt; stroke-linejoin: round; }
    .dim { fill: none; stroke: rgba(255,255,255,0.5); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .dimt { font: 500 15px 'JetBrains Mono', monospace; fill: rgba(255,255,255,0.75); letter-spacing: .04em; }
    .dimt.acc { fill: #ffffff; }
    .dimt.sm { font-size: 12.5px; fill: rgba(255,255,255,0.5); }`;

  const g = el('g', { transform: 'scale(1,-1)' }, svg);   // engine coordinates: +y up, mm
  const labels = el('g', {}, svg);                         // text stays upright

  // ---- centre lines
  for (const sg of [1, -1]) el('path', { d: 'M0,0L' + P(bank(sg, 460, 0)), class: 'cl' }, g);
  el('path', { d: 'M-120,0L120,0M0,-120L0,120', class: 'cl' }, g);

  // ---- block section (hatched), crankcase bay and bores cut out of it
  const xs = 110, rail = -70, aj = xs / S - W, yj = S * (aj - W);
  el('path', { d: poly([[xs, rail], [xs, yj], bank(1, H, W), bank(1, H, -W), [0, Math.SQRT2 * W], bank(-1, H, -W), bank(-1, H, W), [-xs, yj], [-xs, rail]]), class: 'st-f' }, g);
  el('circle', { cx: 0, cy: 0, r: 92, class: 'hole' }, g);
  for (const sg of [1, -1]) el('path', { d: poly([bank(sg, 62, -BORE_R), bank(sg, H + 0.5, -BORE_R), bank(sg, H + 0.5, BORE_R), bank(sg, 62, BORE_R)]), class: 'hole' }, g);
  el('circle', { cx: 0, cy: 0, r: 32.5, class: 'hole' }, g);

  // ---- heads with intake (valley side) and exhaust (outboard) ports, valve covers, coils
  for (const sg of [1, -1]) {
    const B = (a, b) => bank(sg, a, b);
    el('path', { d: poly([B(H, -W), B(H, W), B(H + HEAD_H, W), B(H + HEAD_H, -W)]), class: 'st-f' }, g);
    el('path', { d: poly([B(H + 30, -W - 1), B(H + 30, -W + 30), B(H + 70, -W + 30), B(H + 70, -W - 1)]), class: 'hole' }, g);
    el('path', { d: poly([B(H + 32, W + 1), B(H + 32, W - 30), B(H + 68, W - 30), B(H + 68, W + 1)]), class: 'hole' }, g);
    const a0 = H + HEAD_H, a1 = a0 + COVER_H;
    el('path', { d: poly([B(a0, -66), B(a0, 66), B(a1 - 10, 66), B(a1, 50), B(a1, -50), B(a1 - 10, -66)]), class: 'st' }, g);
    el('path', { d: poly([B(a1, -18), B(a1, 18), B(a1 + 26, 18), B(a1 + 26, -18)]), class: 'st' }, g);
    // exhaust primary, collector and outlet pipe
    const e0 = B(H + 50, W), e2 = B(H + 50, W + 62);
    tube([e0, e2], 20, g, '');
    el('circle', { cx: e2[0], cy: e2[1], r: 30, class: 'st' }, g);
    el('path', { d: poly([[e2[0] - 26, e2[1] - 28], [e2[0] + 26, e2[1] - 28], [e2[0] + 26, -60], [e2[0] - 26, -60]]), class: 'st' }, g);
    el('path', { d: poly([[e2[0] - 42, -60], [e2[0] + 42, -60], [e2[0] + 42, -72], [e2[0] - 42, -72]]), class: 'st' }, g);
    // intake runner from the port to the plenum
    const p0 = B(H + 50, -W), p1 = [p0[0] - sg * S * 30, p0[1] + S * 30], p2 = [sg * 40, 318];
    tube([p0, p1, p2], 25, g, '');
  }
  // intake plenum, throttle bore, oil pan and filter
  el('rect', { x: -70, y: 285, width: 140, height: 70, rx: 20, class: 'st' }, g);
  el('circle', { cx: 0, cy: 320, r: 29, class: 'faint' }, g);
  for (const x of [-46, 0, 46]) el('rect', { x: x - 4, y: 355, width: 8, height: 7, class: 'faint' }, g);
  el('path', { d: poly([[-114, -78], [114, -78], [114, -70], [-114, -70]]), class: 'st' }, g);
  el('path', { d: 'M-106,-78L-106,-130Q-106,-150 -86,-150L86,-150Q106,-150 106,-130L106,-78', class: 'st' }, g);
  el('path', { d: 'M-100,-78L-100,-126Q-100,-144 -82,-144L82,-144Q100,-144 100,-126L100,-78', class: 'faint' }, g);
  el('path', { d: poly([[-87, -160], [-3, -160], [-3, -149], [-87, -149]]), class: 'st' }, g);
  el('rect', { x: -83, y: -262, width: 76, height: 102, rx: 6, class: 'st' }, g);
  for (let y = -250; y < -170; y += 12) el('path', { d: `M-83,${y}L-7,${y}`, class: 'faint' }, g);

  // throw circle (stroke) and the 90° bank angle
  el('circle', { cx: 0, cy: 0, r: THROW, class: 'faint', 'stroke-dasharray': '4 4' }, g);
  el('path', { d: `M${P(bank(1, 150, 0))}A150,150 0 0 1 ${P(bank(-1, 150, 0))}`, class: 'dim' }, g);

  // ---- moving parts (redrawn every frame)
  const flames = { 1: el('path', { class: '', fill: 'url(#flame)', filter: 'url(#glow)', opacity: 0 }, g), [-1]: el('path', { fill: 'url(#flame)', filter: 'url(#glow)', opacity: 0 }, g) };
  const chambers = { 1: el('path', { fill: '#ffffff', opacity: 0 }, g), [-1]: el('path', { fill: '#ffffff', opacity: 0 }, g) };
  const web = el('path', { class: 'mv-solid' }, g);
  const rods = { 1: el('path', { class: 'mv' }, g), [-1]: el('path', { class: 'mv' }, g) };
  const bigEnds = { 1: el('circle', { r: 36, class: 'mv' }, g), [-1]: el('circle', { r: 36, class: 'mv' }, g) };
  const crankPinEl = el('circle', { r: 26.65, class: 'pin' }, g);
  el('circle', { cx: 0, cy: 0, r: 25, class: 'mv-solid' }, g);
  el('circle', { cx: 0, cy: 0, r: 5, fill: '#ffffff' }, g);
  const pistons = {}, pins = {}, rings = {};
  for (const sg of [1, -1]) {
    pistons[sg] = el('path', { class: 'mv-solid' }, g);
    rings[sg] = el('path', { class: 'mv', fill: 'none' }, g);
    pins[sg] = el('circle', { r: 11.75, class: 'pin' }, g);
  }

  // ---- labels
  const T = (x, y, txt, cls = 'dimt', anchor = 'middle') => { const t = el('text', { x, y: -y, class: cls, 'text-anchor': anchor }, labels); t.textContent = txt; return t; };
  T(0, 162, '90°', 'dimt acc');
  const top1 = bank(1, 470, 0), top2 = bank(-1, 470, 0);
  T(top1[0] - 4, top1[1] + 4, 'LEFT BANK · 1-3-5-7', 'dimt sm', 'end');
  T(top2[0] + 4, top2[1] + 4, 'RIGHT BANK · 2-4-6-8', 'dimt sm', 'start');
  // bore dimension across the left bank, just below the deck
  const d0 = bank(1, H - 12, -BORE_R), d1 = bank(1, H - 12, BORE_R);
  el('path', { d: `M${P(d0)}L${P(d1)}`, class: 'dim' }, g);
  for (const q of [d0, d1]) el('circle', { cx: q[0], cy: q[1], r: 3, fill: 'rgba(238,240,243,.7)' }, g);
  const bl = bank(1, H - 12, BORE_R + 46);
  el('path', { d: `M${P(d1)}L${P(bl)}`, class: 'faint' }, g);
  T(bl[0] + 6, bl[1] - 5, 'Ø99.0', 'dimt', 'start');
  // stroke callout
  el('path', { d: `M${P([33, -32])}L${P([150, -118])}L${P([235, -118])}`, class: 'faint' }, g);
  T(152, -112, 'STROKE 92.0', 'dimt', 'start');
  T(-112, -132, 'ROD 154.8', 'dimt sm', 'end');

  const reduce = document.documentElement.classList.contains('reduce-motion');
  let theta = 60, last = 0, running = !reduce, visible = true;

  const STROKES = ['POWER', 'EXHAUST', 'INTAKE', 'COMP'];
  function draw() {
    const th = theta % 360;
    const c = crankPin(th);
    crankPinEl.setAttribute('cx', c[0]); crankPinEl.setAttribute('cy', c[1]);
    // cam-shaped web: counterweight arc round the main axis, tangent to a boss round the pin
    const rc = 72, rp = 34, d = THROW, gam = Math.acos((rc - rp) / d), psi = Math.atan2(c[1], c[0]);
    const dir = (a) => [Math.cos(a), Math.sin(a)];
    const a1 = dir(psi + gam).map((v) => v * rc), a2 = dir(psi - gam).map((v) => v * rc);
    const b1 = [c[0] + Math.cos(psi + gam) * rp, c[1] + Math.sin(psi + gam) * rp];
    const b2 = [c[0] + Math.cos(psi - gam) * rp, c[1] + Math.sin(psi - gam) * rp];
    web.setAttribute('d', `M${P(b1)}A${rp},${rp} 0 0 0 ${P(b2)}L${P(a2)}A${rc},${rc} 0 1 0 ${P(a1)}Z`);

    const states = [];
    for (const sg of [1, -1]) {
      const dd = pinDist(sg, th), u = [sg * S, S], p = [u[0] * dd, u[1] * dd];
      const B = (a, b) => bank(sg, a, b);
      pistons[sg].setAttribute('d', poly([B(dd - 26, -49.3), B(dd + COMP_HT, -49.3), B(dd + COMP_HT, 49.3), B(dd - 26, 49.3)]));
      rings[sg].setAttribute('d', [27.75, 23.25, 18].map((r) => `M${P(B(dd + r, -49.3))}L${P(B(dd + r, -44))}M${P(B(dd + r, 44))}L${P(B(dd + r, 49.3))}`).join(''));
      pins[sg].setAttribute('cx', p[0]); pins[sg].setAttribute('cy', p[1]);
      bigEnds[sg].setAttribute('cx', c[0]); bigEnds[sg].setAttribute('cy', c[1]);
      // tapered rod beam from big end to small end
      const v = [p[0] - c[0], p[1] - c[1]], L = Math.hypot(v[0], v[1]), n = [-v[1] / L, v[0] / L];
      const q = (t, w) => [c[0] + v[0] * t + n[0] * w, c[1] + v[1] * t + n[1] * w];
      rods[sg].setAttribute('d', poly([q(0.12, -15), q(0.12, 15), q(1, 10), q(1, -10)]) + `M${P([p[0] + n[0] * 18, p[1] + n[1] * 18])}A18,18 0 1 1 ${P([p[0] - n[0] * 18, p[1] - n[1] * 18])}A18,18 0 1 1 ${P([p[0] + n[0] * 18, p[1] + n[1] * 18])}`);
      // combustion: flash at compression TDC, fading through the power stroke
      const phase = (((theta - FIRE[sg]) % 720) + 720) % 720;
      const f = phase < 150 ? Math.pow(1 - phase / 150, 1.6) : 0;
      const top = dd + COMP_HT;
      const ch = poly([B(top, -BORE_R), B(H + 18, -BORE_R + 8), B(H + 18, BORE_R - 8), B(top, BORE_R)]);
      chambers[sg].setAttribute('d', ch); chambers[sg].setAttribute('opacity', (0.05 + 0.55 * f).toFixed(3));
      flames[sg].setAttribute('d', ch); flames[sg].setAttribute('opacity', f.toFixed(3));
      states.push(`C${sg > 0 ? 1 : 2} ${STROKES[Math.floor(phase / 180)]}`);
    }
    thetaEl.textContent = String(Math.round(th)).padStart(3, '0') + '°';
    stateEl.textContent = states.join(' · ');
  }

  function frame(t) {
    if (!running || !visible) { last = 0; return; }
    if (last) theta = (theta + ((t - last) / 1000) * 150) % 720;   // 150°/s: slow enough to watch the strokes
    last = t;
    draw();
    requestAnimationFrame(frame);
  }
  draw();
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && running) requestAnimationFrame(frame);
  }).observe(svg);
}
