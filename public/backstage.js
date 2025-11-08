// public/backstage.js
/* global io */

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const urlInput = document.getElementById("slides-url-input");
  const saveBtn = document.getElementById("slides-url-save");
  const statusEl = document.getElementById("slides-url-status");

  socket.on("connect", () => {
    // Mark this as a backstage client (not required, but nice to track roles)
    socket.emit("registerRole", "backstage");
  });

  // When server tells us the current deck URL, populate the input
  socket.on("slideEmbedConfig", (payload) => {
    const url = (payload && payload.url) || "";
    if (urlInput) {
      urlInput.value = url;
    }
    if (statusEl) {
      statusEl.textContent = url
        ? "Deck URL is active and sent to Stage."
        : "No deck URL configured yet.";
    }
  });

  if (saveBtn && urlInput) {
    saveBtn.addEventListener("click", () => {
      const url = urlInput.value.trim();
      socket.emit("setSlideEmbedUrl", { url });

      if (statusEl) {
        statusEl.textContent = url
          ? "Updated deck URL. Stage will refresh the embedded slides."
          : "Cleared deck URL. Stage slides view will show a placeholder.";
      }
    });
  }
});
