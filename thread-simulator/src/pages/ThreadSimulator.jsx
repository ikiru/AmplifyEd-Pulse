import ThreadView from "../components/thread/ThreadView";
import InterpreterSignals from "../components/thread/InterpreterSignals";
import PulseTimeline from "../components/thread/PulseTimeline";
import MoveDecisionPanel from "../components/thread/MoveDecisionPanel";

export default function ThreadSimulator() {
  return (
    <div className="layout">
      <div className="thread-area">
        <ThreadView />
      </div>
      <div className="side-panel">
        <InterpreterSignals />
        <PulseTimeline />
        <MoveDecisionPanel />
      </div>
    </div>
  );
}
// src/pages/ThreadSimulator.jsx

import ThreadView from "../components/thread/ThreadView";
import InterpreterPanel from "../components/thread/InterpreterPanel";
import PulseTimeline from "../components/thread/PulseTimeline";
import MessageInput from "../components/thread/MessageInput";

export default function ThreadSimulator() {
  return (
    <div className="sim-layout">
      <div className="sim-left">
        <ThreadView />
      </div>

      <div className="sim-right">
        <InterpreterPanel />
        <PulseTimeline />
      </div>

      <div className="sim-bottom">
        <MessageInput />
      </div>
    </div>
  );
}
// src/components/thread/ThreadView.jsx
import { useState, useEffect } from "react";
import { useEngineSession } from "../../hooks/useEngineSession";
import { useSocketStream } from "../../hooks/useSocketStream";

export default function ThreadView() {
  const { session } = useEngineSession();
  const [messages, setMessages] = useState([]);

  // socket listener for live messages
  useSocketStream({
    onMessage: (msg) => setMessages((prev) => [...prev, msg]),
  });

  // initial load
  useEffect(() => {
    if (session?.messages) {
      setMessages(session.messages);
    }
  }, [session]);

  return (
    <div className="thread-view">
      {messages.map((m, i) => (
        <div
          key={i}
          className={
            m.authorType === "bot"
              ? "msg-bubble bot-msg"
              : "msg-bubble user-msg"
          }
        >
          <strong>{m.authorType.toUpperCase()}:</strong> {m.text}
        </div>
      ))}
    </div>
  );
}

// src/components/thread/InterpreterPanel.jsx
import { useInterpreter } from "../../hooks/useInterpreter";
import { useSocketStream } from "../../hooks/useSocketStream";

export default function InterpreterPanel() {
  const { interpreter, setInterpreter } = useInterpreter();

  // live interpreter updates
  useSocketStream({
    onInterpreter: (data) => setInterpreter(data),
  });

  if (!interpreter) {
    return <div className="interp-panel">Loading interpreter…</div>;
  }

  return (
    <div className="interp-panel">
      <h3>Interpreter</h3>

      <div className="interp-item">
        <label>Situation:</label>
        <span>{interpreter.situation || "–"}</span>
      </div>

      <div className="interp-item">
        <label>Move:</label>
        <span>{interpreter.recommendedMove || "–"}</span>
      </div>

      <div className="signals-block">
        <label>Signals:</label>
        <pre>{JSON.stringify(interpreter.signals, null, 2)}</pre>
      </div>
    </div>
  );
}

// src/components/thread/PulseTimeline.jsx
import { usePulseTimeline } from "../../hooks/usePulseTimeline";
import { useSocketStream } from "../../hooks/useSocketStream";

export default function PulseTimeline() {
  const { timeline, addPulsePoint } = usePulseTimeline();

  useSocketStream({
    onPulse: (pulse) => addPulsePoint(pulse),
  });

  return (
    <div className="pulse-panel">
      <h3>Pulse Timeline</h3>

      <div className="pulse-list">
        {timeline.map((p, i) => (
          <div key={i} className="pulse-item">
            <strong>{p.timestamp}:</strong> {p.value}
          </div>
        ))}
      </div>
    </div>
  );
}
// src/components/thread/MessageInput.jsx
import { useState } from "react";
import { useSendMessage } from "../../hooks/useSendMessage";

export default function MessageInput() {
  const [text, setText] = useState("");
  const { send } = useSendMessage();

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await send(text);
    setText("");
  }

  return (
    <form className="msg-input-form" onSubmit={submit}>
      <input
        className="msg-input"
        type="text"
        placeholder="Type a message…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button className="msg-send" type="submit">
        Send
      </button>
    </form>
  );
}
// src/pages/ThreadSimulator.jsx
import ThreadView from "../components/thread/ThreadView";
import InterpreterPanel from "../components/thread/InterpreterPanel";

export default function ThreadSimulator() {
  return (
    <div style={styles.layout}>
      <div style={styles.left}>
        <ThreadView />
      </div>

      <div style={styles.right}>
        <InterpreterPanel />
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    gap: "1.5rem",
    padding: "2rem",
  },
  left: {
    flex: 1,
  },
  right: {
    width: "260px",
  },
};
