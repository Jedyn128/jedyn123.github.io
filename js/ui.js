/* Shared helpers: formatting, badges, tables, modal, toast, icons. */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const two = n => String(n).padStart(2, '0');

  const fmt = {
    pct: (v, d = 1) => (v * 100).toFixed(d) + '%',
    int: v => Math.round(v).toLocaleString('en-US'),
    bytes(b) {
      if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
      if (b >= 1e6) return (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB';
      if (b >= 1e3) return Math.round(b / 1e3) + ' KB';
      return b + ' B';
    },
    kwacha: v => 'K' + v.toFixed(2),
    date: d => d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—',
    dateTime: d => d ? `${d.getDate()} ${MONTHS[d.getMonth()]}, ${two(d.getHours())}:${two(d.getMinutes())}` : '—',
    ago(d) {
      if (!d) return '—';
      const m = Math.round((Date.now() - d.getTime()) / 60000);
      if (m < 0) {
        const h = Math.round(-m / 60);
        return h < 24 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
      }
      if (m < 1) return 'just now';
      if (m < 60) return m + ' min ago';
      if (m < 1440) return Math.round(m / 60) + ' h ago';
      const days = Math.round(m / 1440);
      return days === 1 ? 'yesterday' : days + ' days ago';
    },
    since(d) {
      const m = Math.round((Date.now() - d.getTime()) / 60000);
      if (m < 60) return m + ' min';
      if (m < 2880) return Math.round(m / 60) + ' h';
      return Math.round(m / 1440) + ' days';
    },
    duration(s) {
      if (s < 60) return s + ' s';
      const m = Math.round(s / 60);
      if (m < 60) return m + ' min';
      return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
    },
    ratio: v => v >= 10 ? Math.round(v) + '×' : v.toFixed(1) + '×',
  };

  const STATUS = {
    // runs
    running: ['blue', 'Running'], scheduled: ['', 'Scheduled'], completed: ['green', 'Completed'],
    failed: ['red', 'Failed'], paused: ['amber', 'Paused'], cancelled: ['', 'Cancelled'], draft: ['', 'Draft'],
    // devices
    training: ['blue', 'Training'], online: ['green', 'Online'], idle: ['amber', 'Idle'],
    offline: ['', 'Offline'], pending: ['amber', 'Pending'], revoked: ['red', 'Revoked'],
    // projects, models, experiments
    active: ['green', 'Active'], archived: ['', 'Archived'], published: ['green', 'Published'],
    candidate: ['blue', 'Candidate'], retired: ['', 'Retired'], 'in progress': ['blue', 'In progress'],
    // consent
    Given: ['green', 'Active'], Invited: ['amber', 'Invited'],
    inactive: ['', 'Inactive'],
  };
  function badge(status) {
    const s = STATUS[status] || ['', status];
    return `<span class="badge ${s[0]}">${esc(s[1])}</span>`;
  }

  const MODE = { mobile: 'Mobile', edge: 'Edge node', simulated: 'Simulated' };

  /** Table: cols [{label, key|render(row), num?, cls?}], rows, onRow(id) via data-href */
  function table(cols, rows, opts = {}) {
    if (!rows.length) return `<div class="empty">${esc(opts.empty || 'Nothing here yet')}</div>`;
    let h = '<div class="table-wrap"><table><thead><tr>';
    cols.forEach(c => { h += `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`; });
    h += '</tr></thead><tbody>';
    rows.forEach(r => {
      const href = opts.href ? opts.href(r) : null;
      h += `<tr${href ? ` class="clickable" data-href="${esc(href)}"` : ''}>`;
      cols.forEach(c => {
        const v = c.render ? c.render(r) : esc(r[c.key]);
        h += `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${v}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function kpi(label, value, sub, subCls = '') {
    return `<div class="card kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub ${subCls}">${sub}</div>` : ''}</div>`;
  }

  function card(title, body, opts = {}) {
    return `<section class="card ${opts.cls || ''}">` +
      (title ? `<div class="card-head"><h2>${esc(title)}</h2>${opts.right || ''}</div>` : '') +
      `<div class="card-body ${opts.flush ? 'flush' : ''}">${body}</div></section>`;
  }

  function kv(pairs) {
    return '<div class="kv">' + pairs.map(([k, v]) => `<div>${esc(k)}</div><div>${v}</div>`).join('') + '</div>';
  }

  function progress(frac, cls = '') {
    return `<div class="progress ${cls}"><span style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></span></div>`;
  }

  // ------------------------------------------------------------ modal
  function modal({ title, body, confirm = 'Save', cancel = 'Cancel', onConfirm, wide }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" style="${wide ? 'max-width:680px' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">&times;</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${cancel ? `<button class="btn" data-close>${esc(cancel)}</button>` : ''}${confirm ? `<button class="btn btn-primary" data-ok>${esc(confirm)}</button>` : ''}</div>
    </div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    root.querySelector('.modal-backdrop').onclick = e => { if (e.target.classList.contains('modal-backdrop')) close(); };
    const ok = root.querySelector('[data-ok]');
    if (ok) ok.onclick = () => { if (!onConfirm || onConfirm(root) !== false) close(); };
    const first = root.querySelector('input, select, textarea');
    if (first) first.focus();
    return root;
  }

  function confirmBox(title, text, onYes, yesLabel = 'Confirm') {
    modal({ title, body: `<p>${esc(text)}</p>`, confirm: yesLabel, onConfirm: onYes });
  }

  function toast(text) {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    root.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // ------------------------------------------------------------ icons (simple line icons)
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    overview: P('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    projects: P('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    facilities: P('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M10 21v-5h4v5"/><path d="M12 8v4M10 10h4"/>'),
    devices: P('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    datasets: P('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    models: P('<path d="M12 2 3 7l9 5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'),
    training: P('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'),
    compression: P('<path d="M8 3v5H3"/><path d="M16 3v5h5"/><path d="M8 21v-5H3"/><path d="M16 21v-5h5"/>'),
    experiments: P('<path d="M9 3h6"/><path d="M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3"/>'),
    reports: P('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'),
    settings: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  };

  /** A fake but stable QR-style pattern for enrolment codes (for display only). */
  function qr(code) {
    const r = DB.rng([...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const n = 25, s = 160 / n;
    let out = `<svg class="qr" viewBox="0 0 160 160" role="img" aria-label="Enrolment QR code"><rect width="160" height="160" fill="#fff"/>`;
    const finder = (x, y) => `<rect x="${x * s}" y="${y * s}" width="${7 * s}" height="${7 * s}" fill="#14171c"/><rect x="${(x + 1) * s}" y="${(y + 1) * s}" width="${5 * s}" height="${5 * s}" fill="#fff"/><rect x="${(x + 2) * s}" y="${(y + 2) * s}" width="${3 * s}" height="${3 * s}" fill="#14171c"/>`;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (!inFinder && r() < 0.48) out += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="#14171c"/>`;
    }
    return out + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + '</svg>';
  }

  // ------------------------------------------------------------ lookups
  const find = {
    project: id => DB.projects.find(p => p.id === id),
    facility: id => DB.facilities.find(f => f.id === id),
    device: id => DB.devices.find(d => d.id === id),
    staff: id => DB.staff.find(s => s.id === id),
    profile: id => DB.profiles.find(p => p.id === id),
    run: id => DB.runs.find(r => r.id === id),
    model: id => DB.models.find(m => m.id === id),
    experiment: id => DB.experiments.find(e => e.id === id),
  };

  const inProject = {
    facilities: () => DB.facilities.filter(f => f.projectId === DB.currentProject),
    devices: () => DB.devices.filter(d => d.facilityId
      ? (find.facility(d.facilityId) || {}).projectId === DB.currentProject
      : (d.projectIds || []).includes(DB.currentProject)),
    staff: () => DB.staff.filter(s => (find.facility(s.facilityId) || {}).projectId === DB.currentProject),
    runs: () => DB.runs.filter(r => r.projectId === DB.currentProject),
    models: () => DB.models.filter(m => m.projectId === DB.currentProject),
    experiments: () => DB.experiments.filter(e => e.projectId === DB.currentProject),
    reports: () => DB.reports.filter(r => r.projectId === DB.currentProject),
    activity: () => DB.activity.filter(a => a.projectId === DB.currentProject),
    phones: () => DB.devices.filter(d => d.facilityId && d.status !== 'revoked' && (find.facility(d.facilityId) || {}).projectId === DB.currentProject),
    updates: () => {
      const ms = new Set(DB.models.filter(m => m.projectId === DB.currentProject).map(m => m.id));
      return (DB.deviceUpdates || []).filter(u => ms.has(u.modelId));
    },
  };

  /** The model phones are using now. */
  const publishedModel = () => DB.models
    .filter(m => m.projectId === DB.currentProject && m.status === 'published')
    .sort((a, b) => (b.publishedAt || b.date) - (a.publishedAt || a.date))[0] || null;

  /** Image counts, added up from what the phones report. */
  function counts(facilityId) {
    const devs = DB.devices.filter(d => d.status !== 'revoked' && (facilityId ? d.facilityId === facilityId : d.facilityId && (find.facility(d.facilityId) || {}).projectId === DB.currentProject));
    const infected = devs.reduce((a, d) => a + (d.infected || 0), 0);
    const uninfected = devs.reduce((a, d) => a + (d.uninfected || 0), 0);
    const images = devs.reduce((a, d) => a + (d.images || 0), 0);
    return { infected, uninfected, confirmed: infected + uninfected, unconfirmed: Math.max(0, images - infected - uninfected), images, phones: devs.length };
  }

  /** Detected cases per day (each phone's latest count on or before that day, added up). */
  function caseSeries(days = 30) {
    const phones = new Set(inProject.phones().map(d => d.id));
    const rows = (DB.caseHistory || []).filter(r => phones.has(r.deviceId)).sort((a, b) => String(a.day).localeCompare(String(b.day)));
    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today - i * 86400000).toISOString().slice(0, 10);
      const latest = {};
      rows.forEach(r => { if (String(r.day) <= day) latest[r.deviceId] = r.infected; });
      out.push({ day, infected: Object.values(latest).reduce((a, v) => a + v, 0) });
    }
    return out;
  }

  /** Devices that belong to a given project. */
  const inProjectFor = pid => DB.devices.filter(d => d.facilityId
    ? (find.facility(d.facilityId) || {}).projectId === pid
    : (d.projectIds || []).includes(pid));

  const last = arr => arr[arr.length - 1];

  /** Summary numbers for a run. */
  function runStats(run) {
    const h = run.history;
    const lastH = last(h);
    const best = h.reduce((a, b) => (b.accuracy > (a ? a.accuracy : -1) ? b : a), null);
    const prof = find.profile(run.profileId);
    return {
      last: lastH, best,
      totalBytes: lastH ? lastH.totalBytes : 0,
      perDevice: prof.bytes,
      ratio: DB.profiles[0].bytes / prof.bytes,
      roundsTo: target => { const x = h.find(r => r.accuracy >= target); return x ? x.round : null; },
    };
  }

  window.UI = {
    publishedModel, counts, caseSeries, esc, fmt, badge, MODE, table, kpi, card, kv, progress, modal, confirmBox, toast, ICONS, qr, find, inProject, inProjectFor, last, runStats };
})();
