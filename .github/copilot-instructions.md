## Purpose
Short guide to help AI coding agents be immediately productive in this repository.

## Quick start (run & dev)
- Install dependencies: `npm install` (project uses express and socket.io).
- Run the server: `node server.js` (no `start` script in package.json; server listens on PORT env or 3000).
- Open http://localhost:3000 → redirects to `/stage.html`.

## High-level architecture
- Single Node process (Express) serving static files from `public/` (see `server.js`).
- Real-time communication via Socket.IO (server in `server.js`, client stub `/socket.io/socket.io.js`).
- Front-end is split into three role views under `public/`:
  - `stage.html` + `stage.js` — projector / presenter display (video, pulse chart, discussion).
  - `backstage.html` + `backstage.js` — configuration UI (sets slide embed URL).
  - `audience.html` + `script-audience.js` — audience reactions and questions.

## Important state & data flows (look here first)
- Server-side in-memory state (single-process):
  - `audienceReactions` (Map socketId -> -1|0|1) — used to compute `currentPulse` (average in [-1,1]).
  - `questions` (Array of posts) — question objects with `id, text, likes, dislikes, replies, answered`.
  - `slideEmbedUrl` — string; Backstage sets it and server broadcasts to all clients.
- Socket events (canonical names):
  - From client -> server: `registerRole`, `reaction`, `submitQuestion`, `voteQuestion`, `addReply`, `markQuestionAnswered`, `setSlideEmbedUrl`.
  - From server -> client: `pulseData`, `participantCount`, `questionsUpdate`, `slideEmbedConfig`.
  - Example: `backstage.js` emits `setSlideEmbedUrl` → server updates `slideEmbedUrl` → server emits `slideEmbedConfig` → `stage.js` updates iframe src.

## Patterns & conventions specific to this repo
- Role registration: clients call `socket.emit('registerRole', 'stage'|'backstage'|'audience')` (optional but used to distinguish UI behavior).
- Event payloads are small objects (e.g. `{ value }`, `{ text }`, `{ id, delta }`). Validate types on the server before applying.
- IDs for posts are generated with `${Date.now()}_${randomHex}` in `server.js` (ephemeral, not globally unique across restarts).
- Client scripts use IIFE/module patterns and attach to DOM `DOMContentLoaded`.
- Charting: `stage.js` uses Chart.js from CDN to render the pulse; pulse is sampled into a fixed-length buffer.

## Integration points & external dependencies
- Dependencies in `package.json`: `express` and `socket.io` (server). Chart.js is loaded from CDN in `stage.html`.
- Slides integration is via embed URLs (Google Slides / PowerPoint Online). Backstage instructs users to paste the `src` of an embed iframe.
- Camera access for Stage uses `navigator.mediaDevices.getUserMedia` (client-side). Expect permission dialogs in the browser.

## Operational notes / traps for agents
- State is in-memory: restarting the Node process clears audience reactions and questions. For persistent state or multi-process scaling, add a shared adapter (Redis) or DB and Socket.IO adapter.
- No authentication: all socket events are trusted. When adding privileged APIs (e.g., admin actions), implement authentication/authorization.
- `package.json` has no `start` script—use `node server.js` or update `package.json` if you add npm scripts.
- Port: honor `process.env.PORT` or default 3000 (see `server.js`).

## Where to change behavior (common tasks)
- To change pulse calculation or smoothing: edit `recomputePulseAndBroadcast()` in `server.js` and related client charting in `public/stage.js`.
- To add a new broadcast event: emit from server with `io.emit('yourEvent', payload)` and subscribe on clients with `socket.on('yourEvent', handler)`.
- To persist questions: replace the `questions` array in `server.js` with a persistence layer (DB) and adapt `broadcastQuestions()` to read/write from it.

## Quick examples (copy-paste friendly)
- Emit a new global update from server.js: `io.emit('sessionUpdate', { started: true, ts: Date.now() })`
- Listen on stage: `socket.on('sessionUpdate', (p) => { console.log('session', p) }) // in public/stage.js`

## Files to open first (recommended order)
1. `server.js` — server logic, socket handlers, and ephemeral state.
2. `public/stage.html` + `public/stage.js` — main presenter UI, pulse chart and video.
3. `public/backstage.html` + `public/backstage.js` — slide embed flow and how config propagates.
4. `public/audience.html` + `public/script-audience.js` — reaction and question flows.

Please review for missing items or unclear examples. I can iterate on wording or expand any section (security, tests, deployment) on request.
