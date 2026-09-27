// server.js - Serveur Express : auth JWT (rôles admin/visitor) + état du dashboard SécuriShield

const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "ACCESS_SECRET";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "REFRESH_SECRET";
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || "MAGIC_LINK_SECRET";

// Refresh tokens persistés sur disque : une session survit à un redémarrage
// du serveur, pas seulement au rafraîchissement automatique du jeton d'accès.
const AUTH_DIR = path.join(__dirname, "data");
const REFRESH_TOKENS_FILE = path.join(AUTH_DIR, "refresh-tokens.json");

let refreshTokens = [];
try {
  refreshTokens = JSON.parse(fs.readFileSync(REFRESH_TOKENS_FILE, "utf8"));
} catch {
  refreshTokens = [];
}
// Purge les jetons expirés ou invalides chargés depuis le disque
refreshTokens = refreshTokens.filter((t) => {
  try {
    jwt.verify(t, REFRESH_TOKEN_SECRET);
    return true;
  } catch {
    return false;
  }
});

function saveRefreshTokens() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(REFRESH_TOKENS_FILE, JSON.stringify(refreshTokens));
}

// Comptes seedés depuis .env (mots de passe hashés au démarrage, jamais stockés en clair en mémoire)
const users = [
  {
    id: 1,
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin", 10),
    role: "admin",
  },
  {
    id: 2,
    username: process.env.VISITOR_USERNAME || "visitor",
    passwordHash: bcrypt.hashSync(process.env.VISITOR_PASSWORD || "visitor", 10),
    role: "visitor",
  },
];

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
}

function generateRefreshToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
}

function issueSession(user, res) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.push(refreshToken);
  saveRefreshTokens();

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false, // true en prod HTTPS
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ accessToken, role: user.role, username: user.username });
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ message: "Identifiants invalides" });
  }
  issueSession(user, res);
});

// Connexion automatique via lien magique (token signé, pas de mot de passe dans l'URL)
app.get("/magic-login", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Lien invalide" });

  jwt.verify(token, MAGIC_LINK_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: "Lien expiré ou invalide" });
    const user = users.find((u) => u.id === payload.id && u.username === payload.username);
    if (!user) return res.status(403).json({ message: "Compte introuvable" });
    issueSession(user, res);
  });
});

app.post("/refresh_token", (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Pas de refresh token" });
  if (!refreshTokens.includes(token)) return res.status(403).json({ message: "Refresh token invalide" });

  jwt.verify(token, REFRESH_TOKEN_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: "Refresh token expiré" });
    const newAccessToken = generateAccessToken(payload);
    res.json({ accessToken: newAccessToken, role: payload.role, username: payload.username });
  });
});

app.post("/logout", (req, res) => {
  const token = req.cookies.refreshToken;
  refreshTokens = refreshTokens.filter((t) => t !== token);
  saveRefreshTokens();
  res.clearCookie("refreshToken");
  res.json({ message: "Déconnexion réussie" });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) return res.sendStatus(403);
    req.user = payload;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Accès refusé pour ce rôle" });
    }
    next();
  };
}

app.get("/me", authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// ---------------------------------------------------------------------------
// État du dashboard SécuriShield (partagé, en mémoire, visible par tous les rôles)
// ---------------------------------------------------------------------------

const state = {
  threats: [
    { id: "backdoor", name: "Backdoor", status: "active" },
    { id: "rootkit", name: "Rootkit", status: "active" },
    { id: "sqli", name: "SQL Injection", status: "active" },
  ],
  compromisedFiles: 12,
  isolatedFiles: 0,
  backupSizeGB: 0,
  lastScan: null,
  lastBackup: null,
  suspiciousConnections: [4, 7, 3, 9, 5],
  log: [],
  wifiNetworks: [
    { id: "guest-mall", ssid: "Centre_Commercial_Guest", bssid: "A4:5E:60:11:22:33", signal: -55, security: "WPA2", rogue: false, status: "active", location: "Hall Central", source: "simulated" },
    { id: "food-court", ssid: "FoodCourt_WiFi", bssid: "C8:3A:35:44:55:66", signal: -62, security: "WPA2", rogue: false, status: "active", location: "Food Court", source: "simulated" },
    { id: "parking", ssid: "Parking_Securise", bssid: "F0:1D:2D:77:88:99", signal: -70, security: "WPA3", rogue: false, status: "active", location: "Parking", source: "simulated" },
  ],
  lastWifiScan: null,
  ipCameras: [
    {
      id: "cam-entree",
      label: "Caméra Entrée Principale",
      location: "Entrée Principale",
      ip: "192.168.10.21",
      ports: [{ port: 80, service: "HTTP" }, { port: 554, service: "RTSP" }],
      defaultCreds: false,
      firmwareOutdated: false,
      status: "secured",
      source: "simulated",
    },
    {
      id: "cam-parking",
      label: "Caméra Parking Sous-sol",
      location: "Parking Sous-sol",
      ip: "192.168.10.34",
      ports: [{ port: 23, service: "Telnet" }, { port: 80, service: "HTTP" }, { port: 554, service: "RTSP" }],
      defaultCreds: true,
      firmwareOutdated: true,
      status: "active",
      source: "simulated",
    },
    {
      id: "cam-reserve",
      label: "Caméra Réserve",
      location: "Réserve / Arrière-boutique",
      ip: "192.168.10.58",
      ports: [{ port: 554, service: "RTSP" }, { port: 8080, service: "HTTP-Alt" }],
      defaultCreds: false,
      firmwareOutdated: true,
      status: "active",
      source: "simulated",
    },
  ],
  lastCameraAudit: null,
};

// ---------------------------------------------------------------------------
// Rapports persistés sur disque : consultables à tout moment, survivent aux
// redémarrages du serveur (contrairement à `state`, qui vit en mémoire).
// ---------------------------------------------------------------------------

const REPORTS_DIR = path.join(__dirname, "data");
const REPORTS_FILE = path.join(REPORTS_DIR, "reports.json");
const MAX_REPORTS = 500;

let reports = [];
try {
  reports = JSON.parse(fs.readFileSync(REPORTS_FILE, "utf8"));
} catch {
  reports = [];
}

function saveReports() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2));
}

function pushLog(message, actor) {
  const entry = {
    time: new Date().toISOString(),
    message,
    username: actor?.username || "système",
    role: actor?.role || null,
  };
  state.log.push(entry);
  if (state.log.length > 50) state.log.shift();

  reports.push(entry);
  if (reports.length > MAX_REPORTS) reports.shift();
  saveReports();
}

function computeStatus() {
  const activeThreats = state.threats.filter((t) => t.status === "active").length;
  return { systemStatus: activeThreats > 0 ? "red" : "green", activeThreats, affectedSystems: activeThreats };
}

function publicState() {
  return { ...computeStatus(), ...state };
}

app.get("/api/status", authenticateToken, (req, res) => {
  res.json(publicState());
});

// Rapports persistés (table consultable dans l'onglet "Rapports" du dashboard)
app.get("/api/reports", authenticateToken, (req, res) => {
  res.json({ reports: [...reports].reverse() });
});

// Effacer l'historique des rapports : réservé au rôle admin. L'action elle-même
// reste tracée (un rapport vide n'a pas de sens pour un journal d'audit).
app.delete("/api/reports", authenticateToken, requireRole("admin"), (req, res) => {
  const cleared = reports.length;
  reports = [];
  state.log = [];
  saveReports();
  pushLog(`Rapports effacés (${cleared} entrée(s) supprimée(s))`, req.user);
  res.json({ reports: [...reports].reverse() });
});

// Menaces additionnelles pouvant être découvertes par un scan (au-delà des 3
// menaces initiales) — rend "Lancer l'Analyse" réellement utile dans le temps.
const THREAT_POOL = [
  { id: "ransomware", name: "Ransomware" },
  { id: "phishing", name: "Phishing interne" },
  { id: "dns-exfil", name: "Exfiltration DNS" },
  { id: "trojan", name: "Cheval de Troie" },
  { id: "ddos", name: "Attaque DDoS" },
  { id: "priv-esc", name: "Élévation de privilèges" },
];
const SCAN_DISCOVERY_CHANCE = 0.35;

// Points d'accès additionnels pouvant être découverts par un scan Wi-Fi
const WIFI_POOL = [
  { id: "evil-twin", ssid: "Free_WiFi_Mall", bssid: "DE:AD:BE:EF:00:01", security: "Ouvert", rogue: true, location: "Hall Central" },
  { id: "iot-cam", ssid: "CCTV_Cam_Default", bssid: "00:1A:79:AC:12:9F", security: "WEP", rogue: true, location: "Local Technique" },
  { id: "rogue-admin", ssid: "Admin_Router_Backdoor", bssid: "8C:DE:52:3F:6B:11", security: "Ouvert", rogue: true, location: "Bureau Administration" },
  { id: "boutique-5g", ssid: "Boutique_Zara_5G", bssid: "B0:BE:76:2C:9D:44", security: "WPA2", rogue: false, location: "Boutique Zara" },
];
const WIFI_DISCOVERY_CHANCE = 0.4;

// Caméras IP additionnelles pouvant être découvertes par un audit
const CAMERA_POOL = [
  {
    id: "cam-guichet",
    label: "Caméra Guichet Info",
    location: "Guichet Information",
    ip: "192.168.10.77",
    ports: [{ port: 23, service: "Telnet" }, { port: 554, service: "RTSP" }],
    defaultCreds: true,
    firmwareOutdated: false,
  },
  {
    id: "cam-livraison",
    label: "Caméra Zone Livraison",
    location: "Zone de Livraison",
    ip: "192.168.10.92",
    ports: [{ port: 80, service: "HTTP" }, { port: 554, service: "RTSP" }, { port: 37777, service: "DVR propriétaire" }],
    defaultCreds: false,
    firmwareOutdated: true,
  },
  {
    id: "cam-toit",
    label: "Caméra Toiture",
    location: "Toiture / Local Technique",
    ip: "192.168.10.15",
    ports: [{ port: 554, service: "RTSP" }],
    defaultCreds: false,
    firmwareOutdated: false,
  },
];
const CAMERA_DISCOVERY_CHANCE = 0.4;

function isCameraVulnerable(cam) {
  return cam.defaultCreds || cam.firmwareOutdated || cam.ports.some((p) => p.service === "Telnet");
}

// Actions globales d'intervention : réservées au rôle admin
const actionHandlers = {
  scan: (actor) => {
    state.lastScan = new Date().toISOString();
    state.suspiciousConnections.push(Math.floor(Math.random() * 10));
    if (state.suspiciousConnections.length > 12) state.suspiciousConnections.shift();

    let discovered = null;
    const available = THREAT_POOL.filter((p) => !state.threats.some((t) => t.id === p.id));
    if (available.length > 0 && Math.random() < SCAN_DISCOVERY_CHANCE) {
      discovered = available[Math.floor(Math.random() * available.length)];
      state.threats.push({ id: discovered.id, name: discovered.name, status: "active" });
    }

    const active = state.threats.filter((t) => t.status === "active").length;
    const note = discovered ? ` Nouvelle menace détectée : ${discovered.name}.` : "";
    pushLog(`Analyse complète terminée — ${active} menace(s) active(s) détectée(s).${note}`, actor);
    return {
      report: `Scan terminé : ${state.threats.length} menace(s) répertoriée(s), ${active} active(s).${note}`,
    };
  },
  "system-check": (actor) => {
    pushLog("Vérification système : Backup Opérationnel, Pare-feu Opérationnel, Base de données Opérationnelle", actor);
    return { report: "Intégrité système vérifiée : tous les sous-systèmes sont opérationnels." };
  },
  "treat-threats": (actor) => {
    state.threats.forEach((t) => (t.status = "neutralized"));
    pushLog("Toutes les menaces actives ont été neutralisées", actor);
    return { report: "Toutes les menaces actives ont été neutralisées." };
  },
  backup: (actor) => {
    state.backupSizeGB = 4.8;
    state.lastBackup = new Date().toISOString();
    pushLog(`Sauvegarde chiffrée effectuée (${state.backupSizeGB} GB)`, actor);
    return { report: `Sauvegarde terminée : ${state.backupSizeGB} GB transférés.` };
  },
  clean: (actor) => {
    const removed = state.compromisedFiles;
    state.compromisedFiles = 0;
    pushLog(`${removed} fichier(s) compromis supprimé(s)`, actor);
    return { report: `Nettoyage terminé : ${removed} fichier(s) compromis supprimé(s).` };
  },
  isolate: (actor) => {
    state.isolatedFiles += state.compromisedFiles || 0;
    const moved = state.isolatedFiles;
    pushLog(`Fichiers déplacés en quarantaine (${moved} au total)`, actor);
    return { report: `${moved} fichier(s) en quarantaine.` };
  },
  "analyze-files": (actor) => {
    const report = state.threats.map((t) => `- ${t.name} : ${t.status}`).join("\n");
    pushLog("Rapport d'analyse des fichiers généré", actor);
    return { report: `Rapport détaillé :\n${report}` };
  },
  "wifi-scan": (actor) => {
    state.lastWifiScan = new Date().toISOString();
    // Le signal des réseaux déjà connus fluctue légèrement à chaque scan
    state.wifiNetworks.forEach((n) => {
      n.signal = Math.max(-90, Math.min(-30, n.signal + (Math.floor(Math.random() * 11) - 5)));
    });

    let discovered = null;
    const available = WIFI_POOL.filter((p) => !state.wifiNetworks.some((n) => n.id === p.id));
    if (available.length > 0 && Math.random() < WIFI_DISCOVERY_CHANCE) {
      discovered = available[Math.floor(Math.random() * available.length)];
      state.wifiNetworks.push({
        id: discovered.id,
        ssid: discovered.ssid,
        bssid: discovered.bssid,
        signal: -40 - Math.floor(Math.random() * 40),
        security: discovered.security,
        rogue: discovered.rogue,
        status: "active",
        location: discovered.location,
        source: "simulated",
      });
    }

    const rogueActive = state.wifiNetworks.filter((n) => n.rogue && n.status === "active").length;
    const note = discovered
      ? discovered.rogue
        ? ` Alerte : point d'accès suspect détecté — ${discovered.ssid}.`
        : ` Nouveau réseau détecté : ${discovered.ssid}.`
      : "";
    pushLog(
      `Scan Wi-Fi terminé — ${state.wifiNetworks.length} réseau(x) visible(s), ${rogueActive} suspect(s).${note}`,
      actor
    );
    return {
      report: `Scan Wi-Fi terminé : ${state.wifiNetworks.length} réseau(x), ${rogueActive} suspect(s).${note}`,
    };
  },
  "camera-audit": (actor) => {
    state.lastCameraAudit = new Date().toISOString();

    let discovered = null;
    const available = CAMERA_POOL.filter((p) => !state.ipCameras.some((c) => c.id === p.id));
    if (available.length > 0 && Math.random() < CAMERA_DISCOVERY_CHANCE) {
      discovered = available[Math.floor(Math.random() * available.length)];
      state.ipCameras.push({
        id: discovered.id,
        label: discovered.label,
        location: discovered.location,
        ip: discovered.ip,
        ports: discovered.ports,
        defaultCreds: discovered.defaultCreds,
        firmwareOutdated: discovered.firmwareOutdated,
        status: "active",
        source: "simulated",
      });
    }

    const vulnerable = state.ipCameras.filter((c) => c.status !== "secured" && isCameraVulnerable(c)).length;
    const note = discovered
      ? isCameraVulnerable(discovered)
        ? ` Alerte : caméra vulnérable détectée — ${discovered.label}.`
        : ` Nouvelle caméra détectée : ${discovered.label}.`
      : "";
    pushLog(
      `Audit caméras IP terminé — ${state.ipCameras.length} caméra(s) recensée(s), ${vulnerable} vulnérable(s).${note}`,
      actor
    );
    return {
      report: `Audit terminé : ${state.ipCameras.length} caméra(s), ${vulnerable} vulnérable(s).${note}`,
    };
  },
};

app.post("/api/actions/:action", authenticateToken, requireRole("admin"), (req, res) => {
  const handler = actionHandlers[req.params.action];
  if (!handler) return res.status(404).json({ message: "Action inconnue" });
  const result = handler(req.user);
  res.json({ action: req.params.action, ...result, state: publicState() });
});

// Actions par menace individuelle : réservées au rôle admin
const threatActionHandlers = {
  neutralize: (t) => {
    t.status = "neutralized";
    return `${t.name} neutralisé.`;
  },
  isolate: (t) => {
    t.status = "isolated";
    return `${t.name} isolé.`;
  },
  analyze: (t) => `Rapport ${t.name} : statut actuel "${t.status}".`,
};

app.post("/api/threats/:id/:action", authenticateToken, requireRole("admin"), (req, res) => {
  const threat = state.threats.find((t) => t.id === req.params.id);
  if (!threat) return res.status(404).json({ message: "Menace introuvable" });
  const handler = threatActionHandlers[req.params.action];
  if (!handler) return res.status(404).json({ message: "Action inconnue" });
  const report = handler(threat);
  pushLog(report, req.user);
  res.json({ threat, report, state: publicState() });
});

// Actions par point d'accès Wi-Fi individuel : réservées au rôle admin
const wifiActionHandlers = {
  neutralize: (n) => {
    n.status = "neutralized";
    return `Point d'accès "${n.ssid}" bloqué.`;
  },
};

app.post("/api/wifi/:id/:action", authenticateToken, requireRole("admin"), (req, res) => {
  const network = state.wifiNetworks.find((n) => n.id === req.params.id);
  if (!network) return res.status(404).json({ message: "Réseau introuvable" });
  const handler = wifiActionHandlers[req.params.action];
  if (!handler) return res.status(404).json({ message: "Action inconnue" });
  const report = handler(network);
  pushLog(report, req.user);
  res.json({ network, report, state: publicState() });
});

// Import d'un vrai scan Wi-Fi (ex: script scripts/wifi-real-scan.sh lancé sur une
// machine qui a une vraie carte Wi-Fi) — remplace/complète les réseaux "réels"
// existants, sans toucher aux réseaux simulés.
app.post("/api/wifi/import", authenticateToken, requireRole("admin"), (req, res) => {
  const { networks } = req.body;
  if (!Array.isArray(networks)) return res.status(400).json({ message: "Format invalide : 'networks' doit être un tableau" });

  let imported = 0;
  networks.forEach((n) => {
    if (!n || typeof n.ssid !== "string" || !n.ssid) return;
    const id = "real-" + (n.bssid || n.ssid).toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = state.wifiNetworks.find((w) => w.id === id);
    const signal = Number.isFinite(n.signal) ? n.signal : -70;
    if (existing) {
      existing.ssid = n.ssid;
      existing.bssid = n.bssid || existing.bssid;
      existing.signal = signal;
      existing.security = n.security || "Ouvert";
    } else {
      state.wifiNetworks.push({
        id,
        ssid: n.ssid,
        bssid: n.bssid || "—",
        signal,
        security: n.security || "Ouvert",
        rogue: false,
        status: "active",
        location: null,
        source: "real",
      });
    }
    imported++;
  });

  state.lastWifiScan = new Date().toISOString();
  pushLog(`${imported} réseau(x) Wi-Fi réel(s) importé(s) depuis un scan local`, req.user);
  res.json({ imported, state: publicState() });
});

// Actions par caméra IP individuelle : réservées au rôle admin
const cameraActionHandlers = {
  secure: (c) => {
    c.defaultCreds = false;
    c.firmwareOutdated = false;
    c.ports = c.ports.filter((p) => p.service !== "Telnet");
    c.status = "secured";
    return `Caméra "${c.label}" sécurisée (identifiants changés, firmware mis à jour, Telnet désactivé).`;
  },
};

app.post("/api/cameras/:id/:action", authenticateToken, requireRole("admin"), (req, res) => {
  const camera = state.ipCameras.find((c) => c.id === req.params.id);
  if (!camera) return res.status(404).json({ message: "Caméra introuvable" });
  const handler = cameraActionHandlers[req.params.action];
  if (!handler) return res.status(404).json({ message: "Action inconnue" });
  const report = handler(camera);
  pushLog(report, req.user);
  res.json({ camera, report, state: publicState() });
});

app.listen(PORT, () => {
  console.log(`Serveur SécuriShield lancé sur http://localhost:${PORT}`);
});
