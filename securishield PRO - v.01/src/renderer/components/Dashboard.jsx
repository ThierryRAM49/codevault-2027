import React from "react";
import ThreatList from "./ThreatList";

const cardStyle = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 8,
  padding: 16,
  minWidth: 160,
};

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function Sparkline({ values }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
      {values.map((v, i) => (
        <div
          key={i}
          title={`${v} connexions`}
          style={{
            width: 8,
            height: `${Math.max((v / max) * 100, 6)}%`,
            background: "#38bdf8",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function Dashboard({ status, isVisitor, onThreatAction }) {
  if (!status) return <p>Chargement du statut système…</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Statut système</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: status.systemStatus === "green" ? "#4ade80" : "#f87171" }}>
            {status.systemStatus === "green" ? "Opérationnel" : "Alerte"}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Menaces actives</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{status.activeThreats}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Systèmes affectés</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{status.affectedSystems}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Fichiers compromis</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{status.compromisedFiles}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Fichiers en quarantaine</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{status.isolatedFiles}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Dernière sauvegarde</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {status.backupSizeGB > 0 ? `${status.backupSizeGB} GB` : "—"}
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Dernière analyse</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(status.lastScan)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Connexions suspectes</div>
          <Sparkline values={status.suspiciousConnections} />
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Menaces détectées</h3>
      <ThreatList threats={status.threats} isVisitor={isVisitor} onThreatAction={onThreatAction} />
    </div>
  );
}

export default Dashboard;
