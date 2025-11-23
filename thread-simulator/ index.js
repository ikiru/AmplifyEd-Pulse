import { ThreadSimulator } from "./ThreadSimulator.js";

// Provide OpenAI + model
const simulator = new ThreadSimulator({
  openai: globalThis.openaiClient,
  model: "gpt-4.1"
});

// Simulate a chat
simulator.userSend("I don't understand this.");
simulator.userSend("This is wrong.");
simulator.userSend("Can you sum this up?");
