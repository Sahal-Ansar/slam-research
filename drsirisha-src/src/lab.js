/* =====================================================================
   3D LAB — six step-by-step lessons. Each scene runs the real maths at
   small scale (least squares, eigen-decompositions, pose-graph GN);
   sizes and noise levels are illustrative and labelled as such.
   ===================================================================== */
const G0 = 9.81;
/* ---------- lesson scaffold ---------- */
function lessonCard(o) {
  const S = { step: 0, ...(o.state || {}) };
  const stage = h('div', { class: 'stage' });
  const ro = h('div', { class: 'lro' });
  const stepsEl = h('div', { class: 'lsteps' });
  const ctl = h('div', { class: 'lctl' });
  const n = o.steps.length;
  const counter = h('span', { class: 'mono mute', style: 'font-size:11.5px' });
  const prevB = h('button', { class: 'btn btn-sm btn-tonal', onclick: () => set(S.step - 1) }, '← Back');
  const nextB = h('button', { class: 'btn btn-sm btn-primary', onclick: () => set(S.step + 1) }, 'Next step →');
  const items = o.steps.map((s, i) => { const el = h('div', { class: 'lstep' }, h('button', { class: 'lst-h', onclick: () => set(i) }, h('span', { class: 'n' }, String(i + 1)), h('span', {}, s.t)), h('div', { class: 'lst-b', html: s.p })); stepsEl.append(el); return el; });
  const ctls = [];
  S.add = (el, steps) => { el.dataset.steps = steps ? steps.join(',') : ''; ctls.push(el); ctl.append(el); return el; };
  function set(i) {
    i = clamp(i, 0, n - 1); S.step = i; S.stepT = 0;
    items.forEach((el, j) => el.classList.toggle('on', j === i));
    counter.textContent = `step ${i + 1} of ${n}`; prevB.disabled = i === 0; nextB.disabled = i === n - 1;
    for (const c of ctls) { const ss = c.dataset.steps; c.style.display = !ss || ss.split(',').includes(String(i)) ? '' : 'none'; }
    o.onStep && o.onStep(S, i); S._rot = 0;
  }
  S.set = set;
  S.ro = (rows, force) => {
    const t = performance.now(); if (!force && t - (S._rot || 0) < 140) return; S._rot = t;
    const html = rows.map(r => typeof r === 'string' ? r : `<div class="r${(String(r[0]).length + String(r[1]).length) > 44 ? ' w' : ''}"><span>${r[0]}</span><b${r[2] ? ` style="color:${r[2]}"` : ''}>${r[1]}</b></div>`).join('');
    if (html !== S._ro) { ro.innerHTML = html; S._ro = html; }
  };
  const card = h('article', { class: 'lesson', id: 'lab-' + o.id },
    h('div', { class: 'lhead' }, h('span', { class: 'lnum' }, o.num), h('div', {}, h('h3', {}, o.title), h('p', { html: o.q }))),
    h('div', { class: 'lgrid' },
      h('div', { class: 'lleft' }, h('div', { class: 'simbox' }, stage, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, o.cap), h('span', { class: 'live' }, h('i'), '3D · live'))), ro),
      h('div', { class: 'lright' }, stepsEl, ctl, h('div', { class: 'lnav' }, prevB, counter, nextB))));
  requestAnimationFrame(() => { o.build(stage, S); set(o.start || 0); });
  return card;
}
function ctlSlider(label, min, max, step, val, fmt, on) {
  const out = h('b', {}, fmt(val));
  const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label, oninput: (e) => { const v = +e.target.value; out.textContent = fmt(v); on(v); } });
  return h('label', { class: 'ctl' }, h('span', {}, label), inp, out);
}
function ctlSeg(label, opts, val, on) {
  const bs = opts.map(([k, t]) => h('button', { class: 'btn btn-sm btn-tonal' + (k === val ? ' on' : ''), onclick: (e) => { bs.forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); on(k); } }, t));
  return h('div', { class: 'ctl seg' }, label ? h('span', {}, label) : null, h('div', { class: 'segs' }, ...bs));
}
function ctlToggle(label, val, on) {
  const cb = h('input', { type: 'checkbox', onchange: (e) => on(e.target.checked) }); cb.checked = val;
  return h('label', { class: 'ctl tog' }, cb, h('span', {}, label));
}
function ctlBtns(...bs) { return h('div', { class: 'ctl btns' }, ...bs.map(([t, fn, cls]) => h('button', { class: 'btn btn-sm ' + (cls || 'btn-tonal'), onclick: fn }, t))); }
const fmtm = (v) => v < .01 ? (v * 1000).toFixed(1) + ' mm' : v < 1 ? (v * 100).toFixed(1) + ' cm' : v.toFixed(2) + ' m';
const LMCOLS = [COL.vis, COL.lid, COL.fus, COL.spc, COL.lrn, COL.swm];

/* =====================================================================
   L1 · IMU: the state, what an IMU senses, and why integrating it drifts
   ===================================================================== */
const IMU_GRADES = [
  { k: 0, name: 'Consumer MEMS', ba: .05, bg: rad(.05), th0: rad(.5) },
  { k: 1, name: 'Industrial MEMS', ba: .01, bg: rad(.005), th0: rad(.1) },
  { k: 2, name: 'Tactical grade', ba: .001, bg: rad(.0003), th0: rad(.02) },
];
function quadTraj(t) {
  const p = [3 * Math.sin(.5 * t), 1.7 * Math.sin(1.0 * t), 1.6 + .3 * Math.sin(.4 * t)];
  const v = [1.5 * Math.cos(.5 * t), 1.7 * Math.cos(1.0 * t), .12 * Math.cos(.4 * t)];
  const a = [-.75 * Math.sin(.5 * t), -1.7 * Math.sin(1.0 * t), -.048 * Math.sin(.4 * t)];
  const psi = Math.atan2(v[1], v[0]);
  const zb = v3.u(v3.a(a, [0, 0, G0])), xc = [Math.cos(psi), Math.sin(psi), 0];
  const yb = v3.u(v3.x(zb, xc)), xb = v3.x(yb, zb);
  // yaw rate (numerical)
  const v2 = [1.5 * Math.cos(.5 * (t + .01)), 1.7 * Math.cos(1.0 * (t + .01))]; let dpsi = Math.atan2(v2[1], v2[0]) - psi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
  return { p, v, a, R: m3.cols(xb, yb, zb), psi, wz: dpsi / .01 };
}
function labIMU() {
  return lessonCard({
    id: 'imu', num: 'L1', title: 'The state, the IMU, and why dead reckoning dies',
    q: 'Every SLAM system on a drone is built around an IMU. What does it actually measure, and why can it not fly the drone alone for more than a few seconds?',
    cap: 'quadrotor kinematics · Monte-Carlo IMU integration · illustrative sensor grades',
    state: { grade: 0, T: 0 },
    steps: [
      { t: 'Six numbers per instant', p: 'The drone\'s <b>pose</b> is 3 numbers for position (x, y, z) and 3 for orientation (roll, pitch, yaw). The estimator also tracks <b>velocity</b> and the IMU\'s <b>biases</b>, so a typical VIO/LIO state has 15+ numbers. Coloured arrows on the drone are its body axes: <span style="color:#d93025">x forward</span>, <span style="color:#188038">y left</span>, <span style="color:#1a73e8">z up</span>. To accelerate, a quadrotor must <em>tilt</em>: watch roll and pitch change as it turns.' },
      { t: 'What the IMU senses', p: 'The accelerometer does <b>not</b> measure acceleration. It measures <b>specific force</b> f = a − g: when hovering it reads +9.81 m/s² straight up (blue arrow, along the thrust). The gyroscope measures angular rate ω. To get position, the estimator must (1) integrate ω to get orientation, (2) rotate f into the world, (3) add gravity back, (4) integrate twice. Every error in step 1 contaminates steps 3–4.' },
      { t: 'Integrate noise twice', p: 'Each faint trace is the same flight, dead-reckoned with an IMU whose bias was drawn at random for that grade (36 runs). The ellipsoid is their 1σ spread. An accelerometer bias b gives ½·b·t² of error; a gyro bias tilts the believed gravity and gives a <b>t³</b> term. Switch grades: a tactical IMU costs thousands of dollars and still only buys tens of seconds.' },
      { t: 'Tilt error leaks gravity', p: 'The dominant term on small drones: if the believed roll is off by θ, the estimator subtracts gravity in the wrong direction and is left with a phantom horizontal acceleration g·sin θ (red arrow, exaggerated). With θ = 0.5°, that is 0.086 m/s², or 4.3 m after 10 s. This is why every method here pairs the IMU with a camera, LiDAR, radar or thermal sensor that measures position-related quantities.' },
      { t: 'What can and cannot be observed', p: 'Gravity is a fixed reference direction, so <b>roll and pitch are observable</b> from the IMU over time. Shifting the whole trajectory, or rotating it about the vertical (ghosts), changes no sensor reading — <b>x, y, z and yaw are unobservable</b> in VIO/LIO and drift without bound. That is why VINS-Mono/Fusion run their loop closure as a <b>4-DoF</b> pose graph, and why a drone needs loop closure or external anchors (UWB, known map) for long flights. The red ghost (tilted) is <em>not</em> equivalent: gravity would point a different way.' },
    ],
    onStep: (S, i) => { if (i === 2 || i === 3) S.T = 0; },
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.3, pitch: .5, dist: 11, target: [0, 0, 1.2], minDist: 3, maxDist: 160 });
      S.add(ctlSeg('IMU grade (illustrative σ)', IMU_GRADES.map(g => [g.k, g.name]), 0, (k) => { S.grade = k; S.T = 0; mkRuns(); }), [2, 3]);
      S.add(ctlBtns(['↺ Restart integration', () => { S.T = 0; }]), [2, 3]);
      let runs = [];
      const mkRuns = () => { const r = rng(17 + S.grade), g = IMU_GRADES[S.grade]; runs = Array.from({ length: 36 }, () => ({ ba: [gauss(r) * g.ba, gauss(r) * g.ba, gauss(r) * g.ba], bg: [gauss(r) * g.bg, gauss(r) * g.bg], th: [gauss(r) * g.th0, gauss(r) * g.th0] })); };
      mkRuns();
      const err = (R, t) => [.5 * R.ba[0] * t * t + G0 * (R.th[1] * t * t / 2 + R.bg[1] * t ** 3 / 6), .5 * R.ba[1] * t * t - G0 * (R.th[0] * t * t / 2 + R.bg[0] * t ** 3 / 6), .5 * R.ba[2] * t * t];
      const TMAX = 20;
      animate(st, (st, dt) => {
        const step = S.step; const mc = step === 2 || step === 3;
        if (mc) { S.T += dt; if (S.T > TMAX + 2) S.T = 0; }
        const tt = mc ? Math.min(S.T, TMAX) : st.t; const Q = quadTraj(mc ? tt : st.t);
        // auto-zoom to the spread
        st.begin(dt);
        st.grid(-6, 6, -4, 4, 1, 0, '#ececf0');
        // full reference path
        const ref = []; for (let s = 0; s <= 12.6; s += .2) ref.push(quadTraj(s).p); st.path(ref, '#b8b8bf', 1, { dash: [3, 4] });
        const g = IMU_GRADES[S.grade];
        if (step === 0) {
          st.drone(Q.p, Q.R, COL.ink, 2); st.axes(Q.p, Q.R, .9, { names: ['x', 'y', 'z'] });
          st.line(Q.p, [Q.p[0], Q.p[1], 0], COL.ink, .8, { dash: [2, 3], alpha: .5 });
          st.axes([-5.5, -3.5, 0], m3.I(), 1, { names: ['E', 'N', 'Up'] }); st.text([-5.5, -3.5, 0], 'world', COL.mute, { dx: -8, dy: 12, size: 9.5 });
          const e = rpyOf(Q.R);
          S.ro([['x', Q.p[0].toFixed(2) + ' m'], ['y', Q.p[1].toFixed(2) + ' m'], ['z', Q.p[2].toFixed(2) + ' m'], ['roll', deg(e.roll).toFixed(1) + '°', '#d93025'], ['pitch', deg(e.pitch).toFixed(1) + '°', '#188038'], ['yaw', deg(e.yaw).toFixed(1) + '°', '#1a73e8'], ['speed', v3.n(Q.v).toFixed(2) + ' m/s']]);
        }
        if (step === 1) {
          st.drone(Q.p, Q.R, COL.ink, 2);
          const f = v3.a(Q.a, [0, 0, G0]); st.arrow(Q.p, v3.a(Q.p, v3.k(f, .13)), COL.vis, 2.6); st.text(v3.a(Q.p, v3.k(f, .13)), 'accelerometer: f = a − g', COL.vis, { dx: 8, size: 10, bg: 'rgba(255,255,255,.85)' });
          st.arrow(Q.p, v3.a(Q.p, [0, 0, -1.2]), '#8e8e93', 2); st.text(v3.a(Q.p, [0, 0, -1.2]), 'gravity g', '#6e6e73', { dx: 8, size: 10 });
          st.arrow(Q.p, v3.a(Q.p, v3.k(Q.a, .5)), COL.lrn, 2); st.text(v3.a(Q.p, v3.k(Q.a, .5)), 'true acceleration a', COL.lrn, { dx: 8, dy: 10, size: 10, bg: 'rgba(255,255,255,.85)' });
          const wr = Q.wz; st.ring(Q.p, Q.R, .75, COL.spc, 2, { a0: 0, a1: clamp(wr, -2, 2) * 1.2, n: 18 }); st.text(v3.a(Q.p, m3.v(Q.R, [.6, .6, 0])), 'gyro ω', COL.spc, { size: 10 });
          const fb = m3.v(m3.T(Q.R), f);
          S.ro([['|f| (body)', v3.n(f).toFixed(2) + ' m/s²'], ['f in body x,y,z', fb.map(v => v.toFixed(2)).join(', ')], ['|a| true', v3.n(Q.a).toFixed(2) + ' m/s²'], ['yaw rate ω_z', deg(wr).toFixed(1) + ' °/s', COL.spc], ['note', 'f ≈ (0, 0, |f|): a quad\'s thrust is along body z']]);
        }
        if (mc) {
          // traces
          const es = runs.map(R => err(R, tt));
          runs.forEach((R, i) => {
            const pts = []; for (let s = 0; s <= tt + 1e-6; s += .5) { const e = err(R, s); pts.push(v3.a(quadTraj(s).p, e)); }
            const e = es[i]; pts.push(v3.a(Q.p, e));
            const hl = step === 3 && i === 0;
            st.path(pts, hl ? COL.lid : COL.vis, hl ? 2.2 : .9, { alpha: hl ? 1 : .35 });
            st.dot(v3.a(Q.p, e), hl ? 3.5 : 2, hl ? COL.lid : COL.vis, { alpha: hl ? 1 : .7 });
          });
          // sample covariance
          const mu = [0, 0, 0]; es.forEach(e => { mu[0] += e[0] / es.length; mu[1] += e[1] / es.length; mu[2] += e[2] / es.length; });
          const C = zeros(3, 3); es.forEach(e => { const d = v3.s(e, mu); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j] / (es.length - 1); });
          for (let i = 0; i < 3; i++) C[i][i] += 1e-6;
          st.ellipsoid(v3.a(Q.p, mu), C, COL.vis, { k: 1, fill: .1 });
          st.drone(Q.p, Q.R, COL.ink, 1.8);
          if (step === 3) {
            const e0 = es[0], P0 = v3.a(Q.p, e0), th = runs[0].th[0] + runs[0].bg[0] * tt;
            const ex = 40; const gb = [0, Math.sin(th * ex) * 1.4, -Math.cos(th * ex) * 1.4];
            st.arrow(P0, v3.a(P0, [0, 0, -1.4]), '#8e8e93', 2); st.arrow(P0, v3.a(P0, gb), COL.lid, 2, { dash: [3, 2] });
            st.arrow(v3.a(P0, [0, 0, -1.4]), v3.a(P0, gb), COL.lid, 2.4);
            st.text(v3.a(P0, gb), 'believed gravity (tilt ×40)', COL.lid, { dx: 8, size: 9.5, bg: 'rgba(255,255,255,.85)' });
          }
          const sd = Math.sqrt(C[0][0] + C[1][1]);
          if (performance.now() - st.lastUser > 3000) { const want = clamp(9 + sd * 2.4, 9, 140); st.cam.dist += (want - st.cam.dist) * (1 - Math.exp(-dt * 1.5)); }
          const tA = .5 * g.ba * tt * tt, tTh = G0 * g.th0 * tt * tt / 2, tG = G0 * g.bg * tt ** 3 / 6;
          const rows = [['time integrated', tt.toFixed(1) + ' s'], ['1σ horizontal spread', fmtm(sd), COL.vis], ['… from accel bias  ½·b·t²', fmtm(tA)], ['… from initial tilt  ½·g·θ·t²', fmtm(tTh)], ['… from gyro bias  g·b_g·t³/6', fmtm(tG)], ['grade σ', `b_a ${g.ba} m/s² · b_g ${deg(g.bg).toFixed(4)} °/s · θ₀ ${deg(g.th0)}°`]];
          if (step === 3) { const al = G0 * Math.sin(g.th0); rows.push(['leak g·sin θ₀', al.toFixed(3) + ' m/s²', COL.lid], ['→ error after 10 s', fmtm(.5 * al * 100), COL.lid]); }
          S.ro(rows);
        }
        if (step === 4) {
          const ph = st.t;
          const ghosts = [[.55 * Math.sin(ph * .7), [1.6 * Math.sin(ph * .5), .8 * Math.cos(ph * .4), .4 * Math.sin(ph * .6)]], [-.9 + .3 * Math.sin(ph * .6), [-1.5, 1.2, -.3]]];
          st.drone(Q.p, Q.R, COL.ink, 1.8); st.arrow([-5.5, 3.2, 3], [-5.5, 3.2, 1.6], '#8e8e93', 2.5); st.text([-5.5, 3.2, 3], 'g', '#6e6e73', { dx: 6, size: 12, weight: 700 });
          for (const [ang, sh] of ghosts) {
            const Rz = m3.rz(ang); const tf = (p) => v3.a(m3.v(Rz, p), sh);
            st.path(ref.map(tf), COL.vis, 1.2, { alpha: .55 }); st.drone(tf(Q.p), m3.mul(Rz, Q.R), COL.vis, 1.4, { alpha: .6 });
          }
          const Rt = m3.rx(rad(22)); const tfb = (p) => v3.a(m3.v(Rt, p), [0, 0, .6]);
          st.path(ref.map(tfb), COL.lid, 1, { alpha: .5, dash: [4, 3] }); st.text(tfb(ref[8]), 'tilted copy ✗', COL.lid, { size: 10, bg: 'rgba(255,255,255,.85)' });
          st.text(v3.a(m3.v(m3.rz(ghosts[0][0]), ref[30]), ghosts[0][1]), 'shifted + yawed copy ✓', COL.vis, { size: 10, bg: 'rgba(255,255,255,.85)' });
          S.ro([['unobservable (drift)', 'x · y · z · yaw', COL.lid], ['observable via gravity', 'roll · pitch', COL.ok], ['needs excitation', 'accel. biases, scale (mono VIO)'], ['consequence', 'loop closure solves a 4-DoF pose graph']]);
        }
        st.flush();
      });
    }
  });
}

/* =====================================================================
   L2 · CAMERA geometry: rays, triangulation, scale, reprojection, BA
   ===================================================================== */
const KCAM = { f: 457, cx: 320, cy: 240, W: 640, H: 480 };
const RFWD = m3.cols([1, 0, 0], [0, 0, -1], [0, 1, 0]); // camera looking +y: x right, y down, z forward
function camProj(R, C, p) { const pc = m3.v(m3.T(R), v3.s(p, C)); if (pc[2] < .1) return null; return [KCAM.f * pc[0] / pc[2] + KCAM.cx, KCAM.f * pc[1] / pc[2] + KCAM.cy, pc[2]]; }
const CAM_LM = (() => {
  const r = rng(21), L = [];
  for (let i = 0; i < 34; i++) L.push({ p: [-4.5 + 9 * r(), 7, .2 + 2.7 * r()], g: 'wall' });
  for (let i = 0; i < 12; i++) L.push({ p: [-4.5, 2 + 5 * r(), .2 + 2.6 * r()], g: 'side' });
  const box = (c, s, hgt, n) => { for (let i = 0; i < n; i++) { const f = r(); if (f < .6) L.push({ p: [c[0] - s / 2 + s * r(), c[1] - s / 2, hgt * r()], g: 'box' }); else L.push({ p: [c[0] - s / 2 + s * r(), c[1] - s / 2 + s * r(), hgt], g: 'box' }); } };
  box([-1.7, 3.4], 1, .9, 10); box([1.9, 4.4], 1.2, 1.6, 12);
  return L.map((l, i) => ({ ...l, c: LMCOLS[i % LMCOLS.length] }));
})();
function drawInset(ctx, x, y, w, title, pts, op = {}) {
  const hh = w * .75, s = w / KCAM.W;
  ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.strokeStyle = op.col || COL.ink; ctx.lineWidth = 1.2; rrect(ctx, x, y, w, hh, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); rrect(ctx, x, y, w, hh, 6); ctx.clip();
  for (const p of pts) {
    const px = x + p.u * s, py = y + p.v * s;
    if (p.pred) { const qx = x + p.pred[0] * s, qy = y + p.pred[1] * s; ctx.strokeStyle = COL.lid; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(qx, qy); ctx.stroke(); ctx.beginPath(); ctx.arc(qx, qy, 3, 0, TAU); ctx.strokeStyle = COL.lrn; ctx.stroke(); }
    ctx.fillStyle = p.c || COL.ink; ctx.beginPath(); ctx.arc(px, py, p.big ? 4 : 2.2, 0, TAU); ctx.fill();
    if (p.big) { ctx.strokeStyle = p.c; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  ctx.font = '600 9.5px "JetBrains Mono", monospace'; ctx.fillStyle = op.col || COL.ink; ctx.fillText(title, x + 6, y + hh + 12);
}
function labCam() {
  return lessonCard({
    id: 'cam', num: 'L2', title: 'Cameras: rays, depth, scale and bundle adjustment',
    q: 'A camera turns the 3D world into 2D pixels. How do VIO systems get depth back, why does a single camera lose scale, and what is a "reprojection error"?',
    cap: 'pinhole model f = 457 px (640×480, ~70° FOV) · Gauss-Newton on 6-DoF pose · seeded pixel noise',
    state: { B: .12, Z: 5, spx: .5, nF: 40, layout: 'spread', pose: null, iters: [], anim: null },
    steps: [
      { t: 'A camera is a ray machine', p: 'Each pixel is a <b>ray</b> out of the optical centre. The highlighted landmark slides along its ray, and its pixel (inset) does not move: <b>one image cannot measure depth</b>. Every landmark here is a feature a front-end such as ORB, FAST or KLT would detect and track.' },
      { t: 'Two views → triangulated depth', p: 'A second camera a baseline B away sees the same landmark along a different ray; the two rays intersect. Pixel noise σ turns that point into an <b>uncertainty ellipsoid</b> (3σ, drawn to scale) stretched along the viewing direction: σ<sub>depth</sub> ≈ Z²·σ/(f·B), σ<sub>lateral</sub> ≈ Z·σ/f. Depth error grows with the <b>square</b> of distance — stereo on a small drone (B = 5–12 cm) is only metric to a few metres.' },
      { t: 'One camera: scale is invisible', p: 'A single moving camera triangulates between its own frames, but scaling the <b>entire world and the camera path</b> by any factor s gives identical images (insets do not change while the scene breathes). Monocular VO therefore drifts in scale. <b>VIO fixes scale with the accelerometer</b>, which measures metres per second² — but only while the drone accelerates; constant-velocity flight makes scale unobservable again.' },
      { t: 'Reprojection error', p: 'Estimating a camera\'s pose = finding the pose whose <b>predicted</b> pixels (orange rings) land on the <b>measured</b> ones (dots). The red lines are residuals. Press <b>Optimise</b>: Gauss–Newton linearises the projection and solves a 6×6 system per iteration; the orange frustum snaps onto the true one in a few steps. Bundle adjustment does exactly this, jointly over many poses and landmarks.' },
      { t: 'How sure is that pose?', p: 'At the solution, the inverse of JᵀJ times σ² is the pose covariance (ellipsoid at the camera, 3σ). Fewer features — darkness, blur, blank walls — or features crowded on one distant wall make it grow, especially along the optical axis. This is the quantity that "drift" accumulates frame after frame.' },
    ],
    onStep: (S, i) => { if (i >= 3 && !S.pose) S.perturb(); },
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.0, pitch: .42, dist: 13, target: [0, 3.2, 1.2], minDist: 3, maxDist: 60 });
      S.add(ctlSlider('baseline B', .03, 1, .01, S.B, v => (v * 100).toFixed(0) + ' cm', v => S.B = v), [1]);
      S.add(ctlSlider('landmark depth Z', 1, 15, .1, S.Z, v => v.toFixed(1) + ' m', v => S.Z = v), [0, 1]);
      S.add(ctlSlider('pixel noise σ', .2, 3, .1, S.spx, v => v.toFixed(1) + ' px', v => { S.spx = v; S.meas(); }), [1, 3, 4]);
      S.add(ctlSlider('features used', 5, 58, 1, S.nF, v => String(v), v => { S.nF = v; }), [3, 4]);
      S.add(ctlSeg('feature layout', [['spread', 'Spread'], ['far', 'Far wall only'], ['cluster', 'One cluster']], 'spread', k => { S.layout = k; }), [3, 4]);
      S.add(ctlBtns(['Optimise ▶', () => S.optimise(), 'btn-primary'], ['Perturb pose', () => S.perturb()]), [3, 4]);
      // camera 2 (the frame being estimated)
      const R2 = m3.mul(m3.rz(rad(8)), RFWD), C2 = [.7, .3, 1.45];
      const nz = (() => { const r = rng(4); return CAM_LM.map(() => [gauss(r), gauss(r)]); })();
      S.meas = () => { S.m = CAM_LM.map((l, i) => { const q = camProj(R2, C2, l.p); return q ? [q[0] + nz[i][0] * S.spx, q[1] + nz[i][1] * S.spx] : null; }); };
      S.meas();
      const usable = () => {
        const idx = CAM_LM.map((l, i) => i).filter(i => { const q = camProj(R2, C2, CAM_LM[i].p); return q && q[0] > 0 && q[0] < 640 && q[1] > 0 && q[1] < 480; });
        let sel = idx;
        if (S.layout === 'far') sel = idx.filter(i => CAM_LM[i].g === 'wall');
        if (S.layout === 'cluster') { sel = idx.slice().sort((a, b) => Math.hypot(CAM_LM[a].p[0] - 2, CAM_LM[a].p[2] - 2) - Math.hypot(CAM_LM[b].p[0] - 2, CAM_LM[b].p[2] - 2)); }
        return sel.slice(0, S.nF);
      };
      const resid = (R, C, ids) => { const r = []; for (const i of ids) { const q = camProj(R, C, CAM_LM[i].p); if (!q) { r.push(50, 50); continue; } r.push(q[0] - S.m[i][0], q[1] - S.m[i][1]); } return r; };
      const jac = (R, C, ids) => { const r0 = resid(R, C, ids), J = r0.map(() => new Array(6).fill(0)), e = 1e-6; for (let k = 0; k < 6; k++) { const d = [0, 0, 0, 0, 0, 0]; d[k] = e; const R1 = m3.mul(m3.exp(d.slice(0, 3)), R), C1 = v3.a(C, d.slice(3)); const r1 = resid(R1, C1, ids); for (let i = 0; i < r0.length; i++) J[i][k] = (r1[i] - r0[i]) / e; } return { r0, J }; };
      const normal = (J, r) => { const H = zeros(6, 6), b = new Array(6).fill(0); for (let i = 0; i < J.length; i++) { const Ji = J[i]; for (let a = 0; a < 6; a++) { b[a] -= Ji[a] * r[i]; for (let c = 0; c < 6; c++) H[a][c] += Ji[a] * Ji[c]; } } return { H, b }; };
      S.perturb = () => { const r = rng(Math.floor(performance.now()) % 997 + 3); S.pose = { R: m3.mul(m3.exp([rad(3) * gauss(r), rad(3) * gauss(r), rad(4) * gauss(r)]), R2), C: v3.a(C2, [.35 * gauss(r), .3 * gauss(r), .2 * gauss(r)]) }; S.anim = null; S.iter = 0; };
      S.optimise = () => {
        if (!S.pose) S.perturb();
        const ids = usable(); let R = S.pose.R, C = S.pose.C; const steps = [];
        for (let it = 0; it < 8; it++) {
          const { r0, J } = jac(R, C, ids); const { H, b } = normal(J, r0); for (let a = 0; a < 6; a++) H[a][a] *= 1.0001; const dx = solveLin(H, b); if (!dx) break;
          steps.push({ R0: R, C0: C, d: dx }); R = m3.mul(m3.exp(dx.slice(0, 3)), R); C = v3.a(C, dx.slice(3));
          if (Math.hypot(...dx) < 1e-7) break;
        }
        S.anim = { steps, i: 0, u: 0 };
      };
      animate(st, (st, dt) => {
        const step = S.step; st.begin(dt);
        st.grid(-5, 5, -1, 8, 1, 0, '#ececf0');
        st.face([[-4.5, 7, 0], [4.5, 7, 0], [4.5, 7, 3], [-4.5, 7, 3]], '#9aa0a6', { alpha: .07, stroke: '#9aa0a6', salpha: 3 });
        st.face([[-4.5, 2, 0], [-4.5, 7, 0], [-4.5, 7, 3], [-4.5, 2, 3]], '#9aa0a6', { alpha: .05, stroke: '#9aa0a6', salpha: 3 });
        st.box([-2.2, 2.9, 0], [-1.2, 3.9, .9], '#c5c9d0', { alpha: .35, stroke: '#9aa0a6' });
        st.box([1.3, 3.8, 0], [2.5, 5.0, 1.6], '#c5c9d0', { alpha: .35, stroke: '#9aa0a6' });
        let scale = 1, C1 = [-S.B / 2, 0, 1.4];
        if (step === 2) { scale = Math.exp(.55 * Math.sin(st.t * .8)); C1 = [-.3, 0, 1.4]; }
        const W = (p) => step === 2 ? v3.a(C1, v3.k(v3.s(p, C1), scale)) : p;
        if (step <= 2) for (const l of CAM_LM) st.dot(W(l.p), 2.6, l.c, { alpha: .9 });
        const insets = [];
        if (step === 0 || step === 1) {
          const Cc = step === 0 ? [0, 0, 1.4] : C1, Cr = [S.B / 2, 0, 1.4];
          const dir = v3.u(v3.s([.35, 5, 1.25], [0, 0, 1.4]));
          const Zs = step === 0 ? S.Z * (1 + .45 * Math.sin(st.t * 1.1)) : S.Z;
          const L = step === 0 ? v3.a(Cc, v3.k(dir, Zs / dir[1])) : [.35, S.Z, 1.25];
          st.frustum(Cc, RFWD, { depth: .8, col: COL.ink, fill: COL.vis, falpha: .08 });
          for (const l of CAM_LM) st.line(Cc, l.p, COL.vis, .5, { alpha: .14 });
          st.line(Cc, v3.a(Cc, v3.k(dir, 16 / dir[1])), COL.lid, 1.2, { dash: [4, 3], alpha: .8 });
          st.dot(L, 5, COL.lid, { ring: true, lw: 2.4 }); st.text(L, step === 0 ? 'landmark slides along its ray' : 'landmark', COL.lid, { dx: 10, size: 10, bg: 'rgba(255,255,255,.85)' });
          const pc = camProj(RFWD, Cc, L);
          insets.push({ t: step === 0 ? 'camera image' : 'left image', pts: [...CAM_LM.map(l => { const q = camProj(RFWD, Cc, l.p); return q && { u: q[0], v: q[1], c: l.c }; }).filter(Boolean), pc && { u: pc[0], v: pc[1], c: COL.lid, big: true }].filter(Boolean) });
          if (step === 1) {
            st.frustum(Cr, RFWD, { depth: .8, col: COL.ink, fill: COL.vis, falpha: .08 }); st.line(Cr, L, COL.lid, 1.4); st.line(Cc, L, COL.lid, 1.4);
            st.line(Cc, Cr, COL.ink, 2.2); st.text(v3.l(Cc, Cr, .5), `B = ${(S.B * 100).toFixed(0)} cm`, COL.ink, { dy: 14, align: 'center', size: 10, bg: 'rgba(255,255,255,.85)' });
            const sl = S.Z * S.spx / KCAM.f, sd = S.Z * S.Z * S.spx / (KCAM.f * S.B);
            const Sg = [[sl * sl, 0, 0], [0, sd * sd, 0], [0, 0, sl * sl]];
            // the noise wedge from each camera
            for (const Cx of [Cc, Cr]) for (const s of [-1, 1]) st.line(Cx, v3.a(L, [0, s * 3 * sd, 0]), COL.lid, .6, { alpha: .35 });
            st.ellipsoid(L, Sg, COL.lid, { k: 3, fill: .18, cap: 30 });
            const pr = camProj(RFWD, Cr, L);
            insets.push({ t: 'right image', pts: [...CAM_LM.map(l => { const q = camProj(RFWD, Cr, l.p); return q && { u: q[0], v: q[1], c: l.c }; }).filter(Boolean), pr && { u: pr[0], v: pr[1], c: COL.lid, big: true }].filter(Boolean) });
            const disp = KCAM.f * S.B / S.Z;
            S.ro([['disparity f·B/Z', disp.toFixed(1) + ' px'], ['σ depth  Z²σ/(fB)', fmtm(sd), COL.lid], ['σ lateral  Zσ/f', fmtm(sl)], ['depth error / depth', (sd / S.Z * 100).toFixed(1) + ' %'], ['useful stereo range (σ<10%)', (.1 * KCAM.f * S.B / S.spx).toFixed(1) + ' m']]);
          } else S.ro([['landmark depth now', Zs.toFixed(2) + ' m', COL.lid], ['its pixel (u, v)', pc ? `${pc[0].toFixed(1)}, ${pc[1].toFixed(1)}` : '—'], ['pixel change', '0.0 px — depth is unobservable from one view']]);
        }
        if (step === 2) {
          const C1b = v3.a(C1, v3.k([.9, .7, .05], scale));
          st.frustum(C1, RFWD, { depth: .8 * scale, col: COL.ink, fill: COL.vis, falpha: .08 }); st.frustum(C1b, RFWD, { depth: .8 * scale, col: COL.ink, fill: COL.vis, falpha: .08 });
          st.arrow(C1, C1b, COL.lrn, 2); st.text(v3.l(C1, C1b, .5), `t = ${(1.14 * scale).toFixed(2)} m ?`, COL.lrn, { dy: 14, size: 10, bg: 'rgba(255,255,255,.85)' });
          const mk = (C) => CAM_LM.map(l => { const q = camProj(RFWD, C, W(l.p)); return q && { u: q[0], v: q[1], c: l.c }; }).filter(Boolean);
          insets.push({ t: 'frame k', pts: mk(C1) }, { t: 'frame k+1', pts: mk(C1b) });
          S.ro([['world scale factor s', scale.toFixed(2) + '×', COL.lrn], ['translation between frames', (1.14 * scale).toFixed(2) + ' m'], ['change in either image', '0.000 px'], ['what fixes it', 'IMU (needs acceleration), stereo baseline, or a known size']]);
        }
        if (step >= 3) {
          if (!S.pose) S.perturb();
          if (S.anim) { const A = S.anim; if (A.i < A.steps.length) { A.u += dt / .55; const s = A.steps[A.i]; const u = Math.min(1, A.u); S.pose = { R: m3.mul(m3.exp(v3.k(s.d.slice(0, 3), u)), s.R0), C: v3.a(s.C0, v3.k(s.d.slice(3), u)) }; if (A.u >= 1) { A.i++; A.u = 0; S.iter = A.i; } } }
          const ids = usable(), idset = new Set(ids);
          CAM_LM.forEach((l, i) => st.dot(l.p, idset.has(i) ? 3 : 2, idset.has(i) ? l.c : '#c8c8ce', { alpha: idset.has(i) ? 1 : .6 }));
          st.frustum(C2, R2, { depth: .9, col: COL.ink, fill: COL.ink, falpha: .05 }); st.text(C2, 'true pose', COL.ink, { dx: -8, dy: 16, align: 'right', size: 9.5 });
          st.frustum(S.pose.C, S.pose.R, { depth: .9, col: COL.lrn, lw: 1.8, fill: COL.lrn, falpha: .08 }); st.text(S.pose.C, 'estimate', COL.lrn, { dx: 8, dy: -10, size: 9.5, bg: 'rgba(255,255,255,.85)' });
          for (const i of ids.slice(0, 26)) st.line(S.pose.C, CAM_LM[i].p, COL.lrn, .5, { alpha: .25 });
          const r = resid(S.pose.R, S.pose.C, ids); let ss = 0; for (const v of r) ss += v * v; const rms = Math.sqrt(ss / Math.max(1, r.length));
          insets.push({ t: 'measured (dots) vs predicted (rings)', col: COL.lrn, pts: ids.map((i, k) => ({ u: S.m[i][0], v: S.m[i][1], c: CAM_LM[i].c, pred: [S.m[i][0] + r[2 * k], S.m[i][1] + r[2 * k + 1]] })) });
          const pe = v3.n(v3.s(S.pose.C, C2)); const Rd = m3.mul(m3.T(R2), S.pose.R); const re = deg(Math.acos(clamp((Rd[0][0] + Rd[1][1] + Rd[2][2] - 1) / 2, -1, 1)));
          const rows = [['features used', String(ids.length)], ['Gauss–Newton iteration', String(S.iter || 0)], ['RMS reprojection error', rms.toFixed(2) + ' px', rms > 3 * S.spx ? COL.lid : COL.ok], ['position error', fmtm(pe)], ['rotation error', re.toFixed(2) + '°']];
          if (step === 4 && ids.length >= 3) {
            const { J } = jac(S.pose.R, S.pose.C, ids); const { H } = normal(J, J.map(() => 0)); const Hi = invMat(H);
            if (Hi) {
              const s2 = S.spx * S.spx; const Cp = [[Hi[3][3], Hi[3][4], Hi[3][5]], [Hi[4][3], Hi[4][4], Hi[4][5]], [Hi[5][3], Hi[5][4], Hi[5][5]]].map(r => r.map(v => v * s2));
              st.ellipsoid(S.pose.C, Cp, COL.lrn, { k: 3, fill: .2, cap: 5 });
              rows.push(['σ position x / y(depth) / z', [0, 1, 2].map(i => fmtm(Math.sqrt(Cp[i][i]))).join(' · '), COL.lrn], ['σ rotation (roll/pitch/yaw)', [0, 1, 2].map(i => deg(Math.sqrt(Hi[i][i] * s2)).toFixed(3) + '°').join(' · ')]);
            }
          }
          S.ro(rows);
        }
        st.flush();
        const iw = clamp(st.w * .27, 120, 210); insets.forEach((I, k) => drawInset(st.ctx, st.w - iw - 12, 12 + k * (iw * .75 + 26), iw, I.t, I.pts, { col: I.col }));
      });
    }
  });
}

/* =====================================================================
   L3 · LiDAR: scan, point-to-plane, information, degeneracy, ICP
   ===================================================================== */
const LENV = {
  room: { name: 'Room', pos: [0, 0, 1.4], el: [-7, 52], prims: [{ k: 'in', mn: [-5, -4, 0], mx: [5, 4, 3] }, { k: 'box', mn: [1, -2.2, 0], mx: [2.6, -1, .9] }, { k: 'box', mn: [-4.6, 1.8, 0], mx: [-3.6, 3.8, 2] }, { k: 'box', mn: [2.3, 1.4, 0], mx: [2.9, 2, 3] }], view: { dist: 15, target: [0, 0, 1] } },
  corridor: { name: 'Corridor', pos: [0, 0, 1.4], el: [-7, 52], prims: [{ k: 'in', mn: [-70, -1.2, 0], mx: [70, 1.2, 2.8] }], view: { dist: 16, target: [0, 0, 1] } },
  tunnel: { name: 'Tunnel', pos: [0, 0, 1.3], el: [-7, 52], prims: [{ k: 'cylx', c: [0, 0, 1], r: 2.4 }, { k: 'floor', z: 0 }], view: { dist: 16, target: [0, 0, 1] } },
  open: { name: 'Open field', pos: [0, 0, 6], el: [-52, 7], prims: [{ k: 'floor', z: 0 }], view: { dist: 34, target: [0, 0, 2] } },
  shaft: { name: 'Vertical shaft', pos: [0, 0, 12], el: [-7, 52], prims: [{ k: 'cylz', c: [0, 0, 0], r: 2 }], view: { dist: 26, target: [0, 0, 12] } },
};
function rayPrim(o, d, P) {
  if (P.k === 'in') { let t = 1e9, ax = 0; for (let i = 0; i < 3; i++) { if (Math.abs(d[i]) < 1e-12) continue; const ti = ((d[i] > 0 ? P.mx[i] : P.mn[i]) - o[i]) / d[i]; if (ti < t) { t = ti; ax = i; } } const n = [0, 0, 0]; n[ax] = d[ax] > 0 ? -1 : 1; return { t, n }; }
  if (P.k === 'box') { let t0 = -1e9, t1 = 1e9, ax = 0; for (let i = 0; i < 3; i++) { if (Math.abs(d[i]) < 1e-12) { if (o[i] < P.mn[i] || o[i] > P.mx[i]) return null; continue; } let a = (P.mn[i] - o[i]) / d[i], b = (P.mx[i] - o[i]) / d[i]; if (a > b) [a, b] = [b, a]; if (a > t0) { t0 = a; ax = i; } t1 = Math.min(t1, b); } if (t1 < t0 || t0 < 0) return null; const n = [0, 0, 0]; n[ax] = d[ax] > 0 ? -1 : 1; return { t: t0, n }; }
  if (P.k === 'cylx' || P.k === 'cylz') {
    const [i, j] = P.k === 'cylx' ? [1, 2] : [0, 1]; const oy = o[i] - P.c[i], oz = o[j] - P.c[j];
    const A = d[i] * d[i] + d[j] * d[j]; if (A < 1e-12) return null; const B = 2 * (d[i] * oy + d[j] * oz), C = oy * oy + oz * oz - P.r * P.r; const D = B * B - 4 * A * C; if (D < 0) return null;
    const t = (-B + Math.sqrt(D)) / (2 * A); const q = v3.a(o, v3.k(d, t)); const n = [0, 0, 0]; n[i] = -(q[i] - P.c[i]) / P.r; n[j] = -(q[j] - P.c[j]) / P.r; return { t, n };
  }
  if (P.k === 'floor') { if (d[2] >= -1e-9) return null; return { t: (P.z - o[2]) / d[2], n: [0, 0, 1] }; }
  return null;
}
function sdfPrim(p, P) {
  if (P.k === 'in') { let best = 1e9, n = null; for (let i = 0; i < 3; i++) { const a = p[i] - P.mn[i], b = P.mx[i] - p[i]; if (Math.abs(a) < Math.abs(best)) { best = a; n = [0, 0, 0]; n[i] = 1; } if (Math.abs(b) < Math.abs(best)) { best = b; n = [0, 0, 0]; n[i] = -1; } } return { d: best, n }; }
  if (P.k === 'box') {
    const f = (q) => { const c = [(P.mn[0] + P.mx[0]) / 2, (P.mn[1] + P.mx[1]) / 2, (P.mn[2] + P.mx[2]) / 2], hs = [(P.mx[0] - P.mn[0]) / 2, (P.mx[1] - P.mn[1]) / 2, (P.mx[2] - P.mn[2]) / 2]; const e = [0, 1, 2].map(i => Math.abs(q[i] - c[i]) - hs[i]); const out = Math.hypot(Math.max(e[0], 0), Math.max(e[1], 0), Math.max(e[2], 0)); return out + Math.min(Math.max(e[0], e[1], e[2]), 0); };
    const d = f(p), h0 = 1e-4; const n = v3.u([f([p[0] + h0, p[1], p[2]]) - f([p[0] - h0, p[1], p[2]]), f([p[0], p[1] + h0, p[2]]) - f([p[0], p[1] - h0, p[2]]), f([p[0], p[1], p[2] + h0]) - f([p[0], p[1], p[2] - h0])]); return { d, n };
  }
  if (P.k === 'cylx' || P.k === 'cylz') { const [i, j] = P.k === 'cylx' ? [1, 2] : [0, 1]; const a = p[i] - P.c[i], b = p[j] - P.c[j], r = Math.hypot(a, b) || 1e-9; const n = [0, 0, 0]; n[i] = -a / r; n[j] = -b / r; return { d: P.r - r, n }; }
  if (P.k === 'floor') return { d: p[2] - P.z, n: [0, 0, 1] };
}
function sdfScene(p, prims) { let best = null; for (const P of prims) { const s = sdfPrim(p, P); if (!best || Math.abs(s.d) < Math.abs(best.d)) best = s; } return best; }
function castScene(o, d, prims, maxR = 40) { let best = null; for (const P of prims) { const r = rayPrim(o, d, P); if (r && r.t > .05 && r.t < maxR && (!best || r.t < best.t)) best = r; } return best; }
const SIGR = .02; // range noise σ (Mid-360 spec: ≤2 cm at 10 m)
function lidarInfo(hits, pos, feats) {
  const H = zeros(6, 6);
  const addRow = (J, w) => { for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) H[a][b] += J[a] * J[b] * w; };
  for (const q of hits) { const s = v3.s(q.p, pos); const rx = v3.x(s, q.n); addRow([rx[0], rx[1], rx[2], q.n[0], q.n[1], q.n[2]], 1 / (SIGR * SIGR)); }
  if (feats) for (const f of feats) { const s = v3.s(f.p, pos); for (let k = 0; k < 3; k++) { const e = [0, 0, 0]; e[k] = 1; const rr = v3.x(s, e); addRow([rr[0], rr[1], rr[2], e[0], e[1], e[2]], 1 / (.05 * .05)); } }
  return H;
}
const DOFN = ['move along x', 'move along y', 'move along z', 'rotate about x (roll)', 'rotate about y (pitch)', 'rotate about z (yaw)'];
function labLidar() {
  return lessonCard({
    id: 'lidar', num: 'L3', title: 'LiDAR: point-to-plane matching and geometric degeneracy',
    q: 'LIO systems are the most accurate on drones — until the geometry runs out. Why does a long corridor, tunnel, shaft or open field break them, and how do fusion methods fix it?',
    cap: 'Mid-360-like scan (360° × −7…52°, non-repetitive) · analytic map · 6×6 information matrix · point-to-plane ICP',
    state: { env: 'room', feat: false, icp: null },
    steps: [
      { t: 'One integrated scan', p: 'A solid-state LiDAR such as the Livox Mid-360 fires 200,000 points per second in a <b>non-repetitive</b> pattern that fills in the longer you integrate (one drawn point here stands for many). Colour = height. Each point is a range along a known direction, so unlike a camera it gives <b>metric depth directly</b>, in the dark.' },
      { t: 'Every point is a plane constraint', p: 'LIO systems (FAST-LIO2, LIO-SAM, DLIO…) match each new point to the <b>local surface</b> in the map. The residual is the distance from the point to that plane, measured along the surface <b>normal</b> (short lines). A point on a wall says "you cannot move toward this wall" — and says <em>nothing</em> about sliding along it.' },
      { t: 'Add up the information', p: 'Stacking every point\'s constraint gives the 6×6 <b>information matrix</b> H = Σ JᵀJ/σ². Its eigenvectors are the directions the scan pins down; small eigenvalues are directions it cannot see. The ellipsoid shows relative translation uncertainty (axis ∝ 1/√λ, normalised so the best direction is 40 cm). <b>Switch the environment</b>: corridor → a needle along x; tunnel → also roll; shaft → along z; open field → x, y and yaw are all lost.' },
      { t: 'Registration in action', p: 'Press <b>Run ICP</b>. The scan starts from a wrong pose (orange) and Gauss–Newton point-to-plane iterations pull it onto the map. In the room it locks on. In the corridor it converges to a perfect-looking fit that is <b>still off along x</b> — the residuals are zero for every x, so the solver has no reason to move. This is exactly how LIO drifts silently in tunnels.' },
      { t: 'Fixing the weak direction', p: 'Turn on <b>features along the weak direction</b>: visual or LiDAR-intensity landmarks (door frames, signs, floor markings) give constraints the geometry lacks. That is the idea behind FAST-LIVO2 / R3LIVE (camera photometric residuals), COIN-LIO (intensity image), and degeneracy-aware solvers (Zhang, Kaess & Singh, ICRA 2016) that freeze unobservable directions instead of letting noise move them. Run ICP again in the corridor.' },
    ],
    onStep: (S, i) => { if (i === 3 || i === 4) S.resetIcp(); },
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.3, pitch: .62, dist: 15, target: [0, 0, 1], minDist: 3, maxDist: 120 });
      let hits = [], seq = 0, H = null, feats = [];
      const reset = () => { hits = []; seq = 0; H = null; const E = LENV[S.env]; st.goTo({ ...E.view, pitch: S.env === 'shaft' ? .25 : .62 }); S.resetIcp(); };
      S.add(ctlSeg('environment', Object.entries(LENV).map(([k, e]) => [k, e.name]), 'room', (k) => { S.env = k; reset(); }));
      S.add(ctlToggle('add visual / intensity features along the weak direction', false, (v) => { S.feat = v; S.resetIcp(); }), [2, 3, 4]);
      S.add(ctlBtns(['Run ICP ▶', () => S.runIcp(), 'btn-primary'], ['Reset offset', () => S.resetIcp()]), [3, 4]);
      S.resetIcp = () => { S.icp = { R: m3.exp([0, 0, rad(5)]), t: [.55, .35, .12], it: 0, run: false, acc: 0, hist: [] }; };
      S.resetIcp();
      S.runIcp = () => { S.resetIcp(); S.icp.run = true; };
      const icpStep = (E) => {
        const I = S.icp, pos = E.pos, sub = hits.filter((_, i) => i % 3 === 0); const Hm = zeros(6, 6), b = new Array(6).fill(0); let ss = 0;
        for (const q of sub) { const s = v3.s(q.p, pos), qq = m3.v(I.R, s), p = v3.a(v3.a(qq, pos), I.t); const r = sdfScene(p, E.prims); const rx = v3.x(qq, r.n); const J = [rx[0], rx[1], rx[2], r.n[0], r.n[1], r.n[2]]; for (let a = 0; a < 6; a++) { b[a] -= J[a] * r.d; for (let c = 0; c < 6; c++) Hm[a][c] += J[a] * J[c]; } ss += r.d * r.d; }
        if (S.feat) for (const f of feats) { const s = v3.s(f.p, pos), qq = m3.v(I.R, s); const p = v3.a(v3.a(qq, pos), I.t); const w = (SIGR / .05) ** 2; for (let k = 0; k < 3; k++) { const e = [0, 0, 0]; e[k] = 1; const rr = v3.x(qq, e); const J = [rr[0], rr[1], rr[2], e[0], e[1], e[2]]; const res = p[k] - f.p[k]; for (let a = 0; a < 6; a++) { b[a] -= J[a] * res * w; for (let c = 0; c < 6; c++) Hm[a][c] += J[a] * J[c] * w; } } }
        let tr = 0; for (let a = 0; a < 6; a++) tr += Hm[a][a]; for (let a = 0; a < 6; a++) Hm[a][a] += 1e-6 * tr / 6 + 1e-9;
        const dx = solveLin(Hm, b); if (!dx) return 0;
        I.R = m3.mul(m3.exp(dx.slice(0, 3)), I.R); I.t = v3.a(I.t, dx.slice(3)); // rotation about the sensor origin, then shift
        I.rms = Math.sqrt(ss / sub.length); I.it++; return Math.hypot(...dx);
      };
      animate(st, (st, dt) => {
        const E = LENV[S.env], pos = E.pos, step = S.step;
        // accumulate scan
        const target = 2400, per = Math.min(90, target - hits.length);
        for (let i = 0; i < per; i++, seq++) {
          const u1 = (seq * .7548776662 + .5) % 1, u2 = (seq * .5698402910 + .5) % 1; const az = u1 * TAU, el = rad(lerp(E.el[0], E.el[1], u2));
          const d = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]; const r = castScene(pos, d, E.prims); if (r) hits.push({ p: v3.a(pos, v3.k(d, r.t)), n: r.n, r: r.t });
        }
        if (hits.length >= target && !H) {
          // features: the hits spread along the scene's weakest direction
          feats = []; const H0 = lidarInfo(hits, pos); const ev = eigSym(H0); const weak = ev[5].vec; const wt = v3.u(weak.slice(3)); const useDir = v3.n(weak.slice(3)) > .3 ? wt : [1, 0, 0];
          const sorted = hits.filter((_, i) => i % 7 === 0).sort((a, b) => v3.d(v3.s(a.p, pos), useDir) - v3.d(v3.s(b.p, pos), useDir));
          for (let k = 0; k < 14; k++) feats.push(sorted[Math.floor((k + .5) / 14 * sorted.length)]);
          H = true;
        }
        st.begin(dt);
        // scene wireframe
        for (const P of E.prims) {
          if (P.k === 'in') st.box(P.mn.map((v, i) => clamp(v, pos[i] - 14, pos[i] + 14)), P.mx.map((v, i) => clamp(v, pos[i] - 14, pos[i] + 14)), '#9aa0a6', { inside: true, alpha: .06, stroke: '#9aa0a6', salpha: 4 });
          if (P.k === 'box') st.box(P.mn, P.mx, '#9aa0a6', { alpha: .18, stroke: '#7a7f86', salpha: 3 });
          if (P.k === 'cylx') for (let x = -14; x <= 14; x += 2) st.ring([x, P.c[1], P.c[2]], m3.ry(Math.PI / 2), P.r, '#9aa0a6', 1, { n: 24, alpha: .35 });
          if (P.k === 'cylz') for (let z = 2; z <= 22; z += 2) st.ring([P.c[0], P.c[1], z], m3.I(), P.r, '#9aa0a6', 1, { n: 24, alpha: .35 });
          if (P.k === 'floor') st.grid(-14, 14, -14, 14, 2, P.z, '#e3e3e8');
        }
        const zr = S.env === 'shaft' ? [0, 24] : S.env === 'open' ? [0, .5] : [0, 3];
        const icpOn = step >= 3;
        // ICP animation
        if (icpOn && S.icp.run && H) { S.icp.acc += dt; if (S.icp.acc > .45) { S.icp.acc = 0; const d = icpStep(E); if (d < 1e-6 || S.icp.it >= 14) S.icp.run = false; } }
        const showN = step === 1;
        hits.forEach((q, i) => {
          const c = ramp((q.p[2] - zr[0]) / (zr[1] - zr[0]));
          if (icpOn) st.dot(q.p, 1.4, '#a5a5ad', { alpha: .6 }); else st.dot(q.p, 1.8, c, { alpha: .9 });
          if (showN && i % 9 === 0) st.line(q.p, v3.a(q.p, v3.k(q.n, .45)), c, 1.2, { alpha: .85 });
        });
        if (step === 0) for (let i = Math.max(0, hits.length - 40); i < hits.length; i++) st.line(pos, hits[i].p, COL.lid, .6, { alpha: .25 });
        if (icpOn) { const I = S.icp; hits.forEach((q, i) => { if (i % 2) return; const s = v3.s(q.p, pos); st.dot(v3.a(v3.a(m3.v(I.R, s), pos), I.t), 1.6, COL.lrn, { alpha: .85 }); }); st.drone(v3.a(pos, I.t), I.R, COL.lrn, 1.4, { alpha: .9 }); }
        if ((step >= 2) && S.feat) for (const f of feats) { st.dot(f.p, 5, COL.vis, { sq: true }); }
        st.drone(pos, m3.I(), COL.ink, 1.6);
        // information
        let rows = [['points in scan', String(hits.length)], ['range noise σ', '2 cm (Mid-360 spec)']];
        if (H && step >= 2) {
          const Hm = lidarInfo(hits, pos, S.feat ? feats : null); const ev = eigSym(Hm);
          // translational marginal covariance
          const Hr = Hm.map((r, i) => r.map((v, j) => v + (i === j ? 1e-6 : 0))); const Hi = invMat(Hr);
          if (Hi && step === 2 || (Hi && step === 4)) {
            const Ct = [[Hi[3][3], Hi[3][4], Hi[3][5]], [Hi[4][3], Hi[4][4], Hi[4][5]], [Hi[5][3], Hi[5][4], Hi[5][5]]];
            const e3 = eigSym(Ct); const smin = Math.sqrt(Math.max(1e-30, e3[2].val)); const k = .4 / smin;
            const Cs = Ct.map(r => r.map(v => v * k * k)); st.ellipsoid(pos, Cs, COL.lid, { k: 1, cap: 9, fill: .16, lw: 1.4 });
            e3.forEach((e, i) => { const L = Math.min(9, Math.sqrt(Math.max(0, e.val)) * k); if (L > 1.2) st.text(v3.a(pos, v3.k(e.vec, L)), 'weak', COL.lid, { size: 9.5, weight: 700, bg: 'rgba(255,255,255,.85)' }); });
          }
          const lmax = ev[0].val;
          const bars = ev.map(e => { const tn = v3.n(e.vec.slice(3)), rn = v3.n(e.vec.slice(0, 3)); const comp = tn >= rn ? e.vec.slice(3) : e.vec.slice(0, 3); let ax = 0; for (let i = 1; i < 3; i++) if (Math.abs(comp[i]) > Math.abs(comp[ax])) ax = i; const name = DOFN[(tn >= rn ? 0 : 3) + ax]; const rel = Math.max(1e-9, e.val / lmax); const w = clamp((Math.log10(rel) + 8) / 8, 0, 1); return `<div class="eig"><span>${name}</span><i style="width:${(w * 100).toFixed(1)}%;background:${rel < 1e-4 ? COL.lid : rel < 1e-2 ? COL.warn : COL.ok}"></i><b>${rel < 1e-6 ? '≈ 0' : rel.toExponential(1)}</b></div>`; });
          rows = [...rows, `<div class="r sub"><span>information per direction (λ / λ<sub>max</sub>, log scale; rotations in rad, translations in m)</span></div>`, ...bars];
        }
        if (icpOn) { const I = S.icp; const yawE = deg(yawOf(I.R)); rows.push(['ICP iteration', String(I.it)], ['RMS point-to-plane residual', I.rms != null ? fmtm(I.rms) : '—'], ['remaining error x / y / z', I.t.map(v => (Math.abs(v) < 5e-4 ? 0 : v * 100).toFixed(1) + ' cm').join(' · '), Math.abs(I.t[0]) > .05 || Math.abs(I.t[1]) > .05 || Math.abs(I.t[2]) > .05 ? COL.lid : COL.ok], ['remaining yaw error', (Math.abs(yawE) < .005 ? 0 : yawE).toFixed(2) + '°']); }
        S.ro(rows);
        st.flush();
      });
    }
  });
}

/* =====================================================================
   L4 · FACTOR GRAPH: odometry, drift, loop closure, robust PGO (4-DoF)
   ===================================================================== */
const GRAPH = (() => {
  const W = [[1, 1, 1.2], [15, 1, 1.2], [15, 9, 1.2], [1, 9, 1.2], [1, 2.4, 1.2], [2.2, 2.2, 1.3], [6, 2.2, 4.0], [15, 2.2, 4.2], [15, 9, 4.2], [1, 9, 4.2], [1, 3.2, 4.2], [2.6, 3.2, 4.0], [6.5, 3.2, 1.4], [4, 1.3, 1.2], [1.6, 1.1, 1.2]];
  const pts = []; for (let i = 0; i < W.length - 1; i++) { const a = W[i], b = W[i + 1], L = v3.n(v3.s(b, a)); const n = Math.max(1, Math.round(L / .25)); for (let k = 0; k < n; k++) pts.push(v3.l(a, b, k / n)); } pts.push(W[W.length - 1]);
  const kf = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += v3.n(v3.s(pts[i], pts[i - 1])); if (acc >= 1.6) { kf.push(pts[i]); acc = 0; } } if (v3.n(v3.s(kf[kf.length - 1], pts[pts.length - 1])) > .5) kf.push(pts[pts.length - 1]);
  const N = kf.length; const yaw = kf.map((p, i) => { const q = kf[Math.min(N - 1, i + 1)], r = kf[Math.max(0, i - 1)]; return Math.atan2(q[1] - r[1], q[0] - r[0]); });
  const truth = kf.map((p, i) => [p[0], p[1], p[2], yaw[i]]);
  const r = rng(12); const Rt = (a) => [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
  const rel = (i, j, X) => { const d = v3.s(X[j].slice(0, 3), X[i].slice(0, 3)); return [...m3.v(Rt(X[i][3]), d), X[j][3] - X[i][3]]; };
  const odo = []; for (let i = 0; i < N - 1; i++) { const z = rel(i, i + 1, truth); z[0] += gauss(r) * .02; z[1] += gauss(r) * .02 + .012; z[2] = z[2] * 1.035 + gauss(r) * .01; z[3] += rad(.55) + gauss(r) * rad(.2); odo.push({ i, j: i + 1, z, kind: 'odo' }); }
  // dead reckoning
  const dr = [truth[0].slice()]; for (const e of odo) { const a = dr[e.i]; const c = Math.cos(a[3]), s = Math.sin(a[3]); dr.push([a[0] + c * e.z[0] - s * e.z[1], a[1] + s * e.z[0] + c * e.z[1], a[2] + e.z[2], a[3] + e.z[3]]); }
  // loop candidates: same place, different time (true) and a false match (floor 2 above floor 1)
  const near = (a, b) => v3.n(v3.s(kf[a], kf[b]));
  const loops = []; const used = new Set();
  for (let j = 0; j < N; j++) for (let i = 0; i < j - 8; i++) if (near(i, j) < 1.3 && !used.has(j) && !used.has(i)) { const z = rel(i, j, truth); z[0] += gauss(r) * .03; z[1] += gauss(r) * .03; z[2] += gauss(r) * .02; z[3] += gauss(r) * rad(.5); loops.push({ i, j, z, kind: 'loop' }); used.add(j); used.add(i); }
  let fi = 0, fj = 0, bd = 1e9; for (let i = 0; i < N; i++) for (let j = i + 8; j < N; j++) { const a = kf[i], b = kf[j]; if (a[2] < 2 && b[2] > 3.5) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d < bd && Math.abs(a[0] - 15) < 1 && Math.abs(a[1] - 9) < 3) { bd = d; fi = i; fj = j; } } }
  const fz = rel(fi, fj, truth); const falseLoop = { i: fi, j: fj, z: [fz[0], fz[1], 0, fz[3]], kind: 'false' };
  return { N, truth, odo, dr, loops, falseLoop, rel };
})();
function pgoSolve(X0, edges, op = {}) {
  const N = X0.length, n = 4 * (N - 1); let X = X0.map(x => x.slice()); const states = [X.map(x => x.slice())]; const weights = [];
  const sp = .05, sy = rad(.6), sl = .06, sly = rad(1.2); const info = (k) => k === 'odo' ? [1 / sp ** 2, 1 / sp ** 2, 1 / sp ** 2, 1 / sy ** 2] : [1 / sl ** 2, 1 / sl ** 2, 1 / sl ** 2, 1 / sly ** 2];
  const residual = (e, X) => { const a = X[e.i], b = X[e.j]; const c = Math.cos(a[3]), s = Math.sin(a[3]); const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const rp = [c * d[0] + s * d[1] - e.z[0], -s * d[0] + c * d[1] - e.z[1], d[2] - e.z[2]]; let ry = b[3] - a[3] - e.z[3]; ry = Math.atan2(Math.sin(ry), Math.cos(ry)); return { r: [...rp, ry], d, c, s }; };
  let mu = op.robust ? 2e4 : 0; const c2 = 9;
  const iters = op.iters || (op.robust ? 16 : 6);
  let lastH = null;
  for (let it = 0; it < iters; it++) {
    const H = zeros(n, n), b = new Array(n).fill(0); const wts = {};
    for (const e of edges) {
      const { r, d, c, s } = residual(e, X); const Wd = info(e.kind);
      let w = 1; if (op.robust && e.kind !== 'odo') { let chi = 0; for (let k = 0; k < 4; k++) chi += r[k] * r[k] * Wd[k]; w = (mu * c2 / (chi + mu * c2)) ** 2; wts[e.i + '-' + e.j] = w; }
      // Jacobians wrt [p_i, yaw_i] and [p_j, yaw_j]
      const Ji = [[-c, -s, 0, -s * d[0] + c * d[1]], [s, -c, 0, -c * d[0] - s * d[1]], [0, 0, -1, 0], [0, 0, 0, -1]];
      const Jj = [[c, s, 0, 0], [-s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
      const blocks = [[e.i, Ji], [e.j, Jj]];
      for (const [vi, A] of blocks) { if (vi === 0) continue; const oi = 4 * (vi - 1); for (let a = 0; a < 4; a++) { let g = 0; for (let k = 0; k < 4; k++) g += A[k][a] * Wd[k] * r[k] * w; b[oi + a] -= g; } for (const [vj, B] of blocks) { if (vj === 0) continue; const oj = 4 * (vj - 1); for (let a = 0; a < 4; a++) for (let bb = 0; bb < 4; bb++) { let v = 0; for (let k = 0; k < 4; k++) v += A[k][a] * Wd[k] * B[k][bb] * w; H[oi + a][oj + bb] += v; } } }
    }
    for (let a = 0; a < n; a++) H[a][a] += 1e-6;
    lastH = H;
    const dx = solveLin(H, b); if (!dx) break;
    X = X.map((x, k) => k === 0 ? x : [x[0] + dx[4 * (k - 1)], x[1] + dx[4 * (k - 1) + 1], x[2] + dx[4 * (k - 1) + 2], x[3] + dx[4 * (k - 1) + 3]]);
    states.push(X.map(x => x.slice())); weights.push(wts);
    if (op.robust) mu = Math.max(1, mu / 3.2);
  }
  return { states, weights, H: lastH };
}
function posCov(H, N) { const Hi = invMat(H); if (!Hi) return null; const out = [[[0, 0, 0], [0, 0, 0], [0, 0, 0]]]; for (let k = 1; k < N; k++) { const o = 4 * (k - 1); out.push([[Hi[o][o], Hi[o][o + 1], Hi[o][o + 2]], [Hi[o + 1][o], Hi[o + 1][o + 1], Hi[o + 1][o + 2]], [Hi[o + 2][o], Hi[o + 2][o + 1], Hi[o + 2][o + 2]]]); } return out; }
function labGraph() {
  return lessonCard({
    id: 'graph', num: 'L4', title: 'Factor graphs, drift and loop closure',
    q: 'A drone flies two floors of a building and comes back. How does a SLAM back-end turn "I have seen this place before" into a corrected map — and what happens if that recognition is wrong?',
    cap: '4-DoF pose graph (x, y, z, yaw) · Gauss–Newton · GNC Geman–McClure robust kernel · drift exaggerated ≈5× for visibility',
    state: { anim: null, X: null, falseOn: false, robust: false, cov: null },
    steps: [
      { t: 'Keyframes and odometry factors', p: 'Every ~1.6 m the system stores a <b>keyframe</b> (ring) — a pose variable. VIO/LIO odometry between consecutive keyframes becomes a <b>factor</b> (black square): a soft constraint "j is about here relative to i", with an uncertainty. The graph grows as the drone flies: floor 1, the stairs, floor 2, back down. Grey dashes = ground truth.' },
      { t: 'Small errors compound', p: 'Each factor is slightly wrong: a 0.55° yaw bias and a 3.5% height scale error per step here. Composed together, the estimate (blue) peels away from the truth. The ellipsoids (2σ, from inverting the graph\'s information matrix) grow with distance from the start, fastest sideways because of yaw. Hover any keyframe for its error.' },
      { t: 'Recognising a place', p: 'When the drone returns to somewhere it has been, place recognition (DBoW2 bag-of-words for images, Scan Context for LiDAR, NetVLAD learned descriptors) proposes a <b>loop</b>; a geometric check (PnP/ICP) measures the relative pose. Dashed green lines are those loop factors. They connect keyframes far apart in time but close in space.' },
      { t: 'Optimise the graph', p: 'Press <b>Optimise</b>. Gauss–Newton solves for all poses at once so that every factor is satisfied as well as possible. The error is spread back along the whole trajectory and the ellipsoids shrink — the map becomes globally consistent. VINS-Fusion runs this as a 4-DoF graph (x, y, z, yaw) for the reason in L1: roll and pitch are already fixed by gravity.' },
      { t: 'When recognition is wrong', p: 'Identical floors, repeated racks and tunnel segments cause <b>perceptual aliasing</b>. Turn on the <b>false loop</b> (red) between floor 1 and the identical spot on floor 2, then optimise: plain least squares drags the floors together. Turn on the <b>robust kernel</b>: graduated non-convexity (GNC) down-weights the factor that disagrees with everything else. Kimera-RPGO uses GNC; DOOR-SLAM, Kimera-Multi and Swarm-SLAM use pairwise consistency (PCM) for the same job.' },
    ],
    onStep: (S, i) => { if (i < 3) { S.anim = null; S.X = GRAPH.dr.map(x => x.slice()); } S.covDirty = true; },
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.2, pitch: .62, dist: 25, target: [8, 5, 2.4], minDist: 4, maxDist: 90 });
      S.X = GRAPH.dr.map(x => x.slice());
      S.add(ctlBtns(['Optimise ▶', () => S.opt(), 'btn-primary'], ['Reset to odometry', () => { S.anim = null; S.X = GRAPH.dr.map(x => x.slice()); S.covDirty = true; }]), [3, 4]);
      S.add(ctlToggle('inject a false loop (floor 1 ↔ floor 2)', false, (v) => { S.falseOn = v; S.anim = null; S.X = GRAPH.dr.map(x => x.slice()); S.covDirty = true; }), [4]);
      S.add(ctlToggle('robust kernel (GNC)', false, (v) => { S.robust = v; }), [4]);
      const edges = () => [...GRAPH.odo, ...(S.step >= 2 ? GRAPH.loops : []), ...(S.step === 4 && S.falseOn ? [GRAPH.falseLoop] : [])];
      S.opt = () => { const res = pgoSolve(GRAPH.dr, edges(), { robust: S.robust && S.step === 4 }); S.anim = { states: res.states, weights: res.weights, i: 0, u: 0 }; S.X = res.states[0].map(x => x.slice()); S.covDirty = true; S.finalH = res.H; };
      const covFor = (X) => { // information at X for current edges (no robust weights except final)
        const res = pgoSolve(X, edges(), { iters: 1 }); return posCov(res.H, GRAPH.N);
      };
      animate(st, (st, dt) => {
        const step = S.step; S.stepT += dt; st.begin(dt);
        st.grid(0, 16, 0, 10, 1, 0, '#ececf0');
        st.face([[0, 0, 2.8], [16, 0, 2.8], [16, 10, 2.8], [0, 10, 2.8]], '#9aa0a6', { alpha: .05, stroke: '#c8c8ce', salpha: 4 }); st.text([16, 0, 2.8], 'floor 2', COL.mute, { dx: 6, size: 9.5 }); st.text([16, 0, 0], 'floor 1', COL.mute, { dx: 6, size: 9.5 });
        // animation of optimisation
        if (S.anim) { const A = S.anim; if (A.i < A.states.length - 1) { A.u += dt / (S.robust ? .3 : .55); const a = A.states[A.i], b = A.states[A.i + 1], u = Math.min(1, A.u); S.X = a.map((x, k) => x.map((v, j) => lerp(v, b[k][j], u))); if (A.u >= 1) { A.i++; A.u = 0; S.covDirty = true; } } }
        const X = S.X, N = GRAPH.N, T = GRAPH.truth;
        const reveal = step === 0 ? Math.min(N, Math.floor(S.stepT * 7) + 2) : N;
        st.path(T.map(t => t.slice(0, 3)), '#9a9aa0', 1.2, { dash: [4, 4] });
        // ellipsoids
        if (step >= 1 && S.covDirty && (!S.anim || S.anim.i >= S.anim.states.length - 1)) { S.cov = covFor(X); S.covDirty = false; }
        if (step >= 1 && S.cov) for (let k = 4; k < N; k += 5) st.ellipsoid(X[k].slice(0, 3), S.cov[k], COL.vis, { k: 2, fill: .07, ralpha: .35, cap: 6 });
        for (let k = 1; k < reveal; k++) { st.line(X[k - 1].slice(0, 3), X[k].slice(0, 3), COL.vis, 2); const m = v3.l(X[k - 1].slice(0, 3), X[k].slice(0, 3), .5); st.dot(m, 2.4, COL.ink, { sq: true }); }
        const err = (k) => v3.n(v3.s(X[k].slice(0, 3), T[k].slice(0, 3)));
        for (let k = 0; k < reveal; k++) st.dot(X[k].slice(0, 3), k === 0 ? 5 : 3.4, k === 0 ? COL.ink : COL.vis, { ring: true, lw: 1.6, tip: () => `<b>keyframe ${k}</b>error vs truth: ${err(k).toFixed(2)} m<br>yaw error: ${deg(Math.atan2(Math.sin(X[k][3] - T[k][3]), Math.cos(X[k][3] - T[k][3]))).toFixed(1)}°` });
        if (reveal < N) st.drone(X[reveal - 1].slice(0, 3), m3.rz(X[reveal - 1][3]), COL.ink, 1.3);
        st.text(X[0].slice(0, 3), 'start (fixed)', COL.ink, { dx: -8, dy: 14, align: 'right', size: 9.5 });
        if (step >= 2) {
          const lastW = S.anim && S.anim.weights[Math.max(0, Math.min(S.anim.i, S.anim.weights.length - 1))];
          for (const e of GRAPH.loops) { const w = lastW?.[e.i + '-' + e.j] ?? 1; st.line(X[e.i].slice(0, 3), X[e.j].slice(0, 3), COL.ok, 2.2, { dash: [5, 3], alpha: .3 + .7 * w }); }
          if (step === 2) GRAPH.loops.forEach(e => st.text(v3.l(X[e.i].slice(0, 3), X[e.j].slice(0, 3), .5), 'loop: same place', COL.ok, { dx: 8, size: 9.5, bg: 'rgba(255,255,255,.85)' }));
          if (step === 4 && S.falseOn) { const e = GRAPH.falseLoop; const w = lastW?.[e.i + '-' + e.j] ?? 1; st.line(X[e.i].slice(0, 3), X[e.j].slice(0, 3), COL.lid, 2.4, { dash: [5, 3], alpha: .25 + .75 * w }); st.text(v3.l(X[e.i].slice(0, 3), X[e.j].slice(0, 3), .5), `false loop · weight ${w.toFixed(2)}`, COL.lid, { dx: 8, size: 9.5, bg: 'rgba(255,255,255,.85)' }); }
        }
        let se = 0, mx = 0; for (let k = 0; k < N; k++) { const e = err(k); se += e * e; mx = Math.max(mx, e); }
        const rows = [['keyframes (pose variables)', String(reveal)], ['odometry factors', String(Math.max(0, reveal - 1))]];
        if (step >= 2) rows.push(['loop factors', String(GRAPH.loops.length + (step === 4 && S.falseOn ? 1 : 0))]);
        rows.push(['RMS position error', (Math.sqrt(se / N)).toFixed(2) + ' m', Math.sqrt(se / N) > .5 ? COL.lid : COL.ok], ['worst keyframe error', mx.toFixed(2) + ' m'], ['yaw error at end', deg(Math.atan2(Math.sin(X[N - 1][3] - T[N - 1][3]), Math.cos(X[N - 1][3] - T[N - 1][3]))).toFixed(1) + '°']);
        if (S.anim) rows.push(['GN iteration', `${S.anim.i} / ${S.anim.states.length - 1}`]);
        if (step >= 1) rows.push(['unknowns solved jointly', `${4 * (N - 1)} (4 per keyframe)`]);
        S.ro(rows);
        st.flush();
      });
    }
  });
}

/* =====================================================================
   L5 · MAPS: what each family builds, and what a planner can use
   ===================================================================== */
const MAPSCENE = (() => {
  const room = { mn: [-4, -3, 0], mx: [4, 3, 2.8] };
  const objs = [{ mn: [.5, -1.3, 0], mx: [2.1, -.3, .75], col: '#b06000', name: 'table' }, { mn: [-3.9, .7, 0], mx: [-3.4, 2.8, 2], col: '#1a73e8', name: 'shelf' }, { mn: [-1.6, 1.8, 0], mx: [.8, 2.9, .8], col: '#9334e6', name: 'sofa' }, { mn: [2.6, 1.1, 0], mx: [3.1, 1.6, 2.8], col: '#5f6368', name: 'pillar' }];
  const posters = [{ wall: 'y+', x0: -2.5, x1: -1, z0: 1.1, z1: 2.1, col: '#d93025' }, { wall: 'y+', x0: 1.4, x1: 2.4, z0: 1.2, z1: 2.2, col: '#188038' }, { wall: 'x+', x0: -2, x1: -.5, z0: 1, z1: 2, col: '#e37400' }, { wall: 'y-', x0: -1, x1: .8, z0: 1.3, z1: 2.1, col: '#00838f' }];
  const tex = (p, n) => {
    for (const o of objs) if (p[0] >= o.mn[0] - .01 && p[0] <= o.mx[0] + .01 && p[1] >= o.mn[1] - .01 && p[1] <= o.mx[1] + .01 && p[2] <= o.mx[2] + .01) return o.col;
    if (n[2] === 1) return ((Math.floor(p[0] / .8) + Math.floor(p[1] / .8)) & 1) ? '#d9d4cc' : '#c4beb4';
    for (const q of posters) { const on = (q.wall === 'y+' && p[1] > 2.98 || q.wall === 'y-' && p[1] < -2.98) ? p[0] : (q.wall === 'x+' && p[0] > 3.98 ? p[1] : null); if (on != null && on >= q.x0 && on <= q.x1 && p[2] >= q.z0 && p[2] <= q.z1) return q.col; }
    return p[2] < .12 ? '#8e8e93' : '#e2e2e6';
  };
  const r = rng(33); const pts = [];
  const sampleRect = (o, u, v, n, dens) => { const A = v3.n(u) * v3.n(v), m = Math.round(A * dens); for (let i = 0; i < m; i++) { const p = v3.a(o, v3.a(v3.k(u, r()), v3.k(v, r()))); pts.push({ p, n, c: tex(p, n) }); } };
  const R = room;
  sampleRect([R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 6, 0], [0, 0, 1], 26);
  sampleRect([R.mn[0], R.mx[1], 0], [8, 0, 0], [0, 0, 2.8], [0, -1, 0], 26); sampleRect([R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 0, 2.8], [0, 1, 0], 26);
  sampleRect([R.mx[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.8], [-1, 0, 0], 26); sampleRect([R.mn[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.8], [1, 0, 0], 26);
  for (const o of objs) { const [x0, y0, z0] = o.mn, [x1, y1, z1] = o.mx; sampleRect([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, 1], 60); sampleRect([x0, y0, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, -1, 0], 60); sampleRect([x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, 1, 0], 60); sampleRect([x0, y0, z0], [0, y1 - y0, 0], [0, 0, z1 - z0], [-1, 0, 0], 60); sampleRect([x1, y0, z0], [0, y1 - y0, 0], [0, 0, z1 - z0], [1, 0, 0], 60); }
  // sparse landmarks: object corners, poster corners, a few textured points
  const sparse = [];
  for (const o of objs) for (const x of [o.mn[0], o.mx[0]]) for (const y of [o.mn[1], o.mx[1]]) sparse.push([x, y, o.mx[2]], [x, y, Math.min(.3, o.mx[2])]);
  for (const q of posters) for (const a of [q.x0, q.x1]) for (const z of [q.z0, q.z1]) sparse.push(q.wall === 'y+' ? [a, 3, z] : q.wall === 'y-' ? [a, -3, z] : [4, a, z]);
  pts.forEach((q, i) => { if (q.c !== '#e2e2e6' && q.c !== '#d9d4cc' && q.c !== '#c4beb4' && i % 23 === 0) sparse.push(q.p); });
  // voxels 0.25 m
  const VS = .25, vox = new Map();
  const voxRect = (o, u, v, n, inward) => { const nu = Math.ceil(v3.n(u) / .1), nv = Math.ceil(v3.n(v) / .1); for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) { const p = v3.a(v3.a(o, v3.a(v3.k(u, Math.min(a / nu, .999)), v3.k(v, Math.min(b / nv, .999)))), v3.k(n, inward ? .01 : -.01)); const k = p.map(x => Math.floor(x / VS)); const key = k.join(','); if (!vox.has(key)) vox.set(key, { k }); } };
  voxRect([R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 6, 0], [0, 0, 1], true);
  voxRect([R.mn[0], R.mx[1], 0], [8, 0, 0], [0, 0, 2.75], [0, -1, 0], true); voxRect([R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 0, 2.75], [0, 1, 0], true);
  voxRect([R.mx[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.75], [-1, 0, 0], true); voxRect([R.mn[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.75], [1, 0, 0], true);
  for (const o of objs) { const [x0, y0, z0] = o.mn, [x1, y1, z1] = o.mx; voxRect([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, 1]); voxRect([x0, y0, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, -1, 0]); voxRect([x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], [0, 1, 0]); voxRect([x0, y0, z0], [0, y1 - y0, 0], [0, 0, z1 - z0], [-1, 0, 0]); voxRect([x1, y0, z0], [0, y1 - y0, 0], [0, 0, z1 - z0], [1, 0, 0]); }
  const gs = pts.filter((_, i) => i % 3 === 0).map(q => { const t1 = v3.u(Math.abs(q.n[2]) > .9 ? [1, 0, 0] : v3.x(q.n, [0, 0, 1])); const t2 = v3.x(q.n, t1); const a = .1 + r() * .1, b = .08 + r() * .08; return { p: q.p, u: v3.k(t1, a), v: v3.k(t2, b), c: q.c }; });
  const kfs = [[-2.8, -2, 1.3, .6], [-1, -2.3, 1.4, 1.2], [1, -2.2, 1.3, 1.9], [3, -1.5, 1.4, 2.4]];
  const plan = [[-3.2, -2.3, 1], [-1.2, -1.8, 1.1], [.2, -.1, 1.3], [1.4, .7, 1.4], [2.1, 2.3, 1.3], [3.4, 2.5, 1.2]];
  return { room, objs, pts, sparse, vox, VS, gs, kfs, plan, tex };
})();
function labMaps() {
  const M = MAPSCENE;
  const MODES = [
    ['sparse', 'Sparse landmarks', 'What VIO keeps (VINS, OpenVINS, ORB-SLAM3): a few hundred <b>3D points at corners and texture</b>, plus keyframe poses (frustums). Ideal for localisation and loop closure, tiny in memory — but it says <em>nothing</em> about free space: a planner cannot tell a blank wall from an open doorway.'],
    ['cloud', 'LiDAR point cloud', 'What LIO keeps (FAST-LIO2 ikd-Tree, Faster-LIO iVox): dense metric geometry, colour = height. Excellent for scan-to-map registration and offline inspection; to fly through it, a planner first converts it to occupancy.'],
    ['rgb', 'Coloured point cloud', 'LiDAR geometry with camera colour attached (FAST-LIVO2, R3LIVE): the same points painted from images. Lets photometric residuals constrain degenerate geometry (L3) and gives a human-readable map for inspection or search-and-rescue reports.'],
    ['voxel', 'Occupancy voxels', 'What planners use (OctoMap, voxblox, EGO-Planner\'s grid): space split into cubes, each occupied / free / unknown (0.25 m here). The green path is a collision-free route through free voxels. Resolution trades memory for how tight a gap the drone can trust.'],
    ['mesh', 'Mesh', 'Surfaces as triangles (Kimera\'s mesh, TSDF/ESDF pipelines such as voxblox). Compact, renders fast, gives distances to the nearest surface — the ESDF that many drone trajectory optimisers query hundreds of times per plan.'],
    ['gauss', '3D Gaussians', 'Each surface patch is an oriented, semi-transparent ellipse with colour (MonoGS, Gaussian-splatting SLAM). Photorealistic novel views and dense, differentiable maps — but GPU-heavy and still research-grade for onboard drone use.'],
  ];
  return lessonCard({
    id: 'maps', num: 'L5', title: 'What the map looks like — and who can use it',
    q: 'Each family builds a different kind of map. Same room, six representations: which one can a planner fly through, and which one can a person read?',
    cap: '8 × 6 × 2.8 m room · sampled surfaces · memory figures are computed for this scene',
    steps: MODES.map(([k, t, p]) => ({ t, p })),
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.25, pitch: .72, dist: 13, target: [0, 0, .9], minDist: 3, maxDist: 40 });
      const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      animate(st, (st, dt) => {
        const mode = MODES[S.step][0]; st.begin(dt);
        st.box(M.room.mn, M.room.mx, null, { inside: true, stroke: '#c8c8ce', salpha: .9, skipTop: true });
        let rows = [];
        if (mode === 'sparse') {
          for (const p of M.sparse) { st.line(v3.a(p, [-.07, 0, 0]), v3.a(p, [.07, 0, 0]), COL.vis, 1.6); st.line(v3.a(p, [0, 0, -.07]), v3.a(p, [0, 0, .07]), COL.vis, 1.6); }
          M.kfs.forEach((k, i) => { const R = m3.mul(m3.rz(k[3] - Math.PI / 2 + .3), RFWD); const C = k.slice(0, 3); st.frustum(C, R, { depth: .5, col: COL.ink, lw: 1 }); if (i) st.line(M.kfs[i - 1].slice(0, 3), C, COL.ink, 1.4, { dash: [3, 3] }); });
          rows = [['landmarks', String(M.sparse.length)], ['memory (xyz float32)', (M.sparse.length * 12 / 1024).toFixed(1) + ' KB'], ['free space known?', 'no', COL.lid], ['localise / loop-close', 'yes', COL.ok]];
        }
        if (mode === 'cloud' || mode === 'rgb') {
          for (const q of M.pts) st.dot(q.p, 1.5, mode === 'rgb' ? q.c : ramp(q.p[2] / 2.8), { alpha: .9 });
          rows = [['points', M.pts.length.toLocaleString()], ['memory (xyz + intensity float32)', (M.pts.length * 16 / 1024).toFixed(0) + ' KB'], ['free space known?', 'only after ray-casting into occupancy', COL.warn], ['human-readable', mode === 'rgb' ? 'yes' : 'partly', mode === 'rgb' ? COL.ok : COL.warn]];
        }
        if (mode === 'voxel') {
          const VS = M.VS, eye = st.E.eye;
          for (const [key, v] of M.vox) {
            const [i, j, k] = v.k; const mn = [i * VS, j * VS, k * VS], mx = [mn[0] + VS, mn[1] + VS, mn[2] + VS]; const c = ramp((k * VS) / 2.8);
            dirs.forEach((d, fi) => {
              const nb = [i + d[0], j + d[1], k + d[2]].join(','); if (M.vox.has(nb)) return;
              const ctr = [mn[0] + VS / 2 + d[0] * VS / 2, mn[1] + VS / 2 + d[1] * VS / 2, mn[2] + VS / 2 + d[2] * VS / 2]; if (v3.d(d, v3.s(eye, ctr)) <= 0) return;
              const ax = d[0] ? [1, 2] : d[1] ? [0, 2] : [0, 1]; const q = (a, b) => { const p = ctr.slice(); p[ax[0]] += a * VS / 2; p[ax[1]] += b * VS / 2; return p; };
              st.face([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)], c[0] === '#' ? c : rgb2hex(c), { normal: d, alpha: .92, stroke: '#ffffff', lw: .5, salpha: .6 });
            });
          }
          st.path(M.plan, COL.ok, 3); st.arrow(M.plan[M.plan.length - 2], M.plan[M.plan.length - 1], COL.ok, 3); st.text(M.plan[0], 'planned path through free voxels', COL.ok, { dy: -12, size: 9.5, bg: 'rgba(255,255,255,.85)' });
          rows = [['occupied voxels (0.25 m)', String(M.vox.size)], ['dense grid for the room', `32 × 24 × 12 = 9,216 cells → 9.0 KB at 1 byte each`], ['free space known?', 'yes', COL.ok], ['plan collision-free paths', 'yes', COL.ok]];
        }
        if (mode === 'mesh') {
          const quad = (o, u, v, n, c, du, dv) => { const nu = Math.max(1, Math.round(v3.n(u) / du)), nv = Math.max(1, Math.round(v3.n(v) / dv)); for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) { const p00 = v3.a(o, v3.a(v3.k(u, a / nu), v3.k(v, b / nv))), p10 = v3.a(o, v3.a(v3.k(u, (a + 1) / nu), v3.k(v, b / nv))), p11 = v3.a(o, v3.a(v3.k(u, (a + 1) / nu), v3.k(v, (b + 1) / nv))), p01 = v3.a(o, v3.a(v3.k(u, a / nu), v3.k(v, (b + 1) / nv))); st.face([p00, p10, p11], c, { normal: n, stroke: '#ffffff', lw: .6, salpha: .9 }); st.face([p00, p11, p01], c, { normal: n, stroke: '#ffffff', lw: .6, salpha: .9 }); } };
          const eye = st.E.eye; const R = M.room; let tris = 0;
          const walls = [[[R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 6, 0], [0, 0, 1], '#cfc9bf'], [[R.mn[0], R.mx[1], 0], [8, 0, 0], [0, 0, 2.8], [0, -1, 0], '#e2e2e6'], [[R.mn[0], R.mn[1], 0], [8, 0, 0], [0, 0, 2.8], [0, 1, 0], '#e2e2e6'], [[R.mx[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.8], [-1, 0, 0], '#e2e2e6'], [[R.mn[0], R.mn[1], 0], [0, 6, 0], [0, 0, 2.8], [1, 0, 0], '#e2e2e6']];
          for (const [o, u, v, n, c] of walls) { const ctr = v3.a(o, v3.k(v3.a(u, v), .5)); if (v3.d(n, v3.s(eye, ctr)) <= 0) continue; quad(o, u, v, n, c, .8, .7); tris += 2 * Math.round(v3.n(u) / .8) * Math.round(v3.n(v) / .7); }
          for (const ob of M.objs) { st.box(ob.mn, ob.mx, ob.col, { stroke: '#ffffff', lw: .8, salpha: .9 }); tris += 10; }
          rows = [['triangles (this view)', String(tris)], ['distance-to-surface queries', 'fast (ESDF)', COL.ok], ['free space known?', 'yes (with TSDF/ESDF)', COL.ok], ['human-readable', 'yes', COL.ok]];
        }
        if (mode === 'gauss') {
          for (const g of M.gs) st.ellipseSplat(g.p, g.u, g.v, g.c, .5);
          rows = [['Gaussians', M.gs.length.toLocaleString()], ['floats each (3DGS, SH degree 3)', '59 = 3 pos + 3 scale + 4 rot + 1 opacity + 48 colour'], ['memory', ((M.gs.length * 59 * 4) / 1024).toFixed(0) + ' KB'], ['onboard drone use', 'research-grade, GPU-bound', COL.warn]];
        }
        S.ro(rows);
        st.flush();
      });
    }
  });
}
function rgb2hex(s) { const m = s.match(/\d+/g); return '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join(''); }

/* =====================================================================
   L6 · MULTI-DRONE: separate frames, inter-robot loops, alignment, UWB
   ===================================================================== */
const SWARM3 = (() => {
  const walls = [[0, 0, 30, 0], [30, 0, 30, 20], [30, 20, 0, 20], [0, 20, 0, 0], [10, 0, 10, 8], [10, 12, 10, 20], [20, 0, 20, 6], [20, 10, 20, 20], [0, 10, 6, 10], [24, 10, 30, 10]];
  const paths = [
    [[2, 2], [8, 2], [8, 9], [3, 12], [3, 18], [8, 18], [12, 10], [17, 9]],
    [[28, 2], [22, 3], [22, 8], [15, 9], [12, 4], [16, 2]],
    [[28, 18], [22, 18], [22, 12], [16, 10.1], [13, 15], [16, 18], [27, 13]],
  ];
  const cols = [COL.swm, COL.vis, COL.lrn], names = ['A', 'B', 'C'], alt = [1.3, 1.7, 2.1];
  const sample = (P) => { const out = []; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / .4); for (let k = 0; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]); } out.push(P[P.length - 1]); return out; };
  const tracks = paths.map(sample);
  const r = rng(8); const maps = tracks.map(() => []);
  walls.forEach(([x1, y1, x2, y2]) => { const L = Math.hypot(x2 - x1, y2 - y1); const n = Math.round(L * 7); for (let i = 0; i < n; i++) { const t = r(), x = lerp(x1, x2, t), y = lerp(y1, y2, t), z = r() * 3; tracks.forEach((tr, d) => { if (tr.some(q => Math.hypot(q[0] - x, q[1] - y) < 4.2)) maps[d].push([x, y, z]); }); } });
  // frame offsets: true transform of each drone's start frame in world (A = reference)
  const frames = tracks.map((tr, d) => ({ x: tr[0][0], y: tr[0][1], yaw: [0, 2.6, -1.9][d] }));
  // inter-robot matches: places both drones passed within 1.2 m
  const matches = [];
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { let best = null; tracks[a].forEach((p, i) => tracks[b].forEach((q, j) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < 1.6 && (!best || d < best.d)) best = { a, b, i, j, d }; })); if (best) matches.push(best); }
  const falseM = { a: 0, b: 2, i: Math.floor(tracks[0].length * .45), j: Math.floor(tracks[2].length * .2) };
  return { walls, tracks, maps, frames, matches, falseM, cols, names, alt };
})();
function labSwarm() {
  const W = SWARM3;
  return lessonCard({
    id: 'swarm', num: 'L6', title: 'Several drones, one map',
    q: 'Three drones each start with their own coordinate frame and no shared reference. How do they discover where the others are, merge their maps — and avoid being fooled?',
    cap: '30 × 20 m floor · three agents · frames aligned from inter-robot loop closures (schematic)',
    state: { u: 0 },
    steps: [
      { t: 'Three drones, three frames', p: 'Each drone runs its own VIO/LIO and measures everything relative to <b>where it took off</b> (axes at each start). Without GPS nobody knows how those frames relate, so drawing B\'s and C\'s maps in A\'s frame (identity guess) gives the overlapping mess you see.' },
      { t: 'Find the overlap', p: 'Agents exchange <b>compact place descriptors</b> instead of raw data. When B\'s descriptor matches something A saw (lines), a geometric check gives the relative pose between the two keyframes: an <b>inter-robot loop closure</b>. Bandwidth matters: a NetVLAD descriptor is 4096 floats = 16 KB, versus ~320 KB for one raw 20,000-point LiDAR frame.' },
      { t: 'Align the frames', p: 'Each inter-robot loop fixes one relative transform; a distributed pose-graph optimisation (D²SLAM, DOOR-SLAM, Kimera-Multi, Swarm-SLAM) solves all frames together. Watch the maps snap into one consistent building. Once aligned, any drone can plan into space another drone explored.' },
      { t: 'Reject the impostor', p: 'Corridors look alike. The red match is wrong: it is <b>inconsistent</b> with the other matches (they imply a different B→C transform). Pairwise Consistency Maximisation (PCM, Mangelson et al. ICRA 2018) keeps the largest set of mutually consistent loops and drops the rest — used by DOOR-SLAM, Kimera-Multi and Swarm-SLAM.' },
      { t: 'Range between drones', p: 'UWB radios give drone-to-drone <b>distances</b> (lines, metres) at tens of Hz, even without visual overlap. Omni-swarm and D²SLAM fuse these ranges with visual detections of the other drones, which keeps the relative frames bounded between loop closures — critical for formation flight and collision avoidance.' },
    ],
    onStep: (S, i) => { S.u = i >= 2 ? (i === 2 ? 0 : 1) : 0; },
    build: (stage, S) => {
      const st = view3d(stage, { aspect: .62, yaw: -2.0, pitch: .9, dist: 34, target: [15, 10, 0], minDist: 6, maxDist: 90 });
      S.add(ctlBtns(['Replay alignment', () => { S.u = 0; }]), [2]);
      const GE = [[0, 0, 0], [-9, 4, .9], [-6, -5, -.7]]; // initial guess error per frame: dx, dy, dyaw
      const tf = (d, u, p) => { const F = W.frames[d], g = GE[d], k = 1 - u; const c = Math.cos(g[2] * k), s = Math.sin(g[2] * k); const dx = p[0] - F.x, dy = p[1] - F.y; return [F.x + c * dx - s * dy + g[0] * k, F.y + s * dx + c * dy + g[1] * k, p[2]]; };
      const fyaw = (d, u) => W.frames[d].yaw + GE[d][2] * (1 - u);
      animate(st, (st, dt) => {
        const step = S.step; if (step === 2) S.u = Math.min(1, S.u + dt / 2.4);
        const u = step < 2 ? 0 : S.u; const e = u * u * (3 - 2 * u);
        st.begin(dt);
        st.grid(0, 30, 0, 20, 2, 0, '#ececf0');
        if (e > .95) for (const [x1, y1, x2, y2] of W.walls) st.face([[x1, y1, 0], [x2, y2, 0], [x2, y2, 3], [x1, y1, 3]], '#9aa0a6', { alpha: .05, stroke: '#c8c8ce', salpha: 3 });
        const pos = W.tracks.map((tr, d) => { const k = Math.floor((st.t * 6 + d * 40) % tr.length); return tr[k]; });
        for (let d = 0; d < 3; d++) {
          const col = W.cols[d];
          for (const p of W.maps[d]) st.dot(tf(d, e, p), 1.5, col, { alpha: .55 });
          st.path(W.tracks[d].map(q => tf(d, e, [q[0], q[1], W.alt[d]])), col, 2);
          const F = W.frames[d]; const o = tf(d, e, [F.x, F.y, 0]);
          st.axes(o, m3.rz(fyaw(d, e)), 1.4, { names: [`x${W.names[d]}`, `y${W.names[d]}`, 'z'], labels: true });
          st.text(o, `frame ${W.names[d]}`, col, { dx: -10, dy: 14, align: 'right', size: 10, weight: 700, bg: 'rgba(255,255,255,.85)' });
          const p = pos[d]; st.drone(tf(d, e, [p[0], p[1], W.alt[d]]), m3.I(), col, 1.6);
        }
        if (step >= 1) for (const m of W.matches) { const A = tf(m.a, e, [...W.tracks[m.a][m.i], W.alt[m.a]]), B = tf(m.b, e, [...W.tracks[m.b][m.j], W.alt[m.b]]); st.line(A, B, COL.ok, 2.4, { dash: [5, 3] }); st.dot(A, 4, COL.ok); st.dot(B, 4, COL.ok); if (step === 1) st.text(v3.l(A, B, .5), `${W.names[m.a]}↔${W.names[m.b]} match`, COL.ok, { dx: 8, size: 9.5, bg: 'rgba(255,255,255,.85)' }); }
        if (step === 3) { const m = W.falseM; const A = tf(m.a, e, [...W.tracks[m.a][m.i], W.alt[m.a]]), B = tf(m.b, e, [...W.tracks[m.b][m.j], W.alt[m.b]]); st.line(A, B, COL.lid, 2.4, { dash: [5, 3] }); st.text(v3.l(A, B, .5), '✗ rejected by PCM: inconsistent', COL.lid, { dx: 8, size: 9.5, bg: 'rgba(255,255,255,.85)' }); }
        const rows = [['agents', '3'], ['map points A / B / C', W.maps.map(m => m.length).join(' / ')]];
        if (step >= 1) rows.push(['inter-robot loops found', String(W.matches.length)], ['NetVLAD descriptor', '4096 × 4 B = 16 KB'], ['raw LiDAR frame', '20,000 pts × 16 B ≈ 320 KB']);
        if (step >= 2) rows.push(['alignment', (e * 100).toFixed(0) + ' %', e > .99 ? COL.ok : COL.warn]);
        if (step === 3) rows.push(['outliers rejected', '1 of ' + (W.matches.length + 1), COL.lid]);
        if (step === 4) {
          const P = pos.map((p, d) => [p[0], p[1], W.alt[d]]);
          for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { const d = v3.n(v3.s(P[a], P[b])); st.line(P[a], P[b], COL.spc, 1.4, { dash: [2, 3] }); st.text(v3.l(P[a], P[b], .5), d.toFixed(2) + ' m', COL.spc, { size: 9.5, align: 'center', bg: 'rgba(255,255,255,.85)' }); rows.push([`UWB range ${W.names[a]}–${W.names[b]}`, d.toFixed(2) + ' m', COL.spc]); }
        }
        S.ro(rows);
        st.flush();
      });
    }
  });
}

/* ---------------- section ---------------- */
const LAB_LESSONS = [['imu', 'L1 · IMU & drift'], ['cam', 'L2 · Cameras & BA'], ['lidar', 'L3 · LiDAR & degeneracy'], ['graph', 'L4 · Loop closure'], ['maps', 'L5 · Map types'], ['swarm', 'L6 · Multi-drone']];
function buildLab() {
  const sec = h('section', { id: 'lab', class: 'sec wrap' });
  sec.append(sectionHead('3d lab', 'L1–6', 'The core ideas, in 3D, one step at a time', 'Six interactive lessons that build the vocabulary used in every paper below: state and IMU drift, camera geometry, LiDAR degeneracy, factor graphs and loop closure, map types, and multi-drone SLAM. Each scene runs the real computation at small scale. <em>Drag to rotate, shift-drag to pan, +/− to zoom; use “Next step” to walk through.</em>'));
  sec.append(h('div', { class: 'filters' }, ...LAB_LESSONS.map(([id, t]) => h('a', { class: 'btn btn-sm btn-tonal', href: '#lab-' + id }, t))));
  sec.append(labIMU(), labCam(), labLidar(), labGraph(), labMaps(), labSwarm());
  return sec;
}
