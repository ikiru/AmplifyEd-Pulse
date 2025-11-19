// sandbox/tests/run_pd_simulation.js
import { io } from "socket.io-client";

const URL = "http://localhost:4001";
const ROOM = "demo-1";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log("Connecting to:", URL);

  const socket = io(URL, {
    transports: ["websocket"],
    reconnection: false
  });

  socket.on("connect", () => {
    console.log("✅ Connected to AmplifyEd sandbox");
    socket.emit("joinRoom", { roomId: ROOM, userId: "Simulator" });
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Connection error:", err);
    process.exit(1);
  });

  // Log messages received from server
  socket.on("message", (msg) => {
    console.log("📨 Server:", msg);
  });

  // Wait for connection
  await sleep(1000);

  console.log("Sending test messages...");
  socket.emit("humanMessage", {
    roomId: ROOM,
    userId: "Teachera",
    authorType: "human",
    role: "teacher",
    text: "This is a test of the PD simulation script."
  });

  await sleep(500);

  socket.emit("humanMessage", {
    roomId: ROOM,
    userId: "Teacherb",
    authorType: "human",
    role: "teacher",
    text: "Adding another message to drive activity."
  });

  console.log("✔ Simulation complete");
  await sleep(1000);

  socket.disconnect();
  process.exit(0);
}

run();

