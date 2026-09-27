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

  // Auth par token : gérée exclusivement par l'application Electron (IPC).
  // En navigateur, le rôle est fourni par le serveur via window.CODEVAULT_ROLE
  // (gate email) — aucun token n'est généré ni stocké côté client.
  async function login() {
    return { success: false };
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
  };

  // Les tokens d'accès sont générés uniquement par l'application Electron (IPC).
  // En navigateur, le rôle vient du serveur via window.CODEVAULT_ROLE (gate email).
})();
