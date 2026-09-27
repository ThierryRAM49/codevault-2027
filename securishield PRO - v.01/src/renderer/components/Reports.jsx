import React, { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000";

const ROLE_LABEL = { admin: "Admin", visitor: "Visiteur" };

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toCsv(rows) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Date", "Rôle", "Utilisateur", "Événement"].map(escape).join(",");
  const lines = rows.map((r) =>
    [formatDateTime(r.time), ROLE_LABEL[r.role] || "", r.username, r.message].map(escape).join(",")
  );
  return [header, ...lines].join("\r\n");
}

function downloadCsv(rows) {
  const csv = toCsv(rows);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `securishield-rapports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const inputStyle = {
  padding: "7px 10px",
  background: "#111827",
  border: "1px solid #1f2937",
  color: "#e2e8f0",
  borderRadius: 6,
  fontSize: 13,
};

function Reports({ authFetch, isVisitor }) {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      authFetch(`${API_BASE}/api/reports`)
        .then((res) => {
          if (!res.ok) throw new Error("Impossible de charger les rapports");
          return res.json();
        })
        .then((data) => {
          if (!cancelled) setReports(data.reports);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authFetch]);

  const filtered = useMemo(() => {
    if (!reports) return [];
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (!q) return true;
      return r.message.toLowerCase().includes(q) || r.username.toLowerCase().includes(q);
    });
  }, [reports, query, roleFilter]);

  const handleClear = async () => {
    if (!window.confirm(`Effacer définitivement les ${reports.length} rapport(s) ? Cette action est irréversible.`)) {
      return;
    }
    setClearing(true);
    try {
      const res = await authFetch(`${API_BASE}/api/reports`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      const data = await res.json();
      setReports(data.reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!reports) return <p>Chargement des rapports…</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Rechercher (événement, utilisateur)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 240px" }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={inputStyle}>
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="visitor">Visiteur</option>
        </select>
        <button
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          style={{
            ...inputStyle,
            cursor: filtered.length === 0 ? "not-allowed" : "pointer",
            background: filtered.length === 0 ? "#1e293b" : "#2563eb",
            border: "1px solid #334155",
          }}
        >
          Exporter CSV ({filtered.length})
        </button>
        {!isVisitor && (
          <button
            onClick={handleClear}
            disabled={clearing || reports.length === 0}
            title="Réservé au rôle admin — action irréversible"
            style={{
              ...inputStyle,
              cursor: clearing || reports.length === 0 ? "not-allowed" : "pointer",
              background: reports.length === 0 ? "#1e293b" : "#3f1d1d",
              border: "1px solid #7f1d1d",
              color: reports.length === 0 ? "#64748b" : "#fca5a5",
            }}
          >
            {clearing ? "Suppression…" : "Effacer tout"}
          </button>
        )}
      </div>

      <p style={{ color: "#94a3b8", fontSize: 13 }}>
        {filtered.length} / {reports.length} entrée(s) — sauvegardées sur le serveur (fichier local, survit aux
        redémarrages).
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#94a3b8", borderBottom: "1px solid #1f2937" }}>
              <th style={{ padding: "8px 10px" }}>Date</th>
              <th style={{ padding: "8px 10px" }}>Rôle</th>
              <th style={{ padding: "8px 10px" }}>Utilisateur</th>
              <th style={{ padding: "8px 10px" }}>Événement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "12px 10px", color: "#64748b" }}>
                  Aucun rapport ne correspond à ce filtre.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1f2937" }}>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {formatDateTime(r.time)}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{ROLE_LABEL[r.role] || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{r.username}</td>
                  <td style={{ padding: "8px 10px" }}>{r.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Reports;
