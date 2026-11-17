/* Motor do cubo: simulador NxN baseado em autocolantes, baralhamentos e diagramas SVG. */
(function (root) {
  'use strict';

  // Índices das faces: 0 U, 1 R, 2 F, 3 D, 4 L, 5 B
  const NORMALS = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
  const FACE_AX = { U: [1, 1], R: [0, 1], F: [2, 1], D: [1, -1], L: [0, -1], B: [2, -1] };
  const clampc = (v, lim) => Math.max(-lim, Math.min(lim, v));
  const key = p => p[0] + ',' + p[1] + ',' + p[2];

  function solved(N) {
    const st = [];
    NORMALS.forEach((n, fi) => {
      const ax = n.findIndex(v => v !== 0);
      const o = [0, 1, 2].filter(a => a !== ax);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const p = [0, 0, 0];
        p[ax] = n[ax] * N; p[o[0]] = 2 * i - (N - 1); p[o[1]] = 2 * j - (N - 1);
        st.push({ p, c: fi });
      }
    });
    return { N, st };
  }

  function clone(s) { return { N: s.N, st: s.st.map(k => ({ p: k.p.slice(), c: k.c })) }; }

  // q = número de rotações de +90º (regra da mão direita) em torno do eixo
  function rot(p, ax, q) {
    q = ((q % 4) + 4) % 4;
    let [x, y, z] = p;
    for (let k = 0; k < q; k++) {
      if (ax === 0) { const t = y; y = -z; z = t; }
      else if (ax === 1) { const t = z; z = -x; x = t; }
      else { const t = x; x = -y; y = t; }
    }
    return [x, y, z];
  }

  function tokenize(alg) {
    return String(alg || '').replace(/[’`´]/g, "'").replace(/[()\[\],]/g, ' ').trim().split(/\s+/).filter(Boolean);
  }

  function parseMove(tok, N) {
    const m = /^(\d*)([URFDLBurfdlbMESxyz])(w?)(2'|'2|2|')?$/.exec(tok);
    if (!m) return null;
    const num = m[1] ? parseInt(m[1], 10) : 0;
    const f = m[2], w = m[3], suf = m[4] || '';
    const amt = suf === '' ? 1 : (suf.includes('2') ? 2 : -1);
    const lim = N - 1;
    if ('xyz'.includes(f)) return { ax: 'xyz'.indexOf(f), q: -amt, pred: () => true };
    if ('MES'.includes(f)) {
      const ax = { M: 0, E: 1, S: 2 }[f];
      return { ax, q: f === 'S' ? -amt : amt, pred: p => Math.abs(clampc(p[ax], lim)) < lim };
    }
    const F = f.toUpperCase();
    const [ax, s] = FACE_AX[F];
    let lo = 0, hi = 0;
    if (w || f !== F) { hi = (num || 2) - 1; }
    else if (num) { lo = hi = num - 1; }
    return {
      ax, q: -s * amt,
      pred: p => { const li = (lim - s * clampc(p[ax], lim)) / 2; return li >= lo && li <= hi; }
    };
  }

  function apply(state, alg) {
    for (const tok of tokenize(alg)) {
      const mv = parseMove(tok, state.N);
      if (!mv) throw new Error('Movimento inválido: ' + tok);
      for (const k of state.st) if (mv.pred(k.p)) k.p = rot(k.p, mv.ax, mv.q);
    }
    return state;
  }

  function validAlg(alg, N) { return tokenize(alg).every(t => parseMove(t, N || 3)); }

  function invert(alg) {
    return tokenize(alg).reverse().map(t => {
      if (/2'$|'2$/.test(t)) return t.replace("'", '');
      if (/2$/.test(t)) return t;
      if (/'$/.test(t)) return t.slice(0, -1);
      return t + "'";
    }).join(' ');
  }

  function faceOf(p, N) {
    for (let a = 0; a < 3; a++) if (Math.abs(p[a]) === N) return NORMALS.findIndex(n => n[a] === Math.sign(p[a]));
    return -1;
  }
  function colorAt(state, p) { const k = key(p); const s = state.st.find(x => key(x.p) === k); return s ? s.c : -1; }

  const ROTS = [];
  ['', 'x', 'x2', "x'", 'z', "z'"].forEach(a => ['', 'y', 'y2', "y'"].forEach(b => ROTS.push((a + ' ' + b).trim())));
  function normalize(state) {
    const N = state.N; if (N % 2 === 0) return state;
    const ok = s => colorAt(s, [0, N, 0]) === 0 && colorAt(s, [0, 0, N]) === 2;
    if (ok(state)) return state;
    for (const r of ROTS) { const s = apply(clone(state), r); if (ok(s)) return s; }
    return state;
  }

  function isF2L(s) { const lim = s.N - 1; return s.st.every(k => clampc(k.p[1], lim) === lim || k.c === faceOf(k.p, s.N)); }
  function isOriented(s) { return s.st.every(k => k.p[1] !== s.N || k.c === 0); }
  function isEO(s) { return s.st.every(k => k.p[1] !== s.N || (k.p[0] !== 0 && k.p[2] !== 0) || k.c === 0); }
  function isSolved(s) { return s.st.every(k => k.c === faceOf(k.p, s.N)); }

  function caseState(alg, auf) {
    const s = normalize(apply(solved(3), invert(alg)));
    if (auf) apply(s, auf);
    return s;
  }

  // Verifica se `alg` resolve o caso (com qualquer AUF antes e depois)
  function solvesCase(cs, alg, mode) {
    if (!validAlg(alg)) return false;
    const goal = mode === 'pll' ? isSolved : mode === 'eo' ? (s => isF2L(s) && isEO(s)) : (s => isF2L(s) && isOriented(s));
    for (const pre of ['', 'U', 'U2', "U'"]) {
      let s;
      try { s = normalize(apply(apply(clone(cs), pre), alg)); } catch (e) { return false; }
      for (const post of ['', 'U', 'U2', "U'"]) if (goal(apply(clone(s), post))) return true;
    }
    return false;
  }

  function topPieces(state) {
    const lim = state.N - 1, g = {};
    state.st.forEach(k => {
      const cp = k.p.map(v => clampc(v, lim));
      if (cp[1] !== lim) return;
      const kk = key(cp);
      (g[kk] = g[kk] || { pos: cp, cols: [] }).cols.push(k.c);
    });
    return Object.values(g).map(o => {
      const home = [0, 0, 0];
      o.cols.forEach(c => NORMALS[c].forEach((v, a) => { home[a] += v * lim; }));
      return { pos: o.pos, home };
    });
  }

  // ---------- Diagramas ----------
  const CASE_COL = ['#ffd500', '#ff8a1f', '#16b45a', '#f4f4f4', '#e5333b', '#2a6cf0'];
  const WCA_COL = ['#f4f4f4', '#e5333b', '#16b45a', '#ffd500', '#ff8a1f', '#2a6cf0'];
  const OFF = '#3a404f', NONE = '#262b36';
  const r1 = n => Math.round(n * 100) / 100;
  const rect = (x, y, w, h, fill, rx) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" fill="${fill}"/>`;

  function caseSVG(state, mode, opts) {
    opts = opts || {};
    const N = 3, lim = 2, g0 = 14, cell = 24, pad = 1.5, sw = 7.5;
    const isCorner = p => p[0] !== 0 && p[2] !== 0;
    let out = `<svg viewBox="0 0 100 100" class="case-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    out += rect(g0 - 1, g0 - 1, 3 * cell + 2, 3 * cell + 2, '#11141a', 4);
    for (const k of state.st) {
      const p = k.p, cp = p.map(v => clampc(v, lim));
      if (cp[1] !== lim) continue;
      const masked = mode === 'eo' && isCorner(cp);
      let fill;
      if (mode === 'pll') fill = CASE_COL[k.c];
      else fill = (!masked && k.c === 0) ? CASE_COL[0] : OFF;
      if (p[1] === N) {
        out += rect(g0 + ((p[0] + lim) / 2) * cell + pad, g0 + ((p[2] + lim) / 2) * cell + pad, cell - 2 * pad, cell - 2 * pad, fill, 3);
        continue;
      }
      if (mode !== 'pll' && fill === OFF) fill = NONE;
      const along = v => g0 + ((v + lim) / 2) * cell + pad;
      const len = cell - 2 * pad;
      if (p[2] === -N) out += rect(along(p[0]), g0 - 2 - sw, len, sw, fill, 2);
      else if (p[2] === N) out += rect(along(p[0]), g0 + 3 * cell + 2, len, sw, fill, 2);
      else if (p[0] === -N) out += rect(g0 - 2 - sw, along(p[2]), sw, len, fill, 2);
      else if (p[0] === N) out += rect(g0 + 3 * cell + 2, along(p[2]), sw, len, fill, 2);
    }
    if (mode === 'pll' && opts.arrows) {
      const ctr = p => [g0 + ((p[0] + lim) / 2 + 0.5) * cell, g0 + ((p[2] + lim) / 2 + 0.5) * cell];
      // Escolhe o AUF final que minimiza as peças a mover
      const pcs = topPieces(state);
      let best = null;
      for (let q = 0; q < 4; q++) {
        const mv = pcs.map(o => ({ pos: o.pos, home: rot(o.home, 1, q) })).filter(o => key(o.pos) !== key(o.home));
        if (!best || mv.length < best.length) best = mv;
      }
      const moves = best.map(o => ({ a: key(o.pos), b: key(o.home), from: ctr(o.pos), to: ctr(o.home) }));
      const done = new Set();
      for (const m of moves) {
        if (done.has(m.a + '>' + m.b)) continue;
        const back = moves.find(o => o.a === m.b && o.b === m.a);
        if (back) done.add(back.a + '>' + back.b);
        out += arrow(m.from, m.to, !!back);
      }
    }
    return out + '</svg>';
  }

  function arrow(f, t, both) {
    const dx = t[0] - f[0], dy = t[1] - f[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const s = [f[0] + ux * 5, f[1] + uy * 5], e = [t[0] - ux * 5, t[1] - uy * 5];
    const head = (tip, dirx, diry) => {
      const bx = tip[0] - dirx * 6.5, by = tip[1] - diry * 6.5, px = -diry * 3.6, py = dirx * 3.6;
      return `<polygon points="${r1(tip[0])},${r1(tip[1])} ${r1(bx + px)},${r1(by + py)} ${r1(bx - px)},${r1(by - py)}" fill="#14161c"/>`;
    };
    const ls = both ? [s[0] + ux * 5, s[1] + uy * 5] : s, le = [e[0] - ux * 5, e[1] - uy * 5];
    let o = `<line x1="${r1(ls[0])}" y1="${r1(ls[1])}" x2="${r1(le[0])}" y2="${r1(le[1])}" stroke="#14161c" stroke-width="2.6" stroke-linecap="round"/>`;
    o += head(e, ux, uy);
    if (both) o += head(s, -ux, -uy);
    return o;
  }

  function netSVG(state) {
    const N = state.N, lim = N - 1, F = 30, gap = 2, cs = F / N;
    const origin = { 0: [1, 0], 4: [0, 1], 2: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2] };
    let out = `<svg viewBox="0 0 ${4 * F + 3 * gap} ${3 * F + 2 * gap}" xmlns="http://www.w3.org/2000/svg" class="net-svg" aria-label="Imagem do baralhamento">`;
    for (const k of state.st) {
      const f = faceOf(k.p, N), [x, y, z] = k.p;
      let c, r;
      switch (f) {
        case 0: c = (x + lim) / 2; r = (z + lim) / 2; break;
        case 2: c = (x + lim) / 2; r = (lim - y) / 2; break;
        case 1: c = (lim - z) / 2; r = (lim - y) / 2; break;
        case 5: c = (lim - x) / 2; r = (lim - y) / 2; break;
        case 4: c = (z + lim) / 2; r = (lim - y) / 2; break;
        default: c = (x + lim) / 2; r = (lim - z) / 2;
      }
      const [oc, orr] = origin[f];
      const X = oc * (F + gap) + c * cs, Y = orr * (F + gap) + r * cs, in_ = Math.min(0.5, cs * 0.06);
      out += rect(X + in_, Y + in_, cs - 2 * in_, cs - 2 * in_, WCA_COL[k.c], r1(cs * 0.12));
    }
    return out + '</svg>';
  }

  // ---------- Baralhamentos ----------
  const rnd = n => Math.floor(Math.random() * n);
  function nxnScramble(N, len) {
    const faces = N === 2 ? ['R', 'U', 'F'] : ['U', 'D', 'R', 'L', 'F', 'B'];
    const axisOf = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
    const maxW = N >= 4 ? Math.floor(N / 2) : 1;
    const out = []; let lastAx = -1;
    while (out.length < len) {
      const f = faces[rnd(faces.length)];
      if (axisOf[f] === lastAx) continue;
      lastAx = axisOf[f];
      const w = 1 + rnd(maxW);
      const base = w === 1 ? f : (w === 2 ? f + 'w' : w + f + 'w');
      out.push(base + ['', "'", '2'][rnd(3)]);
    }
    return out.join(' ');
  }
  function pyraScramble() {
    const out = []; let last = '';
    while (out.length < 11) { const f = 'ULRB'[rnd(4)]; if (f === last) continue; last = f; out.push(f + (rnd(2) ? "'" : '')); }
    'ulrb'.split('').forEach(t => { const r = rnd(3); if (r) out.push(t + (r === 2 ? "'" : '')); });
    return out.join(' ');
  }
  function skewbScramble() {
    const out = []; let last = '';
    while (out.length < 9) { const f = 'RULB'[rnd(4)]; if (f === last) continue; last = f; out.push(f + (rnd(2) ? "'" : '')); }
    return out.join(' ');
  }
  function minxScramble() {
    const lines = [];
    for (let l = 0; l < 7; l++) {
      const m = [];
      for (let i = 0; i < 10; i++) m.push((i % 2 ? 'D' : 'R') + (rnd(2) ? '++' : '--'));
      m.push(rnd(2) ? 'U' : "U'");
      lines.push(m.join(' '));
    }
    return lines.join('\n');
  }

  const PUZZLES = [
    { id: '333', name: '3x3x3', N: 3, len: 20 },
    { id: '222', name: '2x2x2', N: 2, len: 11 },
    { id: '444', name: '4x4x4', N: 4, len: 40 },
    { id: '555', name: '5x5x5', N: 5, len: 60 },
    { id: '666', name: '6x6x6', N: 6, len: 80 },
    { id: '777', name: '7x7x7', N: 7, len: 100 },
    { id: '333oh', name: '3x3x3 OH', N: 3, len: 20 },
    { id: 'pyram', name: 'Pyraminx' },
    { id: 'skewb', name: 'Skewb' },
    { id: 'minx', name: 'Megaminx' }
  ];
  function scramble(pid) {
    const p = PUZZLES.find(x => x.id === pid) || PUZZLES[0];
    if (p.N) return nxnScramble(p.N, p.len);
    if (pid === 'pyram') return pyraScramble();
    if (pid === 'skewb') return skewbScramble();
    return minxScramble();
  }
  function scrambleNet(pid, scr) {
    const p = PUZZLES.find(x => x.id === pid);
    if (!p || !p.N) return '';
    try { return netSVG(apply(solved(p.N), scr)); } catch (e) { return ''; }
  }

  const api = {
    solved, clone, apply, invert, tokenize, validAlg, normalize, caseState, solvesCase,
    isF2L, isOriented, isEO, isSolved, topPieces, caseSVG, netSVG, scramble, scrambleNet, PUZZLES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cube = api;
})(typeof window !== 'undefined' ? window : globalThis);
