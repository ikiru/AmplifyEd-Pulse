// src/components/thread/MessageList.jsx
import React, { useEffect, useRef } from "react";

export default function MessageList({ messages = [], highlightedMessageId }) {
  const bottomRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div style={styles.wrapper}>
      {messages.map((msg) => {
        const isHighlighted = msg.id === highlightedMessageId;

        return (
          <div
            key={msg.id}
            style={{
              ...styles.bubble,
              ...(msg.authorType === "bot" ? styles.bot : styles.human),
              ...(isHighlighted ? styles.highlight : {}),
            }}
          >
            <strong>{msg.authorType === "bot" ? "Facilitator" : msg.userId}:</strong>{" "}
            {msg.text}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

const styles = {
  wrapper: {
    padding: "1rem",
    border: "1px solid #ddd",
    borderRadius: "8px",
    height: "60vh",
    overflowY: "auto",
    background: "#fafafa",
  },
  bubble: {
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    marginBottom: "0.5rem",
    maxWidth: "85%",
    lineHeight: 1.4,
    fontSize: "0.9rem",
    transition: "all 0.3s ease",
  },
  human: {
    background: "#e8f0ff",
    alignSelf: "flex-start",
  },
  bot: {
    background: "#f1e8ff",
    alignSelf: "flex-end",
  },
  highlight: {
    border: "3px solid #ffbf47",
    boxShadow: "0 0 10px rgba(255,191,71,0.6)",
  },
};

