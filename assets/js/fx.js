// Effects layer: smooth scrolling, custom cursor, magnetic buttons, tilt, split headings, marquee, image wipes,
// the hero dot field, the footer wordmark, nav tuck-away and the motion switch. All of it is polish on top of
// a site that works without it. Motion follows html.reduce-motion (set in <head> from the device setting or
// the visitor's choice with the switch in the nav), and the pointer effects only run with a mouse or trackpad.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduced = root.classList.contains('reduce-motion');
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------------------------------------------------------------- marks that main.js's reveal observer picks up
// (this module runs before main.js's own code, so these classes are in place when it collects .reveal)
$$('.tile, .proj-index li, .more-card, .more-head, .launch-head, .tt-top li').forEach((el) => el.classList.add('reveal'));
$$('.interest, .skill-group, .two-col > .panel').forEach((el) => el.classList.add('draw-icons'));
// (shapes that are already dashed by design keep their own pattern)
$$('.draw-icons svg :is(path, rect, circle, line, polyline):not([stroke-dasharray])').forEach((s) => s.setAttribute('pathLength', '1'));
$$('.chips').forEach((c) => [...c.children].forEach((s, i) => s.style.setProperty('--i', i)));
$$('.interest, .edu, .skill-group, .more-card').forEach((el) => el.classList.add('spot'));

// ---------------------------------------------------------------- intro: remember it was seen this visit
if (root.classList.contains('intro')) { try { sessionStorage.setItem('intro', '1'); } catch (e) { /* private mode */ } }

// ---------------------------------------------------------------- smooth scrolling (Lenis)
let lenis = null;
if (!reduced) {
  import('../vendor/lenis/lenis.js')   // Lenis 1.3.26, MIT licence (assets/vendor/lenis/LICENSE.txt)
    .then(({ default: Lenis }) => {
      lenis = new Lenis({ autoRaf: true, lerp: 0.11, smoothWheel: true, anchors: false });
      if (root.classList.contains('po-open')) lenis.stop();
    })
    .catch(() => { /* plain native scrolling */ });
}

// ---------------------------------------------------------------- split headings: each letter rises in
function split(el) {
  const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  if (!nodes.length) return;
  let i = 0;
  nodes.forEach((node) => {
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
    const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    text.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { vis.append(' '); return; }
      const w = document.createElement('span'); w.className = 'w';
      for (const ch of part) { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = ch; w.appendChild(s); }
      vis.appendChild(w);
    });
    frag.append(sr, vis);
    node.replaceWith(frag);
  });
  el.classList.add('split');
}
if (!reduced) {
  const targets = $$('.sec-head h2, .contact h2, .sub-h, .gb-h h4, .proj-title');
  targets.forEach(split);
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('split-in'); io.unobserve(e.target); }
  }), { threshold: 0.2 });
  targets.forEach((t) => io.observe(t));
}

// ---------------------------------------------------------------- marquee: a second copy makes the loop seamless
$$('.mq-track').forEach((t) => { const copy = t.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); t.parentElement.appendChild(copy); });

// ---------------------------------------------------------------- project images wipe up into view
const wipes = $$('.po-panel img');
wipes.forEach((img) => img.classList.add('wipe'));
const wipeIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('wiped'); wipeIO.unobserve(e.target); }
}), { threshold: 0.12 });
wipes.forEach((img) => wipeIO.observe(img));

// ---------------------------------------------------------------- contact: a ring of text around the photo
const photo = $('.contact-photo');
if (photo) photo.insertAdjacentHTML('beforeend',
  '<svg class="ring" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="ring-path" d="M100,100 m-84,0 a84,84 0 1,1 168,0 a84,84 0 1,1 -168,0"/></defs>'
  + '<text><textPath href="#ring-path" textLength="526" lengthAdjust="spacing">Anish Achar · Dublin, Ireland · Say hi · </textPath></text></svg>');

// ---------------------------------------------------------------- pointer effects (mouse / trackpad only)
if (fine && !reduced) {
  // custom cursor: a dot, and a ring that trails it, grows over anything clickable and labels some things
  const labels = [['.tile, .hero-stats a, .launch:not(.launch-more)', 'Open'], ['.launch-more', 'View'], ['#viewer-stage, .gb-play-svg', 'Drag'], ['.bike-svg', 'Explore']];
  labels.forEach(([sel, text]) => $$(sel).forEach((el) => { el.dataset.cursor = text; }));
  const c = document.createElement('div');
  c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<div class="cursor-ring"><span class="cursor-label"></span></div><div class="cursor-dot"></div>';
  document.body.appendChild(c);
  const ring = c.firstChild, dot = c.lastChild, label = c.querySelector('.cursor-label');
  let x = -100, y = -100, rx = -100, ry = -100, seen = false, moving = false, last = 0;
  // the pointer is over an element's own scrollbar when it's inside the box but past the content area
  const overScrollbar = (t, px, py) => {
    if (!t || t.nodeType !== 1 || t === document.documentElement || t === document.body) return false;
    // (a real scrollbar is several pixels wide; anything thinner is just an uneven border)
    const sbX = t.offsetWidth - t.clientWidth - t.clientLeft * 2, sbY = t.offsetHeight - t.clientHeight - t.clientTop * 2;
    if (sbX < 5 && sbY < 5) return false;
    const r = t.getBoundingClientRect();
    return (sbX >= 5 && px >= r.left + t.clientLeft + t.clientWidth) || (sbY >= 5 && py >= r.top + t.clientTop + t.clientHeight);
  };
  // what the cursor is over decides its state; worked out from the element itself, so it stays right
  // even when the page scrolls or changes underneath a still pointer
  function setState(t) {
    if (!t || !t.closest) return;
    const tag = t.closest('[data-cursor]');
    const hot = t.closest('a, button, [role="button"], label, summary, select, input, .ball, .pkt, .bk-hit');
    const text = tag ? tag.dataset.cursor : '';
    if (label.textContent !== text) label.textContent = text;
    c.classList.toggle('label', !!text);
    c.classList.toggle('hover', !!hot && !text);
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    // over a scrollbar (the page's, or a project panel's) the normal pointer shows, so step aside rather than doubling up
    const inside = x < document.documentElement.clientWidth && y < document.documentElement.clientHeight && !overScrollbar(e.target, x, y);
    // coming back (first move, from outside the window, the scrollbar or the Ghost Ball app frame):
    // put the ring straight under the pointer instead of letting it sweep across from where it was left
    if (inside && (!seen || !c.classList.contains('on'))) { seen = true; rx = x; ry = y; ring.style.translate = `${x}px ${y}px`; }
    c.classList.toggle('on', inside);
    dot.style.translate = `${x}px ${y}px`;
    if (!moving) { moving = true; last = 0; requestAnimationFrame(follow); }
  }, { passive: true });
  // the ring eases after the dot (closing ~1/e of the gap every LAG ms, so it feels the same on a 60 Hz or a
  // 144 Hz screen), and the loop sleeps once it has caught up
  const LAG = 38;
  function follow(now) {
    const dt = last ? Math.min(now - last, 64) : 16.7;
    last = now;
    const k = 1 - Math.exp(-dt / LAG);
    rx += (x - rx) * k; ry += (y - ry) * k;
    if (Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1) { rx = x; ry = y; moving = false; }
    ring.style.translate = `${rx.toFixed(2)}px ${ry.toFixed(2)}px`;
    if (moving) requestAnimationFrame(follow);
  }
  document.addEventListener('pointerover', (e) => setState(e.target));
  let stateFrame = false;
  const recheck = () => {
    if (stateFrame || !seen) return;
    stateFrame = true;
    requestAnimationFrame(() => { stateFrame = false; setState(document.elementFromPoint(x, y)); });
  };
  document.addEventListener('scroll', recheck, { capture: true, passive: true });
  // after a navigation, check again once a page transition or a project panel's growth has settled
  addEventListener('hashchange', () => { setTimeout(recheck, 60); setTimeout(recheck, 720); });
  const hide = () => c.classList.remove('on', 'down');
  document.documentElement.addEventListener('mouseleave', hide);
  addEventListener('blur', hide);                                                 // e.g. clicking into the Ghost Ball app frame
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) hide(); }); // left the window, or entered the frame
  // pressed state: main button only, and always released, even if the button comes up somewhere we can't see
  // (outside the window, after a right-click menu, or when a drag takes over the pointer)
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) c.classList.add('down'); });
  const release = () => c.classList.remove('down');
  ['pointerup', 'pointercancel', 'contextmenu', 'dragend'].forEach((t) => addEventListener(t, release));
  addEventListener('dragstart', hide);                                            // the browser draws its own drag pointer
  root.classList.add('has-cursor');

  // magnetic buttons: they lean towards the pointer, then spring back when it leaves.
  // The element's resting box is measured once on entry, so its own movement can't feed back into the maths.
  const restingBox = (el) => {
    const r = el.getBoundingClientRect(), t = getComputedStyle(el).translate;
    const [tx = 0, ty = 0] = t && t !== 'none' ? t.split(' ').map(parseFloat) : [];
    return { left: r.left - tx, top: r.top - ty, width: r.width, height: r.height };
  };
  $$('.btn-primary, .nav-cv, .icon-btn, .po-min, .foot-up, .brand').forEach((el) => {
    el.classList.add('magnetic');
    let box = null;
    el.addEventListener('pointerenter', () => { box = restingBox(el); el.classList.add('tracking'); });
    el.addEventListener('pointermove', (e) => {
      if (!box) box = restingBox(el);
      const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2);
      el.style.translate = `${(dx * 0.2).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => { box = null; el.classList.remove('tracking'); el.style.translate = ''; });
  });

  // 3D tilt on cards (also measured on entry, for the same reason)
  $$('.tile, .interest, .edu, .skill-group, .more-card').forEach((el) => {
    el.classList.add('tilt');
    const max = el.classList.contains('tile') ? 6 : 3.5;
    let box = null;
    el.addEventListener('pointerenter', () => { box = el.getBoundingClientRect(); el.classList.add('tracking'); });
    el.addEventListener('pointermove', (e) => {
      if (!box) box = el.getBoundingClientRect();
      const px = Math.min(0.5, Math.max(-0.5, (e.clientX - box.left) / box.width - 0.5));
      const py = Math.min(0.5, Math.max(-0.5, (e.clientY - box.top) / box.height - 0.5));
      el.style.setProperty('--ry', (px * max * 2).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (-py * max * 2).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', () => { box = null; el.classList.remove('tracking'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
  // a scroll moves cards under a still pointer: re-measure on the next move
  document.addEventListener('scroll', () => { $$('.tilt.tracking, .magnetic.tracking').forEach((el) => el.dispatchEvent(new Event('pointerenter'))); }, { capture: true, passive: true });

  // hero: the dot field lights up around the pointer, and the drawing drifts a little the other way
  const hero = $('.hero'), fig = $('.hero-fig');
  if (hero) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--hx', (e.clientX - r.left).toFixed(0) + 'px');
      hero.style.setProperty('--hy', (e.clientY - r.top).toFixed(0) + 'px');
      hero.classList.add('lit');
      if (fig) {
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        fig.style.setProperty('--px', (-px * 14).toFixed(1) + 'px');
        fig.style.setProperty('--py', (-py * 10).toFixed(1) + 'px');
      }
    });
    hero.addEventListener('pointerleave', () => { hero.classList.remove('lit'); if (fig) { fig.style.setProperty('--px', '0px'); fig.style.setProperty('--py', '0px'); } });
  }
}

// ---------------------------------------------------------------- scroll: footer wordmark fill, nav tuck-away
const nav = $('#nav'), mark = $('.foot-mark'), menu = $('#nav-links');
let lastY = scrollY, queued = false;
function onScroll() {
  queued = false;
  const y = scrollY;
  if (mark) {
    // 0 when the wordmark first peeks in at the bottom of the screen, 1 exactly when the page can't scroll further
    const r = mark.getBoundingClientRect();
    const toEnd = document.documentElement.scrollHeight - (r.top + y);
    const p = toEnd > 0 ? Math.min(1, Math.max(0, (innerHeight - r.top) / toEnd)) : 1;
    mark.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
  }
  if (!reduced && Math.abs(y - lastY) > 4) {
    const hide = y > lastY && y > 160 && !root.classList.contains('po-open') && !menu.classList.contains('open');
    nav.classList.toggle('nav-hidden', hide);
    lastY = y;
  }
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// back to the top
const up = $('[data-up]');
if (up) up.addEventListener('click', () => {
  if (lenis) lenis.scrollTo(0, { duration: 1.2 });
  else scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
});

// ---------------------------------------------------------------- the motion switch in the nav
const toggle = $('.motion-toggle');
if (toggle) {
  toggle.setAttribute('aria-pressed', String(!reduced));
  toggle.title = reduced ? 'Turn animations on' : 'Turn animations off';
  toggle.addEventListener('click', () => {
    try { localStorage.setItem('motion', reduced ? 'full' : 'reduced'); } catch (e) { /* private mode */ }
    location.reload();
  });
}

// ---------------------------------------------------------------- used by main.js
export const fx = {
  reduced,
  scrollToTop() { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else scrollTo(0, 0); },
  // the project panel sits right under the nav, so the nav must be showing whenever a panel opens or closes
  lockScroll(on) { if (lenis) { if (on) lenis.stop(); else lenis.start(); } nav.classList.remove('nav-hidden'); },
};
