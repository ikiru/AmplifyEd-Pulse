/* globals io */

// ----- sockets & elements -----
const socket = io();

const $ = (id) => document.getElementById(id);
const thread = $("thread");
const sessionEl = $("session");
const userEl = $("user");
const roleEl = $("role");
const roleGroupLabel = $("roleGroupLabel");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");

// status/inspector
const statusPill = $("statusPill");
const insConn = $("ins-conn");
const insModel = $("ins-model");
const insApi = $("ins-api");
const insRate = $("ins-rate");
const insDomPct = $("ins-dom-pct");
const barDom = $("bar-dom");
const insAgree = $("ins-agree");
const barAgree = $("bar-agree");
const insCooldown = $("ins-cooldown");

// seeds & transcript tools
const btnSeedStall = $("seedStall");
const btnSeedConfuse = $("seedConfuse");
const btnSeedDom = $("seedDom");
const btnExport = $("exportJson");
const btnCopyMd = $("copyMd");
const btnClearLocal = $("clearLocal");

// replay
const fileReplay = $("replayFile");
const btn1x = $("replay1x");
const btn2x = $("replay2x");
const btnStop = $("replayStop");

// prompt editor
const txtPrompt = $("promptOverride");
const btnApplyPrompt = $("applyPrompt");
const btnResetPrompt = $("resetPrompt");

// detector sliders
const thrDom = $("thrDom"), thrStall = $("thrStall"), cooldown = $("cooldown");
const valDom = $("valDom"), valStall = $("valStall"), valCooldown = $("valCooldown");

// session tabs
document.querySelectorAll(".sessTab").forEach(el=>{
  el.addEventListener("click", ()=>{ sessionEl.value = el.dataset.s; savePrefs() });
});

// ----- helpers -----
function roleToGroup(role){
  return (role === "nurse" || role === "school_nurse") ? "nurse" : "educator";
}
function savePrefs(){
  localStorage.setItem("sandboxPrefs",
    JSON.stringify({session:sessionEl.value,user:userEl.value,role:roleEl.value}));
}

// update role group pill
function updateRoleGroup(){
  roleGroupLabel.textContent = `Role Group: ${roleToGroup(roleEl.value)}`;
}
roleEl.addEventListener("change", ()=>{ updateRoleGroup(); savePrefs(); });
updateRoleGroup();

// ----- keyboard UX -----
messageInput.addEventListener("keydown", (e)=>{
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter"){ e.preventDefault(); send(); }
  if (e.key === "/" && messageInput.value === ""){
    // tiny slash commands
    e.preventDefault();
    messageInput.value = "/help";
  }
});
sendBtn.addEventListener("click", send);

function send(){
  const payload = {
    sessionId: sessionEl.value || "demo-1",
    userId: userEl.value || "User",
    role: roleEl.value || "teacher",
    text: messageInput.value.trim()
  };
  if (!payload.text) return;
  if (payload.text.startsWith("/")){
    handleSlash(payload.text);
    messageInput.value = "";
    return;
  }
  socket.emit("humanMessage", payload);
  messageInput.value = "";
}

// ----- slash commands -----
function handleSlash(cmd){
  const c = cmd.trim().toLowerCase();
  if (c === "/teacher"){ roleEl.value = "teacher"; updateRoleGroup(); savePrefs(); return; }
  if (c === "/nurse"){ roleEl.value = "nurse"; updateRoleGroup(); savePrefs(); return; }
  if (c === "/principal"){ roleEl.value = "principal"; updateRoleGroup(); savePrefs(); return; }
  if (c.startsWith("/seed ")){
    const kind = c.split(" ")[1];
    if (kind) runSeed(kind);
    return;
  }
  if (c === "/help"){
    alert("Slash commands:\n/teacher  /nurse  /principal\n/seed stall|confuse|dom");
  }
}

// ----- thread rendering -----
window.currentThread = [];
let lastBotAt = 0;
const COOL_DEFAULT = 45*1000;

socket.on("connect", ()=>{
  statusPill.textContent = "Connected";
  insConn.textContent = "yes";
  fetch("/health").then(r=>r.json()).then(h=>{
    insModel.textContent = h.model || "unknown";
    insApi.textContent = "ok";
  }).catch(()=>{ insApi.textContent = "err"; });
});

socket.on("disconnect", ()=>{
  statusPill.textContent = "Disconnected";
  insConn.textContent = "no";
});

socket.on("threadInit", (msgs)=>{
  thread.innerHTML = "";
  window.currentThread = msgs.slice();
  msgs.forEach(renderMsg);
  updateInspector();
});

socket.on("newMessage", (m)=>{
  window.currentThread.push(m);
  renderMsg(m);
  if (m.authorType === "bot") lastBotAt = Date.now();
  updateInspector();
});

function renderMsg(m){
  const div = document.createElement("div");
  div.className = "msg";
  const who = m.authorType === "bot" ? "AmplifyEd" : (m.userId || "User");
  const t = new Date(m.ts).toLocaleTimeString();
  div.innerHTML = `<strong>${escapeHtml(who)}</strong> <span class="meta">— ${t}</span><br>${escapeHtml(m.text)}`;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
}

function escapeHtml(s){return (s||"").replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// ----- inspector math -----
function updateInspector(){
  const now = Date.now();
  // speaking rate per 5m for this user
  const fiveMinAgo = now - 5*60*1000;
  const mine = window.currentThread.filter(m => m.userId === (userEl.value||"User") && m.ts >= fiveMinAgo);
  const rate = (mine.length/5).toFixed(1);
  insRate.textContent = `${rate} msg/min`;

  // dominance = top poster share over last 20
  const recent = window.currentThread.slice(-20);
  const counts = {};
  recent.forEach(m=>{
    const key = m.authorType === "bot" ? "AmplifyEd" : (m.userId||"User");
    counts[key] = (counts[key]||0)+1;
  });
  const total = recent.length || 1;
  const maxC = Math.max(0, ...Object.values(counts));
  const dom = (maxC/total);
  insDomPct.textContent = `${Math.round(dom*100)}%`;
  barDom.style.width = `${Math.round(dom*100)}%`;

  // agree/+1 share in last 20
  const agreeLike = recent.filter(m => /^(\+1|i agree|same|agreed)$/i.test(m.text?.trim()));
  const agreePct = Math.round((agreeLike.length/total)*100);
  insAgree.textContent = `${agreePct}%`;
  barAgree.style.width = `${agreePct}%`;

  // cooldown
  const coolMs = Number(localStorage.getItem("cooldownMs") || COOL_DEFAULT);
  const left = Math.max(0, coolMs - (now - lastBotAt));
  insCooldown.textContent = left ? `${Math.ceil(left/1000)}s` : "ready";
}

// ----- detector sliders (emit to server if supported) -----
function updateTuning(){
  const dom = Number(thrDom.value);
  const stall = Number(thrStall.value);
  const cd = Number(cooldown.value)*1000;
  valDom.textContent = dom.toFixed(2);
  valStall.textContent = stall.toFixed(2);
  valCooldown.textContent = `${cooldown.value}s`;
  localStorage.setItem("cooldownMs", String(cd));
  socket.emit("tuning", { dominance: dom, stall, cooldownMs: cd });
  updateInspector();
}
[thrDom,thrStall,cooldown].forEach(el=>el.addEventListener("input", updateTuning));
updateTuning();

// ----- prompt editor -----
btnApplyPrompt.addEventListener("click", ()=>{
  const text = txtPrompt.value.trim();
  socket.emit("promptOverride", { text });
  alert("Prompt override sent (server must support it).");
});
btnResetPrompt.addEventListener("click", ()=>{
  txtPrompt.value = "";
  socket.emit("promptOverride", { text: "" });
});

// ----- seeds -----
btnSeedStall.addEventListener("click", ()=>runSeed("stall"));
btnSeedConfuse.addEventListener("click", ()=>runSeed("confuse"));
btnSeedDom.addEventListener("click", ()=>runSeed("dom"));

function runSeed(kind){
  const sess = sessionEl.value || "demo-1";
  const me = userEl.value || "User";
  const role = roleEl.value || "teacher";

  const push = (user, text) => socket.emit("humanMessage", { sessionId:sess, userId:user, role, text });

  if (kind === "stall"){
    ["I agree","Same","+1","I agree","+1"].forEach((t,i)=> setTimeout(()=>push(`User${i+1}`,t), i*200));
    return;
  }
  if (kind === "confuse"){
    ["What are we supposed to do here?","I’m lost","Can someone restate the goal?"]
      .forEach((t,i)=> setTimeout(()=>push(`User${i+1}`,t), i*250));
    return;
  }
  if (kind === "dom"){
    for (let i=0;i<6;i++) setTimeout(()=>push(me, `My take ${i+1}`), i*220);
  }
}

// ----- transcript tools -----
btnExport.addEventListener("click", ()=>{
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(window.currentThread,null,2)],{type:"application/json"}));
  a.download = `${sessionEl.value||"session"}.json`;
  a.click();
});
btnCopyMd.addEventListener("click", ()=>{
  const md = window.currentThread.map(m=>{
    const who = m.authorType==='bot' ? 'AmplifyEd' : (m.userId||'User');
    return `**${who}**: ${m.text}`;
  }).join("\n\n");
  navigator.clipboard.writeText(md);
});
btnClearLocal.addEventListener("click", ()=>{
  thread.innerHTML = ""; window.currentThread = [];
});

// ----- replay -----
let replayTimer = null;
function stopReplay(){ if (replayTimer){ clearTimeout(replayTimer); replayTimer=null; } }
btnStop.addEventListener("click", stopReplay);
fileReplay.addEventListener("change", async (e)=>{
  stopReplay();
  const f = e.target.files?.[0]; if (!f) return;
  const text = await f.text();
  try { window._replayData = JSON.parse(text); alert("Replay loaded."); }
  catch { alert("Invalid JSON"); }
});
btn1x.addEventListener("click", ()=> playReplay(1));
btn2x.addEventListener("click", ()=> playReplay(2));

function playReplay(speed=1){
  stopReplay();
  const data = Array.isArray(window._replayData) ? window._replayData : [];
  if (!data.length){ alert("Load a transcript JSON first."); return; }
  thread.innerHTML=""; window.currentThread=[];
  const base = data[0]?.ts || Date.now();
  let i=0;
  const tick = ()=>{
    if (i>=data.length) return;
    const m = data[i++];
    window.currentThread.push(m);
    renderMsg(m);
    const next = data[i]?.ts ?? base;
    const delay = Math.max(20, ((next - m.ts) / speed));
    replayTimer = setTimeout(tick, delay);
  };
  tick();
}

// ----- role group label on load -----
roleGroupLabel.textContent = `Role Group: ${roleToGroup(roleEl.value)}`;
