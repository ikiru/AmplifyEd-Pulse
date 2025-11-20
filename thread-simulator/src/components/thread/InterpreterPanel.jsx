// src/components/thread/InterpreterPanel.jsx
import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket";

export default function InterpreterPanel() {
  const socket = useSocket();

  const [interp, setInterp] = useState(null);
  const [cooldown, setCooldown] = useState({
    remainingMs: 0,
    ready: true
  });

  // ---------------------------------------------------------------------------
  // Socket listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleInterp = (data) => {
      setInterp(data);
    };

    const handleCooldown = (payload) => {
      const r = payload.remainingMs ?? 0;
      setCooldown({
        remainingMs: r,
        ready: r <= 0,
      });
    };

    socket.on("interpreter_update", handleInterp);
    socket.on("cooldownUpdate", handleCooldown);

    return () => {
      socket.off("interpreter_update", handleInterp);
      socket.off("cooldownUpdate", handleCooldown);
    };
  }, [socket]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  function SignalRow({ label, value }) {
    return (
      <div style={styles.signalRow}>
        <span>{label}</span>
        <span>{(value ?? 0).toFixed(2)}</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.panel}>
      <h3 style={styles.header}>Interpreter</h3>

      {!interp ? (
        <div style={styles.empty}>Waiting on interpreter…</div>
      ) : (
        <>
          <div style={styles.section}>
            <div style={styles.label}>Situation:</div>
            <div style={styles.value}>{interp.situation}</div>

            <div style={styles.label}>Move:</div>
            <div style={styles.value}>{interp.recommendedMove}</div>

            <div style={styles.label}>Confidence:</div>
            <div style={styles.value}>
              {(interp.confidence ?? 0).toFixed(2)}
            </div>
          </div>

          <div style={styles.section}>
            <h4 style={styles.subheader}>Signals</h4>
            <SignalRow label="Dominance" value={interp.signals?.dominance} />
            <SignalRow label="Confusion" value={interp.signals?.confusion} />
            <SignalRow label="Stall" value={interp.signals?.stall} />
            <SignalRow label="Summary" value={interp.signals?.summary} />
          </div>
        </>
      )}

      <div style={styles.section}>
        <h4 style={styles.subheader}>Cooldown</h4>
        <div style={styles.cooldown}>
          {cooldown.ready
            ? "READY"
            : `Cooling… ${Math.ceil(cooldown.remainingMs / 1000)}s`}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = {
  panel: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "1rem",
    width: "260px",
    background: "#fff",
    height: "fit-content",
  },
  header: {
    marginTop: 0,
    marginBottom: "1rem",
    fontSize: "1.25rem",
    fontWeight: 600,
  },
  subheader: {
    margin: "0.5rem 0",
    fontSize: "1rem",
    fontWeight: 600,
    opacity: 0.8,
  },
  empty: {
    fontStyle: "italic",
    opacity: 0.6,
  },
  section: {
    marginBottom: "1rem",
  },
  label: {
    fontSize: "0.85rem",
    opacity: 0.7,
  },
  value: {
    marginBottom: "0.35rem",
    fontSize: "0.95rem",
    fontWeight: 500,
  },
  signalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    padding: "2px 0",
  },
  cooldown: {
    padding: "0.25rem 0",
    fontSize: "0.9rem",
  },
};
