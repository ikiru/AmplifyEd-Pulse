// public/stage.js
/* global Chart, io */

document.addEventListener("DOMContentLoaded", () => {
  initStage().catch((error) => {
    alert(error.message);
  });
});

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

async function initStage() {
  const sessionCodeDisplay = document.getElementById("session-code-display");
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

  await loadSocketIoClient();
  const socket = window.io();
  socket.on("connect", () => {
    socket.emit("registerRole", "stage");
    socket.emit("host:createSession");
  });

  socket.on("host:sessionCreated", ({ code }) => {
    debugBar.textContent = `Session ready · code ${code}`;
    if (sessionCodeDisplay) {
      sessionCodeDisplay.textContent = code;
    }
  });

  const participantCountEl = document.getElementById("stage-participant-count");
  const updateParticipantCount = (count) => {
    if (!participantCountEl) return;
    participantCountEl.textContent = `${count} participant${count === 1 ? "" : "s"}`;
  };
  socket.on("host:participantJoined", ({ count }) => updateParticipantCount(count));
  socket.on("host:participantLeft", ({ count }) => updateParticipantCount(count));
  socket.on("session:ended", () => {
    debugBar.textContent = "Session ended — refresh to start a new one.";
  });

  const stageDiscussionFeed = document.getElementById("stage-discussion-feed");
  const discussionPosts = new Map();
  const appendDiscussionMessage = (container, msg) => {
    if (!container) return;
    if (msg?.id) {
      if (container.querySelector(`.discussion-message[data-post-id="${msg.id}"]`)) {
        return;
      }
    }

    const scoreValue = typeof msg.score === "number" ? msg.score : 0;
    const role = msg.authorType === "host" ? "FACILITATOR" : "PARTICIPANT";

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
    meta.textContent = time ? `${role} • ${time}` : role;

    const controls = document.createElement("div");
    controls.className = "discussion-controls";

    const flame = document.createElement("span");
    flame.className = "discussion-flame";
    flame.textContent = "🔥";

    const score = document.createElement("span");
    score.className = "discussion-score";
    score.textContent = String(scoreValue);

    const up = document.createElement("button");
    up.className = "vote-button vote-up";
    up.type = "button";
    up.textContent = "👍";

    const down = document.createElement("button");
    down.className = "vote-button vote-down";
    down.type = "button";
    down.textContent = "👎";

    controls.appendChild(flame);
    controls.appendChild(score);
    controls.appendChild(up);
    controls.appendChild(down);

    footer.appendChild(meta);
    footer.appendChild(controls);

    card.appendChild(textEl);
    card.appendChild(footer);
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;

    if (typeof voteOnPost === "function" && msg.id) {
      up.addEventListener("click", () => voteOnPost(msg.id, 1));
      down.addEventListener("click", () => voteOnPost(msg.id, -1));
    }
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
    if (msg?.id) {
      discussionPosts.set(msg.id, msg);
    }
    appendDiscussionMessage(stageDiscussionFeed, msg);
  });

  function applyHeatClass(card, score) {
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
  }

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

  VideoModule.init(socket, debugBar);
  PulseModule.init(socket, debugBar);
  DiscussionModule.init(socket, debugBar);
}

const VideoModule = (() => {
  const root = document.getElementById("stage-video-inner");
  const videoEl = document.getElementById("stage-camera");
  const cameraStatus = document.getElementById("camera-status");
  const btnCamera = document.getElementById("btn-show-camera");
  const btnSlides = document.getElementById("btn-show-slides");
  const slidesIframe = document.getElementById("slides-iframe");
  const slidesPlaceholder = document.getElementById("slides-placeholder");
  const slidesIndicator = document.getElementById("slides-indicator");
  const focusTextEl = document.getElementById("stage-focus-text");

  if (!root || !videoEl) {
    return {
      init: () => {},
    };
  }

  let mediaStream = null;

  function showView(view) {
    if (!root) return;
    if (view === "camera") {
      root.classList.remove("slides-mode");
      root.classList.add("camera-mode");
      btnCamera?.classList.add("active");
      btnSlides?.classList.remove("active");
    } else {
      root.classList.remove("camera-mode");
      root.classList.add("slides-mode");
      btnSlides?.classList.add("active");
      btnCamera?.classList.remove("active");
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = "Camera not supported in this browser.";
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoEl.srcObject = mediaStream;
      cameraStatus.textContent = "Camera live";
    } catch (err) {
      console.error("Camera error:", err);
      cameraStatus.textContent = "Unable to access camera.";
    }
  }

  function applySlideConfig(url) {
    const hasUrl = !!url;
    if (slidesIframe) {
      slidesIframe.style.display = hasUrl ? "block" : "none";
      slidesIframe.src = hasUrl ? url : "";
    }
    slidesPlaceholder.style?.setProperty("display", hasUrl ? "none" : "flex");
    slidesIndicator.textContent = hasUrl ? "Deck connected" : "No deck connected";
  }

  function updateStageFocus(focus) {
    focusTextEl.textContent = focus || "No focus set yet. Update the focus text from Backstage to announce what the audience should pay attention to.";
  }

  function init(socket) {
    showView("camera");
    startCamera();

    btnCamera?.addEventListener("click", () => showView("camera"));
    btnSlides?.addEventListener("click", () => showView("slides"));

    socket.on("slideEmbedConfig", ({ url }) => {
      applySlideConfig(url);
    });
    socket.on("stageFocusUpdate", ({ focus }) => {
      updateStageFocus(focus);
    });
  }

  return { init };
})();

const PulseModule = (() => {
  const ctx = document.getElementById("stage-pulse-chart");
  let chart;

  function initChart() {
    const gradient = ctx?.getContext("2d").createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, "rgba(14, 165, 233, 0.6)");
    gradient.addColorStop(1, "rgba(239, 68, 68, 0.3)");

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{ label: "Pulse", data: [], borderColor: "#22d3ee", backgroundColor: gradient, fill: true }],
      },
      options: { responsive: true, animation: false, plugins: { legend: { display: false } } },
    });
  }

  function updatePulse(value, debugBar) {
    document.getElementById("stage-pulse-value").textContent = `Current pulse: ${value.toFixed(2)}`;
    if (!chart) return;
    chart.data.labels.push("");
    chart.data.datasets[0].data.push(value);
    if (chart.data.labels.length > 60) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update("none");
    if (debugBar) {
      debugBar.textContent = `Pulse updated: ${value.toFixed(2)}`;
    }
  }

  function init(socket, debugBar) {
    initChart();
    socket.on("pulseData", ({ currentPulse }) => updatePulse(currentPulse, debugBar));
  }

  return { init };
})();

const DiscussionModule = (() => {
  const listEl = document.getElementById("stage-discussion-list");

  function applyHeatStyles(card, post) {
    const likes = post.likes || 0;
    const dislikes = post.dislikes || 0;
    const score = likes - dislikes;
    if (score > 1) card.classList.add("hot");
    else if (score < -1) card.classList.add("cold");
    else card.classList.remove("hot", "cold");
  }

  function renderDiscussion(posts) {
    listEl.innerHTML = "";
    if (!posts.length) {
      const empty = document.createElement("div");
      empty.className = "discussion-empty";
      empty.textContent = "No posts yet. Ask the room a question or invite them to share.";
      listEl.appendChild(empty);
      return;
    }

    const sorted = [...posts].sort((a, b) => {
      const answeredA = !!a.answered;
      const answeredB = !!b.answered;
      if (answeredA !== answeredB) return answeredA ? 1 : -1;

      const scoreA = (a.likes || 0) - (a.dislikes || 0);
      const scoreB = (b.likes || 0) - (b.dislikes || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;

      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    });

    sorted.forEach((post) => {
      const item = document.createElement("div");
      item.className = "discussion-item";
      if (post.answered) item.classList.add("answered");

      const textDiv = document.createElement("div");
      textDiv.className = "discussion-text";
      textDiv.textContent = post.text;

      const metaDiv = document.createElement("div");
      metaDiv.className = "discussion-meta";

      const d = new Date(post.createdAt || Date.now());
      const score = (post.likes || 0) - (post.dislikes || 0);
      const infoSpan = document.createElement("span");
      infoSpan.textContent = `${d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })} · score ${score >= 0 ? "+" + score : score}`;

      metaDiv.appendChild(infoSpan);
      item.appendChild(textDiv);
      item.appendChild(metaDiv);

      if (Array.isArray(post.replies) && post.replies.length) {
        const repliesBox = document.createElement("div");
        repliesBox.className = "discussion-replies";
        post.replies.forEach((reply) => {
          const replyDiv = document.createElement("div");
          replyDiv.className = "discussion-reply";
          const rd = new Date(reply.createdAt || Date.now());
          replyDiv.textContent = `${reply.text} · ${rd.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`;
          repliesBox.appendChild(replyDiv);
        });
        item.appendChild(repliesBox);
      }

      applyHeatStyles(item, post);
      listEl.appendChild(item);
    });
  }

  function init(socket, debugBar) {
    socket.on("questionsUpdate", (payload) => {
      const posts = (payload && payload.questions) || [];
      renderDiscussion(posts);
      if (debugBar) {
        debugBar.textContent = `Discussion: ${posts.length} posts`;
      }
    });
  }

  return { init };
})();
