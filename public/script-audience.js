// public/script-audience.js

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

function setupInteractionHandlers(socket) {
  const reactionButtons = document.querySelectorAll(".pulse-button");
  const reactionStatus = document.getElementById("reaction-status");
  const replyStatus = document.getElementById("reply-status");
  const REACTION_COOLDOWN_MS = 1200;
  let reactionCooldown = false;
  let reactionCooldownTimer = null;

  const toggleReactionControls = (disabled) => {
    reactionButtons.forEach((btn) => {
      btn.disabled = disabled;
      btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    });
  };

  const setReactionStatus = (message, isError = false) => {
    if (!reactionStatus) return;
    reactionStatus.textContent = message || "";
    reactionStatus.classList.toggle("error", !!isError);
  };

  const setReplyStatus = (message, isError = false) => {
    if (!replyStatus) return;
    replyStatus.textContent = message || "";
    replyStatus.classList.toggle("error", !!isError);
  };

  const startReactionCooldown = () => {
    reactionCooldown = true;
    toggleReactionControls(true);
    if (reactionCooldownTimer) clearTimeout(reactionCooldownTimer);
    reactionCooldownTimer = setTimeout(() => {
      reactionCooldown = false;
      toggleReactionControls(false);
    }, REACTION_COOLDOWN_MS);
  };

  const reactionValueMap = {
    positive: 1,
    neutral: 0,
    negative: -1,
  };

  reactionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (reactionCooldown) {
        setReactionStatus("Give it a second before changing your reaction again.");
        return;
      }

      const key = btn.dataset.reaction;
      const value = reactionValueMap[key] ?? 0;
      socket.emit("pulse:update", { value });
      startReactionCooldown();
      setReactionStatus("Reaction recorded. Thanks!");
    });
  });

  const questionInput = document.getElementById("question-input");
  const questionForm = document.getElementById("question-form");
  const discussionList = document.getElementById("audience-discussion-list");

  if (questionForm) {
    questionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!questionInput) return;
      const text = questionInput.value.trim();
      if (!text) return;
      socket.emit("question:new", { text });
      questionInput.value = "";
    });
  }

  function renderDiscussion(posts) {
    if (!discussionList) return;

    discussionList.innerHTML = "";

    if (!posts || !posts.length) {
      const empty = document.createElement("div");
      empty.className = "question-item";
      empty.style.fontStyle = "italic";
      empty.textContent = "No questions or comments yet.";
      discussionList.appendChild(empty);
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
      const likes = post.likes || 0;
      const dislikes = post.dislikes || 0;

      const item = document.createElement("div");
      item.className = "question-item";

      const textDiv = document.createElement("div");
      textDiv.className = "question-text";
      textDiv.textContent = post.text;

      const metaDiv = document.createElement("div");
      metaDiv.className = "question-meta";

      const d = new Date(post.createdAt || Date.now());
      const infoSpan = document.createElement("span");
      infoSpan.textContent = `${likes} 👍 / ${dislikes} 👎 · ${d.toLocaleTimeString(
        [],
        { hour: "numeric", minute: "2-digit" }
      )}`;

      const votesSpan = document.createElement("span");

      const upBtn = document.createElement("button");
      upBtn.className = "aud-vote-btn";
      upBtn.type = "button";
      upBtn.textContent = "dY`?";
      upBtn.addEventListener("click", () => {
        socket.emit("voteQuestion", { id: post.id, delta: 1 });
      });

      const downBtn = document.createElement("button");
      downBtn.className = "aud-vote-btn";
      downBtn.type = "button";
      downBtn.textContent = "dY`Z";
      downBtn.addEventListener("click", () => {
        socket.emit("voteQuestion", { id: post.id, delta: -1 });
      });

      votesSpan.appendChild(upBtn);
      votesSpan.appendChild(downBtn);

      metaDiv.appendChild(infoSpan);
      metaDiv.appendChild(votesSpan);

      item.appendChild(textDiv);
      item.appendChild(metaDiv);

      const repliesWrapper = document.createElement("div");
      repliesWrapper.className = "aud-replies";

      if (Array.isArray(post.replies) && post.replies.length) {
        post.replies.forEach((reply) => {
          const replyDiv = document.createElement("div");
          replyDiv.className = "aud-reply";

          const rd = new Date(reply.createdAt || Date.now());
          const time = rd.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });

          replyDiv.textContent = `${reply.text} · ${time}`;
          repliesWrapper.appendChild(replyDiv);
        });
      }

      const replyForm = document.createElement("form");
      replyForm.className = "reply-form";
      const replyInput = document.createElement("input");
      replyInput.type = "text";
      replyInput.placeholder = "Reply�?�";
      const replyButton = document.createElement("button");
      replyButton.type = "submit";
      replyButton.textContent = "Reply";

      replyForm.appendChild(replyInput);
      replyForm.appendChild(replyButton);

      replyForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = replyInput.value.trim();
        if (!text) return;
        socket.emit("addReply", { parentId: post.id, text });
        replyInput.value = "";
      });

      repliesWrapper.appendChild(replyForm);
      item.appendChild(repliesWrapper);

      discussionList.appendChild(item);
    });
  }

  socket.on("questionsUpdate", (payload) => {
    const posts = (payload && payload.questions) || [];
    renderDiscussion(posts);
  });

  socket.on("reactionLimit", (payload) => {
    setReactionStatus(
      (payload && payload.message) ||
        "Hold up a second before changing your reaction again.",
      true
    );
    startReactionCooldown();
  });

  socket.on("replyLimit", (payload) => {
    setReplyStatus(
      (payload && payload.message) ||
        "Hold up a moment before adding another reply.",
      true
    );
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const sessionCodeInput = document.getElementById("sessionCodeInput");
  const joinButton = document.getElementById("joinSessionButton");
  const sessionStatus = document.getElementById("sessionStatus");
  const sessionJoinSection = document.querySelector(".session-join");
  const audienceControls = document.getElementById("audienceControls");
  const discussionInput = document.getElementById("audience-discussion-input");
  const discussionPost = document.getElementById("audience-discussion-post");
  const discussionFeed = document.getElementById("audience-discussion-feed");
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

    const replyBtn = document.createElement("button");
    replyBtn.className = "reply-button";
    replyBtn.type = "button";
    replyBtn.textContent = "Reply";

    controls.appendChild(flame);
    controls.appendChild(scoreEl);
    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(replyBtn);

    footer.appendChild(meta);
    footer.appendChild(controls);

    const repliesWrapper = document.createElement("div");
    repliesWrapper.className = "discussion-replies";

    card.appendChild(textEl);
    card.appendChild(footer);
    card.appendChild(repliesWrapper);
    container.appendChild(card);
    container.scrollTop = container.scrollHeight;

    card.dataset.voteState = "0";

    const sendVote = (direction) => {
      if (!currentSessionCode || !msg.id) return;
      socket?.emit("discussion:vote", {
        sessionCode: currentSessionCode,
        postId: msg.id,
        direction,
      });
    };

    up.addEventListener("click", () => {
      const currentState = parseInt(card.dataset.voteState || "0", 10);
      let next = 1;
      if (currentState === 1) {
        next = 0;
      }
      card.dataset.voteState = String(next);
      sendVote(next);
    });

    down.addEventListener("click", () => {
      const currentState = parseInt(card.dataset.voteState || "0", 10);
      let next = -1;
      if (currentState === -1) {
        next = 0;
      }
      card.dataset.voteState = String(next);
      sendVote(next);
    });

    replyBtn.addEventListener("click", () => {
      const text = prompt("Reply to this comment:");
      if (!text) return;
      if (typeof createReply === "function" && msg.id) {
        createReply(msg.id, text);
      }
      const replyEl = document.createElement("div");
      replyEl.className = "discussion-reply";
      replyEl.textContent = text;
      repliesWrapper.appendChild(replyEl);
    });
  };

  let socket;
  let interactionsInitialized = false;
  let currentSessionCode = null;

  const setSessionStatus = (message, isError = false) => {
    if (!sessionStatus) return;
    sessionStatus.textContent = message || "";
    sessionStatus.classList.toggle("error", !!isError);
  };

  const enableJoinUI = (enabled) => {
    if (joinButton) joinButton.disabled = !enabled;
    if (sessionCodeInput) sessionCodeInput.disabled = !enabled;
  };

  const handleSessionJoined = ({ code }) => {
    currentSessionCode = code;
    setSessionStatus(`Joined session ${code}`);
    if (sessionJoinSection) sessionJoinSection.style.display = "none";
    if (audienceControls) audienceControls.style.display = "";
    if (socket && !interactionsInitialized) {
      setupInteractionHandlers(socket);
      interactionsInitialized = true;
    }
  };

  const handleSessionError = (payload) => {
    setSessionStatus(payload?.message || "Unable to join that session.", true);
    enableJoinUI(true);
  };

  const attachSocket = async (sessionCode) => {
    await loadSocketIoClient();
    socket = window.io();

    socket.on("connect", () => {
      socket.emit("registerRole", "audience");
      socket.emit("audience:joinSession", { code: sessionCode });
    });

    socket.on("audience:sessionJoined", handleSessionJoined);
    socket.on("audience:sessionNotFound", () => {
      handleSessionError({ message: "Session not found" });
    });
    socket.on("session:ended", () => {
      setSessionStatus("Session ended by the host.", true);
      if (audienceControls) audienceControls.style.display = "none";
      if (sessionJoinSection) sessionJoinSection.style.display = "";
      enableJoinUI(true);
    });

    socket.on("discussion:initialState", (history) => {
      discussionPosts.clear();
      if (discussionFeed) {
        discussionFeed.innerHTML = "";
      }

      if (!Array.isArray(history)) return;

      history.forEach((msg) => {
        if (!msg?.id) return;
        discussionPosts.set(msg.id, msg);
        appendDiscussionMessage(discussionFeed, msg);
      });
    });

    socket.on("discussion:messageAdded", (msg) => {
      if (!msg?.id) return;
      discussionPosts.set(msg.id, msg);
      appendDiscussionMessage(discussionFeed, msg);
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
  };

  joinButton?.addEventListener("click", async () => {
    const sessionCode = sessionCodeInput?.value.trim();
    if (!sessionCode) {
      setSessionStatus("Enter a session code to join.", true);
      return;
    }

    setSessionStatus("Joining session...");
    enableJoinUI(false);

    try {
      await attachSocket(sessionCode);
    } catch (error) {
      setSessionStatus(error.message, true);
      enableJoinUI(true);
    }
  });

  discussionPost?.addEventListener("click", () => {
    if (!discussionInput) return;
    const text = (discussionInput.value || "").trim();
    if (!text || !currentSessionCode) return;

    socket?.emit("discussion:newMessage", {
      sessionCode: currentSessionCode,
      text,
      authorType: "audience",
    });

    discussionInput.value = "";
  });
});
