const discussionBySession = new Map();

function getOrCreateSessionPosts(code) {
  if (!discussionBySession.has(code)) {
    discussionBySession.set(code, new Map());
  }
  return discussionBySession.get(code);
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
  };
}

function registerLiveDiscussion(io, sessions) {
  io.on("connection", (socket) => {
    socket.on("discussion:newMessage", (msg) => {
      const code = (msg.sessionCode || "").trim().toUpperCase();
      if (!sessions.has(code)) return;

      const parentId = msg.parentId || null;
      const authorType = msg.authorType === "host" ? "host" : "audience";
      const text = (msg.text || "").trim();
      if (!text) return;

      const posts = getOrCreateSessionPosts(code);
      const id = Date.now().toString() + "-" + Math.random().toString(36).slice(2);
      const timestamp = new Date().toISOString();

      const post = {
        id,
        sessionCode: code,
        parentId,
        text,
        authorType,
        timestamp,
        score: 0,
        votes: new Map(),
      };

      posts.set(id, post);

      const wirePost = serializePost(post);
      io.to(code).emit("discussion:messageAdded", wirePost);
    });

    socket.on("audience:joinSession", ({ code }) => {
      if (!code || typeof code !== "string") return;
      const normalized = code.trim().toUpperCase();
      if (!sessions.has(normalized)) return;

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
  });
}

module.exports = { registerLiveDiscussion };
