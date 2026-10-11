// Ghost Ball (project 05): the drag-the-balls demo. main.js opens and closes the panel like the other projects.

const $ = (s, r = document) => r.querySelector(s);

// stop the reel when the project is minimised or another one opens
window.addEventListener('hashchange', () => {
  const video = $('#gb-video');
  if (video && !video.paused && !/^#\/?projects\/ghostball/.test(location.hash)) video.pause();
});

// the real app in its phone frame: only fetched once the section is near the screen, and only on screens wide
// enough to show the frame (phones get the full-screen button instead)
const live = $('.gb-live iframe');
if (live && 'IntersectionObserver' in window) {
  const wide = matchMedia('(min-width: 761px)');
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting) || !wide.matches) return;
    live.src = live.dataset.src;
    io.disconnect();
  }, { rootMargin: '400px 0px' });
  io.observe(live.closest('.gb-live'));
} else if (live) live.src = live.dataset.src;

// buttons that jump within the panel (plain #anchors would be read as routes by the site's router)
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-gb-scroll]');
  if (!b) return;
  e.preventDefault();
  const to = document.getElementById(b.dataset.gbScroll);
  if (to) to.scrollIntoView({ behavior: document.documentElement.classList.contains('reduce-motion') ? 'auto' : 'smooth', block: 'start' });
});

/* ======================= the demo =======================
   The same maths as the app (ghost-ball/index.html: potDirect, potBank, potKick), for one white and one red on a
   UK 7ft table. Canonical units: the playing area is 1200 x 600, the length of the table = 1830 mm. */
const L = 1200, HALF = 600, DEG = Math.PI / 180, MAX_CUT = 80;
const KMM = L / 1830, R = 50.8 / 2 * KMM, RC = 47.6 / 2 * KMM, S = R + RC, WC = 88 * KMM, WM = 92 * KMM;
const SKILLS = {
  beginner: { label: 'Beginner', sigma: 0.2, cutErr: 2.0, cushionErr: 2.5 },
  club: { label: 'Club', sigma: 0.1, cutErr: 1.2, cushionErr: 1.6 },
  strong: { label: 'Strong', sigma: 0.05, cutErr: 0.7, cushionErr: 1.0 },
};
const KINDS = { any: 'Best shot', direct: 'Straight', bank: 'Bank', kick: 'Kick' };
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dir = (a) => [Math.cos(a), Math.sin(a)];
function erf(x) {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const chance = (phi, lo, hi, sd) => Phi(wrap(hi - phi) / sd) - Phi(wrap(lo - phi) / sd);
const POCKETS = (() => {
  const a = WC / Math.SQRT2, hm = WM / 2;
  return [
    { name: 'Top-left', pt: [0, 0], jaws: [[a, 0], [0, a]], corner: true },
    { name: 'Top middle', pt: [L / 2, 0], jaws: [[L / 2 - hm, 0], [L / 2 + hm, 0]], corner: false },
    { name: 'Top-right', pt: [L, 0], jaws: [[L - a, 0], [L, a]], corner: true },
    { name: 'Bottom-right', pt: [L, HALF], jaws: [[L, HALF - a], [L - a, HALF]], corner: true },
    { name: 'Bottom middle', pt: [L / 2, HALF], jaws: [[L / 2 + hm, HALF], [L / 2 - hm, HALF]], corner: false },
    { name: 'Bottom-left', pt: [0, HALF], jaws: [[a, HALF], [0, HALF - a]], corner: true },
  ];
})();
// Cushions by the coordinate their nose fixes (axis 0: x, 1: y) and its value.
const CUSHIONS = [
  { axis: 1, at: 0, name: 'top' }, { axis: 1, at: HALF, name: 'bottom' },
  { axis: 0, at: 0, name: 'left' }, { axis: 0, at: L, name: 'right' },
];

// Directions a ball at T can leave in and still drop between the jaws, each jaw cleared by a ball radius.
function jawWindow(T, jaws, r) {
  let [J1, J2] = jaws;
  let a1 = Math.atan2(J1[1] - T[1], J1[0] - T[0]);
  const a2 = Math.atan2(J2[1] - T[1], J2[0] - T[0]);
  let span = wrap(a2 - a1);
  if (span < 0) { [J1, J2] = [J2, J1]; a1 = a2; span = -span; }
  const d1 = dist(J1, T), d2 = dist(J2, T);
  if (d1 <= r || d2 <= r) return null;
  const lo = a1 + Math.asin(r / d1), hi = a1 + span - Math.asin(r / d2);
  return hi > lo ? { lo, hi, J1, J2 } : null;
}
// The window of the white's directions (from C) that send the ball at T inside [lo, hi], found by bisection.
function hitWindow(C, T, s, lo, hi) {
  const psi = Math.atan2(T[1] - C[1], T[0] - C[0]), D = dist(T, C);
  if (D < s * 0.98) return null;
  const bmax = Math.asin(Math.min(1, s / D)) - 1e-6, lim = Math.PI / 2 - 0.02;
  let rlo = wrap(lo - psi), rhi = wrap(hi - psi);
  if (rhi < rlo) return null;
  rlo = Math.max(rlo, -lim); rhi = Math.min(rhi, lim);
  if (rhi <= rlo) return null;
  const wx = T[0] - C[0], wy = T[1] - C[1];
  const at = (beta) => {
    const ang = psi + beta, ux = Math.cos(ang), uy = Math.sin(ang), bb = ux * wx + uy * wy;
    const t = bb - Math.sqrt(Math.max(0, bb * bb - (D * D - s * s)));
    const G = [C[0] + t * ux, C[1] + t * uy];
    return { G, u: [ux, uy], phi: wrap(Math.atan2(T[1] - G[1], T[0] - G[0]) - psi) };
  };
  const dec = at(-bmax).phi > at(bmax).phi;
  const solve = (target) => {
    let a = -bmax, b = bmax;
    for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if ((at(m).phi > target) === dec) a = m; else b = m; }
    return (a + b) / 2;
  };
  const b1 = solve(rlo), b2 = solve(rhi);
  const hit = (d) => {
    const beta = wrap(d - psi), h = at(beta), eps = 1e-5;
    const slope = Math.abs(at(beta + eps).phi - at(beta - eps).phi) / (2 * eps);
    const phi = psi + h.phi;
    return { G: h.G, u: h.u, phi, dvec: dir(phi), cut: Math.abs(wrap(h.phi - beta)) / DEG, slope };
  };
  return { lo: psi + Math.min(b1, b2), hi: psi + Math.max(b1, b2), aim: psi + (b1 + b2) / 2, wlo: psi + rlo, whi: psi + rhi, hit };
}
const onTable = (p, rad) => p[0] >= rad && p[0] <= L - rad && p[1] >= rad && p[1] <= HALF - rad;
function mouth(T, d, w) {
  const ex = w.J2[0] - w.J1[0], ey = w.J2[1] - w.J1[1], den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((w.J1[0] - T[0]) * ey - (w.J1[1] - T[1]) * ex) / den;
  return t > 0 ? [T[0] + d[0] * t, T[1] + d[1] * t] : null;
}
function segDist(P, A, B) {
  const ex = B[0] - A[0], ey = B[1] - A[1], l2 = ex * ex + ey * ey;
  const t = l2 ? Math.max(0, Math.min(1, ((P[0] - A[0]) * ex + (P[1] - A[1]) * ey) / l2)) : 0;
  return Math.hypot(A[0] + t * ex - P[0], A[1] + t * ey - P[1]);
}
// cushions: the line a ball centre runs along while touching cushion c, mirroring across it, and where a run meets it
const railLine = (c, rad) => (c.at ? c.at - rad : rad);
const mirror = (c, rad, p) => { const q = [p[0], p[1]]; q[c.axis] = 2 * railLine(c, rad) - p[c.axis]; return q; };
function railHit(c, rad, P, Q) {
  const k = railLine(c, rad), a = c.axis, t = (k - P[a]) / (Q[a] - P[a]);
  return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])];
}
// a ball meeting the cushion line at p hits the cushion itself, clear of the pocket jaws
function onRail(c, p) {
  const v = p[1 - c.axis], len = c.axis === 1 ? L : HALF, a = WC / Math.SQRT2 + 0.6 * R;
  if (v < a || v > len - a) return false;
  return c.axis === 0 || Math.abs(v - L / 2) > WM / 2 + 0.6 * R;
}
const reach = (q) => (q.corner ? WC * 0.75 : WM * 0.6);
const missesPockets = (A, B, into) => POCKETS.every((q) => q === into || segDist(q.pt, A, B) >= reach(q));
const throwSd = (sk, cut) => sk.cutErr * DEG * Math.sin(cut * DEG);
const finish = (shot) => ({ ...shot, P: chance(shot.k.phi, shot.h.wlo, shot.h.whi, Math.max(1e-6, shot.sd)) });

// The window as the eye sees it: from the red to the pocket mouth, folded at the cushion for a bank.
function straightWedge(T, w, h) {
  const m1 = mouth(T, dir(h.wlo), w) || w.J1, m2 = mouth(T, dir(h.whi), w) || w.J2;
  return { fill: [[T, m1, m2]], edges: [[T, m1], [T, m2]] };
}

function potDirect(C, T, pk, sk) {
  const w = jawWindow(T, pk.jaws, R), h = w && hitWindow(C, T, S, w.lo, w.hi);
  if (!h) return null;
  const k = h.hit(h.aim);
  if (k.cut > MAX_CUT || !onTable(k.G, RC)) return null;
  const E = mouth(T, k.dvec, w) || pk.pt;
  const sd = Math.hypot(sk.sigma * DEG * k.slope, throwSd(sk, k.cut));
  return finish({ type: 'direct', pk, h, k, sd, cuePath: [C, k.G], objPath: [T, E], wedge: straightWedge(T, w, h) });
}
// The red off cushion c into pk: aim it at the pocket's mirror image across the cushion.
function potBank(C, T, pk, c, sk) {
  if (pk.pt[c.axis] === c.at) return null; // the pocket is on this cushion
  const w = jawWindow(T, pk.jaws.map((p) => mirror(c, R, p)), R), h = w && hitWindow(C, T, S, w.lo, w.hi);
  if (!h) return null;
  const k = h.hit(h.aim);
  if (k.cut > MAX_CUT || !onTable(k.G, RC)) return null;
  const Em = mouth(T, k.dvec, w);
  if (!Em) return null;
  const K = railHit(c, R, T, Em), E = mirror(c, R, Em);
  if (dist(T, K) < R || !onRail(c, K)) return null;
  if (!missesPockets(T, K, null) || !missesPockets(K, E, pk)) return null;
  const off = dist(K, E) / (dist(T, K) + dist(K, E)); // a cushion error only acts on the run after it
  const sd = Math.hypot(sk.sigma * DEG * k.slope, throwSd(sk, k.cut), sk.cushionErr * DEG * off);
  // the window, folded back at the cushion
  const m1 = mouth(T, dir(h.wlo), w) || w.J1, m2 = mouth(T, dir(h.whi), w) || w.J2;
  const K1 = railHit(c, R, T, m1), K2 = railHit(c, R, T, m2), M1 = mirror(c, R, m1), M2 = mirror(c, R, m2);
  const wedge = { fill: [[T, K1, K2], [K1, M1, M2, K2]], edges: [[T, K1, M1], [T, K2, M2]] };
  return finish({ type: 'bank', pk, c, h, k, sd, cuePath: [C, k.G], objPath: [T, K, E], wedge });
}
// The white off cushion c, then a straight pot: the white comes from its own mirror image.
function potKick(C, T, pk, c, sk) {
  const Cm = mirror(c, RC, C);
  const w = jawWindow(T, pk.jaws, R), h = w && hitWindow(Cm, T, S, w.lo, w.hi);
  if (!h) return null;
  const k = h.hit(h.aim);
  if (k.cut > MAX_CUT || !onTable(k.G, RC)) return null;
  const K = railHit(c, RC, Cm, k.G), E = mouth(T, k.dvec, w) || pk.pt;
  // the white must really travel to the cushion and away from it again, without touching the red on the way
  if (dist(C, K) < RC || dist(K, k.G) < 2 * RC || !onRail(c, K) || segDist(T, C, K) < S) return null;
  if (!missesPockets(C, K, null) || !missesPockets(K, k.G, null)) return null;
  const off = dist(K, k.G) / (dist(C, K) + dist(K, k.G));
  const aimSd = Math.hypot(sk.sigma, sk.cushionErr * off) * DEG;
  const sd = Math.hypot(aimSd * k.slope, throwSd(sk, k.cut));
  return finish({ type: 'kick', pk, c, h, k, sd, cuePath: [C, K, k.G], objPath: [T, E], wedge: straightWedge(T, w, h) });
}
// every shot the filter allows, into one pocket or all of them; the most likely wins
function solve(C, T, sk, only, kind) {
  let best = null;
  const keep = (s) => { if (s && (!best || s.P > best.P)) best = s; };
  POCKETS.forEach((pk, i) => {
    if (only != null && i !== only) return;
    if (kind === 'any' || kind === 'direct') keep(potDirect(C, T, pk, sk));
    for (const c of CUSHIONS) {
      if (kind === 'any' || kind === 'bank') keep(potBank(C, T, pk, c, sk));
      if (kind === 'any' || kind === 'kick') keep(potKick(C, T, pk, c, sk));
    }
  });
  if (best) best.i = POCKETS.indexOf(best.pk);
  return best;
}

function demo(root) {
  const svg = $('.gb-play-svg', root), NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const pos = { C: [736, 371], T: [1009, 342] }; // the sample table's best shot (overwritten from data-start)
  try { Object.assign(pos, JSON.parse(root.dataset.start || '{}')); } catch (e) { /* keep defaults */ }
  let skill = 'club', kind = 'any', locked = null;

  // static table
  el('rect', { x: -60, y: -60, width: L + 120, height: HALF + 120, rx: 28, class: 'rail-o' }, svg);
  el('rect', { x: 0, y: 0, width: L, height: HALF, class: 'cloth' }, svg);
  el('rect', { x: 0, y: 0, width: L, height: HALF, class: 'nose' }, svg);
  const pk = POCKETS.map((p, i) => {
    const c = el('circle', { cx: p.pt[0], cy: p.pt[1], r: (p.corner ? WC : WM) * 0.55, class: 'pkt', tabindex: 0, role: 'button', 'aria-label': `${p.name} pocket: aim for this pocket` }, svg);
    const pick = () => { locked = locked === i ? null : i; update(); };
    c.addEventListener('click', pick);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    return c;
  });
  // dynamic layers
  const wedge = el('path', { class: 'wedge' }, svg), we1 = el('path', { class: 'wedge-e' }, svg), we2 = el('path', { class: 'wedge-e' }, svg);
  const kiss = el('circle', { r: 9, class: 'kiss' }, svg);
  const stun = el('line', { class: 'stunline' }, svg), aimx = el('line', { class: 'aimext' }, svg), aim = el('path', { class: 'aimline' }, svg);
  const obj = el('path', { class: 'objline' }, svg), head = el('path', { class: 'objhead' }, svg);
  const ghost = el('circle', { r: RC, class: 'ghost' }, svg), contact = el('circle', { r: 7, class: 'contact' }, svg);
  const nope = el('text', { class: 'nope', x: L / 2, y: HALF / 2, 'text-anchor': 'middle' }, svg);
  const ball = (key, cls, r, label) => {
    const g = el('g', { class: 'ball', tabindex: 0, role: 'button', 'aria-label': `${label}. Drag it, or use the arrow keys` }, svg);
    g._hit = el('circle', { r: r + 26, class: 'hit' }, g); el('circle', { r: r + 7, class: 'ring' }, g);
    el('circle', { r, class: cls }, g); el('circle', { r: r * 0.24, cx: -r * 0.36, cy: -r * 0.38, class: 'shine' }, g);
    g._key = key; g._r = r; return g;
  };
  const W = ball('C', 'w', RC, 'White ball'), O = ball('T', 'o', R, 'Red ball');
  const labW = el('text', { class: 'lab', 'text-anchor': 'middle' }, svg), labO = el('text', { class: 'lab', 'text-anchor': 'middle' }, svg);
  labW.textContent = 'WHITE'; labO.textContent = 'RED';
  // on a phone the table is small: keep each ball's touch target at least 48 px across, and the labels legible
  let unit = 1; // table units per CSS pixel
  const fit = () => {
    const w = svg.getBoundingClientRect().width; if (!w) return;
    unit = 1320 / w;
    [W, O].forEach((g) => g._hit.setAttribute('r', Math.max(g._r + 26, 24 * unit)));
    [labW, labO].forEach((t) => t.style.fontSize = `${Math.max(22, 10.5 * unit)}px`);
    update();
  };
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(svg);

  const out = {
    pct: $('[data-gb="pct"]', root), lvl: $('[data-gb="lvl"]', root), shot: $('[data-gb="shot"]', root), pocket: $('[data-gb="pocket"]', root),
    cut: $('[data-gb="cut"]', root), tol: $('[data-gb="tol"]', root), win: $('[data-gb="win"]', root),
    mag: $('[data-gb="mag"]', root), sd: $('[data-gb="sd"]', root), bell: $('.gb-bell', root),
  };
  const set = (e, v) => { if (e && e.textContent !== v) e.textContent = v; };
  const line = (e, a, b) => { e.setAttribute('x1', a[0]); e.setAttribute('y1', a[1]); e.setAttribute('x2', b[0]); e.setAttribute('y2', b[1]); };
  const poly = (pts, close) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('') + (close ? 'Z' : '');

  function bell(res) {
    const B = out.bell; if (!B) return;
    B.textContent = '';
    const w = 320, h = 110, base = 92, sd = res ? res.sd : 1;
    const g = (tag, a) => el(tag, a, B);
    g('line', { x1: 0, y1: base, x2: w, y2: base, class: 'axis' });
    if (!res) return;
    const lo = wrap(res.h.wlo - res.k.phi), hi = wrap(res.h.whi - res.k.phi);
    const span = Math.max(4 * sd, 1.25 * Math.max(Math.abs(lo), Math.abs(hi)));
    const X = (a) => w / 2 + a / span * (w / 2), pdf = (a) => Math.exp(-0.5 * (a / sd) ** 2);
    let d = '', fillD = `M${X(Math.max(lo, -span))},${base}`;
    for (let i = 0; i <= 120; i++) {
      const a = -span + 2 * span * i / 120, y = base - 74 * pdf(a);
      d += (i ? 'L' : 'M') + X(a).toFixed(1) + ',' + y.toFixed(1);
      if (a >= lo && a <= hi) fillD += `L${X(a).toFixed(1)},${y.toFixed(1)}`;
    }
    fillD += `L${X(Math.min(hi, span))},${base}Z`;
    g('path', { d: fillD, class: 'in' }); g('path', { d, class: 'pdf' });
    [lo, hi].forEach((a) => { if (Math.abs(a) <= span) g('line', { x1: X(a), y1: 14, x2: X(a), y2: base, class: 'edge' }); });
    const t = (x, y, s, anchor) => { const e = g('text', { x, y, 'text-anchor': anchor }); e.textContent = s; };
    t(4, h - 3, `−${(span / DEG).toFixed(1)}°`, 'start'); t(w - 4, h - 3, `+${(span / DEG).toFixed(1)}°`, 'end');
    t(w / 2, h - 3, 'OBJECT BALL DIRECTION', 'middle'); t(w / 2, 10, 'INSIDE THE JAWS', 'middle');
  }

  function update() {
    const sk = SKILLS[skill], C = pos.C, T = pos.T;
    W.setAttribute('transform', `translate(${C[0]} ${C[1]})`); O.setAttribute('transform', `translate(${T[0]} ${T[1]})`);
    const gap = Math.max(34, 22 * unit);
    labW.setAttribute('x', C[0]); labW.setAttribute('y', C[1] + RC + gap);
    labO.setAttribute('x', T[0]); labO.setAttribute('y', T[1] + R + gap);
    const res = solve(C, T, sk, locked, kind);
    pk.forEach((c, i) => c.classList.toggle('on', res ? res.i === i : locked === i));
    const show = !!res;
    [wedge, we1, we2, stun, aimx, aim, obj, head, ghost, contact].forEach((e) => e.style.display = show ? '' : 'none');
    kiss.style.display = show && res.c ? '' : 'none';
    nope.style.display = show ? 'none' : '';
    set(out.lvl, `${sk.label} player`);
    if (!res) {
      const what = kind === 'any' ? 'pot' : KINDS[kind].toLowerCase();
      nope.textContent = locked != null ? `No clean ${what} into the ${POCKETS[locked].name.toLowerCase()}` : `No clean ${what} from here`;
      set(out.pct, '–'); set(out.shot, '–'); set(out.pocket, locked != null ? POCKETS[locked].name : '–');
      ['cut', 'tol', 'win', 'mag', 'sd'].forEach((k) => set(out[k], '–'));
      bell(null); return;
    }
    const { k, h, wedge: wg, objPath } = res;
    // the window: every direction that drops, drawn as a wedge from the red to the pocket mouth
    wedge.setAttribute('d', wg.fill.map((p) => poly(p, true)).join(''));
    we1.setAttribute('d', poly(wg.edges[0])); we2.setAttribute('d', poly(wg.edges[1]));
    aim.setAttribute('d', poly(res.cuePath));
    line(aimx, k.G, [k.G[0] + k.u[0] * 260, k.G[1] + k.u[1] * 260]);
    const ud = k.u[0] * k.dvec[0] + k.u[1] * k.dvec[1], vt = [k.u[0] - ud * k.dvec[0], k.u[1] - ud * k.dvec[1]], nt = Math.hypot(vt[0], vt[1]) || 1;
    line(stun, k.G, [k.G[0] + vt[0] / nt * 240 * Math.min(1, nt * 2), k.G[1] + vt[1] / nt * 240 * Math.min(1, nt * 2)]);
    // the red's path, stopped short of the mouth for the arrowhead
    const A = objPath[objPath.length - 2], E = objPath[objPath.length - 1], dl = dist(A, E) || 1, dv = [(E[0] - A[0]) / dl, (E[1] - A[1]) / dl];
    const end = [E[0] - dv[0] * 18, E[1] - dv[1] * 18];
    obj.setAttribute('d', poly([...objPath.slice(0, -1), [end[0] - dv[0] * 14, end[1] - dv[1] * 14]]));
    const n = [-dv[1], dv[0]];
    head.setAttribute('d', `M${end[0]},${end[1]}L${end[0] - dv[0] * 28 + n[0] * 12},${end[1] - dv[1] * 28 + n[1] * 12}L${end[0] - dv[0] * 28 - n[0] * 12},${end[1] - dv[1] * 28 - n[1] * 12}Z`);
    if (res.c) { const K = res.type === 'bank' ? objPath[1] : res.cuePath[1]; kiss.setAttribute('cx', K[0]); kiss.setAttribute('cy', K[1]); }
    ghost.setAttribute('cx', k.G[0]); ghost.setAttribute('cy', k.G[1]);
    contact.setAttribute('cx', k.G[0] + k.dvec[0] * RC); contact.setAttribute('cy', k.G[1] + k.dvec[1] * RC);
    const pct = Math.max(1, Math.min(99, Math.round(res.P * 100)));
    set(out.pct, `${pct}%`); set(out.pocket, res.pk.name);
    set(out.shot, res.type === 'direct' ? 'Straight' : `${res.type === 'bank' ? 'Bank' : 'Kick'}, ${res.c.name} cushion`);
    set(out.cut, `${k.cut.toFixed(0)}°`);
    set(out.tol, `±${((h.hi - h.lo) / 2 / DEG).toFixed(2)}°`);
    set(out.win, `${((h.whi - h.wlo) / DEG).toFixed(1)}°`);
    set(out.mag, `×${k.slope.toFixed(2)}`);
    set(out.sd, `${(res.sd / DEG).toFixed(2)}°`);
    bell(res);
  }

  // dragging (pointer) and nudging (keyboard), keeping both balls on the cloth and apart
  const clampBall = (key, p) => {
    const r = key === 'C' ? RC : R, other = pos[key === 'C' ? 'T' : 'C'];
    let x = Math.min(L - r, Math.max(r, p[0])), y = Math.min(HALF - r, Math.max(r, p[1]));
    const d = Math.hypot(x - other[0], y - other[1]);
    if (d < S + 2) { const ux = d ? (x - other[0]) / d : 1, uy = d ? (y - other[1]) / d : 0; x = other[0] + ux * (S + 2); y = other[1] + uy * (S + 2); }
    return [Math.min(L - r, Math.max(r, x)), Math.min(HALF - r, Math.max(r, y))];
  };
  const toTable = (e) => {
    const m = svg.getScreenCTM(); if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  [W, O].forEach((g) => {
    let off = null;
    g.addEventListener('pointerdown', (e) => {
      const p = toTable(e); if (!p) return;
      off = [pos[g._key][0] - p[0], pos[g._key][1] - p[1]];
      g.setPointerCapture(e.pointerId); g.classList.add('drag'); e.preventDefault();
    });
    g.addEventListener('pointermove', (e) => {
      if (!off) return;
      const p = toTable(e); if (!p) return;
      pos[g._key] = clampBall(g._key, [p[0] + off[0], p[1] + off[1]]); update();
    });
    const end = () => { off = null; g.classList.remove('drag'); };
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    g.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 10, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      const p = pos[g._key]; pos[g._key] = clampBall(g._key, [p[0] + d[0], p[1] + d[1]]); update();
    });
  });
  const segment = (attr, apply) => root.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () => {
    apply(b.getAttribute(attr));
    root.querySelectorAll(`[${attr}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    update();
  }));
  segment('data-gb-skill', (v) => { skill = v; });
  segment('data-gb-kind', (v) => { kind = v; });
  const reset = $('[data-gb-reset]', root);
  if (reset) {
    const start = JSON.parse(JSON.stringify(pos));
    reset.addEventListener('click', () => {
      pos.C = start.C.slice(); pos.T = start.T.slice(); locked = null; kind = 'any';
      root.querySelectorAll('[data-gb-kind]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.gbKind === 'any')));
      update();
    });
  }
  update();
}
document.querySelectorAll('.gb-play').forEach(demo);
