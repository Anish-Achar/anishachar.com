// Interactive rocket fin can + flutter lab. Geometry and every part's placement come from the SOLIDWORKS
// assembly (EirSpace Fin Can\cad\source\Web.cs); the numbers come from the Python analysis
// (analysis\export_web.py). The flutter lab runs the same NACA TN 4197 check as the analysis, over the
// whole simulated trajectory, every time the slider moves.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initCharts, minFlutterMargin } from './fincan-charts.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const Z = () => v3(0, 0, 0);
const R_OUT = 51;          // fin root (airframe outer radius), mm
const TWIST_Y = 115;       // fin mid-chord, the torsion axis for the flutter animation
const BASE_T = 4.0;        // fin thickness the CAD was built at, mm

// ------------------------------------------------------------------ what each part is (model frame: +Y forward)
const GROUPS = [
  { id: 'airframe', cat: 'Outside', name: 'Airframe section', parts: ['Airframe (fin can section)'], count: '×1', finish: 'composite',
    blurb: 'The aft 650 mm of a 102 mm filament-wound glass airframe. Four slots let the fin tabs pass through the wall to the motor mount, so each fin is held by the tube wall and the inner tube, not just glued on. X-ray makes it see-through.',
    specs: [['Outside diameter', '102 mm'], ['Wall', '1.8 mm'], ['Length', '650 mm'], ['Fin slots', '4 × 4.4 mm (fin + 0.4 mm for epoxy)']],
    explode: Z, pull: Z },
  { id: 'fins', cat: 'Outside', name: 'Fins', parts: ['Fin'], count: '×4', finish: 'paint',
    blurb: 'Swept “katana” leading edge, trailing edge square to the body. Flutter, not strength, sized them: they’re the thinnest G10 sheet that keeps the flutter speed 1.5× above the flight speed for the whole flight. Each tab runs through the airframe wall to the motor mount.',
    specs: [['Root / tip chord', '200 / 80 mm'], ['Span', '80 mm'], ['Leading-edge sweep', '56°'], ['Sheet', '4.0 mm G10'], ['Flutter margin', '1.95×'], ['Bending FoS', '152']],
    explode: (i) => i.radial.clone().multiplyScalar(110), pull: (i) => i.radial.clone().multiplyScalar(60) },
  { id: 'mmt', cat: 'Motor mount', name: 'Motor mount tube', parts: ['Motor Mount Tube'], count: '×1', finish: 'composite',
    blurb: 'A 54 mm glass tube that holds the K700W. The motor’s thrust ring bears on its aft end, and the load goes out through the centering rings and fin tabs into the airframe.',
    specs: [['Outside diameter', '57.4 mm'], ['Wall', '1.4 mm'], ['Length', '600 mm']],
    explode: () => v3(0, -700, 0), pull: Z },
  { id: 'rings', cat: 'Motor mount', name: 'Centering rings', parts: ['Centering Ring 6 mm'], count: '×2', finish: 'wood',
    blurb: 'Birch-ply rings that hold the motor mount on the airframe’s axis. The aft one is the most critical part of the fin can: if it alone carried the full 1,617 N design thrust, its factor of safety would be 2.31, from an axisymmetric plate-bending solution.',
    specs: [['Material', '6 mm birch ply'], ['Positions', '20 and 220 mm from the aft end'], ['Bending FoS (aft)', '2.31'], ['Bond shear FoS', '6.7']],
    explode: (i) => v3(0, i.base.y > 100 ? -700 : -750, 0), pull: Z },
  { id: 'retainer', cat: 'Motor mount', name: 'Motor retainer', parts: ['Motor Retainer'], count: '×1', finish: 'metal',
    blurb: 'A screw-on aluminium retainer: a sleeve round the motor-mount end that clears the motor’s thrust ring, with a cap lip behind the motor so the ejection charge can’t push it out. My first version clashed with the motor in the interference check, which is how this one came about.',
    specs: [['Material', 'Aluminium'], ['Mass', '44 g']],
    explode: () => v3(0, -800, 0), pull: () => v3(0, -60, 0) },
  { id: 'motor', cat: 'Motor mount', name: 'K700W motor', parts: ['K700W Motor (reference)'], count: '×1', finish: 'paint',
    blurb: 'The AeroTech K700W the simulation flies, from its certification thrust curve. It’s in the model as a reference, to check that everything fits round it.',
    specs: [['Total impulse', '2,249 Ns'], ['Burn time', '3.59 s'], ['Peak thrust', '1,029 N (certified), 1,617 N listed'], ['Size', 'Ø54 × 568 mm']],
    explode: () => v3(0, -350, 320), pull: () => v3(0, -260, 0) },
  { id: 'fwdring', cat: 'Recovery', name: 'Forward ring / bulkhead', parts: ['Forward Ring - Recovery Bulkhead'], count: '×1', finish: 'wood',
    blurb: 'A 12 mm ring at the front of the motor mount that doubles as the parachute attachment. It takes the main parachute’s 2.1 kN opening shock through the U-bolt, which sits at 45° between two fins.',
    specs: [['Material', '12 mm birch ply'], ['Design load', '2,068 N (30 g)'], ['Bending FoS', '34'], ['Washer pull-through FoS', '5.3 (1.6 if the drogue fails)']],
    explode: () => v3(0, -650, 0), pull: Z },
  { id: 'ubolt', cat: 'Recovery', name: 'U-bolt', parts: ['U-bolt M6'], count: '×1', finish: 'metal',
    blurb: 'M6 A2-70 stainless, with washers and nuts. Its legs sit on a 39 mm radius, 22 mm apart, through the forward ring.',
    specs: [['Leg stress', '51 MPa vs 450 MPa yield'], ['Factor of safety', '8.8 (2.7 if the drogue fails)']],
    explode: () => v3(0, -650, 0), pull: () => v3(0, 70, 0) },
];
const GROUP_OF_PART = {};
GROUPS.forEach((g) => g.parts.forEach((p) => { GROUP_OF_PART[p] = g; }));

// what the fins look like in each lab material
const FIN_LOOK = {
  'G10 fibreglass': { short: 'G10', color: null, metal: 0.15, rough: 0.35 },
  'Carbon fibre (0/90)': { short: 'Carbon', color: '#181818', metal: 0.35, rough: 0.3 },
  'Birch aircraft ply': { short: 'Ply', color: '#c9a46e', metal: 0, rough: 0.75 },
  'Aluminium 6061-T6': { short: 'Alu', color: '#c8ccd2', metal: 0.9, rough: 0.28 },
};
const FINISH = { composite: [0.05, 0.45], wood: [0, 0.75], metal: [0.85, 0.3], paint: [0.15, 0.35] };

const ACCENT = new THREE.Color('#ffffff');
const EDGE_NORMAL = new THREE.Color('#ffffff');
const EDGE_BLUE = new THREE.Color('#e5e5e5');
const HOT = new THREE.Color('#f05252');

let started = false;
export async function initFinCan() {
  if (started) return;
  started = true;
  const stage = document.getElementById('fc-stage');
  const canvas = document.getElementById('fc-canvas');
  const loading = document.getElementById('fc-loading');
  const tip = document.getElementById('fc-tip');
  const reduced = document.documentElement.classList.contains('reduce-motion');

  const base = new URL('../data/', import.meta.url);
  const dataP = fetch(new URL('fincan-data.json', base)).then((r) => { if (!r.ok) throw new Error('fincan-data.json ' + r.status); return r.json(); });

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.classList.add('failed');
    document.getElementById('fc-loading-text').textContent = 'Your browser can’t show 3D (WebGL is off). The renders further down show the model.';
    initCharts(await dataP);
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
  key.position.set(500, 900, 900);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 1.4);
  rim.position.set(-800, 400, -700);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#ffffff', '#111111', 0.45));

  // the rocket lies along world +X (nose to the right): model +Y (forward) -> world +X
  const root = new THREE.Group();
  root.rotation.z = -Math.PI / 2;
  scene.add(root);

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 250;
  controls.maxDistance = 4000;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.5;
  let cameraMoved = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; cameraMoved = true; camAnim = null; });
  controls.enableZoom = false;
  canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
  stage.addEventListener('pointerleave', () => { controls.enableZoom = false; });
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Interactive 3D model of the rocket fin can. Use the arrow keys to turn it, and + or − to zoom.');
  canvas.addEventListener('keydown', (e) => {
    const step = (e.shiftKey ? 30 : 10) * Math.PI / 180;
    const turn = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    const zoom = { '+': 0.85, '=': 0.85, '-': 1 / 0.85, '_': 1 / 0.85 }[e.key];
    if (!turn && !zoom) return;
    e.preventDefault();
    controls.autoRotate = false; cameraMoved = true; camAnim = null;
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
    const hint = document.querySelector('#fc-viewer .v-title p');
    if (hint) hint.textContent = 'Two fingers to rotate & zoom · tap a part';
  }

  // ---------------------------------------------------------------- geometry
  const [meta, buf, data] = await Promise.all([
    fetch(new URL('fincan.json', base)).then((r) => { if (!r.ok) throw new Error('fincan.json ' + r.status); return r.json(); }),
    fetch(new URL('fincan.bin', base)).then((r) => { if (!r.ok) throw new Error('fincan.bin ' + r.status); return r.arrayBuffer(); }),
    dataP,
  ]);
  const charts = initCharts(data);
  const partMeta = {};
  meta.parts.forEach((p) => { partMeta[p.name] = p; });

  const groupState = {};
  GROUPS.forEach((g) => { groupState[g.id] = { g, mats: [], edgeMat: null, meshes: [], instances: [], pull: 0, swatch: null }; });
  const matCache = {};
  function materialFor(g, cg) {
    const k = g.id + '|' + cg.rgb.join(',');
    if (matCache[k]) return matCache[k];
    const [metal, rough] = FINISH[g.finish];
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(cg.rgb[0], cg.rgb[1], cg.rgb[2], THREE.SRGBColorSpace),
      metalness: metal, roughness: rough, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      emissive: ACCENT.clone(), emissiveIntensity: 0,
    });
    m.userData.baseColor = m.color.clone();
    matCache[k] = m;
    groupState[g.id].mats.push(m);
    if (!groupState[g.id].swatch) groupState[g.id].swatch = '#' + m.color.getHexString(THREE.SRGBColorSpace);
    return m;
  }

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

  // one object per assembly instance, placed with the SOLIDWORKS transform (columns = the part's axes)
  const fins = [];
  for (const ins of meta.instances) {
    const g = GROUP_OF_PART[ins.part];
    if (!g) continue;
    const st = groupState[g.id];
    const m4 = new THREE.Matrix4().set(
      ins.x[0], ins.y[0], ins.z[0], ins.t[0],
      ins.x[1], ins.y[1], ins.z[1], ins.t[1],
      ins.x[2], ins.y[2], ins.z[2], ins.t[2],
      0, 0, 0, 1);
    const obj = new THREE.Group();
    m4.decompose(obj.position, obj.quaternion, obj.scale);
    let holder = obj;
    let flex = null;
    if (g.id === 'fins') {
      // pivots for the flutter animation: bending about the root, torsion about the mid-chord
      const bend = new THREE.Group(), bendIn = new THREE.Group(), twist = new THREE.Group(), twistIn = new THREE.Group();
      bend.position.set(R_OUT, 0, 0); bendIn.position.set(-R_OUT, 0, 0);
      twist.position.set(0, TWIST_Y, 0); twistIn.position.set(0, -TWIST_Y, 0);
      obj.add(bend); bend.add(bendIn); bendIn.add(twist); twist.add(twistIn);
      holder = twistIn;
      flex = { bend, twist, twistIn, phase: fins.length * 0.9 };
    }
    const pg = partGeometry(ins.part);
    for (const { geo, cg } of pg.meshes) {
      const mesh = new THREE.Mesh(geo, materialFor(g, cg));
      mesh.userData.gid = g.id;
      holder.add(mesh);
      st.meshes.push(mesh);
    }
    if (!st.edgeMat) st.edgeMat = new THREE.LineBasicMaterial({ color: EDGE_NORMAL, transparent: true, opacity: 0.1, depthWrite: false });
    const lines = new THREE.LineSegments(pg.edges, st.edgeMat);
    lines.raycast = () => {};
    holder.add(lines);
    const inst = { part: ins.part, group: g, obj, base: obj.position.clone(), radial: v3(ins.x[0], ins.x[1], ins.x[2]), flex };
    st.instances.push(inst);
    if (flex) fins.push(inst);
    root.add(obj);
  }
  const allInstances = GROUPS.flatMap((g) => groupState[g.id].instances);
  const pickables = GROUPS.flatMap((g) => groupState[g.id].meshes);
  const finMats = groupState.fins.mats;
  finMats.forEach((m) => { m.userData.g10 = m.color.clone(); });

  // ---------------------------------------------------------------- framing
  const tmp = new THREE.Vector3();
  function pose(explode) {
    for (const inst of allInstances) {
      inst.obj.position.copy(inst.base);
      const st = groupState[inst.group.id];
      if (explode > 0.0005) inst.obj.position.add(tmp.copy(inst.group.explode(inst)).multiplyScalar(explode));
      if (st.pull > 0.0005) inst.obj.position.add(tmp.copy(inst.group.pull(inst)).multiplyScalar(st.pull));
    }
  }
  const boxAt = (e) => { pose(e); root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); };
  const explodeBox = boxAt(1);
  const homeBox = boxAt(0);              // leaves everything in place
  const HOME_TARGET = homeBox.getCenter(new THREE.Vector3());
  const EXPLODE_TARGET = explodeBox.getCenter(new THREE.Vector3());
  const explodeSize = explodeBox.getSize(new THREE.Vector3()).length();
  const homeSize = homeBox.getSize(new THREE.Vector3()).length();
  const HOME_DIR = v3(0.22, 0.42, 1).normalize();
  const fitDist = (size) => (size * 0.44) / Math.tan((camera.fov * Math.PI) / 360) * Math.max(1, 1.25 / camera.aspect);
  const homePos = () => HOME_TARGET.clone().add(HOME_DIR.clone().multiplyScalar(fitDist(homeSize)));
  camera.position.copy(homePos());
  controls.target.copy(HOME_TARGET);

  const grid = new THREE.GridHelper(3200, 32, 0x2e2e2e, 0x181818);
  grid.position.set(HOME_TARGET.x, homeBox.min.y - 30, 0);
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  // smooth camera moves (explode / reset), cancelled as soon as the visitor grabs the model
  let camAnim = null;
  function flyTo(target, dist) {
    const dir = camera.position.clone().sub(controls.target).normalize();
    camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: target.clone().add(dir.multiplyScalar(dist)), t1: target.clone(), k: 0 };
  }

  // ---------------------------------------------------------------- parts list
  const list = document.getElementById('fc-parts');
  const items = {};
  let lastCat = '';
  for (const g of GROUPS) {
    if (g.cat !== lastCat) {
      const h = document.createElement('li'); h.className = 'parts-cat'; h.textContent = g.cat; list.appendChild(h); lastCat = g.cat;
    }
    const st = groupState[g.id];
    const pm = partMeta[g.parts[0]];
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
          <dt>Volume</dt><dd>${pm.volumeCm3.toLocaleString('en-US', { maximumFractionDigits: 1 })} cm³${g.count !== '×1' ? ' each' : ''}</dd>
          <dt>CAD faces</dt><dd>${pm.faces}</dd></dl>
        <p class="feat-title">Built from ${pm.features.length} SolidWorks feature${pm.features.length === 1 ? '' : 's'}</p>
        <div class="feat-chips">${pm.features.map((f) => `<span>${f}</span>`).join('')}</div>
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

  // ---------------------------------------------------------------- flutter lab
  const tInput = document.getElementById('fc-t'), tOut = document.getElementById('fc-t-v');
  const matsEl = document.getElementById('fc-mats');
  const verdict = document.getElementById('fc-verdict'), marginEl = document.getElementById('fc-margin'), stateEl = document.getElementById('fc-state');
  const DEFAULT = { t: data.fin.t * 1000, material: data.fin.material };
  const lab = { ...DEFAULT, margin: data.kpis.flutter };
  const matBtns = {};
  for (const name of Object.keys(data.materials)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = FIN_LOOK[name].short;
    b.title = name;
    b.addEventListener('click', () => { lab.material = name; updateLab(); });
    matsEl.appendChild(b);
    matBtns[name] = b;
  }
  tInput.addEventListener('input', () => { lab.t = +tInput.value; updateLab(); });
  function updateLab() {
    const res = minFlutterMargin(data, data.materials[lab.material].G, lab.t / 1000);
    lab.margin = res.margin;
    tInput.value = lab.t;
    tOut.textContent = lab.t.toFixed(1) + ' mm';
    for (const [n, b] of Object.entries(matBtns)) b.setAttribute('aria-pressed', n === lab.material);
    marginEl.textContent = res.margin.toFixed(2) + '×';
    const req = data.fin.required;
    verdict.classList.toggle('warn', res.margin < req && res.margin >= 1);
    verdict.classList.toggle('bad', res.margin < 1);
    stateEl.textContent = res.margin >= req ? 'Safe' : res.margin >= 1 ? `Below the ${req}× margin` : 'Flutters: fins would shed';
    // fin thickness and finish
    for (const f of fins) f.flex.twistIn.scale.z = lab.t / BASE_T;
    const look = FIN_LOOK[lab.material];
    for (const m of finMats) {
      m.color.copy(look.color ? new THREE.Color(look.color) : m.userData.g10);
      m.userData.baseColor = m.color.clone();
      m.metalness = look.metal; m.roughness = look.rough;
    }
    charts.setLab({ t: lab.t, material: lab.material, margin: res.margin, at: res });
    applyLook();
  }

  // ---------------------------------------------------------------- state + tools
  let explode = 0, explodeGoal = 0, xray = true, blueprint = false;
  let hovered = null, listHover = null, canvasHover = null, selected = null;
  const targetGoal = HOME_TARGET.clone();
  const toolBtn = (act) => document.querySelector(`#fc-viewer .v-tools [data-act="${act}"]`);
  document.querySelectorAll('#fc-viewer .v-tools button').forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'explode') {
      explodeGoal = explodeGoal ? 0 : 1;
      b.setAttribute('aria-pressed', !!explodeGoal);
      select(null);
      flyTo(explodeGoal ? EXPLODE_TARGET : HOME_TARGET, fitDist(explodeGoal ? explodeSize : homeSize));
      targetGoal.copy(explodeGoal ? EXPLODE_TARGET : HOME_TARGET);
    }
    if (act === 'xray') { xray = !xray; b.setAttribute('aria-pressed', xray); applyLook(); }
    if (act === 'blueprint') { blueprint = !blueprint; b.setAttribute('aria-pressed', blueprint); applyLook(); }
    if (act === 'reset') {
      select(null); explodeGoal = 0; toolBtn('explode').setAttribute('aria-pressed', false);
      Object.assign(lab, DEFAULT); updateLab();
      camAnim = null; camera.position.copy(homePos()); targetGoal.copy(HOME_TARGET); controls.target.copy(HOME_TARGET);
      cameraMoved = false;
    }
  }));

  function applyLook() {
    const fluttering = lab.margin < 1;
    for (const g of GROUPS) {
      const st = groupState[g.id];
      const isSel = selected === g.id, isHov = hovered === g.id;
      const ghost = selected && !isSel;
      const glass = g.id === 'airframe' && xray && !isSel;
      let opacity = 1;
      if (glass) opacity = 0.14;
      if (ghost) opacity = g.id === 'airframe' && xray ? 0.05 : 0.08;
      const transparent = opacity < 1;
      for (const m of st.mats) {
        if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
        m.opacity = opacity;
        m.depthWrite = !transparent;
        m.colorWrite = !blueprint;
        if (g.id === 'fins' && fluttering && !blueprint) { m.emissive.copy(HOT); }
        else { m.emissive.copy(ACCENT); m.emissiveIntensity = blueprint ? 0 : isSel ? 0.1 : isHov ? 0.2 : 0; }
      }
      const em = st.edgeMat;
      em.color.copy(isSel || isHov ? ACCENT : g.id === 'fins' && fluttering ? HOT : blueprint ? EDGE_BLUE : EDGE_NORMAL);
      em.opacity = isSel || isHov ? 0.95 : blueprint ? (ghost ? 0.1 : glass ? 0.35 : 0.8) : ghost ? 0.03 : glass ? 0.14 : 0.09;
    }
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
    if (id && !fromList) list.scrollBy({ top: items[id].li.getBoundingClientRect().top - list.getBoundingClientRect().top - 8, behavior: 'smooth' });
    if (id) {
      const box = new THREE.Box3();
      for (const inst of groupState[id].instances) {
        inst.obj.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(inst.obj);
        const shift = inst.group.pull(inst).clone().multiplyScalar(1 - groupState[id].pull).applyEuler(root.rotation);
        b.translate(shift);
        box.union(b);
      }
      box.getCenter(targetGoal);
      controls.autoRotate = false;
    } else targetGoal.copy(explodeGoal ? EXPLODE_TARGET : HOME_TARGET);
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
    const solid = hits.find((h) => { const id = h.object.userData.gid; return !(selected && selected !== id) && !(id === 'airframe' && xray); });
    return (solid || hits[0]).object.userData.gid;
  }
  canvas.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { pointer = null; tip.hidden = true; setHover(null, 'canvas'); });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return;
    const id = pick(e.clientX, e.clientY);
    select(id && id !== selected ? id : null);
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

  // ---------------------------------------------------------------- flutter motion
  // below a 1.5x margin the fins buzz; below 1.0 they flutter hard (bending + torsion, a quarter cycle apart)
  let flutterAmp = 0;
  function flutterMotion(time, dt) {
    const m = lab.margin, req = data.fin.required;
    const goal = m >= req ? 0 : m >= 1 ? 0.012 * (req - m) / (req - 1) : Math.min(0.32, 0.06 + 0.4 * (1 - m));
    flutterAmp += (goal - flutterAmp) * (1 - Math.exp(-dt * 3));
    const w = 2 * Math.PI * (m < 1 ? 7 : 11);
    for (const f of fins) {
      const s = reduced ? 1 : Math.sin(w * time + f.flex.phase);
      const c = reduced ? 0.6 : Math.sin(w * time + f.flex.phase - Math.PI / 2);
      f.flex.bend.rotation.y = flutterAmp * s;
      f.flex.twist.rotation.x = flutterAmp * 1.4 * c;
    }
    if (m < 1 && !blueprint) for (const mat of finMats) mat.emissiveIntensity = 0.25 + 0.2 * Math.abs(Math.sin(w * time * 0.25));
  }

  // ---------------------------------------------------------------- render loop
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!cameraMoved && !camAnim) {
      const dir = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).add(dir.multiplyScalar(fitDist(explodeGoal ? explodeSize : homeSize)));
    }
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  updateLab();

  let last = 0, visible = true, raf = 0;
  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    const k = 1 - Math.exp(-dt * 5);
    explode += (explodeGoal - explode) * k;
    for (const g of GROUPS) { const st = groupState[g.id]; st.pull += ((selected === g.id ? 1 : 0) - st.pull) * k; }
    if (camAnim) {
      camAnim.k = Math.min(1, camAnim.k + dt / 0.9);
      const e = 1 - Math.pow(1 - camAnim.k, 3);
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
      controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
      if (camAnim.k >= 1) camAnim = null;
    } else controls.target.lerp(targetGoal, 1 - Math.exp(-dt * 3));
    pose(explode);
    flutterMotion(t / 1000, dt);
    updateHover();
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  renderer.render(scene, camera);
  loading.classList.add('done');
  document.getElementById('fc-viewer').classList.add('ready');
  wake();
}
