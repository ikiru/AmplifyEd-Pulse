import React, { useEffect, useState } from "react";
import InterpreterPanel from "./InterpreterPanel.jsx";
import {
  HeaderWrap,
  Title,
  Presence,
  PresenceIcon,
  PresenceText
} from "./styles/threadHeader.styles.js";
import FocusMessageBar from "./FocusMessageBar.jsx";
import MessageList from "./MessageList.jsx";
import MessageInput from "./MessageInput.jsx";
import { useSocket } from "../../hooks/useSocket.js";
import EmotionalOverlay from "../../../../src/components/interpreter/EmotionalOverlay.jsx";
import ParticipantOverlay from "../../../../src/components/participantOverlay/ParticipantOverlay.jsx";

const DEFAULT_SESSION_ID = "demo-1";

export default function ThreadView() {
  const socket = useSocket();

  const [messages, setMessages] = useState([]);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const [memberCount, setMemberCount] = useState(1);
  const [facilitatorState, setFacilitatorState] = useState({
    heat: 0,
    emotion: 0,
    signals: {},
  });
  const [facilitatorHistory, setFacilitatorHistory] = useState([]);
  const [facilitatorTyping, setFacilitatorTyping] = useState(false);
  const [interpreterData, setInterpreterData] = useState({});

  const [cooldown, setCooldown] = useState({
    sessionId: DEFAULT_SESSION_ID,
    cooldownMs: 0,
    elapsed: 0,
    remaining: 0,
    remainingMs: 0,
    ready: true,
  });

  useEffect(() => {
    if (!socket) return;

    const onInit = (payload = {}) => {
      setMessages(payload.messages || []);
      setMemberCount(payload.memberCount || 1);
    };

    const onUpdate = (msgs = []) => setMessages(msgs);

    const onNewMsg = (msg = {}) =>
      msg && setMessages((prev) => [...prev, msg]);

    const onCooldown = (payload = {}) => {
      setCooldown((prev) => ({ ...prev, ...payload }));
      setFacilitatorTyping(false);
    };

    const onFocus = (payload = {}) =>
      setFocusedMessageId(payload.messageId || null);

    const onTyping = (payload = {}) => {
      setFacilitatorTyping(!!payload.typing);
    };

    const onStateUpdate = (payload = {}) => {
      const snapshot = {
        heat: payload.heat ?? 0,
        emotion: payload.emotionalTemp ?? 0,
        signals: payload.signals || {},
      };
      setFacilitatorState(snapshot);
      setFacilitatorHistory((prev) => [...prev.slice(-59), snapshot]);
    };

    socket.on("threadInit", onInit);
    socket.on("threadUpdate", onUpdate);
    socket.on("newMessage", onNewMsg);
    socket.on("cooldownUpdate", onCooldown);
    socket.on("interpreterFocus", onFocus);
    socket.on("facilitatorTyping", onTyping);
    socket.on("stateUpdate", onStateUpdate);

    return () => {
      socket.off("threadInit", onInit);
      socket.off("threadUpdate", onUpdate);
      socket.off("newMessage", onNewMsg);
      socket.off("cooldownUpdate", onCooldown);
      socket.off("interpreterFocus", onFocus);
      socket.off("facilitatorTyping", onTyping);
      socket.off("stateUpdate", onStateUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handleInterpreter = (payload = {}) => {
      setInterpreterData(payload);
    };

    socket.on("interpreterUpdate", handleInterpreter);

    return () => socket.off("interpreterUpdate", handleInterpreter);
  }, [socket]);

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

  const lastHumanMessage =
    [...messages].reverse().find((m) => m.authorType === "human")?.text || "";

  return (
    <div style={styles.page}>

      <aside
        style={{
          width: "260px",
          flexShrink: 0,
          padding: "0.75rem",
          boxSizing: "border-box",
        }}
      >
        <InterpreterPanel
          cooldown={cooldown}
          state={facilitatorState}
          history={facilitatorHistory}
        />
      </aside>

      <main style={styles.rightColumn}>
        <div style={styles.headerStack}>
          <ThreadHeader memberCount={memberCount} />
          <FocusMessageBar focusedMessageId={focusedMessageId} />
        </div>

        <EmotionalOverlay
          state={facilitatorState}
          interpreter={interpreterData}
          lastMessage={lastHumanMessage}
        />

        <div style={styles.overlaySpacer}>
          <ParticipantOverlay state={facilitatorState} />
        </div>

        <MessageList
          messages={messages}
          focusedMessageId={focusedMessageId}
          facilitatorTyping={facilitatorTyping}
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

function ThreadHeader({ memberCount }) {
  return (
    <HeaderWrap>
      <Title>AmplifyEd Thread Simulator</Title>

      <Presence>
        <PresenceIcon>👥</PresenceIcon>
        <PresenceText>{memberCount}</PresenceText>
      </Presence>
    </HeaderWrap>
  );
}

const styles = {
  page: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "1.5rem",
    height: "100vh",
    padding: "1.5rem 1.75rem",
    boxSizing: "border-box",
    background: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },

  rightColumn: {
    background: "#ffffff",
    borderRadius: 16,
    padding: "1.25rem 1.75rem 1.5rem",
    boxShadow: "0 8px 32px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
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

  headerStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    marginBottom: "0.75rem",
  },

  inputRow: {
    marginTop: "0.85rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid #e2e8f0",
  },
  overlaySpacer: {
    position: "relative",
    marginBottom: "0.5rem",
    minHeight: 0,
    paddingTop: 0,
  },
};
