import React from "react";

const SIGNAL_COLORS = {
  confusion: "#3b82f6",
  barrier: "#f59e0b",
  nudge: "#10b981",
  dominance: "#ef4444",
};

function buildSignalSummary(signals = []) {
  return signals.reduce((acc, sig) => {
    if (!sig || !sig.type) return acc;
    const key = sig.type.toLowerCase();
    const score = Number(sig.score ?? sig.strength ?? 0);
    acc[key] = score;
    return acc;
  }, {});
}

function renderLegend(summary) {
  const entries = Object.entries(summary);
  if (!entries.length) {
    return <div style={styles.empty}>No signals detected</div>;
  }

  return entries.map(([key, value]) => {
    const color = SIGNAL_COLORS[key] || "#6b7280";
    const percent = Math.round(Math.max(0, Math.min(value, 1)) * 100);

    return (
      <div key={key} style={styles.legendRow}>
        <div style={{ ...styles.legendDot, background: color }} />
        <div style={styles.legendLabel}>{key}</div>
        <div style={styles.legendValue}>{percent}%</div>
      </div>
    );
  });
}

export default function InlineTooltip({
  signals = [],
  pinned = false,
  onUnpin,
  style = {},
}) {
  const summary = buildSignalSummary(signals);
  const totalHeat = Object.values(summary).reduce(
    (acc, value) => acc + (typeof value === "number" ? value : 0),
    0
  );
  const danger = totalHeat >= 0.8;

  return (
    <div
      style={{
        ...styles.container,
        ...(pinned ? styles.pinnedContainer : {}),
        ...(danger ? styles.tooltipDanger : {}),
        ...style,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (pinned && typeof onUnpin === "function") onUnpin();
      }}
    >
      <div style={styles.arrow} />
      <div style={styles.header}>Signal Breakdown</div>
      {pinned && <div style={styles.pinTag}>Pinned</div>}
      <div style={styles.legendWrapper}>{renderLegend(summary)}</div>
    </div>
  );
}

const styles = {
  container: {
    position: "absolute",
    top: "4px",
    left: "42px",
    width: "210px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "#ffffff",
    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.15)",
    zIndex: 50,
    opacity: 1,
    transition: "opacity 180ms ease-in-out",
    cursor: "pointer",
  },
  pinnedContainer: {
    border: "2px solid #6366f1",
    boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.15)",
    cursor: "default",
  },
  header: {
    fontSize: "0.78rem",
    fontWeight: 700,
    marginBottom: "4px",
    color: "#111827",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.75rem",
    padding: "2px 0",
  },
  signalName: {
    color: "#374151",
    fontWeight: 500,
  },
  score: {
    color: "#1e40af",
    fontWeight: 600,
  },
  empty: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  arrow: {
    position: "absolute",
    left: "-8px",
    top: "12px",
    width: 0,
    height: 0,
    borderTop: "6px solid transparent",
    borderBottom: "6px solid transparent",
    borderRight: "8px solid #ffffff",
    filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.15))",
    animation: "tooltipSlide 160ms ease-out",
  },
  pinTag: {
    fontSize: "0.65rem",
    color: "#6366f1",
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tooltipDanger: {
    background: "#ffeaea",
    border: "1px solid #ef4444",
    boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.25)",
    animation: "dangerPulse 1.4s ease-in-out infinite",
  },
  legendWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    marginTop: "0.4rem",
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.8rem",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    flex: 1,
    textTransform: "capitalize",
    color: "#374151",
  },
  legendValue: {
    fontWeight: 600,
    color: "#111827",
  },
};

const keyframes = `
@keyframes tooltipSlide {
  0% { opacity: 0; transform: translateX(-6px); }
  100% { opacity: 1; transform: translateX(0); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("tooltip-slide-keyframes")) {
  const el = document.createElement("style");
  el.id = "tooltip-slide-keyframes";
  el.innerHTML = keyframes;
  document.head.appendChild(el);
}

const dangerPulseKeyframes = `
@keyframes dangerPulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.015); }
  100% { transform: scale(1); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("dangerPulseStyles")) {
  const tag = document.createElement("style");
  tag.id = "dangerPulseStyles";
  tag.innerHTML = dangerPulseKeyframes;
  document.head.appendChild(tag);
}
