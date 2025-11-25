import React, { useEffect, useMemo, useRef, useState } from "react";

export default function EmotionBar({ level = 0, signals = [] }) {
  const normalized = Math.min(Math.max(level, 0), 1) * 100;
  const [displayValue, setDisplayValue] = useState(normalized);
  const lastRef = useRef({ value: normalized, ts: Date.now() });

  useEffect(() => {
    const now = Date.now();
    const prev = lastRef.current;
    const diff = normalized - prev.value;

    if (Math.abs(diff) < 0.1) return;
    if (now - prev.ts < 120 && normalized < prev.value) {
      return;
    }

    const aggressionSignal = Array.isArray(signals)
      ? signals.find((sig) => sig?.type === "aggression")
      : null;

    const shouldInterpolate =
      aggressionSignal && diff > 30;

    const commit = (val) => {
      lastRef.current = { value: val, ts: Date.now() };
      setDisplayValue(val);
    };

    let timerId;

    if (shouldInterpolate) {
      const midway = prev.value + diff * 0.5;
      commit(midway);
      timerId = setTimeout(() => commit(normalized), 200);
    } else {
      timerId = setTimeout(() => commit(normalized), 200);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [normalized, signals]);

  const fillHeight = useMemo(() => `${displayValue}%`, [displayValue]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            height: fillHeight,
            background: "linear-gradient(180deg, #a5b4fc, #4f46e5)",
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
