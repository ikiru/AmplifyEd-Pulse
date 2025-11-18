# AmplifyEd Pulse — System Architecture

_Last updated: Phase 2 (Interpreter Contract + Facilitator Integration)_

AmplifyEd Pulse is a real-time professional-learning simulator designed to model teacher discussions, detect conversational patterns (stall, dominance, confusion), and optionally intervene with an AI facilitator. The system is divided into clearly bounded modules:

- **Server Layer** (Node.js + Socket.io)  
- **Interpreter Layer** (AI “brain” that generates contracts)  
- **Facilitator Layer** (applies intervention logic based on the contract)  
- **Web Client / Sandbox UI** (simulator + developer tools)

This document explains the file structure, each subsystem, message flow, and development standards.

---

# 1. Repository Structure

```
AMPLIFYED-PULSE/
│
├── server.js
├── sandbox_server.js
├── pulse_process_utils.js
│
├── public/
│   ├── index.html
│   ├── client.js
│   └── styles.css
│
├── sandbox/
│   ├── liveDiscussion.js
│   ├── interpreter.js              ← Added in Phase 2
│   ├── facilitatorLogic.js         ← Updated in Phase 2
│   ├── contractParser.js           ← New helper module
│   ├── sessionStore.js             ← State per session
│   └── ...
│
├── data/
│   └── sample_messages.json
│
├── prompts/
│   └── ai_system_prompts.md
│
├── docs/
│   └── architecture.md             ← (this file)
│
└── package.json
```

**Key folders:**

### `/sandbox/`
Contains all logic for:
- interpreter (AI)
- facilitator logic
- session state
- contract parsing
- developer tool integrations (Live Inspector)

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
User Message → Server → Interpreter → Facilitator → Server → UI
```

### 2.1. User message enters system
Client posts a message to the server via Socket.io:

```
socket.emit("message", { sessionId, role, text })
```

### 2.2. Server forwards the message to the Interpreter
The server passes the raw string to:

```
sandbox/interpreter.js
```

Interpreter always returns a **contract object**:

```json
{
  "situation": "stall | dominance | confusion | healthy",
  "move": "reflect | clarify | probe | reinforce | none",
  "confidence": 0.78
}
```

### 2.3. Contract parser validates interpreter output
`contractParser.js` ensures:
- the response contains valid JSON  
- the fields match allowed enums  
- missing fields are filled with defaults  
- invalid output returns `null` (do nothing)

### 2.4. Facilitator decides whether to intervene
`facilitatorLogic.js` reads:
- situation
- cooldown timers
- message counts
- session state

And returns one of:

- `{ hasReply: true, message: "…" }`
- `{ hasReply: false }`

### 2.5. Server emits facilitator message (if any)
Server broadcasts back to:

```
AmplifyEd — Thread Simulator
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
  confidence: number (0–1)
}
```

### **Interpreter Responsibilities**

- Detect conversation state  
- Suggest the best facilitation move  
- Provide a confidence score  
- Output **only the JSON** (no prose)

---

# 4. Facilitator Logic

The facilitator transforms the interpreter contract into an actual system action.

### Inputs:
- Contract object `{ situation, move, confidence }`
- Session metadata (message count, cooldown, last intervention time)
- Detector controls (dominance slider, stall slider, cooldown slider)

### Outputs:
- Whether an intervention occurs
- The actual facilitator message
- Updated session state

### Intervention examples:

| Situation  | Move       | Sample Facilitator Action |
|------------|------------|---------------------------|
| stall      | clarify    | “I’m hearing a pause. What part feels unclear right now?” |
| dominance  | reflect    | “Let’s open space — what are others noticing here?” |
| confusion  | probe      | “What part would be most helpful to revisit?” |
| healthy    | none       | No intervention |

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

### Facilitator
- must be deterministic  
- must respect cooldown  
- must handle malformed contracts gracefully  

### Server
- no business logic  
- only routing, broadcasting, and state management  

### UI
- no AI logic  
- no facilitator logic  
- visualization only

---

# 8. Future Phases (Roadmap)

### **Phase 3 — Multi-Turn Memory & Pattern Sequencing**
- Track patterns across multiple turns  
- Predict when a stall is building  
- Detect spirals and unproductive loops  
- Proactive vs reactive interventions

### **Phase 4 — Custom PD Mode**
- Prompt-builder interface  
- Admin scripting  
- Real facilitator scripting

### **Phase 5 — AI Co-Facilitator**
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
The structured JSON that acts as the interface between AI and facilitator.

**Facilitator**  
Logic engine deciding how (or whether) the system should intervene.

**Session Store**  
Live state of each PD session, including detectors and history.

**Cooldown**  
Minimum delay between interventions.

