import React from "react";

function ProgressBar({ label, progress }) {
  return (
    <div style={{ margin: "8px 0" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
        {label} — {Math.round(progress)}%
      </div>
      <div style={{ background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#2563eb",
            transition: "width 150ms linear",
          }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
