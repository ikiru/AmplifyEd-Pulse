import React, { useEffect, useState } from "react";
import "./InterpreterPanel.css";
import { socket } from "../../services/socket";

export default function InterpreterPanel() {
  const [status, setStatus] = useState("healthy");
  const [recommendedMove, setRecommendedMove] = useState("none");
  const [signals, setSignals] = useState({});
  const [reasoning, setReasoning] = useState([]);

  useEffect(() => {
    // Interpreter update: situation, recommendedMove, signals
    socket.on("interpreterUpdate", (payload) => {
      if (!payload) return;

      setStatus(payload.status || "healthy");
      setRecommendedMove(payload.recommendedMove || "none");
      setSignals(payload.signals || {});
    });

    // Thread intensity / emotional reasoning update
    socket.on("threadIntensity", (payload) => {
      if (!payload?.reasons) return;
      setReasoning(payload.reasons || []);
    });

    return () => {
      socket.off("interpreterUpdate");
      socket.off("threadIntensity");
    };
  }, []);

  return (
    <div className="interpreter-panel">
      <h2 className="interp-header">Interpreter</h2>

      <div className="interp-row">
        <span className="interp-label">Status:</span>
        <span className="interp-value status-text">{status}</span>
      </div>

      <div className="interp-row">
        <span className="interp-label">Recommended Move:</span>
        <span className="interp-value move-text">{recommendedMove}</span>
      </div>

      <div className="interp-section">
        <h3 className="interp-subheader">Signals</h3>
        {Object.keys(signals).length === 0 ? (
          <div className="interp-value">None</div>
        ) : (
          Object.entries(signals).map(([key, val]) => (
            <div key={key} className="signal-line">
              <span className="signal-key">{key}:</span>
              <span className="signal-score">
                {val.score?.toFixed(2) ?? val.severity?.toFixed(2) ?? "1.00"}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="interp-section">
        <h3 className="interp-subheader">Reasoning</h3>
        {reasoning.length === 0 ? (
          <div className="interp-reason">No reasoning yet.</div>
        ) : (
          reasoning.map((r, i) => (
            <div key={i} className="interp-reason">
              • {r}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
