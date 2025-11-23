// src/App.jsx
import React from "react";
import ThreadView from "./components/thread/ThreadView.jsx";

export default function App() {
  return (
    <div style={styles.app}>
      <ThreadView />
    </div>
  );
}

const styles = {
  app: {
    padding: "20px",
    fontFamily: "system-ui, sans-serif",
  },
};
