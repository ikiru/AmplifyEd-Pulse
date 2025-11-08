// public/stage.js
/* global Chart, io */

document.addEventListener("DOMContentLoaded", () => {
  // --- Tiny debug bar so we know the script is alive ---
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
  debugBar.textContent = "Stage script loaded, waiting for socket…";
  document.body.appendChild(debugBar);

  const socket = io();

  // Identify this client as the stage / projector
  socket.on("connect", () => {
    socket.emit("registerRole", "stage");
  });

  /* =========================================================
   VideoModule: camera + external slides embed
   ========================================================= */

const VideoModule = (() => {
  const root = document.getElementById("stage-video-inner");
  const videoEl = document.getElementById("stage-camera");
  const cameraStatus = document.getElementById("camera-status");
  const btnCamera = document.getElementById("btn-show-camera");
  const btnSlides = document.getElementById("btn-show-slides");

  const slidesIframe = document.getElementById("slides-iframe");
  const slidesPlaceholder = document.getElementById("slides-placeholder");
  const slidesIndicator = document.getElementById("slides-indicator");

  if (!root || !videoEl) {
    return { init: () => {} };
  }

  let mediaStream = null;
  let activeView = "camera";

  function showView(view) {
    activeView = view;
    if (!root) return;

    if (view === "camera") {
      root.classList.remove("slides-mode");
      root.classList.add("camera-mode");
      if (btnCamera) btnCamera.classList.add("active");
      if (btnSlides) btnSlides.classList.remove("active");
    } else {
      root.classList.remove("camera-mode");
      root.classList.add("slides-mode");
      if (btnSlides) btnSlides.classList.add("active");
      if (btnCamera) btnCamera.classList.remove("active");
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (cameraStatus) {
        cameraStatus.textContent = "Camera not supported in this browser.";
      }
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      videoEl.srcObject = mediaStream;
      if (cameraStatus) {
        cameraStatus.textContent = "Camera live";
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (cameraStatus) {
        cameraStatus.textContent = "Unable to access camera.";
      }
    }
  }

  function stopCamera() {
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  // Called whenever server sends slideEmbedConfig
  function applySlideConfig(url) {
    const hasUrl = !!url;
    if (slidesIframe) {
      slidesIframe.style.display = hasUrl ? "block" : "none";
      slidesIframe.src = hasUrl ? url : "";
    }
    if (slidesPlaceholder) {
      slidesPlaceholder.style.display = hasUrl ? "none" : "flex";
    }
    if (slidesIndicator) {
      slidesIndicator.textContent = hasUrl
        ? "Deck connected"
        : "No deck connected";
    }
  }

  function init() {
    // Default view: camera
    showView("camera");
    startCamera();

    if (btnCamera) {
      btnCamera.addEventListener("click", () => {
        showView("camera");
        if (!mediaStream) startCamera();
      });
    }

    if (btnSlides) {
      btnSlides.addEventListener("click", () => {
        showView("slides");
        // optional: stopCamera();
      });
    }

    // Listen for slide embed config from server
    socket.on("slideEmbedConfig", (payload) => {
      const url = (payload && payload.url) || "";
      applySlideConfig(url);
    });

    window.addEventListener("beforeunload", () => {
      stopCamera();
    });
  }

  return { init };
})();


  /* =========================================================
     PulseModule
     ========================================================= */

  const PulseModule = (() => {
    const participantLabel = document.getElementById("stage-participant-count");
    const pulseValueEl = document.getElementById("stage-pulse-value");
    const pulseCanvas = document.getElementById("stage-pulse-chart");

    if (!participantLabel || !pulseValueEl || !pulseCanvas) {
      debugBar.textContent +=
        " · PulseModule: missing DOM elements (check IDs in stage.html).";
      return { init: () => {} };
    }

    const SAMPLE_COUNT = 120;
    const STEP_MS = 150;

    const waveData = new Array(SAMPLE_COUNT).fill(0);
    const labels = new Array(SAMPLE_COUNT).fill("");

    let currentPulseValue = 0;
    let pulseChart = null;

    function createChart() {
      const ctx = pulseCanvas.getContext("2d");
      return new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Engagement Pulse",
              data: waveData,
              borderColor: "#22d3ee",
              borderWidth: 2,
              tension: 0.4,
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: {
              ticks: { display: false },
              grid: { display: false },
            },
            y: {
              min: -1,
              max: 1,
              ticks: {
                stepSize: 0.5,
                color: "#9ca3af",
              },
              grid: {
                color: "rgba(148,163,184,0.2)",
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
        },
      });
    }

    function updatePulseValueDisplay(value) {
      const rounded = (Math.round(value * 100) / 100).toFixed(2);
      pulseValueEl.textContent = `Current pulse: ${rounded}`;
    }

    function updateLineColor(value) {
      let color = "#9ca3af";
      if (value > 0.3) color = "#22d3ee";
      else if (value < -0.3) color = "#ef4444";
      pulseChart.data.datasets[0].borderColor = color;
    }

    function updateGridForParticipants(count) {
      const n = Math.max(1, count);
      let stepSize = 2 / (n + 1);
      if (stepSize < 0.1) stepSize = 0.1;
      if (stepSize > 1) stepSize = 1;
      const alpha = Math.min(0.12 + n * 0.03, 0.35);

      pulseChart.options.scales.y.ticks.stepSize = stepSize;
      pulseChart.options.scales.y.grid.color = `rgba(148,163,184,${alpha})`;
    }

    function init() {
      try {
        pulseChart = createChart();
        if (!pulseChart) {
          debugBar.textContent += " · PulseModule: failed to create Chart.";
          return;
        }

        setInterval(() => {
          waveData.shift();
          waveData.push(currentPulseValue);
          pulseChart.update();
        }, STEP_MS);

        socket.on("pulseData", (payload) => {
          if (!payload) return;
          const v =
            typeof payload.currentPulse === "number"
              ? payload.currentPulse
              : 0;
          currentPulseValue = Math.max(-1, Math.min(1, v));
          updatePulseValueDisplay(currentPulseValue);
          updateLineColor(currentPulseValue);

          debugBar.textContent = `Connected · pulse: ${currentPulseValue.toFixed(
            2
          )}`;
        });

        socket.on("participantCount", (data) => {
          if (!data || typeof data.count !== "number") return;
          const count = data.count;
          const label = count === 1 ? "participant" : "participants";
          participantLabel.textContent = `${count} ${label}`;
          updateGridForParticipants(count);
        });
      } catch (err) {
        console.error("PulseModule error:", err);
        debugBar.textContent = "PulseModule error: " + err.message;
      }
    }

    return { init };
  })();

  /* =========================================================
     DiscussionModule (read-only, shows replies)
     ========================================================= */

  const DiscussionModule = (() => {
    const listEl = document.getElementById("stage-discussion-list");
    if (!listEl) {
      debugBar.textContent +=
        " · DiscussionModule: #stage-discussion-list not found.";
      return { init: () => {} };
    }

    function applyHeatStyles(card, post) {
      const likes = post.likes || 0;
      const dislikes = post.dislikes || 0;
      const total = likes + dislikes;

      let bg = "rgba(15,23,42,0.95)";
      let border = "rgba(148,163,184,0.5)";
      let shadow = "none";

      if (total > 0) {
        const support = (likes - dislikes) / total;
        const baseIntensity = Math.min(Math.abs(support), 1);
        const volumeFactor = Math.min(total / 5, 1);
        const intensity = baseIntensity * volumeFactor;

        const NEUTRAL = { r: 15, g: 23, b: 42 };
        const NEG = { r: 239, g: 68, b: 68 };
        const POS = { r: 34, g: 211, b: 238 };

        const lerp = (a, b, t) => a + (b - a) * t;
        const mix = (c1, c2, t) => ({
          r: lerp(c1.r, c2.r, t),
          g: lerp(c1.g, c2.g, t),
          b: lerp(c1.b, c2.b, t),
        });

        const axisT = (support + 1) / 2;
        const axisColor = mix(NEG, POS, axisT);
        const finalColor = mix(NEUTRAL, axisColor, intensity);

        const r = Math.round(finalColor.r);
        const g = Math.round(finalColor.g);
        const b = Math.round(finalColor.b);

        const br = Math.round(axisColor.r);
        const bgc = Math.round(axisColor.g);
        const bb = Math.round(axisColor.b);

        const borderAlpha = 0.35 + 0.35 * intensity;
        const shadowRadius = 4 + 10 * intensity;
        const shadowAlpha = 0.15 + 0.2 * intensity;

        bg = `rgba(${r},${g},${b},0.35)`;
        border = `rgba(${br},${bgc},${bb},${borderAlpha})`;
        shadow = `0 0 ${shadowRadius}px rgba(${br},${bgc},${bb},${shadowAlpha})`;
      }

      card.style.backgroundColor = bg;
      card.style.borderColor = border;
      card.style.boxShadow = shadow;
      card.style.opacity = post.answered ? "0.6" : "1";
    }

    function renderDiscussion(posts) {
      listEl.innerHTML = "";

      if (!posts || !posts.length) {
        const empty = document.createElement("div");
        empty.className = "discussion-empty";
        empty.textContent =
          "No posts yet. Ask the room a question or invite them to share.";
        listEl.appendChild(empty);
        return;
      }

      const sorted = [...posts].sort((a, b) => {
        const aAnswered = !!a.answered;
        const bAnswered = !!b.answered;
        if (aAnswered !== bAnswered) return aAnswered ? 1 : -1;

        const scoreA = (a.likes || 0) - (a.dislikes || 0);
        const scoreB = (b.likes || 0) - (b.dislikes || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;

        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });

      sorted.forEach((post) => {
        const likes = post.likes || 0;
        const dislikes = post.dislikes || 0;
        const score = likes - dislikes;

        const item = document.createElement("div");
        item.className = "discussion-item";
        if (post.answered) item.classList.add("answered");

        const textDiv = document.createElement("div");
        textDiv.className = "discussion-text";
        textDiv.textContent = post.text;

        const metaDiv = document.createElement("div");
        metaDiv.className = "discussion-meta";

        const d = new Date(post.createdAt || Date.now());
        const infoSpan = document.createElement("span");
        infoSpan.textContent = `${d.toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })} · score ${score >= 0 ? "+" + score : score} · 👍 ${likes} · 👎 ${dislikes}`;

        const btn = document.createElement("button");
        btn.textContent = post.answered ? "Answered" : "Mark answered";
        btn.disabled = !!post.answered;
        btn.className = "btn-pill-orange";
        btn.addEventListener("click", () => {
          socket.emit("markQuestionAnswered", { id: post.id });
        });

        metaDiv.appendChild(infoSpan);
        metaDiv.appendChild(btn);

        item.appendChild(textDiv);
        item.appendChild(metaDiv);

        if (Array.isArray(post.replies) && post.replies.length) {
          const repliesBox = document.createElement("div");
          repliesBox.className = "discussion-replies";

          post.replies.forEach((r) => {
            const rDiv = document.createElement("div");
            rDiv.className = "discussion-reply";

            const rd = new Date(r.createdAt || Date.now());
            const time = rd.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });

            rDiv.textContent = `${r.text} · ${time}`;
            repliesBox.appendChild(rDiv);
          });

          item.appendChild(repliesBox);
        }

        applyHeatStyles(item, post);
        listEl.appendChild(item);
      });
    }

    function init() {
      socket.on("questionsUpdate", (payload) => {
        const posts = (payload && payload.questions) || [];
        debugBar.textContent = `Connected · posts: ${posts.length}`;
        console.log("stage questionsUpdate:", posts);
        renderDiscussion(posts);
      });
    }

    return { init };
  })();

  /* =========================================================
     Bootstrap
     ========================================================= */

  VideoModule.init();
  PulseModule.init();
  DiscussionModule.init();
});
