// public/backstage.js
/* global io */

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const urlInput = document.getElementById("slides-url-input");
  const saveBtn = document.getElementById("slides-url-save");
  const statusEl = document.getElementById("slides-url-status");
  const focusInput = document.getElementById("stage-focus-input");
  const focusSaveBtn = document.getElementById("stage-focus-save");
  const focusStatus = document.getElementById("stage-focus-status");

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

  socket.on("stageFocusUpdate", (payload) => {
    const focus = (payload && payload.focus) || "";
    if (focusInput) {
      focusInput.value = focus;
    }
    if (focusStatus) {
      focusStatus.textContent = focus
        ? "Stage focus is live on the Stage view."
        : "Stage focus is not set yet.";
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

  if (focusSaveBtn && focusInput) {
    focusSaveBtn.addEventListener("click", () => {
      const focus = focusInput.value.trim();
      socket.emit("setStageFocus", { focus });
      if (focusStatus) {
        focusStatus.textContent = focus
          ? "Sent focus to the stage."
          : "Cleared the focus text.";
      }
    });
  }
});
