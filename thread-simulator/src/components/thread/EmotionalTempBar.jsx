import React from "react";
import { BarWrapper, BarFill, BarLabel } from "./styles/emotionalTemp.styles.js";

export default function EmotionalTempBar({ score = 0 }) {
  const pct = Math.round(Math.max(0, Math.min(score, 1)) * 100);

  return (
    <BarWrapper>
      <BarLabel>{pct}%</BarLabel>
      <BarFill style={{ height: `${pct}%` }} />
    </BarWrapper>
  );
}
