// Line drawing of a road bike, split into parts. Used as the Biking tile art and, in the Biking
// project, as an explorer: hover or click a part to see what it does and what I did to it.

const NS = 'http://www.w3.org/2000/svg';
const R = [185, 330], F = [615, 330], BB = [380, 340], SC = [335, 165], HT = [560, 160], HB = [572, 212];

export const BIKE_PARTS = [
  { id: 'chain', name: 'Chain', tag: 'Replaced · favourite rebuild',
    text: 'Carries the force from the chainring to the rear wheel. On my favourite rebuild, a badly corroded bike, it was one of the parts I replaced.' },
  { id: 'rder', name: 'Rear derailleur', tag: 'Replaced · favourite rebuild',
    text: 'Moves the chain across the cassette to change gear, and keeps it under tension with two small jockey wheels.' },
  { id: 'fder', name: 'Front derailleur', tag: 'Replaced · favourite rebuild',
    text: 'Pushes the chain between the chainrings at the front for a bigger jump in gearing.' },
  { id: 'cranks', name: 'Cranks & chainring', tag: 'Replaced · favourite rebuild',
    text: 'Turn the up-and-down push of your legs into rotation, the same job a crankshaft does in an engine.' },
  { id: 'pedals', name: 'Pedals', tag: 'Replaced · favourite rebuild',
    text: 'Where the force goes in. The full drivetrain replacement ran from the derailleurs and chain through to the cranks and pedals.' },
  { id: 'cassette', name: 'Cassette', tag: 'Drivetrain',
    text: 'The stack of rear sprockets: bigger ones for climbing, smaller ones for speed. Drivetrain faults were one of the two most common fixes.' },
  { id: 'brakes', name: 'Brakes & cables', tag: 'Brake faults fixed',
    text: 'Rim brakes squeeze the wheel rim to stop the bike. Diagnosing and fixing brake faults was the other big part of getting each bike safe to donate.' },
  { id: 'wheels', name: 'Wheels & tyres', tag: '',
    text: 'Rims, spokes and tyres carry the rider. A true wheel and a sound tyre matter for safety as much as the brakes do.' },
  { id: 'frame', name: 'Frame & fork', tag: '',
    text: 'The part everything else bolts onto. On a rebuild, it’s what you keep and build the rest of the bike back up around.' },
];

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent.appendChild(n);
  return n;
}
const P = (p) => p.map((v) => v.toFixed(1)).join(',');
const circle = (c, r) => `M${c[0] - r},${c[1]}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// each part is a list of [path, extra style]
function geometry() {
  const spokes = (c) => {
    let d = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; d += `M${P([c[0] + Math.cos(a) * 9, c[1] + Math.sin(a) * 9])}L${P([c[0] + Math.cos(a + 0.35) * 104, c[1] + Math.sin(a + 0.35) * 104])}`; }
    return d;
  };
  const ss = lerp(R, [340, 180], 0.52), fc = lerp(F, HB, 0.9);
  const pedal = [BB[0] + 30, BB[1] + 58], back = [BB[0] - 30, BB[1] - 58];
  return {
    wheels: [
      [circle(R, 118), 'tyre'], [circle(F, 118), 'tyre'], [circle(R, 106), ''], [circle(F, 106), ''],
      [spokes(R), 'thin'], [spokes(F), 'thin'], [circle(R, 8), ''], [circle(F, 8), ''],
    ],
    frame: [
      [`M${P(SC)}L${P(HT)}L${P(HB)}L${P(BB)}Z`, ''],
      [`M${P(BB)}L${P(R)}L340,180`, ''],
      [`M${P(HB)}Q586,272 ${P(F)}`, ''],
      [`M${P(SC)}L325,118M292,110Q330,100 372,108Q352,118 312,118Z`, ''],
      [`M${P(HT)}L566,138L598,134M592,134Q630,128 634,148Q636,168 616,174`, ''],
    ],
    cassette: [[circle(R, 32) + circle(R, 26) + circle(R, 20) + circle(R, 14), '']],
    chain: [[`M${P([BB[0], BB[1] - 42])}L${P([R[0], R[1] - 32])}M${P([BB[0], BB[1] + 42])}L207,405M199,372L${P([R[0] + 2, R[1] + 32])}`, 'chain']],
    rder: [[`M${P(R)}L176,350L193,366L207,398` + circle([193, 372], 7) + circle([207, 398], 7), '']],
    fder: [[`M352,278L376,284L373,296L349,290Z`, '']],
    cranks: [[circle(BB, 42) + circle(BB, 35) + `M${P(BB)}L${P(pedal)}`, ''], [`M${P(BB)}L${P(back)}`, 'thin']],
    pedals: [[`M${pedal[0] - 17},${pedal[1] - 5}h34v10h-34Z`, ''], [`M${back[0] - 14},${back[1] - 4}h28v8h-28Z`, 'thin']],
    brakes: [
      [`M${ss[0] - 14},${ss[1] - 14}q14,-12 28,0M${ss[0]},${ss[1] - 8}v-10`, ''],
      [`M${fc[0] - 14},${fc[1] - 12}q14,-12 28,0M${fc[0]},${fc[1] - 6}v-10`, ''],
      [`M630,140q10,6 6,22M606,136Q470,150 360,176Q300,200 ${P([ss[0], ss[1] - 18])}M628,150Q600,190 ${P([fc[0], fc[1] - 16])}`, 'thin'],
    ],
  };
}

// draw into an <svg>; returns { setActive(id), setHover(id) } for the interactive version
export function drawBike(svg, { interactive = false } = {}) {
  svg.setAttribute('viewBox', '0 0 800 470');
  svg.innerHTML = '';
  const G = geometry(), groups = {};
  const order = ['wheels', 'frame', 'cassette', 'chain', 'cranks', 'rder', 'fder', 'pedals', 'brakes'];
  for (const id of order) {
    const g = el('g', { class: 'bk-part', 'data-part': id }, svg);
    for (const [d, cls] of G[id]) el('path', { d, class: 'bk-line ' + cls }, g);
    if (interactive) for (const [d] of G[id]) el('path', { d, class: 'bk-hit' }, g);
    groups[id] = g;
  }
  const state = { hover: null, active: null };
  const paint = () => {
    const focus = state.hover || state.active;
    svg.classList.toggle('has-focus', !!focus);
    for (const id in groups) groups[id].classList.toggle('on', id === focus);
  };
  return {
    groups,
    setHover(id) { state.hover = id; paint(); },
    setActive(id) { state.active = id; paint(); },
  };
}

// Biking project: drawing + parts list, hover either one to highlight, click to open the part's notes
export function initBikeProject(root) {
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  const svg = root.querySelector('.bike-svg');
  const list = root.querySelector('.bike-parts');
  const bike = drawBike(svg, { interactive: true });
  const items = {};
  let open = null;
  for (const p of BIKE_PARTS) {
    const li = document.createElement('li');
    li.className = 'part-item';
    li.innerHTML = `<button class="part-btn" type="button" aria-expanded="false">
        <span class="part-swatch"></span><span class="part-name">${p.name}</span>
        ${p.tag ? `<span class="bk-tag">${p.tag}</span>` : ''}
        <svg class="part-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <div class="part-body"><div><div class="part-body-in"><p>${p.text}</p></div></div></div>`;
    const btn = li.querySelector('button');
    btn.addEventListener('click', () => toggle(p.id));
    btn.addEventListener('mouseenter', () => bike.setHover(p.id));
    btn.addEventListener('mouseleave', () => bike.setHover(null));
    list.appendChild(li);
    items[p.id] = { li, btn };
  }
  function toggle(id) {
    open = open === id ? null : id;
    for (const k in items) {
      items[k].li.classList.toggle('open', k === open);
      items[k].btn.setAttribute('aria-expanded', k === open);
    }
    bike.setActive(open);
  }
  for (const [id, g] of Object.entries(bike.groups)) {
    g.addEventListener('mouseenter', () => { bike.setHover(id); items[id].li.classList.add('hot'); });
    g.addEventListener('mouseleave', () => { bike.setHover(null); items[id].li.classList.remove('hot'); });
    g.addEventListener('click', () => toggle(id));
  }
}
