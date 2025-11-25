import React, { useEffect, useMemo, useState } from "react";
import "./participantOverlay.css";

const STATUS_CONFIG = {
  calm: {
    icon: "🕊️",
    label: "Calm & steady",
    subtext: "Participants appear grounded and regulated.",
    className: "state-calm",
  },
  confused: {
    icon: "🤔",
    label: "Mixed signals",
    subtext: "Some confusion detected—consider clarifying or summarizing.",
    className: "state-confused",
  },
  "high-heat": {
    icon: "🌡️",
    label: "High heat",
    subtext: "Emotional temperature is climbing. Slow pacing and offer support.",
    className: "state-heat",
  },
  "high-risk": {
    icon: "⚠️",
    label: "High risk",
    subtext: "Aggression cues detected. Pause and prioritize psychological safety.",
    className: "state-risk",
  },
};

function classifyState({ heat = 0, emotionalTemp = 0, aggressionLevel }) {
  if (
    aggressionLevel === "high" ||
    aggressionLevel === "critical" ||
    heat >= 95 ||
    emotionalTemp >= 90
  ) {
    return "high-risk";
  }

  if (heat >= 75 || emotionalTemp >= 70) {
    return "high-heat";
  }

  if (heat >= 40 || emotionalTemp >= 40) {
    return "confused";
  }

  return "calm";
}

export default function ParticipantOverlay({ socket: externalSocket }) {
  const [status, setStatus] = useState("calm");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const socket =
      externalSocket ||
      window.__THREAD_SOCKET__ ||
      window.__AMPLIFYED_SOCKET__ ||
      window.socket;

    if (!socket?.on) return;

    const handleStateUpdate = (payload = {}) => {
      setStatus(classifyState(payload));
      setVisible(true);
    };

    socket.on("stateUpdate", handleStateUpdate);
    return () => socket.off("stateUpdate", handleStateUpdate);
  }, [externalSocket]);

  const config = useMemo(() => STATUS_CONFIG[status] || STATUS_CONFIG.calm, [status]);

  return (
    <div
      className={[
        "participant-overlay",
        config.className,
        visible ? "is-visible" : "is-hidden",
      ].join(" ")}
    >
      <div className="overlay-icon" aria-hidden="true">
        {config.icon}
      </div>

      <div className="overlay-body">
        <div className="overlay-label">{config.label}</div>
        <div className="overlay-subtext">{config.subtext}</div>
      </div>
    </div>
  );
}
