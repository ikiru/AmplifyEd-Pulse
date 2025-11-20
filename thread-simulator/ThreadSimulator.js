// thread-simulator/ThreadSimulator.js

import { EngineController } from "./engineController.js";

export class ThreadSimulator {
  constructor({ openai, model }) {
    this.engine = new EngineController({ openai, model });

    // Register engine event listeners
    this.engine.on("interpretation", (interp) => {
      this.updateDebugPanel(interp);
    });

    this.engine.on("intervention", (botMsg) => {
      this.renderFacilitatorMessage(botMsg);
    });

    this.engine.on("timeline", (entry) => {
      this.updateTimeline(entry);
    });
  }

  // User sends a message
  async userSend(text) {
    this.renderUserMessage(text);
    await this.engine.handleUserMessage(text);
  }

  // ---------------------------
  // Rendering hooks (UI will implement)
  // ---------------------------
  renderUserMessage(text) {
    console.log("[UI] user:", text);
  }

  renderFacilitatorMessage(msg) {
    console.log("[UI] facilitator:", msg.text);
  }

  updateDebugPanel(interp) {
    console.log("[debug]", interp);
  }

  updateTimeline(entry) {
    console.log("[timeline]", entry);
  }
}
