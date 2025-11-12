cd sandbox
const discussionBySession = new Map();
const participantsBySession = new Map();
const nextParticipantNumberBySession = new Map();
const socketSessionMap = new Map();

function getOrCreateParticipants(code) {
  if (!participantsBySession.has(code)) {
    participantsBySession.set(code, new Map());
    nextParticipantNumberBySession.set(code, 1);
  }
  return participantsBySession.get(code);
}

function assignParticipantName(code, socketId) {
  const participants = getOrCreateParticipants(code);
  if (participants.has(socketId)) {
    return participants.get(socketId);
  }
  const nextNumber = nextParticipantNumberBySession.get(code) || 1;
  const name = `Participant ${nextNumber}`;
  participants.set(socketId, name);
  nextParticipantNumberBySession.set(code, nextNumber + 1);
  return name;
}

function removeParticipant(code, socketId) {
  const participants = participantsBySession.get(code);
  if (participants) {
    participants.delete(socketId);
  }
}

function getOrCreateSessionPosts(code) {
  if (!discussionBySession.has(code)) {
    discussionBySession.set(code, new Map());
  }
  return discussionBySession.get(code);
}

function getParticipantName(code, socketId) {
  const participants = participantsBySession.get(code);
  return participants ? participants.get(socketId) : undefined;
}

function serializePost(post) {
  return {
    id: post.id,
    sessionCode: post.sessionCode,
    parentId: post.parentId,
    text: post.text,
    authorType: post.authorType,
    timestamp: post.timestamp,
    score: post.score,
    authorName: post.authorName,
  };
}

function registerLiveDiscussion(io, sessions) {
  io.on("connection", (socket) => {
    socket.on("discussion:newMessage", (msg) => {
      const code = (msg.sessionCode || "").trim().toUpperCase();
      if (!sessions.has(code)) return;

      const posts = getOrCreateSessionPosts(code);
      const participants = getOrCreateParticipants(code);
      const authorName = participants.get(socket.id) || assignParticipantName(code, socket.id);

      const id = msg.id || Date.now().toString() + "-" + Math.random().toString(36).slice(2);
      const timestamp = msg.timestamp || new Date().toISOString();

      const post = {
        id,
        sessionCode: code,
        parentId: msg.parentId || null,
        text: msg.text,
        authorType: msg.authorType === "host" ? "host" : "audience",
        authorName,
        timestamp,
        score: 0,
        votes: new Map(),
      };

      posts.set(id, post);

      const wirePost = {
        id: post.id,
        sessionCode: post.sessionCode,
        parentId: post.parentId,
        text: post.text,
        authorType: post.authorType,
        authorName: post.authorName,
        timestamp: post.timestamp,
        score: post.score,
      };

      io.to(code).emit("discussion:messageAdded", wirePost);
    });

    socket.on("audience:joinSession", ({ code }) => {
      if (!code || typeof code !== "string") return;
      const normalized = code.trim().toUpperCase();
      if (!sessions.has(normalized)) return;

      socketSessionMap.set(socket.id, normalized);
      const identity = assignParticipantName(normalized, socket.id);
      socket.emit("discussion:identity", { authorName: identity });

      const posts = getOrCreateSessionPosts(normalized);
      const history = Array.from(posts.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((post) => serializePost(post));
      socket.emit("discussion:initialState", history);
    });

    socket.on("discussion:vote", ({ sessionCode, postId, direction }) => {
      const code = (sessionCode || "").trim().toUpperCase();
      if (!sessions.has(code)) return;

      const posts = discussionBySession.get(code);
      if (!posts) return;

      const post = posts.get(postId);
      if (!post) return;

      const voterId = socket.id;
      if (!post.votes) {
        post.votes = new Map();
      }

      const previous = post.votes.get(voterId) || 0;
      const requested = Number(direction);
      if (Number.isNaN(requested)) return;

      const next = Math.max(-1, Math.min(1, requested));
      if (previous === next) return;

      post.score = post.score - previous + next;
      post.votes.set(voterId, next);

      const wirePost = serializePost(post);
      io.to(code).emit("discussion:scoreUpdated", {
        id: wirePost.id,
        score: wirePost.score,
      });
    });

    socket.on("disconnect", () => {
      const code = socketSessionMap.get(socket.id);
      if (code) {
        removeParticipant(code, socket.id);
        socketSessionMap.delete(socket.id);
      }
    });
  });
}

module.exports = { registerLiveDiscussion };
