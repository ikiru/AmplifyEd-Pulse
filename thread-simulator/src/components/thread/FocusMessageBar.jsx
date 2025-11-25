import React from "react";

const styles = {
  bar: {
    padding: "0.45rem 0.75rem",
    background: "#fefce8",
    border: "1px solid #fcd34d",
    borderRadius: 10,
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#92400e",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: "36px",
  },
};

export default function FocusMessageBar({ focusedMessageId }) {
  if (!focusedMessageId) {
    return <div style={styles.bar}>No active focus</div>;
  }

  return <div style={styles.bar}>Focusing message {focusedMessageId}</div>;
}
