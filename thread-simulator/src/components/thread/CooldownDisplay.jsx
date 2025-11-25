import React from "react";

export default function CooldownDisplay({ cooldown = {} }) {
  return (
    <div style={styles.root}>
      <h2 style={styles.title}>Facilitator State</h2>

      <div style={styles.section}>
        <div style={styles.label}>Cooldown</div>
        <div style={styles.cooldownBox}>
          {cooldown?.ready ? (
            <span style={styles.ready}>Ready</span>
          ) : (
            <>
              <span style={styles.waiting}>Waiting…</span>
              <span style={styles.ms}>{cooldown?.remainingMs ?? 0} ms</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    padding: "1rem 1.25rem",
    borderRadius: 14,
    background: "#fafafa",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
    height: "100%",
    overflow: "hidden",
  },

  title: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "#0f172a",
    margin: "0 0 0.75rem 0",
    letterSpacing: "-0.01rem",
  },

  section: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "1.25rem",
  },

  label: {
    fontSize: "0.78rem",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#475569",
    marginBottom: "0.35rem",
  },

  cooldownBox: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "#ffffff",
    borderRadius: 8,
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    fontSize: "0.85rem",
  },

  ready: {
    color: "#15803d",
    fontWeight: 600,
  },

  waiting: {
    color: "#b91c1c",
    fontWeight: 600,
  },

  ms: {
    color: "#475569",
    fontSize: "0.78rem",
  },
};
