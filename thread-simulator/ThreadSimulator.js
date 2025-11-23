// thread-simulator/ThreadSimulator.js

import { EngineController } from "./engineController.js";
// src/components/thread/ThreadSimulator.jsx
import React, { useEffect, useState } from "react";
import { useSocketHandlers } from "../../hooks/useSocket";
import MessageList from "./MessageList";

export default function ThreadSimulator() {
  const [messages, setMessages] = useState([]);
  const [focusedMessageId, setFocusedMessageId] = useState(null);

  const { sendUserMessage, socket } = useSocketHandlers(setMessages);

  useEffect(() => {
    if (!socket) return;

    socket.on("interpreterFocus", ({ messageId }) => {
      setFocusedMessageId(messageId);

      // auto-clear after 4 seconds
      setTimeout(() => setFocusedMessageId(null), 4000);
    });

    return () => {
      socket.off("interpreterFocus");
    };
  }, [socket]);

  return (
    <div>
      <MessageList messages={messages} focusedMessageId={focusedMessageId} />
      {/* rest of your UI */}
    </div>
  );
}


export class ThreadSimulator {
  constructor({ openai, model }) {
    this.engine = new EngineController({ openai, model });

    // Register engine event listeners
    this.engine.on("interpretation", (interp) => {
      this.updateDebugPanel(interp);
    });

    this.engine.on("intervention", (botMsg) => {
      this.renderFacilitatorMessage(botMsg);
    });

    this.engine.on("timeline", (entry) => {
      this.updateTimeline(entry);
    });
  }

  // User sends a message
  async userSend(text) {
    this.renderUserMessage(text);
    await this.engine.handleUserMessage(text);
  }

  // ---------------------------
  // Rendering hooks (UI will implement)
  // ---------------------------
  renderUserMessage(text) {
    console.log("[UI] user:", text);
  }

  renderFacilitatorMessage(msg) {
    console.log("[UI] facilitator:", msg.text);
  }

  updateDebugPanel(interp) {
    console.log("[debug]", interp);
  }

  updateTimeline(entry) {
    console.log("[timeline]", entry);
  }
}
