import React, { useEffect, useRef, useState } from "react";
import CooldownDisplay from "./CooldownDisplay.jsx";
import HeatBar from "../interpreter/HeatBar.jsx";
import EmotionBar from "../interpreter/EmotionBar.jsx";
import TrendlineGraph from "../interpreter/TrendlineGraph.jsx";

export default function InterpreterPanel({ cooldown, state = {} }) {
  const barHeat = Math.max(0, Math.min(1, (state.heat ?? 0) / 100));
  const barEmotion = Math.max(0, Math.min(1, (state.emotion ?? 0) / 100));

  const [trendHistory, setTrendHistory] = useState({
    emotion: [],
    heat: [],
    dominance: [],
    barrier: [],
  });

  const prevRef = useRef({
    emotion: null,
    heat: null,
    dominance: null,
    barrier: null,
  });

  function hybridSmooth(prev, next) {
    if (prev == null) return next;
    const ema = prev * 0.7 + next * 0.3;
    const mid = (prev + next) / 2;
    return (ema + mid + next) / 3;
  }

  useEffect(() => {
    if (typeof state.emotion !== "number" || typeof state.heat !== "number") return;

    const emotionNorm = Math.max(0, Math.min(1, state.emotion / 100));
    const heatNorm = Math.max(0, Math.min(1, state.heat / 100));
    const dominanceNorm = Math.max(0, Math.min(1, heatNorm * 0.6));
    const barrierNorm = Math.max(0, Math.min(1, emotionNorm * 0.4));

    const smoothed = {
      emotion: hybridSmooth(prevRef.current.emotion, emotionNorm),
      heat: hybridSmooth(prevRef.current.heat, heatNorm),
      dominance: hybridSmooth(prevRef.current.dominance, dominanceNorm),
      barrier: hybridSmooth(prevRef.current.barrier, barrierNorm),
    };

    prevRef.current = smoothed;

    setTrendHistory((old) => {
      const maxPoints = 200;
      return {
        emotion: [...(old.emotion || []), smoothed.emotion].slice(-maxPoints),
        heat: [...(old.heat || []), smoothed.heat].slice(-maxPoints),
        dominance: [...(old.dominance || []), smoothed.dominance].slice(-maxPoints),
        barrier: [...(old.barrier || []), smoothed.barrier].slice(-maxPoints),
      };
    });
  }, [state.emotion, state.heat]);

  return (
    <aside style={styles.panel}>
      <div style={styles.headerBlock}>
        <div style={styles.headerTitle}>Facilitator State</div>
        <div style={styles.headerSubtitle}>Signal & emotional safety</div>
      </div>

      <div style={styles.barsRow}>
        <div style={styles.barWithLabel}>
          <HeatBar heat={barHeat} />
          <div style={styles.barLabelTop}>Signal</div>
          <div style={styles.barLabelBottom}>intensity</div>
        </div>

        <div style={styles.barWithLabel}>
          <EmotionBar level={barEmotion} signals={state.signals || []} />
          <div style={styles.barLabelTop}>Emotional</div>
          <div style={styles.barLabelBottom}>temperature</div>
        </div>
      </div>

      <CooldownDisplay cooldown={cooldown} />

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Emotional Trend</div>
        <TrendlineGraph history={trendHistory} />
      </div>
    </aside>
  );
}

const styles = {
  panel: {
    height: "100%",
    width: "100%",
    background: "#ffffff",
    borderRadius: 24,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.06)",
    padding: "1.4rem 1.5rem 1.1rem 1.5rem",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  headerBlock: {
    marginBottom: "0.25rem",
  },
  headerTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: "0.85rem",
    color: "#6b7280",
    marginTop: "0.25rem",
  },
  barsRow: {
    display: "flex",
    gap: "3.25rem",
    alignItems: "flex-start",
    marginTop: "0.25rem",
    marginBottom: "1rem",
  },
  barWithLabel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  barLabelTop: {
    marginTop: "0.75rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#374151",
  },
  barLabelBottom: {
    marginTop: "-2px",
    fontSize: "0.75rem",
    fontWeight: 400,
    color: "#6b7280",
  },
  section: {
    marginTop: "0.5rem",
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    marginBottom: "0.25rem",
    color: "#4b5563",
  },
};
