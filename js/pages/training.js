/* Training: phones send compressed updates; compile them into a new model and publish it.
 *
 *   1. A model is published. Phones download it.
 *   2. Each phone trains it on its own confirmed images and sends one compressed update.
 *   3. Compile the waiting updates into a new model (here, or in Colab), then publish it.
 */
(function () {
  'use strict';
  const { esc, fmt, badge, table, card, find, inProject, toast, modal, publishedModel } = UI;

  const nextVersion = () => {
    const nums = DB.models.map(m => parseFloat(String(m.version).replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));
    const n = nums.length ? Math.max(...nums) : 0;
    return 'v' + (Math.floor(n) + 1);
  };
  const nextModelId = () => {
    const nums = DB.models.map(m => +String(m.id).replace(/\D/g, '')).filter(n => !isNaN(n));
    return 'M-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
  };

  /** Updates trained from the published model and not yet compiled. */
  function waiting() {
    const pub = publishedModel();
    return pub ? inProject.updates().filter(u => u.modelId === pub.id && !u.compiledInto) : [];
  }

  function doPublish(m) {
    inProject.models().forEach(x => { if (x.status === 'published') x.status = 'retired'; });
    m.status = 'published';
    m.publishedAt = new Date();
  }

  // ------------------------------------------------------------ compile here
  function compileNow() {
    const pub = publishedModel(), ups = waiting();
    if (!pub || !ups.length) return;
    const images = ups.reduce((a, u) => a + u.samples, 0);
    modal({
      title: 'Compile updates into a new model', confirm: 'Compile',
      body: `
        <p>This combines the <b>${ups.length} waiting update${ups.length > 1 ? 's' : ''}</b> (trained on ${fmt.int(images)} images, starting from model ${esc(pub.version)}) into a new model.</p>
        <p class="muted">Each update is weighted by how many images it was trained on (Federated Averaging).
        Accuracy is not tested here; to test it, use <b>Download updates</b> and the Colab compile notebook instead.</p>
        <label class="check"><input type="checkbox" id="cp-publish" checked> Publish the new model to the phones straight away</label>
        <p class="small" id="cp-msg"></p>`,
      onConfirm(root) {
        const publish = root.querySelector('#cp-publish').checked;
        const msg = root.querySelector('#cp-msg');
        const id = nextModelId(), version = nextVersion();
        const finish = () => {
          const m = {
            id, projectId: DB.currentProject, arch: 'MobileNetV2', version, run: `Compiled from ${ups.length} updates`,
            accuracy: null, recall: null, f1: null, sizeMb: +(FL.FULL_BYTES / 1e6).toFixed(2), tfliteMb: pub.tfliteMb,
            status: 'candidate', date: new Date(), basePath: pub.basePath, headPath: `models/${id}/head.bin`,
            nValues: FL.N_VALUES, basedOn: pub.id, updateCount: ups.length,
          };
          DB.models.unshift(m);
          ups.forEach(u => { u.compiledInto = id; });
          DB.activity.unshift({ projectId: DB.currentProject, text: `Model ${version} compiled from ${ups.length} updates`, when: new Date(), kind: 'model' });
          if (publish) doPublish(m);
          document.getElementById('modal-root').innerHTML = '';
          toast(`Model ${version} created${publish ? ' and published' : ''}`);
          App.refresh();
        };
        if (!Store.enabled) { finish(); return; }
        msg.textContent = 'Downloading updates…';
        Promise.all([Store.download(pub.headPath), ...ups.map(u => Store.download(u.path))])
          .then(([head, ...files]) => {
            msg.textContent = 'Compiling…';
            const w = FL.compile(head, ups.map((u, i) => ({ samples: u.samples, buffer: files[i] })));
            msg.textContent = 'Uploading the new model…';
            return Store.upload(`models/${id}/head.bin`, new Blob([FL.writeHead(w)]));
          })
          .then(finish)
          .catch(err => { msg.textContent = 'Could not compile: ' + err.message; });
        return false;
      },
    });
  }

  // ------------------------------------------------------------ download for Colab
  function downloadUpdates() {
    const pub = publishedModel(), ups = waiting();
    if (!Store.enabled) { toast('Downloading needs the database connection'); return; }
    toast('Preparing the download…');
    Promise.all([Store.download(pub.headPath), ...ups.map(u => Store.download(u.path))])
      .then(([head, ...files]) => {
        const manifest = {
          based_on: pub.id, based_on_version: pub.version, created: new Date().toISOString(),
          updates: ups.map(u => ({ id: u.id, device: u.deviceId, facility: u.facilityId, samples: u.samples, bytes: u.bytes, file: `updates/${u.deviceId}.bin` })),
        };
        const zipped = FL.zip([
          { name: 'manifest.json', bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) },
          { name: 'head.bin', bytes: new Uint8Array(head) },
          ...ups.map((u, i) => ({ name: `updates/${u.deviceId}.bin`, bytes: new Uint8Array(files[i]) })),
        ]);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
        a.download = `updates_${pub.version}_${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      })
      .catch(err => toast('Could not download: ' + err.message));
  }

  // ------------------------------------------------------------ upload a model
  function uploadModel() {
    const pub = publishedModel();
    modal({
      title: 'Upload a model', confirm: 'Upload',
      body: `
        <p class="muted">Use the files from a Colab notebook: the export notebook (first model) or the compile notebook (after compiling updates).</p>
        <label class="field"><span>model_info.json</span><input type="file" id="um-info" accept=".json"></label>
        <label class="field"><span>head.bin (trained layers)</span><input type="file" id="um-head" accept=".bin"></label>
        <label class="field"><span>base.tflite ${pub ? '(leave empty to keep the current one)' : '(needed for the first model)'}</span><input type="file" id="um-base" accept=".tflite"></label>
        <label class="check"><input type="checkbox" id="um-publish" checked> Publish to the phones straight away</label>
        <p class="small" id="um-msg"></p>`,
      onConfirm(root) {
        const f = id => root.querySelector(id).files[0];
        const info = f('#um-info'), head = f('#um-head'), base = f('#um-base');
        const publish = root.querySelector('#um-publish').checked;
        const msg = root.querySelector('#um-msg');
        if (!info || !head) { msg.textContent = 'Choose model_info.json and head.bin.'; return false; }
        if (!base && !pub) { msg.textContent = 'The first model needs base.tflite too.'; return false; }
        if (head.size !== FL.FULL_BYTES) { msg.textContent = `head.bin should be ${FL.FULL_BYTES} bytes; this one is ${head.size}.`; return false; }
        const id = nextModelId();
        msg.textContent = 'Uploading…';
        info.text().then(t => JSON.parse(t)).then(meta => {
          const uploads = Store.enabled
            ? Promise.all([Store.upload(`models/${id}/head.bin`, head), base ? Store.upload(`models/${id}/base.tflite`, base) : null])
            : Promise.resolve();
          return uploads.then(() => {
            const compiled = meta.compiled_updates || [];
            const m = {
              id, projectId: DB.currentProject, arch: 'MobileNetV2', version: meta.version || nextVersion(),
              run: compiled.length ? `Compiled from ${compiled.length} updates (Colab)` : (meta.trained_on || 'Colab'),
              accuracy: meta.accuracy ?? null, recall: meta.recall ?? null, f1: meta.f1 ?? null,
              sizeMb: +(head.size / 1e6).toFixed(2), tfliteMb: base ? +(base.size / 1e6).toFixed(1) : (pub && pub.tfliteMb),
              status: 'candidate', date: new Date(), headPath: `models/${id}/head.bin`,
              basePath: base ? `models/${id}/base.tflite` : pub.basePath, nValues: FL.N_VALUES,
              basedOn: meta.based_on || null, updateCount: compiled.length || null,
            };
            DB.models.unshift(m);
            (DB.deviceUpdates || []).forEach(u => { if (compiled.includes(u.id)) u.compiledInto = id; });
            DB.activity.unshift({ projectId: DB.currentProject, text: `Model ${m.version} uploaded`, when: new Date(), kind: 'model' });
            if (publish) doPublish(m);
            document.getElementById('modal-root').innerHTML = '';
            toast(`Model ${m.version} uploaded${publish ? ' and published' : ''}`);
            App.refresh();
          });
        }).catch(err => { msg.textContent = 'Upload failed: ' + err.message; });
        return false;
      },
    });
  }

  // ------------------------------------------------------------ page
  function render() {
    const pub = publishedModel();
    const ups = waiting();
    const all = inProject.updates();
    const models = inProject.models().slice().sort((a, b) => b.date - a.date);

    const current = pub
      ? `<div class="grid g4">
          ${UI.kpi('Model in use', esc(pub.version), pub.publishedAt ? 'published ' + fmt.ago(pub.publishedAt) : '')}
          ${UI.kpi('Accuracy', pub.accuracy != null ? fmt.pct(pub.accuracy) : '—', pub.accuracy != null ? 'on 5,512 NIH test images' : 'not tested')}
          ${UI.kpi('Updates waiting', fmt.int(ups.length), ups.length ? 'ready to compile' : 'phones are training')}
          ${UI.kpi('Updates received', fmt.int(all.length), `${fmt.bytes(all.reduce((a, u) => a + u.bytes, 0))} in total`)}
        </div>`
      : `<div class="note">No model is published yet. Upload the first model from the Colab export notebook, then phones can start sending updates.</div>`;

    return `
      <div class="page-head">
        <div><h1>Training</h1><p>Phones send compressed updates. Compile them into a new model and publish it.</p></div>
        <div class="page-actions"><button class="btn" id="upload-model">Upload model</button></div>
      </div>
      ${current}

      <div class="mt">${card(`Updates waiting to be compiled (${ups.length})`, table([
        { label: 'Phone', render: u => `<b>${esc(u.deviceId)}</b>` },
        { label: 'Facility', render: u => u.facilityId && find.facility(u.facilityId) ? esc(find.facility(u.facilityId).name) : '—' },
        { label: 'Images trained on', num: true, render: u => fmt.int(u.samples) },
        { label: 'Size', num: true, render: u => fmt.bytes(u.bytes) },
        { label: 'Received', render: u => fmt.ago(u.createdAt) },
      ], ups, { empty: pub ? 'No updates yet. Each phone sends one after it has 5 new confirmed images.' : 'Publish a model first.' }),
      { flush: true, right: ups.length ? '<div class="row" style="gap:8px"><button class="btn btn-sm" id="download">Download updates</button><button class="btn btn-sm btn-primary" id="compile">Compile now</button></div>' : '' })}</div>

      <div class="mt">${card('Models', table([
        { label: 'Version', render: m => `<b>${esc(m.version)}</b><div class="small muted">${esc(m.run || '')}</div>` },
        { label: 'Accuracy', num: true, render: m => m.accuracy != null ? fmt.pct(m.accuracy) : '<span class="muted">not tested</span>' },
        { label: 'Date', render: m => fmt.date(m.date) },
        { label: 'Status', render: m => badge(m.status) },
        { label: '', render: m => `<div class="row" style="justify-content:flex-end;gap:6px">
            ${m.status !== 'published' && m.headPath ? `<button class="btn btn-sm" data-publish="${m.id}">Publish</button>` : ''}
            ${Store.enabled && m.headPath ? `<button class="btn btn-sm" data-get="${m.id}">Download</button>` : ''}</div>` },
      ], models, { empty: 'No models yet.' }), { flush: true })}</div>
      <p class="small muted mt">Publishing a model sends it to every phone. Only updates trained from the model in use are compiled; older ones are left out.</p>`;
  }

  (window.Pages = window.Pages || {}).training = {
    title: 'Training',
    live: true,
    render,
    mount(el) {
      const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.onclick = fn; };
      on('#upload-model', uploadModel);
      on('#compile', compileNow);
      on('#download', downloadUpdates);
      el.querySelectorAll('[data-publish]').forEach(b => b.onclick = () => {
        const m = find.model(b.dataset.publish);
        UI.confirmBox(`Publish ${m.version}?`, 'Every phone will download it and use it for suggestions. They then train it and send new updates.', () => {
          doPublish(m);
          DB.activity.unshift({ projectId: DB.currentProject, text: `Model ${m.version} published`, when: new Date(), kind: 'model' });
          toast(m.version + ' published');
          App.refresh();
        }, 'Publish');
      });
      el.querySelectorAll('[data-get]').forEach(b => b.onclick = () => {
        const m = find.model(b.dataset.get);
        Store.fileUrl(m.headPath).then(url => window.open(url, '_blank')).catch(err => toast('Could not download: ' + err.message));
      });
    },
  };
})();
