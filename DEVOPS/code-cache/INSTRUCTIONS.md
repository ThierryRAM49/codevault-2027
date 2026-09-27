# Instructions pour l'intégration de CodeStash dans Pro-CodeVaultAI (Electron)

Suite à votre précision que `Pro-CodeVaultAI_2027` est une application Electron, j'ai modifié l'application `CodeStash` pour qu'elle puisse s'intégrer correctement en tant que partie de votre application Electron.

L'approche précédente (avec un proxy) était pour une architecture client-serveur web, ce qui aurait causé des bugs avec Electron. La nouvelle approche utilise les mécanismes de communication natifs d'Electron (IPC et Preload Scripts) pour une intégration robuste et sécurisée.

---

## Vue d'ensemble de l'architecture

1.  **`Pro-CodeVaultAI_2027` (Processus Principal Electron)**: C'est votre application principale. Elle gère la fenêtre de l'application, l'authentification et les logiques "backend".

2.  **`CodeStash` (Processus de Rendu Electron)**: C'est l'interface utilisateur React que nous avons développée. Elle sera chargée à l'intérieur de la fenêtre de `Pro-CodeVaultAI_2027`.

3.  **Preload Script (Bridge)**: Un script spécial qui expose de manière sécurisée des fonctions de votre processus principal (comme `signIn`) au processus de rendu (`CodeStash`).

---

## Étape 1 : Lancer le serveur de développement de `CodeStash`

Le frontend `CodeStash` doit être servi par son serveur de développement Vite pour bénéficier du rechargement à chaud (hot-reloading).

1.  Ouvrez un terminal et placez-vous dans le répertoire `code-cache` :
    ```bash
    cd code-cache
    ```
2.  Installez les dépendances et démarrez le serveur :
    ```bash
    pnpm install
    pnpm run dev
    ```
    Le serveur démarrera sur `http://localhost:5173`. **Laissez ce terminal ouvert.**

---

## Étape 2 : Configurer votre application Electron `Pro-CodeVaultAI_2027`

Maintenant, vous devez modifier votre application Electron pour charger `CodeStash` et mettre en place le pont de communication.

### 1. Charger `CodeStash` dans votre `BrowserWindow`

Dans le fichier principal de votre application Electron (là où vous créez une `BrowserWindow`), chargez l'URL du serveur de développement de `CodeStash`.

```javascript
// Dans votre fichier main.js ou index.js d'Electron
const { BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // IMPORTANT: Le preload script est essentiel pour la communication
      preload: path.join(__dirname, 'preload.js') 
    }
  });

  // Charger l'application React (CodeStash)
  win.loadURL('http://localhost:5173');

  // Optionnel: ouvrir les DevTools
  win.webContents.openDevTools();
}
```

### 2. Créer le `preload.js` (le pont de communication)

Créez un fichier nommé `preload.js` au même niveau que votre fichier principal Electron. Ce fichier exposera les fonctions d'authentification à `CodeStash`.

**Contenu de `preload.js` :**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  signUp: (params) => ipcRenderer.invoke('auth:signup', params),
  signIn: (params) => ipcRenderer.invoke('auth:signin', params),
  signOut: () => ipcRenderer.invoke('auth:signout'),
  onAuthStateChange: (callback) => {
    const channel = 'auth-state-change';
    // Le renderer écoute sur ce canal
    const subscription = (event, session) => callback(session);
    ipcRenderer.on(channel, subscription);
    
    // Retourne une fonction pour se désabonner
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});
```

### 3. Implémenter les gestionnaires d'authentification dans votre processus principal

Finalement, dans votre fichier principal Electron, vous devez écouter les appels venant de `CodeStash` et les traiter. C'est ici que vous intégrerez votre propre logique d'authentification.

**Ajoutez ce code à votre fichier main.js/index.js d'Electron :**
```javascript
const { ipcMain } = require('electron');

// Remplacez ceci par votre vraie logique d'authentification
const myAuthService = {
  async signUp({ email, password }) {
    // ... votre logique d'inscription ...
    // En cas de succès, vous voudrez peut-être envoyer un email de vérification.
    console.log(`Signing up with ${email}`);
    // Simule un succès. En réalité, vous devriez retourner l'utilisateur ou une erreur.
    return { user: null, error: null }; 
  },
  async signIn({ email, password }) {
    // ... votre logique de connexion ...
    console.log(`Signing in with ${email}`);
    if (email === 'admin@test.com' && password === 'admin123') {
      const user = { id: '1', email: 'admin@test.com' };
      // IMPORTANT : Informer la fenêtre du succès de la connexion
      BrowserWindow.getAllWindows()[0].webContents.send('auth-state-change', { user });
      return { user, error: null };
    }
    return { user: null, error: { message: 'Invalid credentials' } };
  },
  async signOut() {
    // ... votre logique de déconnexion ...
    console.log('Signing out');
    // IMPORTANT : Informer la fenêtre de la déconnexion
    BrowserWindow.getAllWindows()[0].webContents.send('auth-state-change', null);
  }
};

// Gestionnaires IPC
ipcMain.handle('auth:signup', async (event, params) => {
  return await myAuthService.signUp(params);
});

ipcMain.handle('auth:signin', async (event, params) => {
  return await myAuthService.signIn(params);
});

ipcMain.handle('auth:signout', async () => {
  await myAuthService.signOut();
});

// À la fin de votre flux de connexion (dans myAuthService.signIn), vous devez envoyer
// l'état de la session au renderer comme ceci :
// win.webContents.send('auth-state-change', { user: ... });
```

Avec ces modifications, `CodeStash` s'exécutera à l'intérieur de `Pro-CodeVaultAI_2027` et utilisera le système d'authentification de l'application Electron, ce qui garantit une intégration sans bugs et sécurisée.
