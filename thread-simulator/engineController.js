// thread-simulator/engineController.js

import { maybeIntervene } from "../sandbox/facilitator/facilitatorLogic.js";

export class EngineController {
  constructor({ openai, model, roleGroup = "educator" }) {
    this.openai = openai;
    this.model = model;
    this.roleGroup = roleGroup;

    // Core session object
    this.session = {
      messages: [],
      lastInterpretation: null,
      lastBotAt: 0,
      timeline: []
    };

    // Subscribers for UI updates
    this.listeners = {
      interpretation: [],
      intervention: [],
      timeline: []
    };
  }

  // ---------------------------
  // Subscribe to engine events
  // ---------------------------
  on(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event].push(handler);
    }
  }

  emit(event, payload) {
    for (const fn of this.listeners[event] || []) {
      fn(payload);
    }
  }

  // ---------------------------
  // Handle a USER message
  // ---------------------------
  async handleUserMessage(text, userId = "user") {
    const msg = {
      text,
      userId,
      authorType: "human",
      timestamp: Date.now()
    };

    this.session.messages.push(msg);

    // Call PD Engine
    const result = await maybeIntervene({
      session: this.session,
      sessionId: "sim",
      roleGroup: this.roleGroup,
      openai: this.openai,
      model: this.model
    });

    // Emit interpretation
    this.emit("interpretation", this.session.lastInterpretation);

    // Log timeline entry
    this.logTimeline();

    // If facilitator responded
    if (result) {
      const botMessage = {
        text: result,
        authorType: "bot",
        timestamp: Date.now()
      };

      this.session.messages.push(botMessage);

      this.emit("intervention", botMessage);
    }
  }

  // ---------------------------
  // Timeline entry
  // ---------------------------
  logTimeline() {
    const interp = this.session.lastInterpretation || {};

    const entry = {
      timestamp: Date.now(),
      situation: interp.situation,
      move: interp.recommendedMove,
      signals: interp.signals
    };

    this.session.timeline.push(entry);
    this.emit("timeline", entry);
  }
}
