import React, { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import Terminal from "./components/Terminal";
import Button from "./components/Button";
import ProgressBar from "./components/ProgressBar";
import Reports from "./components/Reports";
import WifiScan from "./components/WifiScan";
import IpCameras from "./components/IpCameras";

const API_BASE = "http://localhost:4000";

const GLOBAL_ACTIONS = [
  { action: "scan", label: "Lancer l'Analyse", animate: true },
  { action: "system-check", label: "Vérifier" },
  { action: "treat-threats", label: "Traiter les Menaces" },
  { action: "backup", label: "Sauvegarder", animate: true },
  { action: "clean", label: "Nettoyer" },
  { action: "isolate", label: "Isoler" },
  { action: "analyze-files", label: "Analyser" },
];

function LoginForm({ onLogin, error, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 320, margin: "80px auto", color: "#e2e8f0" }}>
      <h2>SécuriShield — Connexion</h2>
      <div style={{ marginBottom: 12 }}>
        <label>Identifiant</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 4 }}
          autoFocus
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginTop: 4 }}
        />
      </div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

function App() {
  const [accessToken, setAccessToken] = useState(null);
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [loginError, setLoginError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [runningAction, setRunningAction] = useState(null);
  const [view, setView] = useState("dashboard");
  const seenLogCount = useRef(0);
  const accessTokenRef = useRef(null);

  const isVisitor = role === "visitor";

  const addLog = (message) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // Échange le refresh token (cookie httpOnly) contre un nouveau jeton d'accès,
  // avant son expiration (15 min) ou après un 401/403 inattendu.
  const doRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/refresh_token`, { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      setAccessToken(data.accessToken);
      accessTokenRef.current = data.accessToken;
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  // fetch authentifié : rejoue automatiquement la requête une fois après un
  // rafraîchissement de session si le jeton d'accès a expiré entre-temps.
  const authFetch = useCallback(
    async (url, options = {}) => {
      const withAuth = (token) => ({
        ...options,
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
      });
      let res = await fetch(url, withAuth(accessTokenRef.current));
      if (res.status === 401 || res.status === 403) {
        const newToken = await doRefresh();
        if (!newToken) {
          addLog("Session expirée — reconnexion nécessaire.");
          setAccessToken(null);
          setRole(null);
          setUsername(null);
          throw new Error("Session expirée");
        }
        res = await fetch(url, withAuth(newToken));
      }
      return res;
    },
    [doRefresh]
  );

  // Rafraîchit le jeton d'accès avant son expiration (toutes les 12 min, marge sur les 15 min)
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(doRefresh, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, doRefresh]);

  // Reporte automatiquement le journal serveur (partagé entre admin et visiteur) dans le terminal
  useEffect(() => {
    if (!status || !status.log) return;
    const newEntries = status.log.slice(seenLogCount.current);
    if (newEntries.length) {
      setLogs((prev) => [
        ...prev,
        ...newEntries.map((e) => `[${new Date(e.time).toLocaleTimeString()}] ${e.message}`),
      ]);
      seenLogCount.current = status.log.length;
    }
  }, [status]);

  // Connexion automatique si l'URL contient ?token=... (lien magique)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const magicToken = params.get("token");
    if (!magicToken) return;

    setMagicLoading(true);
    fetch(`${API_BASE}/magic-login?token=${encodeURIComponent(magicToken)}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Lien invalide");
        setAccessToken(data.accessToken);
        setRole(data.role);
        setUsername(data.username);
        addLog(`Connecté automatiquement via lien (${data.username}, rôle: ${data.role})`);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch((err) => setLoginError(err.message))
      .finally(() => setMagicLoading(false));
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await authFetch(`${API_BASE}/api/status`);
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      // échec silencieux d'un poll périodique (ou session expirée, déjà journalisée)
    }
  }, [accessToken, authFetch]);

  useEffect(() => {
    if (!accessToken) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [accessToken, fetchStatus]);

  const handleLogin = async (u, p) => {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Échec de connexion");
      setAccessToken(data.accessToken);
      setRole(data.role);
      setUsername(data.username);
      addLog(`Connecté en tant que ${data.username} (rôle: ${data.role})`);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
    setAccessToken(null);
    setRole(null);
    setUsername(null);
    setStatus(null);
    seenLogCount.current = 0;
  };

  const callAction = async (action, label, { animate = false } = {}) => {
    if (isVisitor) {
      addLog(`${label} → refusé (rôle visiteur, lecture seule)`);
      return;
    }
    let timer;
    if (animate) {
      setRunningAction({ label, progress: 0 });
      timer = setInterval(() => {
        setRunningAction((prev) => (prev ? { ...prev, progress: Math.min(prev.progress + 8, 90) } : prev));
      }, 120);
    }
    try {
      const res = await authFetch(`${API_BASE}/api/actions/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action refusée");
      if (animate) setRunningAction({ label, progress: 100 });
      setStatus(data.state);
    } catch (err) {
      addLog(`${label} → erreur : ${err.message}`);
    } finally {
      if (animate) {
        clearInterval(timer);
        setTimeout(() => setRunningAction(null), 500);
      }
    }
  };

  const handleThreatAction = async (id, action, label) => {
    if (isVisitor) {
      addLog(`${label} → refusé (rôle visiteur, lecture seule)`);
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/api/threats/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action refusée");
      setStatus(data.state);
    } catch (err) {
      addLog(`${label} → erreur : ${err.message}`);
    }
  };

  const handleWifiAction = async (id, action, label) => {
    if (isVisitor) {
      addLog(`${label} → refusé (rôle visiteur, lecture seule)`);
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/api/wifi/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action refusée");
      setStatus(data.state);
    } catch (err) {
      addLog(`${label} → erreur : ${err.message}`);
    }
  };

  const handleCameraAction = async (id, action, label) => {
    if (isVisitor) {
      addLog(`${label} → refusé (rôle visiteur, lecture seule)`);
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/api/cameras/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Action refusée");
      setStatus(data.state);
    } catch (err) {
      addLog(`${label} → erreur : ${err.message}`);
    }
  };

  const handleCommand = (cmd) => {
    const word = cmd.toLowerCase().split(/\s+/)[0];
    switch (word) {
      case "help":
        addLog("Commandes disponibles : scan, wifi, cameras, status, backup, clean, isolate, help, exit");
        break;
      case "status":
        addLog(
          `Statut : ${status?.systemStatus === "green" ? "Opérationnel" : "Alerte"} — ${status?.activeThreats ?? 0} menace(s) active(s)`
        );
        break;
      case "scan":
        callAction("scan", "Lancer l'Analyse", { animate: true });
        break;
      case "wifi":
        callAction("wifi-scan", "Scanner le Wi-Fi", { animate: true });
        break;
      case "cameras":
        callAction("camera-audit", "Auditer les Caméras", { animate: true });
        break;
      case "backup":
        callAction("backup", "Sauvegarder", { animate: true });
        break;
      case "clean":
        callAction("clean", "Nettoyer");
        break;
      case "isolate":
        callAction("isolate", "Isoler");
        break;
      case "exit":
        setLogs([]);
        break;
      default:
        addLog(`Commande inconnue : "${cmd}". Tapez "help" pour la liste des commandes.`);
    }
  };

  if (!accessToken) {
    return (
      <div style={{ background: "#0f172a", minHeight: "100vh" }}>
        {magicLoading ? (
          <p style={{ color: "#e2e8f0", textAlign: "center", marginTop: 80 }}>Connexion automatique…</p>
        ) : (
          <LoginForm onLogin={handleLogin} error={loginError} loading={loading} />
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: 20, color: "#e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1>SécuriShield — Dashboard</h1>
        <div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 12,
              fontSize: 12,
              marginRight: 12,
              background: isVisitor ? "#334155" : "#1d4ed8",
            }}
          >
            {username} · {isVisitor ? "Visiteur (lecture seule)" : "Admin"}
          </span>
          <button onClick={handleLogout} style={{ padding: "6px 12px" }}>
            Déconnexion
          </button>
        </div>
      </div>

      {isVisitor && (
        <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
          Accès visiteur : vous pouvez consulter le statut du système et le journal en temps réel, les actions
          d'intervention sont désactivées.
        </p>
      )}

      <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid #1f2937" }}>
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "wifi", label: "Wi-Fi" },
          { id: "cameras", label: "Caméras" },
          { id: "reports", label: "Rapports" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "none",
              borderBottom: view === tab.id ? "2px solid #2563eb" : "2px solid transparent",
              color: view === tab.id ? "#e2e8f0" : "#94a3b8",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "dashboard" && (
        <>
          <div style={{ marginTop: 16 }}>
            <Dashboard status={status} isVisitor={isVisitor} onThreatAction={handleThreatAction} />
          </div>

          {!isVisitor && (
            <div style={{ marginTop: 24 }}>
              <h3>Actions d'intervention</h3>
              {GLOBAL_ACTIONS.map(({ action, label, animate }) => (
                <Button key={action} label={label} onClick={() => callAction(action, label, { animate })} />
              ))}
              {runningAction && <ProgressBar label={runningAction.label} progress={runningAction.progress} />}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <h3>Terminal d'intervention</h3>
            <Terminal logs={logs} isVisitor={isVisitor} onCommand={handleCommand} />
          </div>
        </>
      )}

      {view === "wifi" && (
        <div style={{ marginTop: 16 }}>
          <h3>Scan Réseau / Wi-Fi</h3>
          <WifiScan
            status={status}
            isVisitor={isVisitor}
            scanning={!!runningAction && runningAction.label === "Scanner le Wi-Fi"}
            onScan={() => callAction("wifi-scan", "Scanner le Wi-Fi", { animate: true })}
            onNetworkAction={handleWifiAction}
          />
          {runningAction && runningAction.label === "Scanner le Wi-Fi" && (
            <ProgressBar label={runningAction.label} progress={runningAction.progress} />
          )}
        </div>
      )}

      {view === "cameras" && (
        <div style={{ marginTop: 16 }}>
          <h3>Audit Caméras IP</h3>
          <IpCameras
            status={status}
            isVisitor={isVisitor}
            auditing={!!runningAction && runningAction.label === "Auditer les Caméras"}
            onAudit={() => callAction("camera-audit", "Auditer les Caméras", { animate: true })}
            onCameraAction={handleCameraAction}
          />
          {runningAction && runningAction.label === "Auditer les Caméras" && (
            <ProgressBar label={runningAction.label} progress={runningAction.progress} />
          )}
        </div>
      )}

      {view === "reports" && (
        <div style={{ marginTop: 16 }}>
          <h3>Rapports</h3>
          <Reports authFetch={authFetch} isVisitor={isVisitor} />
        </div>
      )}
    </div>
  );
}

export default App;
