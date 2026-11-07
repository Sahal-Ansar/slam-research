/* ============================ FAMILIES ============================ */
const FAMILIES = [
  { fam: 'vio', name: 'Visual-inertial (VIO / VI-SLAM)', desc: 'Camera + IMU. Lightest and cheapest; the IMU gives scale and carries the state through short visual gaps. Fails in darkness, smoke and on blank walls. Estimators are <em>filters</em> (OpenVINS, S-MSCKF) or <em>sliding windows</em> (VINS, ORB-SLAM3, Basalt).', sim: (p) => graphSim(p, 'window', { loop: true }) },
  { fam: 'lio', name: 'LiDAR-inertial (LIO)', desc: 'LiDAR + IMU. Metric, light-independent, accurate; now light enough for a 500 mm quad (a Livox Mid-360 is 265 g). Fails where geometry is self-similar — long corridors, tunnels, open fields — and in dense smoke or dust.', sim: (p) => graphSim(p, 'ieskf') },
  { fam: 'livo', name: 'LiDAR-visual-inertial (LIVO)', desc: 'LiDAR + camera + IMU tightly coupled. The camera constrains what LiDAR geometry cannot (corridors); LiDAR covers darkness and low texture. Needs hardware synchronisation and good extrinsic calibration.', sim: (p) => missionView(p, ['lio', 'livo'], { aspect: .5, minH: 240, layers: { cone: false, feats: false }, names: ['LiDAR-inertial', 'LiDAR-visual-inertial'] }) },
  { fam: 'deg', name: 'Degraded-sensing (thermal, radar, event, intensity)', desc: 'Sensors chosen for what normal ones miss: <em>thermal</em> sees through smoke and darkness, <em>radar</em> through fog and dust, <em>event cameras</em> through blur and HDR, <em>LiDAR intensity</em> along featureless corridors. Usually one channel of a multi-modal estimator.', sim: (p) => missionView(p, ['vio_stereo', 'tio', 'rio'], { aspect: .5, minH: 240, thermal: true, layers: { rays: false, ellipse: false }, names: ['Visible VIO', 'Thermal-inertial', 'Radar-inertial'] }) },
  { fam: 'lrn', name: 'Learned & dense', desc: 'Neural networks for correspondence (DROID, DPVO), features (AirSLAM) or full 3D priors (MASt3R, VGGT), and Gaussian-splatting maps. Most need desktop GPUs; AirSLAM is the exception with a measured Jetson Orin result.', sim: (p) => flowSim(p, 'dense') },
  { fam: 'swm', name: 'Multi-drone (collaborative)', desc: 'Several drones share compact place descriptors to align frames and merge maps, centrally (COVINS-G) or peer-to-peer (D²SLAM, Swarm-SLAM). Bandwidth and outlier loop closures are the hard parts.', sim: (p) => swarmSim(p) },
];

/* ============================ PROBLEM ============================ */
const PROBLEM = {
  demands: [
    { k: 'Pose rate into PX4', v: '30–50 Hz', p: 45 },
    { k: 'X500 V2 payload', v: '≤ 1.5 kg', p: 62 },
    { k: 'Compute vs motors', v: '15 vs 246 W', p: 7 },
    { k: 'Flight time (1.32 kg quad)', v: '~15 min', p: 30 },
  ],
  demandsNote: 'PX4 docs: stream external vision at 30–50 Hz or EKF2 will not fuse it. Holybro X500 V2: 1500 g payload without battery at 70 % throttle. RACER (T-RO 2023) quadrotor: propulsion ≈ 246 W vs onboard computer ≤ 15 W, 1.32 kg, ~15 min. Sources in the Build section.',
  why: [
    '<b>It cannot stop when lost.</b> A multirotor needs a pose estimate every control cycle; an estimator that pauses or jumps can crash the vehicle.',
    '<b>Fast rotation.</b> FAST-LIO2 was flown through a flip at 912 °/s on average; Point-LIO handled 59 rad/s on a racing quad. Monocular VIO loses depth in pure rotation (Jeon et al. 2021 Table IV).',
    '<b>Vibration.</b> Rotors shake the IMU; poor mounting corrupts accelerometer data used for pre-integration.',
    '<b>Size, weight, power.</b> Every gram of sensor and watt of compute costs flight time — the reason SVO, S-MSCKF and FAST-LIO2 publish ARM/Jetson timings.',
    '<b>No absolute heading indoors.</b> Steel and motor currents disturb magnetometers; ArduPilot\'s external-navigation guide disables compasses when yaw comes from the estimator.',
    '<b>Hostile scenes.</b> Darkness, smoke, dust, blank walls and long corridors each remove a different sensor\'s information.'
  ],
  envs: [
    { name: 'Indoor buildings', kind: 'indoor', desc: 'Rooms, corridors, stairwells. Lighting varies; walls can be blank.', tags: [['camera: blank walls', 'warn'], ['LiDAR: corridors', 'warn'], ['magnetometer', 'bad']] },
    { name: 'Warehouses', kind: 'warehouse', desc: 'Repetitive racks confuse place recognition; tall aisles, moving forklifts and people.', tags: [['loop closure: aliasing', 'warn'], ['LiDAR', 'ok'], ['dynamic objects', 'warn']] },
    { name: 'Tunnels & mines', kind: 'tunnel', desc: 'Dark, dusty, geometrically self-similar. The DARPA SubT setting.', tags: [['camera: dark', 'bad'], ['LiDAR: degeneracy', 'bad'], ['thermal', 'ok'], ['radar', 'ok']] },
    { name: 'Forest canopy', kind: 'forest', desc: 'GPS blocked by leaves; clutter, thin branches, wind-moved foliage.', tags: [['camera: lighting', 'warn'], ['LiDAR', 'ok'], ['dynamic leaves', 'warn']] },
    { name: 'Under bridges', kind: 'bridge', desc: 'Sun-to-shadow transitions, repetitive girders, water below.', tags: [['camera: HDR', 'warn'], ['event camera', 'ok'], ['LiDAR: water', 'warn']] },
    { name: 'Urban canyons', kind: 'urban', desc: 'GNSS multipath rather than none; glass and moving traffic.', tags: [['GPS: unreliable', 'warn'], ['LiDAR: glass', 'warn'], ['LIVO', 'ok']] },
    { name: 'Smoke / fire / SAR', kind: 'fire', desc: 'Smoke blinds cameras and corrupts LiDAR returns; heat sources everywhere.', tags: [['camera', 'bad'], ['LiDAR', 'bad'], ['thermal', 'ok'], ['radar', 'ok']] },
    { name: 'Large revisited sites', kind: 'indoor', desc: 'Repeated inspection of the same plant or building over days.', tags: [['drift: needs loop closure', 'warn'], ['map reuse', 'ok']] },
  ]
};

/* ============================ SENSORS ============================ */
const SENSORS = {
  conds: ['Darkness', 'Low texture', 'Corridor / tunnel', 'Smoke, dust, fog', 'Fast rotation', 'Metric scale', 'Weight & power', 'Cost'],
  rows: [
    { name: 'Monocular camera', sub: 'global shutter', v: [0, 0, 2, 0, 1, 0, 2, 2], notes: ['', 'Needs corners or gradients.', 'Wall texture constrains motion along a corridor.', 'Particles scatter visible light.', 'Blur; mono depth needs parallax.', 'Scale unobservable without IMU motion.', 'A few grams, < 1 W.', ''] },
    { name: 'Stereo / active depth', sub: 'e.g. RealSense D435i, D455', v: [1, 1, 2, 0, 1, 2, 2, 2], notes: ['Active IR projector helps at short range in the dark.', 'IR dot pattern adds texture for depth (not for tracking).', '', '', 'Stereo keeps depth during pure rotation.', 'Baseline gives metric depth.', 'D435i 75 g, D455 116 g; ~3.5 W max.', 'D435i $399, D455 $499 (store).'] },
    { name: '3D LiDAR', sub: 'Livox Mid-360, Ouster OS0/OS1', v: [2, 2, 0, 0, 2, 2, 1, 1], notes: ['Active sensor: light independent.', 'Uses geometry, not texture.', 'Parallel walls leave one direction unconstrained.', 'Returns from particles corrupt scans.', 'FAST-LIO2 flew a 912 °/s flip.', 'Direct ranging.', 'Mid-360 265 g, 6.5 W; OS1 ≈ 500 g, 15 W.', 'Mid-360 $749 list; Ouster on quote.'] },
    { name: 'Thermal (LWIR)', sub: 'FLIR Boson / Lepton', v: [2, 1, 2, 2, 1, 0, 2, 1], notes: ['Sees emitted heat, not reflected light.', 'Thermally flat scenes have little contrast.', '', 'Long-wave IR passes smoke far better than visible light.', 'Low frame rate; FFC shutter freezes the image.', 'Monocular: needs IMU.', 'Boson from 7.5 g, ~0.6 W.', 'Higher than visible cameras.'] },
    { name: 'mmWave radar', sub: 'TI IWR6843AOP', v: [2, 2, 1, 2, 1, 2, 2, 2], notes: ['', '', 'Doppler gives velocity even when geometry is degenerate.', 'mm waves penetrate fog, dust, smoke.', 'Sparse, noisy returns.', 'Range + Doppler are metric.', '≈ 1.2 W average (datasheet).', 'Chip ≈ $35.'] },
    { name: 'Event camera', sub: 'DAVIS / Prophesee', v: [1, 0, 2, 0, 2, 0, 2, 0], notes: ['High dynamic range; still needs some light.', 'No edges, no events.', '', '', 'µs latency, no motion blur.', 'Monocular.', '', 'Research-grade price, low resolution.'] },
    { name: 'IMU', sub: 'MEMS, ≥ 200 Hz', v: [2, 2, 2, 2, 2, 1, 2, 2], notes: ['', '', '', '', 'Can saturate (Point-LIO handles it).', 'Double integration drifts in seconds alone.', '', ''] },
    { name: 'UWB anchors', sub: 'infrastructure', v: [2, 2, 2, 2, 2, 2, 2, 1], notes: ['', '', '', '', '', 'Absolute ranges bound drift.', '', 'Requires installing anchors — not possible everywhere.'] },
  ],
  note: 'Editorial summary from the sensor physics and the papers on this page. Hover a cell for the reason. Weights, powers and prices are from manufacturer pages listed under Build.',
  lidarNotes: [
    '<b>Spinning</b> LiDARs (Ouster, Velodyne) scan fixed rings: dense in azimuth, sparse in elevation, the same pattern every sweep. They suit LIO-SAM/LVI-SAM (which need the ring channel) and COIN-LIO (needs a high-resolution Ouster intensity image).',
    '<b>Non-repetitive</b> solid-state LiDARs (Livox) trace a pattern that fills the field of view over time, so a short integration already covers it well. The <b>Mid-360</b> (360° × 59°, 265 g, 6.5 W, built-in IMU) became a common drone LiDAR; FAST-LIO2, Point-LIO and FAST-LIVO2 support Livox natively.',
    'Either way, use per-point timestamps and hardware time sync with the IMU; FAST-LIO2, DLIO and Point-LIO READMEs all warn that unsynchronised data breaks them.'
  ]
};

/* ============================ PIPELINE ============================ */
const STACK = {
  nodes: [
    { id: 'sensors', name: 'Sensors', gx: .1, gy: .5, rate: 'IMU · camera · LiDAR', desc: 'IMU plus exteroceptive sensors. On a drone, mount the IMU with vibration damping and keep the camera/LiDAR rigidly attached to it.', tips: ['Global-shutter cameras; avoid auto-exposure jumps for direct methods.', 'Intel RealSense T265 is end-of-life (last orders Feb 2022, Intel PCN 807360-01): do not design around it.', 'ModalAI VOXL 2 integrates compute + VIO in 16 g if a turnkey option is acceptable.'] },
    { id: 'sync', name: 'Time sync & calibration', gx: .25, gy: .5, desc: 'Every system here assumes accurate intrinsics, extrinsics and timestamps. OKVIS2\'s README calls this a “health warning”; FAST-LIVO needs hardware sync; DLIO “will not work” without it.', tips: ['Kalibr for camera–IMU (github.com/ethz-asl/kalibr).', 'Hardware-trigger cameras from the IMU or LiDAR clock where possible (S-MSCKF did).', 'Estimate time offset online if supported (VINS, OpenVINS, R3LIVE).'] },
    { id: 'frontend', name: 'Front-end', gx: .42, gy: .22, desc: 'Turns raw data into constraints: feature tracks (KLT, ORB, SuperPoint), photometric patches, LiDAR point-to-plane matches, radar Doppler, learned flow.', tips: ['Most CPU time is here (S-MSCKF: ~80 % in the front-end).', 'Learned front-ends need TensorRT on a Jetson (AirSLAM: 40 FPS on Orin).'] },
    { id: 'estimator', name: 'Estimator', gx: .56, gy: .5, rate: 'IMU-rate propagation', desc: 'Fuses constraints with IMU into pose, velocity and biases: filter (MSCKF, ESIKF), sliding window (VINS, OKVIS) or factor graph (iSAM2). The heart of “SLAM” for flight.', tips: ['Publish the IMU-propagated state at high rate, not only window outputs (VINS-Mono: 100 Hz output, 10 Hz window).', 'Watch for degeneracy (eigenvalues of the information matrix) and report covariance honestly.'] },
    { id: 'loop', name: 'Loop closure / map', gx: .72, gy: .22, desc: 'Place recognition and pose-graph optimisation remove drift on revisits; the map (sparse points, voxels, mesh, Gaussians) is what planning uses.', tips: ['Sparse VIO maps are not obstacle maps — add OctoMap, Voxblox, nvblox or ROG-Map.', 'Loop closures cause jumps: feed them to planning, not directly to the flight controller.'] },
    { id: 'planner', name: 'Planner', gx: .88, gy: .22, desc: 'Local planners (EGO-Planner, Fast-Planner) and exploration (FUEL, RACER) consume odometry + map and output trajectories.', tips: ['ZJU Fast-Drone-250 and HKU MaRS (ROG-Map, MARSIM) provide complete open stacks.', 'Plan in the odometry frame; re-anchor after loop closures.'] },
    { id: 'fc', name: 'PX4 / ArduPilot EKF', gx: .72, gy: .78, rate: 'vision in at 30–50 Hz', desc: 'The flight controller\'s own EKF fuses the external pose/odometry with its IMU. PX4: EKF2 external vision; ArduPilot: EKF3 with ExternalNav sources.', tips: ['PX4 ROS 2: publish px4_msgs/VehicleOdometry on /fmu/in/vehicle_visual_odometry (NED/FRD).', 'Set EKF2_EV_CTRL bits and EKF2_HGT_REF=Vision; tune EKF2_EV_DELAY.', 'ArduPilot: VISO_TYPE, EK3_SRC1_POSXY=6 (ExternalNav).'] },
    { id: 'ctrl', name: 'Control → motors', gx: .9, gy: .78, rate: '≥ 250 Hz attitude', desc: 'Position, attitude and rate controllers turn trajectories into motor commands. A bad estimate shows up here first as oscillation or drift.', tips: ['Test the full loop in PX4 SITL with simulated sensor noise before flight.'] },
  ],
  edges: [['sensors', 'sync'], ['sync', 'frontend'], ['frontend', 'estimator'], ['sync', 'estimator', 'IMU'], ['estimator', 'loop'], ['loop', 'planner'], ['estimator', 'fc', 'odometry'], ['planner', 'ctrl', 'trajectory'], ['fc', 'ctrl']]
};

/* ============================ BENCHMARKS ============================ */
const EUROC_SEQ = ['MH01', 'MH02', 'MH03', 'MH04', 'MH05', 'V101', 'V102', 'V103', 'V201', 'V202', 'V203'];
const KAIST_SEQ = ['cir-n', 'cir-f', 'cir-h', 'inf-n', 'inf-f', 'inf-h', 'squ-n', 'squ-f', 'squ-h', 'rot-n', 'rot-f'];
const KAIST_ALGS = [['VINS-Mono', 'mono + IMU'], ['ALVIO', 'mono + IMU, lines'], ['ROVIO', 'mono + IMU'], ['Kimera', 'stereo + IMU'], ['VINS-Fusion', 'stereo, no IMU'], ['VINS-Fusion-gpu', 'stereo + IMU, GPU'], ['VINS-Fusion-imu', 'stereo + IMU'], ['ORB-SLAM2', 'stereo, no IMU'], ['S-MSCKF', 'stereo + IMU']];
// Jeon et al. 2021 Table IV — rows = sequences, 9 values per board in KAIST_ALGS order; 'x' = diverged, '-' = could not run
const KAIST_RAW = {
  TX2: [[.10, .07, 'x', .08, '-', .08, '-', .10, .14], [.07, .13, .79, .13, '-', .14, '-', .28, .12], [.24, 'x', 2.11, .25, '-', .10, '-', .19, .10], [.14, .11, 'x', .09, '-', .09, '-', .35, .10], [.11, .06, .44, .19, '-', .06, '-', .22, .20], [1.19, 'x', 'x', .94, '-', .13, '-', 1.50, 1.11], [.20, .16, .46, .08, '-', .12, '-', .44, .18], [.07, .13, .56, .14, '-', .10, '-', .29, .17], ['x', 'x', 'x', .18, '-', .15, '-', .16, .40], [.83, 'x', 'x', .16, '-', .12, '-', .31, .16], ['x', 'x', 2.74, .85, '-', .11, '-', .18, .29]],
  'Xavier NX': [[.13, .09, 'x', .12, .06, .09, .11, .09, .12], [.15, .05, .83, .07, .12, .13, .10, .11, .19], [.43, .45, 2.12, .28, .08, .11, .13, .13, .21], [.10, .12, 1.32, .05, .05, .09, .08, .08, .32], [.08, .07, .41, .14, .09, .05, .08, .10, .17], [.50, 1.10, 'x', 1.08, .12, .14, .12, .12, .60], [.17, .16, .46, .17, .17, .12, .21, .09, .10], [.14, .07, .56, .19, .07, .11, .13, .09, .30], [.34, 'x', 'x', 1.57, .19, .15, .20, .16, .30], ['x', 'x', 'x', .17, .11, .12, .16, .17, .10], [.40, 'x', 'x', .74, .28, .11, .10, .21, .29]],
  'AGX Xavier': [[.12, .12, 'x', .08, .07, .09, .08, .08, .11], [.14, .12, .80, .08, .16, .13, .13, .12, .23], [.41, .49, 2.11, .26, .06, .11, .07, .15, .20], [.24, .12, 1.19, .09, .07, .09, .07, .07, .09], [.10, .09, .44, .13, .07, .05, .07, .07, .12], [.57, .48, 'x', 1.09, .09, .14, .12, .09, .87], [.11, .10, .47, .13, .17, .10, .15, .12, .15], [.12, .10, .56, .14, .08, .11, .10, .14, .17], [.30, .36, 'x', 1.50, .18, .15, .18, .17, .50], ['x', .81, 'x', .18, .11, .12, .11, .16, .07], [.89, .72, 'x', .90, .26, .11, .07, .18, .19]],
};
const kaistView = (board) => ({ name: board, cols: KAIST_SEQ, rows: KAIST_ALGS.map(([n, sub], ai) => ({ name: n, sub, v: KAIST_RAW[board].map(r => r[ai]) })), dp: 2, log: true });

const BENCH = [
  {
    title: 'EuRoC MAV — visual-inertial systems, per sequence', type: 'heat',
    cap: 'RMS ATE in metres on all 11 EuRoC drone sequences (green = low error). Monocular-inertial and stereo-inertial systems only, since a drone always has an IMU. The V*03 sequences have the fastest motion and blur.',
    views: [{
      name: 'All inertial systems', cols: [...EUROC_SEQ, 'avg'], dp: 3, log: true, rows: [
        { name: 'ORB-SLAM3', sub: 'stereo + IMU', v: [.036, .033, .035, .051, .082, .038, .014, .024, .032, .014, .024, .035] },
        { name: 'BASALT', sub: 'stereo + IMU · keyframes', v: [.080, .060, .050, .100, .080, .040, .020, .030, .030, .020, '-', .051] },
        { name: 'Kimera', sub: 'stereo + IMU', v: [.080, .090, .110, .150, .240, .050, .110, .120, .070, .100, .190, .119] },
        { name: 'VINS-Fusion', sub: 'stereo + IMU · re-run', v: [.166, .152, .125, .280, .284, .076, .069, .114, .066, .091, .096, .138] },
        { name: 'ORB-SLAM3', sub: 'mono + IMU', v: [.062, .037, .046, .075, .057, .049, .015, .037, .042, .021, .027, .043] },
        { name: 'VI-DSO', sub: 'mono + IMU', v: [.062, .044, .117, .132, .121, .059, .067, .096, .040, .062, .174, .089] },
        { name: 'VINS-Mono', sub: 'mono + IMU · re-run', v: [.084, .105, .074, .122, .147, .047, .066, .180, .056, .090, .244, .110] },
        { name: 'ROVIO', sub: 'mono + IMU · from [78]', v: [.210, .250, .250, .490, .520, .100, .100, .140, .120, .140, .140, .224] },
        { name: 'OKVIS', sub: 'mono + IMU · from [78]', v: [.160, .220, .240, .340, .470, .090, .200, .240, .130, .160, .290, .231] },
        { name: 'MSCKF', sub: 'mono + IMU · from [78]', v: [.420, .450, .230, .370, .480, .340, .200, .670, .100, .160, 1.130, .414] },
      ]
    }],
    note: '“re-run” = errors obtained by the ORB-SLAM3 authors with default settings; “[78]” = Delmerico & Scaramuzza, ICRA 2018 drone VIO benchmark; BASALT on keyframe trajectory; “–” = not reported. Averages as in the paper.',
    source: 'Campos et al., ORB-SLAM3, IEEE T-RO 2021, Table II', url: arx('2007.11898')
  },
  {
    title: 'KAIST VIO on NVIDIA Jetson boards — a real drone, three computers', type: 'heat',
    cap: 'RMS ATE (m) of nine VIO/VO systems running on Jetson TX2, Xavier NX and AGX Xavier over 11 drone flights: circle, infinity, square and pure-rotation paths at normal (n), fast (f) and with head rotation (h). ✗ = diverged, – = could not run (VINS-Fusion stereo did not run on the TX2). Note how monocular methods diverge in the pure-rotation flights (rot-n, rot-f) while stereo methods survive.',
    views: ['TX2', 'Xavier NX', 'AGX Xavier'].map(kaistView),
    note: 'Origin-aligned trajectories as in the paper; all boards at maximum clock. CPU/memory are plotted, not tabulated, in the paper (Fig. 3): ROVIO used the least CPU; Kimera and ORB-SLAM2 the most; Kimera the most memory.',
    source: 'Jeon et al., Run Your Visual-Inertial Odometry on NVIDIA Jetson, IEEE RA-L 2021, Table IV', url: arx('2103.01655')
  },
  {
    title: 'LiDAR(-visual)-inertial on drone and handheld data', type: 'heat',
    cap: 'RMS ATE (m) from one table. NTU VIRAL is flown by a DJI M600 hexacopter; Hilti 2022/2023 is handheld in construction sites (stairs, cupola, dark rooms). ✗ = system totally failed. Loop closure disabled for LVI-SAM so all are odometry.',
    views: [{ name: 'NTU VIRAL (drone)', cols: LIVO2_NTU.cols, rows: LIVO2_NTU.rows, dp: 3, log: true }, { name: 'Hilti ’22 / ’23 (handheld)', cols: LIVO2_HILTI.cols, rows: LIVO2_HILTI.rows, dp: 3, log: true }],
    note: 'SDV-LOAM was run loosely coupled with LeGO-LOAM by the FAST-LIVO2 authors. FAST-LIVO2 shown with its default configuration.',
    source: 'Zheng et al., FAST-LIVO2, IEEE T-RO 2024, Table II', url: arx('2408.14035')
  },
  {
    title: 'Hard conditions: dark room, white wall, long corridor', type: 'heat',
    cap: 'RMS ATE (m) on sequences recorded by hand-carrying a SubT drone (VLP-16, fisheye camera, IMU). The long corridor breaks LiDAR-only LOAM (4.15 m); the white wall and dark room break camera-only VINS. The IMU-centric multi-modal estimator stays low in all four.',
    views: [{ name: 'ATE RMSE', cols: ['LOAM', 'LIO-SAM', 'VINS', 'VINS-Depth', 'Super Odometry'], dp: 3, log: true, rows: [
      { name: 'Constrained env.', v: [.319, .650, .470, .490, .259] }, { name: 'Long corridor', v: [4.15, .85, 5.83, 2.58, .055] }, { name: 'White wall', v: [.457, .217, 1.184, .786, .156] }, { name: 'Dark room', v: [.263, .246, .527, .429, .174] }] }],
    source: 'Zhao et al., Super Odometry, IEEE/RSJ IROS 2021, Table II', url: arx('2104.14938')
  },
  {
    title: 'What has actually run on small onboard computers', type: 'bars',
    cap: 'Per-frame or per-scan time reported by each paper on an embedded or drone computer. <b>Compiled across papers</b>: data rates and hardware differ, so read this as “does it fit”, not as a ranking.',
    rows: [
      { label: 'SVO mono · Jetson TX1 (tracking thread)', v: 4.82, col: COL.vis, tip: 'Sparse image alignment 2.54 + feature alignment 1.40 + optimisation 0.88 ms; mapping thread 8.45 ms. SVO T-RO Table III.' },
      { label: 'FAST-LIO2 · Khadas VIM3 ARM · 100 Hz scans', v: 5.23, col: COL.lid, tip: 'FAST-LIO2 Table VII. On public 10 Hz datasets the ARM time was 44–100 ms/scan (Table VI).' },
      { label: 'Point-LIO · Khadas VIM3 Pro · onboard spinning UAV', v: 14.63, col: COL.lid, tip: 'Per 50 Hz LiDAR packet, real-time onboard. Point-LIO Sec. 7.2.' },
      { label: 'AirSLAM VIO · Jetson AGX Orin', v: 24.8, col: COL.lrn, tip: '40.3 FPS → 24.8 ms/frame; 989 MB GPU. AirSLAM Table IX.' },
      { label: 'R3LIVE LIO · DJI Manifold 2-C (i7-8550U)', v: 39.56, col: COL.fus, tip: 'UAV onboard computer used as benchmark machine; VIO adds 15–166 ms depending on resolution. R3LIVE Table IV.' },
      { label: 'FAST-LIVO · Qualcomm RB5 ARM', v: 65.33, col: COL.fus, tip: 'LIO 51.51 + VIO 13.82 ms. FAST-LIVO Table III.' },
      { label: 'FAST-LIVO2 · Qualcomm RB5 ARM · NTU VIRAL', v: 78.0, col: COL.fus, tip: '72.4–80.5 ms on NTU VIRAL; up to 98.4 ms on Hilti. FAST-LIVO2 Table III.' },
    ],
    opts: { unit: 'ms per frame / scan', dp: 1, max: 100, ticks: [0, 25, 50, 75, 100], aspect: .34 },
    source: 'SVO T-RO 2017 Table III; FAST-LIO2 T-RO 2022 Table VII; Point-LIO AIS 2023 §7.2; AirSLAM T-RO 2025 Table IX; R3LIVE ICRA 2022 Table IV; FAST-LIVO IROS 2022 Table III; FAST-LIVO2 T-RO 2024 Table III', url: arx('2408.14035')
  },
];

/* ============================ BEST FIT ============================ */
const FITQ = [
  { id: 'sens', q: 'Which sensors can her drone carry?', multi: true, def: ['stereo', 'livox'], opts: [['mono', 'Mono camera'], ['stereo', 'Stereo / depth camera'], ['livox', 'Livox LiDAR (e.g. Mid-360)'], ['spin', 'Spinning LiDAR (Ouster)'], ['thermal', 'Thermal camera'], ['radar', 'mmWave radar'], ['event', 'Event camera'], ['uwb', 'UWB anchors']], hint: 'IMU is assumed (every flight controller has one).' },
  { id: 'cpu', q: 'Onboard computer', def: ['orin'], opts: [['small', 'Small ARM (Orin Nano, Pi-class)'], ['orin', 'Jetson Orin NX / AGX'], ['nuc', 'x86 NUC, no GPU'], ['offline', 'Offline / ground GPU is fine']] },
  { id: 'env', q: 'Where will it fly?', multi: true, def: ['indoor', 'tunnel', 'dark'], opts: [['indoor', 'Indoor / warehouse'], ['tunnel', 'Tunnels, mines, long corridors'], ['dark', 'Dark or night'], ['smoke', 'Smoke, dust or fog'], ['fast', 'Aggressive flight'], ['loops', 'Revisits / large loops']] },
  { id: 'prio', q: 'What matters most?', def: ['flight'], opts: [['flight', 'Robust real-time flight'], ['acc', 'Accuracy for research'], ['map', 'A useful dense map'], ['swarm', 'Several drones']] },
  { id: 'ros', q: 'Software', def: ['any'], opts: [['ros2', 'Must be ROS 2'], ['any', 'ROS 1 is fine']] },
];
function fitScore(m, ans) {
  const S = ans.sens, why = []; let ok = true;
  const has = (k) => S.has(k);
  const r = m.req || {};
  const anyCam = has('mono') || has('stereo'); const anyLidar = has('livox') || has('spin');
  if (r.cam === 'mono' && !anyCam) { ok = false; why.push(['needs a camera', 'neg']); }
  if (r.cam === 'stereo' && !has('stereo')) { ok = false; why.push(['needs stereo', 'neg']); }
  if (r.lidar === 'any' && !anyLidar) { ok = false; why.push(['needs LiDAR', 'neg']); }
  if ((r.lidar === 'spinning' || r.lidar === 'ouster') && !has('spin')) { ok = false; why.push([r.lidar === 'ouster' ? 'needs Ouster LiDAR' : 'needs spinning LiDAR', 'neg']); }
  if (r.lidar === 'livox' && !has('livox')) { ok = false; why.push(['needs Livox LiDAR', 'neg']); }
  for (const k of ['thermal', 'radar', 'event', 'uwb']) if (r[k] && !has(k)) { ok = false; why.push(['needs ' + k, 'neg']); }
  const cpu = [...ans.cpu][0];
  if (r.gpu === 'desktop' && cpu !== 'offline') { ok = false; why.push(['desktop GPU only', 'neg']); }
  if (r.gpu === true && (cpu === 'nuc' || cpu === 'small')) { ok = false; why.push(['needs Jetson GPU', 'neg']); }
  const prio = [...ans.prio][0];
  if (r.multi && prio !== 'swarm') { ok = false; why.push(['multi-drone system', 'neg']); }
  const s = m.scores; let base;
  if (prio === 'flight') base = s.rob * .3 + s.eff * .3 + s.rdy * .25 + s.acc * .15;
  else if (prio === 'acc') base = s.acc * .45 + s.glo * .25 + s.rob * .2 + s.rdy * .1;
  else if (prio === 'map') base = s.map * .45 + s.acc * .2 + s.glo * .2 + s.rdy * .15;
  else base = s.glo * .35 + s.rob * .25 + s.rdy * .2 + s.eff * .2;
  let sc = base / 5 * 100;
  if (prio === 'swarm' && m.fam === 'swm') { sc += 10; why.push(['multi-drone', 'pos']); } else if (prio === 'swarm') { sc -= 18; why.push(['single-drone only', 'neg']); }
  const envMap = { indoor: ['tex'], tunnel: ['deg', 'dark'], dark: ['dark'], smoke: ['smoke'], fast: ['spin', 'vib'], loops: ['drift'] };
  const envLbl = { tex: 'low texture', deg: 'corridors', dark: 'darkness', smoke: 'smoke', spin: 'fast motion', vib: 'vibration', drift: 'long-range drift' };
  const seen = new Set();
  for (const e of ans.env) for (const k of envMap[e]) { if (seen.has(k)) continue; seen.add(k); const v = m.fails[k]; if (v === 2) { sc -= 16; why.push(['fails: ' + envLbl[k], 'neg']); } else if (v === 1) { sc -= 6; why.push(['degrades: ' + envLbl[k], '']); } else why.push(['robust: ' + envLbl[k], 'pos']); }
  if (cpu === 'small') { if (m.cost === 3) { sc -= 30; why.push(['too heavy for small ARM', 'neg']); } else if (m.cost === 2) { sc -= 10; why.push(['tight on small ARM', '']); } else why.push(['light compute', 'pos']); }
  if (cpu === 'nuc' && m.cost === 1) why.push(['light compute', 'pos']);
  if (cpu === 'offline' && prio === 'flight' && m.cost === 3) sc -= 10;
  if ([...ans.ros][0] === 'ros2') { if (/ROS 2/.test(m.ros)) why.push(['ROS 2', 'pos']); else { sc -= 12; why.push(['no official ROS 2', 'neg']); } }
  if (/flown|Real|onboard|Onboard/.test(m.drone.join(' ')) && /(onboard|Onboard|flights|flown)/.test(m.drone[0])) why.push(['flight evidence', 'pos']);
  return { ok, s: Math.round(clamp(sc, 1, 99)), why: why.slice(0, 7) };
}
function fitAdvice(ans, top) {
  const a = [];
  const S = ans.sens, E = ans.env;
  const lid = S.has('livox') || S.has('spin'), cam = S.has('mono') || S.has('stereo');
  if (E.has('tunnel') && lid && !cam) a.push('LiDAR alone slides along featureless corridors; adding a camera (FAST-LIVO2) or using LiDAR intensity (COIN-LIO, Ouster) removes most of that.');
  if (E.has('tunnel') && lid && cam) a.push('With LiDAR and a camera, tight LiDAR-visual fusion covers both corridors and darkness.');
  if ((E.has('dark') || E.has('smoke')) && !lid && !S.has('thermal') && !S.has('radar')) a.push('Cameras alone cannot see in darkness or smoke; consider adding a LiDAR, a thermal camera or a small radar.');
  if (E.has('smoke') && !S.has('thermal') && !S.has('radar')) a.push('Dense smoke and dust also corrupt LiDAR; thermal (CompSLAM, ROVTIO) or radar (EKF-RIO) channels are the proven fixes.');
  if (E.has('loops')) a.push('For revisits, prefer a system with loop closure or add a pose-graph back-end.');
  if ([...ans.cpu][0] === 'small') a.push('On a small ARM board, filters and ESIKF-based LIO (OpenVINS, S-MSCKF, FAST-LIO2, Point-LIO) have published embedded timings.');
  return a.join(' ');
}

/* ============================ LINEAGE ============================ */
const LINEAGE = {
  nodes: [
    { id: 'msckf', label: 'MSCKF (2007)', y: 2013, f: 'vio' }, { id: 'svo', label: 'SVO', y: 2014, f: 'vio', dy: 24 }, { id: 'okvis', label: 'OKVIS', y: 2015, f: 'vio', dy: -26 }, { id: 'rovio', label: 'ROVIO', y: 2015.4, f: 'vio', dy: 26 },
    { id: 'orbslam2', label: 'ORB-SLAM2', y: 2017, f: 'vio', dy: -26 }, { id: 'svo-pro', label: 'SVO Pro', y: 2017.3, f: 'vio', dy: 26 }, { id: 'vins-fusion', label: 'VINS-Mono/Fusion', y: 2018, f: 'vio' }, { id: 's-msckf', label: 'S-MSCKF', y: 2018.2, f: 'vio', dy: -26 },
    { id: 'openvins', label: 'OpenVINS', y: 2020, f: 'vio', dy: -26 }, { id: 'basalt', label: 'Basalt', y: 2020, f: 'vio', dy: 26 }, { id: 'kimera-vio', label: 'Kimera-VIO', y: 2020.3, f: 'vio' }, { id: 'orb-slam3', label: 'ORB-SLAM3', y: 2021, f: 'vio', dy: -26 },
    { id: 'dm-vio', label: 'DM-VIO', y: 2022, f: 'vio', dy: 26 }, { id: 'okvis2', label: 'OKVIS2', y: 2022.4, f: 'vio' }, { id: 'aspire', label: 'ASPIRE-VINS', y: 2026, f: 'vio' },
    { id: 'loam', label: 'LOAM', y: 2014, f: 'lio' }, { id: 'legoloam', label: 'LeGO-LOAM', y: 2018, f: 'lio', dy: -24 }, { id: 'lio-sam', label: 'LIO-SAM', y: 2020, f: 'lio', dy: -24 }, { id: 'fast-lio', label: 'FAST-LIO', y: 2021, f: 'lio', dy: 24 },
    { id: 'fast-lio2', label: 'FAST-LIO2', y: 2022, f: 'lio' }, { id: 'dlo', label: 'DLO', y: 2022, f: 'lio', dy: -26 }, { id: 'faster-lio', label: 'Faster-LIO', y: 2022.2, f: 'lio', dy: 26 }, { id: 'point-lio', label: 'Point-LIO', y: 2023, f: 'lio', dy: 26 },
    { id: 'dlio', label: 'DLIO', y: 2023, f: 'lio', dy: -26 }, { id: 'kiss-icp', label: 'KISS-ICP', y: 2023.3, f: 'lio' }, { id: 'ig-lio', label: 'iG-LIO', y: 2024, f: 'lio', dy: -26 },
    { id: 'lvi-sam', label: 'LVI-SAM', y: 2021, f: 'livo', dy: -18 }, { id: 'super-odometry', label: 'Super Odometry', y: 2021.2, f: 'livo', dy: 18 }, { id: 'r2live', label: 'R2LIVE', y: 2021.6, f: 'livo', dy: -18 }, { id: 'r3live', label: 'R3LIVE', y: 2022, f: 'livo', dy: 18 }, { id: 'fast-livo', label: 'FAST-LIVO', y: 2022.4, f: 'livo', dy: -18 }, { id: 'fast-livo2', label: 'FAST-LIVO2', y: 2024, f: 'livo' },
    { id: 'zhang16', label: 'Degeneracy factor', y: 2016, f: 'deg' }, { id: 'ultimate-slam', label: 'Ultimate SLAM', y: 2018, f: 'deg', dy: -18 }, { id: 'ktio', label: 'KTIO thermal', y: 2019, f: 'deg', dy: 18 }, { id: 'ekf-rio', label: 'EKF-RIO', y: 2020, f: 'deg', dy: -18 }, { id: 'rovtio', label: 'ROVTIO', y: 2021, f: 'deg', dy: 18 },
    { id: 'pl-evio', label: 'PL-EVIO', y: 2023, f: 'deg', dy: -18 }, { id: 'xicp', label: 'X-ICP', y: 2024, f: 'deg', dy: 18 }, { id: 'coin-lio', label: 'COIN-LIO', y: 2024.3, f: 'deg', dy: -18 }, { id: 'compslam', label: 'CompSLAM', y: 2025, f: 'deg', dy: 18 },
    { id: 'droid-slam', label: 'DROID-SLAM', y: 2021, f: 'lrn' }, { id: 'airvo', label: 'AirVO', y: 2023, f: 'lrn', dy: -18 }, { id: 'dpvo', label: 'DPVO', y: 2023, f: 'lrn', dy: 18 }, { id: 'dpv-slam', label: 'DPV-SLAM', y: 2024, f: 'lrn', dy: 18 }, { id: 'monogs', label: 'MonoGS', y: 2024, f: 'lrn', dy: -18 },
    { id: 'mast3r-slam', label: 'MASt3R-SLAM', y: 2025, f: 'lrn', dy: 18 }, { id: 'airslam', label: 'AirSLAM', y: 2025, f: 'lrn', dy: -18 }, { id: 'vggt-slam', label: 'VGGT-SLAM', y: 2025.6, f: 'lrn' },
    { id: 'ccm', label: 'CCM-SLAM', y: 2019, f: 'swm' }, { id: 'door-slam', label: 'DOOR-SLAM', y: 2020, f: 'swm', dy: -16 }, { id: 'covins', label: 'COVINS', y: 2021, f: 'swm', dy: 16 }, { id: 'omni-swarm', label: 'Omni-swarm', y: 2022, f: 'swm', dy: -16 }, { id: 'kimera-multi', label: 'Kimera-Multi', y: 2022.3, f: 'swm', dy: 16 },
    { id: 'covins-g', label: 'COVINS-G', y: 2023, f: 'swm', dy: -16 }, { id: 'd2slam', label: 'D²SLAM', y: 2024, f: 'swm', dy: 16 }, { id: 'swarm-slam', label: 'Swarm-SLAM', y: 2024.2, f: 'swm', dy: -16 },
  ],
  edges: [['msckf', 's-msckf'], ['msckf', 'openvins'], ['okvis', 'okvis2'], ['svo', 'svo-pro'], ['okvis', 'svo-pro'], ['orbslam2', 'orb-slam3'], ['rovio', 'rovtio'], ['vins-fusion', 'lvi-sam'], ['kimera-vio', 'kimera-multi'], ['vins-fusion', 'omni-swarm'],
    ['loam', 'legoloam'], ['legoloam', 'lio-sam'], ['lio-sam', 'lvi-sam'], ['fast-lio', 'fast-lio2'], ['fast-lio2', 'faster-lio'], ['fast-lio2', 'point-lio'], ['dlo', 'dlio'], ['fast-lio2', 'coin-lio'], ['fast-lio', 'r2live'], ['r2live', 'r3live'], ['fast-lio2', 'fast-livo'], ['fast-livo', 'fast-livo2'], ['loam', 'super-odometry'],
    ['zhang16', 'xicp'], ['zhang16', 'compslam'], ['ktio', 'compslam'], ['droid-slam', 'dpvo'], ['dpvo', 'dpv-slam'], ['airvo', 'airslam'], ['ccm', 'covins'], ['covins', 'covins-g'], ['omni-swarm', 'd2slam'], ['door-slam', 'swarm-slam'], ['orb-slam3', 'covins']]
};

/* ============================ BUILD ============================ */
const BUILDS = [
  { name: 'A · Camera-first, light', sub: 'smallest, cheapest; good light only', parts: [['Frame', 'Holybro X500 V2 (or 250 mm)'], ['Camera', 'RealSense D435i (75 g) / D455 (116 g)'], ['Computer', 'Jetson Orin Nano Super (7–25 W)'], ['FC', 'Pixhawk-class, PX4'], ['Optional', 'ModalAI VOXL 2 (16 g) as turnkey VIO']], note: 'Fails in darkness, smoke and on blank walls. Fine for lit indoor spaces and as a VIO research platform.', runs: ['openvins', 'vins-fusion', 'orb-slam3', 'basalt', 'airslam'] },
  { name: 'B · LiDAR + camera (recommended)', sub: 'robust indoor / underground / forest', parts: [['Frame', 'Holybro X500 V2 (1.5 kg payload)'], ['LiDAR', 'Livox Mid-360 (265 g, 6.5 W, built-in IMU)'], ['Camera', 'Global-shutter, hardware-triggered'], ['Computer', 'Jetson Orin NX 16 GB or Intel NUC'], ['FC', 'Pixhawk-class, PX4 (ROS 2 via uXRCE-DDS)']], note: 'LIO for flight; add the camera for corridors and coloured maps. Synchronise LiDAR, camera and IMU in hardware.', runs: ['fast-lio2', 'point-lio', 'fast-livo2', 'super-odometry', 'r3live'] },
  { name: 'C · Degraded-environment (SubT-style)', sub: 'darkness, smoke, dust, fog', parts: [['LiDAR', 'Ouster OS0/OS1 (≈500 g, 15 W) or Mid-360'], ['Thermal', 'FLIR Boson 640 (from 7.5 g)'], ['Radar', 'TI IWR6843AOP (≈1.2 W)'], ['Camera', 'Global-shutter visible'], ['Computer', 'Jetson Orin NX / x86']], note: 'Heavier and needs integration work, but every hazard in the flight test has a channel that survives it.', runs: ['compslam', 'rovtio', 'ekf-rio', 'coin-lio', 'super-odometry'] },
];
const HW = [
  { name: 'Livox Mid-360', type: '3D LiDAR, non-repetitive', mass: '265 g', power: '6.5 W avg', spec: '360° × (−7° to 52°); 40 m @ 10 % / 70 m @ 80 % reflectivity; 200,000 pts/s; 10 Hz; 0.1 m blind zone; built-in IMU (ICM40609); US $749 stated on product page', src: 'https://www.livoxtech.com/mid-360/specs' },
  { name: 'Ouster OS1 (Rev 8)', type: '3D LiDAR, spinning', mass: '500 g (580 g with cap)', power: '15 W nominal', spec: '32/64/128 channels; 44° vertical FoV; 90 m @ 10 %; price on request', src: 'https://data.ouster.io/downloads/datasheets/datasheet-rev8-v4p0-os1.pdf' },
  { name: 'RealSense D435i', type: 'Active stereo depth + IMU', mass: '75 g', power: '≤ 3.5 W', spec: '50 mm baseline; depth FoV 87° × 58°; global-shutter imagers; US $399', src: 'https://www.realsenseai.com/wp-content/uploads/2026/03/RealSense-D400-Series-Datasheet-Mar-2026.pdf' },
  { name: 'RealSense D455', type: 'Active stereo depth + IMU', mass: '116 g', power: '≤ 3.5 W', spec: '95 mm baseline (better range); global-shutter RGB; US $499', src: 'https://www.realsenseai.com/wp-content/uploads/2026/03/RealSense-D400-Series-Datasheet-Mar-2026.pdf' },
  { name: 'Luxonis OAK-D Pro W', type: 'Stereo + on-device AI', mass: '—', power: '2.5–3 W base; up to 15 W', spec: 'Wide 127° HFoV global-shutter stereo; IR dot projector + flood; BNO086 IMU; 4 TOPS VPU; US $529', src: 'https://docs.luxonis.com/hardware/products/OAK-D%20Pro%20W' },
  { name: 'ModalAI VOXL 2', type: 'Compute + flight core + VIO', mass: '16 g', power: '0.1–7 W', spec: 'QRB5165, 8 GB, 15 TOPS NPU; PX4/ArduPilot on DSP; VOXL SDK VIO/SLAM; US $1,399.99 (board)', src: 'https://www.modalai.com/products/voxl-2' },
  { name: 'Jetson Orin Nano Super Dev Kit', type: 'Companion computer', mass: '—', power: '7 / 15 / 25 W modes', spec: '67 sparse INT8 TOPS; 1024-core Ampere GPU; 6-core A78AE; 8 GB; US $249', src: 'https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/nano-super-developer-kit/' },
  { name: 'Jetson Orin NX 16 GB', type: 'Companion computer module', mass: '—', power: '10 / 15 / 25 / 40 W modes', spec: '157 sparse INT8 TOPS (Super); 8-core A78AE; 16 GB LPDDR5', src: 'https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/' },
  { name: 'FLIR Boson 640', type: 'Thermal LWIR camera', mass: 'from 7.5 g', power: 'from 0.6 W', spec: '640 × 512, 12 µm VOx; 60 Hz; 8–95° lenses', src: 'https://oem.flir.com/products/boson/' },
  { name: 'FLIR Lepton 3.5', type: 'Thermal LWIR camera', mass: '—', power: '0.15 W (0.65 W during shutter)', spec: '160 × 120, 57° HFoV, 8.6 Hz, radiometric', src: 'https://oem.flir.com/products/lepton/' },
  { name: 'TI IWR6843AOP', type: '60–64 GHz mmWave radar', mass: '—', power: '1.19–1.25 W avg', spec: '4 RX / 3 TX antennas-on-package; on-chip DSP; ≈ US $35 (1–99 qty)', src: 'https://www.ti.com/product/IWR6843AOP' },
  { name: 'Holybro X500 V2', type: '500 mm quadrotor frame', mass: '610 g', power: '—', spec: '1500 g payload (no battery, 70 % throttle); ~18 min hover without payload; frame kit US $135', src: 'https://holybro.com/products/x500-v2-kits' },
];
const FC = [
  { name: 'PX4 · EKF2 external vision', desc: 'Send pose (and ideally velocity) from the SLAM node; EKF2 fuses it with the autopilot IMU. Frames: PX4 uses NED world / FRD body; ROS uses ENU / FLU.', rows: [
    ['ROS 2 topic', '<code>/fmu/in/vehicle_visual_odometry</code> · <code>px4_msgs/VehicleOdometry</code> via uXRCE-DDS'],
    ['ROS 1 / MAVROS', '<code>/mavros/odometry/out</code> (nav_msgs/Odometry → ODOMETRY) or <code>/mavros/vision_pose/pose</code> (→ VISION_POSITION_ESTIMATE)'],
    ['Rate', '30–50 Hz; too slow and EKF2 will not fuse'],
    ['EKF2_EV_CTRL', 'bitmask: 1 horiz. pos · 2 vert. pos · 4 velocity · 8 yaw (default 0)'],
    ['EKF2_HGT_REF', '3 = Vision (to use the SLAM altitude)'],
    ['EKF2_EV_DELAY', 'vision latency vs IMU, 0–300 ms; tune from logs'],
    ['EKF2_EV_POS_X/Y/Z', 'sensor offset from the vehicle centre of gravity'],
    ['Disable GPS etc.', 'EKF2_GPS_CTRL, EKF2_BARO_CTRL, EKF2_RNG_CTRL as needed'],
    ['Frames', 'ENU→NED: rotate π/2 about Z then π about X; FLU→FRD: π about X (px4_ros_com frame_transforms)']],
    src: [['External position estimation', 'https://docs.px4.io/main/en/ros/external_position_estimation.html'], ['Parameter reference', 'https://docs.px4.io/main/en/advanced_config/parameter_reference.html'], ['VehicleOdometry', 'https://docs.px4.io/main/en/msg_docs/VehicleOdometry.html'], ['ROS 2 guide', 'https://docs.px4.io/main/en/ros2/user_guide.html']] },
  { name: 'ArduPilot · EKF3 ExternalNav', desc: 'MAVLink ODOMETRY is preferred; set the EKF source to ExternalNav and set an EKF origin manually when there is no GPS.', rows: [
    ['VISO_TYPE', '1 = MAVLink (2 = Intel T265, 3 = ModalAI VOXL); reboot'],
    ['EK3_SRC1_POSXY', '6 = ExternalNav'], ['EK3_SRC1_VELXY', '6 = ExternalNav (or 0)'], ['EK3_SRC1_POSZ', '1 = Baro (safer) or 6 = ExternalNav'], ['EK3_SRC1_YAW', '6 = ExternalNav (disable compasses) or 1 = Compass'],
    ['Messages', 'ODOMETRY (preferred), VISION_POSITION_ESTIMATE, …; ≥ 4 Hz'], ['Origin', 'set EKF origin from GCS or the ahrs-set-origin.lua script'], ['Source sets', 'switch between up to 3 source sets in flight (RCx_OPTION = 90)']],
    src: [['Non-GPS position estimation', 'https://ardupilot.org/dev/docs/mavlink-nongps-position-estimation.html'], ['EKF source selection', 'https://ardupilot.org/copter/docs/common-ekf-sources.html']] },
];
const SIMS = [
  { name: 'PX4 SITL + Gazebo', engine: 'Gazebo (gz) · ROS 2', use: 'Full flight-stack test: her SLAM node feeds EKF2 exactly as on hardware; add sensor noise and failures.', link: ['docs.px4.io', 'https://docs.px4.io/main/en/sim_gazebo_gz/'] },
  { name: 'MARSIM', engine: 'HKU MaRS · lightweight LiDAR sim', use: 'Point-realistic LiDAR UAV simulation used with FAST-LIO2 / ROG-Map stacks; fast enough for planning research.', link: ['hku-mars/MARSIM', gh('hku-mars/MARSIM')] },
  { name: 'Isaac Sim + Pegasus', engine: 'NVIDIA Omniverse · PX4', use: 'Photorealistic cameras and RTX LiDAR with PX4 in the loop; good for learned perception.', link: ['PegasusSimulator', gh('PegasusSimulator/PegasusSimulator')] },
  { name: 'AirSim / Colosseum', engine: 'Unreal Engine', use: 'Photorealistic visual simulation; AirSim is archived by Microsoft, Colosseum continues it.', link: ['CodexLabsLLC/Colosseum', gh('CodexLabsLLC/Colosseum')] },
  { name: 'Flightmare', engine: 'Unity + fast dynamics', use: 'Fast quadrotor dynamics and rendering for agile flight and learning.', link: ['uzh-rpg/flightmare', gh('uzh-rpg/flightmare')] },
  { name: 'TartanAir', engine: 'Unreal (dataset)', use: 'Synthetic data with exact ground truth across lighting and weather; DROID-SLAM was trained on it.', link: ['theairlab.org', 'https://theairlab.org/tartanair-dataset/'] },
];

/* ============================ DATASETS ============================ */
const DATASETS = [
  { name: 'EuRoC MAV', year: 2016, platform: 'Drone (MAV) · Vicon / laser tracker', uav: true, why: 'The standard VIO benchmark from a real micro aerial vehicle. Good visibility only, so it measures nominal accuracy.', sensors: ['stereo 20 Hz', 'IMU 200 Hz'], url: 'https://ethz-asl.github.io/datasets/euroc-mav/', paper: doi('10.1177/0278364915620033') },
  { name: 'UZH-FPV', year: 2019, platform: 'Racing drone, expert pilot · laser tracker', uav: true, why: 'Most aggressive drone motion; large accelerations and blur. The IROS 2019 VIO competition (won by OpenVINS) used it.', sensors: ['cameras', 'IMU', 'event camera'], url: 'https://fpv.ifi.uzh.ch/', paper: doi('10.1109/ICRA.2019.8793887') },
  { name: 'KAIST VIO', year: 2021, platform: 'Drone · OptiTrack', uav: true, why: 'Pure-rotation and head-rotation flights; the dataset behind the Jetson benchmark on this page.', sensors: ['D435i IR stereo', 'Pixhawk IMU'], url: gh('url-kaist/kaistviodataset'), paper: arx('2103.01655') },
  { name: 'NTU VIRAL', year: 2022, platform: 'DJI M600 hexacopter · total station', uav: true, why: 'The aerial dataset with LiDAR, cameras and UWB together — test LIO, LIVO and UWB fusion on real flights.', sensors: ['2× Ouster OS1-16', 'stereo', 'IMU', 'UWB'], url: 'https://ntu-aris.github.io/ntu_viral_dataset/', paper: arx('2202.00379') },
  { name: 'MARS-LVIG', year: 2024, platform: 'DJI M300 · 80–130 m altitude · RTK', uav: true, why: 'High-altitude, long (up to 7 km) aerial LiDAR-visual-inertial flights over texture-poor terrain.', sensors: ['Livox Avia', 'RGB', 'IMU', 'GNSS'], url: 'https://mars.hku.hk/dataset.html', paper: doi('10.1177/02783649241227968') },
  { name: 'SubT-MRS', year: 2024, platform: 'Aerial, legged, wheeled, handheld · scan-map GT', uav: true, why: 'The broadest degraded-condition benchmark: smoke, dust, darkness, tunnels, snow.', sensors: ['VLP-16', 'fisheye', 'thermal', 'IMU'], url: 'https://superodometry.com/datasets', paper: arx('2307.07607') },
  { name: 'M3ED', year: 2023, platform: 'Car, Spot, UAV (forest, urban) · LIO pseudo-GT', uav: true, why: 'HD stereo events on a real UAV in forests; note ground truth comes from FasterLIO.', sensors: ['stereo event 1280×720', 'Ouster OS1-64', 'IMU'], url: 'https://m3ed.io/', paper: doi('10.1109/CVPRW59228.2023.00419') },
  { name: 'Hilti 2022', year: 2022, platform: 'Handheld · mm survey points', uav: false, why: 'Construction sites with stairs, dark rooms and featureless walls; mm-accurate sparse ground truth.', sensors: ['Hesai XT-32', '5 cameras', 'IMU'], url: 'https://hilti-challenge.com/dataset-2022', paper: arx('2208.09825') },
  { name: 'Hilti 2023', year: 2023, platform: 'Handheld + ground robot · survey points', uav: false, why: 'Adds multi-session (map reuse) benchmarks.', sensors: ['LiDAR', 'multi-camera', 'IMU'], url: 'https://www.hilti-challenge.com/dataset-2023.html', paper: arx('2404.09765') },
  { name: 'GEODE', year: 2025, platform: 'Helmet, UGV, boat · multiple GT sources', uav: false, why: 'Built to test LiDAR degeneracy: tunnels, bridges, stairs, flat fields, three LiDAR types.', sensors: ['Velodyne', 'Ouster', 'Livox', 'stereo', 'IMU'], url: gh('PengYu-Team/GEODE_dataset'), paper: arx('2409.04961') },
  { name: 'ENWIDE', year: 2024, platform: 'Handheld · total station', uav: false, why: 'Long geometrically degenerate tunnels and fields; the COIN-LIO benchmark.', sensors: ['Ouster OS0-128', 'IMU'], url: 'https://projects.asl.ethz.ch/datasets/enwide/', paper: arx('2310.01235') },
  { name: 'TUM-VI', year: 2018, platform: 'Handheld · mocap at start/end', uav: false, why: 'Long indoor/outdoor sequences expose VIO drift; photometrically calibrated.', sensors: ['stereo 20 Hz', 'IMU 200 Hz'], url: 'https://cvg.cit.tum.de/data/datasets/visual-inertial-dataset', paper: arx('1804.06120') },
  { name: 'ColoRadar', year: 2022, platform: 'Sensor rig · mines, hallways, outdoors', uav: false, why: 'Raw 3D mmWave radar with LiDAR and IMU, including a mine — for radar-inertial work.', sensors: ['TI radars', 'Ouster OS1-64', 'IMU'], url: 'https://arpg.colorado.edu/coloradar/', paper: arx('2103.04510') },
  { name: 'VECtor', year: 2022, platform: 'Handheld / helmet · mocap', uav: false, why: 'Event-centric multi-sensor SLAM with HDR and fast motion.', sensors: ['stereo event', 'stereo', 'RGB-D', 'LiDAR', 'IMU'], url: 'https://star-datasets.github.io/vector/', paper: arx('2207.01404') },
  { name: 'FusionPortable V2', year: 2024, platform: 'Handheld, legged, UGV, car', uav: false, why: 'Cross-platform generalisation with frames and events.', sensors: ['Ouster', 'frame + event', 'IMU', 'GNSS'], url: 'https://fusionportable.github.io/dataset/fusionportable_v2/', paper: arx('2404.08563') },
  { name: 'TartanAir', year: 2020, platform: 'Simulation · exact GT', uav: false, why: 'Synthetic training data for learned VO across lighting and weather.', sensors: ['stereo', 'depth', 'flow', 'LiDAR'], url: 'https://theairlab.org/tartanair-dataset/', paper: arx('2003.14338') },
];

/* ============================ ROADMAP ============================ */
const GAPS = [
  { t: 'Degeneracy-aware multi-modal fusion on one drone', d: 'Detect online which directions each sensor constrains (information-matrix eigen-analysis), and let the other modality take over only along those directions — instead of hard switching. Existing systems either treat it per-sensor (X-ICP, COIN-LIO) or with heuristics (CompSLAM, Super Odometry). A drone-flown, open, tightly coupled version is missing.', read: [['Zhang 2016 degeneracy', doi('10.1109/ICRA.2016.7487211')], ['X-ICP', arx('2211.16335')], ['COIN-LIO', '#coin-lio'], ['FAST-LIVO2', '#fast-livo2'], ['Super Odometry', '#super-odometry'], ['CompSLAM', '#compslam']], feas: 'High', hw: 'Mid-360 + camera + Orin', start: 'FAST-LIVO2 code, ENWIDE / GEODE / SubT-MRS' },
  { t: 'Radar-inertial(-LiDAR) odometry for smoke and fog', d: 'Single-chip mmWave radars are light and cheap, and EKF-RIO shows Doppler velocity alone flies a drone in fog. Fusing radar Doppler tightly into a LIO/LIVO estimator — so the drone degrades gracefully when smoke corrupts LiDAR — is open, measurable and publishable.', read: [['EKF-RIO / x-RIO', '#ekf-rio'], ['Kramer et al. ICRA 2020', doi('10.1109/ICRA40945.2020.9196666')], ['ColoRadar dataset', arx('2103.04510')], ['FAST-LIO2', '#fast-lio2']], feas: 'High', hw: '+ TI IWR6843AOP (~$35)', start: 'rio repo + ColoRadar, then own smoke tests' },
  { t: 'An onboard embedded benchmark for 2026 methods', d: 'Jeon et al. (2021) measured VIO on Jetsons, but nothing comparable exists for LIO, LIVO and learned methods on Orin-class boards. A careful, open benchmark (accuracy, CPU/GPU, memory, power, latency) on her own drone and on NTU VIRAL / UZH-FPV is highly cited and a solid first paper.', read: [['Jeon et al. 2021', arx('2103.01655')], ['Delmerico & Scaramuzza 2018', doi('10.1109/ICRA.2018.8460664')], ['KAIST VIO dataset', gh('url-kaist/kaistviodataset')]], feas: 'High', hw: 'Orin Nano + Orin NX', start: 'evo, tegrastats, the methods on this page' },
  { t: 'Thermal-inertial odometry that copes with FFC and flat scenes', d: 'Thermal sees through smoke and darkness, but flat-field-correction freezes and thermally flat scenes break tracking. Learned thermal features (TP-TIO) were never released; ROVTIO has no published evaluation. A reproducible, open TIO with FFC handling would fill a clear gap.', read: [['Khattak KTIO', arx('1903.00798')], ['TP-TIO', arx('2012.03455')], ['ROVTIO', '#rovtio'], ['CompSLAM', '#compslam'], ['SubT-MRS', arx('2307.07607')]], feas: 'Medium', hw: '+ FLIR Boson/Lepton', start: 'ROVTIO + SubT-MRS thermal sequences' },
  { t: 'Learned front-ends that fit the flight computer', d: 'AirSLAM shows learned features can run at 40 FPS on an Orin; DPVO is accurate but desktop-only and IMU-free. Distilling or quantising a learned front-end and coupling it with IMU pre-integration on a Jetson is timely and measurable.', read: [['AirSLAM', '#airslam'], ['DPVO / DPV-SLAM', '#dpv-slam'], ['DROID-SLAM', '#droid-slam']], feas: 'Medium', hw: 'Orin NX / AGX', start: 'AirSLAM TensorRT pipeline' },
  { t: 'Agile flight: continuous-time and high-bandwidth estimation', d: 'Point-LIO updates per point; DLIO de-skews in continuous time; ASPIRE-VINS (RA-L 2026) uses adaptive B-splines for VIO. Bringing these ideas to camera + LiDAR fusion for aggressive flight with rolling-shutter sensors remains open.', read: [['Point-LIO', '#point-lio'], ['DLIO', '#dlio'], ['ASPIRE-VINS', arx('2608.12840')], ['UZH-FPV', 'https://fpv.ifi.uzh.ch/']], feas: 'Medium', hw: 'Agile quad + LiDAR', start: 'Point-LIO code, UZH-FPV' },
  { t: 'Aerial validation of collaborative SLAM', d: 'Most multi-robot SLAM (Swarm-SLAM, Kimera-Multi, COVINS-G) was evaluated on ground robots or datasets. Flying two or three drones with a ROS 2 back-end under real bandwidth limits, in GPS-denied space, is still rare.', read: [['D²SLAM', '#d2slam'], ['Swarm-SLAM', '#swarm-slam'], ['COVINS-G', '#covins-g'], ['DOOR-SLAM', '#door-slam']], feas: 'Medium-low', hw: '2–3 drones', start: 'Swarm-SLAM + FAST-LIO2 per drone' },
  { t: 'Map reuse for repeated inspection', d: 'Inspection drones revisit the same plant; relocalising into a prior map across lighting and seasonal changes (Atlas, multi-session Hilti 2023, foundation-model retrieval) is a practical gap for GPS-denied sites.', read: [['ORB-SLAM3 Atlas', '#orb-slam3'], ['Hilti 2023 multi-session', arx('2404.09765')], ['MASt3R-SLAM retrieval', '#mast3r-slam']], feas: 'Medium', hw: 'Any of the builds', start: 'ORB-SLAM3 map save/load; Hilti 2023' },
];
const ROAD = [
  { w: 'Weeks 1–3', t: 'Foundations', items: ['Read Cadena et al., <a href="https://arxiv.org/abs/1606.05830" target="_blank">Past, Present, and Future of SLAM</a>.', 'Read Forster et al., <a href="https://arxiv.org/abs/1512.02363" target="_blank">On-Manifold Preintegration</a> (the IMU factor in most VIO).', 'Read ORB-SLAM3 and FAST-LIO2 papers end to end.', 'Read the two drone benchmarks: Delmerico 2018 and Jeon 2021.'] },
  { w: 'Weeks 4–6', t: 'Reproduce baselines', items: ['Set up ROS 2 and <a href="https://github.com/MichaelGrupp/evo" target="_blank">evo</a> for ATE/RPE.', 'Run OpenVINS and ORB-SLAM3 on EuRoC; check numbers against the table above.', 'Run FAST-LIO2 and FAST-LIVO2 on NTU VIRAL.', 'Write down every failure seen — that list seeds the thesis.'] },
  { w: 'Weeks 7–10', t: 'Simulation and hardware', items: ['PX4 SITL + Gazebo: feed a SLAM node into EKF2 via /fmu/in/vehicle_visual_odometry.', 'Assemble build A or B; calibrate with <a href="https://github.com/ethz-asl/kalibr" target="_blank">Kalibr</a>; hardware time sync.', 'Record hand-carried bags in the target building, then tethered/low flights.', 'Measure onboard CPU, memory and power.'] },
  { w: 'Weeks 11–16', t: 'Pick a gap and start', items: ['Choose one research direction above and re-read its prior work.', 'Reproduce the strongest baseline on her own data.', 'Implement a first small change; evaluate on two datasets + own flights.', 'Draft a workshop paper or benchmark note.'] },
];

const EXTRA_SOURCES = [
  ['PX4 — Using external position estimation', 'https://docs.px4.io/main/en/ros/external_position_estimation.html'],
  ['PX4 — Parameter reference (EKF2_EV_*)', 'https://docs.px4.io/main/en/advanced_config/parameter_reference.html'],
  ['PX4 — VehicleOdometry message', 'https://docs.px4.io/main/en/msg_docs/VehicleOdometry.html'],
  ['PX4 — ROS 2 user guide (frames)', 'https://docs.px4.io/main/en/ros2/user_guide.html'],
  ['ArduPilot — Non-GPS position estimation', 'https://ardupilot.org/dev/docs/mavlink-nongps-position-estimation.html'],
  ['ArduPilot — EKF source selection', 'https://ardupilot.org/copter/docs/common-ekf-sources.html'],
  ['Intel PCN 807360-01 — RealSense T265 end of life', 'https://cdrdv2-public.intel.com/807360/PCN807360-01.pdf'],
  ['RACER (T-RO 2023) — power budget of a multi-UAV explorer', arx('2209.08533')],
  ['Fast-Drone-250 (ZJU FAST Lab)', gh('ZJU-FAST-Lab/Fast-Drone-250')],
  ['Delmerico & Scaramuzza — A Benchmark Comparison of Monocular VIO Algorithms for Flying Robots (ICRA 2018)', doi('10.1109/ICRA.2018.8460664')],
  ['Cadena et al. — Past, Present, and Future of SLAM (T-RO 2016)', arx('1606.05830')],
  ['Forster et al. — On-Manifold Preintegration (T-RO 2017)', arx('1512.02363')],
  ['Zhang, Kaess, Singh — On degeneracy of optimization-based state estimation problems (ICRA 2016)', doi('10.1109/ICRA.2016.7487211')],
  ['Super Odometry / SubT-MRS datasets', 'https://superodometry.com/datasets'],
  ['evo — trajectory evaluation', gh('MichaelGrupp/evo')],
  ['Kalibr — camera/IMU calibration', gh('ethz-asl/kalibr')],
  ...HW.map(x => [x.name + ' — specification', x.src]),
];
const METHOD_NOTE = 'Research began with three Gemini Deep Research reports (drone VIO/LIO/learned methods; degraded environments; multi-drone, autonomy stack and research gaps). Those reports were used as leads only: every paper, repository, licence, number and specification on this page was then re-checked against the arXiv/publisher PDF, the official README, Crossref, or the vendor page. Several report claims were wrong and were corrected (for example FAST-LIO2 is GPL-2.0, not MIT; FAST-LIVO2\'s 30 ms is on a desktop i7, not a Jetson; the Livox Mid-360 weighs 265 g, not 95 g). Ratings and simulations are editorial.';
