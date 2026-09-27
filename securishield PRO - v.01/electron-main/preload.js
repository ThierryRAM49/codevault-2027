const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSnippets: () => ipcRenderer.invoke('get-snippets')
});
