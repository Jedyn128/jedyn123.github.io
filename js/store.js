/* Store: connects the dashboard to Supabase.
 *
 * The pages read and change the in-memory DB object. When Supabase is configured, this file:
 *   - signs the researcher in and loads every table into DB,
 *   - saves changed rows back every few seconds,
 *   - fetches new updates, phones, cases and models every 10 seconds,
 *   - uploads and downloads model and update files (bucket "fl").
 * When it is not configured, Store.enabled is false and the dashboard asks for js/config.js to be filled in. */
(function () {
  'use strict';

  const cfg = window.MFL_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const enabled = configured && !!(window.supabase && window.supabase.createClient);
  const sb = enabled ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  // Tables the dashboard writes: DB key -> database table and the columns it may change.
  const WRITE = {
    projects: { table: 'projects', columns: ['id', 'name', 'status', 'description', 'task', 'classes', 'target', 'created', 'lead', 'members'] },
    facilities: { table: 'facilities', columns: ['id', 'projectId', 'name', 'district', 'province', 'manager', 'consent', 'joined'] },
    staff: { table: 'staff', columns: ['id', 'name', 'role', 'facilityId', 'status'] },
    devices: { table: 'devices', columns: ['id', 'status'] },
    models: { table: 'models', columns: ['id', 'projectId', 'arch', 'version', 'run', 'accuracy', 'recall', 'f1', 'sizeMb', 'tfliteMb', 'status', 'date', 'basePath', 'headPath', 'nValues', 'basedOn', 'updateCount', 'publishedAt'] },
    deviceUpdates: { table: 'device_updates', columns: ['id', 'compiledInto'] },
    activity: { table: 'activity', columns: ['id', 'projectId', 'text', 'kind', 'when'] },
    audit: { table: 'audit', columns: ['id', 'who', 'action', 'when'] },
  };
  const DATES = new Set(['created', 'joined', 'lastSignIn', 'lastSeen', 'lastAdded', 'date', 'when', 'lastActive', 'createdAt', 'publishedAt']);
  const RENAME = { when: 'happened_at' };
  const RENAME_BACK = { happened_at: 'when' };

  const toSnake = k => RENAME[k] || k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
  const toCamel = k => RENAME_BACK[k] || k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

  function uuid() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function toRow(key, obj) {
    const row = {};
    WRITE[key].columns.forEach(k => {
      if (!(k in obj)) return;
      const v = obj[k];
      row[toSnake(k)] = v instanceof Date ? v.toISOString() : v === undefined ? null : v;
    });
    return row;
  }

  function fromRow(row) {
    const o = {};
    Object.keys(row).forEach(k => {
      const c = toCamel(k), v = row[k];
      o[c] = DATES.has(c) && v ? new Date(v) : v;
    });
    return o;
  }

  async function fetchAll(table) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select('*').range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out.map(fromRow);
  }

  const snapshot = new Map();
  const remember = (key, rows) => rows.forEach(o => snapshot.set(key + ':' + o.id, JSON.stringify(toRow(key, o))));

  // ------------------------------------------------------------ loading
  async function load() {
    const names = ['researchers', 'projects', 'facilities', 'staff', 'devices', 'models', 'device_updates', 'case_history', 'activity', 'audit'];
    const [researchers, projects, facilities, staff, devices, models, updates, history, activity, audit] = await Promise.all(names.map(fetchAll));

    const { data: { user } } = await sb.auth.getUser();
    const me = researchers.find(r => r.id === (user && user.id));
    if (!me) throw new Error('This account cannot use the dashboard. Sign in with a researcher account.');

    DB.user = { name: me.name, email: me.email, role: me.role, isPrimary: !!me.isPrimary };
    DB.users = researchers.map(r => ({ name: r.name, email: r.email, role: r.role, isPrimary: !!r.isPrimary, lastActive: r.lastActive }));
    DB.projects = projects.sort((a, b) => a.id.localeCompare(b.id));
    DB.facilities = facilities.sort((a, b) => a.id.localeCompare(b.id));
    DB.staff = staff;
    DB.devices = devices.sort((a, b) => a.id.localeCompare(b.id));
    DB.models = models;
    DB.deviceUpdates = updates;
    DB.caseHistory = history.map(h => Object.assign(h, { day: String(h.day).slice(0, 10) }));
    DB.activity = activity.sort((a, b) => b.when - a.when);
    DB.audit = audit.sort((a, b) => b.when - a.when);
    if (!DB.projects.some(p => p.id === DB.currentProject) && DB.projects[0]) DB.currentProject = DB.projects[0].id;

    snapshot.clear();
    Object.keys(WRITE).forEach(key => remember(key, DB[key]));
  }

  // ------------------------------------------------------------ saving
  let saving = false;
  let lastError = '';

  async function sync() {
    if (saving) return;
    saving = true;
    try {
      for (const key of Object.keys(WRITE)) {
        const changed = [];
        DB[key].forEach(o => {
          if ((key === 'activity' || key === 'audit') && !o.id) o.id = uuid();
          const json = JSON.stringify(toRow(key, o));
          if (snapshot.get(key + ':' + o.id) !== json) changed.push([o, json]);
        });
        if (!changed.length) continue;
        // Rows already in the database are updated; new rows are inserted.
        const table = WRITE[key].table;
        const fresh = changed.filter(([o]) => !snapshot.has(key + ':' + o.id));
        const known = changed.filter(([o]) => snapshot.has(key + ':' + o.id));
        if (fresh.length) {
          const { error } = await sb.from(table).insert(fresh.map(([o]) => toRow(key, o)));
          if (error) throw new Error(`Could not save ${table}: ${error.message}`);
        }
        for (const [o] of known) {
          const { error } = await sb.from(table).update(toRow(key, o)).eq('id', o.id);
          if (error) throw new Error(`Could not save ${table}: ${error.message}`);
        }
        changed.forEach(([o, json]) => snapshot.set(key + ':' + o.id, json));
      }
      lastError = '';
    } catch (e) {
      if (e.message !== lastError) UI.toast(e.message);
      lastError = e.message;
    } finally {
      saving = false;
    }
  }

  // ------------------------------------------------------------ live updates (from the phones)
  async function poll() {
    if (saving) return;
    try {
      const [devices, staff, updates, models, history] = await Promise.all(
        ['devices', 'staff', 'device_updates', 'models', 'case_history'].map(fetchAll));
      const merge = (key, rows) => rows.forEach(row => {
        const local = DB[key].find(o => o.id === row.id);
        const k = key + ':' + row.id;
        if (local && snapshot.get(k) !== JSON.stringify(toRow(key, local))) return; // unsaved local change
        if (local) Object.assign(local, row); else DB[key].push(row);
        snapshot.set(k, JSON.stringify(toRow(key, local || row)));
      });
      merge('devices', devices);
      merge('staff', staff);
      merge('deviceUpdates', updates);
      merge('models', models);
      DB.caseHistory = history.map(h => Object.assign(h, { day: String(h.day).slice(0, 10) }));
      if (window.App && App.liveRefresh) App.liveRefresh();
    } catch (e) {
      if (e.message !== lastError) UI.toast('Could not refresh: ' + e.message);
      lastError = e.message;
    }
  }

  function startLoops() {
    setInterval(sync, 3000);
    setInterval(poll, 10000);
  }

  // ------------------------------------------------------------ accounts
  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
    await load();
  }

  async function restore() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return false;
    await load();
    return true;
  }

  async function signOut() {
    await sync();
    await sb.auth.signOut();
  }

  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }

  // ------------------------------------------------------------ files (bucket "fl")
  async function upload(path, file) {
    const { error } = await sb.storage.from('fl').upload(path, file, { upsert: true, contentType: 'application/octet-stream' });
    if (error) throw new Error(error.message);
  }

  /** Returns the file as an ArrayBuffer. */
  async function download(path) {
    const { data, error } = await sb.storage.from('fl').download(path);
    if (error) throw new Error(`${path}: ${error.message}`);
    return data.arrayBuffer();
  }

  async function fileUrl(path) {
    const { data, error } = await sb.storage.from('fl').createSignedUrl(path, 600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  window.Store = { enabled, configured, signIn, restore, signOut, rpc, startLoops, sync, poll, remember, upload, download, fileUrl };
})();
