/* =====================================================================
   MISSION ENGINE — one GPS-denied flight, many estimators.
   Illustrative model: estimator error grows according to how well each
   sensor is constrained at that moment (computed from the geometry).
   It is a teaching simulation, not measured data.
   ===================================================================== */
const WORLD = (() => {
  const W = 40, H = 22;
  const segs = [];
  const add = (x1, y1, x2, y2, tex, kind = 'wall') => segs.push({ x1, y1, x2, y2, tex, kind });
  // outer shell
  add(0, 0, 40, 0, 1.0); add(40, 0, 40, 22, 0.9); add(40, 22, 0, 22, 1.0); add(0, 22, 0, 0, 1.0);
  // solid block above corridor (12..28, 13..22)
  add(12, 13, 28, 13, 0.32, 'plain');  // corridor north wall — smooth, some posters
  add(12, 13, 12, 22, 0.9); add(28, 13, 28, 22, 0.8);
  // corridor south wall with gap to racks at both ends
  add(14, 9, 26, 9, 0.32, 'plain');
  // racks (repetitive texture)
  for (const y of [2.6, 5.0]) { add(14.5, y, 25.5, y, 0.75, 'rack'); add(14.5, y + 0.6, 25.5, y + 0.6, 0.75, 'rack'); add(14.5, y, 14.5, y + .6, .7, 'rack'); add(25.5, y, 25.5, y + .6, .7, 'rack'); }
  // pillars in hall B
  for (const [px, py] of [[31.5, 6], [36.5, 6], [31.5, 16.5], [36.5, 16.5]]) {
    add(px - .5, py - .5, px + .5, py - .5, .8); add(px + .5, py - .5, px + .5, py + .5, .8); add(px + .5, py + .5, px - .5, py + .5, .8); add(px - .5, py + .5, px - .5, py - .5, .8);
  }
  // lab furniture in room A
  add(2, 15, 6, 15, 1); add(6, 15, 6, 18, 1); add(2, 4, 4.5, 4, 1); add(4.5, 4, 4.5, 6.5, 1);
  // features along walls
  const r = rng(7); const feats = [];
  for (const s of segs) {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const n = Math.round(L * 3.2 * s.tex);
    for (let i = 0; i < n; i++) { const t = r(); feats.push({ x: lerp(s.x1, s.x2, t), y: lerp(s.y1, s.y2, t), seg: s, warm: r() < 0.18 || s.kind === 'rack' && r() < .3 }); }
  }
  // warm objects (pipes / people / machines) visible to thermal even in plain areas
  for (let i = 0; i < 22; i++) { const x = 13 + r() * 14; feats.push({ x, y: r() < .5 ? 9 : 13, seg: null, warm: true, thermalOnly: true }); }
  // floor intensity stripes in corridor (for intensity-aided LIO)
  const stripes = []; for (let x = 13; x < 27; x += 2.4) stripes.push(x);
  const zones = {
    dark: { x: 28, y: 0, w: 12, h: 22, label: 'LOW LIGHT · LIGHTS OFF' },
    smoke: { cx: 21, cy: 7.2, r: 2.6, label: 'SMOKE' },
    corridor: { x: 12, y: 9, w: 16, h: 4, label: 'LONG CORRIDOR · NO GEOMETRY ALONG AXIS' },
  };
  // path waypoints (closed loop)
  const wp = [[6, 11], [9, 11], [13, 11], [20, 11], [27, 11], [30.5, 11.1], [33.4, 11.0], [35.2, 9.9], [35.0, 8.4], [33.4, 7.5], [30, 7.4], [26, 7.4], [21, 7.6], [16, 7.4], [13, 7.2], [9, 7.6], [6.2, 8.0], [5.0, 9.6], [6, 11]];
  return { W, H, segs, feats, zones, wp, stripes };
})();

// sample a closed Catmull-Rom path by arc length
const PATH = (() => {
  const P = WORLD.wp; const pts = [];
  const n = P.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = i - 1 >= 0 ? P[i - 1] : P[n - 1], p1 = P[i], p2 = P[i + 1], p3 = i + 2 <= n ? P[i + 2] : P[i + 2 - n];
    for (let t = 0; t < 1; t += 0.02) {
      const t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[n]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => {
    s = ((s % L) + L) % L;
    let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    const x = lerp(pts[lo][0], pts[hi][0], t), y = lerp(pts[lo][1], pts[hi][1], t);
    const hd = Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0]);
    return { x, y, hd };
  };
  return { L, at, pts };
})();
// the spin manoeuvre: around s where drone is in hall B
const SPIN = (() => { let best = 0, bd = 1e9; for (let s = 0; s < PATH.L; s += .1) { const p = PATH.at(s); const d = Math.hypot(p.x - 9.2, p.y - 11); if (d < bd) { bd = d; best = s; } } return { s0: best - 1.0, s1: best + 1.0 }; })();

function inRect(z, x, y) { return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h; }
function inSmoke(x, y) { const z = WORLD.zones.smoke; return Math.hypot(x - z.cx, y - z.cy) < z.r; }
function segCross(ax, ay, bx, by, s) {
  const d = (bx - ax) * (s.y2 - s.y1) - (by - ay) * (s.x2 - s.x1); if (Math.abs(d) < 1e-9) return false;
  const t = ((s.x1 - ax) * (s.y2 - s.y1) - (s.y1 - ay) * (s.x2 - s.x1)) / d;
  const u = ((s.x1 - ax) * (by - ay) - (s.y1 - ay) * (bx - ax)) / d;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}
function los(ax, ay, bx, by) { for (const s of WORLD.segs) if (segCross(ax, ay, bx, by, s)) return false; return true; }
function lineThroughSmoke(ax, ay, bx, by) { const z = WORLD.zones.smoke; const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy; let t = ((z.cx - ax) * dx + (z.cy - ay) * dy) / L2; t = clamp(t, 0, 1); return Math.hypot(ax + dx * t - z.cx, ay + dy * t - z.cy) < z.r * .85; }

/* sensing model at a pose */
const SEGARR = WORLD.segs.map(s => [s.x1, s.y1, s.x2, s.y2, s]);
function sense(x, y, hd, yawRate, t) {
  const dark = inRect(WORLD.zones.dark, x, y);
  const smokeHere = inSmoke(x, y);
  const blur = clamp((Math.abs(yawRate) - 1.2) / 3, 0, 1);
  // camera features
  let cam = 0, camList = [], th = 0;
  for (const f of WORLD.feats) {
    const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
    if (d > 10 || d < .3) continue;
    let a = Math.atan2(dy, dx) - hd; a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 0.85) continue;
    if (!los(x, y, f.x - dx / d * .05, f.y - dy / d * .05)) continue;
    const smoky = smokeHere || lineThroughSmoke(x, y, f.x, f.y);
    if (f.warm) th++;
    if (f.thermalOnly) continue;
    if (inRect(WORLD.zones.dark, f.x, f.y) || dark) continue;
    if (smoky) continue;
    cam++; camList.push(f);
  }
  const ffc = (t % 9) > 8.5; // thermal flat-field correction shutter
  // lidar: 360° rays → information matrix for translation
  let Hxx = 0, Hxy = 0, Hyy = 0, hits = [], nR = 90, smokeRet = 0;
  for (let i = 0; i < nR; i++) {
    const a = hd + i / nR * TAU;
    const rc = raycast(x, y, a, SEGARR, 9);
    if (!rc.hit) continue;
    let d = rc.d;
    // smoke returns: rays through the plume come back early (false points)
    const hx = x + Math.cos(a) * d, hy = y + Math.sin(a) * d;
    if (lineThroughSmoke(x, y, hx, hy) && (i * 7919 % 10) < 7) { smokeRet++; hits.push({ x: x + Math.cos(a) * Math.min(d, 1.2 + (i % 5) * .3), y: y + Math.sin(a) * Math.min(d, 1.2 + (i % 5) * .3), smoke: true }); continue; }
    const s = rc.hit; const ex = s[2] - s[0], ey = s[3] - s[1]; const L = Math.hypot(ex, ey);
    const nx = -ey / L, ny = ex / L;
    Hxx += nx * nx; Hxy += nx * ny; Hyy += ny * ny;
    hits.push({ x: hx, y: hy, nx, ny, kind: s[4].kind });
  }
  // eigen of 2x2
  const tr = Hxx + Hyy, det = Hxx * Hyy - Hxy * Hxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
  let ev = Math.abs(Hxy) > 1e-6 ? [l2 - Hyy, Hxy] : (Hxx < Hyy ? [1, 0] : [0, 1]);
  const evn = Math.hypot(ev[0], ev[1]) || 1; ev = [ev[0] / evn, ev[1] / evn];
  const lidQ = clamp((l2 / Math.max(1e-6, l1)) / 0.12, 0, 1) * clamp(1 - smokeRet / 40, 0.2, 1) * (smokeHere ? .3 : 1);
  const inCorr = inRect(WORLD.zones.corridor, x, y);
  return { cam, camList, th, ffc, blur, dark, smoke: smokeHere || smokeRet > 8, smokeRet, hits, l1, l2, ev, lidQ, inCorr, stripes: inCorr };
}

/* estimator profiles (illustrative) */
const EST = {
  vio_mono: { name: 'Mono VIO', col: COL.vis, cam: 'mono', base: .010 },
  vio_stereo: { name: 'Stereo VIO', col: COL.vis, cam: 'stereo', base: .008 },
  vio_filter: { name: 'Filter VIO (MSCKF)', col: COL.vis, cam: 'stereo', base: .010 },
  vio_direct: { name: 'Direct / semi-direct VIO', col: COL.vis, cam: 'mono', base: .010, photometric: true },
  vio_loop: { name: 'VI-SLAM + loop closure', col: COL.vis, cam: 'stereo', base: .008, loop: true },
  vio_learnedfeat: { name: 'Learned-feature VIO', col: COL.vis, cam: 'stereo', base: .008, lowlight: .5, loop: true },
  lio: { name: 'LiDAR-inertial (ESIKF)', col: COL.lid, lidar: true, base: .003 },
  lio_point: { name: 'Point-wise LIO', col: COL.lid, lidar: true, base: .003, agile: true },
  lio_graph: { name: 'LIO factor graph + loop', col: COL.lid, lidar: true, base: .0035, loop: true },
  lio_icp: { name: 'LiDAR-only ICP', col: COL.lid, lidar: true, base: .005, noImu: true },
  lio_intensity: { name: 'Intensity-augmented LIO', col: COL.lid, lidar: true, base: .003, intensity: true },
  lio_degaware: { name: 'Degeneracy-aware LIO', col: COL.lid, lidar: true, base: .003, degAware: true },
  livo: { name: 'LiDAR-visual-inertial', col: COL.fus, lidar: true, cam: 'mono', base: .0025 },
  livo_loop: { name: 'LIVO + loop closure', col: COL.fus, lidar: true, cam: 'stereo', base: .0025, loop: true },
  multi: { name: 'Multi-modal (L+V+T)', col: COL.fus, lidar: true, cam: 'stereo', thermal: true, base: .0025, loop: true },
  tio: { name: 'Thermal-inertial', col: COL.spc, thermal: true, base: .012 },
  rio: { name: 'Radar-inertial', col: COL.spc, radar: true, base: .02 },
  eio: { name: 'Event-visual-inertial', col: COL.spc, cam: 'mono', event: true, base: .009 },
  learned: { name: 'Learned dense VO', col: COL.lrn, cam: 'mono', base: .007, lowlight: .35, learned: true, loop: true },
  swarm: { name: 'Collaborative VI-SLAM', col: COL.swm, cam: 'stereo', base: .008, loop: true },
  imu: { name: 'IMU only', col: COL.mute, base: 0 },
};

/* run one estimator for the whole mission deterministically: returns arrays per time step */
const MISSION = { speed: 1.6, dt: 1 / 30 };
MISSION.T = PATH.L / MISSION.speed;
MISSION.steps = Math.ceil(MISSION.T / MISSION.dt);
// precompute ground truth + sensing per step (shared)
MISSION.gt = []; MISSION.sn = [];
(() => {
  let prevHd = PATH.at(0).hd;
  for (let k = 0; k <= MISSION.steps; k++) {
    const t = k * MISSION.dt, s = t * MISSION.speed;
    const p = PATH.at(s);
    let hd = p.hd, yawRate = 0;
    if (s > SPIN.s0 && s < SPIN.s1) { const u = (s - SPIN.s0) / (SPIN.s1 - SPIN.s0); hd = p.hd + TAU * (u * u * (3 - 2 * u)); }
    let dh = hd - prevHd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); yawRate = dh / MISSION.dt; prevHd = hd;
    MISSION.gt.push({ x: p.x, y: p.y, hd, t, s, yawRate });
  }
  for (let k = 0; k <= MISSION.steps; k++) { const g = MISSION.gt[k]; MISSION.sn.push(k % 2 ? MISSION.sn[k - 1] : sense(g.x, g.y, g.hd, g.yawRate, g.t)); }
})();

const DIVERGE = 7;
function runEstimator(key, seed = 3) {
  const P = EST[key]; const r = rng(seed * 97 + key.length * 13);
  let ex = 0, ey = 0, blackout = 0, th = 0.9;
  const out = []; const health = [];
  let closedAt = -1, closeFrom = null;
  for (let k = 0; k <= MISSION.steps; k++) {
    const g = MISSION.gt[k], sn = MISSION.sn[k], v = MISSION.speed, dt = MISSION.dt;
    // per-sensor translational quality 0..1 and degenerate direction
    let qVis = 0, qLid = 0, qTh = 0, qRad = 0, dir = null;
    if (P.cam) {
      let n = sn.cam;
      if (P.lowlight && sn.dark) n = Math.max(n, 30 * P.lowlight);
      let blurPen = P.event ? 0 : sn.blur * (P.cam === 'mono' ? 1 : .75);
      if (P.event && sn.dark) n = Math.max(n, 9);
      qVis = clamp(n / 22, 0, 1) * (1 - blurPen);
      if (P.cam === 'mono' && Math.abs(g.yawRate) > 2.2) qVis *= .15; // pure rotation: no parallax for monocular depth
      if (P.photometric && sn.dark) qVis = 0;
    }
    if (P.lidar) {
      qLid = sn.lidQ;
      if (P.intensity && sn.inCorr) qLid = Math.max(qLid, .75);
      if (P.noImu && Math.abs(g.yawRate) > 2.5) qLid *= .4;
      if (P.agile && Math.abs(g.yawRate) > 2.5) qLid = Math.max(qLid, sn.lidQ);
      if (qLid < .55 && !P.intensity) dir = sn.ev;
    }
    if (P.thermal) qTh = sn.ffc ? 0 : clamp(sn.th / 12, 0, 1) * .85;
    if (P.radar) qRad = .55;
    const qAll = 1 - (1 - qVis) * (1 - qLid) * (1 - qTh) * (1 - qRad);
    // combine: LiDAR degeneracy direction is fixed by vision/thermal if present
    const qAlong = dir ? 1 - (1 - qVis * 1.1) * (1 - qTh) * (1 - qRad) * (1 - (P.degAware ? .6 : 0)) : qAll;
    if (qAll < .12 && !(P.noImu)) blackout += dt; else blackout = Math.max(0, blackout - dt * 12);
    const base = P.base || .02;
    const rate = v * base * (1 + 8 * Math.pow(1 - qAll, 2)) + (P.noImu && qAll < .3 ? .18 : 0) + (P.base === 0 ? .02 + blackout * .05 : blackout * .05);
    // random walk direction with persistence
    th += gauss(r) * .03; const dx = Math.cos(th), dy = Math.sin(th);
    let incx = dx * rate * dt, incy = dy * rate * dt;
    if (dir && qAlong < .6) { const slide = v * .11 * Math.pow(1 - qAlong, 1.5) * dt; const sgn = (dir[0] * Math.cos(g.hd) + dir[1] * Math.sin(g.hd)) >= 0 ? 1 : -1; incx += dir[0] * slide * sgn * .6; incy += dir[1] * slide * sgn * .6; }
    // smoke false returns bias LiDAR
    if (P.lidar && !P.thermal && !P.radar && sn.smoke) { incx += (P.cam ? .12 : .25) * dt; }
    if (P.cam === 'mono' && !P.lidar && !P.event && Math.abs(g.yawRate) > 2.2) { incx += .5 * dt; incy -= .35 * dt; }
    ex += incx; ey += incy;
    const em = Math.hypot(ex, ey); if (em > DIVERGE) { ex *= DIVERGE / em; ey *= DIVERGE / em; }
    // loop closure: once back near start at the end of the lap
    if (P.loop && closedAt < 0 && g.s > PATH.L - 3.2) { closedAt = k; closeFrom = { ex, ey }; }
    let cx = ex, cy = ey;
    if (closedAt >= 0) { const u = clamp((k - closedAt) / 25, 0, 1); const e = u * u * (3 - 2 * u); cx = ex * (1 - e * .93); cy = ey * (1 - e * .93); }
    out.push({ x: g.x + cx, y: g.y + cy, err: Math.hypot(cx, cy) });
    health.push({ qVis, qLid, qTh, qRad, qAll, blackout });
  }
  // pose-graph style correction of the whole past trajectory after loop closure (for map redraw)
  let corrected = null;
  if (closedAt >= 0) {
    corrected = out.map((o, i) => { const g = MISSION.gt[i]; const w = i / closedAt; const ox = o.x - g.x, oy = o.y - g.y; const f = i <= closedAt ? (1 - w * .93) : 1; return { x: g.x + (i <= closedAt ? ox - (closeFrom.ex * w * .93) : ox), y: g.y + (i <= closedAt ? oy - (closeFrom.ey * w * .93) : oy) }; });
  }
  return { key, P, out, health, closedAt, corrected };
}
const RUNS = {}; const getRun = (k) => (RUNS[k] ||= runEstimator(k));

/* ---------- renderer ---------- */
function missionView(parent, keys, opts = {}) {
  const st = makeCanvas(parent, opts.aspect || 0.56, opts.minH || 300, opts.maxH || 640);
  const runs = keys.map(getRun);
  const layer = Object.assign({ gt: true, rays: true, feats: true, cone: true, map: true, zones: true, ellipse: true, strip: true }, opts.layers || {});
  st.layer = layer; st.runs = runs; st.k = 0; st.speedMul = opts.speedMul || 1;
  const stripH = () => layer.strip ? Math.max(70, st.h * .2) : 0;
  const tf = () => {
    const pad = 14, sh = stripH();
    const s = Math.min((st.w - pad * 2) / WORLD.W, (st.h - sh - pad * 2) / WORLD.H);
    const ox = (st.w - WORLD.W * s) / 2, oy = pad;
    return { s, ox, oy, X: (x) => ox + x * s, Y: (y) => oy + (WORLD.H - y) * s };
  };
  st.seek = (k) => { st.k = clamp(k, 0, MISSION.steps); };
  animate(st, (st, dt) => {
    st.k += dt / MISSION.dt * st.speedMul;
    if (st.k > MISSION.steps + 60) st.k = 0;
    const k = Math.min(MISSION.steps, Math.floor(st.k));
    const { ctx, w, h } = st; const T = tf(); const { s, X, Y } = T;
    ctx.clearRect(0, 0, w, h);
    const g = MISSION.gt[k], sn = MISSION.sn[k];
    const compact = w < 720;
    // zones
    if (layer.zones) {
      const zd = WORLD.zones.dark; ctx.fillStyle = 'rgba(29,29,31,.07)'; ctx.fillRect(X(zd.x), Y(zd.y + zd.h), zd.w * s, zd.h * s);
      const zc = WORLD.zones.corridor; ctx.fillStyle = hexA(COL.lid, .045); ctx.fillRect(X(zc.x), Y(zc.y + zc.h), zc.w * s, zc.h * s);
      const zs = WORLD.zones.smoke; const gr = ctx.createRadialGradient(X(zs.cx), Y(zs.cy), 0, X(zs.cx), Y(zs.cy), zs.r * s);
      gr.addColorStop(0, 'rgba(110,110,115,.30)'); gr.addColorStop(1, 'rgba(110,110,115,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X(zs.cx), Y(zs.cy), zs.r * s, 0, TAU); ctx.fill();
      // solid block
      ctx.fillStyle = COL.soft; ctx.fillRect(X(12), Y(22), 16 * s, 9 * s);
      label(ctx, compact ? 'LOW LIGHT' : zd.label, X(zd.x) + 6, Y(zd.y) - 8, COL.mute, 'left', compact ? 8.5 : 9.5);
      label(ctx, compact ? 'CORRIDOR' : zc.label, X(zc.x + zc.w / 2), Y(zc.y + zc.h) - 6, COL.lid, 'center', compact ? 8.5 : 9.5);
      label(ctx, 'SMOKE', X(zs.cx), Y(zs.cy - zs.r) + 12, COL.mute, 'center', 9.5);
      if (!compact) { label(ctx, 'LAB · TEXTURED', X(.6), Y(.6), COL.mute, 'left', 9.5); label(ctx, 'RACKS · REPETITIVE', X(14.5), Y(1.2), COL.mute, 'left', 9.5); }
      // floor stripes (only relevant for intensity LIO)
      if (opts.stripes) { ctx.fillStyle = hexA(COL.lid, .18); for (const x of WORLD.stripes) ctx.fillRect(X(x), Y(13), .35 * s, 4 * s); }
    }
    // walls
    ctx.lineCap = 'round';
    for (const sg of WORLD.segs) {
      ctx.strokeStyle = sg.kind === 'plain' ? '#b9b9c0' : COL.ink; ctx.lineWidth = sg.kind === 'rack' ? 1.4 : 2.2;
      ctx.beginPath(); ctx.moveTo(X(sg.x1), Y(sg.y1)); ctx.lineTo(X(sg.x2), Y(sg.y2)); ctx.stroke();
    }
    if (layer.feats) { ctx.fillStyle = COL.ink; for (const f of WORLD.feats) if (!f.thermalOnly) { ctx.fillRect(X(f.x) - .9, Y(f.y) - .9, 1.8, 1.8); } }
    if (opts.thermal) { ctx.fillStyle = COL.spc; for (const f of WORLD.feats) if (f.warm) { ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), 1.8, 0, TAU); ctx.fill(); } }
    // sensing at current pose
    const P0 = runs[0].P;
    if (layer.rays && runs.some(r => r.P.lidar)) {
      ctx.strokeStyle = hexA(COL.lid, .16); ctx.lineWidth = .8; ctx.beginPath();
      for (const ht of sn.hits) { ctx.moveTo(X(g.x), Y(g.y)); ctx.lineTo(X(ht.x), Y(ht.y)); } ctx.stroke();
      for (const ht of sn.hits) { ctx.fillStyle = ht.smoke ? COL.mute : COL.lid; ctx.fillRect(X(ht.x) - 1.3, Y(ht.y) - 1.3, 2.6, 2.6); }
    }
    if (layer.cone && runs.some(r => r.P.cam || r.P.thermal)) {
      ctx.fillStyle = hexA(COL.vis, .07); ctx.beginPath(); ctx.moveTo(X(g.x), Y(g.y));
      for (let a = -.85; a <= .85; a += .1) ctx.lineTo(X(g.x + Math.cos(g.hd + a) * 10), Y(g.y + Math.sin(g.hd + a) * 10));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA(COL.vis, .55); ctx.lineWidth = .8; ctx.beginPath();
      for (const f of sn.camList) { ctx.moveTo(X(g.x), Y(g.y)); ctx.lineTo(X(f.x), Y(f.y)); } ctx.stroke();
      ctx.fillStyle = COL.vis; for (const f of sn.camList) { ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), 2.4, 0, TAU); ctx.fill(); }
    }
    // gt trail
    if (layer.gt) {
      ctx.setLineDash([3, 4]); ctx.strokeStyle = '#9a9aa0'; ctx.lineWidth = 1.3; ctx.beginPath();
      for (let i = 0; i <= k; i += 3) { const p = MISSION.gt[i]; i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); } ctx.stroke(); ctx.setLineDash([]);
    }
    // estimate trails
    runs.forEach((R, ri) => {
      const col = opts.colors?.[ri] || R.P.col;
      const useCorr = R.corrected && k > R.closedAt + 25;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= k; i += 2) { const p = useCorr && i <= R.closedAt ? R.corrected[i] : R.out[i]; i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)); }
      ctx.stroke();
      const e = R.out[k];
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (R.closedAt >= 0 && k >= R.closedAt && k < R.closedAt + 60) { label(ctx, 'LOOP CLOSED', X(e.x) + 8, Y(e.y) - 8 - ri * 12, col, 'left', 10, 700); }
    });
    // uncertainty ellipse (LiDAR information)
    if (layer.ellipse && runs.some(r => r.P.lidar)) {
      const ax = 1 / Math.sqrt(Math.max(sn.l2, .4)), bx = 1 / Math.sqrt(Math.max(sn.l1, .4));
      const ang = Math.atan2(sn.ev[1], sn.ev[0]);
      ctx.save(); ctx.translate(X(g.x), Y(g.y)); ctx.rotate(-ang); ctx.strokeStyle = COL.lid; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.ellipse(0, 0, Math.min(ax * s * 2.2, 160), bx * s * 2.2, 0, 0, TAU); ctx.stroke(); ctx.restore(); ctx.setLineDash([]);
    }
    drone(ctx, X(g.x), Y(g.y), -g.hd, 1, COL.ink);
    // HUD
    const lines = compact ? [`GPS · NO FIX  ·  t ${g.t.toFixed(1)} s`] : [`GPS · NO FIX`, `t ${g.t.toFixed(1)} s  ·  ${(g.s).toFixed(1)} m flown`];
    if (!compact && runs.some(r => r.P.cam)) lines.push(`camera features ${sn.cam}${sn.blur > .2 ? ' · MOTION BLUR' : ''}`);
    if (!compact && runs.some(r => r.P.lidar)) lines.push(`LiDAR λmin/λmax ${(sn.l2 / Math.max(1e-6, sn.l1)).toFixed(2)}${sn.lidQ < .5 ? ' · DEGENERATE' : ''}`);
    if (!compact && runs.some(r => r.P.thermal)) lines.push(`thermal features ${sn.th}${sn.ffc ? ' · FFC SHUTTER' : ''}`);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(T.ox + 4, T.oy + 4, compact ? 150 : 230, lines.length * 14 + 8);
    hud(ctx, lines, T.ox + 10, T.oy + 17, COL.ink);
    // legend of errors
    let ly = T.oy + 4;
    runs.forEach((R, ri) => {
      const col = opts.colors?.[ri] || R.P.col; const ee = R.out[k].err; const txt = `${opts.names?.[ri] || R.P.name}  ${ee >= DIVERGE - .01 ? 'DIVERGED' : ee.toFixed(2) + ' m'}`;
      ctx.font = `600 ${compact ? 10 : 11}px Archivo, sans-serif`; const tw = ctx.measureText(txt).width + 26;
      const lx = T.ox + WORLD.W * s - tw - 4;
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillRect(lx, ly, tw, 18);
      ctx.fillStyle = col; ctx.fillRect(lx + 6, ly + 8, 12, 3);
      ctx.fillStyle = COL.ink; ctx.fillText(txt, lx + 22, ly + 13); ly += 20;
    });
    // strip chart: error vs time
    if (layer.strip) {
      const sh = stripH(), y0 = h - sh + 8, y1 = h - 14, x0 = T.ox, x1 = T.ox + WORLD.W * s;
      ctx.strokeStyle = COL.hair; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      const maxE = Math.max(1, ...runs.map(R => Math.max(...R.out.map(o => o.err)))); const maxLbl = maxE >= DIVERGE - .01 ? DIVERGE + ' (= diverged)' : maxE.toFixed(1);
      // condition bands
      const bands = [];
      for (let i = 0; i <= MISSION.steps; i += 4) { const q = MISSION.sn[i]; const c = q.dark ? 'dark' : q.inCorr ? 'corr' : inSmoke(MISSION.gt[i].x, MISSION.gt[i].y) || q.smokeRet > 8 ? 'smoke' : q.blur > .2 ? 'spin' : null; bands.push(c); }
      const bc = { dark: 'rgba(29,29,31,.08)', corr: hexA(COL.lid, .08), smoke: 'rgba(110,110,115,.14)', spin: hexA(COL.lrn, .15) };
      bands.forEach((c, i) => { if (!c) return; ctx.fillStyle = bc[c]; ctx.fillRect(x0 + (i * 4 / MISSION.steps) * (x1 - x0), y0, (4 / MISSION.steps) * (x1 - x0) + .5, y1 - y0); });
      runs.forEach((R, ri) => {
        const col = opts.colors?.[ri] || R.P.col; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i <= k; i += 3) { const xx = x0 + i / MISSION.steps * (x1 - x0), yy = y1 - R.out[i].err / maxE * (y1 - y0 - 4); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      });
      ctx.strokeStyle = COL.ink; ctx.beginPath(); const cx = x0 + k / MISSION.steps * (x1 - x0); ctx.moveTo(cx, y0); ctx.lineTo(cx, y1); ctx.stroke();
      label(ctx, `position error (m) · axis max ${maxLbl}`, x0, y0 - 1, COL.mute, 'left', 9.5);
      const firstOf = (c) => { const i = bands.indexOf(c); return i < 0 ? null : x0 + (i * 4 / MISSION.steps) * (x1 - x0); };
      let lastX = -1e9; for (const [c, txt, col] of [['spin', 'yaw spin', COL.lrn], ['corr', 'corridor', COL.lid], ['dark', 'low-light hall', COL.mute], ['smoke', 'smoke', COL.mute]]) { let xx = firstOf(c); if (xx == null) continue; xx = Math.max(xx, lastX + 6); label(ctx, txt, xx, y1 + 11, col, 'left', 9); ctx.font = '500 9px "JetBrains Mono", monospace'; lastX = xx + ctx.measureText(txt).width; }
      label(ctx, 'back at start', x1, y1 + 11, COL.mute, 'right', 9);
    }
    st.onframe && st.onframe(k);
  });
  // scrub by clicking strip
  st.c.addEventListener('pointerdown', (e) => { const r = st.c.getBoundingClientRect(); const T = tf(); const x = e.clientX - r.left; if (e.clientY - r.top > st.h - stripH()) { st.k = clamp((x - T.ox) / (WORLD.W * T.s), 0, 1) * MISSION.steps; } });
  return st;
}
