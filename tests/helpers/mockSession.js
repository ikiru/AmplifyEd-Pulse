export function makeSession(messages = []) {
  return {
    messages,
    userStats: {},
    agreeBurst: { count: 0, lastAt: 0 },
    lastBotAt: 0,
  };
}
