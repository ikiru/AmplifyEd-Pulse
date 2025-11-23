// thread-simulator/src/components/thread/ThreadView.jsx
import React, { useEffect, useState } from "react";
import InterpreterPanel from "./InterpreterPanel.jsx";
import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";
import { useSocket } from "../../hooks/useSocket.js";

const DEFAULT_SESSION_ID = "demo-1";

export default function ThreadView() {
  // ---------------------------------------------------------------------------
  // Socket / State
  // ---------------------------------------------------------------------------
  const socket = useSocket();

  const [messages, setMessages] = useState([]);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const [memberCount, setMemberCount] = useState(1);

  const [cooldown, setCooldown] = useState({
    sessionId: DEFAULT_SESSION_ID,
    cooldownMs: 0,
    elapsed: 0,
    remaining: 0,
    remainingMs: 0,
    ready: true,
  });

  // ---------------------------------------------------------------------------
  // Socket wiring
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onInit = (payload = {}) => {
      setMessages(payload.messages || []);
      setMemberCount(payload.memberCount || 1);
    };

    const onUpdate = (msgs = []) => setMessages(msgs);

    const onNewMsg = (msg) =>
      msg && setMessages((prev) => [...prev, msg]);

    const onCooldown = (payload = {}) =>
      setCooldown((prev) => ({ ...prev, ...payload }));

    const onFocus = (payload = {}) =>
      setFocusedMessageId(payload.messageId || null);

    socket.on("threadInit", onInit);
    socket.on("threadUpdate", onUpdate);
    socket.on("newMessage", onNewMsg);
    socket.on("cooldownUpdate", onCooldown);
    socket.on("interpreterFocus", onFocus);

    return () => {
      socket.off("threadInit", onInit);
      socket.off("threadUpdate", onUpdate);
      socket.off("newMessage", onNewMsg);
      socket.off("cooldownUpdate", onCooldown);
      socket.off("interpreterFocus", onFocus);
    };
  }, [socket]);

  // ---------------------------------------------------------------------------
  // Send human message
  // ---------------------------------------------------------------------------
  const handleSend = (text) => {
    if (!socket) return;
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    socket.emit("humanMessage", {
      sessionId: DEFAULT_SESSION_ID,
      userId: "User",
      role: "teacher",
      text: trimmed,
      authorType: "human",
    });
  };

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.page}>

      {/* LEFT SIDEBAR -------------------------------------------------------- */}
      <aside style={styles.leftColumn}>
        <InterpreterPanel cooldown={cooldown} />
      </aside>

      {/* MAIN THREAD --------------------------------------------------------- */}
      <main style={styles.rightColumn}>
        <ThreadHeader memberCount={memberCount} />

        <MessageList
          messages={messages}
          focusedMessageId={focusedMessageId}
        />

        <div style={styles.inputRow}>
          <MessageInput
            onSend={handleSend}
            disabled={!cooldown.ready}
          />
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

function ThreadHeader({ memberCount }) {
  return (
    <header style={styles.header}>
      <h1 style={styles.title}>AmplifyEd Thread Simulator</h1>

      <div style={styles.presence}>
        <span style={styles.presenceIcon}>👥</span>
        <span style={styles.presenceText}>{memberCount}</span>
      </div>
    </header>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = {
  page: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    height: "100vh",
    padding: "1.5rem 1.75rem",
    boxSizing: "border-box",
    gap: "1.5rem",
    background: "#f9fafb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },

  leftColumn: {
    alignSelf: "stretch",
  },

  rightColumn: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "1.25rem 1.75rem 1.5rem",
    boxShadow: "0 10px 35px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
  },

  title: {
    fontSize: "1.25rem",
    fontWeight: 700,
    margin: 0,
  },

  presence: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "0.15rem 0.45rem",
    borderRadius: 999,
    background: "#eef2ff",
    fontSize: "0.8rem",
  },

  presenceIcon: {
    fontSize: "0.95rem",
  },

  presenceText: {
    fontWeight: 600,
  },

  inputRow: {
    marginTop: "0.75rem",
  },
};
