// engine/moves/deescalateMove.js

export function deescalateMove(signal) {
  return {
    shouldReply: true,
    botMessage: {
      id: "bot-deescalate-" + Date.now(),
      authorType: "bot",
      text: `It sounds like things may feel extremely heavy or overwhelming right now. You're not alone in that feeling. Take one breath with me. What's one small thing that would help you steady the moment?`,
      ts: Date.now()
    },
    focusMessageId: signal?.messageId || null
  };
}
