const crypto = require("crypto");

const sessionsByCode = new Map();
const sessionsById = new Map();

function generateCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, alphabet.length);
    code += alphabet[index];
  }
  return code;
}

function createSession({ title, pdType }) {
  const code = generateCode();
  const id = crypto.randomUUID();
  const session = {
    id,
    code,
    title,
    pdType,
  };
  sessionsByCode.set(code, session);
  sessionsById.set(id, session);
  return session;
}

function getSessionByCode(code) {
  if (!code) return null;
  return sessionsByCode.get(code) || null;
}

module.exports = {
  createSession,
  getSessionByCode,
};
