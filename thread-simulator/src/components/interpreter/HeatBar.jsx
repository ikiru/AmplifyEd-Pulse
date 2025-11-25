import React, { useMemo } from "react";

export default function HeatBar({ heat = 0 }) {
  const clamped = Math.min(Math.max(heat, 0), 1);

  const fillHeight = useMemo(() => `${clamped * 100}%`, [clamped]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            height: fillHeight,
            background:
              clamped > 0.9
                ? "linear-gradient(180deg, #ff5f5f, #d72626)"
                : "linear-gradient(180deg, #fde047, #f97316)",
            boxShadow:
              clamped > 0.9
                ? "0 0 12px rgba(255, 0, 0, 0.55)"
                : "0 0 0 transparent",
          }}
        />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    width: "28px",
    height: "160px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: "8px",
    height: "100%",
    borderRadius: "8px",
    background: "#e5e7eb",
    position: "relative",
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    position: "absolute",
    bottom: 0,
    borderRadius: "8px",
    transition: "height 0.35s cubic-bezier(0.23, 1, 0.32, 1)",
  },
};
