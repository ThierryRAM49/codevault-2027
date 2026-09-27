// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // DB Operations
  getSnippets: () => ipcRenderer.invoke('db-get-snippets'),
  searchSnippets: (query) => ipcRenderer.invoke('db-search-snippets', query),
  updatePositions: (items) => ipcRenderer.invoke('db-update-positions', items),
  addSnippet: (snippet) => ipcRenderer.invoke('db-add-snippet', snippet),
  updateSnippet: (snippet) => ipcRenderer.invoke('db-update-snippet', snippet),
  deleteSnippet: (id) => ipcRenderer.invoke('db-delete-snippet', id),
  importSnippetsToDb: (snippets) => ipcRenderer.invoke('db-import-snippets', snippets),

  // Window Management
  openSnippetWindow: (id) => ipcRenderer.invoke('open-snippet-window', id),

  // External Links (navigateur par défaut)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // File Operations
  saveSnippets: (snippets) => ipcRenderer.invoke('save-snippets', snippets),
  openSnippets: () => ipcRenderer.invoke('open-snippets'),
  exportSnippet: (filename, content) => ipcRenderer.invoke('export-snippet', { filename, content }),

  // Auth
  login: (token) => ipcRenderer.invoke('auth-login', token),
  generateToken: (role) => ipcRenderer.invoke('auth-generate-token', role),
  getTokens: () => ipcRenderer.invoke('auth-get-tokens'),
  revokeToken: (id) => ipcRenderer.invoke('auth-revoke-token', id),
  openAdminPanel: () => ipcRenderer.invoke('open-admin-panel'),
});
