import React from "react";

function Button({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Réservé au rôle admin" : undefined}
      style={{
        padding: "8px 14px",
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 6,
        border: "1px solid #334155",
        background: disabled ? "#1e293b" : "#2563eb",
        color: disabled ? "#64748b" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default Button;
