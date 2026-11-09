/* Facilities: the hospitals taking part. Open one to see its cases,
   add staff accounts for the app, and see its phones. */
(function () {
  'use strict';
  const { esc, fmt, badge, table, card, find, inProject, toast, modal, counts } = UI;

  const PROVINCES = ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'];
  const ROLES = ['Laboratory technologist', 'Facility manager', 'Clinician'];

  const MIN_PW = 6;
  const pwField = (id, label) => `<label class="field"><span>${label}</span><input id="${id}" type="text" autocomplete="new-password" placeholder="At least ${MIN_PW} characters"></label>`;

  function staffNumber(facilityId) {
    const prefix = find.facility(facilityId).name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    let n = 1;
    while (DB.staff.some(s => s.id === prefix + String(n).padStart(3, '0'))) n++;
    return prefix + String(n).padStart(3, '0');
  }

  function showLogin(s, password, title) {
    modal({
      title, confirm: 'Done', cancel: null,
      body: `<p class="muted">Give these details to ${esc(s.name)}. They sign in to the MalariaFL app with them.</p>
        ${UI.kv([['Staff number', `<b>${s.id}</b>`], ['Password', `<b class="mono">${password}</b>`], ['Facility', esc(find.facility(s.facilityId).name)]])}`,
    });
  }

  // ------------------------------------------------------------ actions
  function addFacility() {
    modal({
      title: 'Add a facility', confirm: 'Add facility',
      body: `
        <label class="field"><span>Facility name</span><input id="af-name"></label>
        <div class="form-grid">
          <label class="field"><span>District</span><input id="af-district"></label>
          <label class="field"><span>Province</span><select id="af-prov">${PROVINCES.map(p => `<option>${p}</option>`).join('')}</select></label>
        </div>
        <label class="check"><input type="checkbox" id="af-consent"> The facility has approved taking part, and patients give consent for their slides to be used.</label>
        <p class="small" id="af-err" hidden style="color:var(--pos)">Enter a name and confirm approval.</p>`,
      onConfirm(root) {
        const name = root.querySelector('#af-name').value.trim();
        if (!name || !root.querySelector('#af-consent').checked) { root.querySelector('#af-err').hidden = false; return false; }
        const nums = DB.facilities.map(f => +f.id.slice(2)).filter(n => !isNaN(n));
        const id = 'F-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
        DB.facilities.push({ id, projectId: DB.currentProject, name, district: root.querySelector('#af-district').value.trim() || '—', province: root.querySelector('#af-prov').value, manager: '—', consent: 'Given', joined: new Date() });
        DB.activity.unshift({ projectId: DB.currentProject, text: `${name} added`, when: new Date(), kind: 'facility' });
        toast(name + ' added. Open it to add staff.');
        App.go('#/facilities/' + id);
      },
    });
  }

  function addStaff(facilityId) {
    modal({
      title: 'Add staff', confirm: 'Create account',
      body: `
        <label class="field"><span>Full name</span><input id="as-name"></label>
        <label class="field"><span>Role</span><select id="as-role">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></label>
        ${pwField('as-pw', 'Password')}
        <p class="small muted" id="as-msg">A staff number is created for the mobile app.</p>`,
      onConfirm(root) {
        const name = root.querySelector('#as-name').value.trim();
        const password = root.querySelector('#as-pw').value;
        const msg = root.querySelector('#as-msg');
        if (!name) { msg.textContent = 'Enter a name.'; msg.style.color = 'var(--pos)'; return false; }
        if (password.length < MIN_PW) { msg.textContent = `The password must be at least ${MIN_PW} characters.`; msg.style.color = 'var(--pos)'; return false; }
        const s = { id: staffNumber(facilityId), name, role: root.querySelector('#as-role').value, facilityId, status: 'active', lastSignIn: null };
        const finish = () => {
          DB.staff.push(s);
          DB.audit.unshift({ who: DB.user.name, action: `Created staff account ${s.id} (${name})`, when: new Date() });
          App.refresh();
          setTimeout(() => showLogin(s, password, 'Account created'), 0);
        };
        Store.sync()
          .then(() => Store.rpc('create_staff_account', { p_id: s.id, p_name: s.name, p_role: s.role, p_facility: s.facilityId, p_password: password }))
          .then(() => { Store.remember('staff', [s]); finish(); })
          .catch(err => toast('Could not create the account: ' + err.message));
      },
    });
  }

  function resetPassword(s) {
    modal({
      title: 'Reset password', confirm: 'Save password',
      body: `<p class="muted">New password for ${esc(s.name)} (${s.id}).</p>
        ${pwField('rp-pw', 'New password')}
        <p class="small" id="rp-msg"></p>`,
      onConfirm(root) {
        const password = root.querySelector('#rp-pw').value;
        const msg = root.querySelector('#rp-msg');
        if (password.length < MIN_PW) { msg.textContent = `The password must be at least ${MIN_PW} characters.`; msg.style.color = 'var(--pos)'; return false; }
        const done = () => {
          DB.audit.unshift({ who: DB.user.name, action: `Reset the password of ${s.id}`, when: new Date() });
          setTimeout(() => showLogin(s, password, 'Password changed'), 0);
        };
        Store.rpc('reset_staff_password', { p_id: s.id, p_password: password })
          .then(done)
          .catch(err => toast('Could not reset the password: ' + err.message));
      },
    });
  }

  // ------------------------------------------------------------ list
  function list() {
    const facs = inProject.facilities();
    return `
      <div class="page-head">
        <div><h1>Facilities</h1><p>Hospitals taking part. Open one to add staff and see its cases.</p></div>
        <div class="page-actions"><button class="btn btn-primary" id="add-facility">Add facility</button></div>
      </div>
      ${card(null, table([
        { label: 'Facility', render: f => `<b>${esc(f.name)}</b><div class="small muted">${esc(f.district)}, ${esc(f.province)}</div>` },
        { label: 'Staff', num: true, render: f => DB.staff.filter(s => s.facilityId === f.id && s.status === 'active').length },
        { label: 'Infected', num: true, render: f => `<span style="color:var(--pos)">${fmt.int(counts(f.id).infected)}</span>` },
        { label: 'Uninfected', num: true, render: f => fmt.int(counts(f.id).uninfected) },
        { label: 'Unrecognised', num: true, render: f => fmt.int(counts(f.id).unconfirmed) },
      ], facs, { href: f => '#/facilities/' + f.id, empty: 'No facilities yet. Click Add facility.' }), { flush: true })}`;
  }

  // ------------------------------------------------------------ one facility
  function detail(f) {
    const c = counts(f.id);
    const staff = DB.staff.filter(s => s.facilityId === f.id);
    const phones = DB.devices.filter(d => d.facilityId === f.id && d.status !== 'revoked');
    const sent = (DB.deviceUpdates || []).filter(u => u.facilityId === f.id).length;
    return `
      <div class="crumbs"><a href="#/facilities">Facilities</a> / ${esc(f.name)}</div>
      <div class="page-head">
        <div><h1>${esc(f.name)}</h1><p>${esc(f.district)}, ${esc(f.province)}</p></div>
        <div class="page-actions"><button class="btn btn-primary" id="add-staff">Add staff</button></div>
      </div>
      <div class="grid g4">
        ${UI.kpi('Infected', `<span style="color:var(--pos)">${fmt.int(c.infected)}</span>`, 'confirmed by staff')}
        ${UI.kpi('Uninfected', fmt.int(c.uninfected), 'confirmed by staff')}
        ${UI.kpi('Unrecognised', fmt.int(c.unconfirmed), 'staff were not sure; not used for training')}
        ${UI.kpi('Updates sent', fmt.int(sent), 'to improve the model')}
      </div>
      <div class="mt">${card('Staff', table([
        { label: 'Name', render: s => `<b>${esc(s.name)}</b><div class="small muted">${s.id} · ${esc(s.role)}</div>` },
        { label: 'Last sign-in', render: s => s.lastSignIn ? fmt.ago(s.lastSignIn) : '<span class="muted">Never</span>' },
        { label: 'Status', render: s => badge(s.status) },
        { label: '', render: s => `<div class="row" style="justify-content:flex-end;gap:6px">
            <button class="btn btn-sm" data-reset="${s.id}">Reset password</button>
            <button class="btn btn-sm" data-toggle="${s.id}">${s.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>` },
      ], staff, { empty: 'No staff yet. Click Add staff to create a login for the app.' }), { flush: true })}</div>
      <div class="mt">${card('Phones', table([
        { label: 'Phone', render: d => `<b>${d.id}</b> <span class="muted">${esc(d.name)}</span>` },
        { label: 'Used by', render: d => d.staffId && find.staff(d.staffId) ? esc(find.staff(d.staffId).name) : '—' },
        { label: 'Last seen', render: d => fmt.ago(d.lastSeen) },
        { label: 'Model', render: d => esc(d.model || '—') },
        { label: '', render: d => `<div class="row" style="justify-content:flex-end"><button class="btn btn-sm" data-remove="${d.id}">Remove</button></div>` },
      ], phones, { empty: 'No phones yet. A phone appears here when staff sign in on it.' }), { flush: true })}</div>
      <p class="small muted mt">Only counts are shown. The images stay on the facility's phones.</p>`;
  }

  (window.Pages = window.Pages || {}).facilities = {
    title: 'Facilities',
    live: true,
    render(params) {
      if (!params[0]) return list();
      const f = find.facility(params[0]);
      return f ? detail(f) : '<div class="empty">Facility not found. <a href="#/facilities">Back</a></div>';
    },
    mount(el, params) {
      if (!params[0]) { el.querySelector('#add-facility').onclick = addFacility; return; }
      const f = find.facility(params[0]);
      if (!f) return;
      el.querySelector('#add-staff').onclick = () => addStaff(f.id);
      el.querySelectorAll('[data-reset]').forEach(b => b.onclick = e => { e.stopPropagation(); resetPassword(find.staff(b.dataset.reset)); });
      el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        const s = find.staff(b.dataset.toggle);
        if (s.status === 'active') {
          UI.confirmBox('Deactivate account?', `${s.name} will no longer be able to sign in to the app.`, () => { s.status = 'inactive'; toast('Account deactivated'); App.refresh(); }, 'Deactivate');
        } else { s.status = 'active'; toast('Account activated'); App.refresh(); }
      });
      el.querySelectorAll('[data-remove]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        const d = find.device(b.dataset.remove);
        UI.confirmBox('Remove this phone?', `${d.id} will stop sending updates. Its images stay on the phone.`, () => { d.status = 'revoked'; toast(d.id + ' removed'); App.refresh(); }, 'Remove');
      });
    },
  };
})();
