/* ===== link helpers ===== */
const doi = (d) => 'https://doi.org/' + d, arx = (a) => 'https://arxiv.org/abs/' + a, gh = (r) => 'https://github.com/' + r;
const ARX = (a) => ['arXiv ' + a, arx(a)];

/* extra estimator profiles used by data */
Object.assign(EST, {
  vio_mono_loop: { name: 'Mono VIO + loop closure', col: COL.vis, cam: 'mono', base: .010, loop: true },
  learned_vo: { name: 'Learned dense VO (no loop)', col: COL.lrn, cam: 'mono', base: .007, lowlight: .35, learned: true },
});

const METHODS = [];

/* ============================ VISUAL-INERTIAL ============================ */
METHODS.push({
  id: 'vins-fusion', name: 'VINS-Mono / Fusion', fam: 'vio', year: 2018, venue: 'IEEE T-RO', license: 'GPL-3.0',
  authors: 'Qin, Li, Shen (Mono) · Qin, Pan, Cao, Shen (Fusion)', lab: 'HKUST Aerial Robotics Group',
  title: 'VINS-Mono: A Robust and Versatile Monocular Visual-Inertial State Estimator',
  sensors: 'Mono + IMU · stereo (+ IMU)', sensorsFull: 'Monocular camera + IMU (VINS-Mono); stereo, stereo + IMU, mono + IMU (VINS-Fusion); rolling-shutter and online time-offset support',
  core: 'Tightly coupled nonlinear optimisation (Ceres)', opt: 'Sliding window + Schur marginalisation; 4-DoF pose graph', map: 'Sparse features + keyframe pose graph', loop: 'Yes: DBoW2 + 4-DoF pose graph',
  compute: 'CPU', ros: 'ROS 1 official', kind: 'VIO + loop closure', est: 'vio_mono_loop',
  hook: 'The drone-born baseline: it closed the control loop on a quadrotor in its own paper.',
  verdict: 'A sound first system to get running: designed on and for quadrotors, with a single camera, robust initialisation and loop closure. Expect to pin old dependencies (ROS Kinetic/Melodic, Ceres 1.14) or use a community ROS 2 port. Monocular scale is fragile under hover and pure yaw, so prefer the stereo + IMU mode of VINS-Fusion on a real drone.',
  mech: (p) => graphSim(p, 'window', { loop: true }), mechCap: 'sliding window of 10 keyframes · IMU pre-integration · loop → 4-DoF pose graph',
  how: [['Initialise', 'Vision-only structure-from-motion is aligned with IMU pre-integration to recover metric scale, gravity, velocity and gyro bias — the step that lets a single camera fly.'], ['Track', 'Shi-Tomasi corners tracked with KLT optical flow; keyframes chosen by parallax and track count.'], ['Optimise', 'A 10-keyframe window jointly minimises reprojection and IMU residuals; old states are marginalised into a prior.'], ['Close loops', 'DBoW2 finds revisits; a 4-DoF (x, y, z, yaw) pose graph corrects drift, since roll and pitch are observable from gravity.']],
  facts: [['100 Hz', 'state output used for quadrotor feedback control (window optimisation runs at 10 Hz)', ['VINS-Mono T-RO, Sec. IX-D', arx('1708.03852')]], ['0.29 %', 'drift in a closed-loop figure-eight flight, 61.97 m, loop closure off', ['VINS-Mono T-RO, Sec. IX-D', arx('1708.03852')]], ['0.110 m', 'average EuRoC ATE, mono-inertial, re-run by the ORB-SLAM3 authors', ['ORB-SLAM3 T-RO, Table II', arx('2007.11898')]]],
  pros: ['Developed and flown on quadrotors; the paper runs it onboard (Intel i7-5500U) to close the control loop', 'Monocular + IMU is the lightest sensor set that gives metric scale', 'Loop closure, relocalisation and map reuse included', 'VINS-Fusion adds stereo and stereo + IMU with the same code base', 'The most forked VIO; many drone stacks (e.g. Fast-Drone-250 tutorials) build on it'],
  cons: ['0.110 m average EuRoC ATE vs 0.035 m for ORB-SLAM3 stereo-inertial in the same table', 'VINS-Mono\'s own paper has no EuRoC RMSE table (plots only); numbers usually quoted come from other papers', 'Official code targets ROS Kinetic/Melodic and Ceres 1.14; newer Ceres fails to compile', 'Monocular scale needs acceleration; hover and pure yaw are weakly observable', 'VINS-Fusion README: “paper is not exactly same with code”'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 0 },
  failNotes: { spin: 'Pure rotation gives no parallax for monocular depth', vib: 'Needs a soft-mounted or well-modelled IMU', deg: 'Geometry-free: unaffected by LiDAR-type degeneracy' },
  scores: { acc: 3, eff: 3, rob: 3, map: 1, glo: 4, rdy: 4 },
  drone: ['VINS-Mono paper: self-built quadrotor, forward-looking global-shutter fisheye (mvBlueFOX), DJI A3 IMU at 100 Hz, onboard i7-5500U; VINS-Mono ran onboard and closed the control loop (Sec. IX-D).', 'Jeon et al. (RA-L 2021) ran VINS-Mono, VINS-Fusion and its GPU variant on Jetson TX2, Xavier NX and AGX Xavier; see Benchmarks. VINS-Mono diverged on the NX in the pure-rotation sequences.'],
  setup: ['Use a <b>global-shutter</b> camera with hardware-triggered timestamps if possible; calibrate camera–IMU with Kalibr.', 'For ROS 2 or new Ubuntu, use a community port and pin Ceres; test on EuRoC first, then your own bag.', 'Feed the 100 Hz propagated odometry (not the 10 Hz window output) to PX4 via <code>/fmu/in/vehicle_visual_odometry</code> or MAVROS.'],
  papers: [{ t: 'VINS-Mono: A Robust and Versatile Monocular Visual-Inertial State Estimator', v: 'IEEE T-RO 34(4), 2018', links: [['DOI', doi('10.1109/TRO.2018.2853729')], ARX('1708.03852')] }, { t: 'A General Optimization-based Framework for Local Odometry Estimation with Multiple Sensors (VINS-Fusion)', v: 'arXiv technical report, 2019', links: [ARX('1901.03638')] }],
  code: gh('HKUST-Aerial-Robotics/VINS-Fusion'), codeNote: 'VINS-Fusion (also github.com/HKUST-Aerial-Robotics/VINS-Mono). GPL-3.0.',
  req: { cam: 'mono', imu: true }, cost: 2
});

METHODS.push({
  id: 'openvins', name: 'OpenVINS', fam: 'vio', year: 2020, venue: 'IEEE ICRA', license: 'GPL-3.0',
  authors: 'Geneva, Eckenhoff, Lee, Yang, Huang', lab: 'RPNG, University of Delaware',
  title: 'OpenVINS: A Research Platform for Visual-Inertial Estimation',
  sensors: 'Mono / stereo / multi-cam + IMU', sensorsFull: 'Monocular, synchronised stereo, binocular or multiple cameras + IMU',
  core: 'MSCKF with first-estimate Jacobians', opt: 'On-manifold sliding-window EKF (stochastic cloning)', map: 'Optional SLAM landmarks / ArUco tags in state', loop: 'Not in estimator; loosely coupled ov_secondary',
  compute: 'CPU', ros: 'ROS 1 + ROS 2 official', kind: 'Odometry', est: 'vio_filter',
  hook: 'The research-grade filter: online calibration, ROS 2, and 1st at the IROS 2019 FPV drone-racing VIO competition.',
  verdict: 'The strongest choice as a <b>research platform</b>: clean modular code, official ROS 1 and ROS 2, online camera–IMU extrinsic/intrinsic/time-offset calibration, simulator and evaluation tools. Filter cost is bounded and predictable, which suits flight control. It is odometry: add a loop-closure back-end if she needs global consistency.',
  mech: (p) => graphSim(p, 'msckf', { clones: 11 }), mechCap: 'MSCKF: IMU state + cloned poses; features constrain clones then are dropped',
  how: [['Propagate', 'IMU integrated on-manifold; a clone of the current pose is added to the state at each image.'], ['Track', 'FAST + KLT (or descriptor) tracks across the clone window.'], ['Update', 'When a track ends, its constraints on the cloned poses are used and the feature is projected out of the measurement (null-space) — no landmark kept.'], ['Calibrate online', 'Camera intrinsics, camera–IMU extrinsics and time offset can be estimated in the filter state.']],
  facts: [['1st place', 'IROS 2019 FPV Drone Racing VIO competition (UZH-FPV)', ['OpenVINS README, News', gh('rpng/open_vins')]], ['0.055 m', 'stereo VIO, mean ATE over EuRoC V1_01–V2_02, ten runs', ['OpenVINS ICRA 2020, Table II', 'https://pgeneva.com/downloads/papers/Geneva2020ICRA.pdf']], ['4.3×', 'faster than real time, mono VIO, single thread, Xeon E3-1505M', ['OpenVINS ICRA 2020, Sec. V', 'https://pgeneva.com/downloads/papers/Geneva2020ICRA.pdf']]],
  pros: ['Official ROS 1 and ROS 2 support, plus a ROS-free build', 'Online calibration of intrinsics, extrinsics and camera–IMU time offset', 'Bounded, predictable filter cost — friendly to flight control', 'Won the IROS 2019 FPV drone-racing VIO competition', 'Built-in simulator and evaluation tools make it a research workbench'],
  cons: ['No loop closure in the estimator; ov_secondary is loosely coupled (“no information is returned to the estimator”)', 'Authors state timing was not rigorously evaluated and the OpenCV front-end limits speed; Basalt was faster', 'GPL-3.0 licence', 'Camera-only perception: dark, smoke and blank walls still break it'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 2 },
  failNotes: { drift: 'Odometry only: drift grows without loop closure', spin: 'Stereo helps; FPV racing results show it handles agile motion' },
  scores: { acc: 4, eff: 4, rob: 3, map: 1, glo: 2, rdy: 5 },
  drone: ['The ICRA paper evaluates on datasets; agile-flight evidence is its 1st place in the IROS 2019 FPV drone-racing VIO competition on UZH-FPV (README).', 'Commonly used as the VIO baseline in drone research because of its calibration tooling and ROS 2 support.'],
  setup: ['Start with the EuRoC and UZH-FPV launch files, then record her own bag and run with online calibration enabled.', 'Pair with a loop-closure back-end (ov_secondary or a pose-graph package) if missions revisit places.', 'ROS 2: <code>ov_msckf</code> publishes odometry that can be converted to PX4 NED/FRD.'],
  papers: [{ t: 'OpenVINS: A Research Platform for Visual-Inertial Estimation', v: 'IEEE ICRA 2020, pp. 4666–4672', links: [['DOI', doi('10.1109/ICRA40945.2020.9196524')], ['PDF', 'https://pgeneva.com/downloads/papers/Geneva2020ICRA.pdf'], ['docs', 'https://docs.openvins.com']] }, { t: 'A Multi-State Constraint Kalman Filter for Vision-aided Inertial Navigation (MSCKF)', v: 'IEEE ICRA 2007 (Mourikis & Roumeliotis)', links: [['DOI', doi('10.1109/ROBOT.2007.364024')]] }],
  code: gh('rpng/open_vins'), codeNote: 'GPL-3.0. ROS 1, ROS 2 and ROS-free builds.',
  req: { cam: 'mono', imu: true }, cost: 1
});

METHODS.push({
  id: 'orb-slam3', name: 'ORB-SLAM3', fam: 'vio', year: 2021, venue: 'IEEE T-RO', license: 'GPL-3.0',
  authors: 'Campos, Elvira, Gómez Rodríguez, Montiel, Tardós', lab: 'University of Zaragoza',
  title: 'ORB-SLAM3: An Accurate Open-Source Library for Visual, Visual–Inertial, and Multimap SLAM',
  sensors: 'Mono / stereo / RGB-D (+ IMU)', sensorsFull: 'Monocular, stereo or RGB-D; pin-hole or fisheye; IMU with mono or stereo',
  core: 'MAP estimation, reprojection + IMU', opt: 'Local visual-inertial BA + pose graph + full BA', map: 'Sparse ORB map points; multi-map Atlas', loop: 'Yes: DBoW2, map merging',
  compute: 'CPU', ros: 'ROS 1 examples; community ROS 2', kind: 'Full SLAM', est: 'vio_loop',
  hook: 'Lowest average EuRoC error in its comparison — and it survives tracking loss by starting a new map.',
  verdict: 'The accuracy reference for camera-based SLAM and the best visual choice when the drone revisits places (inspection loops, warehouse aisles). Heavier on CPU than filters; tune the feature count on a Jetson. Its sparse map is not usable for obstacle avoidance, so pair it with a depth map (e.g. nvblox, Voxblox).',
  mech: (p) => graphSim(p, 'atlas', { window: 10 }), mechCap: 'tracking · local BA window · Atlas: lost → new map → merge on revisit',
  how: [['Track', 'ORB features matched to the active map; pose found by minimising reprojection error (and IMU residuals).'], ['Local mapping', 'A covisibility window of keyframes refined by visual or visual-inertial bundle adjustment.'], ['Initialise inertial', 'MAP inertial initialisation: about 5 % scale error after 2 s of motion and 1 % after 15 s.'], ['Atlas', 'When tracking is lost a new map is started; on recognising a common place, maps are merged and loops closed.']],
  facts: [['0.035 m', 'average EuRoC ATE, stereo-inertial (all 11 sequences)', ['ORB-SLAM3 T-RO, Table II', arx('2007.11898')]], ['0.043 m', 'average EuRoC ATE, monocular-inertial', ['ORB-SLAM3 T-RO, Table II', arx('2007.11898')]], ['1000–1500', 'ORB points per image used for stereo-inertial / mono-inertial on EuRoC', ['ORB-SLAM3 T-RO, Sec. VIII', arx('2007.11898')]]],
  pros: ['Lowest average EuRoC ATE in its comparison table (stereo-inertial 0.035 m)', 'Every camera configuration in one library, with or without IMU', 'Atlas multi-map survives tracking loss and merges maps later', 'Loop closure and map reuse; maps can be saved and loaded'],
  cons: ['Feature extraction is CPU-heavy; on Jetson-class boards the feature count must be reduced', 'Sparse map is not an obstacle map', 'Official ROS support is old ROS 1 examples (no package.xml in repo); ROS 2 via community wrappers', 'Inertial initialisation needs a few seconds of exciting motion before it is reliable'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 0 },
  failNotes: { dark: 'Paper applies CLAHE to handle under- and over-exposure in EuRoC', drift: 'Loop closure and map merging bound drift on revisits' },
  scores: { acc: 5, eff: 3, rob: 4, map: 1, glo: 5, rdy: 4 },
  drone: ['EuRoC is recorded from a micro aerial vehicle, so the Table II numbers are drone data (stereo + IMU, AscTec Firefly). The paper does not report onboard flight.', 'Jeon et al. (RA-L 2021) ran ORB-SLAM2 stereo (predecessor) on Jetson boards; it was among the highest CPU users.'],
  setup: ['Reduce ORB features (e.g. 1000 → 600–800) and image size for a Jetson; check that tracking keeps up with camera rate.', 'Use stereo-inertial mode with a global-shutter stereo pair; give the IMU a few seconds of motion before relying on scale.', 'Add a dense mapper for planning; ORB-SLAM3 provides poses, not free space.'],
  papers: [{ t: 'ORB-SLAM3: An Accurate Open-Source Library for Visual, Visual–Inertial, and Multimap SLAM', v: 'IEEE T-RO 37(6), 2021', links: [['DOI', doi('10.1109/TRO.2021.3075644')], ARX('2007.11898')] }],
  code: gh('UZ-SLAMLab/ORB_SLAM3'), codeNote: 'GPL-3.0.',
  req: { cam: 'mono', imu: false }, cost: 2
});

METHODS.push({
  id: 'basalt', name: 'Basalt', fam: 'vio', year: 2020, venue: 'IEEE RA-L', license: 'BSD-3-Clause',
  authors: 'Usenko, Demmel, Schubert, Stückler, Cremers', lab: 'TU Munich',
  title: 'Visual-Inertial Mapping with Non-Linear Factor Recovery',
  sensors: 'Stereo + IMU', sensorsFull: 'Stereo camera + IMU; wide-angle (double-sphere) camera models',
  core: 'Fixed-lag smoothing with KLT patch tracks', opt: 'Sliding window (7 KF + 3 states); offline global BA', map: 'Sparse keypoints (offline mapper)', loop: 'Offline only (basalt_mapper)',
  compute: 'CPU', ros: 'Bag input; no official ROS node', kind: 'Odometry (+ offline map)', est: 'vio_stereo',
  hook: 'Fast, accurate stereo-inertial odometry under a permissive BSD licence.',
  verdict: 'Very efficient and accurate stereo VIO with a <b>BSD licence</b> (useful if code may be commercialised). It lacks an official ROS node and online loop closure, so she would wrap it herself. A good second baseline next to OpenVINS.',
  mech: (p) => graphSim(p, 'window', { window: 7 }), mechCap: 'fixed-lag window; marginalisation priors re-used as non-linear factors for mapping',
  how: [['Track', 'KLT-style patch tracking on stereo images — no descriptors needed for odometry.'], ['Optimise', 'Fixed-lag window of 7 keyframes and 3 latest states with IMU pre-integration.'], ['Recover factors', 'Marginalisation information is turned back into non-linear relative-pose and roll–pitch factors.'], ['Map offline', 'Those factors plus ORB keypoints form a global BA problem solved by a separate mapping tool.']],
  facts: [['7.83 ms', 'average VIO time per frame on EuRoC, Intel E5-1620 (4 cores)', ['Basalt RA-L, Sec. VI-D', arx('1904.06504')]], ['0.04–0.13 m', 'stereo VIO RMS ATE across EuRoC (V2_03 excluded)', ['Basalt RA-L, Table I', arx('1904.06504')]], ['~4×', 'faster than real time: MH_05, 114 s of data in 19.2 s VIO + 9.7 s mapping', ['Basalt RA-L, Sec. VI-D', arx('1904.06504')]]],
  pros: ['Among the fastest accurate stereo VIOs (7.8 ms/frame on a desktop CPU)', 'BSD-3-Clause licence', 'Supports very wide-angle lenses (double-sphere model)', 'Good accuracy on EuRoC (0.051 m average in ORB-SLAM3 Table II, 10/11 sequences)'],
  cons: ['Loop closure and mapping are offline batch tools', 'No official ROS node — needs a wrapper', 'Stereo required for VIO', 'V2_03 excluded in the paper (missing frames)'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 2 },
  scores: { acc: 4, eff: 5, rob: 3, map: 1, glo: 2, rdy: 3 },
  drone: ['Evaluated on EuRoC (MAV) and TUM-VI datasets; no flight experiments in the paper.'],
  setup: ['Read EuRoC folders or ROS 1 bags directly with the provided tools; write a thin ROS 2 node for live use.', 'Calibrate with Basalt\'s own calibration tool (supports the double-sphere model).'],
  papers: [{ t: 'Visual-Inertial Mapping with Non-Linear Factor Recovery', v: 'IEEE RA-L 5(2), 2020', links: [['DOI', doi('10.1109/LRA.2019.2961227')], ARX('1904.06504')] }],
  code: gh('VladyslavUsenko/basalt'), codeNote: 'BSD-3-Clause. Mirror of gitlab.com/VladyslavUsenko/basalt.',
  req: { cam: 'stereo', imu: true }, cost: 1
});

METHODS.push({
  id: 'kimera-vio', name: 'Kimera-VIO', fam: 'vio', year: 2020, venue: 'IEEE ICRA', license: 'BSD-2-Clause',
  authors: 'Rosinol, Abate, Chang, Carlone', lab: 'MIT SPARK Lab',
  title: 'Kimera: an Open-Source Library for Real-Time Metric-Semantic Localization and Mapping',
  sensors: 'Stereo + IMU (mono optional)', sensorsFull: 'Stereo + IMU; optional mono + IMU',
  core: 'Structureless vision factors + IMU pre-integration', opt: 'GTSAM iSAM2 fixed-lag smoother', map: 'Per-frame 3D mesh; global semantic TSDF mesh', loop: 'Yes: Kimera-RPGO (robust PGO, PCM)',
  compute: 'CPU', ros: 'ROS 1 wrapper (Kimera-VIO-ROS)', kind: 'VI-SLAM + mesh', est: 'vio_loop',
  hook: 'VIO that also builds a 3D mesh fast enough for obstacle avoidance — and a semantic map.',
  verdict: 'Pick Kimera when the map matters as much as the pose: it produces a low-latency mesh and, with Kimera-Semantics, a labelled map. Robust pose-graph back-end (outlier-rejecting loop closures). Heavier than a pure VIO and ROS 1-centred.',
  mech: (p) => graphSim(p, 'window', { loop: true }), mechCap: 'iSAM2 fixed-lag smoother · robust loop closures (PCM) · mesh from keyframes',
  how: [['Front-end', 'Shi-Tomasi + KLT tracks, stereo matching, RANSAC; ~4.5 ms per frame.'], ['Back-end', 'GTSAM iSAM2 fixed-lag smoother with structureless vision factors and pre-integrated IMU.'], ['RPGO', 'Loop closures from DBoW2, filtered by pairwise consistency maximisation before robust PGO.'], ['Mesh', 'Per-frame and multi-frame meshes in 5–15 ms; global TSDF mesh and semantics optional.']],
  facts: [['0.05–0.35 m', 'EuRoC RMSE ATE, fixed-lag VIO (with RPGO 0.05–0.24 m)', ['Kimera ICRA 2020, Table II', arx('1910.02490')]], ['< 5 ms', 'per-frame mesh for low-latency obstacle avoidance', ['Kimera ICRA 2020, Sec. III-D', arx('1910.02490')]], ['0.119 m', 'average EuRoC ATE, stereo-inertial (ORB-SLAM3 comparison)', ['ORB-SLAM3 T-RO, Table II', arx('2007.11898')]]],
  pros: ['Mesh and semantic map alongside the pose', 'Outlier-robust loop closure (PCM + GNC)', 'Modular GTSAM back-end — easy to add new factors', 'Basis of Kimera-Multi for multi-robot work'],
  cons: ['Paper does not name the CPU used for timing', 'Highest memory use among VIOs on all Jetsons in Jeon et al. 2021', 'Dense stereo struggles on texture-less walls (main source of mesh error)', 'Official wrapper is ROS 1'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 0 },
  scores: { acc: 3, eff: 3, rob: 3, map: 4, glo: 4, rdy: 3 },
  drone: ['Evaluated on EuRoC (MAV data). Jeon et al. 2021 ran Kimera on Jetson TX2, Xavier NX and AGX Xavier: it ran on all three but used the most memory.'],
  setup: ['Use Kimera-VIO-ROS on ROS Noetic, or bridge to ROS 2.', 'Disable Kimera-Semantics on small computers; keep the per-frame mesh for avoidance.'],
  papers: [{ t: 'Kimera: an Open-Source Library for Real-Time Metric-Semantic Localization and Mapping', v: 'IEEE ICRA 2020', links: [['DOI', doi('10.1109/ICRA40945.2020.9196885')], ARX('1910.02490')] }],
  code: gh('MIT-SPARK/Kimera-VIO'), codeNote: 'BSD licence (LICENSE.BSD). ROS wrapper: github.com/MIT-SPARK/Kimera-VIO-ROS.',
  req: { cam: 'stereo', imu: true }, cost: 2
});

METHODS.push({
  id: 'okvis2', name: 'OKVIS2', fam: 'vio', year: 2022, venue: 'arXiv', license: 'BSD-style',
  authors: 'Leutenegger', lab: 'TUM / ETH Mobile Robotics Lab',
  title: 'OKVIS2: Realtime Scalable Visual-Inertial SLAM with Loop Closure',
  sensors: 'Multi-camera (stereo) + IMU', sensorsFull: 'Multiple cameras (stereo evaluated) + IMU; live RealSense D435i / D455 support',
  core: 'Reprojection + pre-integrated IMU + relative pose factors', opt: 'Bounded realtime window + pose-graph frames; async full optimisation', map: 'Sparse BRISK landmarks; optional CNN sky masking', loop: 'Yes: DBoW2 + BRISK; graph re-optimised',
  compute: 'CPU (optional LibTorch)', ros: 'ROS 2 official (Jazzy)', kind: 'VI-SLAM', est: 'vio_loop',
  hook: 'Scalable VI-SLAM whose pose-graph edges turn back into observations when places are revisited.',
  verdict: 'Accurate stereo-inertial SLAM with loop closure and an official <b>ROS 2</b> build, supporting RealSense cameras live. Research code: the README warns it needs accurate calibration and time sync. A strong alternative to ORB-SLAM3 if she wants ROS 2.',
  mech: (p) => graphSim(p, 'window', { loop: true, window: 8 }), mechCap: 'realtime window (frames + keyframes + loop frames) · pose-graph frames · async full optimisation',
  how: [['Detect & match', 'BRISK2 keypoints; matches to the map and triangulation.'], ['Realtime graph', 'Bounded window: 3 recent frames, 5 keyframes and 5 loop-closure frames, optimised with Ceres.'], ['Pose graph', 'Older frames become pose-graph nodes; their edges are converted back to observations when revisited.'], ['Loop closure', 'DBoW2 queries; on success the full graph is re-optimised asynchronously.']],
  facts: [['0.048 m', 'average EuRoC ATE, causal SLAM (0.071 VIO; 0.031 final non-causal)', ['OKVIS2 arXiv, Table I', arx('2202.09199')]], ['33.2 ms', 'realtime optimisation per frame on MH_05, Intel i7-11700K', ['OKVIS2 arXiv, Table III', arx('2202.09199')]], ['0.28 m', 'TUM-VI magistrale average ATE vs 0.81 m for ORB-SLAM3', ['OKVIS2 arXiv, Table II', arx('2202.09199')]]],
  pros: ['Official ROS 2 build and live RealSense support', 'Loop closure with long-term consistency on large indoor sequences (TUM-VI magistrale)', 'Accuracy on par with ORB-SLAM3 on EuRoC'],
  cons: ['arXiv preprint (not peer reviewed); not to be confused with OKVIS2-X (T-RO 2025)', 'README “health warning”: needs accurate intrinsics, extrinsics, IMU noise and time sync', 'Robust monocular VI-SLAM listed as future work', 'Desktop timing only (i7-11700K)'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 0 },
  scores: { acc: 4, eff: 3, rob: 3, map: 1, glo: 5, rdy: 3 },
  drone: ['Evaluated on EuRoC (MAV) and TUM-VI (handheld). No flight experiments in the preprint.'],
  setup: ['Build with <code>BUILD_ROS2</code> on Ubuntu 24.04 / Jazzy; run on a RealSense D455 first.', 'Invest in calibration and time sync before judging accuracy.'],
  papers: [{ t: 'OKVIS2: Realtime Scalable Visual-Inertial SLAM with Loop Closure', v: 'arXiv preprint, 2022', links: [ARX('2202.09199')] }],
  code: gh('ethz-mrl/okvis2'), codeNote: 'BSD-style licence (also reachable as smartroboticslab/okvis2).',
  req: { cam: 'stereo', imu: true }, cost: 2
});

METHODS.push({
  id: 'svo-pro', name: 'SVO Pro', fam: 'vio', year: 2017, venue: 'IEEE T-RO', license: 'GPL-3.0',
  authors: 'Forster, Zhang, Gassner, Werlberger, Scaramuzza', lab: 'UZH Robotics & Perception Group',
  title: 'SVO: Semidirect Visual Odometry for Monocular and Multicamera Systems',
  sensors: 'Mono / stereo / multi-cam (+ IMU)', sensorsFull: 'Monocular, stereo, multi-camera; pin-hole, fisheye, catadioptric; SVO Pro adds IMU (mono or stereo)',
  core: 'Semi-direct: sparse image alignment + feature refinement', opt: 'SVO Pro: OKVIS-style sliding window (Ceres)', map: 'Sparse points + edgelets; optional iSAM2 global map', loop: 'SVO Pro: DBoW2 → global BA / pose graph',
  compute: 'CPU', ros: 'ROS 1 official', kind: 'VO / VIO', est: 'vio_direct',
  hook: 'Built for micro aerial vehicles: 2.5 ms per frame on a laptop, a few ms on a Jetson TX1.',
  verdict: 'The lightest-weight visual front-end in this list, designed for downward-looking cameras on micro aerial vehicles. Excellent when compute is tiny and frame rate is high (40–80 fps). Direct alignment needs photometric consistency, so it suffers with auto-exposure jumps and darkness; mono VO fails on fast Vicon-room sequences.',
  mech: (p) => graphSim(p, 'window', { window: 8 }), mechCap: 'semi-direct tracking → SVO Pro sliding-window VIO back-end',
  how: [['Sparse image alignment', 'Pose from photometric error of small patches around known 3D points — no descriptor matching.'], ['Feature alignment', 'Each patch refined to sub-pixel against its reference keyframe.'], ['Depth filter', 'New points are triangulated with a probabilistic depth filter before use.'], ['SVO Pro', 'Adds IMU and a sliding-window optimiser, plus DBoW2 loop closure into a global map.']],
  facts: [['2.53 ms', 'per frame, monocular, Intel i7-2760QM (EuRoC MH_01)', ['SVO T-RO, Table II', 'https://rpg.ifi.uzh.ch/docs/TRO16_Forster-SVO.pdf']], ['~13 ms', 'per frame across both threads on a Jetson TX1 (sum of per-component times)', ['SVO T-RO, Table III', 'https://rpg.ifi.uzh.ch/docs/TRO16_Forster-SVO.pdf']], ['0.159 m', 'average EuRoC ATE, stereo SVO (ORB-SLAM3 comparison)', ['ORB-SLAM3 T-RO, Table II', arx('2007.11898')]]],
  pros: ['Extremely low compute; per-component Jetson TX1 timings published', 'Designed for MAVs with downward and wide-angle cameras', 'Multi-camera and fisheye models', 'SVO Pro adds VIO and loop closure'],
  cons: ['Plain mono SVO fails on EuRoC V1_03 and V2_03 (motion blur, on-spot rotation)', 'Authors: most robust with 40–80 fps cameras', 'SVO Pro README: global map uses much memory and may occasionally crash; tracking unstable after loop closure', 'ROS 1 only'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 2, vib: 1, dyn: 1, drift: 1 },
  failNotes: { spin: 'Mono SVO fails on on-spot rotation sequences (paper)', dark: 'Direct methods need photometric consistency' },
  scores: { acc: 3, eff: 5, rob: 2, map: 1, glo: 3, rdy: 3 },
  drone: ['T-RO paper: “Circle” dataset flown by a micro aerial vehicle in a motion-capture room with a down-facing camera (perspective vs fisheye). Onboard vs offboard not stated.', 'Per-component timings on a Jetson TX1 are given in Table III.'],
  setup: ['Use a high frame-rate global-shutter camera; disable auto-exposure or calibrate photometrically.', 'Start with VIO mode on EuRoC; enable the global map only if memory allows.'],
  papers: [{ t: 'SVO: Semidirect Visual Odometry for Monocular and Multicamera Systems', v: 'IEEE T-RO 33(2), 2017', links: [['DOI', doi('10.1109/TRO.2016.2623335')], ['PDF', 'https://rpg.ifi.uzh.ch/docs/TRO16_Forster-SVO.pdf']] }, { t: 'SVO: Fast Semi-Direct Monocular Visual Odometry', v: 'IEEE ICRA 2014', links: [['DOI', doi('10.1109/ICRA.2014.6906584')]] }],
  code: gh('uzh-rpg/rpg_svo_pro_open'), codeNote: 'GPL-3.0. SVO Pro is a code release (no separate paper).',
  req: { cam: 'mono', imu: false }, cost: 1
});

METHODS.push({
  id: 's-msckf', name: 'S-MSCKF', fam: 'vio', year: 2018, venue: 'IEEE RA-L', license: 'Penn licence (non-commercial)',
  authors: 'Sun, Mohta, Pfrommer, Watterson, Liu, Mulgaonkar, Taylor, Kumar', lab: 'UPenn GRASP Lab',
  title: 'Robust Stereo Visual Inertial Odometry for Fast Autonomous Flight',
  sensors: 'Stereo + IMU', sensorsFull: 'Synchronised stereo cameras + IMU',
  core: 'Stereo MSCKF with observability constraint', opt: 'EKF (OC-EKF)', map: 'None persistent', loop: 'No',
  compute: 'CPU', ros: 'ROS 1 official', kind: 'Odometry', est: 'vio_filter',
  hook: 'Flown at 17.5 m/s and on a forest-to-warehouse round trip with < 0.5 % drift.',
  verdict: 'The clearest evidence of <b>fast, real drone flight</b> with a filter VIO: 17.5 m/s runway flights and a fully autonomous indoor–outdoor round trip, using ~10 % of one core for the filter. Old (ROS Kinetic) and non-commercial licence, but an ideal reference for low-compute, high-speed flight.',
  mech: (p) => graphSim(p, 'msckf', { clones: 9 }), mechCap: 'stereo MSCKF: IMU + clone window; features marginalised after use',
  how: [['Stereo front-end', 'FAST features tracked with KLT in time and matched across the stereo pair.'], ['Propagate', 'IMU integration with an observability-constrained EKF to avoid spurious information on yaw/position.'], ['Update', 'Stereo feature tracks constrain cloned poses (MSCKF); features are not kept in the state.'], ['Bounded cost', 'Filter alone is about 10 % of one core at 20 Hz; most compute is the front-end.']],
  facts: [['17.5 m/s', 'fastest runway flight dataset (5–17.5 m/s) with lowest CPU among compared VIOs', ['S-MSCKF RA-L, Sec. IV-B', arx('1712.00036')]], ['< 0.5 %', 'drift (~3 m over ~700 m), autonomous forest-to-warehouse round trip', ['S-MSCKF RA-L, Sec. IV-C', arx('1712.00036')]], ['~10 %', 'of one CPU core for the filter at 20 Hz (NUC6i7KYK)', ['S-MSCKF RA-L, Sec. IV-A', arx('1712.00036')]]],
  pros: ['Real, fast, autonomous drone flight in the paper (3 kg quadrotor, onboard NUC)', 'Very low filter cost', 'Hardware-synchronised stereo + VN-100 IMU setup documented', 'Simple, readable code'],
  cons: ['Fails on EuRoC V2_03 (KLT used for both temporal and stereo matching)', 'Must start stationary; may jump or diverge once prior uncertainty is large', 'No loop closure; ROS Kinetic era', 'Penn licence restricts commercial use'],
  fails: { dark: 2, tex: 2, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 2 },
  scores: { acc: 3, eff: 5, rob: 3, map: 1, glo: 1, rdy: 3 },
  drone: ['3 kg Falcon quadrotor, onboard Intel NUC5i7RYH, two PointGrey cameras at 40 Hz (960×800) and a VectorNav VN-100 at 200 Hz, IMU-triggered sync; runway flights up to 17.5 m/s and autonomous indoor/outdoor flight (Sec. IV).', 'Jeon et al. 2021: S-MSCKF ran on all three Jetsons with memory similar to monocular methods.'],
  setup: ['Hardware-trigger the stereo pair from the IMU, as in the paper.', 'Start stationary (first 200 IMU messages initialise biases).'],
  papers: [{ t: 'Robust Stereo Visual Inertial Odometry for Fast Autonomous Flight', v: 'IEEE RA-L 3(2), 2018', links: [['DOI', doi('10.1109/LRA.2018.2793349')], ARX('1712.00036')] }],
  code: gh('KumarRobotics/msckf_vio'), codeNote: 'Penn Software licence (see LICENSE.txt).',
  req: { cam: 'stereo', imu: true }, cost: 1
});

METHODS.push({
  id: 'dm-vio', name: 'DM-VIO', fam: 'vio', year: 2022, venue: 'IEEE RA-L', license: 'GPL-3.0',
  authors: 'von Stumberg, Cremers', lab: 'TU Munich',
  title: 'DM-VIO: Delayed Marginalization Visual-Inertial Odometry',
  sensors: 'Mono + IMU', sensorsFull: 'Monocular camera + IMU; photometric calibration optional',
  core: 'Direct photometric bundle adjustment (DSO-based)', opt: 'Sliding window (8 KF) + delayed marginalisation', map: 'Sparse direct points', loop: 'No',
  compute: 'CPU', ros: 'ROS 1 wrapper (author)', kind: 'Odometry', est: 'vio_direct',
  hook: 'Monocular-inertial that rivals stereo systems — by delaying marginalisation.',
  verdict: 'The most accurate <b>monocular</b>-inertial odometry here and helpful when only one camera fits. Direct, so it needs good photometry and is hurt by darkness. No loop closure. Useful as a mono baseline and to study IMU initialisation.',
  mech: (p) => graphSim(p, 'window', { window: 8 }), mechCap: 'direct window · a delayed copy of the graph lets the IMU prior be re-linearised',
  how: [['Direct tracking', 'DSO-style photometric alignment of sparse high-gradient pixels.'], ['Window', 'Up to 8 keyframes optimised photometrically with IMU factors.'], ['Delayed marginalisation', 'A second, delayed graph keeps variables long enough to re-linearise scale and gravity.'], ['IMU initialiser', 'Multi-stage initialiser with pose-graph BA (GTSAM).']],
  facts: [['0.069 m', 'EuRoC average ATE, monocular-inertial (Basalt stereo 0.072, VINS-Mono 0.184 in same table)', ['DM-VIO RA-L, Table I', arx('2201.04114')]], ['10.3 ms', 'average tracking time on a 2013 laptop (i7 2.3 GHz)', ['DM-VIO RA-L, Sec. IV-A', arx('2201.04114')]], ['2.11 m', 'TUM-VI outdoors8 ATE vs 13.53 m for Basalt (stereo)', ['DM-VIO RA-L, Table II', arx('2201.04114')]]],
  pros: ['Best monocular-inertial accuracy in its comparison', 'Runs on a laptop CPU without GPU', 'Robust initialisation useful for mono drones'],
  cons: ['No loop closure (future work)', 'Needs consistent camera–IMU timestamps; datasheet IMU noise usually must be inflated', 'Direct photometric: darkness and exposure jumps hurt', 'ROS 1 only'],
  fails: { dark: 2, tex: 1, deg: 0, smoke: 2, spin: 1, vib: 1, dyn: 1, drift: 2 },
  failNotes: { tex: 'Uses any high-gradient pixel, including edges on plain walls' },
  scores: { acc: 4, eff: 4, rob: 3, map: 1, glo: 1, rdy: 2 },
  drone: ['Evaluated on EuRoC (MAV), TUM-VI and 4Seasons; no flight experiments.'],
  setup: ['Use the dm-vio-ros wrapper; supply exposure times if available.', 'Inflate IMU noise from the datasheet values as the README advises.'],
  papers: [{ t: 'DM-VIO: Delayed Marginalization Visual-Inertial Odometry', v: 'IEEE RA-L 7(2), 2022', links: [['DOI', doi('10.1109/LRA.2021.3140129')], ARX('2201.04114')] }],
  code: gh('lukasvst/dm-vio'), codeNote: 'GPL-3.0. ROS wrapper: github.com/lukasvst/dm-vio-ros.',
  req: { cam: 'mono', imu: true }, cost: 1
});
