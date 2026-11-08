/* FL: reads the phones' compressed updates and compiles them into a new model
 * (Federated Averaging). Same format and maths as tools/fl_core.py and the app.
 *
 * Update format (little-endian):
 *   header, 16 bytes:  "MFL1", n (uint32), k (uint32), bits (uint8), flags (uint8), 2 spare bytes
 *   indices:           k x uint32           (left out when flags bit 0 = dense)
 *   values, bits=32:   k x float32
 *   values, bits=8:    ceil(k / 1024) x float32 scales, then k x int8
 */
(function () {
  'use strict';

  const N_VALUES = 413442; // trained layers of MobileNetV2: W1, b1, W2, b2
  const BLOCK = 1024;

  /** head.bin (413,442 float32 values) -> Float32Array */
  function readHead(buffer) {
    if (buffer.byteLength !== N_VALUES * 4) throw new Error(`Model file has ${buffer.byteLength} bytes, expected ${N_VALUES * 4}`);
    const dv = new DataView(buffer);
    const w = new Float32Array(N_VALUES);
    for (let i = 0; i < N_VALUES; i++) w[i] = dv.getFloat32(i * 4, true);
    return w;
  }

  function writeHead(w) {
    const buf = new ArrayBuffer(w.length * 4);
    const dv = new DataView(buf);
    for (let i = 0; i < w.length; i++) dv.setFloat32(i * 4, w[i], true);
    return new Uint8Array(buf);
  }

  /** A compressed update -> the full change to the model (zeros where nothing was sent). */
  function decompress(buffer) {
    const dv = new DataView(buffer);
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
    if (magic !== 'MFL1') throw new Error('Not a MalariaFL update');
    const n = dv.getUint32(4, true), k = dv.getUint32(8, true);
    const bits = dv.getUint8(12), dense = (dv.getUint8(13) & 1) === 1;
    let off = 16;
    const idx = new Uint32Array(k);
    if (dense) {
      for (let t = 0; t < k; t++) idx[t] = t;
    } else {
      for (let t = 0; t < k; t++, off += 4) idx[t] = dv.getUint32(off, true);
    }
    const out = new Float32Array(n);
    if (bits === 8) {
      const nb = Math.ceil(k / BLOCK);
      const scales = new Float32Array(nb);
      for (let b = 0; b < nb; b++, off += 4) scales[b] = dv.getFloat32(off, true);
      for (let t = 0; t < k; t++, off++) out[idx[t]] = dv.getInt8(off) * scales[Math.floor(t / BLOCK)];
    } else {
      for (let t = 0; t < k; t++, off += 4) out[idx[t]] = dv.getFloat32(off, true);
    }
    return { delta: out, n, k, bits, dense };
  }

  /** New model = old model + average of the updates, weighted by images trained on. */
  function compile(headBuffer, updates) {
    const w = readHead(headBuffer);
    const total = updates.reduce((a, u) => a + Math.max(1, u.samples), 0);
    updates.forEach(u => {
      const { delta, n } = decompress(u.buffer);
      if (n !== N_VALUES) throw new Error('An update has the wrong size');
      const share = Math.max(1, u.samples) / total;
      for (let i = 0; i < N_VALUES; i++) w[i] += delta[i] * share;
    });
    return w;
  }

  // ------------------------------------------------------------ zip (stored, no compression)
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /** files: [{ name, bytes: Uint8Array }] -> Uint8Array of a .zip file */
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), crc = crc32(f.bytes), size = f.bytes.length;
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true);
      local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
      local.setUint16(26, name.length, true);
      parts.push(new Uint8Array(local.buffer), name, f.bytes);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + size;
    });
    const cSize = central.reduce((a, p) => a + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
    let o = 0;
    all.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }

  // ------------------------------------------------------------ sizes (for explanations)
  /** Size in bytes of one update for the method used (Top-K 1% + 8-bit). */
  function updateSize(topk = 0.01, bits = 8, n = N_VALUES) {
    const dense = topk >= 1;
    const k = dense ? n : Math.max(1, Math.floor(n * topk));
    const values = bits === 8 ? k + Math.ceil(k / BLOCK) * 4 : 4 * k;
    return 16 + values + (dense ? 0 : 4 * k);
  }

  const api = { N_VALUES, readHead, writeHead, decompress, compile, zip, crc32, updateSize, FULL_BYTES: N_VALUES * 4 };
  if (typeof module !== 'undefined') module.exports = api; else window.FL = api;
})();
