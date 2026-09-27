import React from "react";
import Button from "./Button";

function isVulnerable(cam) {
  return cam.defaultCreds || cam.firmwareOutdated || cam.ports.some((p) => p.service === "Telnet");
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

function IpCameras({ status, isVisitor, onAudit, onCameraAction, auditing }) {
  if (!status) return <p>Chargement…</p>;

  const cameras = status.ipCameras || [];
  const vulnerable = cameras.filter((c) => c.status !== "secured" && isVulnerable(c)).length;

  return (
    <div>
      <p style={{ color: "#94a3b8", fontSize: 12.5, marginTop: 0, marginBottom: 12 }}>
        Toutes les caméras listées ici sont des données de démonstration — aucun scan réel de caméras n'est
        effectué (ça reviendrait à sonder de vrais appareils sur un réseau, ce qui nécessite une autorisation
        explicite).
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Caméras recensées</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{cameras.length}</div>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Caméras vulnérables</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: vulnerable > 0 ? "#f87171" : "#4ade80" }}>
            {vulnerable}
          </div>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 16, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Dernier audit</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(status.lastCameraAudit)}</div>
        </div>
      </div>

      {!isVisitor && (
        <div style={{ marginBottom: 16 }}>
          <Button label={auditing ? "Audit en cours…" : "Auditer les Caméras"} onClick={onAudit} disabled={auditing} />
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8", borderBottom: "1px solid #1f2937" }}>
              <th style={{ padding: "8px 10px" }}>Caméra</th>
              <th style={{ padding: "8px 10px" }}>Emplacement</th>
              <th style={{ padding: "8px 10px" }}>IP</th>
              <th style={{ padding: "8px 10px" }}>Ports ouverts</th>
              <th style={{ padding: "8px 10px" }}>Statut</th>
              {!isVisitor && <th style={{ padding: "8px 10px" }}></th>}
            </tr>
          </thead>
          <tbody>
            {cameras.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "12px 10px", color: "#64748b" }}>
                  Aucune caméra recensée pour le moment — lancez un audit.
                </td>
              </tr>
            ) : (
              cameras.map((c) => {
                const vuln = c.status !== "secured" && isVulnerable(c);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "8px 10px", fontWeight: vuln ? 600 : 400, color: vuln ? "#f87171" : "#e2e8f0" }}>
                      {c.label}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{c.location || "—"}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#94a3b8" }}>{c.ip}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {c.ports.map((p) => (
                        <span
                          key={p.port}
                          style={{
                            display: "inline-block",
                            marginRight: 6,
                            marginBottom: 2,
                            padding: "1px 6px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontFamily: "monospace",
                            background: p.service === "Telnet" ? "#3f1d1d" : "#1e293b",
                            color: p.service === "Telnet" ? "#fca5a5" : "#94a3b8",
                          }}
                        >
                          {p.port}/{p.service}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {c.status === "secured" ? (
                        <span style={{ color: "#4ade80" }}>Sécurisée</span>
                      ) : vuln ? (
                        <span style={{ color: "#f87171" }}>
                          Vulnérable{c.defaultCreds ? " · identifiants par défaut" : ""}
                          {c.firmwareOutdated ? " · firmware obsolète" : ""}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>Normale</span>
                      )}
                    </td>
                    {!isVisitor && (
                      <td style={{ padding: "8px 10px" }}>
                        {vuln && (
                          <Button
                            label="Sécuriser"
                            onClick={() => onCameraAction(c.id, "secure", `Sécuriser ${c.label}`)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default IpCameras;
