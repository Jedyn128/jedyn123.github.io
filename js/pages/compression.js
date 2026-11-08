/* Compression: what is used, how it works, and how much it saves. */
(function () {
  'use strict';
  const { fmt, kpi, card, inProject } = UI;

  const K = Math.floor(FL.N_VALUES * 0.01); // values kept by Top-K 1%

  function step(n, title, what, saves) {
    return `<div class="card"><div class="card-body">
      <div class="row" style="gap:10px;align-items:center;margin-bottom:8px">
        <span class="badge blue" style="min-width:24px;justify-content:center">${n}</span><h3 style="margin:0;font-size:16px">${title}</h3></div>
      <p style="margin:0 0 10px">${what}</p>
      <p class="small muted" style="margin:0">${saves}</p></div></div>`;
  }

  (window.Pages = window.Pages || {}).compression = {
    title: 'Compression',
    render() {
      const size = FL.updateSize();
      const ratio = FL.FULL_BYTES / size;
      const ups = inProject.updates();
      const sent = ups.reduce((a, u) => a + u.bytes, 0);
      const without = ups.length * FL.FULL_BYTES;

      return `
      <div class="page-head"><div><h1>Compression</h1>
        <p>How MalariaFL keeps the data each phone sends small, so federated learning works on mobile data.</p></div></div>

      <div class="card" style="margin-bottom:16px"><div class="card-body">
        <div class="small muted">Method in use</div>
        <div style="font-size:22px;font-weight:700;margin:4px 0 6px">Top-K 1% + 8-bit + error feedback</div>
        <p class="muted" style="margin:0">Every phone uses this one method for every update. It is applied on the phone, before anything is sent.</p>
      </div></div>

      <div class="grid g3">
        ${kpi('Without compression', fmt.bytes(FL.FULL_BYTES), `${fmt.int(FL.N_VALUES)} values × 4 bytes`)}
        ${kpi('With compression', fmt.bytes(size), `${fmt.int(K)} values sent, 1 byte each + positions`)}
        ${kpi('Reduction', fmt.ratio(ratio) + ' smaller', `${fmt.pct(1 - size / FL.FULL_BYTES, 1)} less data per update`, 'up')}
      </div>

      <h2 style="margin:28px 0 6px">Why compress?</h2>
      <p style="max-width:820px">In federated learning, the images stay at the facility. Each phone trains the shared model on its own images and sends back only
        <b>the update</b>: how much each of the model's ${fmt.int(FL.N_VALUES)} values changed. Sent as it is, one update is ${fmt.bytes(FL.FULL_BYTES)}.
        On mobile data, every update costs money and time, so the phone shrinks it first. This is <b>gradient compression</b>, and it is what makes the
        communication efficient.</p>

      <h2 style="margin:24px 0 10px">How it works</h2>
      <div class="grid g3">
        ${step(1, 'Top-K: keep the biggest changes', `Most values change very little. The phone keeps only the 1% that changed the most (${fmt.int(K)} of ${fmt.int(FL.N_VALUES)}) and sends each one with its position, so the server knows where it belongs.`, `${fmt.bytes(FL.FULL_BYTES)} → ${fmt.bytes(FL.updateSize(0.01, 32))}`)}
        ${step(2, '8-bit: smaller numbers', 'Each kept value is stored in 1 byte instead of 4. Every block of 1,024 values shares one scale number, so the original sizes can be restored on the server.', `${fmt.bytes(FL.updateSize(0.01, 32))} → ${fmt.bytes(size)}`)}
        ${step(3, 'Error feedback: nothing is lost', 'The 99% of changes that were not sent are kept on the phone and added to the next update. Small changes build up and get sent once they matter, so the model still learns from them.', 'Keeps accuracy close to sending everything')}
      </div>

      <h2 style="margin:28px 0 10px">Where it fits</h2>
      ${card(null, `<ol style="margin:0;padding:16px 16px 16px 36px;line-height:1.9">
        <li>A model is published on the Training page. Every phone downloads it.</li>
        <li>Each phone trains it on its own confirmed images. The images never leave the phone.</li>
        <li>The phone works out the update and <b>compresses it with this method</b>: ${fmt.bytes(size)} instead of ${fmt.bytes(FL.FULL_BYTES)}.</li>
        <li>The server rebuilds each update (zeros where nothing was sent) and averages them, weighted by how many images each phone used.</li>
        <li>The result is a new model. It is published, and the cycle starts again.</li>
      </ol>`)}

      <h2 style="margin:28px 0 10px">How efficient it is so far</h2>
      ${ups.length ? `<div class="grid g3">
        ${kpi('Updates received', fmt.int(ups.length), 'from phones')}
        ${kpi('Data received', fmt.bytes(sent), `instead of ${fmt.bytes(without)} without compression`)}
        ${kpi('Data saved', fmt.bytes(without - sent), `${fmt.pct((without - sent) / without, 1)} less`, 'up')}
      </div>
      <div class="mt">${card('Size of one update', Charts.bars({
        width: 1100, height: 200, log: true, format: fmt.bytes, label: 'Size of one update',
        bars: [{ label: 'Without compression', value: FL.FULL_BYTES, color: '#8a939c' }, { label: 'With compression (actual average)', value: sent / ups.length, color: '#1d5fad' }],
      }) + '<p class="small muted" style="padding:0 16px 14px">Log scale, so the small bar stays visible.</p>')}</div>`
      : '<div class="note">No updates received yet. The real figures appear here once phones start sending updates.</div>'}

      <p class="small muted mt">The trained part of the model is the last block and the classifier of MobileNetV2 (${fmt.int(FL.N_VALUES)} values). The rest of the model is frozen and is never sent.</p>`;
    },
  };
})();
