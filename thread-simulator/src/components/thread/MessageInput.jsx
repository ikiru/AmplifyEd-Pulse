// thread-simulator/src/components/thread/MessageInput.jsx
import React, { useState } from "react";
import { Container, TextInput, SendButton } from "./styles/messageInput.styles.js";

export default function MessageInput({ onSend, disabled, placeholder = "Type your message…" }) {
  const [text, setText] = useState("");

  const triggerSend = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      triggerSend();
    }
  };

  return (
    <Container>
      <TextInput
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />

      <SendButton onClick={triggerSend} disabled={disabled || !text.trim()}>
        Send
      </SendButton>
    </Container>
  );
}


