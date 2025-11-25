import React, { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";
import { computeComplexityScore } from "../../utils/complexity.js";
import { computeNextFocusTarget } from "../../utils/focusNext.js";

export default function MessageList({
  messages = [],
  focusedMessageId,
  facilitatorTyping,
}) {
  const listRef = useRef(null);
  const lastMessageRef = useRef(null);

  const enrichedMessages = messages.map((msg) => ({
    ...msg,
    __complexity: computeComplexityScore(msg?.text || ""),
  }));

  const nextFocusId = computeNextFocusTarget(enrichedMessages);

  const fullyEnrichedMessages = enrichedMessages.map((msg) => ({
    ...msg,
    __lookHereNext: msg.id === nextFocusId,
  }));

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div ref={listRef} style={styles.wrapper}>
      {fullyEnrichedMessages.map((msg, index) => {
        const isLast = index === fullyEnrichedMessages.length - 1;
        return (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isFocused={msg.id === focusedMessageId}
            isDimmed={Boolean(
              focusedMessageId && msg.id !== focusedMessageId
            )}
            isStacked={index > 0}
            isLast={isLast}
            lastMessageRef={isLast ? lastMessageRef : null}
          />
        );
      })}

      {facilitatorTyping && (
        <div style={styles.typingWrapper}>
          <div style={styles.typingDot}></div>
          <div style={styles.typingDot}></div>
          <div style={styles.typingDot}></div>
        </div>
      )}
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
    padding: "0.25rem 0 0.75rem 0",
    paddingLeft: "0.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    scrollBehavior: "smooth",
    WebkitOverflowScrolling: "touch",
  },

  typingWrapper: {
    display: "flex",
    gap: 6,
    padding: "0.4rem 0.5rem",
    alignSelf: "flex-start",
    marginTop: "0.25rem",
    marginLeft: "0.5rem",
  },

  typingDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#a78bfa",
    animation: "typingPulse 1.2s infinite ease-in-out",
  },
};

if (typeof document !== "undefined" && !document.getElementById("typing-pulse-keyframes")) {
  const styleEl = document.createElement("style");
  styleEl.id = "typing-pulse-keyframes";
  styleEl.textContent = `
@keyframes typingPulse {
  0% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
  100% { opacity: 0.3; transform: translateY(0); }
}
  `;
  document.head.appendChild(styleEl);
}
