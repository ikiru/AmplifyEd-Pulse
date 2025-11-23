// thread-simulator/src/components/thread/MessageBubble.jsx
import React from "react";

export default function MessageBubble({ msg, isFocused }) {
  // Normalize text to something renderable
  let safeText;

  if (msg == null) {
    safeText = "";
  } else if (typeof msg.text === "string" || typeof msg.text === "number") {
    safeText = msg.text;
  } else if (msg.text == null) {
    safeText = "";
  } else {
    // Fallback: stringify any object safely
    safeText = JSON.stringify(msg.text, null, 2);
  }

  const isFacilitator = msg.role === "facilitator";

  return (
    <div
      style={{
        ...styles.bubble,
        ...(isFacilitator ? styles.facilitator : styles.user),
        ...(isFocused ? styles.focused : {}),
      }}
    >
      <span style={styles.author}>
        {isFacilitator ? "Facilitator" : "User"}:
      </span>{" "}
      {safeText}
    </div>
  );
}

const styles = {
  bubble: {
    padding: "0.85rem 1rem",
    borderRadius: 10,
    fontSize: "0.95rem",
    lineHeight: 1.45,
    maxWidth: "92%",
    border: "1px solid transparent",
    transition: "all 180ms ease",
  },
  user: {
    background: "#eef2ff",
    alignSelf: "flex-start",
  },
  facilitator: {
    background: "#f5f3ff",
    alignSelf: "flex-start",
  },
  focused: {
    border: "2px solid #f59e0b",
    background: "#fff7ed",
  },
  author: {
    fontWeight: 600,
  },
};
