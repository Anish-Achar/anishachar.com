// NO Candle strategy section: anatomy diagram, per-pair results explorer, and the
// position-size / leverage charts. Data: assets/data/trading.json (built from the
// TradingView Strategy Tester runs, Nov 30 2025 – Sep 25 2026, $100K account).

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const PAIRS = ['EURUSD', 'GBPJPY', 'GBPUSD', 'AUDJPY'];
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const COLOR = {};
const PAIR_NAME = { EURUSD: 'EUR/USD', GBPJPY: 'GBP/JPY', GBPUSD: 'GBP/USD', AUDJPY: 'AUD/JPY' };
const START = Date.UTC(2025, 10, 30);                       // day 0 of the test window
const DAYS = 299.9;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function h(tag, cls, html, parent) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  if (parent) parent.appendChild(n);
  return n;
}
const money = (v, sign = true) => (v < 0 ? '−' : sign && v > 0 ? '+' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const moneyK = (v) => { const a = Math.abs(v); const s = a >= 1000 ? '$' + (a / 1000).toLocaleString('en-US', { maximumFractionDigits: a >= 10000 ? 0 : 1 }) + 'K' : '$' + Math.round(a); return (v < 0 ? '−' : '') + s; };
const pct = (v, dp = 1) => (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(dp) + '%';
const dateOf = (d) => { const t = new Date(START + d * 86400000); return t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()] + ' ' + t.getUTCFullYear(); };

function parseCurve(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).map((t) => { const i = t.indexOf(':'); return [+t.slice(0, i), +t.slice(i + 1)]; });
}
// The exported curves end with a mark-to-market point for the trade still open when the data ran out.
// Net profit counts closed trades only, so hold the last closed-trade equity to the end instead.
function closedCurve(s) {
  const pts = [[0, 0], ...parseCurve(s)];
  if (pts.length > 2 && pts[pts.length - 1][0] >= 299.8) pts[pts.length - 1] = [DAYS, pts[pts.length - 2][1]];
  else pts.push([DAYS, pts[pts.length - 1][1]]);
  return pts;
}
function parseSens(s) {
  const out = [];
  const re = /\s*(\*?)([^:]+?):(-?[\d.]+):(\d+)(:x)?(?=\s|$)/g;
  let m;
  while ((m = re.exec(s))) out.push({ label: m[2].trim(), net: +m[3], n: +m[4], pick: !!m[1], fail: !!m[5] });
  return out;
}
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}
function monthTicks(width) {
  const out = [];
  for (let m = 0; m < 10; m++) {
    const y = 2025 + Math.floor((11 + m) / 12), mo = (11 + m) % 12;
    const d = (Date.UTC(y, mo, 1) - START) / 86400000;
    if (d < 0 || d > DAYS) continue;
    const every = width < 420 ? 3 : width < 640 ? 2 : 1;
    if (m % every === 0) out.push([d, MONTHS[mo] + (mo === 0 || m === 0 ? " '" + String(y).slice(2) : '')]);
  }
  return out;
}

// ------------------------------------------------------------------ tooltips
function tipFor(host) {
  let t = host.querySelector('.tip');
  if (!t) t = h('div', 'tip', '', host);
  return {
    show(html, x, y) {
      t.innerHTML = html;
      t.classList.add('show');
      const w = t.offsetWidth, hw = host.clientWidth;
      t.style.left = Math.max(0, Math.min(x + 14, hw - w)) + 'px';
      t.style.top = Math.max(0, y - t.offsetHeight - 12) + 'px';
    },
    hide() { t.classList.remove('show'); },
  };
}

// place end labels without overlaps, drawing leader lines when a label had to move
function placeLabels(items, minGap, top, bottom) {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) if (items[i].ly - items[i - 1].ly < minGap) items[i].ly = items[i - 1].ly + minGap;
  const over = items.length ? items[items.length - 1].ly - bottom : 0;
  if (over > 0) for (const it of items) it.ly -= over;
  for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].ly - items[i].ly < minGap) items[i].ly = items[i + 1].ly - minGap;
  for (const it of items) it.ly = Math.max(top, it.ly);
  return items;
}

// ------------------------------------------------------------------ line chart
// series: [{ key, name, color, pts: [[x,y]...], end: 'label text', muted }]
function lineChart(host, opts) {
  const state = { opts, drawn: new Set() };
  const tip = tipFor(host);
  const box = svg('svg', { role: 'img', 'aria-label': opts.aria || '' }, host);
  function render() {
    const { series, xMin = 0, xMax = DAYS, yFmt, xTicks, height = 300, tipTitle, tipVal, endRoom = 96 } = state.opts;
    const W = host.clientWidth; if (!W) return;
    const m = { l: W < 440 ? 46 : 54, r: W < 440 ? Math.min(endRoom, 92) : endRoom, t: 10, b: 28 };
    const iw = W - m.l - m.r, ih = height - m.t - m.b;
    box.setAttribute('viewBox', `0 0 ${W} ${height}`);
    box.setAttribute('height', height);
    box.replaceChildren();
    let yMin = Infinity, yMax = -Infinity;
    series.forEach((s) => s.pts.forEach((p) => { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); }));
    yMin = Math.min(yMin, 0); yMax = Math.max(yMax, 0);
    const ticks = niceTicks(yMin, yMax, 5);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = (v) => m.l + ((v - xMin) / (xMax - xMin)) * iw;
    const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
    const g = svg('g', {}, box);
    for (const t of ticks) {
      svg('line', { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? 'baseline' : 'gridline' }, g);
      svg('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick-label' }, g).textContent = yFmt(t);
    }
    for (const [v, lab] of (xTicks ? xTicks(iw) : monthTicks(iw))) {
      svg('text', { x: X(v), y: height - 8, 'text-anchor': 'middle', class: 'tick-label' }, g).textContent = lab;
    }
    if (state.opts.vline) {
      const { x, label } = state.opts.vline;
      svg('line', { x1: X(x), x2: X(x), y1: m.t, y2: m.t + ih, stroke: 'rgba(255,255,255,.3)', 'stroke-width': 1 }, g);
      svg('text', { x: X(x) - 6, y: m.t + 12, 'text-anchor': 'end', class: 'tick-label' }, g).textContent = label;
    }
    const ends = [];
    for (const s of series) {
      const d = 'M' + s.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join('L');
      const path = svg('path', { d, class: 'series-line', stroke: s.color, 'stroke-width': s.width || 2 }, g);
      if (!state.drawn.has(s.key) && !document.documentElement.classList.contains('reduce-motion')) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1)';
        requestAnimationFrame(() => { path.style.strokeDashoffset = 0; });
        setTimeout(() => { path.style.strokeDasharray = ''; }, 1500);
      }
      state.drawn.add(s.key);
      const last = s.pts[s.pts.length - 1];
      svg('circle', { cx: X(last[0]), cy: Y(last[1]), r: 4, fill: s.color, stroke: '#0c0c0c', 'stroke-width': 2 }, g);
      if (s.end) ends.push({ s, x: X(last[0]), y: Y(last[1]), ly: Y(last[1]) + 4 });
    }
    placeLabels(ends, 15, m.t + 8, m.t + ih + 4).forEach((e) => {
      if (Math.abs(e.ly - 4 - e.y) > 2) svg('path', { d: `M${e.x + 6},${e.y}L${e.x + 12},${e.ly - 4}`, stroke: 'rgba(255,255,255,.3)', fill: 'none' }, g);
      svg('text', { x: e.x + 14, y: e.ly, class: 'end-label' + (e.s.muted ? ' muted' : '') }, g).textContent = e.s.end;
    });
    // crosshair + tooltip
    const cross = svg('line', { y1: m.t, y2: m.t + ih, class: 'crosshair', visibility: 'hidden' }, g);
    const dots = series.map((s) => svg('circle', { r: 4, fill: s.color, stroke: '#0c0c0c', 'stroke-width': 2, visibility: 'hidden' }, g));
    const hit = svg('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, g);
    const move = (e) => {
      const r = box.getBoundingClientRect(), px = e.clientX - r.left;
      const xv = Math.max(xMin, Math.min(xMax, xMin + ((px - m.l) / iw) * (xMax - xMin)));
      cross.setAttribute('x1', X(xv)); cross.setAttribute('x2', X(xv)); cross.setAttribute('visibility', 'visible');
      const rows = series.map((s, i) => {
        let p = s.pts[0];
        for (const q of s.pts) { if (q[0] <= xv + 1e-9) p = q; else break; }
        if (state.opts.interp) p = [xv, interp(s.pts, xv)];
        dots[i].setAttribute('cx', X(xv)); dots[i].setAttribute('cy', Y(p[1])); dots[i].setAttribute('visibility', 'visible');
        return { s, v: p[1] };
      });
      rows.sort((a, b) => b.v - a.v);
      tip.show(`<div class="t-h">${tipTitle(xv)}</div>` + rows.map(({ s, v }) => `<div class="t-r"><span><i class="key" style="background:${s.color}"></i>${s.name}</span><b>${tipVal(v, s, xv)}</b></div>`).join(''), px, Y(rows[0].v));
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
  }
  onWidthChange(host, render);
  return { update(o) { Object.assign(state.opts, o); render(); }, render };
}
function interp(pts, x) {
  for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

// ------------------------------------------------------------------ scatter: every backtest
function scatterChart(host) {
  const tip = tipFor(host);
  const box = svg('svg', { role: 'img' }, host);
  let D = null;
  function render() {
    if (!D) return;
    const W = host.clientWidth, height = 320; if (!W) return;
    const m = { l: 54, r: 14, t: 12, b: 30 };
    const iw = W - m.l - m.r, ih = height - m.t - m.b;
    box.setAttribute('viewBox', `0 0 ${W} ${height}`); box.setAttribute('height', height);
    box.setAttribute('aria-label', `${D.pts.length.toLocaleString('en-US')} backtests on ${PAIR_NAME[D.pair]}: net profit against max drawdown`);
    box.replaceChildren();
    const xs = D.pts.map((p) => p.dd), ys = D.pts.map((p) => p.net);
    const xt = niceTicks(0, Math.min(Math.max(...xs), D.ddCap * 4), 5), yt = niceTicks(Math.min(0, ...ys), Math.max(...ys), 5);
    const X = (v) => m.l + (Math.min(v, xt[xt.length - 1]) / xt[xt.length - 1]) * iw;
    const Y = (v) => m.t + ih - ((v - yt[0]) / (yt[yt.length - 1] - yt[0])) * ih;
    const g = svg('g', {}, box);
    for (const t of yt) {
      svg('line', { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? 'baseline' : 'gridline' }, g);
      svg('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'tick-label' }, g).textContent = moneyK(t);
    }
    for (const t of xt) svg('text', { x: X(t), y: height - 10, 'text-anchor': 'middle', class: 'tick-label' }, g).textContent = moneyK(t);
    // drawdown guardrail
    svg('line', { x1: X(D.ddCap), x2: X(D.ddCap), y1: m.t, y2: m.t + ih, stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1 }, g);
    svg('text', { x: X(D.ddCap) + 6, y: m.t + 12, class: 'tick-label' }, g).textContent = 'Drawdown cap ' + money(D.ddCap, false);
    const dots = svg('g', {}, g);
    const pos = [];
    // failing combos first so the passing ones sit on top
    for (const pass of [false, true]) for (const p of D.pts) {
      if (p.pass !== pass) continue;
      const cx = X(p.dd), cy = Y(p.net);
      svg('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: 2.4, fill: pass ? D.color : css('--c-muted'), 'fill-opacity': pass ? 0.5 : 0.4 }, dots);
      pos.push([cx, cy, p]);
    }
    for (const [key, p, color, label] of [['orig', D.orig, css('--ink'), 'Original'], ['script', D.script, D.color, 'Pair script']]) {
      const cx = X(p.dd), cy = Y(p.net);
      svg('circle', { cx, cy, r: 8, fill: 'none', stroke: '#0c0c0c', 'stroke-width': 5 }, g);
      svg('circle', { cx, cy, r: 8, fill: key === 'script' ? D.color : 'none', 'fill-opacity': 0.25, stroke: color, 'stroke-width': 2 }, g);
      const right = cx < m.l + iw - 110;
      svg('text', { x: cx + (right ? 14 : -14), y: cy + 4, 'text-anchor': right ? 'start' : 'end', class: 'end-label' }, g).textContent = label + ' ' + money(p.net);
    }
    const hit = svg('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, g);
    const ring = svg('circle', { r: 6, fill: 'none', stroke: '#fff', 'stroke-width': 1.5, visibility: 'hidden' }, g);
    hit.addEventListener('pointermove', (e) => {
      const r = box.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bd = 24 * 24;
      for (const q of pos) { const d = (q[0] - px) ** 2 + (q[1] - py) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best) { tip.hide(); ring.setAttribute('visibility', 'hidden'); return; }
      const p = best[2];
      ring.setAttribute('cx', best[0]); ring.setAttribute('cy', best[1]); ring.setAttribute('visibility', 'visible');
      tip.show(`<div class="t-h">One backtest · ${{ B: 'longs + shorts', L: 'longs only', S: 'shorts only' }[p.dir]}</div>
        <div class="t-r"><span>Net profit</span><b>${money(p.net)}</b></div>
        <div class="t-r"><span>Max drawdown</span><b>${money(p.dd, false)}</b></div>
        <div class="t-r"><span>Trades</span><b>${p.n}</b></div>
        <div class="t-r"><span>Profit factor</span><b>${p.pf.toFixed(2)}</b></div>
        <div class="t-r"><span>Guardrails</span><b>${p.pass ? 'pass' : 'fail'}</b></div>`, best[0], best[1]);
    });
    hit.addEventListener('pointerleave', () => { tip.hide(); ring.setAttribute('visibility', 'hidden'); });
  }
  onWidthChange(host, render);
  return { update(d) { D = d; render(); } };
}

// redraw a chart when its box gets wider or narrower: on the next frame (redrawing inside the observer can
// resize the box again and trip the browser's "ResizeObserver loop" warning), and never for height-only changes
function onWidthChange(host, render) {
  let w = host.clientWidth, queued = false;
  new ResizeObserver(() => {
    if (queued || host.clientWidth === w) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; w = host.clientWidth; render(); });
  }).observe(host);
}

// ------------------------------------------------------------------ anatomy diagram
// Hand-made candles (open, high, low, close) for an illustrative long setup.
const CANDLES = [
  [103.2, 104.6, 102.6, 104.0], [104.0, 106.6, 103.7, 106.1], [106.1, 106.5, 104.6, 105.0], [105.0, 108.4, 104.8, 108.0],
  [108.0, 110.6, 107.5, 110.1], [110.1, 110.5, 108.6, 109.0], [109.0, 109.3, 106.6, 107.1], [107.1, 107.8, 105.6, 106.6],
  [106.6, 109.4, 106.2, 109.1], [109.1, 112.4, 108.8, 112.0], [112.0, 114.5, 111.5, 114.1], [114.1, 117.4, 113.6, 116.2],
  [116.2, 116.6, 113.8, 114.2], [114.2, 114.8, 112.3, 112.7], [112.7, 113.2, 110.9, 111.6], [111.6, 113.9, 111.3, 113.5],
  [113.5, 113.8, 111.9, 112.3], [111.9, 115.0, 111.9, 114.7], [114.7, 115.4, 113.9, 114.3], [114.3, 114.9, 113.3, 113.8],
  [113.8, 116.9, 113.6, 116.5], [116.5, 118.2, 116.0, 117.8], [117.8, 118.3, 116.6, 117.0], [117.0, 119.8, 116.8, 119.4],
  [119.4, 121.3, 118.9, 120.9], [120.9, 121.2, 119.6, 120.1], [120.1, 122.9, 119.9, 122.6], [122.6, 124.8, 122.2, 124.3],
  [124.3, 124.9, 123.1, 123.6], [123.6, 125.6, 123.3, 125.2],
];
function drawAnatomy() {
  const box = $('#how-svg');
  const Wd = 720, Ht = 400, L = 20, R = 700, T = 24, B = 372, lo = 100.5, hi = 127.5;
  const step = (R - L - 90) / CANDLES.length;
  const X = (i) => L + step * (i + 0.5), Y = (p) => B - ((p - lo) / (hi - lo)) * (B - T);
  const ink = 'rgba(250,250,250,.92)', dim = 'rgba(255,255,255,.5)', acc = '#ffffff', good = '#22c55e', bad = '#f05252', trend = '#9a9a9a';
  box.innerHTML = '';
  const defs = svg('defs', {}, box);
  defs.innerHTML = `<filter id="nglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${ink}"/></marker>`;
  for (let p = 104; p <= 126; p += 4) svg('line', { x1: L, x2: R, y1: Y(p), y2: Y(p), stroke: 'rgba(255,255,255,.05)' }, box);
  const layer = (n) => svg('g', { class: 'layer', 'data-l': n }, box);
  const text = (g, x, y, t, o = {}) => { const e = svg('text', { x, y, fill: o.fill || ink, 'font-size': o.size || 12, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': o.anchor || 'start', 'font-weight': o.weight || 500 }, g); e.textContent = t; return e; };

  // 3: setup window (drawn first so it sits behind the candles)
  const l3 = layer(3);
  const w0 = X(17) - step / 2, w1 = X(24) + step / 2;
  svg('rect', { x: w0, y: T, width: w1 - w0, height: B - T, fill: 'rgba(255,255,255,.045)', stroke: 'rgba(255,255,255,.3)', 'stroke-dasharray': '4 4' }, l3);
  text(l3, (w0 + w1) / 2, T + 16, 'SETUP LIVE · 8 CANDLES', { anchor: 'middle', size: 11, fill: '#d4d4d4' });
  svg('path', { d: `M${w0 + 6},${T + 26}L${w1 - 6},${T + 26}`, stroke: 'rgba(255,255,255,.55)', 'marker-start': 'url(#arr)', 'marker-end': 'url(#arr)' }, l3);

  // 1: trend filter (EMA + swing structure)
  const l1 = layer(1);
  let ema = 103.4; const k = 2 / (9 + 1), emaPts = [];
  CANDLES.forEach((c, i) => { ema = c[3] * k + ema * (1 - k); emaPts.push([X(i), Y(ema - 1.2)]); });
  svg('path', { d: 'M' + emaPts.map((p) => p.join(',')).join('L'), fill: 'none', stroke: trend, 'stroke-width': 2, opacity: 0.9 }, l1);
  text(l1, emaPts[4][0] - 4, emaPts[4][1] + 22, 'EMA', { fill: trend, size: 11 });
  for (const [i, lab, up] of [[7, 'L', false], [11, 'H', true], [14, 'HL', false]]) {
    const c = CANDLES[i], y = up ? Y(c[1]) - 10 : Y(c[2]) + 10;
    svg('path', { d: up ? `M${X(i) - 5},${y}L${X(i) + 5},${y}L${X(i)},${y + 7}Z` : `M${X(i) - 5},${y}L${X(i) + 5},${y}L${X(i)},${y - 7}Z`, fill: trend }, l1);
    text(l1, X(i), up ? y - 6 : y + 16, lab, { anchor: 'middle', size: 11, fill: trend });
  }
  svg('path', { d: `M${X(7)},${Y(105.6) + 30}L${X(14)},${Y(110.9) + 30}`, stroke: trend, 'stroke-width': 1.2, 'marker-end': 'url(#arr)', opacity: 0.8 }, l1);
  text(l1, X(8.2), Y(105.6) + 46, 'higher low → uptrend', { size: 11, fill: trend });

  // candles
  const cg = svg('g', {}, box);
  CANDLES.forEach((c, i) => {
    const [o, hh, l, cl] = c, up = cl >= o, x = X(i), bw = step * 0.56;
    svg('line', { x1: x, x2: x, y1: Y(hh), y2: Y(l), stroke: up ? 'rgba(175,175,175,.8)' : 'rgba(130,130,130,.8)', 'stroke-width': 1.2 }, cg);
    svg('rect', { x: x - bw / 2, y: Y(Math.max(o, cl)), width: bw, height: Math.max(1.5, Math.abs(Y(o) - Y(cl))), rx: 1.2, fill: up ? 'rgba(150,150,150,.8)' : '#0c0c0c', stroke: up ? 'none' : 'rgba(130,130,130,.85)' }, cg);
  });

  // 2: the NO candle
  const l2 = layer(2);
  const nc = CANDLES[17], nx = X(17), bw = step * 0.56;
  svg('rect', { x: nx - bw / 2 - 5, y: Y(nc[1]) - 5, width: bw + 10, height: Y(nc[2]) - Y(nc[1]) + 10, rx: 4, fill: 'none', stroke: acc, 'stroke-width': 2, filter: 'url(#nglow)' }, l2);
  svg('rect', { x: nx - bw / 2 - 5, y: Y(nc[1]) - 5, width: bw + 10, height: Y(nc[2]) - Y(nc[1]) + 10, rx: 4, fill: 'none', stroke: acc, 'stroke-width': 1.6 }, l2);
  svg('rect', { x: nx - bw / 2, y: Y(nc[3]), width: bw, height: Y(nc[0]) - Y(nc[3]), rx: 1.2, fill: acc }, l2);
  svg('line', { x1: nx, x2: nx, y1: Y(nc[1]), y2: Y(nc[3]), stroke: acc, 'stroke-width': 1.4 }, l2);
  const cy = Y(nc[2]) + 42;
  svg('path', { d: `M${nx},${Y(nc[2]) + 8}L${nx},${cy - 12}`, stroke: acc, 'stroke-width': 1 }, l2);
  text(l2, nx, cy, 'NO CANDLE', { anchor: 'middle', fill: '#ffffff', size: 12, weight: 600 });
  text(l2, nx, cy + 15, 'opens at its low · no wick below', { anchor: 'middle', fill: dim, size: 10.5 });

  // 4 + 5: entry, stop and target
  const entry = 115.4, range = nc[1] - nc[2], stop = entry - range, target = entry + 3 * (entry - stop);
  const l4 = layer(4), l5 = layer(5);
  const ex = X(20), xr = X(29) + step / 2 + 4;
  svg('line', { x1: ex, x2: xr, y1: Y(stop), y2: Y(stop), stroke: bad, 'stroke-width': 1.6 }, l4);
  text(l4, xr + 6, Y(stop) + 4, 'STOP', { fill: bad, size: 11, weight: 600 });
  text(l4, xr + 6, Y(stop) + 18, '1× NO range', { fill: dim, size: 10 });
  const bx = nx + bw / 2 + 9;
  svg('path', { d: `M${bx},${Y(nc[1])}L${bx + 5},${Y(nc[1])}L${bx + 5},${Y(nc[2])}L${bx},${Y(nc[2])}`, stroke: bad, fill: 'none', 'stroke-width': 1.2 }, l4);
  text(l4, bx + 9, (Y(nc[1]) + Y(nc[2])) / 2 + 4, 'range', { fill: bad, size: 10 });
  svg('rect', { x: xr - 16, y: Y(entry), width: 10, height: Y(stop) - Y(entry), fill: 'rgba(240,82,82,.3)', stroke: bad }, l4);

  svg('line', { x1: ex, x2: xr, y1: Y(target), y2: Y(target), stroke: good, 'stroke-width': 1.6 }, l5);
  text(l5, xr + 6, Y(target) + 4, 'TARGET', { fill: good, size: 11, weight: 600 });
  text(l5, xr + 6, Y(target) + 18, '3 × risk (RR 3)', { fill: dim, size: 10 });
  svg('rect', { x: xr - 16, y: Y(target), width: 10, height: Y(entry) - Y(target), fill: 'rgba(34,197,94,.25)', stroke: good }, l5);
  svg('line', { x1: ex, x2: xr, y1: Y(entry), y2: Y(entry), stroke: ink, 'stroke-width': 1, 'stroke-dasharray': '3 3' }, l5);
  svg('circle', { cx: ex, cy: Y(entry), r: 6, fill: ink, stroke: '#0c0c0c', 'stroke-width': 2 }, l5);
  text(l5, ex - 10, Y(entry) - 12, 'ENTRY', { anchor: 'end', size: 11, weight: 600 });
  svg('circle', { cx: X(27), cy: Y(target), r: 5, fill: good, stroke: '#0c0c0c', 'stroke-width': 2 }, l5);
  return box;
}

function initAnatomy() {
  drawAnatomy();
  const how = $('#how'), steps = [...document.querySelectorAll('.how-step')];
  let current = 0, auto = !document.documentElement.classList.contains('reduce-motion'), timer = 0, inView = false;
  function set(n) {
    current = n;
    steps.forEach((s) => s.classList.toggle('on', +s.dataset.step === n));
    how.querySelectorAll('.layer').forEach((g) => {
      const l = +g.dataset.l;
      g.style.opacity = !n || l === n || (n === 5 && l === 4) ? 1 : 0.1;
    });
  }
  steps.forEach((s) => s.querySelector('button').addEventListener('click', () => {
    auto = false; clearInterval(timer);
    set(current === +s.dataset.step ? 0 : +s.dataset.step);
  }));
  const run = () => { clearInterval(timer); if (auto && inView) timer = setInterval(() => set((current % 5) + 1), 4200); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && auto && !current) set(1); run(); }, { threshold: 0.4 }).observe(how);
  set(0);
}

// ------------------------------------------------------------------ written takeaways (per pair)
const NOTES = {
  EURUSD: {
    worked: ['A wide stop at 5× the NO candle’s range. Every swing-based stop lost money, between −$361 and −$633.',
      'Wick tolerance of 10 ticks (1 pip). On the original settings, this change alone was worth +$531.',
      'Trading both directions, even though EURUSD fell 2.1% over the period.'],
    failed: ['Longs on their own lost −$414 with these settings. The best longs-only result anywhere was +$207.',
      'Pivot length 1, the worst single change from the original settings (−$370).',
      'Tight stops and small targets: NO range × 0.5 (−$157) and reward:risk 0.5 (−$205).'],
    note: 'EURUSD fell 2.1%, and the best result of all was shorts only (+$1,109). The script trades 109 times, just over the 100-trade minimum.',
  },
  GBPJPY: {
    worked: ['A 5× NO-range stop. From the original settings this change alone added +$527, and every swing-based stop lost money.',
      '“Internal + EMA” trend with EMA 100. The other trend modes made +$639 to +$1,170.',
      'A long setup life of 20 candles. Shorter validity cost profit steadily, down to +$1,174 at 3 candles.'],
    failed: ['Reusing the EURUSD-tuned settings: +$499, but with double the original drawdown.',
      'Reward:risk other than 1: 0.5 gave +$659, and 2.5 lost −$438.',
      'Wick tolerance 10, which won on the other three pairs, made only +$751 here. 5 ticks is best.'],
    note: 'GBPJPY rose 1.1%. A later position-size search found this +$1,615 setup, beating the main search’s +$1,062, so the script was updated to it.',
  },
  GBPUSD: {
    worked: ['Wick tolerance of 10 ticks, the biggest single improvement on the original settings (+$591).',
      'A 5× NO-range stop with reward:risk 1. The neighbouring stop sizes were much weaker (4× +$211, 6× +$520).',
      'Trend mode and EMA length hardly matter here: every trend mode made +$1,102 to +$1,447.'],
    failed: ['Wide stops on their own. On the original settings, 4× and 5× stops lost more; they only pay off together with wick tolerance 10 and RR 1.',
      'Reward:risk above 1. At 1.5 the script turns into −$94.',
      'Longs only: −$103 with these settings.'],
    note: 'GBPUSD went nowhere (−0.3%), yet both directions made money. The stop multiplier and wick tolerance are the fragile settings here.',
  },
  AUDJPY: {
    worked: ['A swing stop 20 ticks beyond the swing candle’s wick. Every “beyond the wick” swing stop made +$1,993 to +$2,312.',
      'Wick tolerance of 10 ticks again: 5 ticks gave +$1,348 and 0 ticks +$261.',
      'A short setup life (3 candles), one pending setup, and “Internal only” trend.'],
    failed: ['NO-range stops, the winner on the other pairs. Every multiplier of 5× or smaller lost money here.',
      'Reward:risk above 1: 1.5 broke the drawdown cap, and 3 lost −$544.',
      'Other trend modes: “EMA only” +$1,346 and “Internal + EMA” +$1,456, against +$2,312 for “Internal only”.'],
    note: 'AUDJPY rose 7.9%, which helped the longs. It’s the strongest pair in the test, and the only one whose best stop is swing-based.',
  },
};

// ------------------------------------------------------------------ explorer
let started = false;
export async function initTrading() {
  if (started) return;
  started = true;
  PAIRS.forEach((p) => { COLOR[p] = css('--c-' + p.toLowerCase()); });
  initAnatomy();
  const explorer = $('#explorer');
  const status = h('p', 'ex-status', 'Loading the backtest results…');
  status.setAttribute('role', 'status');
  explorer.before(status);
  explorer.hidden = true;
  let data;
  try {
    const r = await fetch(new URL('../data/trading.json', import.meta.url));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    data = await r.json();
  } catch (err) {
    console.error(err);
    status.classList.add('failed');
    status.innerHTML = 'The backtest results didn’t load, so the charts below are missing. Check your connection, then <button type="button" class="link-btn">reload the page</button>.';
    status.querySelector('button').addEventListener('click', () => location.reload());
    return;
  }
  status.remove();
  explorer.hidden = false;

  const eq = lineChart($('#eq-chart'), {
    series: [], height: 300, yFmt: moneyK, endRoom: 108, aria: 'Equity curve',
    tipTitle: dateOf, tipVal: (v) => money(v),
  });
  const sc = scatterChart($('#sc-chart'));
  let pair = 'EURUSD';

  const seg = $('#pair-seg');
  PAIRS.forEach((p) => {
    const b = h('button', null, `<span class="sw" style="background:${COLOR[p]}"></span>${PAIR_NAME[p]}`, seg);
    b.type = 'button';
    b.addEventListener('click', () => { pair = p; show(); });
  });

  function show() {
    const D = data.pairs[pair], color = COLOR[pair], o = D.configs.original, s = D.configs.script;
    [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', PAIRS[i] === pair));

    // equity curve
    $('#eq-title').textContent = `Equity curve · ${PAIR_NAME[pair]}`;
    $('#eq-sub').textContent = `Closed-trade profit on a $100K account at 10% of equity per trade. ${PAIR_NAME[pair]} itself moved ${pct(D.buyHold)} over the same period.`;
    $('#eq-legend').innerHTML = `<li><span class="key" style="background:${color}"></span>Tuned pair script</li><li><span class="key" style="background:${css('--c-muted')}"></span>Original settings</li>`;
    eq.update({
      series: [
        { key: pair + 'o', name: 'Original', color: css('--c-muted'), pts: closedCurve(D.curves.original), end: 'Original ' + money(o.net), muted: true },
        { key: pair + 's', name: 'Tuned', color, pts: closedCurve(D.curves.script), end: 'Tuned ' + money(s.net) },
      ],
    });

    // headline stats
    const sized = D.sizing.rows.find((r) => r.size === D.sizing.pick);
    $('#stat-sub').textContent = NOTES[pair].note;
    const stat = (k, v, sub, cls = '') => `<div><dt>${k}</dt><dd class="${cls}">${v}${sub ? `<small>${sub}</small>` : ''}</dd></div>`;
    $('#stat-list').innerHTML =
      stat('Net profit', money(s.net), 'original ' + money(o.net), 'pos') +
      stat('Profit factor', s.pf.toFixed(2), 'original ' + o.pf.toFixed(2)) +
      stat('Trades', s.n, 'original ' + o.n) +
      stat('Win rate', s.win.toFixed(1) + '%', 'original ' + o.win.toFixed(1) + '%') +
      stat('Max drawdown', money(s.dd, false), 'original ' + money(o.dd, false)) +
      stat('Longs / shorts', `${money(s.longs)} / ${money(s.shorts)}`, 'both directions profitable') +
      stat(`At ${D.sizing.pick}% size`, money(sized.net), `max drawdown ${sized.ddPct.toFixed(1)}%`, 'pos') +
      stat('Combos tested', D.tested.toLocaleString('en-US'), `${D.passing.toLocaleString('en-US')} pass the guardrails`);

    // every backtest
    const pts = D.scatter.split(';').map((r) => { const [net, n, dd, pf, dir] = r.split(','); return { net: +net, n: +n, dd: +dd, pf: +pf, dir }; });
    pts.forEach((p) => { p.pass = p.n >= 100 && p.dd <= D.ddCap + 0.01; });
    $('#sc-title').textContent = `Every backtest · ${PAIR_NAME[pair]}`;
    $('#sc-sub').textContent = `${pts.length.toLocaleString('en-US')} settings combinations. Each dot is one run: net profit against its worst drawdown. The guardrails are at least 100 trades, and no more drawdown than the original.`;
    $('#sc-legend').innerHTML = `<li><span class="dotkey" style="background:${color}"></span>Passes guardrails</li><li><span class="dotkey" style="background:${css('--c-muted')}"></span>Breaks a guardrail</li><li><span class="ring" style="border-color:${css('--ink')}"></span>Original</li><li><span class="ring" style="border-color:${color};background:${color}40"></span>Pair script</li>`;
    sc.update({ pair, pts, ddCap: D.ddCap, color, orig: o, script: s });

    // top 10 table
    const th = ['Net', 'Trades', 'Win %', 'PF', 'Max DD', 'Trend', 'Pivot', 'EMA', 'Valid.', 'Pend.', 'Wick', 'Stop loss', 'RR', 'Direction'];
    $('#top-table').innerHTML = `<table class="data-table"><thead><tr>${th.map((t, i) => `<th class="${i < 5 ? 'num' : ''}">${t}</th>`).join('')}</tr></thead><tbody>${D.top.map((r) => {
      const hl = Math.abs(r[0] - s.net) < 0.01 && r[1] === s.n;
      return `<tr class="${hl ? 'hl' : ''}">${r.map((v, i) => `<td class="${i < 5 ? 'num' : ''}">${i === 0 ? money(v) : i === 4 ? money(v, false) : i === 2 ? v.toFixed(1) : i === 3 ? v.toFixed(2) : v}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>`;

    // settings side by side
    const rows = [['Trend mode', 'trend'], ['Pivot length', 'pivot'], ['EMA length', 'ema'], ['Setup validity', 'validity', ' candles'], ['Max pending', 'pending'], ['Wick tolerance', 'wick', ' ticks'], ['Stop loss', 'sl'], ['Reward:risk', 'rr']];
    const dirName = { both: 'Longs + shorts', long: 'Longs only', short: 'Shorts only' };
    $('#settings-table').innerHTML = '<thead><tr><th>Setting</th><th>Original</th><th>Pair script</th></tr></thead><tbody>' +
      rows.map(([lab, k, unit = '']) => {
        const a = o.settings[k], b = s.settings[k];
        return `<tr class="${String(a) !== String(b) ? 'changed' : ''}"><td>${lab}</td><td>${a}${unit}</td><td>${b}${unit}</td></tr>`;
      }).join('') +
      `<tr class="${o.dir !== s.dir ? 'changed' : ''}"><td>Direction</td><td>${dirName[o.dir]}</td><td>${dirName[s.dir]}</td></tr>` +
      `<tr><td>Position size</td><td>10% of equity</td><td>10% of equity</td></tr></tbody>`;

    // sensitivity small multiples on one shared scale
    const sens = Object.entries(D.sens).map(([name, str]) => ({ name, rows: parseSens(str) }));
    let lo = 0, hi = 0;
    sens.forEach((g) => g.rows.forEach((r) => { lo = Math.min(lo, r.net); hi = Math.max(hi, r.net); }));
    const span = hi - lo, zero = (-lo / span) * 100;
    const grid = $('#sens-grid');
    grid.replaceChildren();
    const order = ['Trend mode', 'Pivot length', 'EMA length', 'Setup validity', 'Max pending', 'Wick tolerance', 'Reward:risk', 'Direction', 'Stop loss'];
    const rowHtml = (r) => {
      const x = ((r.net - lo) / span) * 100, left = Math.min(x, zero), width = Math.abs(x - zero);
      const tipTxt = `${r.label}: ${money(r.net)} · ${r.n} trades${r.fail ? ' · breaks a guardrail' : ''}`;
      return `<div class="sens-row${r.pick ? ' pick' : ''}${r.fail ? ' fail' : ''}" title="${tipTxt}">
        <span class="lbl">${r.label}</span>
        <span class="sens-track"><span class="zero" style="left:${zero}%"></span><span class="bar ${r.net >= 0 ? 'r' : 'l'}" style="left:${left}%;width:${Math.max(width, 0.4)}%;${r.pick ? `background:${color}` : ''}"></span></span>
        <span class="val">${money(r.net)}</span></div>`;
    };
    for (const name of order) {
      const g = sens.find((x) => x.name === name);
      if (!g) continue;
      const p = h('div', 'panel panel-pad' + (name === 'Stop loss' ? ' wide' : ''), null, grid);
      p.style.padding = '16px 18px';
      h('div', 'label', name, p).style.marginBottom = '10px';
      if (name === 'Stop loss') {
        const cols = h('div', null, null, p);
        cols.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 28px';
        const swing = g.rows.filter((r) => /^Swing/.test(r.label)), nor = g.rows.filter((r) => !/^Swing/.test(r.label));
        for (const [title, list] of [['Last-swing stops (+ ticks, w = beyond the wick)', swing], ['NO-range stops (× candle range)', nor]]) {
          const c = h('div', null, `<p class="sens-foot" style="margin:0 0 6px">${title}</p>` + list.map(rowHtml).join(''), cols);
          c.style.display = 'grid'; c.style.gap = '4px';
        }
      } else {
        const inner = h('div', null, g.rows.map(rowHtml).join(''), p);
        inner.style.cssText = 'display:grid;gap:4px';
      }
      const lw = Math.max(...g.rows.map((r) => r.label.length)) * 7.2 + 6;
      p.querySelectorAll('.sens-row').forEach((r) => { r.style.gridTemplateColumns = `${Math.min(lw, 118)}px 1fr 58px`; });
    }

    // what worked / what didn't
    const N = NOTES[pair];
    $('#ww-worked').innerHTML = N.worked.map((t) => `<li>${t}</li>`).join('') +
      `<li>Sizing up to ${D.sizing.pick}% of equity per trade: ${money(sized.net)} with a ${sized.ddPct.toFixed(1)}% max drawdown.</li>`;
    const r100 = D.sizing.rows.find((r) => r.size === 100);
    $('#ww-failed').innerHTML = N.failed.map((t) => `<li>${t}</li>`).join('') +
      (r100 ? `<li>100% position size: ${r100.mc.toLocaleString('en-US')} margin calls, and the result fell to ${money(r100.net)}.</li>` : '');
  }
  show();
  initScaling(data);
}

// ------------------------------------------------------------------ scaling: size + leverage
function initScaling(data) {
  $('#size-legend').innerHTML = PAIRS.map((p) => `<li><span class="key" style="background:${COLOR[p]}"></span>${PAIR_NAME[p]}</li>`).join('');
  lineChart($('#size-chart'), {
    height: 300, endRoom: 116, interp: true, xMin: 0, xMax: 100, aria: 'Net profit by position size for each pair',
    vline: { x: 75, label: 'chosen: 75%' },
    xTicks: () => [[5, '5%'], [25, '25%'], [50, '50%'], [75, '75%'], [100, '100%']],
    yFmt: moneyK,
    tipTitle: (x) => `Position size ${Math.round(x)}%`,
    tipVal: (v) => money(v),
    series: PAIRS.map((p) => {
      const rows = data.pairs[p].sizing.rows;
      const endNet = rows[rows.length - 1].net;
      return { key: 'size' + p, name: PAIR_NAME[p], color: COLOR[p], pts: rows.map((r) => [r.size, r.net]), end: `${PAIR_NAME[p]} ${endNet > 0 ? '+' : ''}${moneyK(endNet)}` };
    }),
  });
  const levs = [1, 10, 20, 50];
  let lev = 20;
  const spx = data.spx, spxPts = [[0, 0], ...parseCurve(spx.curve).map(([x, y]) => [x, y / 1000])];
  const chart = lineChart($('#lev-chart'), {
    height: 300, endRoom: 112, aria: 'Return of each pair script compared with the S&P 500', series: [],
    yFmt: (v) => (v > 0 ? '+' : '') + v + '%', tipTitle: dateOf, tipVal: (v) => pct(v),
  });
  const seg = $('#lev-seg');
  levs.forEach((l) => {
    const b = h('button', null, l === 1 ? '1× · 10% size' : `${l}×`, seg);
    b.type = 'button';
    b.addEventListener('click', () => { lev = l; draw(); });
  });
  function draw() {
    [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', levs[i] === lev));
    $('#lev-title').textContent = `Return vs the S&P 500 · ${lev}× leverage`;
    const beat = PAIRS.filter((p) => data.pairs[p].lev.find((r) => r.lev === lev).pct > spx.pct).length;
    $('#lev-sub').textContent = `${lev === 1 ? '10% of equity per trade, no leverage.' : `10% of equity per trade × ${lev} (${lev * 10}% position size, ${100 / lev}% margin).`} The S&P 500 returned ${pct(spx.pct)} over the same dates. ${beat} of 4 pairs beat it at this level, with no margin calls.`;
    $('#lev-legend').innerHTML = PAIRS.map((p) => `<li><span class="key" style="background:${COLOR[p]}"></span>${PAIR_NAME[p]}</li>`).join('') + `<li><span class="key" style="background:${css('--c-spx')}"></span>S&amp;P 500 (buy &amp; hold)</li>`;
    chart.update({
      series: [
        ...PAIRS.map((p) => {
          const r = data.pairs[p].lev.find((x) => x.lev === lev);
          return { key: `lev${lev}${p}`, name: PAIR_NAME[p], color: COLOR[p], pts: closedCurve(r.curve).map(([x, y]) => [x, y / 1000]), end: `${PAIR_NAME[p]} ${pct(r.pct)}` };
        }),
        { key: 'spx', name: 'S&P 500', color: css('--c-spx'), pts: spxPts, end: `S&P 500 ${pct(spx.pct)}`, width: 2 },
      ],
    });
  }
  draw();
  $('#lev-table').innerHTML = `<table class="data-table"><thead><tr><th>Return (max drawdown)</th>${levs.map((l) => `<th class="num">${l}×</th>`).join('')}</tr></thead><tbody>` +
    PAIRS.map((p) => `<tr><td>${PAIR_NAME[p]}</td>${levs.map((l) => { const r = data.pairs[p].lev.find((x) => x.lev === l); return `<td class="num">${pct(r.pct)} <span style="color:var(--dim)">(${r.ddPct.toFixed(1)}%)</span></td>`; }).join('')}</tr>`).join('') +
    `<tr class="hl"><td>S&amp;P 500</td><td class="num" colspan="${levs.length}">${pct(spx.pct)} <span style="color:var(--dim)">(${spx.maxDDPct.toFixed(1)}%)</span> buy &amp; hold</td></tr></tbody></table>`;
}
