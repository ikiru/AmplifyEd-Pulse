// src/components/thread/MessageInput.jsx
import React, { useState } from "react";

export default function MessageInput({ onSend, cooldown }) {
  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!text.trim() || (cooldown && !cooldown.ready)) {
      return;
    }

    onSend(text);
    setText("");
  };

  const disabled = cooldown && !cooldown.ready;

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        value={text}
        placeholder={
          disabled
            ? `Cooling down… (${Math.ceil(cooldown.remainingMs / 1000)}s)`
            : "Type a message..."
        }
        onChange={(e) => setText(e.target.value)}
        style={{
          ...styles.input,
          background: disabled ? "#f5f5f5" : "white",
        }}
        disabled={disabled}
      />
      <button
        type="submit"
        style={{
          ...styles.button,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        disabled={disabled}
      >
        Send
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    marginTop: "1rem",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    border: "1px solid #ccc",
    borderRadius: "6px",
  },
  button: {
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    background: "#4f46e5",
    color: "white",
    border: "none",
    borderRadius: "6px",
  },
};

