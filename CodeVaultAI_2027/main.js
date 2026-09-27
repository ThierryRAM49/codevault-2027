// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

 
  // === GESTIONNAIRES IPC POUR IMPORT/EXPORT ===

  // Exporter les snippets dans un fichier JSON
  ipcMain.handle('save-snippets', async (event, snippets) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter les snippets',
        defaultPath: 'codevault-snippets.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2), 'utf-8');
        return filePath;
      }
      return null;
    } catch (err) {
      console.error("Erreur d'export :", err);
      return null;
    }
  });

   // === Ouvrir un fichier de snippets ===
  ipcMain.handle('open-snippets', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Importer des snippets',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      });

      if (filePaths && filePaths.length > 0) {
        const content = fs.readFileSync(filePaths[0], 'utf-8');
        return JSON.parse(content);
      }
      return null;
    } catch (err) {
      console.error("Erreur lecture :", err);
      return null;
    }
  });

  // === Sauvegarder dans un dossier personnalisé ===
  ipcMain.handle('save-snippets-to-folder', async (event, snippets) => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Choisissez un dossier pour sauvegarder',
        properties: ['openDirectory']
      });

      if (!filePaths || filePaths.length === 0) return null;

      const folderPath = filePaths[0];
      const filePath = path.join(folderPath, 'codevault-snippets.json');
      fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2), 'utf-8');
      return filePath;
    } catch (err) {
      console.error("Erreur dossier :", err);
      return null;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
