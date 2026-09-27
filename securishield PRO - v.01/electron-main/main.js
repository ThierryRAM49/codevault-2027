const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const sqlite3 = require('sqlite3').verbose();
const { dialog } = require('electron');
const { generateProject } = require('./generator/project-structure');
const { exec } = require('child_process');

ipcMain.handle('generate-project', async (event, config) => {
  const { title, techStack, snippets } = config;

  const { filePath } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!filePath) return null;

  try {
    const projectPath = generateProject(filePath, title, techStack, snippets);
    return projectPath; // Retourne le chemin au frontend
  } catch (err) {
    console.error("Erreur génération projet:", err);
    return null;
  }
});

ipcMain.handle('run-project', async (event, projectPath) => {
  return new Promise((resolve) => {
    const child = exec('npm start', { cwd: projectPath });

    child.stdout.on('data', (data) => {
      console.log(`[Projet] ${data}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[Erreur] ${data}`);
    });

    child.on('close', (code) => {
      resolve(code === 0 ? 'success' : 'failed');
    });
  });
});

// Store pour config (chiffré plus tard)
const store = new Store();

// DB SQLite
let db = new sqlite3.Database('./src/data/snippets.db');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  win.loadFile('src/index.html');
  win.webContents.openDevTools();
});

// Exemple d'IPC pour lire les snippets
ipcMain.handle('get-snippets', () => {
  return new Promise((resolve) => {
    db.all(`SELECT * FROM snippets LIMIT 10`, [], (err, rows) => {
      resolve(rows || []);
    });
  });
});
