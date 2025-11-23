// thread-simulator/src/components/thread/InterpreterPanel.jsx
import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket.js";

export default function InterpreterPanel({ cooldown }) {
  const socket = useSocket();

  const [status, setStatus] = useState("Waiting on interpreter…");
  const [recommendedMove, setRecommendedMove] = useState(null);
  const [signals, setSignals] = useState({});

  const moveLabels = {
    clarify: "Clarify & focus",
    reframe: "Reframe barrier",
    summarize: "Summarize & recap",
    invite_quiet_voices: "Invite quiet voices",
    nudge: "Nudge next step",
    none: "No move recommended",
  };

  useEffect(() => {
    if (!socket) return;

    const handleInterpreterUpdate = (payload = {}) => {
      const {
        status: rawStatus,
        recommendedMove: rawMove,
        signals: rawSignals,
      } = payload;

      if (rawStatus) {
        const pretty =
          rawStatus === "healthy"
            ? "Healthy flow"
            : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        setStatus(pretty);
      } else {
        setStatus("Waiting on interpreter…");
      }

      if (rawMove) {
        setRecommendedMove(moveLabels[rawMove] || rawMove);
      } else {
        setRecommendedMove(null);
      }

      setSignals(rawSignals || {});
    };

    socket.on("interpreterUpdate", handleInterpreterUpdate);
    return () => {
      socket.off("interpreterUpdate", handleInterpreterUpdate);
    };
  }, [socket]);

  const remainingMs = cooldown?.remainingMs ?? cooldown?.remaining ?? 0;
  const cooldownReady = cooldown?.ready ?? true;
  const cooldownLabel = cooldownReady
    ? "READY"
    : `${Math.ceil(remainingMs / 1000)}s remaining`;

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Interpreter</div>

      {/* STATUS */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Status</div>
        <div style={styles.chip}>{status}</div>
      </div>

      {/* RECOMMENDED MOVE */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Recommended Move</div>
        <div style={styles.value}>
          {recommendedMove || "No move recommended yet"}
        </div>
      </div>

      {/* COOLDOWN */}
      <div style={styles.section}>
        <div style={styles.sectionLabel}>Cooldown</div>
        <div
          style={{
            ...styles.cooldownChip,
            ...(cooldownReady ? styles.cooldownReady : styles.cooldownActive),
          }}
        >
          {cooldownLabel}
        </div>
      </div>

      {/* Signals (simple debug view) */}
      {signals && Object.keys(signals).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Signals</div>
          <div style={styles.signalGrid}>
            {Object.entries(signals).map(([key, value]) => (
              <div key={key} style={styles.signalRow}>
                <span style={styles.signalKey}>{key}</span>
                <span style={styles.signalValue}>
                  {typeof value === "boolean" ? (value ? "ON" : "off") : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    width: "100%",
    padding: "1.25rem 1.5rem",
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  },
  title: {
    fontSize: "1rem",
    fontWeight: 700,
    marginBottom: "0.25rem",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  sectionLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
  },
  value: {
    fontSize: "0.88rem",
    color: "#111827",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.3rem 0.7rem",
    borderRadius: 999,
    background: "#eef2ff",
    fontSize: "0.8rem",
    color: "#111827",
  },
  cooldownChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.3rem 0.7rem",
    borderRadius: 999,
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  cooldownReady: {
    background: "#e6f7ec",
    color: "#166534",
  },
  cooldownActive: {
    background: "#fff7ed",
    color: "#b45309",
  },
  signalGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
    fontSize: "0.75rem",
  },
  signalRow: {
    display: "flex",
    justifyContent: "space-between",
  },
  signalKey: {
    color: "#6b7280",
  },
  signalValue: {
    fontWeight: 600,
  },
};
