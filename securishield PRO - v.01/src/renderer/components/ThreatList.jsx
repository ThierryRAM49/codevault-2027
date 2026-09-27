import React from "react";
import Button from "./Button";

const STATUS_LABEL = {
  active: "Active",
  isolated: "Isolée",
  neutralized: "Neutralisée",
};

const STATUS_COLOR = {
  active: "#f87171",
  isolated: "#facc15",
  neutralized: "#4ade80",
};

function ThreatList({ threats, isVisitor, onThreatAction }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {threats.map((t) => {
        const resolved = t.status !== "active";
        return (
          <div
            key={t.id}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: STATUS_COLOR[t.status] }}>{STATUS_LABEL[t.status]}</div>
            </div>
            {!isVisitor && (
              <div>
                <Button
                  label="Neutraliser"
                  disabled={resolved}
                  onClick={() => onThreatAction(t.id, "neutralize", `Neutraliser ${t.name}`)}
                />
                <Button
                  label="Isoler"
                  disabled={resolved}
                  onClick={() => onThreatAction(t.id, "isolate", `Isoler ${t.name}`)}
                />
                <Button label="Analyser" onClick={() => onThreatAction(t.id, "analyze", `Analyser ${t.name}`)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ThreatList;
