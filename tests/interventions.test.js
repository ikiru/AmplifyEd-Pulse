import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { maybeIntervene } from "../sandbox/facilitator/facilitatorLogic.js";
import { makeSession } from "./helpers/mockSession.js";

const model = "test-model";
let openai;

const baseSession = (messages = []) => {
  const session = makeSession(messages);
  session.userStats = {};
  session.tuning = { dominance: 0.4, stall: 0.25, cooldownMs: 1000 };
  session.promptOverride = "";
  session.lastBotAt = Date.now() - 60_000; // ensure throttle satisfied
  return session;
};

beforeEach(() => {
  openai = {
    responses: {
      create: jest.fn().mockResolvedValue({
        output_text: "Mock reply",
        output: [{ content: [{ text: "Mock reply" }] }],
      }),
    },
  };
});

describe("maybeIntervene agreement handling", () => {
  it("ignores isolated agreement", async () => {
    const session = baseSession([{ text: "I agree", authorType: "human", userId: "u1" }]);
    session.agreeBurst.count = 1;

    const result = await maybeIntervene({
      session,
      sessionId: "demo-1",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(result).toBeNull();
    expect(openai.responses.create).not.toHaveBeenCalled();
  });

  it("ignores bursts under five", async () => {
    const session = baseSession([{ text: "+1", authorType: "human", userId: "u1" }]);
    session.agreeBurst.count = 4;

    const result = await maybeIntervene({
      session,
      sessionId: "demo-1",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(result).toBeNull();
    expect(openai.responses.create).not.toHaveBeenCalled();
  });

  it("fires agreement burst move when count >= 5", async () => {
    const session = baseSession([{ text: "Same", authorType: "human", userId: "u1" }]);
    session.agreeBurst.count = 5;

    openai.responses.create.mockResolvedValueOnce({
      output_text: "Consensus reply",
      output: [{ content: [{ text: "Consensus reply" }] }],
    });

    const result = await maybeIntervene({
      session,
      sessionId: "demo-1",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(openai.responses.create).toHaveBeenCalledTimes(1);
    expect(result).toContain("Consensus reply");
  });
});

describe("maybeIntervene move selection", () => {
  it("selects clarify when confusion present", async () => {
    const session = baseSession([
      { text: "Let's begin", authorType: "human", userId: "u1" },
      { text: "I'm lost", authorType: "human", userId: "u2" },
    ]);

    const result = await maybeIntervene({
      session,
      sessionId: "demo-clarify",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(openai.responses.create).toHaveBeenCalled();
    expect(result).toContain("Mock reply");
  });

  it("invites when a user dominates", async () => {
    const session = baseSession([
      { text: "Thoughts", authorType: "human", userId: "dom" },
      { text: "More thoughts", authorType: "human", userId: "dom" },
    ]);
    session.userStats = {
      dom: { count: 5 },
      other: { count: 2 },
    };

    const result = await maybeIntervene({
      session,
      sessionId: "demo-invite",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(openai.responses.create).toHaveBeenCalled();
    expect(result).toContain("Mock reply");
  });

  it("nudges when conversation is stalled", async () => {
    const session = baseSession([
      { text: "ok", authorType: "human", userId: "u1" },
      { text: "ok", authorType: "human", userId: "u1" },
      { text: "ok", authorType: "human", userId: "u1" },
    ]);

    const result = await maybeIntervene({
      session,
      sessionId: "demo-stalled",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(openai.responses.create).toHaveBeenCalled();
    expect(result).toContain("Mock reply");
  });

  it("reframes when venting with barriers detected", async () => {
    const session = baseSession([
      { text: "This is stupid", authorType: "human", userId: "u1" },
      { text: "Still stuck", authorType: "human", userId: "u1" },
    ]);

    const result = await maybeIntervene({
      session,
      sessionId: "demo-barrier",
      roleGroup: "educator",
      openai,
      model,
      systemOverride: "",
    });

    expect(openai.responses.create).toHaveBeenCalled();
    expect(result).toContain("Mock reply");
  });
});
