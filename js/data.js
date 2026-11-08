/* Demo data for the MalariaFL Console.
 * Everything here is made up but consistent, so every page tells the same story.
 * Later, replace this file with calls to the real server API. */
(function () {
  'use strict';

  // Repeatable random numbers, so the demo looks the same every time.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const now = Date.now();
  const minAgo = (m) => new Date(now - m * 60000);

  // ------------------------------------------------------------ model size
  // MobileNetV2 with a 2-class output: values in one model update.
  // Phones train the last block and the classifier of MobileNetV2: 413,442 values.
  const MODEL_VALUES = 413442;
  const BLOCK = 1024;
  const HEADER = 16;

  /** Exact upload size in bytes for one update (same format as tools/fl_core.py). */
  function updateBytes(p, n = MODEL_VALUES) {
    const dense = p.method !== 'topk' || p.topk >= 1;
    const k = dense ? n : Math.max(1, Math.floor(n * p.topk));
    const values = p.bits === 8 ? k + Math.ceil(k / BLOCK) * 4 : 4 * k;
    return HEADER + values + (dense ? 0 : 4 * k); // a 4-byte position for every kept value
  }

  // ------------------------------------------------------------ people
  const user = { name: 'Chanda Mwila', email: 'researcher@malariafl.org', role: 'Primary user', isPrimary: true };

  const users = [
    { name: 'Chanda Mwila', email: 'researcher@malariafl.org', role: 'Primary user', isPrimary: true, lastActive: minAgo(1) },
    { name: 'Dr. Ruth Banda', email: 'r.banda@malariafl.org', role: 'Researcher', lastActive: minAgo(180) },
    { name: 'Peter Lungu', email: 'p.lungu@malariafl.org', role: 'Researcher', lastActive: minAgo(1440) },
  ];

  // ------------------------------------------------------------ projects
  const projects = [
    {
      id: 'P-001', name: 'Malaria detection: Zambia pilot', status: 'active',
      description: 'Federated training across hospital laboratories in the Copperbelt and Luapula, with real devices and simulated clients.',
      task: 'Red blood cell: infected or uninfected', classes: ['Infected', 'Uninfected'],
      target: 'Recall at least 95%', created: minAgo(60 * 24 * 41), lead: 'Chanda Mwila',
      members: ['Chanda Mwila (Researcher)', 'Peter Lungu (Researcher)', 'Dr. Ruth Banda (Admin)'],
    },
    {
      id: 'P-002', name: 'Compression study (simulation)', status: 'active',
      description: 'Controlled comparison of gradient compression methods with 10 simulated clients on the NIH dataset.',
      task: 'Red blood cell: infected or uninfected', classes: ['Infected', 'Uninfected'],
      target: 'Accuracy within 1 point of no compression', created: minAgo(60 * 24 * 26), lead: 'Chanda Mwila',
      members: ['Chanda Mwila (Researcher)'],
    },
    {
      id: 'P-003', name: 'Tuberculosis chest X-ray (planned)', status: 'draft',
      description: 'Planned extension of the method to TB screening from chest X-rays.',
      task: 'Chest X-ray: TB or normal', classes: ['TB', 'Normal'],
      target: 'To be decided', created: minAgo(60 * 24 * 3), lead: 'Peter Lungu',
      members: ['Peter Lungu (Researcher)'],
    },
  ];

  // ------------------------------------------------------------ facilities
  const facilities = [
    { id: 'F-01', projectId: 'P-001', name: 'Ndola District Hospital', district: 'Ndola', province: 'Copperbelt', manager: 'Grace Mulenga', consent: 'Given', joined: minAgo(60 * 24 * 38) },
    { id: 'F-02', projectId: 'P-001', name: 'Kitwe Central Clinic', district: 'Kitwe', province: 'Copperbelt', manager: 'Joseph Mwale', consent: 'Given', joined: minAgo(60 * 24 * 35) },
    { id: 'F-03', projectId: 'P-001', name: 'Mansa General Hospital', district: 'Mansa', province: 'Luapula', manager: 'Agnes Chileshe', consent: 'Given', joined: minAgo(60 * 24 * 30) },
    { id: 'F-04', projectId: 'P-001', name: 'Nchelenge Health Centre', district: 'Nchelenge', province: 'Luapula', manager: 'Moses Kabwe', consent: 'Given', joined: minAgo(60 * 24 * 21) },
    { id: 'F-05', projectId: 'P-001', name: 'Chingola Urban Clinic', district: 'Chingola', province: 'Copperbelt', manager: 'Ireen Phiri', consent: 'Given', joined: minAgo(60 * 24 * 2) },
  ];

  // Staff accounts for the mobile app. Created here by the research team.
  // A phone is registered automatically the first time staff sign in on it.
  const staff = [
    { id: 'LAB001', name: 'Mutinta Banda', role: 'Laboratory technologist', facilityId: 'F-01', status: 'active', lastSignIn: minAgo(3) },
    { id: 'MGR001', name: 'Grace Mulenga', role: 'Facility manager', facilityId: 'F-01', status: 'active', lastSignIn: minAgo(45) },
    { id: 'KIT001', name: 'Joseph Mwale', role: 'Facility manager', facilityId: 'F-02', status: 'active', lastSignIn: minAgo(300) },
    { id: 'KIT002', name: 'Bwalya Tembo', role: 'Laboratory technologist', facilityId: 'F-02', status: 'active', lastSignIn: minAgo(70) },
    { id: 'MAN001', name: 'Agnes Chileshe', role: 'Facility manager', facilityId: 'F-03', status: 'active', lastSignIn: minAgo(60 * 6) },
    { id: 'MAN002', name: 'Chola Musonda', role: 'Laboratory technologist', facilityId: 'F-03', status: 'active', lastSignIn: minAgo(12) },
    { id: 'NCH001', name: 'Moses Kabwe', role: 'Facility manager', facilityId: 'F-04', status: 'active', lastSignIn: minAgo(60 * 26) },
    { id: 'NCH002', name: 'Esther Zulu', role: 'Laboratory technologist', facilityId: 'F-04', status: 'active', lastSignIn: minAgo(20) },
    { id: 'KIT003', name: 'Daniel Phiri', role: 'Laboratory technologist', facilityId: 'F-02', status: 'inactive', lastSignIn: minAgo(60 * 24 * 40) },
  ];

  // Local dataset summaries: counts only. Images never leave the facility.
  const localData = {
    'F-01': { images: 1240, infected: 486, uninfected: 754, confirmed: 1172, lastAdded: minAgo(35) },
    'F-02': { images: 860, infected: 214, uninfected: 646, confirmed: 801, lastAdded: minAgo(190) },
    'F-03': { images: 1510, infected: 902, uninfected: 608, confirmed: 1388, lastAdded: minAgo(70) },
    'F-04': { images: 420, infected: 301, uninfected: 119, confirmed: 344, lastAdded: minAgo(1500) },
    'F-05': { images: 0, infected: 0, uninfected: 0, confirmed: 0, lastAdded: null },
  };

  // ------------------------------------------------------------ devices
  const devices = [
    { id: 'D-0101', name: 'Lab phone 1', facilityId: 'F-01', mode: 'mobile', status: 'training', lastSeen: minAgo(0), battery: 84, network: 'Wi-Fi', app: '1.2.0', model: 'v1.3', rounds: 31, samples: 640, staffId: 'LAB001' },
    { id: 'D-0102', name: 'Lab computer', facilityId: 'F-01', mode: 'edge', status: 'training', lastSeen: minAgo(0), battery: null, network: 'Ethernet', app: '1.2.0', model: 'v1.3', rounds: 44, samples: 532 },
    { id: 'D-0201', name: 'Lab phone 1', facilityId: 'F-02', mode: 'mobile', status: 'training', lastSeen: minAgo(1), battery: 62, network: 'Wi-Fi', app: '1.2.0', model: 'v1.3', rounds: 27, samples: 801 },
    { id: 'D-0301', name: 'Lab computer', facilityId: 'F-03', mode: 'edge', status: 'training', lastSeen: minAgo(0), battery: null, network: 'Ethernet', app: '1.2.0', model: 'v1.3', rounds: 40, samples: 1388 },
    { id: 'D-0302', name: 'Lab phone 2', facilityId: 'F-03', mode: 'mobile', status: 'idle', lastSeen: minAgo(12), battery: 23, network: 'Mobile data', app: '1.2.0', model: 'v1.3', rounds: 18, samples: 0 },
    { id: 'D-0401', name: 'Lab phone 1', facilityId: 'F-04', mode: 'mobile', status: 'offline', lastSeen: minAgo(60 * 26), battery: 41, network: 'Mobile data', app: '1.1.4', model: 'v1.2', rounds: 9, samples: 344 },
    { id: 'D-0402', name: 'Lab phone 2', facilityId: 'F-04', mode: 'mobile', status: 'idle', lastSeen: minAgo(20), battery: 90, network: 'Wi-Fi', app: '1.2.0', model: 'v1.3', rounds: 0, samples: 0, staffId: 'NCH002' },
  ];
  // Simulated clients run on the server; the pilot uses 4, the study uses 10.
  for (let i = 1; i <= 10; i++) {
    const id = 'SIM-' + String(i).padStart(2, '0');
    devices.push({ id, name: 'Simulated client ' + i, facilityId: null, projectIds: i <= 4 ? ['P-001', 'P-002'] : ['P-002'], mode: 'simulated', status: i <= 4 ? 'training' : 'online', lastSeen: minAgo(0), battery: null, network: 'Server', app: '—', model: 'v1.3', rounds: 60 + i * 7, samples: [3210, 1180, 2650, 640, 4120, 1790, 905, 2440, 3370, 1741][i - 1] });
  }

  // ------------------------------------------------------------ datasets
  const datasets = [
    {
      id: 'DS-01', name: 'NIH Malaria Cell Images', kind: 'Central (public)', images: 27558,
      classes: { Infected: 13779, Uninfected: 13779 }, split: { Train: 22046, Test: 5512 },
      source: 'U.S. National Library of Medicine, thin blood smears, Giemsa stain', added: minAgo(60 * 24 * 40),
      use: 'Test set for every run; training data for simulated clients',
    },
    {
      id: 'DS-02', name: 'NIH Malaria (64 px, preprocessed)', kind: 'Central (derived)', images: 27558,
      classes: { Infected: 13779, Uninfected: 13779 }, split: { Train: 22046, Test: 5512 },
      source: 'Resized copy of DS-01 for fast experiments', added: minAgo(60 * 24 * 25),
      use: 'Compression study (P-002)',
    },
  ];
  // How the training set is shared across the 10 simulated clients (Dirichlet, alpha 0.5).
  const partition = devices.filter(d => d.mode === 'simulated').map((d, i) => {
    const infectedShare = [0.82, 0.31, 0.55, 0.12, 0.47, 0.68, 0.22, 0.91, 0.39, 0.6][i];
    return { client: d.id, images: d.samples, infected: Math.round(d.samples * infectedShare), uninfected: d.samples - Math.round(d.samples * infectedShare) };
  });

  // ------------------------------------------------------------ compression profiles
  const profiles = [
    { id: 'CP-0', name: 'No compression', method: 'none', topk: 1, bits: 32, ef: false, note: 'Baseline: every value as a 32-bit float' },
    { id: 'CP-1', name: '8-bit only', method: 'quant', topk: 1, bits: 8, ef: false, note: 'Every value in 1 byte; one scale per 1,024 values' },
    { id: 'CP-2', name: 'Top-K 1%', method: 'topk', topk: 0.01, bits: 0, ef: false, note: 'Largest 1% of changes, 32-bit values' },
    { id: 'CP-3', name: 'Top-K 1% + 8-bit', method: 'topk', topk: 0.01, bits: 8, ef: false, note: 'Largest 1%, values in 1 byte' },
    { id: 'CP-4', name: 'Top-K 1% + 8-bit + EF', method: 'topk', topk: 0.01, bits: 8, ef: true, note: 'Main method: error feedback keeps what was left out', main: true },
    { id: 'CP-5', name: 'Top-K 10% + 8-bit + EF', method: 'topk', topk: 0.10, bits: 8, ef: true, note: 'Gentler compression' },
    { id: 'CP-6', name: 'Top-K 0.1% + 8-bit + EF', method: 'topk', topk: 0.001, bits: 8, ef: true, note: 'Aggressive compression' },
  ];
  profiles.forEach(p => { p.bytes = updateBytes(p); });

  // ------------------------------------------------------------ training runs
  // Accuracy curves follow a smooth rise with small noise; finals per method
  // reflect the expected effect of compression (to be replaced by Colab results).
  function makeHistory(o) {
    const r = rng(o.seed);
    const hist = [];
    const perDevice = profiles.find(p => p.id === o.profileId).bytes;
    let total = 0;
    for (let k = 1; k <= o.done; k++) {
      const noise = (r() - 0.5) * 0.012 * Math.exp(-k / 35);
      const acc = Math.min(0.995, o.final - (o.final - 0.6) * Math.exp(-k / o.tau) + noise);
      const recall = Math.min(0.995, acc + 0.004 + (r() - 0.5) * 0.008);
      const precision = Math.min(0.995, acc - 0.003 + (r() - 0.5) * 0.008);
      const f1 = 2 * precision * recall / (precision + recall);
      const loss = 0.12 + 0.55 * Math.exp(-k / o.tau) + (r() - 0.5) * 0.015;
      const reported = Math.max(o.minClients, o.clients - (r() < 0.12 ? 1 : 0));
      const up = perDevice * reported;
      total += up;
      hist.push({ round: k, accuracy: acc, recall, precision, f1, loss, devices: reported, upBytes: up, totalBytes: total, seconds: Math.round(o.roundSec * (0.85 + r() * 0.3)) });
    }
    return hist;
  }

  const runDefs = [
    // Pilot project
    { id: 'R-014', projectId: 'P-001', name: 'Pilot round set 3', status: 'running', profileId: 'CP-4', model: 'MobileNetV2 v1.3', clients: 8, minClients: 5, rounds: 50, done: 23, final: 0.962, tau: 9, seed: 14, roundSec: 96, started: minAgo(37), localEpochs: 1, batch: 32, lr: 0.01, mix: '4 real devices + 4 simulated' },
    { id: 'R-015', projectId: 'P-001', name: 'Pilot round set 4', status: 'scheduled', profileId: 'CP-4', model: 'MobileNetV2 v1.3', clients: 8, minClients: 5, rounds: 50, done: 0, final: 0.96, tau: 9, seed: 15, roundSec: 96, started: new Date(now + 60000 * 60 * 14), localEpochs: 1, batch: 32, lr: 0.01, mix: '4 real devices + 4 simulated' },
    { id: 'R-012', projectId: 'P-001', name: 'Pilot round set 2', status: 'completed', profileId: 'CP-4', model: 'MobileNetV2 v1.2', clients: 7, minClients: 5, rounds: 40, done: 40, final: 0.955, tau: 10, seed: 12, roundSec: 104, started: minAgo(60 * 24 * 6), localEpochs: 1, batch: 32, lr: 0.01, mix: '3 real devices + 4 simulated', producedModel: 'v1.3' },
    { id: 'R-011', projectId: 'P-001', name: 'Pilot mobile-only test', status: 'failed', profileId: 'CP-4', model: 'MobileNetV2 v1.2', clients: 4, minClients: 4, rounds: 30, done: 6, final: 0.93, tau: 10, seed: 11, roundSec: 140, started: minAgo(60 * 24 * 9), localEpochs: 1, batch: 16, lr: 0.01, mix: '4 phones', error: 'Round 7: only 2 of 4 devices reported (minimum 4). Run stopped.' },
    { id: 'R-009', projectId: 'P-001', name: 'Pilot round set 1', status: 'completed', profileId: 'CP-3', model: 'MobileNetV2 v1.1', clients: 6, minClients: 4, rounds: 30, done: 30, final: 0.941, tau: 10, seed: 9, roundSec: 110, started: minAgo(60 * 24 * 14), localEpochs: 1, batch: 32, lr: 0.01, mix: '2 real devices + 4 simulated', producedModel: 'v1.2' },
    // Compression study: same seed and data split, only compression changes
    { id: 'R-101', projectId: 'P-002', name: 'No compression', status: 'completed', profileId: 'CP-0', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.962, tau: 8, seed: 101, roundSec: 41, started: minAgo(60 * 24 * 20), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-102', projectId: 'P-002', name: '8-bit only', status: 'completed', profileId: 'CP-1', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.961, tau: 8, seed: 102, roundSec: 40, started: minAgo(60 * 24 * 19), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-103', projectId: 'P-002', name: 'Top-K 1%', status: 'completed', profileId: 'CP-2', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.938, tau: 13, seed: 103, roundSec: 39, started: minAgo(60 * 24 * 18), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-104', projectId: 'P-002', name: 'Top-K 1% + 8-bit', status: 'completed', profileId: 'CP-3', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.935, tau: 13, seed: 104, roundSec: 39, started: minAgo(60 * 24 * 17), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-105', projectId: 'P-002', name: 'Top-K 1% + 8-bit + EF', status: 'completed', profileId: 'CP-4', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.958, tau: 9.5, seed: 105, roundSec: 39, started: minAgo(60 * 24 * 16), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-106', projectId: 'P-002', name: 'Top-K 10% + 8-bit + EF', status: 'completed', profileId: 'CP-5', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.961, tau: 8.5, seed: 106, roundSec: 40, started: minAgo(60 * 24 * 15), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
    { id: 'R-107', projectId: 'P-002', name: 'Top-K 0.1% + 8-bit + EF', status: 'completed', profileId: 'CP-6', model: 'MobileNetV2 (ImageNet)', clients: 10, minClients: 10, rounds: 50, done: 50, final: 0.944, tau: 12, seed: 107, roundSec: 38, started: minAgo(60 * 24 * 14), localEpochs: 1, batch: 64, lr: 0.01, mix: '10 simulated', experiment: 'E-001' },
  ];

  const runs = runDefs.map(d => {
    const run = Object.assign({}, d);
    run.history = makeHistory(d);
    if (d.status === 'completed' || d.status === 'failed') {
      const secs = run.history.reduce((a, h) => a + h.seconds, 0);
      run.finished = new Date(d.started.getTime() + secs * 1000);
    }
    return run;
  });

  // ------------------------------------------------------------ models
  const models = [
    { id: 'M-05', projectId: 'P-001', arch: 'MobileNetV2', version: 'v1.3', run: 'R-012', accuracy: 0.955, recall: 0.962, f1: 0.954, sizeMb: 8.9, tfliteMb: 2.4, status: 'published', date: minAgo(60 * 24 * 5) },
    { id: 'M-04', projectId: 'P-001', arch: 'MobileNetV2', version: 'v1.2', run: 'R-009', accuracy: 0.941, recall: 0.948, f1: 0.940, sizeMb: 8.9, tfliteMb: 2.4, status: 'retired', date: minAgo(60 * 24 * 13) },
    { id: 'M-03', projectId: 'P-001', arch: 'MobileNetV2', version: 'v1.1', run: 'Central pre-training', accuracy: 0.928, recall: 0.931, f1: 0.927, sizeMb: 8.9, tfliteMb: 2.4, status: 'retired', date: minAgo(60 * 24 * 30) },
    { id: 'M-06', projectId: 'P-002', arch: 'MobileNetV2', version: 'study-best', run: 'R-105', accuracy: 0.958, recall: 0.963, f1: 0.957, sizeMb: 8.9, tfliteMb: 2.4, status: 'candidate', date: minAgo(60 * 24 * 15) },
    { id: 'M-07', projectId: 'P-002', arch: 'Small CNN', version: 'v0.2', run: 'Central training', accuracy: 0.912, recall: 0.905, f1: 0.911, sizeMb: 1.1, tfliteMb: 0.3, status: 'draft', date: minAgo(60 * 24 * 22) },
  ];

  // ------------------------------------------------------------ experiments
  const experiments = [
    { id: 'E-001', projectId: 'P-002', name: 'Compression method comparison', vary: 'Compression profile', runs: ['R-101', 'R-102', 'R-103', 'R-104', 'R-105', 'R-106', 'R-107'], status: 'completed', created: minAgo(60 * 24 * 21), best: 'R-105', question: 'How much data can each method save, and at what cost in accuracy?' },
    { id: 'E-002', projectId: 'P-002', name: 'Top-K keep ratio', vary: 'Top-K ratio (10%, 1%, 0.1%)', runs: ['R-106', 'R-105', 'R-107'], status: 'completed', created: minAgo(60 * 24 * 16), best: 'R-105', question: 'How far can Top-K go before accuracy drops?' },
    { id: 'E-003', projectId: 'P-001', name: 'Real devices against simulated', vary: 'Client mode', runs: ['R-009', 'R-012'], status: 'in progress', created: minAgo(60 * 24 * 7), best: null, question: 'Do real facility devices match the simulated results?' },
  ];

  // ------------------------------------------------------------ reports
  const reports = [
    { id: 'RP-03', projectId: 'P-002', title: 'Compression study: results chapter', source: 'E-001', author: 'Chanda Mwila', date: minAgo(60 * 24 * 12) },
    { id: 'RP-02', projectId: 'P-001', title: 'Pilot round set 2 summary', source: 'R-012', author: 'Chanda Mwila', date: minAgo(60 * 24 * 5) },
    { id: 'RP-01', projectId: 'P-001', title: 'Ethics board progress update', source: 'R-009', author: 'Peter Lungu', date: minAgo(60 * 24 * 13) },
  ];

  // ------------------------------------------------------------ activity
  const activity = [
    { projectId: 'P-001', text: 'Run R-014 started with 8 devices', when: minAgo(37), kind: 'run' },
    { projectId: 'P-001', text: 'Esther Zulu signed in on a new phone; D-0402 registered at Nchelenge Health Centre', when: minAgo(20), kind: 'device' },
    { projectId: 'P-001', text: 'Model v1.3 published to 5 devices', when: minAgo(60 * 24 * 5), kind: 'model' },
    { projectId: 'P-001', text: 'Chingola Urban Clinic added to the project', when: minAgo(60 * 24 * 2), kind: 'facility' },
    { projectId: 'P-001', text: 'Run R-011 failed: too few devices in round 7', when: minAgo(60 * 24 * 9), kind: 'alert' },
    { projectId: 'P-002', text: 'Experiment E-002 completed; best run R-105', when: minAgo(60 * 24 * 14), kind: 'run' },
    { projectId: 'P-002', text: 'Report "Compression study: results chapter" exported', when: minAgo(60 * 24 * 12), kind: 'report' },
  ];

  const audit = [
    { who: 'Chanda Mwila', action: 'Started run R-014', when: minAgo(37) },
    { who: 'Chanda Mwila', action: 'Created staff account NCH002 (Esther Zulu)', when: minAgo(60 * 24) },
    { who: 'Chanda Mwila', action: 'Published model v1.3', when: minAgo(60 * 24 * 5) },
    { who: 'Dr. Ruth Banda', action: 'Changed round timeout to 10 minutes', when: minAgo(60 * 24 * 6) },
    { who: 'Peter Lungu', action: 'Created project P-003', when: minAgo(60 * 24 * 3) },
    { who: 'Chanda Mwila', action: 'Added Chingola Urban Clinic', when: minAgo(60 * 24 * 2) },
  ];

  const settings = {
    kwachaPerMb: 0.10,
    roundTimeoutMin: 10,
    maxUploadMb: 20,
    checkInMinutes: 15,
    offlineAfterHours: 6,
    retentionDays: 365,
    emailAlerts: true,
    alertFailedRound: true,
    alertOffline: true,
    alertAccuracyDrop: true,
    sessionHours: 8,
    twoStep: true,
  };

  // ------------------------------------------------------------ federated learning (offline demo)
  // Phones only: no simulated clients or facility computers.
  for (let i = devices.length - 1; i >= 0; i--) if (devices[i].mode === 'simulated') devices.splice(i, 1);
  devices.forEach(d => { d.mode = 'mobile'; if (d.name === 'Lab computer') d.name = 'Lab phone 3'; });

  // Each phone's image counts (the app reports these; images stay on the phone).
  facilities.forEach(f => {
    const L = localData[f.id], devs = devices.filter(d => d.facilityId === f.id);
    if (!devs.length) return;
    const confInf = Math.round(L.infected * L.confirmed / (L.images || 1));
    devs.forEach((d, i) => {
      const share = 1 / devs.length, lastOne = i === devs.length - 1;
      const used = devs.slice(0, i).reduce((a, x) => ({ images: a.images + x.images, infected: a.infected + x.infected, uninfected: a.uninfected + x.uninfected }), { images: 0, infected: 0, uninfected: 0 });
      d.images = lastOne ? L.images - used.images : Math.round(L.images * share);
      d.infected = lastOne ? confInf - used.infected : Math.round(confInf * share);
      d.uninfected = lastOne ? (L.confirmed - confInf) - used.uninfected : Math.round((L.confirmed - confInf) * share);
      d.lastAdded = L.lastAdded;
    });
  });

  // Daily counts for the "cases over time" chart: 30 days of growth up to today.
  const caseHistory = [];
  devices.forEach(d => {
    if (!d.images) return;
    for (let t = 0; t < 30; t++) {
      const f = 0.3 + 0.7 * Math.pow(t / 29, 1.3);
      const day = new Date(now - (29 - t) * 86400000);
      caseHistory.push({ deviceId: d.id, day: day.toISOString().slice(0, 10), infected: Math.round(d.infected * f), uninfected: Math.round(d.uninfected * f), images: Math.round(d.images * f) });
    }
  });

  // Model files and how each model was made.
  Object.assign(models[0], { publishedAt: minAgo(60 * 24 * 5), basedOn: 'M-04', updateCount: 5, headPath: 'models/M-05/head.bin', basePath: 'models/M-03/base.tflite', run: 'Compiled from 5 updates', sizeMb: 1.65, tfliteMb: 4.4 });
  Object.assign(models[1], { basedOn: 'M-03', updateCount: 4, headPath: 'models/M-04/head.bin', basePath: 'models/M-03/base.tflite', run: 'Compiled from 4 updates', sizeMb: 1.65, tfliteMb: 4.4 });
  Object.assign(models[2], { headPath: 'models/M-03/head.bin', basePath: 'models/M-03/base.tflite', run: 'Central training (Colab)', sizeMb: 1.65, tfliteMb: 4.4 });
  models.splice(3);

  // Compressed updates from phones: Top-K 1% + 8-bit + error feedback = 20,706 bytes each.
  const deviceUpdates = [];
  const upd = (deviceId, modelId, samples, mins, compiledInto) => deviceUpdates.push({
    id: `${modelId}-${deviceId}`, deviceId, facilityId: (devices.find(d => d.id === deviceId) || {}).facilityId, modelId,
    bytes: 20706, samples, path: `updates/${modelId}/${deviceId}.bin`, createdAt: minAgo(mins), compiledInto: compiledInto || null });
  upd('D-0101', 'M-05', 640, 40); upd('D-0201', 'M-05', 801, 95); upd('D-0301', 'M-05', 1388, 130);
  ['D-0101', 'D-0102', 'D-0201', 'D-0301', 'D-0401'].forEach((d, i) => upd(d, 'M-04', 300 + i * 90, 60 * 24 * 6 + i * 50, 'M-05'));
  ['D-0101', 'D-0102', 'D-0201', 'D-0301'].forEach((d, i) => upd(d, 'M-03', 200 + i * 80, 60 * 24 * 14 + i * 50, 'M-04'));

  // The dashboard works with one project. Fold the demo's compression study into it.
  [runs, experiments, reports, activity].forEach(list => list.forEach(x => { if (x.projectId === 'P-002') x.projectId = 'P-001'; }));
  devices.forEach(d => { if (d.projectIds) d.projectIds = ['P-001']; });
  projects.splice(1);

  window.DB = {
    now, minAgo, rng, MODEL_VALUES, updateBytes,
    user, users, projects, facilities, staff, localData, devices, datasets, partition, deviceUpdates, caseHistory,
    profiles, runs, models, experiments, reports, activity, audit, settings,
    currentProject: 'P-001',
  };
})();
