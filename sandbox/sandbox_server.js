// -------------------------------------------------------------
// HUMAN MESSAGE (AI flow)
// -------------------------------------------------------------
socket.on("humanMessage", async (payload = {}) => {
  try {
    const {
      sessionId = "demo-1",
      userId = "User",
      role = "teacher",
      text = "",
      id: incomingId,
      authorType
    } = payload;

    const session = getSession(state, sessionId);
    const roleGroup = roleMap[role] || "educator";

    session.messages ??= [];
    session.tuning ??= { dominance: 0.4, stall: 0.25, cooldownMs: 45000 };
    session.promptOverride ??= "";
    session.lastBotAt ??= 0;

    const trimmed = text.trim();
    if (!trimmed) return;

    // Flood control
    const now = Date.now();
    if (!session.lastMsgAt) session.lastMsgAt = 0;
    if (now - session.lastMsgAt < 300) return;
    session.lastMsgAt = now;

    // Bots never trigger bots
    if (authorType === "bot") {
      session.lastBotAt = now;
      return;
    }

    // -----------------------------------------
    // Store human message
    // -----------------------------------------
    const humanMsg = {
      id: incomingId?.trim() || uuid(),
      sessionId,
      userId,
      role,
      authorType: "human",
      text: trimmed,
      ts: now
    };

    session.messages.push(humanMsg);
    io.to(sessionId).emit("newMessage", humanMsg);

    onIncomingMessage(session, humanMsg);

    // -----------------------------------------
    // Cooldown
    // -----------------------------------------
    const elapsed = now - session.lastBotAt;
    const remaining = Math.max(0, session.tuning.cooldownMs - elapsed);

    io.to(sessionId).emit("cooldownUpdate", {
      sessionId,
      cooldownMs: session.tuning.cooldownMs,
      elapsed,
      remaining,
      remainingMs: remaining,
      ready: remaining <= 0
    });

    if (remaining > 0) {
      // STILL SEND INTERPRETER TARGET HERE IF AVAILABLE
      const interpretation = session.lastInterpretation;
      if (interpretation?.targetMessageId) {
        io.to(sessionId).emit("interpreterFocus", {
          messageId: interpretation.targetMessageId
        });
      }

      persistTranscript(sessionId, session.messages);
      return;
    }

    // -----------------------------------------
    // Intervene
    // -----------------------------------------
    if (session._interveneLock) return;
    session._interveneLock = true;

    let reply;
    try {
      reply = await maybeIntervene({
        session,
        sessionId,
        roleGroup,
        openai,
        model: MODEL,
        tuning: session.tuning,
        systemOverride: session.promptOverride
      });
    } finally {
      session._interveneLock = false;
    }

    // -----------------------------------------
    // Normalize reply
    // -----------------------------------------
    let replyText =
      typeof reply === "string"
        ? reply
        : reply?.reply || "";

    const shouldReply =
      Boolean(replyText.trim()) &&
      (reply?.shouldReply !== false);

    if (!shouldReply) {
      // STILL SEND INTERPRETER TARGET HERE
      const interpretation = session.lastInterpretation;
      if (interpretation?.targetMessageId) {
        io.to(sessionId).emit("interpreterFocus", {
          messageId: interpretation.targetMessageId
        });
      }

      persistTranscript(sessionId, session.messages);
      return;
    }

    // -----------------------------------------
    // Emit bot message
    // -----------------------------------------
    const botMsg = {
      id: uuid(),
      sessionId,
      userId: "AmplifyEd",
      role,
      authorType: "bot",
      text: replyText.trim(),
      ts: Date.now()
    };

    session.messages.push(botMsg);
    session.lastBotAt = botMsg.ts;

    io.to(sessionId).emit("newMessage", botMsg);

    // -------------------------------------------------------------
    // 🔥 Interpreter Focus — Correct Placement
    // -------------------------------------------------------------
    const interpretation = session.lastInterpretation;

    if (interpretation?.targetMessageId) {
      io.to(sessionId).emit("interpreterFocus", {
        messageId: interpretation.targetMessageId
      });
    }

    persistTranscript(sessionId, session.messages);

  } catch (err) {
    console.warn("[sandbox] humanMessage error:", err.message);
  }
});

