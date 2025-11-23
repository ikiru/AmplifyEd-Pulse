import React from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function MessageList({ messages = [], focusedMessageId }) {
  return (
    <div style={styles.wrapper}>
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          isFocused={msg.id === focusedMessageId}
        />
      ))}
    </div>
  );
}


// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = {
  wrapper: {
    flex: 1,
    overflowY: "auto",
    padding: "0.5rem 0.25rem 0.5rem 0",
    display: "flex",
    flexDirection: "column",
    gap: "0.65rem",
  },
};
