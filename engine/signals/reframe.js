export function clarifyMove({ messages }) {
  const last = messages[messages.length - 1]?.text || "";
  return {
    shouldReply: true,
    reply: `I hear some uncertainty. What part of "${last}" feels unclear or needs focus?`,
  };
}
