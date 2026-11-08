/* Overview: the essentials at a glance. */
(function () {
  'use strict';
  const { fmt, kpi, card, counts, caseSeries, inProject } = UI;

  (window.Pages = window.Pages || {}).overview = {
    title: 'Overview',
    live: true,
    render() {
      const facs = inProject.facilities();
      const c = counts();
      const ups = inProject.updates();
      const waiting = ups.filter(u => !u.compiledInto && UI.publishedModel() && u.modelId === UI.publishedModel().id).length;

      // Compression: what phones actually sent, compared with sending the full update.
      const sent = ups.reduce((a, u) => a + u.bytes, 0);
      const avg = ups.length ? sent / ups.length : FL.updateSize();
      const ratio = FL.FULL_BYTES / avg;

      const series = caseSeries(30);
      const chart = series.some(p => p.infected > 0)
        ? Charts.line({
          width: 1100, height: 260, label: 'Detected cases over the last 30 days',
          series: [{ name: 'Detected cases', color: '#c62828', points: series.map((p, i) => [i, p.infected]) }],
          xFormat: i => { const d = new Date(series[Math.round(i)].day); return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }); },
          yFormat: v => fmt.int(v), yMin: 0,
        })
        : '<div class="empty">No cases yet. They appear here when facility staff confirm infected images in the app.</div>';

      return `
      <div class="page-head"><div><h1>Overview</h1><p>Facilities, detected cases and the updates phones have sent.</p></div></div>

      <div class="grid g4">
        ${kpi('Facilities', fmt.int(facs.length), `${c.phones} phone${c.phones === 1 ? '' : 's'} taking part`)}
        ${kpi('Detected cases', `<span style="color:var(--pos)">${fmt.int(c.infected)}</span>`, `of ${fmt.int(c.confirmed)} confirmed images`)}
        ${kpi('Updates received', fmt.int(ups.length), waiting ? `${waiting} waiting to be compiled` : 'none waiting')}
        ${kpi('Compression', fmt.ratio(ratio) + ' smaller', `${fmt.bytes(avg)} sent instead of ${fmt.bytes(FL.FULL_BYTES)}`, 'up')}
      </div>

      <div class="mt">${card('Detected cases over time', chart + (series.some(p => p.infected > 0) ? '<p class="small muted" style="padding:0 16px 14px">Total confirmed infected images across all facilities, by day.</p>' : ''))}</div>`;
    },
  };
})();
