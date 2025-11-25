// thread-simulator/src/components/thread/MessageBubble.jsx
import React, { useEffect } from "react";
import AvatarRenderer from "./AvatarRenderer.jsx";
import styles from "./styles/messageBubble.styles.js";

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessageBubble({
  msg,
  isFocused,
  isDimmed,
  isStacked,
  isLast,
  lastMessageRef,
}) {
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
  const displayName = isFacilitator ? "Facilitator" : "Participant";
  const roleStyles = isFacilitator ? styles.facilitator : styles.user;
  const complexity = Number(msg?.__complexity || 0);
  const isHighComplexity = complexity >= 0.65;
  const shouldHighlightNext = Boolean(msg?.__lookHereNext);

  useEffect(() => {
    if (!isLast || !lastMessageRef?.current) return;
    const el = lastMessageRef.current;
    el.classList.remove("msg-bounce");
    void el.offsetWidth;
    el.classList.add("msg-bounce");
  }, [isLast, msg, lastMessageRef]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.row}>
        <AvatarRenderer role={msg.role} />

        <div style={{ position: "relative", width: "100%" }}>
          {shouldHighlightNext && <div style={styles.scanlineOverlay} />}

          <div
            ref={isLast ? lastMessageRef : null}
            className={`message-bubble${isFocused ? " focused focus-anim" : ""}${
              isDimmed ? " dimmed" : ""
            }`}
            style={{
              ...styles.bubble,
              ...roleStyles,
              ...(isFocused ? { ...styles.focused, ...styles.focusAnim } : {}),
              ...(isDimmed ? styles.dimmed : {}),
              ...(isStacked ? styles.stacked : {}),
              ...(isHighComplexity ? styles.complexityGlow : {}),
              ...(shouldHighlightNext ? styles.nextFocusGlow : {}),
            }}
          >
            {isHighComplexity && (
              <span style={styles.complexityBadge} title="High cognitive load">
                🧠
              </span>
            )}
            <div style={styles.header}>
              <div style={styles.name}>{displayName}</div>
              <div style={styles.timestamp}>{formatTime(msg.ts)}</div>
            </div>

            <div style={styles.text}>{safeText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


if (typeof document !== "undefined") {
  if (!document.getElementById("message-bounce-keyframes")) {
    const styleEl = document.createElement("style");
    styleEl.id = "message-bounce-keyframes";
    styleEl.textContent = `
@keyframes msgBounce {
  0% { transform: scale(1); }
  40% { transform: scale(1.03); }
  100% { transform: scale(1); }
}
.msg-bounce {
  animation: msgBounce 260ms ease-out;
}
.message-bubble.focus-anim {
  animation: focus-pop 140ms cubic-bezier(0.25, 0.9, 0.3, 1.2);
}
@keyframes focus-pop {
  0% { transform: scale(0.97); }
  70% { transform: scale(1.015); }
  100% { transform: scale(1); }
}
.message-bubble.dimmed {
  opacity: 0.4;
  filter: blur(0.2px);
}
.message-bubble.focused {
  opacity: 1 !important;
  filter: none !important;
}
    `;
    document.head.appendChild(styleEl);
  }
}
