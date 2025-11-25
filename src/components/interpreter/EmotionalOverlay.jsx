import React, { useEffect, useState } from "react";
import "./emotionalOverlay.css";

export default function EmotionalOverlay({
  state = {},
  interpreter = {},
  lastMessage = "",
}) {
  const temp = Math.max(0, Math.min(100, state.emotion ?? 0));
  const heat = Math.max(0, Math.min(100, state.heat ?? 0));
  const signals = state.signals || {};
  const status = interpreter.status || "healthy";
  const recommended = interpreter.recommendedMove || "none";

  const visible =
    temp > 10 ||
    heat > 10 ||
    (signals && Object.keys(signals).length > 0) ||
    status !== "healthy";

  const trigger = lastMessage
    ? lastMessage.split(" ").slice(-6).join(" ")
    : "";

  const risk =
    temp > 80 ? "high" : temp > 50 ? "medium" : "low";

  return (
    <div
      className={`emo-overlay ${visible ? "show" : "hide"} risk-${risk}`}
      data-intensity={temp}
    >
      <div className="emo-header">Emotional Awareness</div>

      <div className="emo-line">
        <span className="emo-label">Status:</span> {status}
      </div>

      {trigger && (
        <div className="emo-line">
          <span className="emo-label">Trigger:</span> “{trigger}”
        </div>
      )}

      <div className="emo-line">
        <span className="emo-label">Recommended:</span> {recommended}
      </div>

      <div className={`emo-risk-badge risk-${risk}`}>
        {risk === "high" && "High Risk"}
        {risk === "medium" && "Medium Risk"}
        {risk === "low" && "Low Risk"}
      </div>

      <div key={status} className="emo-whisper">
        Shift detected: {status}
      </div>
    </div>
  );
}
