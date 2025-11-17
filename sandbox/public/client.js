/* globals io */
// AmplifyEd Sandbox — client (hardened)

////////////////////////////////////////
// Socket + DOM helpers
////////////////////////////////////////

const ioOrigin = window.location.origin; // avoid port mismatches
const socket = io("http://localhost:4001", {
  transports: ["websocket", "polling"],
  withCredentials: true
});


const $id = (id) => document.getElementById(id);

// Core UI refs (guarded)
const thread         = $id('thread');
const sessionEl      = $id('session');
const userEl         = $id('user');
const roleEl         = $id('role');
const roleGroupLabel = $id('roleGroupLabel');
const messageInput   = $id('messageInput');
const sendBtn        = $id('sendBtn');

// Inspector/status
const statusPill   = $id('statusPill');
const insConn      = $id('ins-conn');
const insModel     = $id('ins-model');
const insApi       = $id('ins-api');
const insRate      = $id('ins-rate');
const insDomPct    = $id('ins-dom-pct');
const barDom       = $id('bar-dom');
const insAgree     = $id('ins-agree');
const barAgree     = $id('bar-agree');
const insCooldown  = $id('ins-cooldown');
let cooldownOverride = null;

// Seeds/tools
const btnSeedStall   = $id('seedStall');
const btnSeedConfuse = $id('seedConfuse');
const btnSeedDom     = $id('seedDom');
const btnExport      = $id('exportJson');
const btnCopyMd      = $id('copyMd');
const btnClearLocal  = $id('clearLocal');
const toolsRow = document.querySelector(".tools-row");
let btnClearServer = null;
if (toolsRow) {
  btnClearServer = document.createElement("button");
  btnClearServer.textContent = "Clear (server)";
  btnClearServer.id = "clearServer";
  btnClearServer.className = "btn";
  toolsRow.appendChild(btnClearServer);
}

// Replay
const fileReplay = $id('replayFile');
const btn1x      = $id('replay1x');
const btn2x      = $id('replay2x');
const btnStop    = $id('replayStop');

// Prompt
const txtPrompt     = $id('promptOverride');
const btnApplyPrompt= $id('applyPrompt');
const btnResetPrompt= $id('resetPrompt');

// Detector sliders
const thrDom    = $id('thrDom');
const thrStall  = $id('thrStall');
const cooldown  = $id('cooldown');
const valDom    = $id('valDom');
const valStall  = $id('valStall');
const valCooldown = $id('valCooldown');

// Session tabs
document.querySelectorAll('.sessTab').forEach(el => {
  el.addEventListener('click', () => { if (sessionEl) sessionEl.value = el.dataset.s; savePrefs(); });
});

////////////////////////////////////////
// Utilities
////////////////////////////////////////

function roleToGroup(role) {
  return (role === 'nurse' || role === 'school_nurse') ? 'nurse' : 'educator';
}
function savePrefs(){
  if (!sessionEl || !userEl || !roleEl) return;
  localStorage.setItem('sandboxPrefs', JSON.stringify({
    session: sessionEl.value,
    user: userEl.value,
    role: roleEl.value
  }));
}
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function currentIdent(){
  return {
    sessionId: (sessionEl && sessionEl.value) || 'demo-1',
    userId   : (userEl && userEl.value) || 'User',
    role     : (roleEl && roleEl.value) || 'teacher'
  };
}

////////////////////////////////////////
// Role group label
////////////////////////////////////////

if (roleEl && roleGroupLabel) {
  const upd = () => { roleGroupLabel.textContent = `Role Group: ${roleToGroup(roleEl.value)}`; };
  roleEl.addEventListener('change', () => { upd(); savePrefs(); });
  upd();
}

////////////////////////////////////////
// Keyboard / send
////////////////////////////////////////

if (messageInput) {
  messageInput.addEventListener('keydown', (e) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    // Cmd/Ctrl+Enter also sends (your original behavior)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
      return;
    }
    // Slash helper
    if (e.key === '/' && messageInput.value === '') {
      e.preventDefault();
      messageInput.value = '/help';
    }
  });
}
if (sendBtn) sendBtn.addEventListener('click', send);

////////////////////////////////////////
// Thread state + inspector
////////////////////////////////////////

window.currentThread = [];
const seenMessageIds = new Set();
let lastBotAt = 0;
const COOL_DEFAULT = 45 * 1000;

function makeMessageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderMsg(m) {
  if (!thread) return;
  const div = document.createElement('div');
  div.className = 'msg';
  const who = m.authorType === 'bot' ? 'AmplifyEd' : (m.userId || 'User');
  const t = new Date(m.ts || Date.now()).toLocaleTimeString();
  div.innerHTML = `<strong>${escapeHtml(who)}</strong> <span class="meta">— ${t}</span><br>${escapeHtml(m.text)}`;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function updateInspector(){
  const now = Date.now();
  const fiveMinAgo = now - 5*60*1000;
  const me = (userEl && userEl.value) || 'User';

  // speaking rate (my msgs in last 5m)
  const mine = window.currentThread.filter(m => m.userId === me && m.ts >= fiveMinAgo);
  if (insRate) insRate.textContent = `${(mine.length/5).toFixed(1)} msg/min`;

  // dominance (top poster share over last 20)
  const recent = window.currentThread.slice(-20);
  const counts = {};
  recent.forEach(m=>{
    const key = m.authorType === 'bot' ? 'AmplifyEd' : (m.userId||'User');
    counts[key] = (counts[key]||0) + 1;
  });
  const total = recent.length || 1;
  const maxC = Math.max(0, ...Object.values(counts));
  const dom = (maxC / total);
  if (insDomPct) insDomPct.textContent = `${Math.round(dom*100)}%`;
  if (barDom) barDom.style.width = `${Math.round(dom*100)}%`;

  // agree share
  const agreeLike = recent.filter(m => /^(\+1|i agree|same|agreed)$/i.test(m.text?.trim()));
  const agreePct = Math.round((agreeLike.length/total)*100);
  if (insAgree) insAgree.textContent = `${agreePct}%`;
  if (barAgree) barAgree.style.width = `${agreePct}%`;

  // cooldown
  const coolMs = Number(localStorage.getItem('cooldownMs') || COOL_DEFAULT);
  const left = Math.max(0, coolMs - (now - lastBotAt));
  if (insCooldown) {
    if (cooldownOverride) {
      insCooldown.textContent = cooldownOverride.ready
        ? 'ready'
        : `${Math.ceil(cooldownOverride.remaining / 1000)}s`;
    } else {
      insCooldown.textContent = left ? `${Math.ceil(left/1000)}s` : 'ready';
    }
  }
}

////////////////////////////////////////
// Socket lifecycle
////////////////////////////////////////

setStatus('Connecting…');

socket.on('connect', () => {
  console.log('[client] connected', socket.id);
  setStatus('Connected');
  if (insConn) insConn.textContent = 'yes';
  // health ping
  fetch('/health')
    .then(r => r.json())
    .then(h => { if (insModel) insModel.textContent = h.model || 'unknown'; if (insApi) insApi.textContent = 'ok'; })
    .catch(() => { if (insApi) insApi.textContent = 'err'; });
});

socket.on('disconnect', (reason) => {
  console.warn('[client] disconnected', reason);
  setStatus('Disconnected');
  if (insConn) insConn.textContent = 'no';
});

socket.on('threadInit', (msgs=[]) => {
  if (thread) thread.innerHTML = '';
  seenMessageIds.clear();
  cooldownOverride = null;
  window.currentThread = msgs.slice();
  msgs.forEach((msg) => {
    if (msg.id) {
      seenMessageIds.add(msg.id);
    }
    renderMsg(msg);
  });
  updateInspector();
});

socket.on('newMessage', (m) => {
  upsertMessageFromServer(m);
});

// --- Cooldown Update Listener ---
socket.on('cooldownUpdate', ({ remainingMs = 0 }) => {
  cooldownOverride = { ready: remainingMs <= 0, remaining: remainingMs };
  const el = document.getElementById('ins-cooldown');
  if (!el) return;

  let seconds = Math.ceil(remainingMs / 1000);
  el.textContent = seconds > 0 ? seconds + 's' : 'ready';

  if (window._cooldownTimer) clearInterval(window._cooldownTimer);

  if (seconds > 0) {
    window._cooldownTimer = setInterval(() => {
      seconds--;
      el.textContent = seconds > 0 ? seconds + 's' : 'ready';
      if (seconds <= 0) {
        clearInterval(window._cooldownTimer);
        window._cooldownTimer = null;
      }
    }, 1000);
  }
});

function setStatus(text){
  if (statusPill) statusPill.textContent = text;
}

////////////////////////////////////////
// Send + slash commands
////////////////////////////////////////

function handleSlash(cmd){
  const c = (cmd || '').trim().toLowerCase();
  if (!c) return;

  if (c === '/teacher' && roleEl){ roleEl.value = 'teacher'; updateRolePill(); return; }
  if (c === '/nurse'   && roleEl){ roleEl.value = 'nurse';   updateRolePill(); return; }
  if (c === '/principal' && roleEl){ roleEl.value = 'principal'; updateRolePill(); return; }

  if (c.startsWith('/seed ')) {
    const kind = c.split(' ')[1];
    if (kind) runSeed(kind);
    return;
  }

  if (c === '/help') {
    alert('Slash commands:\n/teacher  /nurse  /principal\n/seed stall|confuse|dom');
  }
}

function updateRolePill(){
  if (roleEl && roleGroupLabel) {
    roleGroupLabel.textContent = `Role Group: ${roleToGroup(roleEl.value)}`;
    savePrefs();
  }
}

function send(){
  if (!messageInput) return;
  const text = messageInput.value.trim();
  if (!text) return;

  const ident = currentIdent();

  // Slash commands handled locally
  if (text.startsWith('/')) {
    handleSlash(text);
    messageInput.value = '';
    return;
  }

  // Optimistic render so the user sees instant feedback
  const localMsg = {
    id: makeMessageId(),
    ...ident,
    text,
    ts: Date.now(),
    authorType: 'human'
  };
  upsertLocalMessage(localMsg);

  console.log('[client] emit humanMessage', localMsg);
  socket.emit('humanMessage', localMsg);

  messageInput.value = '';
  messageInput.focus();
}

////////////////////////////////////////
/** Tuning / Prompt **/
////////////////////////////////////////

function updateTuning(){
  const dom = Number(thrDom?.value ?? 0.4);
  const stall = Number(thrStall?.value ?? 0.25);
  const cdSec = Number(cooldown?.value ?? 45);
  const cdMs = cdSec * 1000;

  if (valDom) valDom.textContent = dom.toFixed(2);
  if (valStall) valStall.textContent = stall.toFixed(2);
  if (valCooldown) valCooldown.textContent = `${cdSec}s`;

  localStorage.setItem('cooldownMs', String(cdMs));
  socket.emit('tuning', { dominance: dom, stall, cooldownMs: cdMs });
  updateInspector();
}
[thrDom, thrStall, cooldown].forEach(el => el && el.addEventListener('input', updateTuning));
updateTuning();

if (btnApplyPrompt && txtPrompt) {
  btnApplyPrompt.addEventListener('click', ()=>{
    const text = txtPrompt.value.trim();
    socket.emit('promptOverride', { text });
    alert('Prompt override sent (server must support it).');
  });
}
if (btnResetPrompt && txtPrompt) {
  btnResetPrompt.addEventListener('click', ()=>{
    txtPrompt.value = '';
    socket.emit('promptOverride', { text: '' });
  });
}

////////////////////////////////////////
/** Seeds **/
////////////////////////////////////////

function runSeed(kind){
  const { sessionId, userId, role } = currentIdent();
  const push = (who, text) => socket.emit('humanMessage', {
    sessionId,
    userId: who,
    role,
    text,
    ts: Date.now(),
    authorType: 'human'
  });

  if (kind === 'stall'){
    ['I agree','Same','+1','I agree','+1'].forEach((t,i)=> setTimeout(()=>push(`User${i+1}`, t), i*200));
    return;
  }
  if (kind === 'confuse'){
    ['What are we supposed to do here?','I’m lost','Can someone restate the goal?']
      .forEach((t,i)=> setTimeout(()=>push(`User${i+1}`, t), i*250));
    return;
  }
  if (kind === 'dom'){
    for (let i=0;i<6;i++) setTimeout(()=>push(userId, `My take ${i+1}`), i*220);
  }
}

btnSeedStall   && btnSeedStall.addEventListener('click', ()=>runSeed('stall'));
btnSeedConfuse && btnSeedConfuse.addEventListener('click', ()=>runSeed('confuse'));
btnSeedDom     && btnSeedDom.addEventListener('click', ()=>runSeed('dom'));

////////////////////////////////////////
/** Transcript Tools **/
////////////////////////////////////////

btnExport && btnExport.addEventListener('click', ()=>{
  const name = (sessionEl && sessionEl.value) || 'session';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window.currentThread,null,2)], { type:'application/json' }));
  a.download = `${name}.json`;
  a.click();
});

btnCopyMd && btnCopyMd.addEventListener('click', ()=>{
  const md = window.currentThread.map(m => {
    const who = m.authorType==='bot' ? 'AmplifyEd' : (m.userId||'User');
    return `**${who}**: ${m.text}`;
  }).join('\n\n');
  navigator.clipboard.writeText(md);
});

btnClearLocal && btnClearLocal.addEventListener('click', ()=>{
  if (thread) thread.innerHTML = '';
  seenMessageIds.clear();
  window.currentThread = [];
  updateInspector();
});

const clearServer = () => {
  const ident = currentIdent();
  socket.emit("clearSession", { sessionId: ident.sessionId });
};

btnClearServer && btnClearServer.addEventListener("click", clearServer);

////////////////////////////////////////
/** Replay **/
////////////////////////////////////////

let replayTimer = null;
function stopReplay(){ if (replayTimer){ clearTimeout(replayTimer); replayTimer = null; } }
btnStop && btnStop.addEventListener('click', stopReplay);

fileReplay && fileReplay.addEventListener('change', async (e)=>{
  stopReplay();
  const f = e.target.files?.[0]; if (!f) return;
  const text = await f.text();
  try { window._replayData = JSON.parse(text); alert('Replay loaded.'); }
  catch { alert('Invalid JSON'); }
});

btn1x && btn1x.addEventListener('click', ()=> playReplay(1));
btn2x && btn2x.addEventListener('click', ()=> playReplay(2));

function playReplay(speed=1){
  stopReplay();
  const data = Array.isArray(window._replayData) ? window._replayData : [];
  if (!data.length){ alert('Load a transcript JSON first.'); return; }
  if (thread) thread.innerHTML = '';
  window.currentThread = [];
  const base = data[0]?.ts || Date.now();
  let i = 0;
  const tick = ()=>{
    if (i >= data.length) return;
    const m = data[i++];
    window.currentThread.push(m);
    renderMsg(m);
    const nextTs = data[i]?.ts ?? base;
    const delay = Math.max(20, ((nextTs - m.ts) / speed));
    replayTimer = setTimeout(tick, delay);
  };
  tick();
}

function upsertLocalMessage(msg) {
  if (!msg) return;
  if (msg.id) {
    seenMessageIds.add(msg.id);
  }
  const existingIndex = msg.id ? window.currentThread.findIndex((m) => m.id === msg.id) : -1;
  if (existingIndex >= 0) {
    window.currentThread[existingIndex] = { ...window.currentThread[existingIndex], ...msg };
    rerenderThread();
  } else {
    window.currentThread.push(msg);
    renderMsg(msg);
  }
  updateInspector();
}

function upsertMessageFromServer(msg) {
  if (!msg) return;
  if (msg.id) {
    const idx = window.currentThread.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      window.currentThread[idx] = { ...window.currentThread[idx], ...msg };
      rerenderThread();
    } else {
      seenMessageIds.add(msg.id);
      window.currentThread.push(msg);
      renderMsg(msg);
    }
  } else {
    window.currentThread.push(msg);
    renderMsg(msg);
  }
  if (msg.authorType === 'bot') lastBotAt = Date.now();
  updateInspector();
}

function rerenderThread() {
  if (!thread) return;
  thread.innerHTML = '';
  window.currentThread.forEach(renderMsg);
}
