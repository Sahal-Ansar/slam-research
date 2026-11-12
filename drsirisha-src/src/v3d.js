/* =====================================================================
   V3D — a small 3D renderer on canvas 2D (painter's algorithm).
   World frame: x east, y north, z up, metres. No dependencies.
   ===================================================================== */
const v3 = {
  a: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  s: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  k: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  d: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  x: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  n: (a) => Math.hypot(a[0], a[1], a[2]),
  u: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  l: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
};
const m3 = {
  I: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  mul: (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])),
  v: (A, v) => [A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2], A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2], A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2]],
  T: (A) => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]],
  rz: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; },
  ry: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; },
  rx: (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; },
  ypr: (y, p, r) => m3.mul(m3.rz(y), m3.mul(m3.ry(p), m3.rx(r))),
  cols: (a, b, c) => [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]],
  col: (A, j) => [A[0][j], A[1][j], A[2][j]],
  exp: (w) => { // Rodrigues
    const th = Math.hypot(w[0], w[1], w[2]); if (th < 1e-12) return m3.I();
    const k = [w[0] / th, w[1] / th, w[2] / th], c = Math.cos(th), s = Math.sin(th), C = 1 - c;
    return [[c + k[0] * k[0] * C, k[0] * k[1] * C - k[2] * s, k[0] * k[2] * C + k[1] * s],
    [k[1] * k[0] * C + k[2] * s, c + k[1] * k[1] * C, k[1] * k[2] * C - k[0] * s],
    [k[2] * k[0] * C - k[1] * s, k[2] * k[1] * C + k[0] * s, c + k[2] * k[2] * C]];
  },
  add: (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j])),
  sc: (A, k) => A.map(r => r.map(v => v * k)),
};
const yawOf = (R) => Math.atan2(R[1][0], R[0][0]);
const rpyOf = (R) => ({ roll: Math.atan2(R[2][1], R[2][2]), pitch: Math.asin(clamp(-R[2][0], -1, 1)), yaw: Math.atan2(R[1][0], R[0][0]) });
const deg = (r) => r * 180 / Math.PI, rad = (d) => d * Math.PI / 180;

/* symmetric eigen-decomposition (cyclic Jacobi), any n; returns [{val, vec}] sorted descending */
function eigSym(S) {
  const n = S.length, a = S.map(r => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += Math.abs(a[p][q]);
    if (off < 1e-13) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-16) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  return Array.from({ length: n }, (_, i) => ({ val: a[i][i], vec: V.map(r => r[i]) })).sort((x, y) => y.val - x.val);
}
/* dense linear algebra for small problems */
function solveLin(A, b) { // Gaussian elimination with partial pivoting; returns x or null
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / piv; if (!f) continue; const Mr = M[r], Mc = M[c]; for (let k = c; k <= n; k++) Mr[k] -= f * Mc[k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
function invMat(A) { // Gauss-Jordan
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => +(i === j))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-15) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c]; for (let k = 0; k < 2 * n; k++) M[c][k] /= piv;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (!f) continue; const Mr = M[r], Mc = M[c]; for (let k = 0; k < 2 * n; k++) Mr[k] -= f * Mc[k]; }
  }
  return M.map(r => r.slice(n));
}
const zeros = (n, m) => Array.from({ length: n }, () => new Array(m).fill(0));

/* colour ramp (low → high) */
const RAMP = ['#1a73e8', '#00838f', '#188038', '#e3a400', '#e37400', '#d93025'];
function ramp(t) {
  t = clamp(t, 0, 1) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  const A = parseInt(RAMP[i].slice(1), 16), B = parseInt(RAMP[i + 1].slice(1), 16);
  const ch = (s) => Math.round(lerp(A >> s & 255, B >> s & 255, f));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/* ---------------- the view ---------------- */
function view3d(parent, o = {}) {
  parent.classList.add('v3stage');
  const st = makeCanvas(parent, o.aspect || .58, o.minH || 300, o.maxH || 640);
  const c = st.c; c.style.touchAction = 'pan-y'; c.style.cursor = 'grab';
  const cam = st.cam = { yaw: o.yaw ?? -2.2, pitch: o.pitch ?? .55, dist: o.dist ?? 14, target: (o.target || [0, 0, 0]).slice(), fov: o.fov || .85 };
  const home = () => ({ yaw: o.yaw ?? -2.2, pitch: o.pitch ?? .55, dist: o.dist ?? 14, target: (o.target || [0, 0, 0]).slice() });
  st.auto = o.auto ?? true; st.autoSpeed = o.autoSpeed ?? .07; st.lastUser = -1e9; st.goal = null;
  st.minDist = o.minDist || 1.5; st.maxDist = o.maxDist || 200;
  let drag = null;
  const now = () => performance.now();
  c.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, t: cam.target.slice(), pan: e.shiftKey || e.button === 2, moved: false };
    try { c.setPointerCapture(e.pointerId); } catch (_) { }
    c.style.cursor = 'grabbing'; st.lastUser = now(); st.goal = null; hideTip();
  });
  c.addEventListener('pointermove', (e) => {
    if (!drag) { st.hover(e); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.pan) {
      const E = st.E; if (!E) return; const k = cam.dist / st.h * 1.1;
      cam.target = v3.a(drag.t, v3.a(v3.k(E.right, -dx * k), v3.k(E.up, dy * k)));
    } else { cam.yaw = drag.yaw - dx * .008; cam.pitch = clamp(drag.pitch + dy * .006, -.2, 1.52); }
    st.lastUser = now();
  });
  const end = (e) => { if (drag && !drag.moved && st.onclick) st.onclick(e); drag = null; c.style.cursor = 'grab'; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', () => { drag = null; c.style.cursor = 'grab'; });
  c.addEventListener('pointerleave', () => hideTip());
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey) return; e.preventDefault(); cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0025), st.minDist, st.maxDist); st.lastUser = now(); st.goal = null; }, { passive: false });
  const zoom = (f) => { st.goal = null; cam.dist = clamp(cam.dist * f, st.minDist, st.maxDist); st.lastUser = now(); };
  const autoBtn = h('button', { title: 'Auto-rotate', 'aria-label': 'Toggle auto-rotate', class: st.auto ? 'on' : '', onclick: () => { st.auto = !st.auto; autoBtn.classList.toggle('on', st.auto); } }, '↻');
  const ctl = h('div', { class: 'v3ctl' },
    h('button', { title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => zoom(1 / 1.25) }, '+'),
    h('button', { title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => zoom(1.25) }, '−'),
    h('button', { title: 'Reset view', 'aria-label': 'Reset view', onclick: () => { st.goal = home(); st.lastUser = -1e9; } }, '⟲'),
    autoBtn);
  parent.append(ctl);
  st.hint = o.hint !== false;
  st.setAuto = (v) => { st.auto = v; autoBtn.classList.toggle('on', v); };
  st.goTo = (g) => { st.goal = Object.assign({}, g, g.target ? { target: g.target.slice() } : {}); };
  st.setHome = (g) => { Object.assign(o, g); };
  // hover targets
  st.hots = [];
  st.hover = (e) => {
    const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 1e9;
    for (const ht of st.hots) { const d = Math.hypot(ht.x - x, ht.y - y); if (d < ht.r + 6 && d < bd) { bd = d; best = ht; } }
    if (best) { showTip(typeof best.html === 'function' ? best.html() : best.html, e.clientX, e.clientY); c.style.cursor = 'help'; }
    else { hideTip(); c.style.cursor = 'grab'; }
  };
  /* --- frame --- */
  st.begin = (dt = 0) => {
    if (st.goal) {
      const g = st.goal, k = 1 - Math.exp(-dt * 4);
      if (g.yaw != null) { let dy = g.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * k; }
      if (g.pitch != null) cam.pitch += (g.pitch - cam.pitch) * k;
      if (g.dist != null) cam.dist += (g.dist - cam.dist) * k;
      if (g.target) cam.target = v3.l(cam.target, g.target, k);
    } else if (st.auto && now() - st.lastUser > 3000) cam.yaw += st.autoSpeed * dt;
    const { w, h: H } = st;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const eye = [cam.target[0] + cam.dist * cp * Math.cos(cam.yaw), cam.target[1] + cam.dist * cp * Math.sin(cam.yaw), cam.target[2] + cam.dist * sp];
    const fwd = v3.u(v3.s(cam.target, eye)); const right = v3.u(v3.x(fwd, [0, 0, 1])); const up = v3.x(right, fwd);
    st.E = { eye, fwd, right, up, f: (H / 2) / Math.tan(cam.fov / 2), cx: w / 2, cy: H / 2 };
    st.items = []; st.texts = []; st.hots = [];
    st.ctx.clearRect(0, 0, w, H);
  };
  const P = st.P = (p) => {
    const E = st.E; const dx = p[0] - E.eye[0], dy = p[1] - E.eye[1], dz = p[2] - E.eye[2];
    const z = dx * E.fwd[0] + dy * E.fwd[1] + dz * E.fwd[2]; if (z < .08) return null;
    return { x: E.cx + E.f * (dx * E.right[0] + dy * E.right[1] + dz * E.right[2]) / z, y: E.cy - E.f * (dx * E.up[0] + dy * E.up[1] + dz * E.up[2]) / z, z, k: E.f / z };
  };
  /* --- primitives (queued, depth-sorted at flush) --- */
  st.line = (a, b, col, lw = 1, op = {}) => {
    const n = op.seg || 1;
    for (let i = 0; i < n; i++) {
      const A = P(n === 1 ? a : v3.l(a, b, i / n)), B = P(n === 1 ? b : v3.l(a, b, (i + 1) / n)); if (!A || !B) continue;
      st.items.push({ t: 'l', z: (A.z + B.z) / 2 + (op.zb || 0), x1: A.x, y1: A.y, x2: B.x, y2: B.y, c: col, w: lw, a: op.alpha ?? 1, dash: op.dash });
    }
  };
  st.path = (pts, col, lw = 1.4, op = {}) => { for (let i = 1; i < pts.length; i++) st.line(pts[i - 1], pts[i], col, lw, op); };
  st.dot = (p, r, col, op = {}) => {
    const A = P(p); if (!A) return null; const rr = op.world ? Math.max(.6, r * A.k) : r;
    st.items.push({ t: 'p', z: A.z + (op.zb || 0), x: A.x, y: A.y, r: rr, c: col, a: op.alpha ?? 1, ring: op.ring, sq: op.sq, lw: op.lw });
    if (op.tip) st.hots.push({ x: A.x, y: A.y, r: Math.max(5, rr), html: op.tip });
    return A;
  };
  st.face = (pts, fill, op = {}) => {
    const S = []; let z = 0; for (const p of pts) { const A = P(p); if (!A) return; S.push(A); z += A.z; }
    if (op.cull) { let ar = 0; for (let i = 0; i < S.length; i++) { const A = S[i], B = S[(i + 1) % S.length]; ar += A.x * B.y - B.x * A.y; } if ((op.cull > 0 ? ar : -ar) < 0) return; }
    let col = fill;
    if (op.normal && fill && fill[0] === '#') { const L = v3.u([.35, .55, .9]); const sh = .62 + .38 * Math.abs(v3.d(op.normal, L)); col = shade(fill, sh); }
    st.items.push({ t: 'f', z: z / S.length + (op.zb || 0), S, c: col, s: op.stroke, w: op.lw || 1, a: op.alpha ?? 1, sa: op.salpha ?? 1 });
  };
  st.text = (p, txt, col = COL.ink, op = {}) => { const A = P(p); if (!A) return; st.texts.push({ x: A.x + (op.dx || 0), y: A.y + (op.dy || 0), txt, c: col, size: op.size || 10.5, align: op.align || 'left', bg: op.bg, w: op.weight || 500, z: A.z }); };
  st.ellipseSplat = (p, ax1, ax2, col, alpha = .5) => { // oriented disc via 2 tangent axes (world)
    const A = P(p), B = P(v3.a(p, ax1)), C = P(v3.a(p, ax2)); if (!A || !B || !C) return;
    st.items.push({ t: 'e', z: A.z, x: A.x, y: A.y, ux: B.x - A.x, uy: B.y - A.y, vx: C.x - A.x, vy: C.y - A.y, c: col, a: alpha });
  };
  st.custom = (z, fn) => st.items.push({ t: 'fn', z, fn });
  /* --- flush --- */
  st.flush = () => {
    const ctx = st.ctx; const items = st.items; items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      ctx.globalAlpha = it.a;
      if (it.t === 'l') { ctx.strokeStyle = it.c; ctx.lineWidth = it.w; if (it.dash) ctx.setLineDash(it.dash); ctx.beginPath(); ctx.moveTo(it.x1, it.y1); ctx.lineTo(it.x2, it.y2); ctx.stroke(); if (it.dash) ctx.setLineDash([]); }
      else if (it.t === 'p') {
        if (it.sq) { ctx.fillStyle = it.c; ctx.fillRect(it.x - it.r, it.y - it.r, it.r * 2, it.r * 2); }
        else { ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); if (it.ring) { ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = it.c; ctx.lineWidth = it.lw || 1.6; ctx.stroke(); } else { ctx.fillStyle = it.c; ctx.fill(); } }
      }
      else if (it.t === 'f') { ctx.beginPath(); ctx.moveTo(it.S[0].x, it.S[0].y); for (let i = 1; i < it.S.length; i++) ctx.lineTo(it.S[i].x, it.S[i].y); ctx.closePath(); if (it.c) { ctx.fillStyle = it.c; ctx.fill(); } if (it.s) { ctx.globalAlpha = it.a * it.sa; ctx.strokeStyle = it.s; ctx.lineWidth = it.w; ctx.stroke(); } }
      else if (it.t === 'e') { ctx.save(); ctx.transform(it.ux, it.uy, it.vx, it.vy, it.x, it.y); ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fillStyle = it.c; ctx.fill(); }
      else if (it.t === 'fn') it.fn(ctx);
    }
    ctx.globalAlpha = 1;
    for (const t of st.texts) {
      ctx.font = `${t.w} ${t.size}px "JetBrains Mono", monospace`; ctx.textAlign = t.align; ctx.textBaseline = 'middle';
      if (t.bg) { const tw = ctx.measureText(t.txt).width; const x0 = t.align === 'center' ? t.x - tw / 2 : t.align === 'right' ? t.x - tw : t.x; ctx.fillStyle = t.bg; rrect(ctx, x0 - 5, t.y - t.size * .75, tw + 10, t.size * 1.5, 5); ctx.fill(); }
      ctx.fillStyle = t.c; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (st.hint && st.w > 420) { ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = '#9a9aa0'; ctx.fillText('drag: rotate · shift-drag: pan · +/−: zoom', 12, st.h - 10); }
  };
  /* --- helpers --- */
  st.grid = (x0, x1, y0, y1, step = 1, z = 0, col = COL.hair, a = 1) => {
    for (let x = x0; x <= x1 + 1e-9; x += step) st.line([x, y0, z], [x, y1, z], col, 1, { seg: Math.max(1, Math.round((y1 - y0) / step / 2)), alpha: a, zb: 1e3 });
    for (let y = y0; y <= y1 + 1e-9; y += step) st.line([x0, y, z], [x1, y, z], col, 1, { seg: Math.max(1, Math.round((x1 - x0) / step / 2)), alpha: a, zb: 1e3 });
  };
  st.axes = (p, R = m3.I(), L = 1, op = {}) => {
    const cols = ['#d93025', '#188038', '#1a73e8'], names = op.names || ['x', 'y', 'z'];
    for (let j = 0; j < 3; j++) { const e = v3.a(p, v3.k(m3.col(R, j), L)); st.arrow(p, e, cols[j], op.lw || 2); if (op.labels !== false) st.text(e, names[j], cols[j], { dx: 4, size: 10, weight: 600 }); }
  };
  st.arrow = (a, b, col, lw = 1.6, op = {}) => {
    st.line(a, b, col, lw, op);
    const A = P(a), B = P(b); if (!A || !B) return;
    const ang = Math.atan2(B.y - A.y, B.x - A.x), hs = op.head || 7;
    st.items.push({ t: 'f', z: B.z - .001, S: [{ x: B.x, y: B.y }, { x: B.x - hs * Math.cos(ang - .4), y: B.y - hs * Math.sin(ang - .4) }, { x: B.x - hs * Math.cos(ang + .4), y: B.y - hs * Math.sin(ang + .4) }], c: col, a: op.alpha ?? 1 });
  };
  st.ring = (cen, R, r, col, lw = 1, op = {}) => { // circle in R's local xy plane
    const n = op.n || 28, a0 = op.a0 || 0, a1 = op.a1 ?? TAU; let prev = null;
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); const p = v3.a(cen, m3.v(R, [r * Math.cos(a), r * Math.sin(a), 0])); if (prev) st.line(prev, p, col, lw, op); prev = p; }
  };
  st.box = (mn, mx, fill, op = {}) => {
    const [x0, y0, z0] = mn, [x1, y1, z1] = mx;
    const F = [
      [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]], [[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1]],
      [[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [0, -1, 0]], [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]],
      [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]],
    ];
    const eye = st.E.eye;
    for (const f of F) {
      const n = f[4]; const ctr = v3.k(v3.a(v3.a(f[0], f[1]), v3.a(f[2], f[3])), .25);
      const facing = v3.d(n, v3.s(eye, ctr)) > 0;
      if (op.inside ? facing : !facing) { if (!op.both) continue; }
      if (op.skipFloor && n[2] === -1) continue; if (op.skipTop && n[2] === 1) continue;
      st.face(f.slice(0, 4), fill, { normal: n, stroke: op.stroke, lw: op.lw || 1, alpha: op.alpha ?? 1, salpha: op.salpha, zb: op.zb || 0 });
    }
  };
  // ellipsoid from covariance (3x3) with scale k (sigma multiplier); draws filled projected silhouette + 3 principal rings
  st.ellipsoid = (cen, S, col, op = {}) => {
    const k = op.k || 1, E = eigSym(S); const ax = E.map(e => v3.k(e.vec, k * Math.sqrt(Math.max(0, e.val))));
    const maxA = op.cap || 1e9; for (let i = 0; i < 3; i++) { const L = v3.n(ax[i]); if (L > maxA) ax[i] = v3.k(ax[i], maxA / L); }
    const A = P(cen); if (!A) return;
    // projected silhouette ≈ J Σ Jᵀ (affine approx at centre)
    const Ed = st.E, d = v3.s(cen, Ed.eye), z = v3.d(d, Ed.fwd), dr = v3.d(d, Ed.right), du = v3.d(d, Ed.up);
    const jx = v3.k(v3.s(v3.k(Ed.right, z), v3.k(Ed.fwd, dr)), Ed.f / (z * z)), jy = v3.k(v3.s(v3.k(Ed.up, z), v3.k(Ed.fwd, du)), -Ed.f / (z * z));
    let a = 0, b = 0, cc = 0; for (const v of ax) { const px = v3.d(jx, v), py = v3.d(jy, v); a += px * px; b += px * py; cc += py * py; }
    const tr = a + cc, det = a * cc - b * b, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc, l2 = Math.max(0, tr / 2 - disc);
    const ang = Math.atan2(l1 - a, b || 1e-9);
    st.items.push({ t: 'fn', z: A.z + .02, fn: (ctx) => { ctx.globalAlpha = op.fill ?? .12; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(A.x, A.y, Math.sqrt(l1) + .5, Math.sqrt(l2) + .5, Math.abs(b) < 1e-12 ? (a >= cc ? 0 : Math.PI / 2) : ang, 0, TAU); ctx.fill(); } });
    if (op.rings !== false) for (const [i, j] of [[0, 1], [1, 2], [0, 2]]) {
      let prev = null; for (let s = 0; s <= 32; s++) { const t = s / 32 * TAU; const p = v3.a(cen, v3.a(v3.k(ax[i], Math.cos(t)), v3.k(ax[j], Math.sin(t)))); if (prev) st.line(prev, p, col, op.lw || 1, { alpha: op.ralpha ?? .7 }); prev = p; }
    }
    return { axes: ax, eig: E };
  };
  // camera frustum: C position, R camera→world (cam axes x right, y down, z forward)
  st.frustum = (C, R, op = {}) => {
    const fx = op.fovx || rad(70), fy = op.fovy || rad(54), d = op.depth || 1, col = op.col || COL.ink;
    const cx = Math.tan(fx / 2) * d, cy = Math.tan(fy / 2) * d;
    const cs = [[-cx, -cy, d], [cx, -cy, d], [cx, cy, d], [-cx, cy, d]].map(p => v3.a(C, m3.v(R, p)));
    for (const p of cs) st.line(C, p, col, op.lw || 1.2, { alpha: op.alpha ?? 1, dash: op.dash });
    for (let i = 0; i < 4; i++) st.line(cs[i], cs[(i + 1) % 4], col, op.lw || 1.2, { alpha: op.alpha ?? 1, dash: op.dash });
    if (op.fill) st.face(cs, op.fill, { alpha: op.falpha ?? .12 });
    // "up" tick on the top edge
    st.line(v3.k(v3.a(cs[0], cs[1]), .5), v3.a(v3.k(v3.a(cs[0], cs[1]), .5), m3.v(R, [0, -cy * .35, 0])), col, op.lw || 1.2, { alpha: op.alpha ?? 1 });
    st.dot(C, 2.5, col, { alpha: op.alpha ?? 1 });
    return cs;
  };
  // quadrotor at p with body rotation R (x forward, y left, z up)
  st.drone = (p, R = m3.I(), col = COL.ink, s = 1, op = {}) => {
    const arm = .26 * s, rr = .12 * s;
    const pts = [[arm, arm, 0], [-arm, -arm, 0], [arm, -arm, 0], [-arm, arm, 0]].map(q => v3.a(p, m3.v(R, q)));
    st.line(pts[0], pts[1], col, 2.2 * Math.min(1.4, s), { alpha: op.alpha ?? 1 }); st.line(pts[2], pts[3], col, 2.2 * Math.min(1.4, s), { alpha: op.alpha ?? 1 });
    for (const q of pts) st.ring(q, R, rr, col, 1.2, { n: 14, alpha: op.alpha ?? 1 });
    st.box(v3.a(p, [-.06 * s, -.05 * s, -.03 * s]), v3.a(p, [.06 * s, .05 * s, .03 * s]), col, { alpha: op.alpha ?? 1 });
    st.arrow(p, v3.a(p, m3.v(R, [.42 * s, 0, 0])), op.nose || COL.vis, 2, { alpha: op.alpha ?? 1, head: 6 });
  };
  st.overlay = null;
  return st;
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(clamp(v * k, 0, 255)); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; }

/* =====================================================================
   3D MISSION REPLAY — the same flight as the 2D view, extruded.
   ===================================================================== */
const WALLH = { wall: 3.0, plain: 3.0, rack: 2.2 };
const FEAT3 = (() => { const r = rng(91); return WORLD.feats.map(f => ({ src: f, x: f.x, y: f.y, thermalOnly: f.thermalOnly, z: f.seg && f.seg.kind === 'rack' ? .25 + r() * 1.8 : .25 + r() * 2.5 })); })();
const FEAT3BY = new Map(FEAT3.map(F => [F.src, F]));
const droneZ = (t) => 1.35 + .3 * Math.sin(t * .45) + .12 * Math.sin(t * 1.3);
function missionView3d(parent, keys, opts = {}) {
  const st = view3d(parent, { aspect: opts.aspect || .56, yaw: -1.95, pitch: .78, dist: 34, target: [WORLD.W / 2, WORLD.H / 2, 0], auto: false, minH: opts.minH || 320 });
  const runs = keys.map(getRun); const cols = opts.colors || runs.map(r => r.P.col); const names = opts.names || runs.map(r => r.P.name);
  st.k = 0; st.mode = opts.mode || 'orbit'; st.speedMul = 1; st.showMap = true;
  const smoke = (() => { const r = rng(5); const z = WORLD.zones.smoke; return Array.from({ length: 140 }, () => { const a = r() * TAU, d = Math.sqrt(r()) * z.r; return { x: z.cx + Math.cos(a) * d, y: z.cy + Math.sin(a) * d, z: r() * 2.6 + .1, ph: r() * TAU }; }); })();
  // UI: mode toggle + scrub
  const bar = h('div', { class: 'v3bar' });
  const modeBtns = [['orbit', 'Orbit'], ['chase', 'Chase cam'], ['top', 'Top-down']].map(([k, t]) => h('button', { class: 'btn btn-sm btn-tonal' + (st.mode === k ? ' on' : ''), onclick: (e) => { st.mode = k; modeBtns.forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); if (k === 'orbit') st.goTo({ yaw: -1.95, pitch: .78, dist: 34, target: [WORLD.W / 2, WORLD.H / 2, 0] }); if (k === 'top') st.goTo({ pitch: 1.5, dist: 40, target: [WORLD.W / 2, WORLD.H / 2, 0], yaw: -Math.PI / 2 }); } }, t));
  const scrub = h('input', { type: 'range', min: 0, max: MISSION.steps, value: 0, step: 1, 'aria-label': 'Scrub mission time', oninput: (e) => { st.k = +e.target.value; } });
  const play = h('button', { class: 'btn btn-sm btn-tonal', onclick: (e) => { st.paused = !st.paused; e.currentTarget.textContent = st.paused ? '▶ Play' : '❚❚ Pause'; } }, '❚❚ Pause');
  bar.append(...modeBtns, play, h('span', { class: 'mono mute', style: 'font-size:11px' }, 'time'), scrub);
  parent.parentElement && parent.after(bar);
  const leg = h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'sw', style: 'background:#8e8e93' }), 'true path'), ...runs.map((r, i) => h('span', {}, h('i', { class: 'sw', style: { background: cols[i] } }), names[i])), h('span', {}, h('i', { class: 'sw', style: 'background:#d93025' }), 'LiDAR returns'), h('span', {}, h('i', { class: 'sw', style: 'background:#1a73e8' }), 'tracked camera features'));
  bar.after(leg);
  const anyCam = runs.some(r => r.P.cam), anyLid = runs.some(r => r.P.lidar), anyTh = runs.some(r => r.P.thermal);
  // keep animate running when paused but allow camera motion
  let pausedK = 0;
  animate(st, (st, dt) => {
    if (!st.paused) st.k += dt / MISSION.dt * st.speedMul;
    if (st.k > MISSION.steps + 45) st.k = 0;
    const k = Math.min(MISSION.steps, Math.floor(st.k)); if (Math.abs(+scrub.value - k) > 2) scrub.value = k;
    const g = MISSION.gt[k], sn = MISSION.sn[k], tz = droneZ(g.t);
    if (st.mode === 'chase') st.goal = { yaw: g.hd + Math.PI, pitch: .42, dist: 7.5, target: [g.x, g.y, tz] };
    st.begin(dt);
    // floor + zones
    st.grid(0, WORLD.W, 0, WORLD.H, 2, 0, '#ececf0');
    const dz = WORLD.zones.dark; st.face([[dz.x, dz.y, .01], [dz.x + dz.w, dz.y, .01], [dz.x + dz.w, dz.y + dz.h, .01], [dz.x, dz.y + dz.h, .01]], '#1d1d1f', { alpha: .14, zb: 900 });
    st.text([dz.x + dz.w / 2, dz.y + 1.2, .05], 'LOW LIGHT · LIGHTS OFF', '#55555a', { align: 'center', size: 9.5 });
    const cz = WORLD.zones.corridor; st.face([[cz.x, cz.y, .01], [cz.x + cz.w, cz.y, .01], [cz.x + cz.w, cz.y + cz.h, .01], [cz.x, cz.y + cz.h, .01]], COL.lid, { alpha: .05, zb: 900 });
    st.text([cz.x + cz.w / 2, cz.y + cz.h / 2, .05], 'LONG CORRIDOR', COL.lid, { align: 'center', size: 9.5 });
    st.text([WORLD.zones.smoke.cx, WORLD.zones.smoke.cy - WORLD.zones.smoke.r - .4, .05], 'SMOKE', '#6e6e73', { align: 'center', size: 9.5 });
    // corridor intensity stripes on the floor
    for (const x of WORLD.stripes) st.face([[x, cz.y + .2, .015], [x + .5, cz.y + .2, .015], [x + .5, cz.y + cz.h - .2, .015], [x, cz.y + cz.h - .2, .015]], '#c9c9cf', { alpha: .55, zb: 899 });
    // walls
    for (const s of WORLD.segs) {
      const H = WALLH[s.kind] || 3; const a = [s.x1, s.y1, 0], b = [s.x2, s.y2, 0], b2 = [s.x2, s.y2, H], a2 = [s.x1, s.y1, H];
      const n = v3.u([-(s.y2 - s.y1), s.x2 - s.x1, 0]);
      st.face([a, b, b2, a2], s.kind === 'rack' ? '#b06000' : '#9aa0a6', { normal: n, alpha: s.kind === 'rack' ? .16 : .1, stroke: '#5f6368', salpha: 2.6, lw: .8 });
    }
    // features (texture) on walls
    const tracked = new Set(sn.camList);
    for (const f of FEAT3) {
      if (f.thermalOnly) { if (anyTh) st.dot([f.x, f.y, f.z], 2, '#e37400', { alpha: .55 }); continue; }
      const on = anyCam && tracked.has(f.src);
      st.dot([f.x, f.y, f.z], on ? 2.6 : 1.4, on ? COL.vis : '#b8b8bf', { alpha: on ? 1 : .7 });
    }
    // smoke particles
    for (const p of smoke) { const wob = Math.sin(st.t * .6 + p.ph) * .25; st.dot([p.x + wob, p.y + Math.cos(st.t * .5 + p.ph) * .2, p.z + (st.t * .15 + p.ph) % .6], 7, '#8e8e93', { alpha: .09, world: false }); }
    // true path (full) + estimator trails
    const gtp = []; for (let i = 0; i <= MISSION.steps; i += 6) { const q = MISSION.gt[i]; gtp.push([q.x, q.y, droneZ(q.t)]); }
    st.path(gtp, '#8e8e93', 1.2, { dash: [4, 4], alpha: .8 });
    runs.forEach((run, ri) => {
      const tr = []; const ofs = ri * 1.7;
      for (let i = 0; i <= k; i += 3) { const o = run.out[i], q = MISSION.gt[i]; tr.push([o.x, o.y, droneZ(q.t) + o.err * .22 * Math.sin(i * .004 + ofs)]); }
      const o = run.out[k]; const cur = [o.x, o.y, tz + o.err * .22 * Math.sin(k * .004 + ofs)]; tr.push(cur);
      st.path(tr, cols[ri], 2);
      st.dot(cur, 4.5, cols[ri], { ring: true, lw: 2.2, tip: () => `<b>${names[ri]}</b>error now: ${o.err.toFixed(2)} m` });
      st.line(cur, [g.x, g.y, tz], cols[ri], 1, { dash: [2, 3], alpha: .7 });
      st.text(cur, names[ri].length > 22 ? names[ri].slice(0, 21) + '…' : names[ri], cols[ri], { dx: 8, dy: -8 - ri * 14, size: 9.5, bg: 'rgba(255,255,255,.82)' });
    });
    // drone + sensors
    const R = m3.mul(m3.rz(g.hd), m3.rx(clamp(-g.yawRate * .04, -.3, .3)));
    if (anyLid) {
      for (const hit of sn.hits) {
        const d = Math.hypot(hit.x - g.x, hit.y - g.y) || 1;
        for (const el of [-7, 3, 14, 26, 38, 50]) {
          let z = tz + d * Math.tan(rad(el)), x = hit.x, y = hit.y;
          if (z < 0) { const t = tz / (tz - z); x = lerp(g.x, hit.x, t); y = lerp(g.y, hit.y, t); z = 0; }
          if (z > 3) { const t = (3 - tz) / (z - tz); x = lerp(g.x, hit.x, t); y = lerp(g.y, hit.y, t); z = 3; }
          st.dot([x, y, z], hit.smoke ? 2 : 1.6, hit.smoke ? '#8e8e93' : COL.lid, { alpha: .85 });
        }
      }
      // LiDAR translation-uncertainty ellipsoid from the 2D information matrix (schematic scale)
      if (sn.l1 > 0) {
        const s1 = 1 / Math.sqrt(sn.l1 + 1e-3), s2 = 1 / Math.sqrt(Math.max(sn.l2, .02)); const e1 = [sn.ev[0], sn.ev[1], 0], e2 = [-sn.ev[1], sn.ev[0], 0];
        const Sg = [[0, 0, 0], [0, 0, 0], [0, 0, .004]]; const add = (e, s) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) Sg[i][j] += e[i] * e[j] * s * s; };
        add(e2, s1 * 1.2); add(e1, s2 * 1.2);
        st.ellipsoid([g.x, g.y, tz], Sg, COL.lid, { k: 1, cap: 6, fill: .1, ralpha: .55 });
      }
    }
    if (anyCam) {
      const Rc = m3.mul(m3.rz(g.hd), m3.cols([0, -1, 0], [0, 0, -1], [1, 0, 0]));
      st.frustum([g.x, g.y, tz], Rc, { depth: 1.6, col: sn.dark ? '#5f6368' : COL.vis, fill: COL.vis, falpha: .06, lw: 1 });
      for (const f of sn.camList.slice(0, 40)) { const F = FEAT3BY.get(f); if (F) st.line([g.x, g.y, tz], [F.x, F.y, F.z], COL.vis, .7, { alpha: .22 }); }
    }
    st.drone([g.x, g.y, tz], R, COL.ink, 1.6);
    st.line([g.x, g.y, tz], [g.x, g.y, 0], COL.ink, .8, { dash: [2, 3], alpha: .4 });
    // HUD
    const Ht = [`t ${g.t.toFixed(1)} s   alt ${tz.toFixed(2)} m`, `features ${sn.cam}${sn.dark ? ' · dark' : ''}${sn.blur > .3 ? ' · blur' : ''}`, `LiDAR λmin/λmax ${(sn.l2 / Math.max(1e-6, sn.l1)).toFixed(2)}${sn.inCorr ? ' · corridor' : ''}${sn.smoke ? ' · smoke returns' : ''}`];
    st.flush();
    hud(st.ctx, Ht, 12, 18);
  });
  return st;
}
