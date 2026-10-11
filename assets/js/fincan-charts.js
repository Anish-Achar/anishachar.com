// Charts for the fin can project (SVG, in the site's chart style) and the flutter maths shared with the 3D
// flutter lab. isa() and flutterSpeed() are line-for-line ports of analysis/physics.py.
const P0 = 101325, PSI = 6894.757, G0 = 9.80665, R_AIR = 287.05287;

export function isa(h) {
  h = Math.min(Math.max(h, 0), 11000);
  const T = 288.15 - 0.0065 * h;
  return { p: P0 * Math.pow(T / 288.15, G0 / (R_AIR * 0.0065)), a: Math.sqrt(1.4 * R_AIR * T) };
}

// NACA TN 4197 flutter boundary (G in Pa, t in m): flat plate cantilevered at the root, t/c on the root chord
export function flutterSpeed(G, t, fin, p, a) {
  const area = (fin.cr + fin.ct) * fin.s / 2, ar = fin.s * fin.s / area, lam = fin.ct / fin.cr, tc = t / fin.cr;
  const denom = 39.3 * ar ** 3 / (tc ** 3 * (ar + 2)) * (lam + 1) / 2 * (p / P0);
  return a * Math.sqrt((G / PSI) / denom);
}

// lowest flutter margin over the whole flight (points above 20 m/s, as in the analysis)
export function minFlutterMargin(data, G, t) {
  const tr = data.trajectory, fin = data.fin;
  let best = { margin: Infinity };
  for (let i = 0; i < tr.t.length; i++) {
    const v = tr.v[i];
    if (v <= 20) continue;
    const { p, a } = isa(fin.siteAlt + tr.z[i]);
    const vf = flutterSpeed(G, t, fin, p, a);
    if (vf / v < best.margin) best = { margin: vf / v, t: tr.t[i], z: tr.z[i], v, vf };
  }
  return best;
}

// ------------------------------------------------------------------ helpers
const nf = (x, d = 0) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const MAT_COLOR = { 'G10 fibreglass': '#fafafa', 'Carbon fibre (0/90)': '#3987e5', 'Birch aircraft ply': '#c98500', 'Aluminium 6061-T6': '#199e70' };
const MAT_SHORT = { 'G10 fibreglass': 'G10', 'Carbon fibre (0/90)': 'Carbon', 'Birch aircraft ply': 'Birch ply', 'Aluminium 6061-T6': 'Aluminium' };
const BAD = '#f05252', ORANGE = '#d95926';

function ticks(min, max, n) {
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || 10 * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function svgIn(host, w, h) {
  host.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"></svg><div class="tip" aria-hidden="true"></div>`;
  return { svg: host.querySelector('svg'), tip: host.querySelector('.tip') };
}

function showTip(tip, host, x, y, html) {
  tip.innerHTML = html;
  tip.classList.add('show');
  const w = host.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = clamp(x + 14, 0, w - tw) + 'px';
  tip.style.top = clamp(y - th - 10, -10, 10000) + 'px';
}

function onResize(host, draw) {
  let lastW = 0;
  new ResizeObserver(() => {
    const w = host.clientWidth;
    if (w && Math.abs(w - lastW) > 1) { lastW = w; requestAnimationFrame(draw); }
  }).observe(host);
}

// ------------------------------------------------------------------ init
export function initCharts(data) {
  const lab = { t: data.fin.t * 1000, material: data.fin.material, margin: data.kpis.flutter };
  const worst = minFlutterMargin(data, data.materials[data.fin.material].G, data.fin.t);
  const redraws = [];

  // ================================================================ flight
  {
    const host = document.getElementById('fc-flight');
    const seg = document.getElementById('fc-flight-seg');
    const title = document.getElementById('fc-flight-title'), sub = document.getElementById('fc-flight-sub');
    const tr = data.trajectory, K = data.kpis, ev = data.events;
    const SERIES = {
      z: { label: 'Altitude', unit: 'm', d: 0, sub: `Apogee ${nf(K.apogee)} m at ${nf(K.tApogee, 1)} s, right on the 2 km target.` },
      v: { label: 'Speed', unit: 'm/s', d: 0, sub: `Max ${nf(K.vmax)} m/s (Mach ${nf(K.mach, 2)}) just before burnout, then a 16 s coast.` },
      q: { label: 'Dynamic pressure', unit: 'kPa', d: 1, sub: `Max ${nf(K.qmax, 1)} kPa at about 390 m: the fins’ worst aerodynamic load, and where flutter is closest.` },
      sm: { label: 'Static margin', unit: 'cal', d: 2, sub: `Rises from ${nf(K.smRail, 2)} to ${nf(K.smBurnout, 2)} calibers as the propellant burns and the CG moves forward.` },
    };
    let cur = 'z';
    for (const [k, s] of Object.entries(SERIES)) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = s.label; b.setAttribute('aria-pressed', k === cur);
      b.addEventListener('click', () => { cur = k; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); });
      seg.appendChild(b);
    }
    const EVENTS = [['rail exit', ev.rail], ['max q', ev.qmax], ['burnout', ev.burnout], ['apogee', ev.apogee]];
    function draw() {
      const s = SERIES[cur], vals = tr[cur];
      title.textContent = s.label;
      sub.textContent = s.sub;
      const W = host.clientWidth || 600, H = clamp(Math.round(W * 0.46), 240, 340);
      const m = { l: 48, r: 14, t: 34, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      let y0 = 0, y1 = Math.max(...vals) * 1.08;
      if (cur === 'sm') { y0 = 1.2; y1 = 3.2; }
      if (cur === 'z') y1 = Math.max(y1, data.targetApogee * 1.1);
      const t1 = tr.t[tr.t.length - 1];
      const X = (t) => m.l + (t / t1) * iw, Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
      const { svg, tip } = svgIn(host, W, H);
      let h = `<defs><linearGradient id="fc-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
      for (const v of ticks(y0, y1, 4)) h += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick-label" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${nf(v, cur === 'sm' ? 1 : 0)}</text>`;
      for (const t of ticks(0, t1, 6)) h += `<text class="tick-label" x="${X(t)}" y="${H - 8}" text-anchor="middle">${nf(t)} s</text>`;
      if (cur === 'sm') {
        const [lo, hi] = data.stabilityBand;
        h += `<rect class="fc-band" x="${m.l}" y="${Y(hi)}" width="${iw}" height="${Y(lo) - Y(hi)}"/><text class="fc-band-label" x="${W - m.r - 6}" y="${Y(lo) - 6}" text-anchor="end">target band ${lo}–${hi} cal</text>`;
      }
      if (cur === 'z') h += `<line class="fc-target" x1="${m.l}" x2="${W - m.r}" y1="${Y(data.targetApogee)}" y2="${Y(data.targetApogee)}"/><text class="fc-event" x="${m.l + 6}" y="${Y(data.targetApogee) - 6}">target ${nf(data.targetApogee)} m</text>`;
      EVENTS.forEach(([name, t], i) => {
        h += `<line class="fc-event-line" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}"/><text class="fc-event" x="${X(t) + (name === 'apogee' ? -4 : 4)}" y="${i % 2 ? 26 : 12}" text-anchor="${name === 'apogee' ? 'end' : 'start'}">${name}</text>`;
      });
      const pts = tr.t.map((t, i) => `${X(t).toFixed(1)},${Y(vals[i]).toFixed(1)}`);
      const base = cur === 'sm' ? Y(y0) : Y(0);
      h += `<path class="fc-area" d="M${X(0)},${base}L${pts.join('L')}L${X(t1)},${base}Z"/>`;
      h += `<path class="series-line" stroke="#fafafa" d="M${pts.join('L')}"/>`;
      h += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
      h += `<line class="crosshair" id="fc-fx" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><circle id="fc-fd" r="4.5" fill="#fff" stroke="#000" stroke-width="2" visibility="hidden"/>`;
      h += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" id="fc-fhit"/>`;
      svg.innerHTML = h;
      svg.setAttribute('aria-label', `${s.label} against time for the simulated flight`);
      const hit = svg.querySelector('#fc-fhit'), fx = svg.querySelector('#fc-fx'), fd = svg.querySelector('#fc-fd');
      const move = (e) => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
        const t = clamp(((px - m.l) / iw) * t1, 0, t1);
        let i = 0, bestD = Infinity;
        tr.t.forEach((tt, j) => { const d = Math.abs(tt - t); if (d < bestD) { bestD = d; i = j; } });
        const x = X(tr.t[i]), y = Y(vals[i]);
        fx.setAttribute('x1', x); fx.setAttribute('x2', x); fx.setAttribute('visibility', 'visible');
        fd.setAttribute('cx', x); fd.setAttribute('cy', y); fd.setAttribute('visibility', 'visible');
        showTip(tip, host, x * (r.width / W), y * (r.height / H), `<div class="t-h">t = ${nf(tr.t[i], 2)} s</div>
          <div class="t-r"><span>Altitude</span><b>${nf(tr.z[i])} m</b></div>
          <div class="t-r"><span>Speed</span><b>${nf(tr.v[i])} m/s · M${nf(tr.mach[i], 2)}</b></div>
          <div class="t-r"><span>Dynamic pressure</span><b>${nf(tr.q[i], 1)} kPa</b></div>
          <div class="t-r"><span>Static margin</span><b>${nf(tr.sm[i], 2)} cal</b></div>`);
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { tip.classList.remove('show'); fx.setAttribute('visibility', 'hidden'); fd.setAttribute('visibility', 'hidden'); });
    }
    onResize(host, draw);
    draw();
  }

  // ================================================================ design space + planform card
  {
    const host = document.getElementById('fc-space'), card = document.getElementById('fc-plan');
    const rows = data.log, chosen = rows.find((r) => r.chosen), it1 = rows[0], it2 = rows[1];
    let shown = chosen;
    function planCard(r) {
      shown = r;
      const cr = r.root, ct = r.tip, s = r.span, sw = cr - ct;
      const fin = (q, cls) => `<path class="${cls}" d="M0 0L${q.root} 0L${q.root - (q.root - q.tip)} ${-q.span}L0 ${-q.span}Z"/>`;
      const stage = r.chosen ? 'Iteration 3 · chosen' : r.stage.startsWith('1') ? 'Iteration 1 · first guess' : r.stage.startsWith('2') ? 'Iteration 2 · chamfered TE' : 'From the sweep';
      card.innerHTML = `
        <div class="fc-plan-title"><b>${nf(cr)} / ${nf(ct)} mm chords · ${nf(s)} mm span</b><span>${stage}</span></div>
        <svg viewBox="-24 -128 270 182" role="img" aria-label="Fin planform drawn to scale">
          <rect class="body" x="-24" y="0" width="270" height="22"/>
          ${r !== chosen ? fin(chosen, 'fin prev') : ''}
          ${fin(r, 'fin')}
          <path class="dim" d="M0 34H${cr}M0 29V39M${cr} 29V39"/><text class="dim-t" x="${cr / 2}" y="50" text-anchor="middle">root ${nf(cr)} mm</text>
          <path class="dim" d="M-12 0V${-s}M-17 0H-7M-17 ${-s}H-7"/><text class="dim-t" x="-16" y="${-s / 2}" text-anchor="end" dominant-baseline="middle" transform="rotate(-90 -16 ${-s / 2})" dy="-2">${nf(s)}</text>
          <text class="dim-t" x="${cr - sw / 2}" y="${-s - 8}" text-anchor="middle">tip ${nf(ct)}</text>
        </svg>
        <dl class="fc-stats">
          <div><dt>G10 needed</dt><dd>${nf(r.t, 1)} <small>mm</small></dd></div>
          <div><dt>Flutter margin</dt><dd>${nf(r.flutter, 2)}<small>×</small></dd></div>
          <div><dt>Static margin</dt><dd>${nf(r.smRail, 2)} <small>→ ${nf(r.smBurnout, 2)} cal</small></dd></div>
          <div><dt>Apogee</dt><dd>${nf(r.apogee)} <small>m</small></dd></div>
          <div><dt>Fin set</dt><dd>${nf(r.finMass * 1000)} <small>g</small></dd></div>
          <div><dt>Trailing edge</dt><dd>${r.te === 'square' ? 'Square' : 'Chamfered'}</dd></div>
        </dl>${r !== chosen ? '<p class="sub" style="margin:4px 0 0">Dashed outline: the chosen fin, for comparison.</p>' : ''}`;
    }
    function draw() {
      const W = host.clientWidth || 600, H = clamp(Math.round(W * 0.52), 250, 360);
      const m = { l: 52, r: 16, t: 14, b: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x0 = 1.9, x1 = 3.4, y0 = 1830, y1 = 2035;
      const X = (v) => m.l + ((v - x0) / (x1 - x0)) * iw, Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
      const { svg, tip } = svgIn(host, W, H);
      const [lo, hi] = data.stabilityBand;
      let h = `<defs><marker id="fc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${ORANGE}"/></marker></defs>`;
      h += `<rect class="fc-band" x="${X(x0)}" y="${m.t}" width="${X(Math.min(hi, x1)) - X(x0)}" height="${ih}"/><text class="fc-band-label" x="${X(x0) + 8}" y="${m.t + 14}">stability band (≤ ${hi} cal)</text>`;
      for (const v of ticks(1850, y1, 4)) h += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick-label" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${nf(v)}</text>`;
      for (const v of [2, 2.5, 3]) h += `<text class="tick-label" x="${X(v)}" y="${H - 14}" text-anchor="middle">${nf(v, 1)}</text>`;
      h += `<text class="tick-label" x="${W - m.r}" y="${H - 1}" text-anchor="end">static margin at rail exit (cal) →</text>`;
      h += `<line class="fc-target" x1="${m.l}" x2="${W - m.r}" y1="${Y(data.targetApogee)}" y2="${Y(data.targetApogee)}"/><text class="fc-event" x="${W - m.r - 6}" y="${Y(data.targetApogee) - 6}" text-anchor="end">2 km target</text>`;
      const rad = (r) => 3 + 9 * Math.sqrt(r.finMass / 0.71);
      h += `<path class="fc-iter-path" d="M${X(it1.smRail) - 2},${Y(it1.apogee) - rad(it1) - 3}L${X(it2.smRail) - 2},${Y(it2.apogee) + rad(it2) + 3}"/>`;
      h += `<path class="fc-iter-path" d="M${X(it2.smRail) - rad(it2) - 3},${Y(it2.apogee) - 4}Q${X(2.6)},${Y(1905)} ${X(chosen.smRail) + 14},${Y(chosen.apogee) + 8}"/>`;
      rows.forEach((r, i) => {
        const cls = i < 2 ? 'iter' : Math.abs(r.t - 4) < 0.05 ? 't40' : 't48';
        h += `<circle class="fc-pt ${cls}" data-i="${i}" cx="${X(r.smRail)}" cy="${Y(r.apogee)}" r="${rad(r)}" tabindex="0" role="button" aria-label="${nf(r.root)} by ${nf(r.tip)} mm chords, ${nf(r.span)} mm span: ${nf(r.smRail, 2)} calibers, ${nf(r.apogee)} m"/>`;
      });
      h += `<circle class="fc-chosen-ring" cx="${X(chosen.smRail)}" cy="${Y(chosen.apogee)}" r="${rad(chosen) + 6}"/>`;
      h += `<text class="fc-iter-label" x="${X(it1.smRail) + 14}" y="${Y(it1.apogee) + 4}">1</text><text class="fc-iter-label" x="${X(it2.smRail) + 14}" y="${Y(it2.apogee) + 4}">2</text><path d="M${X(chosen.smRail) + 8},${Y(chosen.apogee) + rad(chosen) + 5}L${X(2.31)},${Y(1967)}" stroke="#fff" stroke-width="1" fill="none"/><text class="fc-iter-label" x="${X(2.32)}" y="${Y(1967) + 4}" style="fill:#fff">3 · chosen</text>`;
      svg.innerHTML = h;
      svg.setAttribute('aria-label', 'Scatter plot of 26 fin planforms: static margin against apogee');
      svg.querySelectorAll('.fc-pt').forEach((c) => {
        const r = rows[+c.dataset.i];
        const on = (e) => {
          svg.querySelectorAll('.fc-pt.on').forEach((x) => x.classList.remove('on'));
          c.classList.add('on');
          planCard(r);
          const b = svg.getBoundingClientRect();
          const cx = +c.getAttribute('cx') * (b.width / W), cy = +c.getAttribute('cy') * (b.height / H);
          showTip(tip, host, cx, cy, `<div class="t-h">${nf(r.root)} / ${nf(r.tip)} mm · ${nf(r.span)} mm span</div>
            <div class="t-r"><span>Static margin</span><b>${nf(r.smRail, 2)} cal</b></div>
            <div class="t-r"><span>Apogee</span><b>${nf(r.apogee)} m</b></div>
            <div class="t-r"><span>G10 needed</span><b>${nf(r.t, 1)} mm</b></div>`);
        };
        const off = () => { tip.classList.remove('show'); c.classList.remove('on'); planCard(chosen); };
        c.addEventListener('pointerenter', on); c.addEventListener('focus', on);
        c.addEventListener('pointerleave', off); c.addEventListener('blur', off);
      });
    }
    planCard(chosen);
    onResize(host, draw);
    draw();
  }

  // ================================================================ flutter vs thickness + trade table
  const flutterChart = {};
  {
    const host = document.getElementById('fc-flutter'), legend = document.getElementById('fc-flutter-legend');
    const { p, a } = isa(data.fin.siteAlt + worst.z);
    const vF = worst.v;
    document.getElementById('fc-flutter-sub').textContent = `At the worst point of the flight: ${nf(worst.z)} m, ${nf(vF)} m/s, just after max speed.`;
    legend.innerHTML = Object.keys(data.materials).map((n) => `<li><span class="key" style="background:${MAT_COLOR[n]}"></span>${MAT_SHORT[n]}</li>`).join('')
      + `<li><span class="key" style="background:${BAD}"></span>Flight speed</li><li><span class="key" style="background:repeating-linear-gradient(90deg,${BAD} 0 4px,transparent 4px 7px)"></span>1.5× margin</li>`;
    function draw() {
      const W = host.clientWidth || 600, H = clamp(Math.round(W * 0.56), 250, 360);
      const m = { l: 48, r: 14, t: 12, b: 34 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x0 = 1.2, x1 = 7, y0 = 0, y1 = 1000;
      const X = (v) => m.l + ((v - x0) / (x1 - x0)) * iw, Y = (v) => m.t + ih - ((clamp(v, y0, y1 * 1.2) - y0) / (y1 - y0)) * ih;
      const { svg, tip } = svgIn(host, W, H);
      let h = `<defs><clipPath id="fc-fclip"><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></clipPath></defs>`;
      for (const v of ticks(y0, y1, 4)) h += `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick-label" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${nf(v)}</text>`;
      for (let v = 2; v <= 7; v++) h += `<text class="tick-label" x="${X(v)}" y="${H - 14}" text-anchor="middle">${v} mm</text>`;
      h += `<g clip-path="url(#fc-fclip)">`;
      for (const [n, mat] of Object.entries(data.materials)) {
        const pts = [];
        for (let t = x0; t <= x1 + 1e-9; t += 0.05) pts.push(`${X(t).toFixed(1)},${Y(flutterSpeed(mat.G, t / 1000, data.fin, p, a)).toFixed(1)}`);
        h += `<path class="series-line" stroke="${MAT_COLOR[n]}" stroke-width="${n === data.fin.material ? 2.4 : 1.6}" d="M${pts.join('L')}"/>`;
      }
      h += `</g><line x1="${m.l}" x2="${W - m.r}" y1="${Y(vF)}" y2="${Y(vF)}" stroke="${BAD}" stroke-width="1.6"/>`;
      h += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(vF * data.fin.required)}" y2="${Y(vF * data.fin.required)}" stroke="${BAD}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
      h += `<line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
      const G = data.materials[lab.material].G, ly = flutterSpeed(G, lab.t / 1000, data.fin, p, a);
      const lx = X(lab.t), lyy = Y(ly), right = lx > W * 0.62;
      h += `<circle class="fc-lab-mark" cx="${lx}" cy="${lyy}" r="6"/><text class="fc-lab-mark-label" x="${lx + (right ? -12 : 12)}" y="${lyy + 4}" text-anchor="${right ? 'end' : 'start'}">Lab: ${nf(lab.t, 1)} mm ${MAT_SHORT[lab.material]} · ${nf(lab.margin, 2)}×</text>`;
      h += `<line class="crosshair" id="fc-flx" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" id="fc-flhit"/>`;
      svg.innerHTML = h;
      svg.setAttribute('aria-label', 'Flutter speed against fin thickness for four fin materials, with the flight speed and the required 1.5 times margin');
      const hit = svg.querySelector('#fc-flhit'), fx = svg.querySelector('#fc-flx');
      const move = (e) => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width);
        const t = Math.round(clamp(x0 + ((px - m.l) / iw) * (x1 - x0), x0, x1) * 10) / 10;
        fx.setAttribute('x1', X(t)); fx.setAttribute('x2', X(t)); fx.setAttribute('visibility', 'visible');
        const rowsHtml = Object.entries(data.materials).map(([n, mat]) => {
          const vf = flutterSpeed(mat.G, t / 1000, data.fin, p, a);
          return `<div class="t-r"><span><i class="key" style="background:${MAT_COLOR[n]}"></i>${MAT_SHORT[n]}</span><b>${nf(vf)} m/s · ${nf(vf / vF, 2)}×</b></div>`;
        }).join('');
        showTip(tip, host, X(t) * (r.width / W), m.t + 40, `<div class="t-h">${nf(t, 1)} mm fins at ${nf(worst.z)} m</div>${rowsHtml}`);
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { tip.classList.remove('show'); fx.setAttribute('visibility', 'hidden'); });
    }
    flutterChart.draw = draw;
    onResize(host, draw);
    draw();

    const table = document.getElementById('fc-trades');
    table.innerHTML = `<thead><tr><th>Material</th><th>Sheet</th><th>Mass</th><th>Margin</th><th>Apogee</th></tr></thead><tbody>${data.trades.map((t) => `
      <tr class="${t.material === data.fin.material ? 'on' : ''}"><td><span class="sw" style="background:${MAT_COLOR[t.material]}"></span>${MAT_SHORT[t.material]}</td>
      <td>${nf(t.t, 1)} mm</td><td>${nf(t.mass * 1000)} g</td><td>${nf(t.flutter, 2)}×</td><td>${nf(t.apogee)} m</td></tr>`).join('')}</tbody>`;
  }

  // ================================================================ load cases
  {
    const host = document.getElementById('fc-loads');
    const SHORT = {
      'Fin flutter (NACA TN 4197)': 'Fin flutter', 'Fin root bending, 10 m/s gust': 'Fin bending in a gust', 'Aft ring bending, full thrust': 'Aft ring bending',
      'Aft ring bond shear (MMT side)': 'Aft ring glue line', 'Airframe axial buckling': 'Airframe buckling', 'Forward ring bending': 'Forward ring bending',
      'U-bolt washer pull-through': 'Washer pull-through', 'U-bolt legs (M6 A2-70)': 'U-bolt legs', 'Forward ring bond shear': 'Forward ring glue line',
    };
    const nominal = data.cases.filter((c) => !c.failure), failure = data.cases.filter((c) => c.failure);
    function draw() {
      const W = host.clientWidth || 600, rowH = 25, labW = clamp(W * 0.36, 118, 170);
      const lines = [['Nominal (need 2.0; flutter 1.5)', null], ...nominal.map((c) => [null, c]), ['If the drogue fails (need 1.0)', null], ...failure.map((c) => [null, c])];
      const m = { l: labW, r: 40, t: 6, b: 28 }, H = m.t + lines.length * rowH + m.b, iw = W - m.l - m.r;
      const lx0 = Math.log10(0.5), lx1 = Math.log10(300);
      const X = (v) => m.l + ((Math.log10(clamp(v, 0.5, 300)) - lx0) / (lx1 - lx0)) * iw;
      const { svg, tip } = svgIn(host, W, H);
      let h = '';
      for (const v of iw < 300 ? [1, 2, 10, 100] : [1, 2, 5, 10, 20, 50, 100, 200]) h += `<line class="gridline" x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}"/><text class="tick-label" x="${X(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
      h += `<line class="fc-unity" x1="${X(1)}" x2="${X(1)}" y1="${m.t}" y2="${H - m.b}"/>`;
      lines.forEach(([head, c], i) => {
        const y = m.t + i * rowH + rowH / 2;
        if (head) { h += `<text class="fc-group-label" x="4" y="${y + 4}">${head}</text>`; return; }
        const idx = data.cases.indexOf(c);
        h += `<text class="fc-case-label${c.failure ? ' fail' : ''}" x="${labW - 10}" y="${y + 4}" text-anchor="end">${SHORT[c.name] || c.name}</text>`;
        h += `<rect class="fc-bar${c.failure ? ' fail' : ''}" data-i="${idx}" x="${X(0.5)}" y="${y - 7}" width="${Math.max(2, X(c.fos) - X(0.5))}" height="14" rx="3"/>`;
        h += `<line class="fc-need" x1="${X(c.need)}" x2="${X(c.need)}" y1="${y - 10}" y2="${y + 10}"/>`;
        h += `<text class="fc-bar-label" x="${X(c.fos) + 6}" y="${y + 4}">${c.fos < 10 ? nf(c.fos, 2) : nf(c.fos)}</text>`;
      });
      svg.innerHTML = h;
      svg.setAttribute('aria-label', 'Factor of safety for 13 structural load cases on a log scale');
      svg.querySelectorAll('.fc-bar').forEach((b) => {
        const c = data.cases[+b.dataset.i];
        b.addEventListener('pointerenter', () => {
          b.classList.add('hot');
          const r = svg.getBoundingClientRect();
          showTip(tip, host, (+b.getAttribute('x') + +b.getAttribute('width')) * (r.width / W) - 40, +b.getAttribute('y') * (r.height / H), `<div class="t-h">${c.name}${c.failure ? ' · drogue failure' : ''}</div>
            <div class="t-r"><span>Applied</span><b>${nf(c.applied, c.applied < 10 ? 2 : 0)} ${c.unit}</b></div>
            <div class="t-r"><span>Allowable</span><b>${nf(c.allowable)} ${c.unit}</b></div>
            <div class="t-r"><span>Factor of safety</span><b>${nf(c.fos, 2)} (need ${nf(c.need, 1)})</b></div>${c.note ? `<div class="t-h" style="margin:6px 0 0;max-width:260px;white-space:normal">${c.note}</div>` : ''}`);
        });
        b.addEventListener('pointerleave', () => { b.classList.remove('hot'); tip.classList.remove('show'); });
      });
    }
    onResize(host, draw);
    draw();
  }

  return {
    setLab(state) {
      Object.assign(lab, state);
      if (flutterChart.draw) flutterChart.draw();
    },
  };
}
