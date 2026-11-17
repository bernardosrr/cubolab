/* Sincronização com a nuvem: login com Google (Firebase Auth) + Firestore.
 * Os dados continuam guardados localmente; isto só envia/recebe alterações.
 * Firestore: users/{uid}/solves/{id}  e  users/{uid}/meta/algs
 */
const CONFIG = window.FIREBASE_CONFIG;
const L = window.CuboLab;
const btn = document.getElementById('accountBtn');
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

if (CONFIG && L && btn) start();

async function start() {
  let A, Au, F;
  try {
    [A, Au, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  } catch (e) { console.warn('Firebase indisponível', e); return; }

  const app = A.initializeApp(CONFIG);
  const auth = Au.getAuth(app);
  const db = F.initializeFirestore(app, { ignoreUndefinedProperties: true });

  let user = null, unsubs = [], pushing = false, again = false, debounce = null;
  let state = 'out', errMsg = '', lastSync = null, meta = {}, metaKey = '';
  btn.classList.remove('hidden');

  // ---------- UI ----------
  const G = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>';
  const LABEL = { ok: 'Sincronizado', syncing: 'A sincronizar…', error: 'Erro na sincronização', offline: 'Sem internet — envia quando voltar' };
  function render() {
    if (!user) { btn.className = 'account-btn'; btn.innerHTML = G + '<span>Entrar</span>'; btn.title = 'Entrar com Google para sincronizar os tempos'; return; }
    const s = !navigator.onLine ? 'offline' : state;
    const initial = (user.displayName || user.email || '?').trim()[0].toUpperCase();
    const av = user.photoURL ? `<img src="${L.esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="initial">${L.esc(initial)}</span>`;
    btn.className = 'account-btn in';
    btn.innerHTML = `${av}<i class="sync-dot ${s}"></i>`;
    btn.title = LABEL[s] + (s === 'error' && errMsg ? ': ' + errMsg : '');
  }
  function setState(s, msg) { state = s; errMsg = msg || ''; if (s === 'ok') lastSync = Date.now(); render(); }

  btn.addEventListener('click', () => {
    btn.blur();
    if (!user) { login(); return; }
    const s = !navigator.onLine ? 'offline' : state;
    const when = lastSync ? new Date(lastSync).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—';
    const m = L.openModal(L.head('Conta', L.esc(user.displayName || '') + ' · ' + L.esc(user.email || '')) + `
      <div class="setting"><div>Estado<div class="desc">${LABEL[s]}${s === 'error' && errMsg ? ' — ' + L.esc(errMsg) : ''}</div></div><i class="sync-dot big ${s}"></i></div>
      <div class="setting"><div>Última sincronização</div><div class="muted">${when}</div></div>
      <p class="muted small">Os tempos, penalizações, comentários e o estado dos algoritmos sincronizam entre todos os dispositivos onde entrares com esta conta. As definições (inspeção, cubo escolhido…) ficam por dispositivo.</p>
      <div class="actions"><button class="btn-danger" id="aOut">Sair</button><button class="btn" id="aNow">Sincronizar agora</button><button class="btn-primary" data-close>Fechar</button></div>`);
    m.querySelector('#aNow').onclick = () => { L.closeModal(m); resubscribe(); push(); };
    m.querySelector('#aOut').onclick = () => {
      if (confirm('Sair da conta? Os tempos continuam neste dispositivo e na nuvem.')) { Au.signOut(auth); L.closeModal(m); }
    };
  });

  async function login() {
    try { await Au.signInWithPopup(auth, new Au.GoogleAuthProvider()); }
    catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      L.toast(e.code === 'auth/unauthorized-domain' ? 'Este domínio não está autorizado no Firebase (Authentication → Settings → Authorized domains)' : 'Não foi possível entrar: ' + (e.code || e.message));
    }
  }

  // ---------- Sincronização ----------
  function saveMeta() { try { localStorage.setItem(metaKey, JSON.stringify(meta)); } catch (e) { /* ignore */ } }

  function subscribe() {
    const col = F.collection(db, 'users', user.uid, 'solves');
    const q = F.query(col, F.where('su', '>', F.Timestamp.fromMillis(meta.lastSu || 0)));
    unsubs.push(F.onSnapshot(q, { includeMetadataChanges: true }, snap => {
      const docs = [];
      let maxSu = meta.lastSu || 0;
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) return;
        const d = ch.doc.data();
        docs.push(Object.assign({}, d, { id: ch.doc.id }));
        if (d.su) maxSu = Math.max(maxSu, d.su.toMillis());
      });
      if (docs.length) L.applyRemote(docs);
      if (maxSu > (meta.lastSu || 0)) { meta.lastSu = maxSu; saveMeta(); }
      if (!snap.metadata.fromCache && !pushing) setState('ok');
    }, e => setState('error', e.code === 'permission-denied' ? 'sem permissão (verifica as regras do Firestore)' : e.message)));

    const algRef = F.doc(db, 'users', user.uid, 'meta', 'algs');
    unsubs.push(F.onSnapshot(algRef, s => {
      if (s.metadata.hasPendingWrites) return;
      const d = s.data();
      if (d && d.data) L.applyRemoteAlgs(d.data);
    }, () => { /* erro já reportado acima */ }));
  }
  function unsubscribe() { unsubs.forEach(f => f()); unsubs = []; }
  function resubscribe() { if (!user) return; unsubscribe(); subscribe(); }

  async function push() {
    if (!user) return;
    if (pushing) { again = true; return; }
    const { solves, algs } = L.pending();
    const algIds = Object.keys(algs);
    if (!solves.length && !algIds.length) return;
    pushing = true; setState('syncing');
    const uid = user.uid;
    try {
      const col = F.collection(db, 'users', uid, 'solves');
      for (let i = 0; i < solves.length; i += 400) {
        const chunk = solves.slice(i, i + 400);
        const b = F.writeBatch(db);
        chunk.forEach(it => {
          const data = Object.assign({}, it, { su: F.serverTimestamp() });
          delete data.id;
          b.set(F.doc(col, it.id), data);
        });
        await b.commit();
        if (!user || user.uid !== uid) throw new Error('conta mudou');
        L.ack(chunk, null);
      }
      if (algIds.length) {
        const ref = F.doc(db, 'users', uid, 'meta', 'algs');
        const data = {};
        algIds.forEach(id => { data[id] = algs[id]; });
        // mergeFields substitui cada caso por inteiro (para apagar campos removidos)
        await F.setDoc(ref, { data, su: F.serverTimestamp() }, { mergeFields: algIds.map(id => new F.FieldPath('data', id)).concat(['su']) });
        L.ack(null, algs);
      }
      setState('ok');
    } catch (e) {
      console.warn('sync', e);
      setState('error', e.code === 'permission-denied' ? 'sem permissão (verifica as regras do Firestore)' : (e.code || e.message));
    }
    pushing = false;
    if (again) { again = false; push(); }
  }

  window.addEventListener('cubolab:change', () => { clearTimeout(debounce); debounce = setTimeout(push, 1500); });
  window.addEventListener('online', () => { render(); push(); });
  window.addEventListener('offline', render);

  Au.onAuthStateChanged(auth, u => {
    unsubscribe();
    user = u;
    if (!u) { setState('out'); return; }
    metaKey = 'cubolab:sync:' + u.uid;
    try { meta = JSON.parse(localStorage.getItem(metaKey)) || {}; } catch (e) { meta = {}; }
    if (!meta.init) {
      L.markAllDirty(); meta.init = 1; saveMeta();
      L.toast('Sessão iniciada — a enviar os teus tempos para a nuvem');
    }
    setState('syncing');
    subscribe();
    push();
  });
  render();
}
