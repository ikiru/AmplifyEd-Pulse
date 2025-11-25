import React from "react";

export default function AvatarRenderer({ role }) {
  // Facilitator = purple tone (#6D28D9)
  // Participant = blue tone (#2563EB)

  if (role === "facilitator") {
    return (
      <div style={styles.wrapper}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#6D28D9">
          <circle cx="12" cy="12" r="10" opacity="0.15" />
          <circle cx="12" cy="10" r="4" />
          <path d="M6 18c1.5-3 4-4 6-4s4.5 1 6 4" fill="#6D28D9" />
        </svg>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#2563EB">
        <circle cx="12" cy="12" r="10" opacity="0.15" />
        <circle cx="12" cy="8" r="4" />
        <path d="M6 19c1.5-3.5 4-5 6-5s4.5 1.5 6 5" fill="#2563EB" />
      </svg>
    </div>
  );
}

const styles = {
  wrapper: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#F3F4F6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    flexShrink: 0,
  },
};
