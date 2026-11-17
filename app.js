/* CuboLab — timer, evolução e aprendizagem de algoritmos. Dados guardados no localStorage. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const STORE_KEY = 'cubolab:v1';
  const STATUSES = [
    { id: 'todo', name: 'Por aprender', color: 'var(--s-todo)' },
    { id: 'learning', name: 'Em progresso', color: 'var(--s-learning)' },
    { id: 'learned', name: 'Aprendido', color: 'var(--s-learned)' }
  ];

  // ================= Dados =================
  function defaultDB() {
    return { app: 'cubolab', ver: 1, solves: {}, algs: {}, settings: { puzzle: '333', inspection: false, hideRunning: false, showNet: true, learnSet: 'pll', group: '' } };
  }
  function load() {
    const base = defaultDB();
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && d.solves) { d.settings = Object.assign(base.settings, d.settings); d.algs = d.algs || {}; return withSync(d); }
    } catch (e) { /* sem dados */ }
    return withSync(base);
  }
  // Estado de sincronização: o que ainda falta enviar para a nuvem
  function withSync(d) { d.dirty = d.dirty || {}; d.tomb = d.tomb || {}; d.algDirty = d.algDirty || {}; return d; }
  let DB = load();
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
    catch (e) { toast('Não foi possível guardar no browser — exporta uma cópia de segurança.'); }
  }
  function save() { persist(); window.dispatchEvent(new Event('cubolab:change')); }
  const S = () => DB.settings;
  const solves = (pid) => { pid = pid || S().puzzle; return DB.solves[pid] || (DB.solves[pid] = []); };
  // Cada resolução tem um id estável (o mesmo em todos os dispositivos, também para importações)
  const sid = (pid, s) => s.id || (s.id = pid + '_' + s.d + '_' + s.t);
  function touch(pid, s) { sid(pid, s); s.u = Date.now(); DB.dirty[s.id] = { pid, u: s.u }; }
  function removeSolve(pid, s) {
    const l = solves(pid), i = l.indexOf(s);
    if (i < 0) return;
    l.splice(i, 1); sid(pid, s);
    delete DB.dirty[s.id];
    DB.tomb[s.id] = { pid, u: Date.now() };
  }
  const puzzleName = id => (Cube.PUZZLES.find(p => p.id === id) || {}).name || id;

  // ================= Utilidades =================
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  function fmt(ms, round) {
    if (ms == null || Number.isNaN(ms)) return '-';
    if (ms === Infinity) return 'DNF';
    let cs = round ? Math.round(ms / 10) : Math.floor(ms / 10);
    const m = Math.floor(cs / 6000); cs -= m * 6000;
    const s = Math.floor(cs / 100), c = cs % 100;
    return (m ? m + ':' + pad2(s) : s) + '.' + pad2(c);
  }
  const eff = s => s.p === -1 ? Infinity : s.t + (s.p || 0);
  const solveStr = s => s.p === -1 ? 'DNF' : fmt(s.t + (s.p || 0)) + (s.p === 2000 ? '+' : '');
  const fmtDate = (ts, withTime) => new Date(ts).toLocaleString('pt-PT', withTime ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  // ---- Modais ----
  const modalRoot = $('#modalRoot');
  const modalOpen = () => modalRoot.children.length > 0;
  function openModal(html, cls) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${cls || ''}" role="dialog">${html}</div>`;
    bg.addEventListener('mousedown', e => { if (e.target === bg) closeModal(bg); });
    bg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(bg)));
    modalRoot.appendChild(bg);
    return bg;
  }
  function closeModal(bg) { if (!bg || !bg.parentNode) return; bg.remove(); if (bg.onclose) bg.onclose(); }
  const head = (title, sub) => `<div class="modal-head"><div><h3>${title}</h3>${sub ? `<div class="muted">${sub}</div>` : ''}</div><button class="modal-close" data-close aria-label="Fechar">×</button></div>`;

  // ================= Estatísticas =================
  const cmp = (a, b) => a === b ? 0 : (a < b ? -1 : 1);
  function avgWindow(w, mean) {
    if (mean) return w.some(x => x === Infinity) ? Infinity : w.reduce((a, b) => a + b, 0) / w.length;
    const trim = w.length <= 12 ? 1 : Math.ceil(w.length * 0.05);
    const k = w.slice().sort(cmp).slice(trim, w.length - trim);
    if (k.some(x => x === Infinity)) return Infinity;
    return k.reduce((a, b) => a + b, 0) / k.length;
  }
  function rolling(e, n, mean) {
    const r = new Array(e.length).fill(null);
    for (let i = n - 1; i < e.length; i++) r[i] = avgWindow(e.slice(i - n + 1, i + 1), mean);
    return r;
  }
  function bestOf(arr) {
    let bi = -1;
    arr.forEach((v, i) => { if (v != null && v !== Infinity && (bi < 0 || v < arr[bi])) bi = i; });
    return bi < 0 ? { v: null, i: -1 } : { v: arr[bi], i: bi };
  }
  const AVGS = [['mo3', 3, true], ['ao5', 5], ['ao12', 12], ['ao50', 50], ['ao100', 100]];
  function computeStats(list) {
    const e = list.map(eff);
    const st = { e, single: { cur: e.length ? e[e.length - 1] : null, best: bestOf(e) } };
    AVGS.forEach(([k, n, mean]) => { const r = rolling(e, n, mean); st[k] = { roll: r, cur: r.length ? r[r.length - 1] : null, best: bestOf(r) }; });
    const ok = e.filter(x => x !== Infinity);
    st.mean = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
    st.valid = ok.length;
    return st;
  }

  // ================= Navegação =================
  const pages = ['timer', 'evolucao', 'aprender'];
  let currentPage = 'timer';
  function route() {
    const p = (location.hash || '#timer').slice(1);
    currentPage = pages.includes(p) ? p : 'timer';
    pages.forEach(id => $('#page-' + id).classList.toggle('active', id === currentPage));
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('active', a.dataset.page === currentPage));
    $('#puzzleSel').classList.toggle('hidden', currentPage === 'aprender');
    renderPage();
  }
  function renderPage() {
    if (currentPage === 'timer') renderTimerSide();
    else if (currentPage === 'evolucao') renderEvolution();
    else renderLearn();
  }
  window.addEventListener('hashchange', route);

  const puzzleSel = $('#puzzleSel');
  puzzleSel.innerHTML = Cube.PUZZLES.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  puzzleSel.value = S().puzzle;
  puzzleSel.addEventListener('change', () => {
    S().puzzle = puzzleSel.value; save();
    T.history = []; newScramble(); resetDisplay(); renderPage(); puzzleSel.blur();
  });

  // ================= Timer =================
  const timeEl = $('#time'), diffEl = $('#diff');
  const T = { phase: 'idle', from: 'idle', holdTimer: null, start: 0, inspStart: 0, inInsp: false, pen: 0, raf: 0, ignoreUp: false, pendingInsp: false, scr: '', history: [] };

  function newScramble() {
    if (T.scr) T.history.push(T.scr);
    if (T.history.length > 30) T.history.shift();
    T.scr = Cube.scramble(S().puzzle);
    showScramble();
  }
  function showScramble() {
    const el = $('#scramble');
    el.textContent = T.scr;
    el.classList.toggle('long', T.scr.length > 90);
    $('#net').innerHTML = S().showNet ? Cube.scrambleNet(S().puzzle, T.scr) : '';
    $('#prevScr').disabled = !T.history.length;
  }
  $('#newScr').onclick = e => { e.currentTarget.blur(); newScramble(); };
  $('#prevScr').onclick = e => { e.currentTarget.blur(); if (T.history.length) { T.scr = T.history.pop(); showScramble(); } };
  $('#copyScr').onclick = e => { e.currentTarget.blur(); navigator.clipboard && navigator.clipboard.writeText(T.scr).then(() => toast('Baralhamento copiado')); };

  function setHint() {
    if (matchMedia('(pointer: coarse)').matches) { $('#hint').textContent = S().inspection ? 'Toca para a inspeção, depois mantém o dedo até ficar verde e larga' : 'Mantém o dedo no ecrã até ficar verde e larga para começar'; return; }
    $('#hint').innerHTML = S().inspection
      ? 'Carrega em <kbd>espaço</kbd> para a inspeção (15s), depois mantém premido e larga para começar'
      : 'Mantém <kbd>espaço</kbd> premido até ficar verde e larga para começar · <kbd>Esc</kbd> cancela';
  }
  function setCls(c) { timeEl.className = 'time' + (c ? ' ' + c : ''); }
  function resetDisplay() {
    const l = solves();
    const last = l[l.length - 1];
    timeEl.textContent = last ? solveStr(last) : '0.00';
    setCls(''); diffEl.textContent = ''; diffEl.className = 'diff';
  }

  function tick() {
    const now = performance.now();
    if (T.phase === 'running') {
      timeEl.textContent = S().hideRunning ? '…' : fmt(now - T.start);
    } else if (T.inInsp) {
      const e = (now - T.inspStart) / 1000;
      timeEl.textContent = e < 15 ? String(15 - Math.floor(e)) : (e < 17 ? '+2' : 'DNF');
    } else return;
    T.raf = requestAnimationFrame(tick);
  }
  function pressDown() {
    if (T.phase === 'running') { stopTimer(); return; }
    if (T.phase === 'idle' && S().inspection) { T.pendingInsp = true; return; }
    if (T.phase === 'idle' || T.phase === 'inspecting') {
      T.from = T.phase; T.phase = 'holding';
      if (!T.inInsp) timeEl.textContent = '0.00';
      diffEl.textContent = '';
      setCls('hold');
      clearTimeout(T.holdTimer);
      T.holdTimer = setTimeout(() => { if (T.phase === 'holding') { T.phase = 'ready'; setCls('ready'); } }, 300);
    }
  }
  function pressUp() {
    if (T.ignoreUp) { T.ignoreUp = false; return; }
    if (T.phase === 'holding') {
      clearTimeout(T.holdTimer); T.phase = T.from;
      if (T.phase === 'idle') resetDisplay(); else setCls('insp');
      return;
    }
    if (T.phase === 'ready') { startTimer(); return; }
    if (T.phase === 'idle' && T.pendingInsp) { T.pendingInsp = false; startInspection(); }
  }
  function startInspection() {
    T.phase = 'inspecting'; T.inInsp = true; T.inspStart = performance.now();
    diffEl.textContent = ''; setCls('insp');
    document.body.classList.add('running');
    cancelAnimationFrame(T.raf); tick();
  }
  function startTimer() {
    const now = performance.now();
    T.pen = 0;
    if (T.inInsp) { const e = (now - T.inspStart) / 1000; T.pen = e > 17 ? -1 : (e > 15 ? 2000 : 0); T.inInsp = false; }
    T.phase = 'running'; T.start = now; setCls('');
    document.body.classList.add('running');
    cancelAnimationFrame(T.raf); tick();
  }
  function stopTimer() {
    const t = Math.round(performance.now() - T.start);
    cancelAnimationFrame(T.raf);
    T.phase = 'idle'; T.ignoreUp = true;
    document.body.classList.remove('running');
    const list = solves();
    const prev = list[list.length - 1];
    const s = { t, p: T.pen, s: T.scr, d: Date.now() };
    list.push(s); touch(S().puzzle, s); save();
    timeEl.textContent = solveStr(s); setCls('');
    if (prev && eff(prev) !== Infinity && eff(s) !== Infinity) {
      const d = eff(s) - eff(prev);
      diffEl.textContent = '(' + (d < 0 ? '-' : '+') + fmt(Math.abs(d)) + ')';
      diffEl.className = 'diff ' + (d < 0 ? 'faster' : 'slower');
    } else { diffEl.textContent = ''; }
    const st = computeStats(list);
    if (list.length > 1 && st.single.best.i === list.length - 1) toast('🎉 Novo recorde pessoal de single!');
    else if (st.ao5.best.i === list.length - 1 && list.length > 5) toast('🎉 Novo recorde de ao5!');
    else if (st.ao12.best.i === list.length - 1 && list.length > 12) toast('🎉 Novo recorde de ao12!');
    newScramble();
    renderTimerSide(st);
  }
  function cancelTimer() {
    clearTimeout(T.holdTimer); cancelAnimationFrame(T.raf);
    T.phase = 'idle'; T.inInsp = false; T.pendingInsp = false;
    document.body.classList.remove('running');
    resetDisplay();
  }
  const timerActive = () => currentPage === 'timer' && !modalOpen();
  const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalOpen()) { closeModal(modalRoot.lastElementChild); return; }
    if (!timerActive() || isTyping(e)) return;
    if (e.key === 'Escape') { cancelTimer(); return; }
    if (T.phase === 'running') {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault(); stopTimer(); return;
    }
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (e.repeat) return;
    pressDown();
  });
  document.addEventListener('keyup', e => {
    if (!timerActive() || isTyping(e)) { T.ignoreUp = false; return; }
    if (T.ignoreUp) { T.ignoreUp = false; return; }
    if (e.code === 'Space') { e.preventDefault(); pressUp(); }
  });
  const tm = $('#timerMain');
  const touchIgnore = e => e.target.closest('button, a, input, select, .scramble, .net');
  tm.addEventListener('touchstart', e => { if (touchIgnore(e) && T.phase !== 'running') return; e.preventDefault(); pressDown(); }, { passive: false });
  tm.addEventListener('touchend', e => { if (touchIgnore(e) && T.phase !== 'holding' && T.phase !== 'ready') return; e.preventDefault(); pressUp(); }, { passive: false });

  // ---- Barra lateral ----
  function renderTimerSide(st) {
    const list = solves();
    st = st || computeStats(list);
    const n = list.length;
    const rows = [['tempo', 'single'], ['mo3', 'mo3'], ['ao5', 'ao5'], ['ao12', 'ao12'], ['ao50', 'ao50'], ['ao100', 'ao100']];
    $('#statsTable').innerHTML = '<tr><th></th><th>atual</th><th>melhor</th></tr>' + rows.map(([lbl, k]) => {
      const o = st[k];
      const cur = k === 'single' ? (n ? solveStr(list[n - 1]) : '-') : fmt(o.cur, true);
      const best = k === 'single' ? fmt(o.best.v) : fmt(o.best.v, true);
      const isBest = o.best.i === n - 1 && n > 1 && o.best.v != null;
      const cc = k !== 'single' && o.cur != null ? ` clk" data-avg="${k}" data-i="${n - 1}` : '';
      const bc = k !== 'single' && o.best.i >= 0 ? ` clk" data-avg="${k}" data-i="${o.best.i}` : (k === 'single' && o.best.i >= 0 ? ` clk" data-solve="${o.best.i}` : '');
      return `<tr><td>${lbl}</td><td class="${isBest ? 'best' : ''}${cc}">${cur}</td><td class="${bc}">${best}</td></tr>`;
    }).join('');
    $('#sessionInfo').innerHTML = `${puzzleName(S().puzzle)} · ${st.valid}/${n} resoluções<br><span class="muted">média: ${fmt(st.mean, true)}</span>`;
    const LIMIT = T.showAll ? n : Math.min(n, 300);
    let html = '<tr><th>#</th><th>tempo</th><th>ao5</th><th>ao12</th></tr>';
    for (let i = n - 1; i >= n - LIMIT; i--) {
      const s = list[i];
      const sc = s.p === -1 ? 'dnf' : (i === st.single.best.i ? 'pb' : '');
      html += `<tr data-solve="${i}"><td>${i + 1}</td><td class="${sc}">${solveStr(s)}${s.c ? ' *' : ''}</td>` +
        `<td class="${i === st.ao5.best.i ? 'pb' : ''}" data-avg="ao5" data-i="${i}">${fmt(st.ao5.roll[i], true)}</td>` +
        `<td class="${i === st.ao12.best.i ? 'pb' : ''}" data-avg="ao12" data-i="${i}">${fmt(st.ao12.roll[i], true)}</td></tr>`;
    }
    if (LIMIT < n) html += `<tr><td colspan="4" class="more" data-more>Mostrar todas (${n})</td></tr>`;
    if (!n) html += '<tr><td colspan="4" style="text-align:center;padding:20px" class="muted">Sem resoluções ainda</td></tr>';
    $('#timesTable').innerHTML = html;
    renderLastActions();
    $('#liveAvgs').innerHTML = `<span>ao5: <b>${fmt(st.ao5.cur, true)}</b></span><span>ao12: <b>${fmt(st.ao12.cur, true)}</b></span>`;
  }
  function renderLastActions() {
    const list = solves(), s = list[list.length - 1];
    const box = $('#lastActions');
    if (!s || T.phase !== 'idle') { box.innerHTML = ''; return; }
    box.innerHTML = `<button data-pen="0" class="${!s.p ? 'on' : ''}">OK</button><button data-pen="2000" class="${s.p === 2000 ? 'on' : ''}">+2</button><button data-pen="-1" class="${s.p === -1 ? 'on' : ''}">DNF</button><button data-del>Apagar</button>`;
  }
  $('#lastActions').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; b.blur();
    const list = solves(), s = list[list.length - 1]; if (!s) return;
    if (b.hasAttribute('data-del')) { removeSolve(S().puzzle, s); save(); resetDisplay(); renderTimerSide(); toast('Resolução apagada'); return; }
    s.p = +b.dataset.pen; touch(S().puzzle, s); save(); timeEl.textContent = solveStr(s); renderTimerSide();
  });
  function sideClick(e) {
    if (e.target.closest('[data-more]')) { T.showAll = true; renderTimerSide(); return; }
    const a = e.target.closest('[data-avg]');
    if (a) { avgModal(a.dataset.avg, +a.dataset.i); return; }
    const r = e.target.closest('[data-solve]');
    if (r) solveModal(+r.dataset.solve);
  }
  $('#timesTable').addEventListener('click', sideClick);
  $('#statsTable').addEventListener('click', sideClick);

  function solveModal(i) {
    const list = solves(), s = list[i]; if (!s) return;
    const m = openModal(head(`Resolução #${i + 1}`, fmtDate(s.d, true)) + `
      <div class="big-time" id="mTime">${solveStr(s)}</div>
      <div class="row"><div class="status-pick" id="mPen">
        <button data-pen="0" class="${!s.p ? 'on' : ''}">OK</button><button data-pen="2000" class="${s.p === 2000 ? 'on' : ''}">+2</button><button data-pen="-1" class="${s.p === -1 ? 'on' : ''}">DNF</button>
      </div></div>
      <div class="row"><label class="lbl">Baralhamento</label><div class="mono" style="white-space:pre-line">${esc(s.s) || '<span class="muted">—</span>'}</div></div>
      <div class="row"><label class="lbl">Comentário</label><input type="text" id="mCom" value="${esc(s.c)}" placeholder="ex.: lockup no F2L, PLL nova…"></div>
      <div class="actions"><button class="btn-danger" id="mDel">Apagar</button><button class="btn-primary" data-close>Fechar</button></div>`);
    m.querySelector('#mPen').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      s.p = +b.dataset.pen; touch(S().puzzle, s); save();
      m.querySelectorAll('#mPen button').forEach(x => x.classList.toggle('on', x === b));
      m.querySelector('#mTime').textContent = solveStr(s);
    };
    m.querySelector('#mCom').oninput = e => { s.c = e.target.value || undefined; touch(S().puzzle, s); save(); };
    m.querySelector('#mDel').onclick = () => { if (confirm('Apagar esta resolução?')) { removeSolve(S().puzzle, s); save(); closeModal(m); } };
    m.onclose = () => { resetDisplay(); renderPage(); };
  }
  function avgModal(k, i) {
    const n = AVGS.find(a => a[0] === k)[1], mean = k.startsWith('mo');
    const list = solves(); if (i < n - 1) return;
    const win = list.slice(i - n + 1, i + 1), e = win.map(eff);
    const v = avgWindow(e, mean);
    const trimmed = new Set();
    if (!mean) {
      const trim = n <= 12 ? 1 : Math.ceil(n * 0.05);
      const idx = e.map((x, j) => j).sort((a, b) => cmp(e[a], e[b]));
      idx.slice(0, trim).concat(idx.slice(n - trim)).forEach(j => trimmed.add(j));
    }
    const lines = win.map((s, j) => `<div>${i - n + j + 2}. ${trimmed.has(j) ? `<span class="trim">(${solveStr(s)})</span>` : solveStr(s)} <span class="muted small">&nbsp;${esc(s.s && s.s.length < 120 ? s.s : '')}</span></div>`).join('');
    openModal(head(`${k}: ${fmt(v, true)}`, `resoluções ${i - n + 2}–${i + 1} · ${fmtDate(win[win.length - 1].d)}`) + `<div class="avg-list">${lines}</div>
      <div class="actions"><button class="btn" id="cpAvg">Copiar</button><button class="btn-primary" data-close>Fechar</button></div>`, 'wide')
      .querySelector('#cpAvg').onclick = () => {
        const txt = `${k}: ${fmt(v, true)}\n` + win.map((s, j) => `${j + 1}. ${trimmed.has(j) ? '(' + solveStr(s) + ')' : solveStr(s)}   ${s.s || ''}`).join('\n');
        navigator.clipboard.writeText(txt).then(() => toast('Copiado'));
      };
  }

  // ================= Definições e dados =================
  $('#settingsBtn').onclick = e => { e.currentTarget.blur(); settingsModal(); };
  function sw(id, on) { return `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></label>`; }
  function settingsModal() {
    const m = openModal(head('Definições') + `
      <div class="setting"><div>Inspeção WCA (15 s)<div class="desc">+2 se passares os 15 s, DNF depois dos 17 s</div></div>${sw('sInsp', S().inspection)}</div>
      <div class="setting"><div>Esconder o tempo durante a resolução</div>${sw('sHide', S().hideRunning)}</div>
      <div class="setting"><div>Mostrar imagem do baralhamento</div>${sw('sNet', S().showNet)}</div>
      <div class="section-title">Dados</div>
      <p class="muted small" style="margin-top:0">Tudo fica guardado neste browser. Exporta uma cópia de segurança de vez em quando.</p>
      <div class="btn-row">
        <button class="btn" id="sCs">Importar do csTimer</button>
        <button class="btn" id="sExp">Exportar cópia</button>
        <button class="btn" id="sImp">Restaurar cópia</button>
      </div>
      <div class="section-title">Zona perigosa</div>
      <button class="btn-danger" id="sClr">Apagar todas as resoluções de ${esc(puzzleName(S().puzzle))}</button>
      <input type="file" id="sFile" accept=".json,.txt,application/json,text/plain" class="hidden">
      <div class="actions"><button class="btn-primary" data-close>Feito</button></div>`);
    const bind = (id, k, after) => { m.querySelector(id).onchange = e => { S()[k] = e.target.checked; save(); after && after(); }; };
    bind('#sInsp', 'inspection', setHint); bind('#sHide', 'hideRunning'); bind('#sNet', 'showNet', showScramble);
    let mode = '';
    const file = m.querySelector('#sFile');
    m.querySelector('#sCs').onclick = () => { mode = 'cs'; file.click(); };
    m.querySelector('#sImp').onclick = () => { mode = 'backup'; file.click(); };
    file.onchange = () => {
      const f = file.files[0]; if (!f) return;
      f.text().then(txt => {
        let data; try { data = JSON.parse(txt); } catch (e) { toast('Ficheiro inválido'); return; }
        file.value = '';
        if (mode === 'cs') { closeModal(m); csTimerImport(data); } else { restoreBackup(data); closeModal(m); }
      });
    };
    m.querySelector('#sExp').onclick = () => {
      const { dirty, tomb, algDirty, ...exp } = DB; // eslint-disable-line no-unused-vars
      const blob = new Blob([JSON.stringify(exp, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `cubolab-${dayKey(Date.now())}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    m.querySelector('#sClr').onclick = () => {
      const n = solves().length;
      if (n && confirm(`Apagar ${n} resoluções de ${puzzleName(S().puzzle)}? Isto não pode ser desfeito.`)) { solves().slice().forEach(s => removeSolve(S().puzzle, s)); save(); closeModal(m); resetDisplay(); renderPage(); toast('Resoluções apagadas'); }
    };
  }
  function mergeSolves(pid, arr) {
    const list = solves(pid);
    const seen = new Set(list.map(s => s.d + ':' + s.t));
    let added = 0;
    arr.forEach(s => {
      if (seen.has(s.d + ':' + s.t)) return;
      s = { t: s.t, p: s.p || 0, s: s.s || '', d: s.d, c: s.c };
      list.push(s); touch(pid, s); seen.add(s.d + ':' + s.t); added++;
    });
    list.sort((a, b) => a.d - b.d);
    return added;
  }
  function restoreBackup(data) {
    if (!data || !data.solves) { toast('Isto não parece uma cópia do CuboLab'); return; }
    let added = 0;
    Object.keys(data.solves).forEach(pid => { added += mergeSolves(pid, data.solves[pid] || []); });
    Object.keys(data.algs || {}).forEach(id => { const a = Object.assign({}, data.algs[id]); delete a.u; setAlgData(id, a, true); });
    save(); renderPage(); resetDisplay();
    toast(`Cópia restaurada · ${added} resoluções novas`);
  }
  function guessPuzzle(scr) {
    scr = String(scr || '');
    const map = [['222', '222'], ['444', '444'], ['555', '555'], ['666', '666'], ['777', '777'], ['pyr', 'pyram'], ['skb', 'skewb'], ['mgm', 'minx'], ['minx', 'minx'], ['333oh', '333oh']];
    const f = map.find(([k]) => scr.startsWith(k));
    return f ? f[1] : '333';
  }
  function csTimerImport(data) {
    let meta = {};
    try { meta = JSON.parse((data.properties || {}).sessionData || '{}'); } catch (e) { meta = {}; }
    const sessions = Object.keys(data).filter(k => /^session\d+$/.test(k) && Array.isArray(data[k]) && data[k].length)
      .map(k => { const num = k.replace('session', ''), md = meta[num] || {}; return { key: k, name: md.name != null ? String(md.name) : num, n: data[k].length, guess: guessPuzzle(md.opt && md.opt.scrType) }; });
    if (!sessions.length) { toast('Não encontrei sessões com tempos neste ficheiro'); return; }
    const opts = sel => Cube.PUZZLES.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.name}</option>`).join('');
    const m = openModal(head('Importar do csTimer', 'Escolhe para que cubo vai cada sessão') +
      sessions.map((s, i) => `<div class="setting"><label style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" data-i="${i}" checked> Sessão “${esc(s.name)}” <span class="muted">· ${s.n} tempos</span></label><select data-p="${i}">${opts(s.guess)}</select></div>`).join('') +
      `<p class="muted small">No csTimer: ⚙ → Exportar → “Exportar para ficheiro”. Tempos repetidos são ignorados.</p>
      <div class="actions"><button class="btn" data-close>Cancelar</button><button class="btn-primary" id="doImp">Importar</button></div>`);
    m.querySelector('#doImp').onclick = () => {
      let total = 0;
      sessions.forEach((s, i) => {
        if (!m.querySelector(`[data-i="${i}"]`).checked) return;
        const pid = m.querySelector(`[data-p="${i}"]`).value;
        const arr = data[s.key].filter(r => Array.isArray(r) && Array.isArray(r[0])).map(r => {
          const pen = r[0][0], t = r[0][1];
          const o = { t: Math.round(t), p: pen === -1 ? -1 : (pen > 0 ? 2000 : 0), s: r[1] || '', d: (r[3] || 0) * 1000 };
          if (r[2]) o.c = String(r[2]);
          return o;
        }).filter(o => o.t > 0);
        total += mergeSolves(pid, arr);
      });
      save(); closeModal(m); resetDisplay(); renderPage();
      toast(`${total} resoluções importadas`);
    };
  }

  // ================= Evolução =================
  const charts = {};
  let evoRange = 'all';
  $('#evoRange').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    evoRange = b.dataset.range;
    document.querySelectorAll('#evoRange button').forEach(x => x.classList.toggle('on', x === b));
    renderEvolution();
  };
  const sec = ms => ms == null || ms === Infinity ? null : Math.round(ms / 10) / 100;
  function fmtDur(ms) { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + pad2(m % 60) + ' min'; }

  function renderEvolution() {
    $('#evoPuzzle').textContent = '· ' + puzzleName(S().puzzle);
    renderAlgProgress();
    const all = solves();
    const st = computeStats(all);
    const from = evoRange === 'all' ? 0 : Date.now() - (+evoRange) * 864e5;
    const idx = all.map((s, i) => i).filter(i => all[i].d >= from);
    const empty = !idx.length;
    $('#evoEmpty').classList.toggle('hidden', !empty);
    $('#evoContent').classList.toggle('hidden', empty);
    if (empty) { $('#evoEmpty').innerHTML = all.length ? 'Sem resoluções neste período.' : 'Ainda não há resoluções neste cubo. Vai ao <a href="#timer">Timer</a> ou importa o histórico do csTimer nas definições (⚙).'; $('#evoContent').classList.remove('hidden'); $('#evoContent').querySelectorAll('.card, .kpis').forEach(x => x.classList.add('hidden')); const ap = $('#algProgress').closest('.card'); ap.classList.remove('hidden'); return; }
    $('#evoContent').querySelectorAll('.card, .kpis').forEach(x => x.classList.remove('hidden'));

    // KPIs
    const best = (k) => { let b = { v: null, i: -1 }; idx.forEach(i => { const v = k === 'single' ? st.e[i] : st[k].roll[i]; if (v != null && v !== Infinity && (b.i < 0 || v < b.v)) b = { v, i }; }); return b; };
    const okE = idx.map(i => st.e[i]).filter(x => x !== Infinity);
    const mean = okE.length ? okE.reduce((a, b) => a + b, 0) / okE.length : null;
    const first = okE.slice(0, Math.min(50, Math.floor(okE.length / 2))), last = okE.slice(-Math.min(50, Math.floor(okE.length / 2)));
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    let impr = '';
    if (first.length >= 5) { const d = avg(first) - avg(last); impr = d > 0 ? `<div class="sub good">↓ ${fmt(d, true)} s vs. o início</div>` : `<div class="sub">↑ ${fmt(-d, true)} s vs. o início</div>`; }
    const days = new Set(idx.map(i => dayKey(all[i].d))).size;
    const totalT = idx.reduce((a, i) => a + all[i].t, 0);
    const k = (lbl, val, sub) => `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div>${sub || ''}</div>`;
    const dsub = b => b.i >= 0 ? `<div class="sub">${fmtDate(all[b.i].d)}</div>` : '<div class="sub">&nbsp;</div>';
    const b1 = best('single'), b5 = best('ao5'), b12 = best('ao12'), b100 = best('ao100');
    $('#kpis').innerHTML =
      k('Resoluções', idx.length, `<div class="sub">${days} dia${days === 1 ? '' : 's'} de treino</div>`) +
      k('Média', fmt(mean, true), impr || '<div class="sub">&nbsp;</div>') +
      k('Melhor single', fmt(b1.v), dsub(b1)) +
      k('Melhor ao5', fmt(b5.v, true), dsub(b5)) +
      k('Melhor ao12', fmt(b12.v, true), dsub(b12)) +
      k('Melhor ao100', fmt(b100.v, true), dsub(b100)) +
      k('Tempo a resolver', fmtDur(totalT), `<div class="sub">ao12 atual: ${fmt(st.ao12.cur, true)}</div>`);

    renderPBs(all, st);

    if (typeof Chart === 'undefined') {
      document.querySelectorAll('.chart-box').forEach(b => { b.innerHTML = '<div class="empty">Os gráficos precisam de internet para carregar (Chart.js).</div>'; });
      return;
    }
    Chart.defaults.color = '#8a92a6';
    Chart.defaults.borderColor = '#232833';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    const tipLabel = ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y * 1000, true)}`;
    const yTicks = { callback: v => fmt(v * 1000, true).replace(/\.00$/, '') };

    // Tempos por resolução
    const labels = idx.map(i => i + 1);
    const ds = (label, data, color, extra) => Object.assign({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, tension: .25, spanGaps: true }, extra || {});
    const series = [ds('single', idx.map(i => sec(st.e[i])), 'rgba(138,146,166,.55)', { showLine: false, pointRadius: idx.length > 400 ? 1.2 : 2.2, borderWidth: 0 })];
    series.push(ds('ao5', idx.map(i => sec(st.ao5.roll[i])), '#ffa53d', { borderWidth: 1.5 }));
    series.push(ds('ao12', idx.map(i => sec(st.ao12.roll[i])), '#4f8cff'));
    if (all.length >= 50) series.push(ds('ao50', idx.map(i => sec(st.ao50.roll[i])), '#2fd17a', { borderWidth: 2.5 }));
    if (all.length >= 100) series.push(ds('ao100', idx.map(i => sec(st.ao100.roll[i])), '#e46bff', { borderWidth: 2.5 }));
    // Remove outliers (DNF/tempos muito altos) do eixo
    const sorted = okE.slice().sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * 0.98)] || sorted[sorted.length - 1];
    makeChart('chartSolves', {
      type: 'line', data: { labels, datasets: series },
      options: {
        animation: false, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } }, tooltip: { callbacks: { title: it => 'Resolução #' + it[0].label, label: tipLabel } } },
        scales: { x: { ticks: { maxTicksLimit: 10 }, grid: { display: false }, title: { display: true, text: 'nº da resolução' } }, y: { ticks: yTicks, suggestedMax: p98 ? sec(p98) * 1.05 : undefined, max: p98 ? Math.ceil(sec(p98) * 1.08) : undefined } }
      }
    });

    // Média por dia
    const byDay = {};
    idx.forEach(i => { const kk = dayKey(all[i].d); (byDay[kk] = byDay[kk] || []).push(st.e[i]); });
    const dKeys = Object.keys(byDay).sort();
    const dMean = dKeys.map(kk => { const a = byDay[kk].filter(x => x !== Infinity); return a.length ? sec(avg(a)) : null; });
    const dBest = dKeys.map(kk => { const a = byDay[kk].filter(x => x !== Infinity); return a.length ? sec(Math.min(...a)) : null; });
    makeChart('chartDaily', {
      type: 'line',
      data: {
        labels: dKeys.map(kk => kk.slice(8) + '/' + kk.slice(5, 7)),
        datasets: [
          ds('média do dia', dMean, '#4f8cff', { pointRadius: 3 }),
          ds('melhor do dia', dBest, '#2fd17a', { pointRadius: 2, borderDash: [4, 4], borderWidth: 1.5 }),
          { type: 'bar', label: 'resoluções', data: dKeys.map(kk => byDay[kk].length), backgroundColor: 'rgba(138,146,166,.18)', borderWidth: 0, yAxisID: 'y2', order: 10 }
        ]
      },
      options: {
        animation: false, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } }, tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y2' ? `resoluções: ${c.parsed.y}` : tipLabel(c) } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } }, y: { ticks: yTicks }, y2: { position: 'right', grid: { display: false }, beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    // Distribuição
    const recent = okE.slice(-Math.min(okE.length, 200));
    $('#distLabel').textContent = `· últimas ${recent.length}`;
    if (recent.length) {
      const lo = Math.min(...recent), hi = Math.max(...recent);
      const steps = [500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];
      const w = steps.find(s => (hi - lo) / s <= 16) || 120000;
      const start = Math.floor(lo / w) * w, nb = Math.floor((hi - start) / w) + 1;
      const bins = new Array(nb).fill(0);
      recent.forEach(x => bins[Math.floor((x - start) / w)]++);
      makeChart('chartDist', {
        type: 'bar',
        data: { labels: bins.map((_, j) => fmt(start + j * w).replace(/\.00$/, '')), datasets: [{ label: 'resoluções', data: bins, backgroundColor: '#4f8cff', borderRadius: 4 }] },
        options: { animation: false, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => `${it[0].label} – ${fmt(start + (it[0].dataIndex + 1) * w).replace(/\.00$/, '')}` } } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  }
  function makeChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
  }
  function renderPBs(all, st) {
    const rows = [['single', 'Single'], ['mo3', 'mo3'], ['ao5', 'ao5'], ['ao12', 'ao12'], ['ao50', 'ao50'], ['ao100', 'ao100']];
    $('#pbList').innerHTML = rows.map(([k, lbl]) => {
      const arr = k === 'single' ? st.e : st[k].roll;
      // histórico de melhorias
      let bestV = null, count = 0, prevBest = null;
      arr.forEach(v => { if (v != null && v !== Infinity && (bestV == null || v < bestV)) { prevBest = bestV; bestV = v; count++; } });
      const b = k === 'single' ? st.single.best : st[k].best;
      if (b.i < 0) return `<div class="pb-row"><span class="k">${lbl}</span><span class="t muted">-</span><span></span></div>`;
      const imp = prevBest != null ? `<span class="imp">−${fmt(prevBest - bestV, true)}</span>` : '';
      const click = k === 'single' ? `data-solve="${b.i}"` : `data-avg="${k}" data-i="${b.i}"`;
      return `<div class="pb-row" style="cursor:pointer" ${click}><span class="k">${lbl}</span><span><span class="t">${fmt(b.v, k !== 'single')}</span> ${imp}</span><span class="d">${fmtDate(all[b.i].d)}<br>${count} recorde${count === 1 ? '' : 's'} batido${count === 1 ? '' : 's'}</span></div>`;
    }).join('');
  }
  $('#pbList').addEventListener('click', sideClick);

  function renderAlgProgress() {
    $('#algProgress').innerHTML = ALGS.SETS.map(set => {
      const c = countSet(set);
      const N = set.cases.length;
      return `<div class="alg-prog"><div class="top"><span>${set.name}</span><span class="muted">${c.learned}/${N} aprendidos · ${c.learning} em progresso</span></div>
        <div class="bar"><div class="l1" style="width:${c.learned / N * 100}%"></div><div class="l2" style="width:${c.learning / N * 100}%"></div></div></div>`;
    }).join('');
  }

  // ================= Aprender =================
  const getStatus = id => (DB.algs[id] && DB.algs[id].s) || (ALGS.DEFAULT_LEARNED.includes(id) ? 'learned' : 'todo');
  const myAlg = id => (DB.algs[id] && DB.algs[id].alg) || ALGS.CASES[id].alg;
  function setAlgData(id, patch, noSave) {
    const u = Date.now();
    DB.algs[id] = Object.assign({}, DB.algs[id], patch, { u });
    DB.algDirty[id] = u;
    if (!noSave) save();
  }
  function countSet(set) { const c = { todo: 0, learning: 0, learned: 0 }; set.cases.forEach(id => c[getStatus(id)]++); return c; }
  const svgCache = {};
  function caseSvg(id, arrows) {
    const k = id + (arrows ? ':a' : '');
    if (!svgCache[k]) { const c = ALGS.CASES[id]; svgCache[k] = Cube.caseSVG(Cube.caseState(c.alg), c.mode, { arrows }); }
    return svgCache[k];
  }
  const curSet = () => ALGS.SETS.find(s => s.id === S().learnSet) || ALGS.SETS[0];

  function renderLearn() {
    const set = curSet();
    $('#setTabs').innerHTML = ALGS.SETS.map(s => { const c = countSet(s); return `<button data-set="${s.id}" class="${s.id === set.id ? 'on' : ''}">${s.name}<span class="count">${c.learned}/${s.cases.length}</span></button>`; }).join('');
    $('#setDesc').textContent = set.desc;
    const groups = [...new Set(set.cases.map(id => ALGS.CASES[id].group))];
    if (!groups.includes(S().group)) S().group = '';
    $('#groupFilter').innerHTML = '<option value="">Todos os grupos</option>' + groups.map(g => `<option ${g === S().group ? 'selected' : ''}>${esc(g)}</option>`).join('');
    const c = countSet(set), N = set.cases.length;
    $('#setProgress').innerHTML = `<div class="bar"><div class="l1" style="width:${c.learned / N * 100}%"></div><div class="l2" style="width:${c.learning / N * 100}%"></div></div>
      <span class="stat"><b>${c.learned}</b> aprendidos</span><span class="stat"><b>${c.learning}</b> em progresso</span><span class="stat"><b>${c.todo}</b> por aprender</span>`;
    const ids = set.cases.filter(id => !S().group || ALGS.CASES[id].group === S().group);
    $('#board').innerHTML = STATUSES.map((stt, si) => {
      const mine = ids.filter(id => getStatus(id) === stt.id);
      return `<div class="col" data-status="${stt.id}"><div class="col-head"><span class="dot"></span>${stt.name}<span class="n">${mine.length}</span></div>
        <div class="cards">${mine.map(id => card(id, si)).join('') || '<div class="none">Arrasta casos para aqui</div>'}</div></div>`;
    }).join('');
  }
  function card(id, si) {
    const c = ALGS.CASES[id], custom = DB.algs[id] && DB.algs[id].alg;
    return `<div class="alg-card" draggable="true" data-id="${id}">
      ${caseSvg(id, true)}
      <div class="nm"><span>${esc(c.name)}</span></div>
      <div class="gp">${esc(c.group)}${custom ? ' · <span class="custom-tag">meu alg.</span>' : ''}</div>
      <div class="alg">${esc(myAlg(id))}</div>
      <div class="mv">${si > 0 ? `<button data-move="-1" title="Mover para ${STATUSES[si - 1].name}">←</button>` : ''}${si < 2 ? `<button data-move="1" title="Mover para ${STATUSES[si + 1].name}">→</button>` : ''}</div>
    </div>`;
  }
  $('#setTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; S().learnSet = b.dataset.set; S().group = ''; save(); renderLearn(); };
  $('#groupFilter').onchange = e => { S().group = e.target.value; save(); renderLearn(); };
  const board = $('#board');
  board.addEventListener('click', e => {
    const cd = e.target.closest('.alg-card'); if (!cd) return;
    const id = cd.dataset.id, mv = e.target.closest('[data-move]');
    if (mv) {
      const si = STATUSES.findIndex(s => s.id === getStatus(id));
      setAlgData(id, { s: STATUSES[si + (+mv.dataset.move)].id });
      renderLearn(); return;
    }
    caseModal(id);
  });
  let dragId = null;
  board.addEventListener('dragstart', e => { const cd = e.target.closest('.alg-card'); if (!cd) return; dragId = cd.dataset.id; cd.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); });
  board.addEventListener('dragend', e => { const cd = e.target.closest('.alg-card'); if (cd) cd.classList.remove('dragging'); board.querySelectorAll('.col').forEach(c => c.classList.remove('drop')); });
  board.addEventListener('dragover', e => { const col = e.target.closest('.col'); if (!col || !dragId) return; e.preventDefault(); board.querySelectorAll('.col').forEach(c => c.classList.toggle('drop', c === col)); });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.col'); if (!col || !dragId) return;
    e.preventDefault();
    if (getStatus(dragId) !== col.dataset.status) { setAlgData(dragId, { s: col.dataset.status }); }
    dragId = null; renderLearn();
  });

  function caseModal(id) {
    const c = ALGS.CASES[id];
    const options = [c.alg, ...c.alts];
    const custom = DB.algs[id] && DB.algs[id].alg;
    const isCustom = custom && !options.includes(custom);
    const m = openModal(head(esc(c.name), esc(c.group) + ' · ' + ({ pll: 'PLL', oll: 'OLL', eo: 'OLL 2-look (arestas)' })[c.mode]) + `
      <div class="case-detail">
        <div>${caseSvg(id, true)}</div>
        <div>
          <label class="lbl">Estado</label>
          <div class="status-pick" id="cStatus">${STATUSES.map(s => `<button data-s="${s.id}" class="${getStatus(id) === s.id ? 'on' : ''}"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}</div>
          <div class="row"><label class="lbl">Algoritmo que uso</label>
            <div id="cOpts">${options.map((a, i) => `<div class="alg-opt ${myAlg(id) === a ? 'sel' : ''}" data-a="${esc(a)}">${esc(a)}<span class="tag">${i === 0 ? 'principal' : 'alternativa'}</span></div>`).join('')}</div>
            <input type="text" id="cCustom" class="mono" placeholder="Ou escreve o teu próprio algoritmo…" value="${isCustom ? esc(custom) : ''}">
            <div class="valid" id="cValid"></div>
          </div>
        </div>
      </div>
      <div class="row"><label class="lbl">Notas</label><textarea id="cNote" placeholder="Dicas de reconhecimento, finger tricks…">${esc((DB.algs[id] || {}).note)}</textarea></div>
      <div class="row muted small">Para montar o caso num cubo resolvido (amarelo em cima, verde à frente): <span class="mono">${esc(Cube.invert(c.alg))}</span></div>
      <div class="actions"><button class="btn-primary" data-close>Fechar</button></div>`, 'wide');
    m.querySelector('#cStatus').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      setAlgData(id, { s: b.dataset.s });
      m.querySelectorAll('#cStatus button').forEach(x => x.classList.toggle('on', x === b));
    };
    const cs = Cube.caseState(c.alg);
    const sel = a => m.querySelectorAll('.alg-opt').forEach(x => x.classList.toggle('sel', x.dataset.a === a));
    m.querySelector('#cOpts').onclick = e => {
      const o = e.target.closest('.alg-opt'); if (!o) return;
      setAlgData(id, { alg: o.dataset.a === c.alg ? undefined : o.dataset.a });
      sel(o.dataset.a); m.querySelector('#cCustom').value = ''; m.querySelector('#cValid').textContent = '';
    };
    const inp = m.querySelector('#cCustom'), val = m.querySelector('#cValid');
    const check = () => {
      const a = inp.value.trim();
      if (!a) { val.textContent = ''; return; }
      if (!Cube.validAlg(a)) { val.className = 'valid err'; val.textContent = 'Notação não reconhecida (usa R U F L D B, r u f…, M E S, x y z, \' e 2)'; return; }
      if (Cube.solvesCase(cs, a, c.mode)) {
        val.className = 'valid ok'; val.textContent = '✓ Resolve este caso — guardado como o teu algoritmo';
        setAlgData(id, { alg: Cube.tokenize(a).join(' ') }); sel(null);
      } else { val.className = 'valid err'; val.textContent = '✗ Este algoritmo não resolve este caso (verifica a notação)'; }
    };
    inp.oninput = check; if (isCustom) check();
    m.querySelector('#cNote').oninput = e => setAlgData(id, { note: e.target.value || undefined });
    m.onclose = () => renderPage();
  }

  // ---- Treino de reconhecimento ----
  $('#trainBtn').onclick = e => { e.currentTarget.blur(); trainer(); };
  function trainer() {
    const set = curSet();
    const pick = new Set(S().trainStatuses || ['learning', 'learned']);
    let cur = null, revealed = false, score = { ok: 0, n: 0 };
    const m = openModal(head('Treino de reconhecimento', set.name + (S().group ? ' · ' + esc(S().group) : '')) + `
      <div class="trainer">
        <div class="opts">${STATUSES.map(s => `<label><input type="checkbox" value="${s.id}" ${pick.has(s.id) ? 'checked' : ''}> ${s.name}</label>`).join('')}</div>
        <div id="trCase"></div>
        <div class="setup" id="trSetup"></div>
        <div class="answer" id="trAns"></div>
        <div class="actions" style="justify-content:center" id="trBtns"></div>
        <div class="score" id="trScore"></div>
      </div>`, 'wide');
    const pool = () => set.cases.filter(id => pick.has(getStatus(id)) && (!S().group || ALGS.CASES[id].group === S().group));
    function next() {
      const p = pool();
      revealed = false;
      if (!p.length) { m.querySelector('#trCase').innerHTML = '<div class="empty">Não há casos com estes estados. Marca outro estado acima.</div>'; m.querySelector('#trBtns').innerHTML = ''; m.querySelector('#trAns').innerHTML = ''; m.querySelector('#trSetup').textContent = ''; return; }
      let id; do { id = p[Math.floor(Math.random() * p.length)]; } while (p.length > 1 && cur && id === cur.id);
      const auf = ['', 'U', 'U2', "U'"][Math.floor(Math.random() * 4)];
      const c = ALGS.CASES[id];
      cur = { id, auf, state: Cube.caseState(c.alg, auf) };
      m.querySelector('#trCase').innerHTML = Cube.caseSVG(cur.state, c.mode, { arrows: false });
      m.querySelector('#trSetup').textContent = 'Montar: ' + (Cube.invert(c.alg) + ' ' + auf).trim();
      m.querySelector('#trAns').innerHTML = '<div class="muted" style="padding-top:30px">Que caso é este?</div>';
      m.querySelector('#trBtns').innerHTML = '<button class="btn-primary" id="trShow">Mostrar resposta <kbd>espaço</kbd></button>';
      m.querySelector('#trShow').onclick = reveal;
    }
    function reveal() {
      if (!cur || revealed) return;
      revealed = true;
      const c = ALGS.CASES[cur.id];
      m.querySelector('#trCase').innerHTML = Cube.caseSVG(cur.state, c.mode, { arrows: true });
      m.querySelector('#trAns').innerHTML = `<div class="nm">${esc(c.name)}</div><div class="muted small">${esc(c.group)}</div><div class="alg">${cur.auf ? `<span class="muted">(${Cube.invert(cur.auf)})</span> ` : ''}${esc(myAlg(cur.id))}</div>`;
      m.querySelector('#trBtns').innerHTML = '<button class="btn" id="trNo">Errei</button><button class="btn-primary" id="trYes">Acertei</button>';
      const done = ok => { score.n++; if (ok) score.ok++; m.querySelector('#trScore').textContent = `${score.ok}/${score.n} certos nesta sessão`; next(); };
      m.querySelector('#trYes').onclick = () => done(true);
      m.querySelector('#trNo').onclick = () => done(false);
    }
    m.querySelector('.opts').onchange = () => {
      pick.clear(); m.querySelectorAll('.opts input:checked').forEach(i => pick.add(i.value));
      S().trainStatuses = [...pick]; save(); cur = null; next();
    };
    const onKey = e => {
      if (e.code !== 'Space' || isTyping(e)) return;
      e.preventDefault();
      if (!revealed) reveal(); else { const y = m.querySelector('#trYes'); if (y) y.click(); }
    };
    document.addEventListener('keydown', onKey);
    m.onclose = () => document.removeEventListener('keydown', onKey);
    next();
  }

  // ================= Ponte para a sincronização (sync.js) =================
  function refreshAfterRemote() {
    if (T.phase !== 'idle' || T.inInsp) return; // não mexer no ecrã a meio de uma resolução
    if (currentPage === 'timer' && !diffEl.textContent) resetDisplay();
    renderPage();
  }
  window.CuboLab = {
    openModal, closeModal, toast, esc, head,
    // O que falta enviar
    pending() {
      const items = [], byPid = {};
      const find = (pid, id) => {
        if (!byPid[pid]) { byPid[pid] = new Map(); solves(pid).forEach(s => byPid[pid].set(sid(pid, s), s)); }
        return byPid[pid].get(id);
      };
      Object.entries(DB.dirty).forEach(([id, m]) => {
        const s = find(m.pid, id);
        if (!s) { delete DB.dirty[id]; return; }
        items.push({ id, pid: m.pid, t: s.t, p: s.p || 0, s: s.s || '', d: s.d, c: s.c, u: s.u, del: false });
      });
      Object.entries(DB.tomb).forEach(([id, m]) => items.push({ id, pid: m.pid, del: true, u: m.u }));
      const algs = {};
      Object.keys(DB.algDirty).forEach(id => { if (DB.algs[id]) algs[id] = Object.assign({}, DB.algs[id]); });
      return { solves: items, algs };
    },
    // Confirmação do servidor: só limpa se não houve alterações entretanto
    ack(items, algs) {
      (items || []).forEach(it => {
        const box = it.del ? DB.tomb : DB.dirty;
        if (box[it.id] && box[it.id].u === it.u) delete box[it.id];
      });
      Object.keys(algs || {}).forEach(id => { if (DB.algDirty[id] === algs[id].u) delete DB.algDirty[id]; });
      persist();
    },
    applyRemote(docs) {
      let changed = false;
      const idx = {}, resort = new Set();
      const map = pid => {
        if (!idx[pid]) { idx[pid] = new Map(); solves(pid).forEach(s => idx[pid].set(sid(pid, s), s)); }
        return idx[pid];
      };
      docs.forEach(r => {
        if (!r.pid || !r.id) return;
        const m = map(r.pid), loc = m.get(r.id);
        if (r.del) {
          if (loc && (loc.u || 0) <= r.u) { const l = solves(r.pid); l.splice(l.indexOf(loc), 1); m.delete(r.id); delete DB.dirty[r.id]; changed = true; }
          return;
        }
        const tb = DB.tomb[r.id];
        if (tb && tb.u >= r.u) return;
        if (loc) {
          if ((r.u || 0) > (loc.u || 0)) {
            Object.assign(loc, { t: r.t, p: r.p || 0, s: r.s || '', d: r.d, u: r.u });
            if (r.c) loc.c = r.c; else delete loc.c;
            delete DB.dirty[r.id]; changed = true;
          }
          return;
        }
        const s = { id: r.id, t: r.t, p: r.p || 0, s: r.s || '', d: r.d, u: r.u };
        if (r.c) s.c = r.c;
        solves(r.pid).push(s); m.set(r.id, s); resort.add(r.pid); changed = true;
      });
      resort.forEach(pid => solves(pid).sort((a, b) => a.d - b.d));
      if (changed) { persist(); refreshAfterRemote(); }
      return changed;
    },
    applyRemoteAlgs(remote) {
      let changed = false;
      Object.entries(remote || {}).forEach(([id, r]) => {
        const l = DB.algs[id];
        if (!l || (r.u || 0) > (l.u || 0)) { DB.algs[id] = r; delete DB.algDirty[id]; changed = true; }
      });
      if (changed) { persist(); if (!modalOpen()) refreshAfterRemote(); }
    },
    // Primeira ligação de uma conta neste dispositivo: enviar tudo o que já existe
    markAllDirty() {
      Object.keys(DB.solves).forEach(pid => DB.solves[pid].forEach(s => {
        sid(pid, s); if (!s.u) s.u = s.d || Date.now();
        DB.dirty[s.id] = { pid, u: s.u };
      }));
      Object.keys(DB.algs).forEach(id => { const a = DB.algs[id]; if (!a.u) a.u = 1; DB.algDirty[id] = a.u; });
      persist();
    }
  };

  // ================= Arranque =================
  setHint();
  newScramble();
  resetDisplay();
  route();
})();
