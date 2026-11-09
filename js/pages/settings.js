/* Settings: who can use the dashboard. Only the primary user adds and removes users. */
(function () {
  'use strict';
  const { esc, fmt, table, card, toast, modal } = UI;

  const MIN_PW = 6;

  function addUser() {
    modal({
      title: 'Add a user', confirm: 'Create account',
      body: `<label class="field"><span>Name</span><input id="iu-name"></label>
             <label class="field"><span>Email</span><input id="iu-email" type="email"></label>
             <label class="field"><span>Password</span><input id="iu-pw" type="text" autocomplete="new-password" placeholder="At least ${MIN_PW} characters"></label>
             <p class="small" id="iu-msg"></p>`,
      onConfirm(root) {
        const name = root.querySelector('#iu-name').value.trim(), email = root.querySelector('#iu-email').value.trim().toLowerCase();
        const msg = root.querySelector('#iu-msg');
        if (!name || !email.includes('@')) { msg.textContent = 'Enter a name and an email address.'; return false; }
        if (DB.users.some(u => u.email === email)) { msg.textContent = 'This email already has an account.'; return false; }
        const pw = root.querySelector('#iu-pw').value;
        if (pw.length < MIN_PW) { msg.textContent = `The password must be at least ${MIN_PW} characters.`; return false; }
        const finish = () => {
          DB.users.push({ name, email, role: 'Researcher', isPrimary: false, lastActive: null });
          document.getElementById('modal-root').innerHTML = '';
          App.refresh();
          setTimeout(() => modal({
            title: 'Account created', confirm: 'Done', cancel: null,
            body: `<p class="muted">Give these details to ${esc(name)}. They sign in to this dashboard with them.</p>
                   ${UI.kv([['Email', esc(email)], ['Password', `<b class="mono">${pw}</b>`]])}`,
          }), 0);
        };
        msg.textContent = 'Creating…';
        Store.rpc('create_researcher', { p_name: name, p_email: email, p_role: 'Researcher', p_password: pw })
          .then(finish)
          .catch(err => { msg.textContent = 'Could not create the account: ' + err.message; });
        return false;
      },
    });
  }

  function removeUser(u) {
    UI.confirmBox(`Remove ${u.name}?`, `${u.email} will no longer be able to sign in to the dashboard.`, () => {
      const done = () => { DB.users = DB.users.filter(x => x.email !== u.email); toast(u.name + ' removed'); App.refresh(); };
      Store.rpc('remove_researcher', { p_email: u.email }).then(done).catch(err => toast('Could not remove: ' + err.message));
    }, 'Remove');
  }

  (window.Pages = window.Pages || {}).settings = {
    title: 'Settings',
    render() {
      const primary = !!DB.user.isPrimary;
      const users = DB.users.slice().sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.name.localeCompare(b.name));
      return `
      <div class="page-head">
        <div><h1>Settings</h1><p>People who can sign in to this dashboard.</p></div>
        <div class="page-actions">${primary ? '<button class="btn btn-primary" id="add-user">Add user</button>' : ''}</div>
      </div>
      <div style="max-width:900px">
        ${card(null, table([
          { label: 'Name', render: u => `<b>${esc(u.name)}</b>${u.isPrimary ? ' <span class="badge blue">Primary user</span>' : ''}<div class="small muted">${esc(u.email)}</div>` },
          { label: 'Last active', render: u => u.lastActive ? fmt.ago(u.lastActive) : '<span class="muted">Never</span>' },
          { label: '', render: u => primary && !u.isPrimary ? `<div class="row" style="justify-content:flex-end"><button class="btn btn-sm" data-remove="${esc(u.email)}">Remove</button></div>` : '' },
        ], users), { flush: true })}
        <div class="note mt">${primary
          ? 'You are the primary user: only you can add and remove users.'
          : 'Only the primary user can add and remove users.'}
          Facility staff use the mobile app; add them on the <a href="#/facilities">Facilities</a> page.</div>
      </div>`;
    },
    mount(el) {
      const a = el.querySelector('#add-user');
      if (a) a.onclick = addUser;
      el.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeUser(DB.users.find(u => u.email === b.dataset.remove)));
    },
  };
})();
