// Interactive V8 viewer. Geometry comes from the SOLIDWORKS model (V8 Engine\source\Web.cs exports
// every unique part in its own frame); the pistons and rods are placed with the same Spec maths the
// CAD assembly uses, so the running engine here matches the SOLIDWORKS motion exactly.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ------------------------------------------------------------------ engine geometry (mm, degrees)
const S = Math.SQRT1_2, THROW = 46, ROD = 154.8, SPACING = 111.76, STAGGER = 11.9, DECK = 234.95;
const PIN_DEG = [0, 90, 270, 180];                       // cross-plane crank
const FIRING = [1, 8, 7, 2, 6, 5, 4, 3];
const sigma = (n) => (n % 2 ? 1 : -1);                   // +1 left bank (odd), -1 right bank (even)
const throwOf = (n) => (n - 1) >> 1;
const zCyl = (n) => -throwOf(n) * SPACING + sigma(n) * STAGGER;
const crankPin = (k, deg) => { const ph = ((PIN_DEG[k] + deg) * Math.PI) / 180; return [THROW * Math.sin(ph), THROW * Math.cos(ph)]; };
function pinDist(n, deg) {
  const c = crankPin(throwOf(n), deg), u = [sigma(n) * S, S];
  const along = c[0] * u[0] + c[1] * u[1], perp = u[0] * c[1] - u[1] * c[0];
  return along + Math.sqrt(ROD * ROD - perp * perp);
}
// compression TDC of each cylinder on the 720° cycle (TDC is when the crank pin lines up with the bore)
const FIRE_AT = {};
FIRING.forEach((n, i) => { FIRE_AT[n] = 45 + 90 * i; });
for (const n of FIRING) {
  const tdc = (((sigma(n) * 45 - PIN_DEG[throwOf(n)]) % 360) + 360) % 360;
  console.assert(tdc === FIRE_AT[n] % 360, 'firing order does not match crank geometry', n);
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const along = (sg, a) => v3(sg * S * a, S * a, 0);      // along a bank's bore axis
const Z = () => v3(0, 0, 0);

// ------------------------------------------------------------------ what each part is
const GROUPS = [
  { id: 'crank', cat: 'Rotating assembly', name: 'Crankshaft', parts: ['Crankshaft'], count: '×1',
    blurb: 'Turns the pistons’ up-and-down motion into rotation. It’s a cross-plane crank: the four rod journals sit at 0°, 90°, 270° and 180°, and each one is shared by two rods, one from each bank. The cam-shaped webs double as counterweights.',
    specs: [['Stroke', '92.0 mm (46.0 mm throw)'], ['Main journals', '5 × Ø64.8 mm'], ['Rod journals', '4 × Ø53.3 mm'], ['Phasing', '0 / 90 / 270 / 180°']],
    explode: Z, pull: () => v3(0, -330, 0) },
  { id: 'pistons', cat: 'Rotating assembly', name: 'Pistons & wrist pins', parts: ['Piston', 'Wrist Pin'], count: '×8',
    blurb: 'Flat-top pistons with three ring grooves and two valve reliefs each, joined to the rods by wrist pins. Their position at every crank angle comes straight from the slider-crank equation.',
    specs: [['Diameter', '98.6 mm in a 99.0 mm bore'], ['Compression height', '33.8 mm'], ['Wrist pin', 'Ø23.5 × 60 mm'], ['Ring grooves', '3']],
    explode: Z, pull: (i) => along(i.sg, 240) },
  { id: 'rods', cat: 'Rotating assembly', name: 'Connecting rods', parts: ['Connecting Rod'], count: '×8',
    blurb: 'I-beam rods with pocketed beams and cap-bolt bosses. The big end rides on a crank journal, the small end on the wrist pin, and each rod swings as the crank turns.',
    specs: [['Centre to centre', '154.8 mm'], ['Rod : stroke', '1.68'], ['Big-end bore', 'Ø53.5 mm'], ['Small-end bore', 'Ø23.7 mm']],
    explode: Z, pull: (i) => along(i.sg, 120).add(v3(0, 0, i.sg * 30)) },
  { id: 'balancer', cat: 'Rotating assembly', name: 'Harmonic balancer', parts: ['Harmonic Balancer'], count: '×1',
    blurb: 'Bolted to the front of the crank. It damps torsional vibration in the crankshaft and carries the six-groove pulley that drives the accessory belt.',
    specs: [['Diameter', '200 mm'], ['Belt grooves', '6'], ['Mounted on', 'Ø50 mm crank snout']],
    explode: () => v3(0, 0, 440), pull: () => v3(0, 0, 320) },
  { id: 'flywheel', cat: 'Rotating assembly', name: 'Flywheel', parts: ['Flywheel'], count: '×1',
    blurb: 'Stores rotational energy to smooth out the power pulses between firing strokes. The starter motor engages its ring gear to crank the engine.',
    specs: [['Ring gear', '140 teeth'], ['Diameter', '304 mm'], ['Fixing', '6 bolts to the crank flange']],
    explode: () => v3(0, 0, -240), pull: () => v3(0, 0, -300) },
  { id: 'block', cat: 'Block & top end', name: 'Engine block', parts: ['Engine Block'], count: '×1',
    blurb: 'The foundation. It holds the eight cylinder bores in two banks at 90°, the main bearing bore for the crank, and the crankcase bays between the bulkheads. X-ray mode makes it see-through so you can watch the internals.',
    specs: [['Bore', 'Ø99.0 mm'], ['Bore spacing', '111.76 mm'], ['Deck height', '234.95 mm'], ['Bank offset', '23.8 mm']],
    explode: Z, pull: Z },
  { id: 'heads', cat: 'Block & top end', name: 'Cylinder heads', parts: ['Cylinder Head Left', 'Cylinder Head Right'], count: '×2',
    blurb: 'They close off the top of each bank. Each head has four intake ports on the valley side and four exhaust ports on the outside.',
    specs: [['Height', '105 mm'], ['Ports per head', '4 intake + 4 exhaust']],
    explode: (i) => along(i.sg, 170), pull: (i) => along(i.sg, 210) },
  { id: 'covers', cat: 'Block & top end', name: 'Valve covers', parts: ['Valve Cover Left', 'Valve Cover Right'], count: '×2',
    blurb: 'Red covers seal the top of each head. The left one carries the oil filler cap.',
    specs: [['Height', '48 mm'], ['Oil filler cap', 'Ø44 mm, left cover']],
    explode: (i) => along(i.sg, 300), pull: (i) => along(i.sg, 300) },
  { id: 'ignition', cat: 'Block & top end', name: 'Ignition', parts: ['Ignition Left', 'Ignition Right'], count: '×2',
    blurb: 'Coil-near-plug ignition: one coil pack per cylinder on top of the valve covers, with red leads running down to the spark plug boots on the side of each head.',
    specs: [['Coil packs', '8'], ['Plug leads', '8']],
    explode: (i) => along(i.sg, 430), pull: (i) => along(i.sg, 380) },
  { id: 'intake', cat: 'Breathing', name: 'Intake manifold', parts: ['Intake Manifold'], count: '×1',
    blurb: 'A long plenum in the valley of the V feeds eight runners into the heads. Air enters through the throttle body at the front, and fuel rails run along both sides.',
    specs: [['Runners', '8'], ['Throttle bore', 'Ø58 mm'], ['Fuel rails', '2']],
    explode: () => v3(0, 400, 0), pull: () => v3(0, 330, 0) },
  { id: 'exhaust', cat: 'Breathing', name: 'Exhaust manifolds', parts: ['Exhaust Manifold Left', 'Exhaust Manifold Right'], count: '×2',
    blurb: 'Four primaries on each side merge into a collector, which turns down into the outlet pipe.',
    specs: [['Primaries', '4 per side'], ['Outlet', 'Ø52 mm']],
    explode: (i) => v3(i.sg * 310, 110, 0), pull: (i) => v3(i.sg * 270, 0, 0) },
  { id: 'pan', cat: 'Ancillaries', name: 'Oil pan', parts: ['Oil Pan'], count: '×1',
    blurb: 'A wet sump that holds the oil, with a deeper well at the rear, a drain plug, and a blue spin-on oil filter at the front.',
    specs: [['Sump depth', '145 mm at the rear'], ['Oil filter', 'Ø76 mm']],
    explode: () => v3(0, -300, 0), pull: () => v3(0, -320, 0) },
  { id: 'timing', cat: 'Ancillaries', name: 'Timing cover', parts: ['Timing Cover'], count: '×1',
    blurb: 'Closes off the front of the block and carries the water pump and its pulley.',
    specs: [['Water pump pulley', 'Ø80 mm']],
    explode: () => v3(0, 0, 250), pull: () => v3(0, 0, 280) },
];
const GROUP_OF_PART = {};
GROUPS.forEach((g) => g.parts.forEach((p) => { GROUP_OF_PART[p] = g; }));

const ACCENT = new THREE.Color('#ffffff');
const EDGE_NORMAL = new THREE.Color('#ffffff');
const EDGE_BLUE = new THREE.Color('#e5e5e5');

// ------------------------------------------------------------------ init
let started = false;
export async function initV8() {
  if (started) return;
  started = true;
  const stage = document.getElementById('viewer-stage');
  const canvas = document.getElementById('v8-canvas');
  const loading = document.getElementById('v8-loading');
  const tip = document.getElementById('v8-tip');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.classList.add('failed');
    document.getElementById('v8-loading-text').textContent = 'Your browser can’t show 3D (WebGL is off). The renders below show the model.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(600, 1200, 900);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 1.5);
  rim.position.set(-900, 500, -800);
  scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#dcdcdc', 0.6);
  rim2.position.set(900, -200, -600);
  scene.add(rim2);
  scene.add(new THREE.HemisphereLight('#ffffff', '#111111', 0.45));
  const fireLight = new THREE.PointLight('#ffffff', 0, 520, 0);
  scene.add(fireLight);

  const grid = new THREE.GridHelper(2400, 40, 0x2e2e2e, 0x181818);
  grid.position.set(0, -278, -150);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
  const HOME_TARGET = v3(0, 50, -150);
  const HOME_DIR = v3(1, 0.62, 1.12).normalize();
  // back the camera off on narrow (portrait) viewers so the whole engine fits across
  const homePos = () => HOME_TARGET.clone().add(HOME_DIR.clone().multiplyScalar(2050 * Math.max(1, 1.05 / camera.aspect)));
  let cameraMoved = false;
  camera.position.copy(homePos());
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 450;
  controls.maxDistance = 4200;
  controls.autoRotate = !document.documentElement.classList.contains('reduce-motion');
  controls.autoRotateSpeed = 0.55;
  controls.addEventListener('start', () => { controls.autoRotate = false; cameraMoved = true; });
  // don't trap page scrolling: wheel zoom switches on once you click into the model,
  // and on touch screens one finger scrolls the page while two fingers rotate and zoom
  controls.enableZoom = false;
  canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
  stage.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  // keyboard: Tab to the model, arrow keys turn it (Shift for bigger steps), + and − zoom
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive 3D model of the V8 engine. Use the arrow keys to turn it, and + or − to zoom.');
  canvas.addEventListener('keydown', (e) => {
    const step = (e.shiftKey ? 30 : 10) * Math.PI / 180;
    const turn = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    const zoom = { '+': 0.85, '=': 0.85, '-': 1 / 0.85, '_': 1 / 0.85 }[e.key];
    if (!turn && !zoom) return;
    e.preventDefault();
    controls.autoRotate = false; cameraMoved = true;
    const off = camera.position.clone().sub(controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    if (turn) { s.theta += turn[0]; s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi - turn[1])); }
    if (zoom) s.radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, s.radius * zoom));
    camera.position.copy(controls.target).add(off.setFromSpherical(s));
    controls.update();
  });
  if (window.matchMedia('(pointer: coarse)').matches) {
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    canvas.style.touchAction = 'pan-y';
    const hint = document.querySelector('.v-title p');
    if (hint) hint.textContent = 'Two fingers to rotate & zoom · tap a part';
  }

  // ---------------------------------------------------------------- load exported geometry
  const base = new URL('../data/', import.meta.url);
  const [meta, buf] = await Promise.all([
    fetch(new URL('v8.json', base)).then((r) => { if (!r.ok) throw new Error('v8.json ' + r.status); return r.json(); }),
    fetch(new URL('v8.bin', base)).then((r) => { if (!r.ok) throw new Error('v8.bin ' + r.status); return r.arrayBuffer(); }),
  ]);
  const partMeta = {};
  meta.parts.forEach((p) => { partMeta[p.name] = p; });

  // one material set per group so a whole group can highlight or ghost together
  const groupState = {};
  GROUPS.forEach((g) => {
    groupState[g.id] = { g, mats: [], edgeMat: null, meshes: [], instances: [], pull: 0, swatch: null };
  });
  const matCache = {};
  function materialFor(gid, cg) {
    const k = gid + '|' + cg.rgb.join(',');
    if (matCache[k]) return matCache[k];
    const [r, gg, b] = cg.rgb, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
    const painted = sat > 0.35, plastic = mx < 0.16;
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(r, gg, b, THREE.SRGBColorSpace),
      metalness: painted ? 0.15 : plastic ? 0.05 : 0.78,
      roughness: painted ? 0.32 : plastic ? 0.62 : Math.max(0.22, 0.62 - cg.shine * 0.35),
      side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      emissive: ACCENT.clone(), emissiveIntensity: 0,
    });
    m.userData.baseColor = m.color.clone();
    matCache[k] = m;
    groupState[gid].mats.push(m);
    if (!groupState[gid].swatch) groupState[gid].swatch = '#' + m.color.getHexString(THREE.SRGBColorSpace);
    return m;
  }

  // SOLIDWORKS face tessellation isn't guaranteed to wind consistently; orient each triangle to its normals
  function fixWinding(pos, nrm, idx) {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
      a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
      b.sub(a); c.sub(a); b.cross(c);
      n.set(nrm[i0 * 3] + nrm[i1 * 3] + nrm[i2 * 3], nrm[i0 * 3 + 1] + nrm[i1 * 3 + 1] + nrm[i2 * 3 + 1], nrm[i0 * 3 + 2] + nrm[i1 * 3 + 2] + nrm[i2 * 3 + 2]);
      if (b.dot(n) < 0) { idx[t + 1] = i2; idx[t + 2] = i1; }
    }
  }

  const geoCache = {};
  function partGeometry(name) {
    if (geoCache[name]) return geoCache[name];
    const p = partMeta[name];
    if (!p) throw new Error('missing part ' + name);
    const meshes = p.groups.map((cg) => {
      const pos = new Float32Array(buf, cg.pos, cg.nv * 3);
      const nrm = new Int8Array(buf, cg.nrm, cg.nv * 3);
      const idx = cg.wide ? new Uint32Array(buf.slice(cg.idx, cg.idx + cg.ni * 4)) : new Uint16Array(buf.slice(cg.idx, cg.idx + cg.ni * 2));
      fixWinding(pos, nrm, idx);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3, true));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      return { geo, cg };
    });
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, p.edges.off, p.edges.n * 3), 3));
    return (geoCache[name] = { meshes, edges: eg });
  }

  function makeInstance(partName, extra = {}) {
    const g = GROUP_OF_PART[partName], st = groupState[g.id];
    const obj = new THREE.Group();
    const pg = partGeometry(partName);
    for (const { geo, cg } of pg.meshes) {
      const mesh = new THREE.Mesh(geo, materialFor(g.id, cg));
      mesh.userData.gid = g.id;
      obj.add(mesh);
      st.meshes.push(mesh);
    }
    if (!st.edgeMat) st.edgeMat = new THREE.LineBasicMaterial({ color: EDGE_NORMAL, transparent: true, opacity: 0.1, depthWrite: false });
    const lines = new THREE.LineSegments(pg.edges, st.edgeMat);
    lines.raycast = () => {};
    obj.add(lines);
    const inst = { part: partName, group: g, obj, sg: /Left/.test(partName) ? 1 : /Right/.test(partName) ? -1 : 0, ...extra };
    st.instances.push(inst);
    scene.add(obj);
    return inst;
  }

  // static parts sit in engine coordinates; moving parts are posed every frame
  const staticParts = ['Engine Block', 'Cylinder Head Left', 'Cylinder Head Right', 'Valve Cover Left', 'Valve Cover Right', 'Ignition Left', 'Ignition Right',
    'Intake Manifold', 'Exhaust Manifold Left', 'Exhaust Manifold Right', 'Oil Pan', 'Timing Cover'];
  staticParts.forEach((p) => makeInstance(p));
  const crankParts = ['Crankshaft', 'Harmonic Balancer', 'Flywheel'].map((p) => makeInstance(p, { rotates: true }));
  const cyl = [];
  for (let n = 1; n <= 8; n++) {
    cyl.push({
      n, sg: sigma(n), z: zCyl(n),
      piston: makeInstance('Piston', { sg: sigma(n), n }),
      pin: makeInstance('Wrist Pin', { sg: sigma(n), n }),
      rod: makeInstance('Connecting Rod', { sg: sigma(n), n }),
    });
  }
  const allInstances = GROUPS.flatMap((g) => groupState[g.id].instances);
  const pickables = GROUPS.flatMap((g) => groupState[g.id].meshes);

  // combustion glow sprites, one per cylinder, just above the piston crown at TDC
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  cyl.forEach((c) => {
    const m = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, opacity: 0 });
    c.glow = new THREE.Sprite(m);
    c.glow.scale.setScalar(120);
    c.glow.position.set(c.sg * S * (DECK + 6), S * (DECK + 6), c.z);
    c.glow.renderOrder = 10;
    scene.add(c.glow);
  });

  // ---------------------------------------------------------------- UI: parts list + HUD
  const list = document.getElementById('parts-list');
  const items = {};
  let lastCat = '';
  for (const g of GROUPS) {
    if (g.cat !== lastCat) {
      const h = document.createElement('li'); h.className = 'parts-cat'; h.textContent = g.cat; list.appendChild(h); lastCat = g.cat;
    }
    const st = groupState[g.id];
    const feats = [...new Set(g.parts.filter((p) => !/Right/.test(p)).flatMap((p) => partMeta[p].features))];
    const pm = partMeta[g.parts[0]];
    const faces = g.parts.filter((p) => !/Right/.test(p)).reduce((s, p) => s + partMeta[p].faces, 0);
    const li = document.createElement('li');
    li.className = 'part-item';
    li.innerHTML = `
      <button class="part-btn" type="button" aria-expanded="false">
        <span class="part-swatch" style="background:${st.swatch}"></span>
        <span class="part-name">${g.name}</span><span class="part-count">${g.count}</span>
        <svg class="part-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <div class="part-body"><div><div class="part-body-in">
        <p>${g.blurb}</p>
        <dl class="spec-dl">${g.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
          <dt>Volume</dt><dd>${pm.volumeCm3.toLocaleString('en-US', { maximumFractionDigits: 0 })} cm³${g.count !== '×1' ? ' each' : ''}</dd>
          <dt>CAD faces</dt><dd>${faces}</dd></dl>
        <p class="feat-title">Built from ${feats.length} SolidWorks features</p>
        <div class="feat-chips">${feats.map((f) => `<span>${f}</span>`).join('')}</div>
      </div></div></div>`;
    const btn = li.querySelector('.part-btn');
    btn.addEventListener('click', () => select(selected === g.id ? null : g.id, true));
    btn.addEventListener('mouseenter', () => setHover(g.id, 'list'));
    btn.addEventListener('mouseleave', () => setHover(null, 'list'));
    btn.addEventListener('focus', () => setHover(g.id, 'list'));
    btn.addEventListener('blur', () => setHover(null, 'list'));
    list.appendChild(li);
    items[g.id] = { li, btn };
  }

  const firingEl = document.getElementById('hud-firing');
  const chips = {};
  FIRING.forEach((n) => { const i = document.createElement('i'); i.textContent = n; firingEl.appendChild(i); chips[n] = i; });
  const angleEl = document.getElementById('hud-angle');
  const rpmInput = document.getElementById('hud-rpm'), rpmOut = document.getElementById('hud-rpm-v');
  let rpm = +rpmInput.value;
  rpmInput.addEventListener('input', () => { rpm = +rpmInput.value; rpmOut.textContent = rpm + ' rpm'; });

  // ---------------------------------------------------------------- state
  let theta = 0, running = true, explode = 0, explodeGoal = 0, xray = true, blueprint = false;
  let hovered = null, listHover = null, canvasHover = null, selected = null;
  const targetGoal = HOME_TARGET.clone();

  const tools = document.querySelectorAll('.v-tools button');
  const toolBtn = (act) => document.querySelector(`.v-tools [data-act="${act}"]`);
  tools.forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'run') { running = !running; syncRun(); }
    if (act === 'explode') { explodeGoal = explodeGoal ? 0 : 1; b.setAttribute('aria-pressed', !!explodeGoal); }
    if (act === 'xray') { xray = !xray; b.setAttribute('aria-pressed', xray); applyLook(); }
    if (act === 'blueprint') { blueprint = !blueprint; b.setAttribute('aria-pressed', blueprint); applyLook(); }
    if (act === 'reset') {
      select(null); explodeGoal = 0; toolBtn('explode').setAttribute('aria-pressed', false);
      camera.position.copy(homePos()); targetGoal.copy(HOME_TARGET); controls.target.copy(HOME_TARGET);
      cameraMoved = false;
    }
  }));
  function syncRun() {
    const b = toolBtn('run');
    b.setAttribute('aria-pressed', running);
    b.querySelector('.i-pause').style.display = running ? '' : 'none';
    b.querySelector('.i-play').style.display = running ? 'none' : '';
  }

  // colours, transparency and edge style for every group, from the current mode + hover/selection
  function applyLook() {
    for (const g of GROUPS) {
      const st = groupState[g.id];
      const isSel = selected === g.id, isHov = hovered === g.id;
      const ghost = selected && !isSel;
      const glass = g.id === 'block' && xray && !isSel;
      let opacity = 1;
      if (glass) opacity = 0.13;
      if (ghost) opacity = g.id === 'block' && xray ? 0.05 : 0.07;
      const transparent = opacity < 1;
      for (const m of st.mats) {
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = !transparent;
        m.colorWrite = !blueprint;
        m.emissiveIntensity = blueprint ? 0 : isSel ? 0.1 : isHov ? 0.2 : 0;
      }
      const em = st.edgeMat;
      em.color.copy(isSel || isHov ? ACCENT : blueprint ? EDGE_BLUE : EDGE_NORMAL);
      em.opacity = isSel || isHov ? 0.95 : blueprint ? (ghost ? 0.1 : glass ? 0.35 : 0.8) : ghost ? 0.03 : glass ? 0.12 : 0.09;
      em.depthTest = true;
    }
    grid.visible = true;
  }

  function setHover(id, src) {
    if (src === 'list') listHover = id; else canvasHover = id;
    const next = listHover || canvasHover;
    canvas.classList.toggle('hovering', !!canvasHover);
    if (next === hovered) return;
    hovered = next;
    for (const k in items) items[k].li.classList.toggle('hot', k === hovered);
    applyLook();
  }

  function select(id, fromList = false) {
    selected = id;
    for (const k in items) {
      const open = k === id;
      items[k].li.classList.toggle('open', open);
      items[k].btn.setAttribute('aria-expanded', open);
    }
    // bring the part's notes into view inside the list only, so the page (and the 3D model) doesn't jump
    if (id && !fromList) list.scrollBy({ top: items[id].li.getBoundingClientRect().top - list.getBoundingClientRect().top - 8, behavior: 'smooth' });
    // aim the camera at where the part will end up once it has been pulled out
    if (id) {
      const box = new THREE.Box3();
      for (const inst of groupState[id].instances) {
        inst.obj.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(inst.obj);
        const shift = inst.group.pull(inst).clone().multiplyScalar(1 - groupState[id].pull);
        b.translate(shift);
        box.union(b);
      }
      box.getCenter(targetGoal);
      controls.autoRotate = false;
    } else targetGoal.copy(HOME_TARGET);
    applyLook();
  }

  // ---------------------------------------------------------------- picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pointer = null, downAt = null;
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickables, false);
    if (!hits.length) return null;
    // prefer solid parts over the see-through block and ghosted parts
    const solid = hits.find((h) => { const id = h.object.userData.gid; return !(selected && selected !== id) && !(id === 'block' && xray); });
    return (solid || hits[0]).object.userData.gid;
  }
  canvas.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { pointer = null; tip.hidden = true; setHover(null, 'canvas'); });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const id = pick(e.clientX, e.clientY);
    select(id && id !== selected ? id : null);   // clicking the open part or empty space puts it back
  });
  function updateHover() {
    if (!pointer) return;
    const id = pick(pointer.x, pointer.y);
    if (id !== canvasHover) setHover(id, 'canvas');
    if (id) {
      const r = stage.getBoundingClientRect(), g = groupState[id].g;
      tip.hidden = false;
      tip.innerHTML = `${g.name}<small>${selected === id ? 'Click again to put it back' : 'Click to inspect'}</small>`;
      const x = pointer.x - r.left, y = pointer.y - r.top;
      tip.style.left = Math.min(x, r.width - 220) + 'px';
      tip.style.top = Math.min(y, r.height - 60) + 'px';
    } else tip.hidden = true;
  }

  // ---------------------------------------------------------------- kinematics
  const tmp = new THREE.Vector3();
  function pose() {
    const th = theta % 360, rad = (th * Math.PI) / 180;
    for (const inst of crankParts) inst.obj.rotation.set(0, 0, -rad);
    for (const c of cyl) {
      const d = pinDist(c.n, th), ux = c.sg * S, uy = S;
      c.piston.obj.position.set(ux * d, uy * d, c.z);
      c.piston.obj.rotation.set(0, 0, (-c.sg * Math.PI) / 4);
      c.pin.obj.position.copy(c.piston.obj.position);
      c.pin.obj.rotation.copy(c.piston.obj.rotation);
      const cp = crankPin(throwOf(c.n), th), dx = ux * d - cp[0], dy = uy * d - cp[1];
      c.rod.obj.position.set(cp[0], cp[1], c.z);
      c.rod.obj.rotation.set(0, 0, Math.atan2(-dx, dy));
    }
    for (const inst of allInstances) {
      if (!inst.n && !inst.rotates) inst.obj.position.set(0, 0, 0);
      if (inst.rotates) inst.obj.position.set(0, 0, 0);
      const st = groupState[inst.group.id];
      if (explode > 0.0005) inst.obj.position.add(tmp.copy(inst.group.explode(inst)).multiplyScalar(explode));
      if (st.pull > 0.0005) inst.obj.position.add(tmp.copy(inst.group.pull(inst)).multiplyScalar(st.pull));
    }
  }

  function fire() {
    const cyc = theta % 720;
    let strongest = 0, at = null;
    for (const c of cyl) {
      const phase = (((cyc - FIRE_AT[c.n]) % 720) + 720) % 720;
      const f = phase < 150 ? Math.pow(1 - phase / 150, 1.8) : 0;   // flash at TDC, fading through the power stroke
      c.glow.material.opacity = f * (blueprint ? 0.55 : 0.7);
      chips[c.n].classList.toggle('on', phase < 90);
      if (f > strongest) { strongest = f; at = c; }
    }
    if (at) fireLight.position.copy(at.glow.position);
    fireLight.intensity = blueprint ? 0 : strongest * 1.8;
    angleEl.textContent = Math.round(theta % 360) + '°';
  }

  // ---------------------------------------------------------------- render loop
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!cameraMoved) {
      // keep the auto-rotate angle, just refit the distance
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(homePos().distanceTo(HOME_TARGET)));
    }
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  applyLook();

  let last = 0, visible = true, raf = 0;
  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (running) theta = (theta + dt * rpm * 6) % 720;          // rpm × 360° / 60 s
    const k = 1 - Math.exp(-dt * 5);
    explode += (explodeGoal - explode) * k;
    for (const g of GROUPS) { const st = groupState[g.id]; st.pull += ((selected === g.id ? 1 : 0) - st.pull) * k; }
    controls.target.lerp(targetGoal, 1 - Math.exp(-dt * 3));
    pose();
    fire();
    updateHover();
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  pose();
  renderer.render(scene, camera);
  loading.classList.add('done');
  document.getElementById('viewer').classList.add('ready');
  wake();
}
