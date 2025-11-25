const messageBubbleStyles = {
  wrapper: {
    width: "100%",
  },

  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.55rem",
    paddingLeft: "0.25rem",
  },

  bubble: {
    padding: "0.85rem 1rem",
    borderRadius: 12,
    fontSize: "0.95rem",
    lineHeight: 1.45,
    maxWidth: "80%",
    boxSizing: "border-box",
    border: "1px solid transparent",
    transition: "all 180ms ease",
    display: "inline-flex",
    flexDirection: "column",
    gap: "0.25rem",
    position: "relative",
  },

  stacked: {
    marginTop: "0.25rem",
  },

  user: {
    background: "#e0f2fe",
    borderColor: "#bae6fd",
    alignSelf: "flex-start",
  },

  facilitator: {
    background: "#ede9fe",
    borderColor: "#ddd6fe",
    alignSelf: "flex-start",
  },

  focused: {
    border: "2px solid #f59e0b",
    background: "#fff8ec",
    boxShadow: "0 4px 14px rgba(255, 158, 20, 0.35)",
    transition: "box-shadow 180ms ease, background 180ms ease",
  },

  focusAnim: {
    animation: "focus-pop 140ms cubic-bezier(0.25, 0.9, 0.3, 1.2)",
    transformOrigin: "center",
  },

  dimmed: {
    opacity: 0.4,
    filter: "blur(0.2px)",
    transition: "opacity 180ms ease, filter 180ms ease",
  },

  header: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 4,
  },

  name: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#374151",
  },

  timestamp: {
    fontSize: "0.7rem",
    color: "#6B7280",
  },

  text: {
    fontSize: "0.95rem",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
  },

  complexityGlow: {
    boxShadow: "0 0 0 3px rgba(56,189,248,0.28)",
    transition: "box-shadow 200ms ease",
  },

  complexityBadge: {
    position: "absolute",
    top: 6,
    right: 8,
    fontSize: "0.9rem",
    opacity: 0.85,
    transition: "opacity 200ms ease",
  },

  scanlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background:
      "linear-gradient(to bottom, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0) 30%)",
    animation: "scanlineMove 2.4s linear infinite",
    pointerEvents: "none",
    zIndex: 5,
    borderRadius: 12,
  },

  nextFocusGlow: {
    boxShadow: "0 0 0 3px rgba(59,130,246,0.35)",
    transition: "box-shadow 250ms ease",
  },
};

export default messageBubbleStyles;

if (typeof document !== "undefined") {
  const existing = document.getElementById("scanline-move-keyframes");
  if (!existing) {
    const styleEl = document.createElement("style");
    styleEl.id = "scanline-move-keyframes";
    styleEl.textContent = `
@keyframes scanlineMove {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(200%); }
}
    `;
    document.head.appendChild(styleEl);
  }
}
