/* App shell: sign in, navigation, routing, project picker, live refresh. */
(function () {
  'use strict';

  const NAV = [
    { key: 'overview', label: 'Overview' },
    { key: 'facilities', label: 'Facilities' },
    { key: 'training', label: 'Training' },
    { key: 'compression', label: 'Compression' },
    { key: 'settings', label: 'Settings' },
  ];

  // Pages without their own tab highlight the tab they belong to.
  const PARENT = {};

  const view = document.getElementById('view');
  let current = { key: null, params: [] };

  function parse() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'overview').split('/');
    return { key: parts[0], params: parts.slice(1).map(decodeURIComponent) };
  }

  function renderNav() {
    document.getElementById('nav').innerHTML = NAV.map(n => n.group
      ? `<div class="nav-group">${n.group}</div>`
      : `<a class="nav-item ${(PARENT[current.key] || current.key) === n.key ? 'active' : ''}" href="#/${n.key}">${UI.ICONS[n.key]}<span>${n.label}</span></a>`).join('');
  }

  function renderPage(keepScroll) {
    const page = Pages[current.key] || Pages.overview;
    const y = window.scrollY;
    // No project yet (new database): only Projects and Settings make sense.
    const noProject = !DB.projects.some(p => p.id === DB.currentProject);
    if (noProject && current.key !== 'settings') {
      view.innerHTML = `
        <div class="welcome card">
          <div class="card-body">
            <h1>Welcome to MalariaFL</h1>
            <p class="muted">Start by creating a project. A project holds the facilities, staff accounts, models and updates for one study.</p>
            <ol class="welcome-steps">
              <li>Create a project</li>
              <li>Upload and publish the first model (Training page)</li>
              <li>Add facilities, then open each one to add staff (Facilities page)</li>
              <li>Staff sign in on the app; phones send updates, which you compile into new models</li>
            </ol>
            <button class="btn btn-primary" id="create-project">Create project</button>
          </div>
        </div>`;
      document.title = 'MalariaFL Console';
      document.getElementById('create-project').onclick = newProject;
      return;
    }
    view.innerHTML = page.render(current.params);
    if (page.mount) page.mount(view, current.params);
    document.title = (page.title ? page.title + ' · ' : '') + 'MalariaFL Console';
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }

  function route() {
    current = parse();
    if (!Pages[current.key]) current = { key: 'overview', params: [] };
    renderNav();
    renderPage(false);
    document.querySelector('.sidebar').classList.remove('open');
  }

  // The top bar shows the project name. Edit it in Settings > Project.
  function renderPicker() {
    const p = DB.projects.find(x => x.id === DB.currentProject);
    document.getElementById('project-name').textContent = p ? p.name : '';
  }

  function newProject() {
    UI.modal({
      title: 'Create project', confirm: 'Create project',
      body: `
        <label class="field"><span>Name</span><input id="np-name" placeholder="Malaria detection: Copperbelt"></label>
        <label class="field"><span>Description</span><textarea id="np-desc" rows="2" placeholder="What this study is for"></textarea></label>`,
      onConfirm(root) {
        const name = root.querySelector('#np-name').value.trim();
        if (!name) { root.querySelector('#np-name').focus(); return false; }
        const id = 'P-' + String(DB.projects.length + 1).padStart(3, '0');
        DB.projects.push({
          id, name, status: 'active', description: root.querySelector('#np-desc').value.trim() || '',
          task: 'Red blood cell: infected or uninfected', classes: ['Infected', 'Uninfected'],
          target: 'Recall at least 95%', created: new Date(), lead: DB.user.name, members: [DB.user.name],
        });
        DB.audit.unshift({ who: DB.user.name, action: 'Created project ' + name, when: new Date() });
        DB.currentProject = id;
        renderPicker();
        UI.toast('Project created');
        renderPage(false);
      },
    });
  }


  // Re-render pages that show live data (new updates, cases, phones), unless the user is busy.
  function liveRefresh() {
    if (document.getElementById('app').hidden) return;
    const page = Pages[current.key];
    if (!page || !page.live) return;
    const isLive = typeof page.live === 'function' ? page.live(current.params) : page.live;
    if (!isLive) return;
    const a = document.activeElement;
    if (a && view.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    if (document.getElementById('modal-root').children.length) return;
    renderPage(true);
  }
  setInterval(liveRefresh, 5000);

  // Clickable table rows and elements with data-href.
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-href]');
    if (el && !e.target.closest('a, button, input, select')) location.hash = el.getAttribute('data-href');
  });

  // ------------------------------------------------------------ sign in
  const NOT_CONFIGURED = Store.configured
    ? 'Could not load the Supabase library. Check the internet connection and reload the page.'
    : 'The dashboard is not connected to a database. Add the Supabase Project URL and publishable key to js/config.js.';
  function start() {
    document.getElementById('login').hidden = true;
    document.getElementById('app').hidden = false;
    const initials = DB.user.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    document.getElementById('user-menu').innerHTML =
      `<div class="avatar">${initials}</div><div class="small"><b>${UI.esc(DB.user.name)}</b><br><span class="muted">${DB.user.role}</span></div>`;
    document.getElementById('user-menu').onclick = () => UI.confirmBox('Sign out?', 'You will return to the sign-in page.', async () => {
      await Store.signOut();
      location.hash = '';
      location.reload();
    }, 'Sign out');
    Store.startLoops();
    document.getElementById('server-status').innerHTML = '<span class="dot dot-ok"></span>Database connected';
    renderPicker();
    route();
  }

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pw = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    if (!Store.enabled) { errEl.textContent = NOT_CONFIGURED; return; }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Signing in…'; errEl.textContent = '';
    try {
      await Store.signIn(email, pw);
      start();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });


  document.getElementById('menu-btn').onclick = () => document.querySelector('.sidebar').classList.toggle('open');
  window.addEventListener('hashchange', () => { if (!document.getElementById('app').hidden) route(); });

  window.App = { go: hash => { location.hash = hash; }, refresh: () => renderPage(true), renderPicker, liveRefresh };

  if (Store.enabled) {
    // Supabase keeps the session; skip the sign-in page if it is still valid.
    Store.restore().then(ok => { if (ok) start(); }).catch(err => { document.getElementById('login-error').textContent = err.message; });
  } else {
    document.getElementById('login-error').textContent = NOT_CONFIGURED;
  }
})();
