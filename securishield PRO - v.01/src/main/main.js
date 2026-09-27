const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let authServer;

function startAuthServer() {
  authServer = fork(path.join(__dirname, '..', '..', 'server.js'));
  authServer.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`Serveur d'auth arrêté (code ${code})`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,    // sécurité contexto
      nodeIntegration: false,
    }
  });

  if (app.isPackaged) {
    // En prod, charge le build Vite (dist/index.html)
    win.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  } else {
    // En dev, charge le serveur React
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  startAuthServer();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (authServer) authServer.kill();
  if (process.platform !== 'darwin') app.quit();
});
