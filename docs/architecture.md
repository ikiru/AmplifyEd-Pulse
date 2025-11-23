# AmplifyEd Pulse - System Architecture

_Last updated: Phase 2 (Interpreter Contract + Facilitator Integration)_

AmplifyEd Pulse is a real-time professional-learning simulator designed to model teacher discussions, detect conversational patterns (stall, dominance, confusion), and optionally intervene with an AI facilitator. The system is divided into clearly bounded modules:

- **Server Layer** (Node.js + Socket.io)  
- **Interpreter Layer** (AI “brain” that generates contracts)  
- **Engine Layer** (`runEngine`, which applies interpreter cues and selects facilitator moves)
- **Web Client / Sandbox UI** (simulator + developer tools)

This document explains the file structure, each subsystem, message flow, and development standards.

---

# 1. Repository Structure

```
AMPLIFYED-PULSE/
│
├-- server.js
├-- sandbox_server.js
├-- pulse_process_utils.js
│
├-- public/
│   ├-- index.html
│   ├-- client.js
│   └-- styles.css
│
├-- sandbox/
│   ├-- liveDiscussion.js
│   ├-- interpreter.js
│   ├-- contractParser.js
│   ├-- sessionStore.js
│   └-- ...
├-- engine/
│   ├-- index.js                    ← runEngine entry point
│   ├-- interpreters/
│   ├-- signals/
│   └-- moves/
│
├-- data/
│   └-- sample_messages.json
│
├-- prompts/
│   └-- ai_system_prompts.md
│
├-- docs/
│   └-- architecture.md             ← (this file)
│
└-- package.json
```

**Key folders:**

### `/sandbox/`
Contains runtime helpers, session stores, prompts, and developer tooling for the simulator.

### `/engine/`
Hosts the unified `runEngine` entry point, interpreter modules, signal detectors, and move selection logic.

### `/public/`
Static files for the browser client:
- thread simulator UI
- pulse indicators
- role selectors
- detector control sliders
- JSON replay tools

### `/data/`
Testing fixtures / recorded transcripts.

### `/prompts/`
Keeps the system prompts used by the interpreter.

---

# 2. Message Flow Architecture

Below is the core end-to-end flow that ties the entire system together.

```
User Message → Server → Interpreter → Engine → Server → UI
```

### 2.1. User message enters system
Client posts a message to the server via Socket.io:

```
socket.emit("message", { sessionId, role, text })
```

### 2.2. Server forwards the message to runEngine
The server packages the latest human message and session state into the `turn` object sent to `runEngine` (`engine/index.js`):

```js
const { signals, interpretation, move } = await runEngine({
  session,
  humanMsg,
  role,
  roleGroup,
  openai,
  model,
});
```

Interpreter always returns a **contract object**:

```json
{
  "situation": "stall | dominance | confusion | healthy",
  "move": "reflect | clarify | probe | reinforce | none",
  "confidence": 0.78
}
```

### 2.3. Interpreter contract is normalized inside runEngine
`runEngine` delegates to the interpreter module (`engine/interpreters/interpreter.js`) that inspects the most recent human utterance, matches cues, and normalizes the contract schema shown above. Any missing or malformed fields are filled in before the move-selection step runs.

### 2.4. Signals + move selection decide whether to speak
After receiving the contract, `runEngine` gathers signals from `engine/signals/` and chooses the highest-priority move via `engine/moves/movePriority.js`. The resulting `move` payload includes `type`, `shouldReply`, optional focus/cooldown metadata, and the generated `botMessage`.

### 2.5. Server emits the engine’s move (if any)
Once `runEngine` returns, the server emits the updated interpretation, signals, and any facilitator reply (`move.botMessage`) back to the clients:

```
AmplifyEd - Thread Simulator
Live Inspector Panel
Replay Logs
```

---

# 3. Interpreter Contract (Phase 2 Standard)

Every interpreter response **must** be valid JSON between `{` and `}`.

### **Contract Schema**

```ts
{
  situation: "stall" | "dominance" | "confusion" | "healthy",
  move: "reflect" | "clarify" | "probe" | "reinforce" | "none",
  confidence: number (0-1)
}
```

### **Interpreter Responsibilities**

- Detect conversation state  
- Suggest the best facilitation move  
- Provide a confidence score  
- Output **only the JSON** (no prose)

---

# 4. Engine (Signals + Move Selection)

`runEngine` is the single runtime entry point for facilitator decisions. Every Socket.io handler or simulator that needs a move now calls this function, so the interpreter, detectors, and move priority logic stay unified.

### Inputs:
- `session`: live conversation state (messages, timing, tuning, metadata)
- `humanMsg`: the latest human-authored message object
- `role` / `roleGroup`: voice and permission hints (e.g., teacher/educator)
- `openai` + `model`: the OpenAI client and model identifier
- Optional tuning overrides (`tuning`, `systemOverride`, etc.)

### Outputs:
- `signals`: detectors that fired (confusion, barrier, nudge, dominance, etc.)
- `interpretation`: the structured contract plus reasoning and signal metadata
- `move`: normalized facilitator move with fields like `type`, `shouldReply`, `botMessage`, `source`, and `focusMessageId`

`move.botMessage`, when present, is the facilitator answer that the server broadcasts back to the UI. If `move.shouldReply` is `false`, the engine can still surface highlights via `move.focusMessageId` without writing another message.

---

# 5. Session Store

`sessionStore.js` manages state:

```
{
  messages,
  roleGroup,
  cooldownMs,
  lastIntervention,
  detectors: { stall, dominance, cooldown }
}
```

Each `sessionId` gets its own store.

---

# 6. Developer Sandbox UI

The UI provides:

- Message simulator  
- Role selector  
- Detective sliders  
- JSON replay  
- Live Inspector (Phase 2)  
- Prompt viewer (for live prompt overrides)  

Newly added:

- Inspector reads live contract JSON
- Cooldown, stall, and dominance reflect contract outputs  
- Replay pane can simulate fast-forward debugging

---

# 7. Coding Standards

### Interpreter
- return JSON only  
- enums must match contract schema  
- no extra text or logs

### Engine
- must be deterministic  
- must respect cooldown  
- must handle malformed contracts gracefully  

### Server
- no business logic  
- only routing, broadcasting, and state management  

### UI
- no AI logic  
- no engine/move selection logic  
- visualization only

---

# 8. Future Phases (Roadmap)

### **Phase 3 - Multi-Turn Memory & Pattern Sequencing**
- Track patterns across multiple turns  
- Predict when a stall is building  
- Detect spirals and unproductive loops  
- Proactive vs reactive interventions

### **Phase 4 - Custom PD Mode**
- Prompt-builder interface  
- Admin scripting  
- Real facilitator scripting

### **Phase 5 - AI Co-Facilitator**
- Two-agent model  
- Teacher perspective + PD facilitator perspective  

---

# 9. Contributions

All new modules must:

1. Be documented here  
2. Follow the contract-based architecture  
3. Include test scenarios in `/data/`  
4. Not break existing server/Socket.io flows  

---

# 10. Appendix: Glossary

**Interpreter**  
The AI model that analyzes conversation state and emits a JSON contract.

**Contract**  
The structured JSON that acts as the interface between the interpreter and move selection layer.

**Engine**  
The `runEngine` entry point that unifies detectors, interpretation, and move selection so the system can decide whether to intervene.

**Facilitator**  
The AI persona that `runEngine` voices when it emits a `botMessage`.

**Session Store**  
Live state of each PD session, including detectors and history.

**Cooldown**  
Minimum delay between interventions.
