// src/hooks/usePulseTimeline.js
import { useState, useEffect } from "react";

export function usePulseTimeline() {
  const [timeline, setTimeline] = useState([]);

  function addPulsePoint(p) {
    setTimeline((prev) => [...prev, p]);
  }

  return {
    timeline,
    addPulsePoint,
  };
}
