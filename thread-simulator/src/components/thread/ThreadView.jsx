import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import InterpreterPanel from "./InterpreterPanel";

export default function ThreadView() {
  const socket = useSocket();

  // UI state
  const [messages, setMessages] = useState([]);
  const [memberCount, setMemberCount] = useState(1);
  const [cooldown, setCooldown] = useState({
    remainingMs: 0,
    ready: true
  });

  // NEW: highlighted message from interpreter
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // ---------------------------------------------------------------------------
  // Socket listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleInit = (payload) => {
      setMessages(payload.messages || []);
    };

    const handleThreadUpdate = (msgs) => {
      setMessages(msgs || []);
    };

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handlePresence = (payload) => {
      setMemberCount(payload.memberCount || 1);
    };

    const handleCooldown = (payload) => {
      const r = payload.remainingMs ?? 0;
      setCooldown({ remainingMs: r, ready: r <= 0 });
    };

    // NEW: interpreter highlight
    const handleInterpreterFocus = ({ messageId }) => {
      console.log("highlight message", messageId);
      setHighlightedMessageId(messageId);
    };

    // Register listeners
    socket.on("threadInit", handleInit);
    socket.on("threadUpdate", handleThreadUpdate);
    socket.on("newMessage", handleNewMessage);
    socket.on("presenceUpdate", handlePresence);
    socket.on("cooldownUpdate", handleCooldown);

    socket.on("interpreterFocus", handleInterpreterFocus);

    // Cleanup
    return () => {
      socket.off("threadInit", handleInit);
      socket.off("threadUpdate", handleThreadUpdate);
      socket.off("newMessage", handleNewMessage);
      socket.off("presenceUpdate", handlePresence);
      socket.off("cooldownUpdate", handleCooldown);

      socket.off("interpreterFocus", handleInterpreterFocus);
    };
  }, [socket]);

  // ---------------------------------------------------------------------------
  // Send user message
  // ---------------------------------------------------------------------------
  const sendUserMessage = (text) => {
    if (!socket || !text.trim()) return;

    socket.emit("humanMessage", {
      sessionId: "demo-1",
      userId: "User",
      role: "teacher",
      authorType: "human",
      text
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.container}>
      <div style={styles.layout}>
        
        {/* LEFT PANEL: Interpreter */}
        <InterpreterPanel cooldown={cooldown} />

        {/* RIGHT PANEL: Thread */}
        <div style={styles.threadArea}>
          <div style={styles.header}>
            AmplifyEd Thread Simulator
            <div style={styles.presence}>👥 {memberCount}</div>
          </div>

          <MessageList 
            messages={messages}
            highlightedMessageId={highlightedMessageId}
          />

          <MessageInput onSend={sendUserMessage} cooldown={cooldown} />
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = {
  container: {
    padding: "2rem",
    width: "100%",
  },
  layout: {
    display: "flex",
    gap: "2rem",
  },
  threadArea: {
    flex: 1,
  },
  header: {
    fontSize: "1.75rem",
    fontWeight: 600,
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  presence: {
    fontSize: "1rem",
    opacity: 0.5,
  },
};

