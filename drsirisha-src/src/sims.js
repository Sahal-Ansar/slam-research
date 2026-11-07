/* =====================================================================
   MECHANISM SIMULATIONS — schematic, for intuition (not measured data)
   ===================================================================== */

/* ---------- estimator structure: factor graphs, filters, maps ---------- */
function graphSim(parent, type = 'window', o = {}) {
  const st = makeCanvas(parent, 0.42, 260, 420);
  const N = o.window || 10;
  let kfs = [], lms = [], nextId = 0, timer = 0, flash = [], loopT = -10, merged = 0, mapPts = [];
  const r = rng(11);
  const addKF = () => {
    const id = nextId++;
    const prevY = kfs.length ? kfs[kfs.length - 1].y : 0;
    const kf = { id, born: st.t, marg: false, map: (type === 'atlas' && id >= 9 && id < 15 && !merged) ? 1 : 0, y: prevY + (r() - .35) * 4.5, robot: id % 3 };
    kfs.push(kf);
    const nl = type === 'msckf' ? 3 : 4;
    for (let i = 0; i < nl; i++) lms.push({ x: id + (r() - .5) * 2.5, y: -60 - r() * 70, kf: id, life: 2 + Math.floor(r() * 4), born: st.t, slam: type === 'msckf' && r() < .12 });
    if (type === 'window' || type === 'atlas') { const act = kfs.filter(k => !k.marg); if (act.length > N) { act[0].marg = true; flash.push({ t: st.t, id: act[0].id, kind: 'marg' }); } }
    if (type === 'msckf') { const act = kfs.filter(k => !k.marg); if (act.length > (o.clones || 11)) { act[0].marg = true; flash.push({ t: st.t, id: act[0].id, kind: 'drop' }); } }
    if ((type === 'window' && o.loop || type === 'isam' || type === 'atlas') && id > 0 && id % 22 === 0) { loopT = st.t; const to = id - 18; const k0 = kfs.find(k => k.id === to); const dy = kf.y - (k0 ? k0.y : 0); for (const k of kfs) { const wgt = k.id <= to ? 0 : (k.id - to) / (id - to); k.corr = dy * wgt; k.y0 = k.y; } flash.push({ t: st.t, id, kind: 'loop', to }); if (type === 'atlas') merged = 1; }
    if (kfs.length > 60) kfs.shift();
  };
  st.t = 0; for (let i = 0; i < 24; i++) addKF();
  for (const l of lms) l.born = -5;
  flash = [];
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    timer += dt; const per = type === 'pointwise' ? .7 : .75;
    if (timer > per) { timer = 0; addKF(); }
    const span = type === 'isam' ? 30 : 22;
    const last = nextId - 1 + timer / per;
    const X = (i) => w - 60 - (last - i) * (w - 120) / span;
    const baseY = h * .66;
    const ec = clamp((st.t - loopT - .3) / 1, 0, 1), ee = ec * ec * (3 - 2 * ec);
    for (const k of kfs) if (k.corr != null) { k.y = k.y0 - k.corr * ee; if (ec >= 1) { k.corr = null; } }
    const Y = (k) => baseY + (type === 'msckf' || (type === 'window' && !o.loop) ? 0 : k.y);
    // ---- per type ----
    if (type === 'ieskf' || type === 'pointwise') {
      // map grid (ikd-tree / voxels) and a single state
      const cell = 12, cols = Math.floor((w - 40) / cell), mapH = Math.floor(h * .34 / cell) * cell;
      ctx.fillStyle = COL.soft; ctx.fillRect(20, 30, cols * cell, mapH);
      while (mapPts.length < Math.min(400, nextId * 9)) mapPts.push({ c: Math.floor(r() * cols), rr: Math.floor(r() * (mapH / cell)), t: st.t });
      for (const p of mapPts) { const a = clamp((st.t - p.t) * 2, 0, 1); ctx.fillStyle = hexA(COL.lid, .25 + .45 * a); ctx.fillRect(20 + p.c * cell + 1, 30 + p.rr * cell + 1, cell - 2, cell - 2); }
      label(ctx, type === 'ieskf' ? 'MAP · incremental k-d tree / voxels (points inserted, never re-optimised)' : 'MAP · incremental voxels', 20, 22, COL.mute);
      // timeline of LiDAR points
      const ty = h - 50; ctx.strokeStyle = COL.hair; ctx.beginPath(); ctx.moveTo(20, ty); ctx.lineTo(w - 20, ty); ctx.stroke();
      const rate = type === 'pointwise' ? 1 : 10;
      const n = Math.floor((w - 40) / 6);
      for (let i = 0; i < n; i++) {
        const x = 20 + i * 6; const tt = st.t - (n - i) * .012;
        ctx.fillStyle = COL.lid; ctx.fillRect(x, ty - 8, 2, 8);
        const isUpd = type === 'pointwise' ? true : (Math.floor(tt * 100) % 10 === 0);
        if (isUpd) { ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x + 1, ty + 12, type === 'pointwise' ? 1.4 : 3.5, 0, TAU); ctx.fill(); }
      }
      label(ctx, 'LiDAR points arriving →', 20, ty - 14, COL.mute);
      label(ctx, type === 'pointwise' ? '● state update after EVERY point (no scan accumulation, no de-skew)' : '● state update once per scan (iterated EKF), then points inserted into map', 20, ty + 30, COL.ink);
      // state node
      const sx = 40, sy = Math.round((30 + mapH + h - 50) / 2) - 6;
      ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, TAU); ctx.fill();
      label(ctx, 'x̂', sx, sy + 4, '#fff', 'center', 12, 700);
      label(ctx, 'one state: pose, velocity, biases, gravity  (+ covariance P)', sx + 22, sy + 4, COL.mute);
      const it = Math.floor(st.t * (type === 'pointwise' ? 20 : 4)) % 4;
      ctx.strokeStyle = COL.lid; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 20 + it * 3, 0, TAU); ctx.stroke();
      return;
    }
    if (type === 'dba') {
      // frame graph with dense flow edges (DROID / DPVO)
      const act = kfs.slice(-12);
      act.forEach((k, i) => {
        for (let j = Math.max(0, i - 3); j < i; j++) { const k2 = act[j]; const wgt = 1 - (i - j) / 4; ctx.strokeStyle = hexA(COL.lrn, .15 + .5 * wgt); ctx.lineWidth = 1 + 3 * wgt; ctx.beginPath(); ctx.moveTo(X(k.id), baseY); ctx.quadraticCurveTo((X(k.id) + X(k2.id)) / 2, baseY - 30 - (i - j) * 18, X(k2.id), baseY); ctx.stroke(); }
      });
      act.forEach(k => { ctx.fillStyle = '#fff'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; rrect(ctx, X(k.id) - 12, baseY - 9, 24, 18, 4); ctx.fill(); ctx.stroke(); for (let i = 0; i < 6; i++) { ctx.fillStyle = hexA(COL.lrn, .6); ctx.fillRect(X(k.id) - 9 + (i % 3) * 7, baseY - 6 + Math.floor(i / 3) * 7, 4, 4); } });
      label(ctx, 'FRAME GRAPH · edges = dense optical flow (thicker = higher learned confidence)', 20, 22, COL.mute);
      label(ctx, `update ${1 + Math.floor(st.t * 6) % 8}/8 · ConvGRU refines flow → differentiable bundle adjustment solves poses + depth`, 20, h - 22, COL.ink);
      return;
    }
    if (type === 'distributed') {
      const robots = [COL.vis, COL.lid, COL.fus];
      const rows = [h * .28, h * .52, h * .76];
      kfs.slice(-36).forEach(k => { const ry = rows[k.robot]; ctx.fillStyle = robots[k.robot]; ctx.beginPath(); ctx.arc(X(k.id), ry, 4.5, 0, TAU); ctx.fill(); });
      rows.forEach((ry, i) => { ctx.strokeStyle = hexA(robots[i], .4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(40, ry); ctx.lineTo(w - 60, ry); ctx.stroke(); label(ctx, `UAV ${i + 1}`, 14, ry + 4, robots[i], 'left', 10, 700); });
      const ph = (st.t % 3) / 3;
      const ids = kfs.slice(-36).map(k => k.id);
      if (ids.length > 10) {
        const a = ids[ids.length - 8], b = ids[ids.length - 5];
        const ka = kfs.find(k => k.id === a), kb = kfs.find(k => k.id === b);
        if (ka && kb && ka.robot !== kb.robot) {
          ctx.strokeStyle = COL.swm; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(X(a), rows[ka.robot]); ctx.lineTo(X(b), rows[kb.robot]); ctx.stroke(); ctx.setLineDash([]);
          const mx = lerp(X(a), X(b), ph), my = lerp(rows[ka.robot], rows[kb.robot], ph); ctx.fillStyle = COL.swm; ctx.fillRect(mx - 4, my - 3, 8, 6);
        }
      }
      label(ctx, 'DISTRIBUTED POSE GRAPH · each UAV keeps its own graph; dashed = inter-robot loop closure (compact descriptor sent, then verified)', 20, 18, COL.mute);
      return;
    }
    // ---- keyframe graphs: window / msckf / isam / atlas ----
    const vis = kfs.filter(k => X(k.id) > -20);
    // landmarks + visual factors
    if (type !== 'isam') for (const l of lms) {
      if (X(l.x) < -20) continue;
      const kf = kfs.find(k => k.id === l.kf); if (!kf) continue;
      const age = (nextId - 1) - l.kf; const alive = age < l.life;
      if (type === 'msckf' && !alive && !l.slam) continue;
      const lx = X(l.x), ly = baseY + l.y;
      if (alive) { ctx.strokeStyle = hexA(COL.vis, .35); ctx.lineWidth = 1; ctx.beginPath(); for (let j = l.kf; j <= Math.min(nextId - 1, l.kf + l.life); j++) { const k = kfs.find(q => q.id === j); if (k) { ctx.moveTo(lx, ly); ctx.lineTo(X(j), Y(k)); } } ctx.stroke(); }
      ctx.fillStyle = l.slam ? COL.ink : alive ? COL.vis : '#c7c7cc'; ctx.fillRect(lx - 3, ly - 3, 6, 6);
    }
    // imu factors
    for (let i = 1; i < vis.length; i++) {
      const a = vis[i - 1], b = vis[i];
      ctx.strokeStyle = b.marg ? '#c7c7cc' : (type === 'atlas' && b.map ? COL.lrn : COL.ink); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(a.id), Y(a)); ctx.lineTo(X(b.id), Y(b)); ctx.stroke();
      if (o.imu !== false) for (let q = 1; q < 6; q++) { const xx = lerp(X(a.id), X(b.id), q / 6), yy = lerp(Y(a), Y(b), q / 6); ctx.strokeStyle = COL.accent; ctx.beginPath(); ctx.moveTo(xx, yy - 4); ctx.lineTo(xx, yy + 4); ctx.stroke(); }
    }
    // loop edges
    for (const f of flash) if (f.kind === 'loop') {
      const a = kfs.find(k => k.id === f.id), b = kfs.find(k => k.id === f.to); if (!a || !b) continue;
      ctx.strokeStyle = COL.fus; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(a.id), Y(a)); ctx.quadraticCurveTo((X(a.id) + X(b.id)) / 2, baseY + 70, X(b.id), Y(b)); ctx.stroke();
      if (st.t - f.t < 1.5) label(ctx, type === 'atlas' ? 'MAPS MERGED' : 'LOOP CLOSURE → pose-graph optimisation', (X(a.id) + X(b.id)) / 2, baseY + 62, COL.fus, 'center', 10, 700);
    }
    // keyframes
    for (const k of vis) {
      ctx.fillStyle = k.marg ? '#d1d1d6' : (type === 'atlas' && k.map ? COL.lrn : COL.ink);
      ctx.beginPath(); ctx.arc(X(k.id), Y(k), type === 'msckf' ? 5 : 6, 0, TAU); ctx.fill();
    }
    // window bracket / prior
    const act = vis.filter(k => !k.marg);
    if (act.length && (type === 'window' || type === 'msckf' || type === 'atlas')) {
      const x0 = X(act[0].id) - 12, x1 = X(act[act.length - 1].id) + 12;
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, baseY + 22); ctx.lineTo(x0, baseY + 28); ctx.lineTo(x1, baseY + 28); ctx.lineTo(x1, baseY + 22); ctx.stroke();
      label(ctx, type === 'msckf' ? `filter state: IMU + ${act.length} cloned poses` : type === 'atlas' ? 'local BA window (covisibility)' : `sliding window · ${act.length} keyframes optimised jointly`, (x0 + x1) / 2, baseY + 42, COL.ink, 'center');
      if (type !== 'msckf') { ctx.fillStyle = COL.ink; ctx.fillRect(x0 - 10, Y(act[0]) - 5, 10, 10); label(ctx, 'prior (marginalised)', x0 - 6, Y(act[0]) - 12, COL.mute, 'right'); }
    }
    for (const f of flash) if (f.kind === 'drop' && st.t - f.t < .6) label(ctx, 'feature track ended → EKF update, feature discarded (null-space)', w / 2, 22, COL.vis, 'center', 10, 700);
    flash = flash.filter(f => st.t - f.t < 30);
    const cap = { window: 'Squares = landmarks (blue while tracked). Ticks = IMU samples pre-integrated into one factor per keyframe pair.', msckf: 'Features are NOT kept in the state: once a track ends it constrains the cloned poses and is dropped. Black = optional SLAM features.', isam: 'iSAM2 keeps the full graph and re-linearises only what changes; a loop closure bends the whole trajectory.', atlas: 'Tracking lost → a new map (orange) starts; when a common place is recognised the maps are merged.' }[type];
    label(ctx, cap || '', 20, 20, COL.mute);
  });
  return st;
}

/* ---------- LiDAR scan patterns (spinning vs non-repetitive) ---------- */
function scanSim(parent) {
  const st = makeCanvas(parent, 0.36, 220, 340);
  const pats = [{ name: 'Spinning 16-beam (360°, fixed rings)', kind: 'spin' }, { name: 'Non-repetitive (Livox-style): coverage grows with time', kind: 'nr' }];
  let pts = [[], []]; const r = rng(4);
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const pw = (w - 60) / 2, ph = h - 70;
    const tInt = (st.t % 4);
    if (tInt < dt * 1.5) pts = [[], []];
    pats.forEach((p, i) => {
      const x0 = 20 + i * (pw + 20), y0 = 34;
      ctx.fillStyle = COL.soft; ctx.fillRect(x0, y0, pw, ph);
      label(ctx, p.name, x0, y0 - 10, COL.ink, 'left', 10.5, 600);
      const n = 260;
      for (let k = 0; k < n; k++) {
        if (p.kind === 'spin') { const ring = Math.floor(r() * 16); pts[i].push([r(), (ring + .5) / 16 * .6 + .2]); }
        else { const t = st.t * 3 + k * .013; const a = (Math.sin(t * 7.1) * .5 + .5 + r() * .02) % 1; const e = .5 + .48 * Math.sin(t * 2.3 + Math.sin(t * .7) * 2) * Math.cos(t * 1.3); pts[i].push([(a + st.t * .21 + k / n) % 1, clamp(e, .02, .98)]); }
      }
      if (pts[i].length > 12000) pts[i] = pts[i].slice(-12000);
      ctx.fillStyle = COL.lid;
      for (const q of pts[i]) ctx.fillRect(x0 + q[0] * pw, y0 + q[1] * ph, 1.2, 1.2);
      label(ctx, 'azimuth →', x0 + pw - 60, y0 + ph + 14, COL.mute); label(ctx, 'elevation ↓', x0, y0 + ph + 14, COL.mute);
    });
    label(ctx, `integration time ${tInt.toFixed(1)} s`, w - 20, h - 8, COL.ink, 'right', 10.5, 600);
  });
  return st;
}

/* ---------- radar-inertial: Doppler ego-velocity with RANSAC ---------- */
function radarSim(parent) {
  const st = makeCanvas(parent, 0.42, 280, 440);
  const r = rng(21);
  const fog = Array.from({ length: 140 }, () => ({ x: r(), y: r(), s: 2 + r() * 10, v: .01 + r() * .02 }));
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const half = w * .5;
    // ego velocity varies
    const vx = 1.6 + Math.sin(st.t * .5) * .8, vy = Math.cos(st.t * .37) * .9;
    const cx = half * .3, cy = h * .55, S = Math.min(half, h) * .028;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, half, h); ctx.clip();
    // fog
    for (const f of fog) { f.x = (f.x + f.v * dt) % 1; ctx.fillStyle = 'rgba(140,140,148,.08)'; ctx.beginPath(); ctx.arc(f.x * half, f.y * h, f.s * 3, 0, TAU); ctx.fill(); }
    label(ctx, 'DENSE FOG · camera & LiDAR blind', 14, 20, COL.mute);
    drone(ctx, cx, cy, Math.atan2(-vy, vx), 1.2);
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vx * 30, cy - vy * 30); ctx.stroke();
    label(ctx, 'v (true)', cx + vx * 30 + 6, cy - vy * 30, COL.ink);
    // targets
    const targets = []; const rr = rng(Math.floor(st.t * 4) + 3);
    for (let i = 0; i < 26; i++) {
      const az = -1.2 + rr() * 2.4, rng_ = 4 + rr() * 9;
      const kind = i < 3 ? 'moving' : i < 5 ? 'ghost' : 'static';
      let vd = -(vx * Math.cos(az) + vy * Math.sin(az)) + gauss(rr) * .06;
      if (kind === 'moving') vd += (rr() - .5) * 3; if (kind === 'ghost') vd *= -.6 + rr() * .4;
      targets.push({ az, rng: rng_, vd, kind });
    }
    // RANSAC fit (2 params) on (az, vd)
    let best = null, bestIn = -1; const rs = rng(Math.floor(st.t * 4));
    for (let it = 0; it < 40; it++) {
      const a = targets[Math.floor(rs() * targets.length)], b = targets[Math.floor(rs() * targets.length)]; if (a === b) continue;
      const det = Math.cos(a.az) * Math.sin(b.az) - Math.sin(a.az) * Math.cos(b.az); if (Math.abs(det) < .05) continue;
      const ex = (-a.vd * Math.sin(b.az) + b.vd * Math.sin(a.az)) / det, ey = (-b.vd * Math.cos(a.az) + a.vd * Math.cos(b.az)) / det;
      let n = 0; for (const t of targets) if (Math.abs(t.vd + ex * Math.cos(t.az) + ey * Math.sin(t.az)) < .25) n++;
      if (n > bestIn) { bestIn = n; best = [ex, ey]; }
    }
    for (const t of targets) {
      const inl = best && Math.abs(t.vd + best[0] * Math.cos(t.az) + best[1] * Math.sin(t.az)) < .25;
      const px = cx + Math.cos(t.az) * t.rng * S * 2, py = cy - Math.sin(t.az) * t.rng * S * 2;
      ctx.fillStyle = inl ? COL.spc : COL.bad; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(inl ? COL.spc : COL.bad, .6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(t.az) * t.vd * 8, py - Math.sin(t.az) * t.vd * 8); ctx.stroke();
    }
    ctx.restore();
    // plot
    const px0 = half + 40, px1 = w - 20, py0 = 40, py1 = h - 44, mid = (py0 + py1) / 2;
    ctx.strokeStyle = COL.hair; ctx.beginPath(); ctx.moveTo(px0, mid + 25); ctx.lineTo(px1, mid + 25); ctx.moveTo(px0, py0); ctx.lineTo(px0, py1); ctx.stroke();
    const AX = (az) => px0 + (az + 1.3) / 2.6 * (px1 - px0), AY = (v) => mid + 25 - v / 4.5 * (py1 - py0 - 50) / 2;
    if (best) { ctx.strokeStyle = COL.spc; ctx.lineWidth = 2; ctx.beginPath(); for (let az = -1.3; az <= 1.3; az += .05) { const v = -(best[0] * Math.cos(az) + best[1] * Math.sin(az)); az > -1.3 ? ctx.lineTo(AX(az), AY(v)) : ctx.moveTo(AX(az), AY(v)); } ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(px0, py0 + 50, px1 - px0, py1 - py0 - 50); ctx.clip();
    for (const t of targets) { const inl = best && Math.abs(t.vd + best[0] * Math.cos(t.az) + best[1] * Math.sin(t.az)) < .25; ctx.fillStyle = inl ? COL.spc : COL.bad; ctx.beginPath(); ctx.arc(AX(t.az), AY(t.vd), 3.2, 0, TAU); ctx.fill(); }
    ctx.restore();
    label(ctx, 'Doppler velocity of each return vs azimuth', px0, py0 - 14, COL.ink, 'left', 10.5, 600);
    label(ctx, 'v_r = −(vₓ cos θ + v_y sin θ)  · purple = static inliers, red = moving / multipath (rejected)', px0, py1 + 18, COL.mute);
    label(ctx, 'azimuth θ →', px1, mid + 19, COL.mute, 'right');
    if (best) hud(ctx, [`RANSAC ego-velocity  ${best[0].toFixed(2)}, ${best[1].toFixed(2)} m/s`, `true               ${vx.toFixed(2)}, ${vy.toFixed(2)} m/s`, `inliers ${bestIn}/${targets.length}  → fused with IMU in an EKF`], px0 + 8, py0 + 6, COL.ink);
  });
  return st;
}

/* ---------- event camera vs frame camera during a fast flip / HDR ---------- */
function eventSim(parent) {
  const st = makeCanvas(parent, 0.4, 260, 420);
  const r = rng(5); const shapes = Array.from({ length: 16 }, () => ({ x: r(), y: r(), w: .05 + r() * .12, h: .05 + r() * .14 }));
  let events = [];
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const pw = (w - 60) / 2, ph = h - 70, y0 = 36;
    const om = 6 * Math.sin(st.t * 1.4) ** 3; // angular rate
    const off = (t) => (Math.cos(st.t * 1.4) * .9 + t * om * .02);
    const hdr = (st.t % 8) > 4;
    // frame camera
    const x0 = 20;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, pw, ph);
    const blurN = Math.min(14, 1 + Math.abs(om) * 3);
    for (let b = 0; b < blurN; b++) {
      const o = off(b / blurN - .5) * pw * .4;
      ctx.fillStyle = `rgba(29,29,31,${1.2 / blurN})`;
      for (const s of shapes) ctx.fillRect(x0 + ((s.x * pw + o) % pw + pw) % pw, y0 + s.y * ph, s.w * pw, s.h * ph);
    }
    if (hdr) { const gr = ctx.createLinearGradient(x0 + pw * .55, 0, x0 + pw, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.25, 'rgba(255,255,255,.97)'); ctx.fillStyle = gr; ctx.fillRect(x0, y0, pw, ph); ctx.fillStyle = 'rgba(0,0,0,.85)'; ctx.fillRect(x0, y0, pw * .3, ph); }
    ctx.restore();
    label(ctx, `FRAME CAMERA · 30 fps · exposure blur${hdr ? ' · tunnel exit: saturated + crushed' : ''}`, x0, y0 - 10, COL.ink, 'left', 10.5, 600);
    // event camera
    const x1 = x0 + pw + 20;
    ctx.fillStyle = '#fafafa'; ctx.fillRect(x1, y0, pw, ph);
    const o = off(0) * pw * .4;
    const nEv = Math.min(1600, 120 + Math.abs(om) * 260);
    for (let i = 0; i < nEv; i++) {
      const s = shapes[Math.floor(r() * shapes.length)]; const edge = Math.floor(r() * 4);
      let ex = s.x * pw + o, ey = s.y * ph;
      if (edge === 0) { ey += r() * s.h * ph; } else if (edge === 1) { ex += s.w * pw; ey += r() * s.h * ph; } else if (edge === 2) { ex += r() * s.w * pw; } else { ex += r() * s.w * pw; ey += s.h * ph; }
      if (Math.abs(om) < .15 && r() > .08) continue; // static scene → few events
      events.push({ x: ((ex % pw) + pw) % pw, y: ey, p: (edge === 0) === (om > 0), t: st.t });
    }
    events = events.filter(e => st.t - e.t < .03);
    for (const e of events) { ctx.fillStyle = e.p ? COL.vis : COL.bad; ctx.fillRect(x1 + e.x, y0 + e.y, 1.6, 1.6); }
    label(ctx, 'EVENT CAMERA · per-pixel brightness changes, µs latency, >120 dB', x1, y0 - 10, COL.ink, 'left', 10.5, 600);
    hud(ctx, [`angular rate ${Math.abs(om).toFixed(1)} rad/s`, `events in last 30 ms: ${events.length}`, Math.abs(om) < .2 ? 'hovering: almost no events → needs frames/IMU' : 'edges stay sharp'], x1 + 8, y0 + 16, COL.ink);
  });
  return st;
}

/* ---------- thermal vs visible in smoke + FFC ---------- */
function thermalSim(parent) {
  const st = makeCanvas(parent, 0.4, 260, 420);
  const r = rng(9);
  const objs = Array.from({ length: 22 }, () => ({ x: r(), y: .25 + r() * .7, w: .03 + r() * .1, h: .04 + r() * .2, warm: r() < .45, temp: r() }));
  const puffs = Array.from({ length: 30 }, () => ({ x: r(), y: r(), s: .06 + r() * .14, v: .02 + r() * .05 }));
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const pw = (w - 60) / 2, ph = h - 70, y0 = 36;
    const pan = st.t * .04;
    const ffc = (st.t % 7) > 6.45;
    for (let v = 0; v < 2; v++) {
      const x0 = 20 + v * (pw + 20);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
      ctx.fillStyle = v ? '#1b1b22' : '#efeff2'; ctx.fillRect(x0, y0, pw, ph);
      let feats = 0;
      for (const o of objs) {
        const ox = x0 + (((o.x - pan) % 1 + 1) % 1) * pw, oy = y0 + o.y * ph;
        if (v === 0) { ctx.fillStyle = '#8e8e93'; ctx.fillRect(ox, oy, o.w * pw, o.h * ph); }
        else { const c = o.warm ? `hsl(${30 + o.temp * 25},95%,${50 + o.temp * 15}%)` : '#3a3a46'; ctx.fillStyle = c; ctx.fillRect(ox, oy, o.w * pw, o.h * ph); }
        // corners as features unless smoke (visible) / FFC (thermal)
        let covered = false;
        for (const p of puffs) { const px = x0 + p.x * pw, py = y0 + p.y * ph; if (Math.hypot(ox - px, oy - py) < p.s * pw * .9) covered = true; }
        const ok = v === 0 ? !covered : (!ffc && o.warm);
        if (ok) { feats++; ctx.strokeStyle = v ? '#fff' : COL.vis; ctx.lineWidth = 1.4; ctx.strokeRect(ox - 3, oy - 3, 6, 6); }
      }
      if (v === 0) for (const p of puffs) { p.x = (p.x + p.v * dt * .4) % 1.2; const gr = ctx.createRadialGradient(x0 + p.x * pw, y0 + p.y * ph, 0, x0 + p.x * pw, y0 + p.y * ph, p.s * pw); gr.addColorStop(0, 'rgba(160,160,166,.92)'); gr.addColorStop(1, 'rgba(160,160,166,0)'); ctx.fillStyle = gr; ctx.fillRect(x0, y0, pw, ph); }
      if (v === 1 && ffc) { ctx.fillStyle = 'rgba(40,40,48,.96)'; ctx.fillRect(x0, y0, pw, ph); label(ctx, 'FLAT-FIELD CORRECTION · shutter closed, image frozen', x0 + pw / 2, y0 + ph / 2, '#fff', 'center', 11, 700); }
      ctx.restore();
      label(ctx, v ? 'THERMAL (LWIR) · sees heat through smoke' : 'VISIBLE CAMERA · smoke hides texture', x0, y0 - 10, COL.ink, 'left', 10.5, 600);
      label(ctx, `tracked features ${feats}`, x0, y0 + ph + 16, v ? COL.spc : COL.vis, 'left', 10.5, 700);
    }
  });
  return st;
}

/* ---------- learned dense flow (DROID / DPVO style) ---------- */
function flowSim(parent, mode = 'dense') {
  const st = makeCanvas(parent, 0.42, 260, 420);
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const iter = 1 + Math.floor(st.t * 3) % 8; const conv = 1 - Math.pow(.55, iter);
    const tx = Math.sin(st.t * .4) * .6, rz = Math.cos(st.t * .3) * .4;
    const step = mode === 'patch' ? 46 : 22;
    const pw = w - 40, ph = h - 70;
    ctx.fillStyle = COL.soft; ctx.fillRect(20, 34, pw, ph);
    const r = rng(3);
    for (let y = 34 + step / 2; y < 34 + ph; y += step) for (let x = 20 + step / 2; x < 20 + pw; x += step) {
      const nx = (x - w / 2) / pw, ny = (y - h / 2) / ph; const depth = .6 + .4 * Math.sin(nx * 5) * Math.cos(ny * 4);
      let fx = (tx / depth - rz * ny) * 26, fy = (rz * nx) * 26;
      const noise = (1 - conv) * 14; fx += (r() - .5) * noise; fy += (r() - .5) * noise;
      const conf = clamp(1 - Math.abs(Math.sin(nx * 9 + ny * 7)) * .9 + (r() - .5) * .1, .05, 1);
      ctx.strokeStyle = hexA(COL.lrn, .2 + .8 * conf); ctx.lineWidth = .8 + conf * 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + fx, y + fy); ctx.stroke();
      if (mode === 'patch') { ctx.strokeStyle = hexA(COL.ink, .5); ctx.lineWidth = 1; ctx.strokeRect(x - 6, y - 6, 12, 12); }
      ctx.fillStyle = COL.lrn; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    label(ctx, mode === 'patch' ? 'DEEP PATCH VO · flow predicted only for sparse patches (cheaper than dense)' : 'DENSE OPTICAL FLOW between keyframes · line weight = learned confidence', 20, 22, COL.ink, 'left', 10.5, 600);
    hud(ctx, [`GRU update ${iter}/8`, `residual ${(1 - conv).toFixed(2)}`, 'then: dense bundle adjustment (poses + inverse depth)'], 28, 52, COL.ink);
  });
  return st;
}

/* ---------- Gaussian splatting map growth ---------- */
function gaussSim(parent) {
  const st = makeCanvas(parent, 0.38, 240, 380);
  let G = []; const r = rng(17);
  const target = (x, y) => { const v = .5 + .3 * Math.sin(x * 9) * Math.cos(y * 7) + (y > .65 ? .2 : 0) - (Math.hypot(x - .3, y - .4) < .15 ? .4 : 0); return clamp(v, 0, 1); };
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    if (G.length < 900 && r() < .9) for (let i = 0; i < 6; i++) { const x = r(), y = r(); G.push({ x, y, s: .02 + r() * .06 * Math.max(.2, 1 - G.length / 900), v: target(x, y), a: r() * Math.PI }); }
    if (G.length >= 900 && (st.t % 6) < dt) G = [];
    const pw = (w - 60) / 2, ph = h - 60, y0 = 34;
    // target image
    for (let i = 0; i < 40; i++) for (let j = 0; j < 30; j++) { const v = target(i / 40, j / 30); ctx.fillStyle = `rgb(${(1 - v) * 230 | 0},${(1 - v) * 230 | 0},${(1 - v) * 236 | 0})`; ctx.fillRect(20 + i * pw / 40, y0 + j * ph / 30, pw / 40 + .5, ph / 30 + .5); }
    label(ctx, 'camera image', 20, y0 - 10, COL.ink, 'left', 10.5, 600);
    const x1 = 40 + pw; ctx.save(); ctx.beginPath(); ctx.rect(x1, y0, pw, ph); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x1, y0, pw, ph);
    for (const g of G) { ctx.save(); ctx.translate(x1 + g.x * pw, y0 + g.y * ph); ctx.rotate(g.a); ctx.fillStyle = `rgba(${(1 - g.v) * 230 | 0},${(1 - g.v) * 230 | 0},${(1 - g.v) * 236 | 0},.55)`; ctx.beginPath(); ctx.ellipse(0, 0, g.s * pw, g.s * pw * .45, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
    label(ctx, `map rendered from ${G.length} Gaussians`, x1, y0 - 10, COL.ink, 'left', 10.5, 600);
    hud(ctx, [`render → compare → back-propagate → densify / prune`, `GPU memory grows with Gaussian count`], x1 + 8, y0 + ph - 20, COL.ink);
  });
  return st;
}

/* ---------- multi-drone map merge ---------- */
function swarmSim(parent) {
  const st = makeCanvas(parent, 0.46, 280, 460);
  const cols = [COL.vis, COL.lid, COL.fus];
  const r = rng(2);
  const paths = [
    [[3, 3], [10, 3], [10, 9], [16, 9], [16, 14]],
    [[30, 3], [22, 3], [22, 9], [16, 9], [16, 4]],
    [[16, 18], [10, 18], [10, 13], [16, 13], [22, 13], [22, 18]]
  ];
  const segsOf = (P) => { const c = [0]; for (let i = 1; i < P.length; i++) c.push(c[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return c; };
  const at = (P, s) => { const c = segsOf(P); s = clamp(s, 0, c[c.length - 1]); for (let i = 1; i < P.length; i++) if (s <= c[i]) { const t = (s - c[i - 1]) / (c[i] - c[i - 1]); return [lerp(P[i - 1][0], P[i][0], t), lerp(P[i - 1][1], P[i][1], t)]; } return P[P.length - 1]; };
  const drift = [[0, 0, 0], [1.6, -1.1, .12], [-1.2, 1.4, -.1]];
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const T = st.t % 16; const s = Math.min(T, 11) * 2.1;
    const mergeT = clamp((T - 11.5) / 1.5, 0, 1); const e = mergeT * mergeT * (3 - 2 * mergeT);
    const S = Math.min((w - 40) / 32, (h - 70) / 21), ox = (w - 32 * S) / 2, oy = 40;
    const X = (x) => ox + x * S, Y = (y) => oy + (21 - y) * S;
    ctx.strokeStyle = COL.hair; ctx.lineWidth = 1; ctx.strokeRect(X(0), Y(21), 32 * S, 21 * S);
    paths.forEach((P, i) => {
      const [dx, dy, da] = drift[i].map(v => v * (1 - e));
      const tf = (p) => { const c = Math.cos(da), sn = Math.sin(da); const x = p[0] - 16, y = p[1] - 10; return [16 + x * c - y * sn + dx, 10 + x * sn + y * c + dy]; };
      // local map points along path (walls either side)
      ctx.fillStyle = hexA(cols[i], .55);
      const rr = rng(i + 5);
      for (let q = 0; q < s; q += .25) { const p = at(P, q); for (const side of [-1.3, 1.3]) { const pp = tf([p[0] + (rr() - .5) * .4 + side * (i === 2 ? 0 : .0), p[1] + side + (rr() - .5) * .3]); ctx.fillRect(X(pp[0]) - 1, Y(pp[1]) - 1, 2, 2); } }
      ctx.strokeStyle = cols[i]; ctx.lineWidth = 2; ctx.beginPath(); for (let q = 0; q <= s; q += .3) { const p = tf(at(P, q)); q ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); } ctx.stroke();
      const p = tf(at(P, s)); drone(ctx, X(p[0]), Y(p[1]), 0, .8, cols[i]);
      label(ctx, `UAV ${i + 1}${i ? ' (own frame)' : ' (reference)'}`, X(tf(P[0])[0]), Y(tf(P[0])[1]) + 16, cols[i], 'left', 10, 700);
    });
    if (T > 10.5 && T < 13.5) label(ctx, 'INTER-ROBOT LOOP CLOSURES at shared corridor → frames aligned, maps merged', w / 2, 24, COL.swm, 'center', 11, 700);
    else label(ctx, T < 11 ? 'Each UAV maps with its own drift and its own coordinate frame' : 'One consistent map; each UAV now knows where the others are', w / 2, 24, COL.mute, 'center', 10.5);
    const bytes = Math.round(s * 1.8);
    hud(ctx, [`exchanged so far: ~${bytes} kB of compact descriptors (schematic)`], 20, h - 12, COL.ink);
  });
  return st;
}

/* ---------- UWB anchors ---------- */
function uwbSim(parent) {
  const st = makeCanvas(parent, 0.42, 260, 420);
  const anchors = [[2, 2], [26, 2], [26, 16], [2, 16]];
  const wall = [14, 0, 14, 10];
  animate(st, (st, dt) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const S = Math.min((w - 40) / 28, (h - 84) / 18), ox = (w - 28 * S) / 2, oy = 14;
    const X = (x) => ox + x * S, Y = (y) => oy + (18 - y) * S;
    const p = [14 + Math.cos(st.t * .5) * 9, 9 + Math.sin(st.t * .7) * 5];
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(wall[0]), Y(wall[1])); ctx.lineTo(X(wall[2]), Y(wall[3])); ctx.stroke();
    label(ctx, 'concrete / metal wall', X(14) + 6, Y(1), COL.mute);
    const ranges = anchors.map(a => { let d = Math.hypot(p[0] - a[0], p[1] - a[1]); const nlos = segCross(p[0], p[1], a[0], a[1], { x1: wall[0], y1: wall[1], x2: wall[2], y2: wall[3] }); if (nlos) d += 1.6; return { a, d, nlos }; });
    // least squares multilateration (Gauss-Newton few iters)
    let e = [14, 9];
    for (let it = 0; it < 8; it++) { let A = [0, 0, 0], b = [0, 0]; for (const rg of ranges) { const dx = e[0] - rg.a[0], dy = e[1] - rg.a[1]; const dd = Math.hypot(dx, dy) || 1; const J = [dx / dd, dy / dd]; const res = rg.d - dd; A[0] += J[0] * J[0]; A[1] += J[0] * J[1]; A[2] += J[1] * J[1]; b[0] += J[0] * res; b[1] += J[1] * res; } const det = A[0] * A[2] - A[1] * A[1]; e = [e[0] + (A[2] * b[0] - A[1] * b[1]) / det, e[1] + (A[0] * b[1] - A[1] * b[0]) / det]; }
    for (const rg of ranges) { ctx.strokeStyle = hexA(rg.nlos ? COL.bad : COL.swm, .55); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(X(rg.a[0]), Y(rg.a[1]), rg.d * S, 0, TAU); ctx.stroke(); ctx.fillStyle = COL.swm; ctx.fillRect(X(rg.a[0]) - 5, Y(rg.a[1]) - 5, 10, 10); label(ctx, rg.nlos ? 'NLOS +1.6 m' : 'LOS', X(rg.a[0]) + 8, Y(rg.a[1]) - 8, rg.nlos ? COL.bad : COL.swm, 'left', 10, 700); }
    drone(ctx, X(p[0]), Y(p[1]), 0, 1);
    ctx.strokeStyle = COL.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(e[0]), Y(e[1]), 6, 0, TAU); ctx.stroke();
    hud(ctx, [`UWB-only fix error ${Math.hypot(e[0] - p[0], e[1] - p[1]).toFixed(2)} m`, 'fused with VIO/LIO in the factor graph, ranges', 'bound long-term drift; NLOS needs robust loss'], 14, h - 46, COL.ink);
  });
  return st;
}

/* ---------- small static environment thumbnails ---------- */
function envThumb(parent, kind) {
  const st = makeCanvas(parent, 0.34, 110, 130);
  const r = rng(kind.length * 7);
  animate(st, (st) => {
    const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
    const t = st.t;
    ctx.lineWidth = 1.6; ctx.strokeStyle = COL.ink;
    if (kind === 'indoor') { ctx.strokeRect(10, 10, w - 20, h - 20); ctx.beginPath(); ctx.moveTo(w * .4, 10); ctx.lineTo(w * .4, h * .6); ctx.moveTo(w * .7, h - 10); ctx.lineTo(w * .7, h * .4); ctx.stroke(); }
    if (kind === 'tunnel') { ctx.beginPath(); ctx.moveTo(10, h * .3); ctx.lineTo(w - 10, h * .3); ctx.moveTo(10, h * .7); ctx.lineTo(w - 10, h * .7); ctx.stroke(); ctx.fillStyle = 'rgba(29,29,31,.12)'; ctx.fillRect(10, h * .3, w - 20, h * .4); }
    if (kind === 'forest') { const rr = rng(4); for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(10 + rr() * (w - 20), 10 + rr() * (h - 20), 3 + rr() * 5, 0, TAU); ctx.stroke(); } }
    if (kind === 'warehouse') { for (let i = 0; i < 4; i++) { ctx.strokeRect(14 + i * (w - 28) / 4, 14, (w - 28) / 4 - 14, h - 28); for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(14 + i * (w - 28) / 4, 14 + j * (h - 28) / 5); ctx.lineTo(14 + (i + 1) * (w - 28) / 4 - 14, 14 + j * (h - 28) / 5); ctx.stroke(); } } }
    if (kind === 'bridge') { ctx.beginPath(); ctx.moveTo(10, 24); ctx.lineTo(w - 10, 24); ctx.stroke(); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(20 + i * (w - 40) / 5, 24); ctx.lineTo(20 + i * (w - 40) / 5, h - 10); ctx.stroke(); } ctx.fillStyle = 'rgba(29,29,31,.1)'; ctx.fillRect(10, 24, w - 20, h * .35); }
    if (kind === 'urban') { const rr = rng(8); for (let i = 0; i < 6; i++) { const bw = 20 + rr() * 30, bh = 20 + rr() * (h - 40); ctx.strokeRect(10 + i * (w - 20) / 6, h - 10 - bh, bw * .7, bh); } }
    if (kind === 'fire') { ctx.strokeRect(10, 10, w - 20, h - 20); for (let i = 0; i < 6; i++) { const gr = ctx.createRadialGradient(w * (.3 + .1 * i) + Math.sin(t + i) * 8, h * .5, 0, w * (.3 + .1 * i), h * .5, 30); gr.addColorStop(0, 'rgba(110,110,115,.35)'); gr.addColorStop(1, 'rgba(110,110,115,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); } }
    // drone
    const px = w * .5 + Math.sin(t * .8) * w * .3, py = h * .5 + Math.cos(t * 1.1) * h * .18;
    drone(ctx, px, py, Math.cos(t * .8), .75, COL.vis);
  });
  return st;
}
