// web-api.js — browser-native replacement for the Electron IPC bridge (preload.js).
// Snippets and access tokens are stored in this browser's IndexedDB only:
// nothing is sent to or stored on the server. Each visitor gets their own vault.
(function () {
  const DB_NAME = 'codevault';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('snippets')) {
          db.createObjectStore('snippets', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('tokens')) {
          db.createObjectStore('tokens', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function store(name, mode) {
    const db = await openDb();
    return db.transaction(name, mode).objectStore(name);
  }

  // === Snippets ===

  async function getSnippets() {
    const s = await store('snippets', 'readonly');
    const all = await requestToPromise(s.getAll());
    return all.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || new Date(b.updated_at) - new Date(a.updated_at));
  }

  async function searchSnippets(query) {
    const all = await getSnippets();
    const q = query.toLowerCase();
    return all.filter((s) =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q) ||
      (s.theme || '').toLowerCase().includes(q) ||
      (s.tags || '').toString().toLowerCase().includes(q),
    );
  }

  async function updatePositions(items) {
    const s = await store('snippets', 'readwrite');
    await Promise.all(
      items.map(
        (item, index) =>
          new Promise((resolve) => {
            const getReq = s.get(item.id);
            getReq.onsuccess = () => {
              const rec = getReq.result;
              if (rec) {
                rec.position = index;
                s.put(rec).onsuccess = () => resolve();
              } else {
                resolve();
              }
            };
            getReq.onerror = () => resolve();
          }),
      ),
    );
    return true;
  }

  async function addSnippet(snippet) {
    const s = await store('snippets', 'readwrite');
    const now = new Date().toISOString();
    const record = {
      title: snippet.title,
      lang: snippet.lang,
      theme: snippet.theme || '',
      code: snippet.code,
      tags: JSON.stringify(snippet.tags || []),
      position: 0,
      created_at: now,
      updated_at: now,
    };
    const id = await requestToPromise(s.add(record));
    return { id, ...snippet };
  }

  async function updateSnippet(snippet) {
    const s = await store('snippets', 'readwrite');
    const existing = await requestToPromise(s.get(snippet.id));
    const record = {
      ...existing,
      title: snippet.title,
      lang: snippet.lang,
      theme: snippet.theme || existing?.theme || '',
      code: snippet.code,
      tags: JSON.stringify(snippet.tags || []),
      updated_at: new Date().toISOString(),
    };
    await requestToPromise(s.put(record));
    return snippet;
  }

  async function deleteSnippet(id) {
    const s = await store('snippets', 'readwrite');
    await requestToPromise(s.delete(id));
    return id;
  }

  async function importSnippetsToDb(snippets) {
    const s = await store('snippets', 'readwrite');
    const now = new Date().toISOString();
    await Promise.all(
      snippets.map(
        (item) =>
          new Promise((resolve) => {
            s.add({
              title: item.title,
              lang: item.lang,
              theme: item.theme || '',
              code: item.code,
              tags: JSON.stringify(item.tags || []),
              position: 0,
              created_at: now,
              updated_at: now,
            }).onsuccess = () => resolve();
          }),
      ),
    );
    return true;
  }

  // === Window management: browser tabs instead of native windows ===
  // Same origin, same IndexedDB, so the detached tab sees the same vault.

  async function openSnippetWindow(id) {
    window.open(`${window.location.pathname}?mode=detached&id=${id}`, '_blank');
    return true;
  }

  // === File I/O: browser download instead of native save/open dialogs ===

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function saveSnippets(snippets) {
    const filename = `codevault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(filename, JSON.stringify(snippets || [], null, 2));
    return filename;
  }

  async function openSnippets() {
    // Not wired to any UI action in main.js (it uses a plain <input type=file> instead) —
    // kept only so window.electronAPI has the same shape as the Electron preload bridge.
    return null;
  }

  async function exportSnippet(filename, content) {
    downloadFile(filename, content);
    return filename;
  }

  // === Auth: tokens stored locally, per-browser ===

  function randomHex(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function showInitialTokenBanner(token) {
    const banner = document.createElement('div');
    banner.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:monospace;padding:16px;';
    banner.innerHTML = `
      <div style="max-width:520px;background:#0a0a15;border:1px solid #06b6d4;border-radius:16px;padding:32px;text-align:center;color:#e2e8f0;">
        <div style="font-size:40px;margin-bottom:12px;">🔐</div>
        <h2 style="color:#22d3ee;font-size:20px;font-weight:800;margin-bottom:12px;">Votre token d'accès</h2>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Ce vault est propre à ce navigateur : rien n'est envoyé au serveur. Notez ce token précieusement, il ne sera plus jamais affiché — sans lui vous perdrez l'accès à vos snippets.</p>
        <code id="cvai-initial-token" style="display:block;font-size:22px;color:#67e8f9;background:#000;padding:12px;border-radius:8px;margin-bottom:16px;user-select:all;">${token}</code>
        <button id="cvai-initial-token-copy" style="background:linear-gradient(90deg,#0891b2,#2563eb);color:#fff;border:none;padding:10px 24px;border-radius:8px;font-weight:700;cursor:pointer;">Copier et continuer</button>
      </div>
    `;
    document.body.appendChild(banner);
    banner.querySelector('#cvai-initial-token-copy').onclick = () => {
      navigator.clipboard.writeText(token).catch(() => {});
      document.body.removeChild(banner);
    };
  }

  async function ensureInitialToken() {
    const s = await store('tokens', 'readonly');
    const count = await requestToPromise(s.count());
    if (count > 0) return;

    const token = `admin_${randomHex(4)}`;
    const writeStore = await store('tokens', 'readwrite');
    await requestToPromise(
      writeStore.add({ token, role: 'admin', is_active: 1, created_at: new Date().toISOString() }),
    );
    showInitialTokenBanner(token);
  }

  async function login(token) {
    const s = await store('tokens', 'readonly');
    const all = await requestToPromise(s.getAll());
    const match = all.find((t) => t.token === token && t.is_active);
    return match ? { success: true, role: match.role } : { success: false };
  }

  async function generateToken(role) {
    const prefix = role === 'admin' ? 'admin_' : 'user_';
    const token = `${prefix}${randomHex(16)}`;
    const s = await store('tokens', 'readwrite');
    await requestToPromise(s.add({ token, role, is_active: 1, created_at: new Date().toISOString() }));
    return token;
  }

  async function getTokens() {
    const s = await store('tokens', 'readonly');
    const all = await requestToPromise(s.getAll());
    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async function revokeToken(id) {
    const s = await store('tokens', 'readwrite');
    const rec = await requestToPromise(s.get(id));
    if (rec) {
      rec.is_active = 0;
      await requestToPromise(s.put(rec));
    }
    return true;
  }

  async function openAdminPanel() {
    window.open('admin_panel.html', '_blank');
    return true;
  }

  window.electronAPI = {
    getSnippets,
    searchSnippets,
    updatePositions,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    importSnippetsToDb,
    openSnippetWindow,
    saveSnippets,
    openSnippets,
    exportSnippet,
    login,
    generateToken,
    getTokens,
    revokeToken,
    openAdminPanel,
  };

  // The server now resolves and injects the visitor's role via
  // window.CODEVAULT_ROLE (see CodevaultController::app()) whenever this app
  // is reached through the email access gate — the only way to reach it now.
  // The per-browser auto-admin-token bootstrap below predates that and would
  // otherwise pop up an "your access token" modal handing out an admin_...
  // token to every visitor, including plain 'user' ones.
  if (!window.CODEVAULT_ROLE) {
    ensureInitialToken();
  }
})();
