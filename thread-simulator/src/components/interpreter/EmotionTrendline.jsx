import React from "react";

/**
 * Multi-line trendline for signals:
 *   confusion  (blue)
 *   barrier    (red)
 *   nudge      (green)
 *   dominance  (purple)
 */
export default function EmotionTrendline({ history = [] }) {
  if (!history.length) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>No data yet</div>
      </div>
    );
  }

  const confusionValues = history.map((h) => h.signals?.confusion ?? 0);
  const barrierValues = history.map((h) => h.signals?.barrier ?? 0);
  const nudgeValues = history.map((h) => h.signals?.nudge ?? 0);
  const dominanceValues = history.map((h) => h.signals?.dominance ?? 0);

  const lineDefs = [
    { name: "confusion", values: confusionValues, color: "rgb(59,130,246)" },
    { name: "barrier", values: barrierValues, color: "rgb(239,68,68)" },
    { name: "nudge", values: nudgeValues, color: "rgb(34,197,94)" },
    { name: "dominance", values: dominanceValues, color: "rgb(168,85,247)" },
  ];

  return (
    <div style={styles.container}>
      <svg width="220" height="60" style={styles.svg}>
        {lineDefs.map((line) => {
          const points = line.values.map((v, i) => ({
            x: i * 12,
            y: 60 - v * 0.55,
            value: v,
          }));

          const newest = points[points.length - 1];
          const pathData = generateSmoothPath(points);

          const stopsHtml = line.values
            .map((_, i) => {
              const pct = (i / (line.values.length - 1)) * 100;
              const alpha = 0.15 + (i / (line.values.length - 1)) * 0.85;
              return `<stop offset="${pct}%" stop-color="${line.color}" stop-opacity="${alpha}" />`;
            })
            .join("\n");

          return (
            <g key={line.name}>
              <defs>
                <linearGradient id={`fade-${line.name}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <g dangerouslySetInnerHTML={{ __html: stopsHtml }} />
                </linearGradient>
              </defs>

              <path
                d={pathData}
                fill="none"
                stroke={`url(#fade-${line.name})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <circle
                cx={newest.x}
                cy={newest.y}
                r="3.2"
                fill={line.color}
                style={{
                  filter: `drop-shadow(0 0 5px ${line.color
                    .replace("rgb", "rgba")
                    .replace(")", ",0.7)")}`,
                }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function generateSmoothPath(points) {
  if (points.length < 2) return "";
  const tension = 0.4;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

const styles = {
  container: {
    width: "220px",
    height: "60px",
    background: "#f3f4f6",
    borderRadius: 8,
    padding: "4px 6px",
    boxSizing: "border-box",
  },
  svg: {
    display: "block",
  },
  placeholder: {
    fontSize: "0.7rem",
    textAlign: "center",
    paddingTop: "18px",
    color: "#9ca3af",
  },
};
