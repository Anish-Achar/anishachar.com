import { initHero } from './hero.js';
import { drawBike, initBikeProject } from './bike.js';
import { drawTradingArt, drawFinCanArt, drawZetoArt } from './tiles.js';
import { renderMedia } from './media.js';
import { fx } from './fx.js';

window.__siteReady = true;   // the 'js' class itself is set by the inline script in <head>
document.getElementById('year').textContent = new Date().getFullYear();

// local time in Dublin, next to "Based in"
const hfTime = document.getElementById('hf-time');
if (hfTime) {
  const fmt = new Intl.DateTimeFormat('en-IE', { timeZone: 'Europe/Dublin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const tick = () => { hfTime.innerHTML = `, where it’s <b>${fmt.format(new Date())}</b>`; };
  tick();
  setInterval(tick, 15000);
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = fx.reduced;   // device setting or the footer's motion switch (html.reduce-motion)

const VIEWS = ['about', 'projects', 'experience', 'skills', 'contact'];
const TITLES = { about: 'Anish Achar · Computer Science & Business, Trinity College Dublin', projects: 'Projects · Anish Achar', experience: 'Experience · Anish Achar', skills: 'Education & skills · Anish Achar', contact: 'Contact · Anish Achar' };
const PROJECTS = {
  v8: { num: '01', title: 'V8 Engine', sub: 'Full CAD assembly in SolidWorks' },
  trading: { num: '02', title: 'NO Candle Strategy', sub: 'Algorithmic trading · 11,142 backtests' },
  tiktok: { num: '03', title: 'Study content creator', sub: 'TikTok · SimpleStudy' },
  biking: { num: '04', title: 'Bikes & mechanics', sub: 'The Bike Hub · e-bike converter' },
  ghostball: { num: '05', title: 'Ghost Ball', sub: 'Computer vision · Geometry · JavaScript' },
  fincan: { num: '06', title: 'Rocket fin can', sub: 'Flight simulation · fin flutter · SolidWorks' },
  zeto: { num: '07', title: 'Zeto', sub: 'Team hackathon · Lovable · Notion' },
};
// links from the old single-page layout keep working
const ALIASES = { top: 'about', v8: 'projects/v8', strategy: 'projects/trading', more: 'projects', viewer: 'projects/v8' };

// ---------------------------------------------------------------- tile art
$$('.bike-art').forEach((svg) => drawBike(svg));
$$('.trade-art').forEach((svg) => drawTradingArt(svg));
$$('.fc-tile-art').forEach((svg) => drawFinCanArt(svg));
$$('.zt-tile-art').forEach((svg) => drawZetoArt(svg));

// ---------------------------------------------------------------- nav + mobile menu
const toggle = $('#nav-toggle'), links = $('#nav-links');
function setMenu(open) {
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  links.classList.toggle('open', open);
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

// ---------------------------------------------------------------- reveal on scroll
// Things that come into view together are staggered 45 ms apart, in page order.
const reveal = new IntersectionObserver((entries) => {
  let i = 0;
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const delay = Math.min(i++, 6) * 45;
    if (delay) e.target.style.setProperty('--d', delay + 'ms');
    e.target.classList.add('in');
    reveal.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
$$('.reveal').forEach((el) => reveal.observe(el));

// ---------------------------------------------------------------- pointer spotlight on cards
if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
  }, { passive: true });
}

// ---------------------------------------------------------------- scroll-linked lines
// Timelines with data-progress fill as you scroll through them, and their dots light up as the line passes.
const progressLines = $$('[data-progress]');
let progressQueued = false;
function updateProgress() {
  progressQueued = false;
  const mark = innerHeight * 0.6;
  progressLines.forEach((el) => {
    if (!el.offsetParent) return;                        // in a hidden tab or panel
    const r = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (mark - r.top) / r.height));
    el.style.setProperty('--prog', p.toFixed(4));
    [...el.children].forEach((li) => li.classList.toggle('passed', li.getBoundingClientRect().top + 12 <= mark));
  });
}
const queueProgress = () => { if (!progressQueued) { progressQueued = true; requestAnimationFrame(updateProgress); } };
document.addEventListener('scroll', queueProgress, { capture: true, passive: true });   // capture: also hears the project panel's own scrolling
addEventListener('resize', queueProgress);

// ---------------------------------------------------------------- counters
const countUp = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countUp.unobserve(e.target);
    if (reduced) return;
    const el = e.target, end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))).toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countUp.observe(el));

// ---------------------------------------------------------------- expanders (experience)
$$('.job').forEach((job) => {
  const btn = $('.job-btn', job);
  btn.addEventListener('click', () => {
    const open = !job.classList.contains('open');
    job.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
  });
});

// ---------------------------------------------------------------- copy email
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const note = $('.copied', b);
  try { await navigator.clipboard.writeText(b.dataset.copy); note.textContent = 'Copied!'; }
  catch { note.textContent = 'Couldn’t copy. Use the email button'; }
  b.classList.add('done');
  setTimeout(() => b.classList.remove('done'), 1800);
}));

// ---------------------------------------------------------------- projects: tiles <-> index hover sync
$$('.proj-index a').forEach((a) => {
  const tile = $(`.tile[data-project="${a.dataset.for}"]`);
  a.addEventListener('mouseenter', () => tile.classList.add('hot'));
  a.addEventListener('mouseleave', () => tile.classList.remove('hot'));
});
$$('.tile').forEach((t) => {
  const a = $(`.proj-index a[data-for="${t.dataset.project}"]`);
  t.addEventListener('mouseenter', () => { a.classList.add('hot'); preload(t.dataset.project); });
  t.addEventListener('mouseleave', () => a.classList.remove('hot'));
  t.addEventListener('focus', () => preload(t.dataset.project));
});

// each project's code loads the first time it's needed
const loaders = {
  v8: () => import('./v8.js'),
  trading: () => import('./trading.js'),
  fincan: () => import('./fincan.js'),
};
const started = {};
function preload(id) { if (loaders[id]) loaders[id]().catch(() => {}); }
function startProject(id) {
  if (started[id]) return;
  started[id] = true;
  const panel = $(`.po-panel[data-project="${id}"]`);
  if (id === 'v8') loaders.v8().then((m) => m.initV8()).catch((err) => {
    console.error(err);
    $('#v8-loading').classList.add('failed');
    $('#v8-loading-text').textContent = 'The 3D model didn’t load. Check your connection and refresh the page. The SOLIDWORKS renders below still show the engine.';
  });
  if (id === 'trading') loaders.trading().then((m) => m.initTrading()).catch((err) => console.error(err));
  if (id === 'fincan') loaders.fincan().then((m) => m.initFinCan()).catch((err) => {
    console.error(err);
    $('#fc-loading').classList.add('failed');
    $('#fc-loading-text').textContent = 'The 3D model didn’t load. Check your connection and refresh the page. The SOLIDWORKS renders further down still show the fin can.';
  });
  if (id === 'biking') initBikeProject($('#bike-explorer'));
  $$('[data-media]', panel).forEach((host) => renderMedia(host.dataset.media, host));
}

// ---------------------------------------------------------------- tabs + maximised projects (hash router)
const po = $('#po'), poBody = $('#po-body'), poProgress = $('.po-progress');
let view = null, project = null, openedInApp = false, poAnim = null, firstRoute = true;

function parse() {
  let h = decodeURIComponent(location.hash.slice(1)).replace(/^\//, '');
  if (ALIASES[h]) h = ALIASES[h];
  if (!h) return { view: 'about' };
  const [v, p] = h.split('/');
  if (!VIEWS.includes(v)) return null;                // e.g. #main from the skip link
  return { view: v, project: v === 'projects' && PROJECTS[p] ? p : null };
}

// the white pill that glides between tabs (desktop; the phone menu keeps a plain highlight)
const pill = $('.nav-pill');
if (pill) links.classList.add('has-pill');
function movePill(instant) {
  const a = $('.nav-links a.active');
  if (!pill || !a || getComputedStyle(pill).display === 'none') return;
  if (instant) pill.style.transition = 'none';
  pill.style.width = a.offsetWidth + 'px';
  pill.style.height = a.offsetHeight + 'px';
  pill.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
  if (instant) { pill.getBoundingClientRect(); pill.style.transition = ''; }
}
addEventListener('resize', () => movePill(true));
if (document.fonts) document.fonts.ready.then(() => movePill(true));   // tab widths change once Inter loads

function showView(v, fadeIn) {
  if (v === view) return;
  const first = view === null;
  view = v;
  $$('.view').forEach((s) => {
    const on = s.dataset.view === v;
    s.hidden = !on;
    s.classList.toggle('enter', on && fadeIn);
  });
  $$('.nav-links a').forEach((a) => {
    const on = a.dataset.tab === v;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  movePill(first);
  document.title = TITLES[v];
  fx.scrollToTop();
  queueProgress();
}

// Changing tab slides the page the way you're moving along the tabs (View Transitions API); with reduced motion
// it's a plain crossfade. Browsers without the API get a simple fade-in.
// A transition's update runs a frame later; if another navigation arrives first, the older update is dropped
// (navGen) so a quick back/forward can never leave the page on the wrong tab.
let vtCount = 0, navGen = 0;
function changeView(to, update) {
  const from = VIEWS.indexOf(view), next = VIEWS.indexOf(to), gen = navGen;
  if (firstRoute || !document.startViewTransition || from === next) { update(!firstRoute); return; }
  const id = ++vtCount, root = document.documentElement;
  root.dataset.dir = next < from ? 'back' : 'fwd';
  const vt = document.startViewTransition(() => { if (gen === navGen) update(false); });
  vt.ready.catch(() => {});                       // skipped (e.g. a background tab): the page still updates, no animation
  vt.finished.catch(() => {}).then(() => { if (id === vtCount) delete root.dataset.dir; });
}

function tileRect(id) {
  const tile = $(`.tile[data-project="${id}"]`);
  const r = tile.getBoundingClientRect(), top = po.getBoundingClientRect().top;
  const t = Math.max(0, r.top - top), l = Math.max(0, r.left), rr = Math.max(0, innerWidth - r.right), b = Math.max(0, innerHeight - r.bottom);
  return `inset(${t}px ${rr}px ${b}px ${l}px round 22px)`;
}

// The panel grows out of its tile and shrinks back into it. Both are Web Animations, so a new one cancels the old
// one cleanly: minimising halfway through opening reverses smoothly from wherever it got to.
const FULL = 'inset(0px 0px 0px 0px round 0px)';
function animatePo(from, to, options) {
  if (poAnim) poAnim.cancel();
  poAnim = po.animate([{ clipPath: from }, { clipPath: to }], { ...options, fill: 'forwards' });
  return poAnim;
}
function stopPoAnim() { if (poAnim) { poAnim.cancel(); poAnim = null; } }

// reading progress along the bottom of the title bar
let progressFrame = false;
const setReadProgress = () => {
  progressFrame = false;
  const max = poBody.scrollHeight - poBody.clientHeight;
  poProgress.style.setProperty('--p', max > 0 ? (poBody.scrollTop / max).toFixed(4) : '0');
};
poBody.addEventListener('scroll', () => { if (!progressFrame) { progressFrame = true; requestAnimationFrame(setReadProgress); } }, { passive: true });

function openProject(id) {
  if (project === id) return;
  const wasOpen = !!project;
  project = id;
  const meta = PROJECTS[id];
  $('#po-num').textContent = meta.num;
  $('#po-title').textContent = meta.title;
  $('#po-sub').textContent = meta.sub;
  $$('.po-panel').forEach((p) => { p.hidden = p.dataset.project !== id; });
  document.documentElement.classList.add('po-open');
  $('#main').inert = true; $('.footer').inert = true;   // keep keyboard focus inside the open project
  po.hidden = false;
  poBody.scrollTop = 0;
  poProgress.style.setProperty('--p', '0');
  document.title = meta.title + ' · Anish Achar';
  startProject(id);
  fx.lockScroll(true);
  po.classList.remove('closing');
  if (!wasOpen && reduced) {
    stopPoAnim();
    poAnim = po.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  } else if (!wasOpen) {
    const live = getComputedStyle(po).clipPath;          // reopening mid-close starts from where it is
    po.classList.add('opening');
    const a = animatePo(live && live !== 'none' ? live : tileRect(id), FULL, { duration: 640, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    a.finished.then(() => { if (poAnim === a) stopPoAnim(); po.classList.remove('opening'); }, () => {});
  } else stopPoAnim();
  queueProgress();
  $('#po-min').focus({ preventScroll: true });
}

function closeProject(animate) {
  if (!project) return;
  const id = project;
  project = null;
  openedInApp = false;
  const finish = () => {
    if (project) return;                                  // it was reopened while shrinking
    stopPoAnim();
    po.hidden = true;
    po.classList.remove('closing', 'opening');
    $$('.po-panel').forEach((p) => { p.hidden = true; });
    document.documentElement.classList.remove('po-open');
    $('#main').inert = false; $('.footer').inert = false;
    fx.lockScroll(false);
    const tile = $(`.tile[data-project="${id}"]`);
    if (view === 'projects' && tile) tile.focus({ preventScroll: true });
  };
  if (!animate) return finish();
  if (reduced) {
    if (poAnim) poAnim.cancel();
    poAnim = po.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    poAnim.finished.then(finish, () => {});
    return;
  }
  // shrink back into its tile, a little quicker than it opened
  const live = getComputedStyle(po).clipPath;
  po.classList.remove('opening');
  po.classList.add('closing');
  animatePo(live && live !== 'none' ? live : FULL, tileRect(id), { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' })
    .finished.then(finish, () => {});
}

function route() {
  const r = parse();
  if (!r) return;
  navGen++;
  // a project's video stops when you minimise it or switch to another
  $$('.po-panel video').forEach((v) => { if (!v.paused && v.closest('.po-panel').dataset.project !== r.project) v.pause(); });
  if (r.project) {
    if (view !== 'projects') showView('projects', false);   // swapped underneath the panel growing out of its tile
    openProject(r.project);
  } else if (r.view === view) {
    closeProject(true);                                       // minimised: back into its tile
    document.title = TITLES[view];
  } else {
    changeView(r.view, (fadeIn) => { closeProject(false); showView(r.view, fadeIn); });
  }
  firstRoute = false;
}

function minimise() {
  // go back if we opened it from the tiles, so the browser's back button stays sensible
  if (openedInApp && history.length > 1) history.back();
  else { history.replaceState(null, '', '#projects'); route(); }   // don't leave a history entry that re-opens it
}
$('#po-min').addEventListener('click', minimise);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && project) minimise(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#projects/"]');
  if (a && view === 'projects') openedInApp = true;
});
window.addEventListener('hashchange', route);
route();

initHero();
