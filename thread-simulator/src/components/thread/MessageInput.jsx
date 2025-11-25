// thread-simulator/src/components/thread/MessageInput.jsx
import React, { useState } from "react";
import {
  Container,
  TextInput,
  SendButton,
} from "./styles/messageInput.styles.js";

export default function MessageInput({
  onSend,
  disabled,
  placeholder = "Type your message…",
}) {
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
    <Container aria-label="Message input area">
      <TextInput
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-disabled={disabled}
      />

      <SendButton
        onClick={triggerSend}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        Send
      </SendButton>
    </Container>
  );
}
