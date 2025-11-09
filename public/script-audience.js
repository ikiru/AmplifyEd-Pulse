// public/script-audience.js
/* global io */

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  // Identify this client as an audience member (optional but nice)
  socket.on("connect", () => {
    socket.emit("registerRole", "audience");
  });

  /* ------------------ Reactions (This hits / Meh / Not landing) ------------------ */

  const reactionButtons = document.querySelectorAll("[data-reaction]");
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

  reactionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (reactionCooldown) {
        setReactionStatus("Give it a second before changing your reaction again.");
        return;
      }

      const value = Number(btn.dataset.reaction || 0);
      socket.emit("reaction", { value });
      startReactionCooldown();
      setReactionStatus("Reaction recorded. Thanks!");
    });
  });

  /* ------------------ New question / thought ------------------ */

  const questionInput = document.getElementById("question-input");
  const questionForm = document.getElementById("question-form");
  const discussionList = document.getElementById("audience-discussion-list");

  if (questionForm) {
    questionForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!questionInput) return;
      const text = questionInput.value.trim();
      if (!text) return;
      socket.emit("submitQuestion", { text });
      questionInput.value = "";
    });
  }

  /* ------------------ Render live discussion ------------------ */

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

    // Sort: unanswered first, then by net score, then newest
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

      const item = document.createElement("div");
      item.className = "question-item";

      const textDiv = document.createElement("div");
      textDiv.className = "question-text";
      textDiv.textContent = post.text;

      const metaDiv = document.createElement("div");
      metaDiv.className = "question-meta";

      const d = new Date(post.createdAt || Date.now());
      const infoSpan = document.createElement("span");
      infoSpan.textContent = `👍 ${likes} · 👎 ${dislikes} · ${d.toLocaleTimeString(
        [],
        { hour: "numeric", minute: "2-digit" }
      )}`;

      const votesSpan = document.createElement("span");

      const upBtn = document.createElement("button");
      upBtn.className = "aud-vote-btn";
      upBtn.type = "button";
      upBtn.textContent = "👍";
      upBtn.addEventListener("click", () => {
        socket.emit("voteQuestion", { id: post.id, delta: 1 });
      });

      const downBtn = document.createElement("button");
      downBtn.className = "aud-vote-btn";
      downBtn.type = "button";
      downBtn.textContent = "👎";
      downBtn.addEventListener("click", () => {
        socket.emit("voteQuestion", { id: post.id, delta: -1 });
      });

      votesSpan.appendChild(upBtn);
      votesSpan.appendChild(downBtn);

      metaDiv.appendChild(infoSpan);
      metaDiv.appendChild(votesSpan);

      item.appendChild(textDiv);
      item.appendChild(metaDiv);

      // --- Replies section ---
      const repliesWrapper = document.createElement("div");
      repliesWrapper.className = "aud-replies";

      if (Array.isArray(post.replies) && post.replies.length) {
        post.replies.forEach((r) => {
          const rDiv = document.createElement("div");
          rDiv.className = "aud-reply";

          const rd = new Date(r.createdAt || Date.now());
          const time = rd.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });

          rDiv.textContent = `${r.text} · ${time}`;
          repliesWrapper.appendChild(rDiv);
        });
      }

      const replyForm = document.createElement("form");
      replyForm.className = "reply-form";
      const replyInput = document.createElement("input");
      replyInput.type = "text";
      replyInput.placeholder = "Reply…";
      const replyButton = document.createElement("button");
      replyButton.type = "submit";
      replyButton.textContent = "Reply";

      replyForm.appendChild(replyInput);
      replyForm.appendChild(replyButton);

      replyForm.addEventListener("submit", (e) => {
        e.preventDefault();
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
});


