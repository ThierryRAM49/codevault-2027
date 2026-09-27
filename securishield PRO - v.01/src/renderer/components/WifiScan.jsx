import React from "react";
import Button from "./Button";

function signalPercent(dbm) {
  // -30 dBm (excellent) → 100%, -90 dBm (très faible) → 0%
  return Math.max(0, Math.min(100, Math.round(((dbm + 90) / 60) * 100)));
}

function SignalBar({ dbm }) {
  const pct = signalPercent(dbm);
  const color = pct > 60 ? "#4ade80" : pct > 30 ? "#facc15" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{dbm} dBm</span>
    </div>
  );
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function SourceBadge({ source }) {
  const isReal = source === "real";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        background: isReal ? "#0f2e1f" : "#1e293b",
        color: isReal ? "#4ade80" : "#94a3b8",
        border: `1px solid ${isReal ? "#166534" : "#334155"}`,
      }}
    >
      {isReal ? "Réel" : "Simulé"}
    </span>
  );
}

function WifiScan({ status, isVisitor, onScan, onNetworkAction, scanning }) {
  if (!status) return <p>Chargement…</p>;

  const networks = status.wifiNetworks || [];
  const rogueActive = networks.filter((n) => n.rogue && n.status === "active").length;
  const hasSimulated = networks.some((n) => n.source !== "real");

  return (
    <div>
      {hasSimulated && (
        <p style={{ color: "#94a3b8", fontSize: 12.5, marginTop: 0, marginBottom: 12 }}>
          Les réseaux marqués <SourceBadge source="simulated" /> sont des données de démonstration, pas un vrai
          scan. Seuls ceux marqués <SourceBadge source="real" /> viennent d'un scan réel importé (voir{" "}
          <code>scripts/wifi-real-scan.sh</code>).
        </p>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Réseaux visibles</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{networks.length}</div>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Points d'accès suspects</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: rogueActive > 0 ? "#f87171" : "#4ade80" }}>
            {rogueActive}
          </div>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Dernier scan</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(status.lastWifiScan)}</div>
        </div>
      </div>

      {!isVisitor && (
        <div style={{ marginBottom: 16 }}>
          <Button label={scanning ? "Scan en cours…" : "Scanner le Wi-Fi"} onClick={onScan} disabled={scanning} />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8", borderBottom: "1px solid #1f2937" }}>
              <th style={{ padding: "8px 10px" }}>SSID</th>
              <th style={{ padding: "8px 10px" }}>Source</th>
              <th style={{ padding: "8px 10px" }}>Emplacement</th>
              <th style={{ padding: "8px 10px" }}>BSSID</th>
              <th style={{ padding: "8px 10px" }}>Sécurité</th>
              <th style={{ padding: "8px 10px" }}>Signal</th>
              <th style={{ padding: "8px 10px" }}>Statut</th>
              {!isVisitor && <th style={{ padding: "8px 10px" }}></th>}
            </tr>
          </thead>
          <tbody>
            {networks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "12px 10px", color: "#64748b" }}>
                  Aucun réseau détecté pour le moment — lancez un scan.
                </td>
              </tr>
            ) : (
              networks.map((n) => (
                <tr key={n.id} style={{ borderBottom: "1px solid #1f2937" }}>
                  <td style={{ padding: "8px 10px", fontWeight: n.rogue ? 600 : 400, color: n.rogue ? "#f87171" : "#e2e8f0" }}>
                    {n.ssid}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <SourceBadge source={n.source} />
                  </td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{n.location || "—"}</td>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#94a3b8" }}>{n.bssid}</td>
                  <td style={{ padding: "8px 10px" }}>{n.security}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <SignalBar dbm={n.signal} />
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {n.status === "neutralized" ? (
                      <span style={{ color: "#4ade80" }}>Bloqué</span>
                    ) : n.rogue ? (
                      <span style={{ color: "#f87171" }}>Suspect</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>Normal</span>
                    )}
                  </td>
                  {!isVisitor && (
                    <td style={{ padding: "8px 10px" }}>
                      {n.rogue && n.status === "active" && (
                        <Button
                          label="Neutraliser"
                          onClick={() => onNetworkAction(n.id, "neutralize", `Neutraliser ${n.ssid}`)}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WifiScan;
