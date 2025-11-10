// public/stage.js
/* global Chart, io, QRCode */

let pulseData = Array(60).fill(0); // 60 points of history
let pulseChart = null;

function getPulseColor(value) {
  if (value > 0.3) return "#00ff99";
  if (value < -0.3) return "#ff4d4d";
  return "#8fb4d9";
}

let socket;

function loadSocketIoClient() {
  if (window.io) {
    return Promise.resolve(window.io);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";
    script.onload = () => resolve(window.io);
    script.onerror = () => reject(new Error("Unable to load Socket.IO"));
    document.head.appendChild(script);
  });
}

function initPulseChart() {
  const canvas = document.getElementById("livePulseChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");

  pulseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: pulseData.map((_, idx) => idx),
      datasets: [
        {
          data: pulseData,
          borderColor: getPulseColor(0),
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      animation: { duration: 0 },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: {
          min: -1,
          max: 1,
          grid: {
            color: "rgba(255, 255, 255, 0.08)",
          },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      elements: {
        line: {
          borderCapStyle: "round",
          borderJoinStyle: "round",
        },
      },
    },
  });
}

function updateSessionCodeUI(sessionCode) {
  const codeValue = document.getElementById("session-code-value");
  if (!codeValue) {
    console.warn("[Stage] #session-code-value not found in DOM");
    return;
  }
  codeValue.textContent = sessionCode;
  const fallback = document.getElementById("session-code-display");
  if (fallback) {
    fallback.textContent = sessionCode;
  }
}

function renderSessionQr(sessionCode) {
  const qrContainer = document.getElementById("session-qr");
  if (!qrContainer) {
    console.warn("[Stage] #session-qr not found in DOM");
    return;
  }
  if (typeof QRCode === "undefined") {
    console.warn("[Stage] QRCode library not loaded");
    return;
  }

  const joinUrl = `${window.location.origin}/audience.html?code=${encodeURIComponent(sessionCode)}`;
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: joinUrl,
    width: 160,
    height: 160,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initStage().catch((error) => {
    alert(error.message);
  });
});

async function initStage() {
  const debugBar = document.createElement("div");
  debugBar.id = "debug-bar";
  debugBar.style.position = "fixed";
  debugBar.style.left = "8px";
  debugBar.style.bottom = "8px";
  debugBar.style.padding = "4px 8px";
  debugBar.style.borderRadius = "6px";
  debugBar.style.fontSize = "10px";
  debugBar.style.background = "rgba(15,23,42,0.9)";
  debugBar.style.color = "#e5e7eb";
  debugBar.style.zIndex = "9999";
  debugBar.style.opacity = "0.7";
  debugBar.textContent = "Creating session...";
  document.body.appendChild(debugBar);

  initPulseChart();

  await loadSocketIoClient();
  socket = window.socket || window.io();
  window.socket = socket;

  let currentSessionCode = null;

// log socket lifecycle
  console.log("[Stage] Socket connecting...");
  socket.on("connect", () => {
    console.log("[Stage] Connected as", socket.id, "– requesting session code…");
    socket.emit("registerRole", "stage");
    socket.emit("stage:requestSession");
  });

  socket.on("connect_error", (err) => {
    console.error("[Stage] Socket connection failed:", err);
  });

  socket.on("stage:sessionInfo", (payload) => {
    console.log("[Stage] Received stage:sessionInfo:", payload);
    if (!payload?.code) {
      console.warn("[Stage] stage:sessionInfo missing code");
      return;
    }
    currentSessionCode = payload.code;
    updateSessionCodeUI(currentSessionCode);
    renderSessionQr(currentSessionCode);
    debugBar.textContent = `Session ready — code ${currentSessionCode}`;
  });

  const participantCountEl = document.getElementById("stage-participantcount") || document.getElementById("stage-participant-count");
  const updateParticipantCount = (count) => {
    if (!participantCountEl) return;
    participantCountEl.textContent = `${count} participant${count === 1 ? "" : "s"}`;
  };
  socket.on("host:participantJoined", ({ count }) => updateParticipantCount(count));
  socket.on("host:participantLeft", ({ count }) => updateParticipantCount(count));
  socket.on("participantCount", ({ count }) => updateParticipantCount(count));
  socket.on("session:ended", () => {
    debugBar.textContent = "Session ended — refresh to start a new one.";
  });

  const stageDiscussionFeed = document.getElementById("stage-discussion-feed");
  const discussionPosts = new Map();

  const pulseValueEl = document.getElementById("stage-pulse-value");
  const roomMoodEl = document.getElementById("roomMood");

  function updatePulseLine(value) {
    if (!pulseChart) return;
    pulseData.push(value);
    pulseData.shift();
    pulseChart.data.datasets[0].data = [...pulseData];
    pulseChart.data.datasets[0].borderColor = getPulseColor(value);
    pulseChart.update("none");
  }

  function updateRoomMood(pulse) {
    if (!roomMoodEl) return;

    roomMoodEl.className = "room-mood";
    if (pulse > 0.6) {
      roomMoodEl.textContent = "It’s getting hot in here!";
      roomMoodEl.classList.add("positive");
    } else if (pulse > 0.3) {
      roomMoodEl.textContent = "You’ve got their attention.";
      roomMoodEl.classList.add("positive");
    } else if (pulse > -0.3) {
      roomMoodEl.textContent = "Room’s in think mode.";
      roomMoodEl.classList.add("neutral");
    } else if (pulse > -0.6) {
      roomMoodEl.textContent = "They’re processing… maybe coffee?";
      roomMoodEl.classList.add("negative");
    } else {
      roomMoodEl.textContent = "Temperature’s dropping.";
      roomMoodEl.classList.add("negative");
    }
  }

  const applyHeatClass = (card, score) => {
    if (!card) return;
    const heatClasses = [
      "heat-up-1",
      "heat-up-2",
      "heat-up-3",
      "heat-down-1",
      "heat-down-2",
      "heat-down-3",
    ];
    card.classList.remove(...heatClasses);

    const absScore = Math.abs(score || 0);
    if (score > 0) {
      if (absScore >= 5) {
        card.classList.add("heat-up-3");
      } else if (absScore >= 3) {
        card.classList.add("heat-up-2");
      } else if (absScore >= 1) {
        card.classList.add("heat-up-1");
      }
    } else if (score < 0) {
      if (absScore >= 5) {
        card.classList.add("heat-down-3");
      } else if (absScore >= 3) {
        card.classList.add("heat-down-2");
      } else if (absScore >= 1) {
        card.classList.add("heat-down-1");
      }
    }
  };

  const ensureRepliesContainer = (parentId) => {
    if (!parentId) return stageDiscussionFeed;
    const parentCard = document.querySelector(`.discussion-message[data-post-id="${parentId}"]`);
    if (!parentCard) return stageDiscussionFeed;
    let replies = parentCard.querySelector(".discussion-replies");
    if (!replies) {
      replies = document.createElement("div");
      replies.className = "discussion-replies";
      parentCard.appendChild(replies);
    }
    return replies;
  };

  const appendDiscussionMessage = (container, msg) => {
    if (!container || !msg?.id) return;
    if (document.querySelector(`.discussion-message[data-post-id="${msg.id}"]`)) {
      return;
    }

    const scoreValue = typeof msg.score === "number" ? msg.score : 0;
    const authorLabel =
      msg.authorName || (msg.authorType === "host" ? "Facilitator" : "Participant");

    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    const card = document.createElement("article");
    card.className = "discussion-message";
    if (msg.id) {
      card.dataset.postId = msg.id;
    }

    const textEl = document.createElement("div");
    textEl.className = "discussion-text";
    textEl.textContent = msg.text;

    const footer = document.createElement("div");
    footer.className = "discussion-footer";

    const meta = document.createElement("div");
    meta.className = "discussion-meta";
    meta.textContent = time ? `${authorLabel} • ${time}` : authorLabel;

    const controls = document.createElement("div");
    controls.className = "discussion-controls";

    const flame = document.createElement("span");
    flame.className = "discussion-flame";
    flame.textContent = "🔥";

    const scoreEl = document.createElement("span");
    scoreEl.className = "discussion-score";
    scoreEl.textContent = String(scoreValue);

    const up = document.createElement("button");
    up.className = "vote-button vote-up";
    up.type = "button";
    up.textContent = "👍";

    const down = document.createElement("button");
    down.className = "vote-button vote-down";
    down.type = "button";
    down.textContent = "👎";

    controls.appendChild(flame);
    controls.appendChild(scoreEl);
    controls.appendChild(up);
    controls.appendChild(down);

    footer.appendChild(meta);
    footer.appendChild(controls);

    const repliesWrapper = document.createElement("div");
    repliesWrapper.className = "discussion-replies";

    card.appendChild(textEl);
    card.appendChild(footer);
    card.appendChild(repliesWrapper);

    const targetContainer = msg.parentId ? ensureRepliesContainer(msg.parentId) : container;
    if (!targetContainer) return;
    if (msg.parentId) {
      card.classList.add("discussion-reply-card");
    }
    targetContainer.appendChild(card);
    container.scrollTop = container.scrollHeight;

    applyHeatClass(card, msg.score);
  };

  socket.on("discussion:initialState", (history) => {
    discussionPosts.clear();
    if (stageDiscussionFeed) {
      stageDiscussionFeed.innerHTML = "";
    }

    if (!Array.isArray(history)) return;

    history.forEach((msg) => {
      if (!msg?.id) return;
      discussionPosts.set(msg.id, msg);
      appendDiscussionMessage(stageDiscussionFeed, msg);
    });
  });

  socket.on("discussion:messageAdded", (msg) => {
    if (!msg?.id) return;
    discussionPosts.set(msg.id, msg);
    appendDiscussionMessage(stageDiscussionFeed, msg);
  });

  socket.on("discussion:scoreUpdated", ({ id, score }) => {
    const post = discussionPosts.get(id);
    if (post) {
      post.score = score;
    }

    const card = document.querySelector(`.discussion-message[data-post-id="${id}"]`);
    if (!card) return;

    const scoreEl = card.querySelector(".discussion-score");
    if (scoreEl) {
      scoreEl.textContent = String(score);
    }

    applyHeatClass(card, score);
  });

  socket.on("pulseData", ({ currentPulse }) => {
    const pulseValue = Number.isFinite(currentPulse) ? currentPulse : 0;
    updateRoomMood(pulseValue);
    updatePulseLine(pulseValue);
  });

  socket.on("pulseBreakdown", (counts) => {
    updatePulseLegend(counts);
  });

  VideoModule.init(socket, debugBar);
  PulseModule.init(socket, debugBar);
  DiscussionModule.init(socket, debugBar);
}

const VideoModule =
  window.VideoModule ||
  (() => ({
    init() {
      console.log("[Stage] VideoModule placeholder initialized");
    },
  }))();

const PulseModule =
  window.PulseModule ||
  (() => ({
    init() {
      console.log("[Stage] PulseModule placeholder initialized");
    },
  }))();

const DiscussionModule =
  window.DiscussionModule ||
  (() => ({
    init() {
      console.log("[Stage] DiscussionModule placeholder initialized");
    },
  }))();

/* Modules omitted for brevity (VideoModule, PulseModule, DiscussionModule remain unchanged) */
