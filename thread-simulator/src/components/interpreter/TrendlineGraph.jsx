import React, { useEffect, useLayoutEffect, useRef } from "react";

const COLORS = {
  emotion: "#6C63FF",
  heat: "#FFA500",
  dominance: "#D64545",
  barrier: "#00A896",
};

const normalize = (val = 0, height = 200) => {
  const clamped = Math.max(0, Math.min(1, val));
  return (1 - clamped) * height * 0.9 + height * 0.05;
};

export default function TrendlineGraph({ history }) {
  const canvasRef = useRef(null);
  const signals = ["emotion", "heat", "dominance", "barrier"];

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = parent.clientWidth * ratio;
      canvas.height = parent.clientHeight * ratio;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(240,240,255,0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const maxPoints = Math.max(
      history?.emotion?.length ?? 0,
      history?.heat?.length ?? 0,
      history?.dominance?.length ?? 0,
      history?.barrier?.length ?? 0
    );

    if (maxPoints < 2) return;

    const fade = (index, total) => {
      if (total < 10) return 1;
      const pct = index / total;
      return 0.15 + 0.85 * pct;
    };

    signals.forEach((sig) => {
      const values = history[sig];
      if (!values || values.length < 2) return;

      ctx.beginPath();
      ctx.lineWidth = 3.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      for (let i = 0; i < values.length; i++) {
        const x = (i / (values.length - 1)) * width;
        const y = normalize(values[i], height);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const opacity = fade(i, values.length);
          const alphaHex = Math.floor(opacity * 255)
            .toString(16)
            .padStart(2, "0");
          ctx.strokeStyle = `${COLORS[sig]}${alphaHex}`;
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }
      }

      ctx.closePath();
    });
  }, [history, signals]);

  if (
    !history ||
    !history.emotion ||
    history.emotion.length < 2
  ) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>No data yet</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} />
    </div>
  );
}

const styles = {
  container: {
    height: "140px",
    width: "100%",
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    padding: "8px 12px",
    overflow: "hidden",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  placeholder: {
    fontSize: "0.75rem",
    textAlign: "center",
    color: "#94a3b8",
  },
};
