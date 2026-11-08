/* Small SVG chart helpers: no libraries, works offline. */
(function () {
  'use strict';

  const COLORS = ['#1d5fad', '#2a9d8f', '#e08a1e', '#7a4fb3', '#6b7785', '#d1495b', '#3fa34d', '#8c6d1f'];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const raw = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || mag * 10;
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  /**
   * Line chart.
   * opts: { series:[{name, color?, points:[[x,y],...], dash?, width?}], height, yMin, yMax,
   *         xLabel, yLabel, yFormat(v), xFormat(v), xLog, refLine:{y, label} }
   */
  function line(opts) {
    const W = opts.width || 560, H = opts.height || 240;
    const m = { l: 46, r: 16, t: 14, b: opts.xLabel ? 40 : 26 };
    const all = opts.series.flatMap(s => s.points);
    if (!all.length) return '<div class="empty">No data yet</div>';
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMin === xMax) xMax = xMin + 1;
    let yMin = opts.yMin != null ? opts.yMin : Math.min(...ys);
    let yMax = opts.yMax != null ? opts.yMax : Math.max(...ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const fx = opts.xLog
      ? v => m.l + (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * (W - m.l - m.r)
      : v => m.l + (v - xMin) / (xMax - xMin) * (W - m.l - m.r);
    const fy = v => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const yf = opts.yFormat || (v => v);
    const xf = opts.xFormat || (v => v);

    let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'chart')}">`;
    niceTicks(yMin, yMax, 4).forEach(t => {
      out += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${fy(t)}" y2="${fy(t)}"/>`;
      out += `<text x="${m.l - 8}" y="${fy(t) + 4}" text-anchor="end">${esc(yf(t))}</text>`;
    });
    let xt;
    if (opts.xLog) {
      xt = [];
      for (let p = Math.floor(Math.log10(xMin)); p <= Math.ceil(Math.log10(xMax)); p++) {
        const v = Math.pow(10, p);
        if (v >= xMin * 0.999 && v <= xMax * 1.001) xt.push(v);
      }
    } else {
      xt = niceTicks(xMin, xMax, 6);
    }
    xt.forEach(t => {
      out += `<text x="${fx(t)}" y="${H - m.b + 16}" text-anchor="middle">${esc(xf(t))}</text>`;
    });
    out += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
    if (opts.refLine) {
      const y = fy(opts.refLine.y);
      out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" stroke="#8a939c" stroke-dasharray="4 4"/>`;
      if (opts.refLine.label) out += `<text x="${W - m.r}" y="${y - 5}" text-anchor="end">${esc(opts.refLine.label)}</text>`;
    }
    opts.series.forEach((s, i) => {
      const c = s.color || COLORS[i % COLORS.length];
      const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${fx(p[0]).toFixed(1)} ${fy(p[1]).toFixed(1)}`).join('');
      out += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${s.width || 2}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.points.length === 1 || s.dot) {
        const p = s.points[s.points.length - 1];
        out += `<circle cx="${fx(p[0])}" cy="${fy(p[1])}" r="3.5" fill="${c}"/>`;
      }
    });
    if (opts.xLabel) out += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">${esc(opts.xLabel)}</text>`;
    out += '</svg>';
    return out;
  }

  /** Vertical bars. opts: { bars:[{label, value, color?, note?}], height, format(v), log } */
  function bars(opts) {
    const W = opts.width || 560, H = opts.height || 240;
    const m = { l: 16, r: 16, t: 28, b: 46 };
    const n = opts.bars.length;
    const max = Math.max(...opts.bars.map(b => b.value));
    const min = opts.log ? Math.min(...opts.bars.map(b => b.value)) / 2 : 0;
    const fh = opts.log
      ? v => (Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) * (H - m.t - m.b)
      : v => v / max * (H - m.t - m.b);
    const slot = (W - m.l - m.r) / n;
    const bw = Math.min(64, slot * 0.6);
    const f = opts.format || (v => v);
    let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'bar chart')}">`;
    out += `<line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>`;
    opts.bars.forEach((b, i) => {
      const cx = m.l + slot * i + slot / 2;
      const h = Math.max(2, fh(b.value));
      const y = H - m.b - h;
      out += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${b.color || COLORS[0]}"/>`;
      out += `<text x="${cx}" y="${y - 6}" text-anchor="middle" style="font-weight:600;fill:#14171c">${esc(f(b.value))}</text>`;
      const words = String(b.label).split(' ');
      const lines = [];
      let cur = '';
      words.forEach(w => { if ((cur + ' ' + w).trim().length > Math.max(8, slot / 6.5)) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; });
      lines.push(cur.trim());
      lines.slice(0, 3).forEach((l, j) => {
        out += `<text x="${cx}" y="${H - m.b + 15 + j * 12}" text-anchor="middle">${esc(l)}</text>`;
      });
    });
    out += '</svg>';
    return out;
  }

  /** Horizontal stacked bars for class mix: rows:[{label, parts:[{value,color,name}]}] */
  function stacked(opts) {
    const W = 640, rowH = 26, gap = 10, labelW = 150;
    const H = opts.rows.length * (rowH + gap) + 10;
    const max = Math.max(...opts.rows.map(r => r.parts.reduce((a, p) => a + p.value, 0)), 1);
    let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'stacked bars')}">`;
    opts.rows.forEach((r, i) => {
      const y = 5 + i * (rowH + gap);
      out += `<text x="0" y="${y + rowH / 2 + 4}">${esc(r.label)}</text>`;
      let x = labelW;
      const total = r.parts.reduce((a, p) => a + p.value, 0);
      r.parts.forEach(p => {
        const w = p.value / max * (W - labelW - 70);
        if (w > 0) out += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" fill="${p.color}"/>`;
        x += w;
      });
      out += `<text x="${x + 8}" y="${y + rowH / 2 + 4}" style="fill:#14171c">${total.toLocaleString()}</text>`;
    });
    out += '</svg>';
    return out;
  }

  function legend(series) {
    return '<div class="legend">' + series.map((s, i) =>
      `<span><i style="background:${s.color || COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join('') + '</div>';
  }

  window.Charts = { line, bars, stacked, legend, COLORS };
})();
