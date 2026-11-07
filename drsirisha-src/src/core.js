/* ---------- core helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const COL = {
  ink: '#1d1d1f', mute: '#6e6e73', hair: '#e3e3e8', soft: '#f5f5f7', soft2: '#ececf0',
  vis: '#1a73e8', lid: '#d93025', fus: '#188038', spc: '#9334e6', lrn: '#e37400', swm: '#00838f', inf: '#5f6368',
  ok: '#188038', warn: '#b06000', bad: '#d93025'
};
const FAM = {
  vio: { label: 'Visual-inertial', short: 'VIO', cls: 'vis', col: COL.vis },
  lio: { label: 'LiDAR-inertial', short: 'LIO', cls: 'lid', col: COL.lid },
  livo: { label: 'LiDAR-visual-inertial', short: 'LIVO', cls: 'fus', col: COL.fus },
  deg: { label: 'Degraded-sensing', short: 'Thermal / Radar / Event', cls: 'spc', col: COL.spc },
  lrn: { label: 'Learned & dense', short: 'Learned', cls: 'lrn', col: COL.lrn },
  swm: { label: 'Multi-drone', short: 'Swarm', cls: 'swm', col: COL.swm },
};
// seeded rng
function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

/* ---------- canvas with DPR + visibility-gated RAF ---------- */
const running = new Set();
function makeCanvas(parent, aspect = 0.5, minH = 220, maxH = 620) {
  const c = h('canvas');
  parent.append(c);
  const ctx = c.getContext('2d');
  const st = { c, ctx, w: 0, h: 0, dpr: 1, aspect, minH, maxH, visible: false };
  const fit = () => {
    const w = parent.clientWidth || 600;
    const hh = clamp(Math.round(w * aspect), minH, maxH);
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * st.dpr); c.height = Math.round(hh * st.dpr);
    c.style.height = hh + 'px';
    st.w = w; st.h = hh;
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    st.onresize && st.onresize();
  };
  st.fit = fit;
  fit();
  new ResizeObserver(() => fit()).observe(parent);
  return st;
}
const visObs = new IntersectionObserver((ents) => {
  for (const e of ents) { const s = e.target.__sim; if (s) s.visible = e.isIntersecting; }
}, { rootMargin: '120px' });
function animate(st, step) {
  st.c.__sim = st; visObs.observe(st.c);
  st.t = 0; st.paused = false;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.visible && !st.paused && !document.hidden && st.c.isConnected) { st.t += dt; step(st, dt); }
    if (st.c.isConnected || st.keep) st.raf = requestAnimationFrame(loop);
  };
  st.raf = requestAnimationFrame(loop);
  return st;
}

/* ---------- tooltip ---------- */
const tip = h('div', { class: 'tip' });
document.addEventListener('DOMContentLoaded', () => document.body.append(tip));
function showTip(html, x, y) {
  tip.innerHTML = html; tip.classList.add('on');
  const r = tip.getBoundingClientRect();
  let tx = x + 14, ty = y + 14;
  if (tx + r.width > innerWidth - 10) tx = x - r.width - 14;
  if (ty + r.height > innerHeight - 10) ty = y - r.height - 14;
  tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
}
function hideTip() { tip.classList.remove('on'); }
function bindTip(el, html) {
  el.addEventListener('mousemove', (e) => showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTip);
}

/* ---------- dot-matrix particle text (matches SLAM/INDEX headings) ---------- */
function particleText(text, { size = 140, weight = 600, accent = true, stretch = 88, align = 'left', color = COL.ink, minSize = 44 } = {}) {
  const box = h('div', { class: 'pt' });
  const sr = h('span', { class: 'sr' }, text);
  const c = h('canvas');
  box.append(c, sr);
  let pts = [], W = 0, H = 0, dpr = 1, mouse = { x: -1e4, y: -1e4 }, raf = 0, fs = size, settled = false;
  const ctx = c.getContext('2d');
  const build = () => {
    W = box.clientWidth || 800;
    fs = clamp(Math.min(size, W / (text.length * 0.56 + (accent ? 0.7 : 0))), minSize, size);
    H = Math.round(fs * 1.02);
    box.style.height = H + 'px';
    dpr = Math.min(2, devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d');
    o.fillStyle = '#000';
    o.font = `${weight} ${stretch}% ${fs}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    try { o.fontStretch = stretch < 88 ? 'condensed' : stretch < 100 ? 'semi-condensed' : 'normal'; } catch (e) { }
    o.textBaseline = 'alphabetic';
    o.font = `${weight} ${fs}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    let tw = o.measureText(text).width;
    const scaleX = Math.min(1, (W - (accent ? fs * 0.62 : 0)) / tw);
    o.save(); o.scale(scaleX, 1);
    const x0 = align === 'left' ? 0 : (W - tw * scaleX) / 2 / scaleX;
    o.fillText(text, x0, fs * 0.8); o.restore();
    const endX = x0 * scaleX + tw * scaleX;
    const data = o.getImageData(0, 0, W, H).data;
    const step = Math.max(3, Math.round(fs / 34));
    pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, a: 0 });
    }
    if (accent) {
      const ux = endX + fs * 0.06, uy = fs * 0.72, uw = fs * 0.5, uh = fs * 0.09;
      for (let y = uy; y < uy + uh; y += step * 0.8) for (let x = ux; x < ux + uw; x += step * 0.8) pts.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, a: 1 });
    }
    pts.r = step * 0.42;
    settled = false; kick();
  };
  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let moving = false;
    const R = fs * 0.5;
    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.2; p.vx += dx / d * f; p.vy += dy / d * f; }
      p.vx += (p.hx - p.x) * 0.09; p.vy += (p.hy - p.y) * 0.09;
      p.vx *= 0.78; p.vy *= 0.78; p.x += p.vx; p.y += p.vy;
      if (Math.abs(p.vx) + Math.abs(p.vy) > 0.02 || Math.abs(p.x - p.hx) > 0.2) moving = true;
    }
    ctx.fillStyle = color; ctx.beginPath();
    for (const p of pts) if (!p.a) { ctx.moveTo(p.x + pts.r, p.y); ctx.arc(p.x, p.y, pts.r, 0, TAU); }
    ctx.fill();
    ctx.fillStyle = COL.vis; ctx.beginPath();
    for (const p of pts) if (p.a) { ctx.moveTo(p.x + pts.r * .8, p.y); ctx.arc(p.x, p.y, pts.r * .8, 0, TAU); }
    ctx.fill();
    if (moving) raf = requestAnimationFrame(draw); else raf = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
  box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; kick(); });
  box.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; kick(); });
  const ro = new ResizeObserver(() => build());
  requestAnimationFrame(() => { (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { build(); ro.observe(box); }); });
  return box;
}

function sectionHead(name, idx, k, lede) {
  return h('div', {},
    h('div', { class: 'sec-head' }, particleText(name, { size: 140 }), idx ? h('div', { class: 'idx' }, idx) : null),
    h('div', { class: 'sec-sub' }, h('div', { class: 'k' }, k), h('p', { class: 'lede', html: lede }))
  );
}

/* reveal on scroll */
const revObs = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) { e.target.classList.add('in'); revObs.unobserve(e.target); } }, { rootMargin: '-40px' });
function reveal(el) { el.classList.add('reveal'); revObs.observe(el); return el; }

/* small drawing helpers */
function drone(ctx, x, y, ang, s = 1, col = COL.ink) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(-7, 7); ctx.lineTo(7, -7); ctx.stroke();
  ctx.fillStyle = col;
  for (const [a, b] of [[-7, -7], [7, 7], [-7, 7], [7, -7]]) { ctx.beginPath(); ctx.arc(a, b, 3.6, 0, TAU); ctx.globalAlpha = .18; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(3.5, -3.2); ctx.lineTo(3.5, 3.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function hud(ctx, lines, x = 12, y = 18, col = COL.mute) {
  ctx.font = '500 10.5px "JetBrains Mono", monospace'; ctx.fillStyle = col; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * 14));
}
function label(ctx, txt, x, y, col = COL.mute, align = 'left', size = 10.5, weight = 500) {
  ctx.font = `${weight} ${size}px "JetBrains Mono", monospace`; ctx.fillStyle = col; ctx.textAlign = align;
  const W = ctx.canvas.width / (ctx.getTransform().a || 1); const maxW = align === 'left' ? W - x - 8 : align === 'right' ? x - 8 : W - 16;
  ctx.fillText(txt, x, y, Math.max(40, maxW)); ctx.textAlign = 'left';
}
function rrect(ctx, x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

/* ray-cast against segment list */
function raycast(ox, oy, ang, segs, max = 1e4) {
  const dx = Math.cos(ang), dy = Math.sin(ang); let best = max, hit = null;
  for (const s of segs) {
    const [x1, y1, x2, y2] = s; const ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den; const u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) { best = t; hit = s; }
  }
  return { d: best, hit };
}
function rectSegs(x, y, w, hh) { return [[x, y, x + w, y], [x + w, y, x + w, y + hh], [x + w, y + hh, x, y + hh], [x, y + hh, x, y]]; }
