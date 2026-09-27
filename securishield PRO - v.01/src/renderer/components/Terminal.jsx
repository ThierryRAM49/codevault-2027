import React, { useState } from "react";

function Terminal({ logs, isVisitor, onCommand }) {
  const [input, setInput] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onCommand(input.trim());
    setInput("");
  };

  return (
    <div>
      <div
        style={{
          background: "#0b1220",
          color: "#4ade80",
          fontFamily: "monospace",
          fontSize: 13,
          padding: 12,
          borderRadius: "6px 6px 0 0",
          height: 220,
          overflowY: "auto",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "#64748b" }}>Aucun événement pour le moment.</div>
        ) : (
          logs.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
      <form onSubmit={submit} style={{ display: "flex" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isVisitor}
          placeholder={isVisitor ? "Terminal en lecture seule (rôle visiteur)" : "Tapez une commande (help pour la liste)"}
          style={{
            flex: 1,
            padding: 8,
            background: "#0b1220",
            color: "#e2e8f0",
            border: "1px solid #1f2937",
            borderRadius: "0 0 0 6px",
            fontFamily: "monospace",
          }}
        />
        <button
          type="submit"
          disabled={isVisitor}
          style={{ padding: "8px 14px", borderRadius: "0 0 6px 0", border: "1px solid #1f2937" }}
        >
          Entrée
        </button>
      </form>
    </div>
  );
}

export default Terminal;
