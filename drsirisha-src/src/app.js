/* =====================================================================
   PAGE ASSEMBLY
   ===================================================================== */
const STATE = { cmp: new Set(['fast-livo2', 'fast-lio2', 'openvins', 'vins-fusion']), filter: 'all', fit: null };
const byId = (id) => METHODS.find(m => m.id === id);
const famOf = (m) => FAM[m.fam];
const lv = (n, max = 5, cls = '') => h('span', { class: 'lvl ' + cls }, ...Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'f' : '' })));
const linkChip = (txt, url) => h('a', { class: 'chip', href: url, target: '_blank', rel: 'noopener' }, txt, ' ↗');
const FAILKEYS = [
  ['dark', 'Low light / darkness'], ['tex', 'Low texture'], ['deg', 'Geometric degeneracy (corridor, tunnel)'], ['smoke', 'Smoke, dust, fog'],
  ['spin', 'Fast rotation / motion blur'], ['vib', 'Rotor vibration / IMU stress'], ['dyn', 'Moving objects'], ['drift', 'Long-range drift (no loop closure)']
];
const SCOREKEYS = [['acc', 'Accuracy'], ['eff', 'Onboard efficiency'], ['rob', 'Robustness'], ['map', 'Map usefulness'], ['glo', 'Global consistency'], ['rdy', 'Deployment readiness']];

/* ---------------- NAV ---------------- */
function buildNav() {
  const links = [['brief', 'Brief'], ['problem', 'Problem'], ['sensors', 'Sensors'], ['stack', 'Pipeline'], ['families', 'Families'], ['methods', 'Methods'], ['flight', 'Flight test'], ['bench', 'Benchmarks'], ['fit', 'Best fit'], ['build', 'Build'], ['datasets', 'Datasets'], ['roadmap', 'Roadmap'], ['sources', 'Sources']];
  const nav = h('nav', { class: 'nav' }, h('div', { class: 'wrap' },
    h('a', { class: 'brand', href: '#top' }, 'SLAM', h('b', {}, '/'), 'DRONES'),
    h('div', { class: 'nav-links' }, ...links.map(([id, t]) => h('a', { href: '#' + id, 'data-id': id }, t, id === 'flight' ? h('span', { class: 'nav-count', id: 'navCount' }, STATE.cmp.size) : null)))
  ));
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { $$('.nav-links a').forEach(a => a.classList.toggle('active', a.dataset.id === e.target.id)); } }, { rootMargin: '-45% 0px -50% 0px' });
  setTimeout(() => links.forEach(([id]) => { const s = document.getElementById(id); s && io.observe(s); }), 300);
  return nav;
}

/* ---------------- HERO / BRIEF ---------------- */
function buildHero() {
  const sec = h('section', { id: 'top', class: 'wrap' });
  sec.append(h('div', { class: 'mast' },
    h('div', {}, h('h6', {}, 'A research field guide'), h('p', {}, 'SLAM for multirotor drones', h('br'), 'in GPS-denied environments')),
    h('div', {}, h('h6', {}, 'Prepared for'), h('p', {}, 'Sirisha — PhD research,', h('br'), 'IIIT Sri City')),
    h('div', {}, h('h6', {}, 'Sources'), h('p', {}, 'Original papers, official repos,', h('br'), 'benchmark tables & vendor specs')),
    h('div', {}, h('h6', {}, 'Edition 01'), h('p', {}, 'November 2026', h('br'), 'Every number cited'))
  ));
  sec.append(h('div', { style: 'margin-top:34px' }, particleText('DRONE SLAM', { size: 300, weight: 800 })));
  const stage = h('div', { class: 'stage' });
  const fig = h('div', { class: 'figbox' }, stage, h('div', { class: 'figcap' }, h('span', {}, 'Live · one GPS-denied flight, three estimators'), h('span', {}, 'Fig. 00')));
  const right = h('div', {},
    h('h2', { class: 'big', html: 'No GPS. No beacons. <em>Just what the drone carries.</em> Every sensor fails somewhere — this guide shows where, which open systems survive it, and which fit your drone.' }),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, h('a', { class: 'btn btn-primary', href: '#fit' }, 'Find the best fit'), h('a', { class: 'btn btn-tonal', href: '#methods' }, 'Browse methods'), h('a', { class: 'btn btn-tonal', href: '#flight' }, 'Flight test')),
    h('div', { class: 'stats' }, ...[['Methods', METHODS.length], ['Families', 6], ['Datasets', DATASETS.length], ['References', SOURCES_COUNT()]].map(([k, v]) => h('div', { class: 'stat' }, h('span', {}, k), h('b', {}, String(v).padStart(2, '0')))))
  );
  sec.append(h('div', { class: 'hero' }, fig, right));
  requestAnimationFrame(() => {
    const st = missionView(stage, ['vio_stereo', 'lio', 'livo_loop'], { aspect: .62, names: ['Camera + IMU (VIO)', 'LiDAR + IMU (LIO)', 'LiDAR + camera + IMU, loop closure'] });
    const leg = h('div', { class: 'note' }, 'Grey dashes = true path. Coloured = what each estimator believes. The red dashed ellipse is LiDAR position uncertainty: it stretches along the corridor because the walls give no constraint along it. A schematic simulation driven by the sensing geometry, not recorded data. Click the strip to scrub.');
    fig.append(leg);
  });
  return sec;
}

function buildBrief() {
  const sec = h('section', { id: 'brief', class: 'sec wrap' });
  sec.append(sectionHead('brief', '00', 'What this guide is for', 'A drone in a building, mine, tunnel or under a forest canopy has <em>no satellite fix</em>. It must estimate its own 6-DoF pose, fast enough to fly on, from cameras, IMU, LiDAR and other onboard sensors. This page maps the open-source systems that do this, <em>what each needs</em>, and <em>where each breaks</em>.'));
  const g = h('div', { class: 'brief' },
    h('div', { class: 'card' }, h('h4', {}, '1 · Understand the problem'), h('p', {}, 'Why drones are harder than cars or handheld rigs: rate and latency for control, size–weight–power, vibration, and six failure conditions. Sections Problem → Sensors → Pipeline.')),
    h('div', { class: 'card' }, h('h4', {}, '2 · Know the field'), h('p', {}, 'Six families and their mechanisms, then each method with a live simulation, pros and cons, embedded runtime, licence, ROS support, drone deployments, paper and code. Sections Families → Methods → Benchmarks.')),
    h('div', { class: 'card' }, h('h4', {}, '3 · Choose and start'), h('p', {}, 'Run methods head-to-head in the same simulated flight, filter by your sensors and computer, pick a reference build and dataset, and use the research-gap list to scope a thesis. Sections Flight test → Best fit → Build → Roadmap.'))
  );
  sec.append(g);
  sec.append(h('div', { class: 'callout', style: 'margin-top:14px' }, h('b', {}, 'How numbers are sourced. '), 'Accuracy and runtime figures are quoted from the original paper tables or official repositories, with the table named. Ratings bars and the simulations are editorial and schematic, labelled as such. Hardware differs between papers, so compare runtimes only within the same table.'));
  return sec;
}

/* ---------------- PROBLEM ---------------- */
function buildProblem() {
  const sec = h('section', { id: 'problem', class: 'sec wrap' });
  sec.append(sectionHead('problem', '01', 'Why GPS-denied drones are a hard case', 'A ground robot can stop when lost. A multirotor cannot: it is <em>unstable without a state estimate</em>, carries little payload, vibrates, rotates fast, and often flies where light, texture and geometry all disappear.'));
  const cons = h('div', { class: 'grid g2' });
  const gaugeCard = h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 10px' }, 'What the flight stack demands of the estimator'),
    ...PROBLEM.demands.map(d => h('div', { class: 'gauge-row' }, h('span', {}, d.k), h('div', { class: 'bar' }, h('i', { style: { width: d.p + '%', background: COL.vis } })), h('span', { class: 'mono' }, d.v))),
    h('p', { class: 'note' }, PROBLEM.demandsNote));
  const whyCard = h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 10px' }, 'What makes drones different'), h('ul', { style: 'margin:0;padding-left:18px;font-size:14px' }, ...PROBLEM.why.map(w => h('li', { style: 'margin-bottom:7px', html: w }))));
  cons.append(gaugeCard, whyCard);
  sec.append(cons);
  sec.append(h('h3', { style: 'margin:44px 0 14px;font-size:22px' }, 'Where she might fly — and what fails there'));
  const envs = h('div', { class: 'grid g4' });
  for (const e of PROBLEM.envs) {
    const card = h('div', { class: 'card env' });
    const cv = h('div'); card.append(cv);
    card.append(h('h4', {}, e.name), h('p', {}, e.desc), h('div', { class: 'fails' }, ...e.tags.map(([t, s]) => h('span', { class: 'pill ' + s }, t))));
    envs.append(card); requestAnimationFrame(() => envThumb(cv, e.kind));
  }
  sec.append(envs);
  return sec;
}

/* ---------------- SENSORS ---------------- */
function buildSensors() {
  const sec = h('section', { id: 'sensors', class: 'sec wrap' });
  sec.append(sectionHead('sensors', '02', 'Sensors × conditions', 'Each modality sees the world through a different physical channel, so each <em>fails differently</em>. Robust drone SLAM is mostly about combining modalities whose failures do not overlap.'));
  const t = h('table', { class: 'heat' });
  t.append(h('thead', {}, h('tr', {}, h('th', {}, ''), ...SENSORS.conds.map(c => h('th', {}, c)))));
  const tb = h('tbody');
  const colr = (v) => v === 2 ? ['#e6f4ea', COL.ok, 'good'] : v === 1 ? ['#fff3df', COL.warn, 'partial'] : ['#fde8e6', COL.bad, 'fails'];
  for (const s of SENSORS.rows) {
    const tr = h('tr', {}, h('th', { class: 'rowh' }, s.name, h('small', {}, s.sub)));
    s.v.forEach((v, i) => { const [bg, fg, txt] = colr(v); const td = h('td', { style: { background: bg, color: fg } }, txt); bindTip(td, `<b>${s.name} · ${SENSORS.conds[i]}</b>${s.notes?.[i] || ''}`); tr.append(td); });
    tb.append(tr);
  }
  t.append(tb);
  sec.append(h('div', { class: 'card white scroll-x' }, t, h('p', { class: 'note' }, SENSORS.note)));
  // scan pattern sim
  const st = h('div', { class: 'stage' });
  sec.append(h('div', { class: 'grid g2', style: 'margin-top:14px' },
    h('div', { class: 'simbox' }, st, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, 'LiDAR scan patterns, unrolled (schematic)'), h('span', { class: 'live' }, h('i'), 'live'))),
    h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 8px' }, 'Why the LiDAR type matters on a drone'), ...SENSORS.lidarNotes.map(p => h('p', { style: 'font-size:14px;margin:0 0 10px', html: p })))));
  requestAnimationFrame(() => scanSim(st));
  // degraded modality sims
  const row = h('div', { class: 'grid g2', style: 'margin-top:14px' });
  for (const [fn, cap] of [[thermalSim, 'Thermal vs visible in smoke, with flat-field correction (schematic)'], [radarSim, 'Radar: Doppler ego-velocity from one scan, RANSAC rejects movers (schematic)'], [eventSim, 'Event camera vs frame camera during a fast flip and HDR exit (schematic)'], [uwbSim, 'UWB ranging: anchors bound drift; walls bias ranges (schematic)']]) {
    const s = h('div', { class: 'stage' }); row.append(h('div', { class: 'simbox' }, s, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, cap), h('span', { class: 'live' }, h('i'), 'live')))); requestAnimationFrame(() => fn(s));
  }
  sec.append(row);
  return sec;
}

/* ---------------- PIPELINE (autonomy stack) ---------------- */
function buildStack() {
  const sec = h('section', { id: 'stack', class: 'sec wrap' });
  sec.append(sectionHead('pipeline', '03', 'From photons to propellers', 'SLAM is one block in a loop that runs <em>hundreds of times a second</em>. Click any block to see what it does, what can go wrong, and the open tools used for it.'));
  const nodes = STACK.nodes;
  const wrap = h('div', { class: 'pipe-wrap' });
  const stage = h('div', { class: 'pipe-stage' });
  const info = h('div', { class: 'pipe-info' });
  wrap.append(stage, info); sec.append(wrap);
  let sel = 'estimator';
  const show = () => { const n = nodes.find(x => x.id === sel); info.innerHTML = ''; info.append(h('div', {}, h('h4', {}, n.name), h('p', { html: n.desc })), h('div', {}, h('h4', { style: 'font-size:13px;color:var(--mute);font-weight:500' }, 'Tools & pitfalls'), h('ul', { style: 'margin:4px 0 0;padding-left:18px;font-size:13.5px' }, ...n.tips.map(t => h('li', { html: t, style: 'margin-bottom:5px' }))))); };
  const st = makeCanvas(stage, .3, 240, 340);
  const pos = () => { const W = st.w, H = st.h; return nodes.map((n) => ({ ...n, x: n.gx * W, y: n.gy * H })); };
  st.c.style.cursor = 'pointer';
  st.c.addEventListener('click', (e) => { const r = st.c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; for (const n of pos()) if (Math.abs(x - n.x) < 70 && Math.abs(y - n.y) < 22) { sel = n.id; show(); } });
  animate(st, (st) => {
    const { ctx, w, h: H } = st; ctx.clearRect(0, 0, w, H); const P = pos();
    for (const [a, b, lab] of STACK.edges) {
      const A = P.find(n => n.id === a), B = P.find(n => n.id === b);
      ctx.strokeStyle = COL.hair; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      const ph = (st.t * .6 + (a.length % 5) * .17) % 1; ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.arc(lerp(A.x, B.x, ph), lerp(A.y, B.y, ph), 3, 0, TAU); ctx.fill();
      if (lab) label(ctx, lab, (A.x + B.x) / 2 + 4, (A.y + B.y) / 2 - 6, COL.mute, 'left', 9.5);
    }
    for (const n of P) {
      const on = n.id === sel; ctx.font = '600 12px Archivo, sans-serif'; const tw = ctx.measureText(n.name).width + 26;
      ctx.fillStyle = on ? COL.ink : '#fff'; ctx.strokeStyle = on ? COL.ink : COL.hair; ctx.lineWidth = 1.5; rrect(ctx, n.x - tw / 2, n.y - 17, tw, 34, 17); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? '#fff' : COL.ink; ctx.textAlign = 'center'; ctx.fillText(n.name, n.x, n.y + 4); ctx.textAlign = 'left';
      if (n.rate) label(ctx, n.rate, n.x, n.y + 31, COL.mute, 'center', 9.5);
    }
  });
  show();
  return sec;
}

/* ---------------- FAMILIES ---------------- */
function buildFamilies() {
  const sec = h('section', { id: 'families', class: 'sec wrap' });
  sec.append(sectionHead('families', 'A–F', 'Six families by sensor and estimator', 'Systems split first by <em>what they sense</em>, then by <em>how they estimate</em>: a filter that keeps one state, a sliding window that re-optimises recent frames, or a growing factor graph. The animations show each structure.'));
  const g = h('div', { class: 'grid g2' });
  FAMILIES.forEach((f, i) => {
    const st = h('div', { class: 'stage' });
    const ms = METHODS.filter(m => m.fam === f.fam);
    const card = h('div', { class: 'card ' + FAM[f.fam].cls },
      h('div', { style: 'display:flex;align-items:baseline;gap:12px' }, h('span', { style: 'font-size:46px;font-weight:200;color:var(--fc);line-height:1' }, 'ABCDEF'[i]), h('h3', { style: 'margin:0;font-size:22px' }, f.name)),
      h('p', { style: 'font-size:14px;color:var(--mute);margin:8px 0 12px', html: f.desc }),
      h('div', { class: 'simbox', style: 'padding:8px;background:#fff' }, st),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px' }, ...ms.map(m => h('button', { class: 'tag', onclick: () => openDetail(m.id) }, m.name))));
    g.append(card);
    requestAnimationFrame(() => f.sim(st));
  });
  sec.append(g);
  return sec;
}

/* ---------------- METHODS GRID ---------------- */
function methodCard(m) {
  const F = famOf(m);
  const fit = STATE.fit?.[m.id];
  const card = h('article', { class: 'mcard ' + F.cls, onclick: (e) => { if (e.target.closest('.cmp-btn')) return; openDetail(m.id); } },
    h('div', { class: 'top' }, h('span', { class: 'mono' }, String(METHODS.indexOf(m) + 1).padStart(2, '0')), h('span', { class: 'tag' }, F.short), h('span', { class: 'yr' }, m.year)),
    h('h3', {}, m.name), h('div', { class: 'sens' }, m.sensors),
    h('div', { class: 'hook' }, m.hook),
    h('div', { class: 'bot' }, h('span', { class: 'minibars' }, ...SCOREKEYS.map(([k]) => h('i', { style: { height: (4 + m.scores[k] * 2.4) + 'px', background: 'var(--fc)' } }))), h('span', { class: 'kind' }, m.kind),
      h('button', { class: 'cmp-btn' + (STATE.cmp.has(m.id) ? ' on' : ''), onclick: (e) => { toggleCmp(m.id); e.target.classList.toggle('on', STATE.cmp.has(m.id)); e.target.textContent = STATE.cmp.has(m.id) ? '✓ In flight test' : '+ Flight test'; } }, STATE.cmp.has(m.id) ? '✓ In flight test' : '+ Flight test')));
  if (fit != null) card.append(h('span', { class: 'fit fitbadge ' + (fit >= 70 ? 'hi' : fit >= 45 ? 'mid' : '') }, `fit ${fit}`));
  return card;
}
function buildMethods() {
  const sec = h('section', { id: 'methods', class: 'sec wrap' });
  sec.append(sectionHead('methods', String(METHODS.length), 'Open-source systems, each with a live simulation', `${METHODS.length} open systems relevant to GPS-denied drones. Bars on each card are editorial ratings for accuracy, onboard efficiency, robustness, map usefulness, global consistency and deployment readiness. <em>Open any card for the full profile.</em>`));
  const filters = h('div', { class: 'filters' });
  const grid = h('div', { class: 'mcards' });
  const render = () => {
    grid.innerHTML = '';
    let ms = METHODS.filter(m => STATE.filter === 'all' || m.fam === STATE.filter);
    if (STATE.fit) ms = [...ms].sort((a, b) => (STATE.fit[b.id] || 0) - (STATE.fit[a.id] || 0));
    ms.forEach(m => grid.append(methodCard(m)));
  };
  const opts = [['all', 'All', METHODS.length], ...Object.entries(FAM).map(([k, f]) => [k, f.short, METHODS.filter(m => m.fam === k).length])];
  opts.forEach(([k, t, n]) => filters.append(h('button', { class: 'btn btn-sm btn-tonal' + (STATE.filter === k ? ' on' : ''), onclick: (e) => { STATE.filter = k; $$('.btn', filters).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); render(); } }, t, h('small', {}, ' ' + n))));
  sec.append(filters, grid);
  render(); STATE.renderMethods = render;
  return sec;
}

/* ---------------- DETAIL OVERLAY ---------------- */
const detail = h('div', { class: 'detail', role: 'dialog', 'aria-modal': 'true' });
function openDetail(id, push = true) {
  const m = byId(id); if (!m) return;
  const F = famOf(m); const idx = METHODS.indexOf(m);
  detail.innerHTML = ''; detail.className = 'detail ' + F.cls;
  const prev = METHODS[(idx - 1 + METHODS.length) % METHODS.length], next = METHODS[(idx + 1) % METHODS.length];
  detail.append(h('div', { class: 'dbar' }, h('div', { class: 'wrap' },
    h('button', { class: 'btn btn-sm btn-tonal', onclick: closeDetail }, '← All methods'), h('span', { class: 'sp' }),
    h('span', { class: 'mono mute' }, `${String(idx + 1).padStart(2, '0')} / ${METHODS.length}`),
    h('button', { class: 'btn btn-sm btn-tonal', onclick: () => openDetail(prev.id) }, '‹ ' + prev.name), h('button', { class: 'btn btn-sm btn-tonal', onclick: () => openDetail(next.id) }, next.name + ' ›'),
    h('button', { class: 'btn btn-sm ' + (STATE.cmp.has(m.id) ? 'btn-primary' : 'btn-tonal'), onclick: (e) => { toggleCmp(m.id); e.currentTarget.className = 'btn btn-sm ' + (STATE.cmp.has(m.id) ? 'btn-primary' : 'btn-tonal'); e.currentTarget.textContent = STATE.cmp.has(m.id) ? '✓ In flight test' : '+ Flight test'; } }, STATE.cmp.has(m.id) ? '✓ In flight test' : '+ Flight test'))));
  const W = h('div', { class: 'wrap', style: 'padding-bottom:100px' });
  W.append(h('div', { class: 'dhead' },
    h('div', { class: 'meta' }, h('span', {}, String(idx + 1).padStart(2, '0')), h('span', { class: 'tag' }, F.label), h('span', {}, `${m.venue} ${m.year}`), m.license && !/^see/.test(m.license) ? h('span', {}, '· ' + m.license) : null),
    h('div', { class: 'ptitle' }, particleText(m.name, { size: 200, weight: 800 })),
    h('div', { class: 'ttl' }, m.title), h('div', { class: 'auth' }, m.authors + (m.lab ? ' · ' + m.lab : '')),
    h('div', { class: 'specs' }, ...[['Sensors', m.sensorsFull || m.sensors], ['Core formulation', m.core], ['Estimator', m.opt], ['Map', m.map], ['Loop closure', m.loop], ['Compute · ROS', `${m.compute} · ${m.ros}`]].map(([k, v]) => h('div', {}, h('span', {}, k), v)))));
  // fit to brief
  W.append(h('div', { class: 'callout', style: 'margin-top:18px' }, h('b', {}, 'For a GPS-denied drone: '), h('span', { html: m.verdict })));
  // simulation
  const simSec = h('div', { class: 'dsec' }, h('h3', { class: 'h' }, 'flight simulation', h('span', { class: 'us' }, '_')));
  const ms = h('div', { class: 'stage' });
  simSec.append(h('div', { class: 'simbox' }, ms, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, `${EST[m.est].name} profile vs ground truth · schematic`), h('span', { class: 'live' }, h('i'), 'live'))));
  simSec.append(h('p', { class: 'note' }, m.simNote || 'The same flight as the hero: textured lab, a fast yaw spin, a long corridor, a low-light hall, a smoky rack aisle, then back to the start. The error model is driven by what this sensor set can observe at each moment; it illustrates failure modes and is not a reproduction of the paper\'s numbers.'));
  W.append(simSec);
  requestAnimationFrame(() => { const s = missionView(ms, [m.est], { aspect: .5, stripes: m.est === 'lio_intensity', thermal: m.est === 'tio' || m.est === 'multi', names: [m.name] }); });
  // mechanism
  if (m.mech) {
    const mech = h('div', { class: 'stage' });
    W.append(h('div', { class: 'dsec' }, h('h3', { class: 'h' }, 'mechanism', h('span', { class: 'us' }, '_')),
      h('div', { class: 'simbox' }, mech, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, m.mechCap || 'estimator structure · schematic'), h('span', { class: 'live' }, h('i'), 'live'))),
      h('div', { class: 'mech', style: 'margin-top:14px' }, ...m.how.map(([t, p]) => h('div', { class: 'card' }, h('h5', {}, t), h('p', { html: p }))))));
    requestAnimationFrame(() => m.mech(mech));
  }
  // profile
  const radar = h('div', { class: 'stage', style: 'background:#fff;border-radius:16px' });
  const fmEl = h('div', { class: 'card white' }, h('h4', { style: 'margin:0 0 6px' }, 'Failure conditions'), ...FAILKEYS.map(([k, t]) => { const v = m.fails[k]; return h('div', { class: 'fm' }, h('div', {}, t, m.failNotes?.[k] ? h('small', {}, m.failNotes[k]) : null), h('span', { class: 'sev ' + (v === 2 ? 'h' : v === 1 ? 'm' : 'l') }, v === 2 ? 'fails' : v === 1 ? 'degrades' : 'robust')); }));
  W.append(h('div', { class: 'dsec' }, h('h3', { class: 'h' }, 'profile', h('span', { class: 'us' }, '_')),
    h('div', { class: 'prof' }, h('div', { class: 'card' }, radar, h('p', { class: 'note' }, 'Editorial ratings (1–5) relative to the other systems on this page.')), fmEl)));
  requestAnimationFrame(() => radarChart(radar, [m]));
  // pros cons
  W.append(h('div', { class: 'dsec' }, h('div', { class: 'pc' },
    h('div', {}, h('h3', { class: 'h' }, 'pros', h('span', { class: 'us' }, '_')), h('ul', { class: 'pros' }, ...m.pros.map(p => h('li', { html: p })))),
    h('div', {}, h('h3', { class: 'h' }, 'cons', h('span', { class: 'us' }, '_')), h('ul', { class: 'cons' }, ...m.cons.map(p => h('li', { html: p })))))));
  // efficiency facts
  W.append(h('div', { class: 'dsec' }, h('h3', { class: 'h' }, 'numbers', h('span', { class: 'us' }, '_')),
    h('div', { class: 'kv' }, ...m.facts.map(([v, d, src]) => h('div', { class: 'card' }, h('span', {}, d), h('p', { style: 'font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.1' }, v), src ? h('p', { class: 'note', style: 'margin-top:8px' }, 'Source: ', h('a', { href: src[1], target: '_blank' }, src[0])) : null)))));
  // drone use
  W.append(h('div', { class: 'dsec' }, h('h3', { class: 'h' }, 'on a drone', h('span', { class: 'us' }, '_')),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 8px' }, 'Flight evidence in the paper'), ...m.drone.map(d => h('p', { style: 'font-size:14px;margin:0 0 10px', html: d }))),
      h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 8px' }, 'Getting it running'), ...m.setup.map(d => h('p', { style: 'font-size:14px;margin:0 0 10px', html: d }))))));
  // papers
  W.append(h('div', { class: 'dsec papers' }, h('h3', { class: 'h' }, 'papers & code', h('span', { class: 'us' }, '_')),
    ...m.papers.map(p => h('div', { class: 's' }, h('b', {}, p.t), h('div', { class: 'mute', style: 'font-size:13px' }, p.v), h('div', { class: 'links' }, ...p.links.map(([t, u]) => linkChip(t, u))))),
    h('div', { class: 's' }, h('b', {}, 'Official code'), h('div', { class: 'mute', style: 'font-size:13px' }, m.codeNote || ''), h('div', { class: 'links' }, linkChip(m.code.replace('https://github.com/', 'github.com/'), m.code)))));
  detail.append(W);
  detail.scrollTop = 0;
  detail.classList.add('on'); document.body.classList.add('lock');
  if (push && location.hash !== '#m-' + id) { STATE.skipHash = true; location.hash = 'm-' + id; }
}
function closeDetail(push = true) { detail.classList.remove('on'); document.body.classList.remove('lock'); setTimeout(() => { if (!detail.classList.contains('on')) detail.innerHTML = ''; }, 250); if (push && location.hash.startsWith('#m-')) { STATE.skipHash = true; location.hash = 'methods'; } }
window.addEventListener('hashchange', () => { if (STATE.skipHash) { STATE.skipHash = false; return; } const m = location.hash.match(/^#m-(.+)$/); if (m && byId(m[1])) openDetail(m[1], false); else if (detail.classList.contains('on')) closeDetail(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && detail.classList.contains('on')) closeDetail(); });

/* ---------------- RADAR CHART ---------------- */
function radarChart(parent, ms) {
  const st = makeCanvas(parent, .9, 260, 380);
  const draw = () => {
    const { ctx, w, h: H } = st; ctx.clearRect(0, 0, w, H);
    const cx = w / 2, cy = H / 2 + 6, R = Math.min(w, H) * .34; const n = SCOREKEYS.length;
    ctx.strokeStyle = COL.hair; ctx.lineWidth = 1;
    for (let r = 1; r <= 5; r++) { ctx.beginPath(); for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * TAU; const x = cx + Math.cos(a) * R * r / 5, y = cy + Math.sin(a) * R * r / 5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    SCOREKEYS.forEach(([k, t], i) => { const a = -Math.PI / 2 + i / n * TAU; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); label(ctx, t, cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14) + 4, COL.mute, Math.abs(Math.cos(a)) < .2 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right', 10); });
    ms.forEach((m, j) => { const col = ms.length === 1 ? famOf(m).col : CMPCOLS[j % CMPCOLS.length]; ctx.beginPath(); SCOREKEYS.forEach(([k], i) => { const a = -Math.PI / 2 + i / n * TAU; const v = m.scores[k] / 5 * R; i ? ctx.lineTo(cx + Math.cos(a) * v, cy + Math.sin(a) * v) : ctx.moveTo(cx + Math.cos(a) * v, cy + Math.sin(a) * v); }); ctx.closePath(); ctx.fillStyle = hexA(col, .12); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); });
  };
  st.onresize = draw; draw();
  return st;
}
const CMPCOLS = [COL.vis, COL.lid, COL.fus, COL.spc, COL.lrn, COL.swm];

/* ---------------- FLIGHT TEST (compare) ---------------- */
function toggleCmp(id) {
  if (STATE.cmp.has(id)) STATE.cmp.delete(id); else { if (STATE.cmp.size >= 6) { const f = STATE.cmp.values().next().value; STATE.cmp.delete(f); } STATE.cmp.add(id); }
  const n = $('#navCount'); if (n) n.textContent = STATE.cmp.size;
  STATE.renderCmp && STATE.renderCmp();
}
function buildFlight() {
  const sec = h('section', { id: 'flight', class: 'sec wrap' });
  sec.append(sectionHead('flight test', '04', 'Same flight, side by side', 'Pick up to six systems (from any card, or the chips below). All of them fly the <em>same simulated mission</em>; the strip shows error over time with each hazard shaded. Below: profiles, specifications and failure modes in one place.'));
  const chips = h('div', { class: 'filters' });
  const box = h('div');
  sec.append(chips, box);
  const render = () => {
    chips.innerHTML = '';
    METHODS.forEach(m => chips.append(h('button', { class: 'btn btn-sm btn-tonal' + (STATE.cmp.has(m.id) ? ' on' : ''), onclick: () => { toggleCmp(m.id); } }, m.name)));
    box.innerHTML = '';
    const ms = [...STATE.cmp].map(byId).filter(Boolean);
    if (!ms.length) { box.append(h('p', { class: 'mute' }, 'Select at least one method.')); return; }
    const stage = h('div', { class: 'stage' });
    box.append(h('div', { class: 'simbox' }, stage, h('div', { class: 'simbar' }, h('span', { class: 'mono' }, 'Mission replay · each line is one estimator · schematic error model'), h('span', { class: 'live' }, h('i'), 'live'))));
    requestAnimationFrame(() => missionView(stage, ms.map(m => m.est), { aspect: .56, colors: ms.map((m, i) => CMPCOLS[i]), names: ms.map(m => m.name), layers: { rays: false, cone: false, ellipse: false } }));
    const rd = h('div', { class: 'stage', style: 'background:#fff;border-radius:16px' });
    const t = h('table', { class: 'tbl' });
    t.append(h('thead', {}, h('tr', {}, h('th', {}, ''), ...ms.map((m, i) => h('th', {}, h('span', { class: 'dot', style: { background: CMPCOLS[i] } }), m.name)))));
    const rows = [['Family', m => famOf(m).label], ['Sensors', m => m.sensors], ['Estimator', m => m.opt], ['Loop closure', m => m.loop], ['Map', m => m.map], ['Compute', m => m.compute], ['ROS', m => m.ros], ['Licence', m => m.license], ['Year', m => `${m.venue} ${m.year}`]];
    const tb = h('tbody'); rows.forEach(([k, f]) => tb.append(h('tr', {}, h('td', { class: 'k' }, k), ...ms.map(m => h('td', {}, f(m))))));
    FAILKEYS.forEach(([k, tt]) => tb.append(h('tr', {}, h('td', { class: 'k' }, tt), ...ms.map(m => { const v = m.fails[k]; return h('td', {}, h('span', { class: 'sev ' + (v === 2 ? 'h' : v === 1 ? 'm' : 'l'), style: 'display:inline-block;padding:3px 10px' }, v === 2 ? 'fails' : v === 1 ? 'degrades' : 'robust')); }))));
    t.append(tb);
    box.append(h('div', { class: 'cmp-grid', style: 'margin-top:14px' }, h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 8px' }, 'Profile'), rd), h('div', { class: 'card white scroll-x' }, t)));
    requestAnimationFrame(() => radarChart(rd, ms));
  };
  STATE.renderCmp = render; render();
  return sec;
}

/* ---------------- BENCHMARKS ---------------- */
function barChart(parent, rows, o) {
  const st = makeCanvas(parent, o.aspect || .5, o.minH || 260, o.maxH || 560);
  const hover = { i: -1 };
  const draw = () => {
    const { ctx, w, h: H } = st; ctx.clearRect(0, 0, w, H);
    const lw = Math.min(250, w * .36), x0 = lw + 10, x1 = w - 50; const rh = (H - 34) / rows.length;
    const max = o.max || Math.max(...rows.map(r => r.v || 0)) * 1.05;
    ctx.strokeStyle = COL.hair; (o.ticks || []).forEach(t => { const x = x0 + t / max * (x1 - x0); ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H - 26); ctx.stroke(); label(ctx, String(t), x, H - 10, COL.mute, 'center', 9.5); });
    rows.forEach((r, i) => {
      const y = 6 + i * rh, bh = Math.min(18, rh * .62);
      ctx.font = `${r.bold ? 700 : 500} 12px Archivo, sans-serif`; ctx.fillStyle = r.fail ? COL.mute : COL.ink; ctx.textAlign = 'right'; ctx.fillText(r.label, lw, y + rh / 2 + 4, lw - 4); ctx.textAlign = 'left';
      if (r.fail) { label(ctx, r.failTxt || '✗ failed / diverged', x0 + 4, y + rh / 2 + 4, COL.bad, 'left', 10.5, 700); return; }
      const bw = Math.min(1, r.v / max) * (x1 - x0);
      ctx.fillStyle = hover.i === i ? COL.ink : (r.col || COL.vis); rrect(ctx, x0, y + (rh - bh) / 2, Math.max(2, bw), bh, 4); ctx.fill();
      label(ctx, (r.v >= max ? '>' : '') + r.v.toFixed(o.dp ?? 3) + (r.note ? ' ' + r.note : ''), x0 + bw + 6, y + rh / 2 + 4, COL.ink, 'left', 10.5, 600);
    });
    label(ctx, o.unit || '', x1, H - 10, COL.mute, 'right', 9.5);
  };
  st.onresize = draw; draw();
  st.c.addEventListener('mousemove', (e) => { const r = st.c.getBoundingClientRect(); const i = Math.floor((e.clientY - r.top - 6) / ((st.h - 34) / rows.length)); if (i !== hover.i) { hover.i = i; draw(); } if (rows[i]?.tip) showTip(rows[i].tip, e.clientX, e.clientY); else hideTip(); });
  st.c.addEventListener('mouseleave', () => { hover.i = -1; draw(); hideTip(); });
  return st;
}
function heatTable(data) {
  const t = h('table', { class: 'heat' });
  t.append(h('thead', {}, h('tr', {}, h('th', {}, ''), ...data.cols.map(c => h('th', {}, c)))));
  const tb = h('tbody');
  const all = data.rows.flatMap(r => r.v.filter(v => typeof v === 'number'));
  const lo = Math.min(...all), hi = Math.max(...all);
  for (const r of data.rows) {
    const tr = h('tr', {}, h('th', { class: 'rowh' }, r.name, r.sub ? h('small', {}, r.sub) : null));
    r.v.forEach((v, i) => {
      if (typeof v !== 'number') { tr.append(h('td', { style: { background: v === 'x' ? '#fde8e6' : COL.soft, color: v === 'x' ? COL.bad : COL.mute } }, v === 'x' ? '✗' : '–')); return; }
      if (data.cols[i] === 'avg') { tr.append(h('td', { style: { background: '#fff', border: '1.5px solid ' + COL.ink, fontWeight: 700 } }, v.toFixed(data.dp ?? 2))); return; }
      const q = data.log ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (v - lo) / (hi - lo);
      const bg = `hsl(${140 - q * 140}, ${55}%, ${92 - q * 22}%)`;
      const td = h('td', { style: { background: bg } }, v.toFixed(data.dp ?? 2)); tr.append(td);
    });
    tb.append(tr);
  }
  t.append(tb);
  return t;
}
function buildBench() {
  const sec = h('section', { id: 'bench', class: 'sec wrap' });
  sec.append(sectionHead('benchmarks', String(BENCH.length).padStart(2, '0'), 'Numbers exactly as published', 'Every chart is one table from one paper, so methods inside a chart were run under the same protocol. Do not compare numbers <em>across</em> charts: hardware, alignment and datasets differ.'));
  for (const b of BENCH) {
    const card = h('div', { class: 'chart-card', style: 'margin-bottom:14px' });
    card.append(h('h4', {}, b.title), h('p', { class: 'cap', html: b.cap }));
    const plot = h('div', { class: 'plot' });
    if (b.type === 'bars') {
      if (b.views) {
        const seg = h('div', { class: 'seg', style: 'margin-bottom:10px' });
        let cur = 0; const holder = h('div');
        const draw = () => { holder.innerHTML = ''; const v = b.views[cur]; const box = h('div'); holder.append(box); barChart(box, v.rows, v.opts); };
        b.views.forEach((v, i) => seg.append(h('button', { class: i === 0 ? 'on' : '', onclick: (e) => { cur = i; $$('button', seg).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); draw(); } }, v.name)));
        card.append(seg); plot.append(holder); card.append(plot); requestAnimationFrame(draw);
      } else { card.append(plot); requestAnimationFrame(() => barChart(plot, b.rows, b.opts)); }
    } else if (b.type === 'heat') {
      plot.classList.add('scroll-x');
      if (b.views.length > 1) {
        const seg = h('div', { class: 'seg', style: 'margin-bottom:10px' });
        const draw = (i) => { plot.innerHTML = ''; plot.append(heatTable(b.views[i])); };
        b.views.forEach((v, i) => seg.append(h('button', { class: i === 0 ? 'on' : '', onclick: (e) => { $$('button', seg).forEach(x => x.classList.remove('on')); e.currentTarget.classList.add('on'); draw(i); } }, v.name)));
        card.append(seg); draw(0);
      } else plot.append(heatTable(b.views[0]));
      card.append(plot);
    }
    card.append(h('p', { class: 'src', html: `${b.note ? b.note + ' ' : ''}Source: <a href="${b.url}" target="_blank">${b.source}</a>` }));
    sec.append(reveal(card));
  }
  return sec;
}

/* ---------------- BEST FIT configurator ---------------- */
function buildFit() {
  const sec = h('section', { id: 'fit', class: 'sec wrap' });
  sec.append(sectionHead('best fit', '06', 'Which systems fit her drone?', 'Answer five questions about the platform and mission. Systems that need a sensor or GPU she lacks are excluded; the rest are scored on the conditions she expects, onboard cost and maturity. <em>The method cards above re-sort by fit too.</em>'));
  const Q = FITQ; const ans = Object.fromEntries(Q.map(q => [q.id, new Set(q.def)]));
  const left = h('div', { class: 'card' }); const right = h('div', { class: 'rank' });
  Q.forEach(q => {
    const opts = h('div', { class: 'opts' });
    q.opts.forEach(([k, t]) => { const b = h('button', { class: 'opt' + (ans[q.id].has(k) ? ' on' : '') }, t); b.onclick = () => { if (q.multi) { ans[q.id].has(k) ? ans[q.id].delete(k) : ans[q.id].add(k); } else { ans[q.id] = new Set([k]); $$('.opt', opts).forEach(x => x.classList.remove('on')); } b.classList.toggle('on', ans[q.id].has(k)); run(); }; opts.append(b); });
    left.append(h('div', { class: 'q' }, h('h5', {}, q.q), opts, q.hint ? h('div', { class: 'note', style: 'margin-top:4px' }, q.hint) : null));
  });
  const summary = h('div', { class: 'callout', style: 'margin-bottom:10px' });
  const run = () => {
    const res = METHODS.map(m => ({ m, ...fitScore(m, ans) })).sort((a, b) => (b.ok - a.ok) || (b.s - a.s));
    STATE.fit = Object.fromEntries(res.map(r => [r.m.id, r.ok ? r.s : 0]));
    right.innerHTML = ''; right.append(summary);
    const top = res.filter(r => r.ok).slice(0, 3);
    summary.innerHTML = top.length ? `<b>Start here: ${top.map(r => r.m.name).join(', ')}.</b> ${fitAdvice(ans, top)}` : '<b>No system matches every requirement.</b> Relax the sensor or compute choices.';
    res.forEach((r, i) => {
      const el = h('div', { class: 'rk ' + famOf(r.m).cls + (r.ok ? '' : ' excluded'), onclick: () => openDetail(r.m.id) },
        h('span', { class: 'n' }, String(i + 1).padStart(2, '0')),
        h('div', {}, h('h5', {}, r.m.name, ' ', h('span', { class: 'tag', style: 'height:20px;font-size:10.5px;margin-left:6px' }, famOf(r.m).short)), h('p', {}, r.m.hook), h('div', { class: 'why' }, ...r.why.map(([t, c]) => h('span', { class: c }, t)))),
        h('div', {}, h('div', { class: 'sc' }, r.ok ? `${r.s} / 100` : 'excluded'), h('div', { class: 'score' }, h('i', { style: { width: (r.ok ? r.s : 0) + '%', background: famOf(r.m).col } }))));
      right.append(el);
    });
    STATE.renderMethods && STATE.renderMethods();
  };
  sec.append(h('div', { class: 'cfg' }, left, h('div', {}, right)));
  run();
  return sec;
}

/* ---------------- LINEAGE ---------------- */
function buildLineage(parent) {
  const W = 1380; const ns = 'http://www.w3.org/2000/svg';
  const yr0 = 2012.3, yr1 = 2026.9; const X = (y) => 90 + (y - yr0) / (yr1 - yr0) * (W - 130);
  const mk = (tag, a, txt) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
  const lanesOrder = ['vio', 'lio', 'livo', 'deg', 'lrn', 'swm'];
  const laneName = { vio: 'VIO', lio: 'LIO', livo: 'LIVO', deg: 'DEGRADED', lrn: 'LEARNED', swm: 'SWARM' };
  const pos = {}; let top = 40; const laneY = {};
  for (const f of lanesOrder) {
    const ns_ = LINEAGE.nodes.filter(n => n.f === f).map(n => ({ n, x: X(n.y), w: n.label.length * 6.6 + 18 })).sort((a, b) => a.x - b.x);
    const rows = [];
    for (const it of ns_) { let r = rows.findIndex(end => end + 8 < it.x - it.w / 2); if (r < 0) { rows.push(0); r = rows.length - 1; } rows[r] = it.x + it.w / 2; pos[it.n.id] = { x: it.x, y: top + 14 + r * 28, w: it.w }; }
    laneY[f] = [top, top + 14 + (rows.length - 1) * 28 + 18]; top = laneY[f][1] + 18;
  }
  const H = top + 6;
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  for (let y = 2013; y <= 2026; y += 1) { svg.append(mk('line', { x1: X(y), x2: X(y), y1: 24, y2: H - 6, stroke: COL.hair })); svg.append(mk('text', { x: X(y), y: 16, 'font-size': 11, 'text-anchor': 'middle', fill: COL.mute, 'font-family': 'JetBrains Mono' }, y)); }
  lanesOrder.forEach((f, i) => { if (i % 2 === 0) svg.prepend(mk('rect', { x: 0, y: laneY[f][0] - 6, width: W, height: laneY[f][1] - laneY[f][0] + 12, fill: '#fafafc' })); svg.append(mk('text', { x: 8, y: (laneY[f][0] + laneY[f][1]) / 2 + 4, 'font-size': 10, fill: FAM[f].col, 'font-family': 'JetBrains Mono', 'font-weight': 700 }, laneName[f])); });
  for (const [a, b] of LINEAGE.edges) { const A = pos[a], B = pos[b]; if (!A || !B) continue; const ax = A.x + A.w / 2, bx = B.x - B.w / 2; svg.append(mk('path', { d: `M${ax},${A.y} C${(ax + bx) / 2},${A.y} ${(ax + bx) / 2},${B.y} ${bx},${B.y}`, fill: 'none', stroke: '#c7c7cc', 'stroke-width': 1.4 })); }
  LINEAGE.nodes.forEach(n => {
    const p = pos[n.id]; const g = mk('g', { class: 'lin-node', transform: `translate(${p.x},${p.y})` });
    const onPage = !!byId(n.id); const col = FAM[n.f].col;
    g.append(mk('rect', { x: -p.w / 2, y: -11, width: p.w, height: 22, rx: 11, fill: onPage ? '#fff' : COL.soft, stroke: onPage ? col : COL.hair, 'stroke-width': onPage ? 1.8 : 1 }));
    g.append(mk('text', { x: 0, y: 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': onPage ? 700 : 500, fill: onPage ? COL.ink : COL.mute, 'font-family': 'Archivo, sans-serif' }, n.label));
    if (onPage) { g.style.cursor = 'pointer'; g.addEventListener('click', () => openDetail(n.id)); }
    svg.append(g);
  });
  parent.append(svg);
}

/* ---------------- BUILD: hardware, PX4, simulators ---------------- */
function buildBuild() {
  const sec = h('section', { id: 'build', class: 'sec wrap' });
  sec.append(sectionHead('build', '07', 'From paper to a flying drone', 'Three reference sensor/compute builds, how the estimate gets into PX4 or ArduPilot, and where to test before flying. <em>Vendor specs are linked; prices change.</em>'));
  const g = h('div', { class: 'grid g3' });
  for (const b of BUILDS) g.append(h('div', { class: 'card build' }, h('h4', {}, b.name), h('div', { class: 'price' }, b.sub), h('ul', {}, ...b.parts.map(([a, c]) => h('li', {}, h('span', {}, a), h('span', {}, c)))), h('p', { style: 'font-size:13px;color:var(--mute);margin:12px 0 0', html: b.note }), h('div', { class: 'runs' }, ...b.runs.map(id => byId(id) ? h('button', { class: 'tag ' + famOf(byId(id)).cls, onclick: () => openDetail(id) }, byId(id).name) : null))));
  sec.append(g);
  // hardware table
  const t = h('table', { class: 'tbl' }); t.append(h('thead', {}, h('tr', {}, ...['Component', 'Mass', 'Power', 'Key specs', 'Source'].map(x => h('th', {}, x)))));
  const tb = h('tbody'); HW.forEach(x => tb.append(h('tr', {}, h('td', {}, h('b', {}, x.name), h('div', { class: 'mute', style: 'font-size:12px' }, x.type)), h('td', {}, x.mass || '—'), h('td', {}, x.power || '—'), h('td', { style: 'font-size:12.5px' }, x.spec), h('td', {}, h('a', { href: x.src, target: '_blank', style: 'color:var(--accent);font-size:12px' }, 'spec ↗')))));
  t.append(tb);
  sec.append(h('h3', { style: 'margin:40px 0 12px;font-size:22px' }, 'Sensor and computer specs'), h('div', { class: 'card white scroll-x' }, t));
  // PX4 integration
  sec.append(h('h3', { style: 'margin:40px 0 12px;font-size:22px' }, 'Feeding SLAM into the flight controller'));
  const px = h('div', { class: 'grid g2' });
  for (const p of FC) px.append(h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 6px' }, p.name), h('p', { style: 'font-size:13.5px;color:var(--mute);margin:0 0 10px', html: p.desc }), h('table', { class: 'tbl' }, h('tbody', {}, ...p.rows.map(([k, v]) => h('tr', {}, h('td', { class: 'k mono', style: 'width:auto' }, k), h('td', { style: 'font-size:13px', html: v }))))), h('p', { class: 'note' }, 'Source: ', ...p.src.map(([t, u], i) => [i ? ' · ' : '', h('a', { href: u, target: '_blank', style: 'color:var(--accent)' }, t)]).flat())));
  sec.append(px);
  // sims
  sec.append(h('h3', { style: 'margin:40px 0 12px;font-size:22px' }, 'Test before you fly'));
  const sg = h('div', { class: 'grid g3' });
  for (const s of SIMS) sg.append(h('div', { class: 'card' }, h('h4', { style: 'margin:0 0 4px' }, s.name), h('div', { class: 'mono mute', style: 'margin-bottom:8px' }, s.engine), h('p', { style: 'font-size:13.5px;margin:0 0 10px' }, s.use), linkChip(s.link[0], s.link[1])));
  sec.append(sg);
  // lineage
  sec.append(h('h3', { style: 'margin:40px 0 12px;font-size:22px' }, 'Lineage: who built on whom'));
  const lw = h('div', { class: 'lineage-wrap' }, h('div', { class: 'stage' }));
  buildLineage(lw.firstChild);
  sec.append(lw, h('p', { class: 'note' }, 'Outlined nodes are profiled on this page (click to open). Grey nodes are ancestors or related systems for context.'));
  return sec;
}

/* ---------------- DATASETS ---------------- */
function buildDatasets() {
  const sec = h('section', { id: 'datasets', class: 'sec wrap' });
  sec.append(sectionHead('datasets', String(DATASETS.length), 'Where to test without crashing', 'Datasets recorded <em>from real drones</em> matter: hand-held rigs do not shake, flip or see rotor wash. Platform is marked on each.'));
  const g = h('div', { class: 'ds' });
  for (const d of DATASETS) g.append(reveal(h('div', { class: 'card' }, h('div', { style: 'display:flex;justify-content:space-between;gap:8px;align-items:baseline' }, h('h4', {}, d.name), h('span', { class: 'yr' }, d.year)), h('div', { class: 'mono', style: 'margin-top:4px;color:' + (d.uav ? 'var(--ok)' : 'var(--mute)') }, d.platform), h('p', {}, d.why), h('div', { class: 'sensrow' }, ...d.sensors.map(s => h('span', {}, s))), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, linkChip('dataset', d.url), d.paper ? linkChip('paper', d.paper) : null))));
  sec.append(g);
  return sec;
}

/* ---------------- ROADMAP ---------------- */
function buildRoadmap() {
  const sec = h('section', { id: 'roadmap', class: 'sec wrap' });
  sec.append(sectionHead('roadmap', '08', 'Open problems and a way in', 'Where the field is still weak for drones, framed as thesis-sized questions with the prior work to read first, then a reading-and-building plan for the first months. <em>Directions are editorial suggestions, not consensus.</em>'));
  const gl = h('div', {});
  GAPS.forEach((gp, i) => gl.append(reveal(h('div', { class: 'gap' }, h('div', { class: 'n' }, String(i + 1).padStart(2, '0')),
    h('div', {}, h('h4', {}, gp.t), h('p', { html: gp.d }), h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...gp.read.map(([t, u]) => u.startsWith('#') ? h('button', { class: 'chip', onclick: () => openDetail(u.slice(1)) }, t) : linkChip(t, u)))),
    h('div', { class: 'meta' }, ...[['Feasibility', gp.feas], ['Hardware', gp.hw], ['Start from', gp.start]].map(([k, v]) => h('div', {}, h('span', { class: 'mute' }, k), h('b', {}, v))))))));
  sec.append(gl);
  sec.append(h('h3', { style: 'margin:48px 0 14px;font-size:22px' }, 'A first 16 weeks'));
  const rd = h('div', { class: 'road' });
  ROAD.forEach(r => rd.append(h('div', { class: 'card' }, h('h5', {}, r.w), h('h4', {}, r.t), h('ol', {}, ...r.items.map(x => h('li', { html: x }))))));
  sec.append(rd);
  return sec;
}

/* ---------------- SOURCES ---------------- */
function SOURCES_COUNT() { const s = new Set(); METHODS.forEach(m => m.papers.forEach(p => s.add(p.t))); BENCH.forEach(b => s.add(b.url)); DATASETS.forEach(d => s.add(d.url)); EXTRA_SOURCES.forEach(x => s.add(x[1])); return s.size; }
function buildSources() {
  const sec = h('section', { id: 'sources', class: 'sec wrap' });
  sec.append(sectionHead('sources', String(SOURCES_COUNT()), 'Primary papers, official code, benchmark tables', 'Every figure on this page comes from the original paper, the official repository, an official dataset or documentation page, or a manufacturer specification. Simulations and rating bars are editorial.'));
  sec.append(h('h3', { style: 'font-size:18px;margin:0 0 8px' }, 'Benchmark tables'));
  const b = h('div', { class: 'srcs' }); BENCH.forEach(x => b.append(h('div', { class: 's' }, h('b', {}, x.title), h('span', { class: 'mute' }, x.source), h('div', { class: 'links' }, h('a', { href: x.url, target: '_blank' }, 'Source ↗'))))); sec.append(b);
  sec.append(h('h3', { style: 'font-size:18px;margin:30px 0 8px' }, 'Method references'));
  const m = h('div', { class: 'srcs' }); METHODS.forEach(x => x.papers.forEach(p => m.append(h('div', { class: 's' }, h('b', {}, `${x.name} — ${p.t}`), h('span', { class: 'mute' }, p.v), h('div', { class: 'links' }, ...p.links.map(([t, u]) => h('a', { href: u, target: '_blank' }, t + ' ↗')), h('a', { href: x.code, target: '_blank' }, 'code ↗')))))); sec.append(m);
  sec.append(h('h3', { style: 'font-size:18px;margin:30px 0 8px' }, 'Documentation, datasets and specifications'));
  const e = h('div', { class: 'srcs' }); EXTRA_SOURCES.forEach(([t, u]) => e.append(h('div', { class: 's' }, h('b', {}, t), h('div', { class: 'links' }, h('a', { href: u, target: '_blank' }, u.replace(/^https?:\/\//, '').slice(0, 60) + ' ↗'))))); sec.append(e);
  sec.append(h('div', { class: 'callout', style: 'margin-top:24px' }, h('b', {}, 'Method. '), METHOD_NOTE));
  return sec;
}

/* ---------------- BOOT ---------------- */
function boot() {
  const root = $('#root');
  root.append(buildNav(), buildHero(), buildBrief(), buildProblem(), buildSensors(), buildStack(), buildFamilies(), buildMethods(), buildFlight(), buildBench(), buildFit(), buildBuild(), buildDatasets(), buildRoadmap(), buildSources(),
    h('footer', { class: 'wrap' }, h('div', { style: 'display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;border-top:1px solid var(--hair);padding-top:20px' }, h('span', {}, 'SLAM/DRONES · a field guide for Sirisha · November 2026'), h('a', { href: '/' }, '← SLAM/INDEX (general edition)'))));
  document.body.append(detail);
  const m = location.hash.match(/^#m-(.+)$/); if (m && byId(m[1])) openDetail(m[1], false);
}
document.addEventListener('DOMContentLoaded', boot);
