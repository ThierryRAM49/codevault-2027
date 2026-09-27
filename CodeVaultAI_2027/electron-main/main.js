const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const sqlite3 = require('sqlite3').verbose();

// Store pour config
const store = new Store();

// Initialisation Base de Données
const dbPath = path.join(app.getPath('userData'), 'codevault.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur ouverture DB:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initDb();
  }
});

function initDb() {
  db.run(`CREATE TABLE IF NOT EXISTS snippets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    lang TEXT,
    theme TEXT,
    code TEXT,
    tags TEXT,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (!err) {
      // Migration : Ajouter la colonne 'position' si elle n'existe pas
      db.run("ALTER TABLE snippets ADD COLUMN position INTEGER DEFAULT 0", (e) => {
        // Ignorer l'erreur si la colonne existe déjà
      });
      // Migration : Ajouter la colonne 'tags' si elle n'existe pas
      db.run("ALTER TABLE snippets ADD COLUMN tags TEXT", (e) => {
        // Ignorer l'erreur si la colonne existe déjà
      });
    }
  });

  // Table Tokens
  db.run(`CREATE TABLE IF NOT EXISTS access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE,
    role TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (!err) {
      // Check if empty, create INIT token
      db.get("SELECT count(*) as count FROM access_tokens", [], (err, row) => {
        if (!err && row.count === 0) {
          const crypto = require('crypto');
          const random = crypto.randomBytes(4).toString('hex');
          const initToken = `admin_${random}`;
          db.run("INSERT INTO access_tokens (token, role) VALUES (?, ?)", [initToken, 'admin'], (e) => {
            if (!e) console.log("\n⚠️  INITIAL ADMIN TOKEN CREATED: " + initToken + " ⚠️\n");
          });
        }
      });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    backgroundColor: '#0f172a'
  });

  win.loadFile('index.html');

  // Ouvrir DevTools en développement
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  // === DB API ===

  // READ ALL
  ipcMain.handle('db-get-snippets', () => {
    return new Promise((resolve, reject) => {
      // Tri par position (asc) puis updated_at (desc)
      db.all("SELECT * FROM snippets ORDER BY position ASC, updated_at DESC", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });

  // SEARCH
  ipcMain.handle('db-search-snippets', (event, query) => {
    return new Promise((resolve, reject) => {
      const sql = `
  SELECT * FROM snippets 
        WHERE title LIKE ? OR code LIKE ? OR theme LIKE ? OR tags LIKE ?
    ORDER BY position ASC, updated_at DESC
      `;
      const searchParam = `% ${query}% `;
      db.all(sql, [searchParam, searchParam, searchParam, searchParam], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });

  // UPDATE POSITIONS (Batch)
  ipcMain.handle('db-update-positions', (event, items) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("UPDATE snippets SET position = ? WHERE id = ?");
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        items.forEach((item, index) => {
          stmt.run(index, item.id);
        });
        db.run("COMMIT", (err) => {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
          } else {
            resolve(true);
          }
        });
        stmt.finalize();
      });
    });
  });

  // CREATE
  ipcMain.handle('db-add-snippet', (event, snippet) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("INSERT INTO snippets (title, lang, theme, code, tags) VALUES (?, ?, ?, ?, ?)");
      const tagsStr = snippet.tags ? JSON.stringify(snippet.tags) : '[]';
      stmt.run(snippet.title, snippet.lang, snippet.theme, snippet.code, tagsStr, function (err) {
        if (err) reject(err);
        else {
          // Retourner l'objet complet avec l'ID généré
          resolve({ id: this.lastID, ...snippet });
        }
      });
      stmt.finalize();
    });
  });

  // UPDATE
  ipcMain.handle('db-update-snippet', (event, snippet) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("UPDATE snippets SET title = ?, lang = ?, theme = ?, code = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
      const tagsStr = snippet.tags ? JSON.stringify(snippet.tags) : '[]';
      stmt.run(snippet.title, snippet.lang, snippet.theme, snippet.code, tagsStr, snippet.id, function (err) {
        if (err) reject(err);
        else resolve(snippet);
      });
      stmt.finalize();
    });
  });

  // DELETE
  ipcMain.handle('db-delete-snippet', (event, id) => {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM snippets WHERE id = ?", id, function (err) {
        if (err) reject(err);
        else resolve(id);
      });
    });
  });

  // BATCH IMPORT (pour migration ou import de fichiers)
  ipcMain.handle('db-import-snippets', (event, snippets) => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("INSERT INTO snippets (title, lang, theme, code, tags) VALUES (?, ?, ?, ?, ?)");
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        snippets.forEach(s => {
          const tagsStr = s.tags ? JSON.stringify(s.tags) : '[]';
          stmt.run(s.title, s.lang, s.theme, s.code, tagsStr);
        });
        db.run("COMMIT", (err) => {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
          } else {
            resolve(true); // Succès
          }
        });
        stmt.finalize();
      });
    });
  });

  // OPEN NEW WINDOW
  ipcMain.handle('open-snippet-window', async (event, snippetId) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      },
      autoHideMenuBar: true,
      backgroundColor: '#050510'
    });

    // Charger la même page mais avec un paramètre
    await win.loadFile(path.join(__dirname, '..', 'index.html'), { query: { mode: 'detached', id: snippetId } });
    return true;
  });

  // === FILE API (Conserve import/export fichiers) ===

  // Exporter DB en JSON
  ipcMain.handle('save-snippets', async (event, snippets) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter les snippets (Backup)',
        defaultPath: `codevault - backup - ${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (filePath) {
        const dataToSave = snippets || []; // Fallback si null
        fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
        return filePath;
      }
      return null;
    } catch (err) {
      console.error("Erreur d'export :", err);
      return null;
    }
  });

  // Ouvrir JSON pour restauration
  ipcMain.handle('open-snippets', async () => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'Importer backup JSON',
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

  // Exporter UN seul snippet
  ipcMain.handle('export-snippet', async (event, { filename, content }) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'Exporter le snippet',
        defaultPath: filename,
        filters: [{ name: 'All Files', extensions: ['*'] }]
      });

      if (filePath) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
      }
      return null;
    } catch (err) {
      console.error("Erreur export snippet :", err);
      return null;
    }
  });

  // === AUTH API ===

  // LOGIN
  ipcMain.handle('auth-login', (event, token) => {
    return new Promise((resolve, reject) => {
      db.get("SELECT role FROM access_tokens WHERE token = ? AND is_active = 1", [token], (err, row) => {
        if (err) {
          console.error("Auth Error:", err);
          resolve({ success: false });
        } else if (row) {
          resolve({ success: true, role: row.role });
        } else {
          resolve({ success: false });
        }
      });
    });
  });

  // GENERATE TOKEN (Admin Only / Internal)
  ipcMain.handle('auth-generate-token', (event, role) => {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto');
      const prefix = role === 'admin' ? 'admin_' : 'user_';
      const random = crypto.randomBytes(16).toString('hex');
      const token = `${prefix}${random}`;

      db.run("INSERT INTO access_tokens (token, role) VALUES (?, ?)", [token, role], function (err) {
        if (err) reject(err);
        else resolve(token);
      });
    });
  });

  // LIST TOKENS (For Admin Panel)
  ipcMain.handle('auth-get-tokens', () => {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM access_tokens ORDER BY created_at DESC", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });

  // REVOKE TOKEN
  ipcMain.handle('auth-revoke-token', (event, id) => {
    return new Promise((resolve, reject) => {
      db.run("UPDATE access_tokens SET is_active = 0 WHERE id = ?", [id], (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  });

  // OPEN ADMIN PANEL
  ipcMain.handle('open-admin-panel', () => {
    const adminWin = new BrowserWindow({
      width: 1000,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    adminWin.loadFile('admin_panel.html');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  db.close();
  if (process.platform !== 'darwin') app.quit();
});
