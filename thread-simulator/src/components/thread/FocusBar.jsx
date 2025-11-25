import React from "react";
import { barContainer, barTrack, barFillGradient } from "./styles/focusBar.styles.js";

export default function FocusBar({ heat = 0 }) {
  const clamped = Math.min(Math.max(heat, 0), 100) / 100;

  return (
    <div style={barContainer}>
      <div style={barTrack}>
        <div style={{ ...barFillGradient, transform: `scaleY(${clamped})` }} />
      </div>
    </div>
  );
}
