// engine/moves/stabilize.js
import { v4 as uuid } from "uuid";

export function stabilizeMove(turn) {
  const focusMessageId = turn?.humanMsg?.id || null;
  const sessionId = turn?.session?.id;

  return {
    shouldReply: true,
    focusMessageId,
    botMessage: {
      id: uuid(),
      sessionId,
      role: "facilitator",
      authorType: "bot",
      sender: "bot",
      text: "Your emotions matter and they're valid. Let's take a pause. What's the smallest next step that feels manageable right now?",
      ts: Date.now(),
    },
  };
}
