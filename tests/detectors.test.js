import { describe, it, expect } from "@jest/globals";
import {
  classifyContent,
  isDominating,
  momentumScore,
  detectSituation,
} from "../sandbox/facilitator/detectors.js";
import { makeSession } from "./helpers/mockSession.js";

const botMsg = (text, userId = "bot") => ({ text, authorType: "bot", userId });
const humanMsg = (text, userId = "User") => ({ text, authorType: "human", userId });

describe("classifyContent", () => {
  it("identifies common phrases", () => {
    expect(classifyContent("I agree")).toBe("agreement");
    expect(classifyContent("+1")).toBe("agreement");
    expect(classifyContent("I'm lost"))
      .toBe("confusion");
    expect(classifyContent("what are we doing?")).toBe("confusion");
    expect(classifyContent("This is stupid")).toBe("venting");
    expect(classifyContent("Here\u2019s my idea for the lesson"))
      .toBe("constructive");
  });
});

describe("isDominating", () => {
  it("returns false when under six total messages", () => {
    const session = makeSession();
    session.userStats = {
      a: { count: 3 },
      b: { count: 2 },
    };
    expect(isDominating(session, "a")).toBe(false);
  });

  it("returns true when a user exceeds 40% of messages", () => {
    const session = makeSession();
    session.userStats = {
      a: { count: 5 },
      b: { count: 2 },
      c: { count: 1 },
    };
    expect(isDominating(session, "a")).toBe(true);
  });
});

describe("momentumScore", () => {
  it("increases with longer average messages", () => {
    const shortSession = makeSession([
      humanMsg("Hi", "a"),
      humanMsg("Ok", "b"),
      humanMsg("Sure", "c"),
    ]);
    const longSession = makeSession([
      humanMsg("This is a thoughtful reflection about our strategy and where it could go next.", "a"),
      humanMsg("Adding more specifics to demonstrate the richer context of our work.", "b"),
      humanMsg("Another lengthy response that should bump the average length.", "c"),
    ]);

    expect(momentumScore(longSession)).toBeGreaterThan(momentumScore(shortSession));
  });

  it("increases with more unique participants", () => {
    const oneUser = makeSession([
      humanMsg("note", "solo"),
      humanMsg("note", "solo"),
      humanMsg("note", "solo"),
    ]);
    const manyUsers = makeSession([
      humanMsg("note", "u1"),
      humanMsg("note", "u2"),
      humanMsg("note", "u3"),
      humanMsg("note", "u4"),
    ]);

    expect(momentumScore(manyUsers)).toBeGreaterThan(momentumScore(oneUser));
  });

  it("reduces slightly when agreements dominate", () => {
    const normal = makeSession([
      humanMsg("Idea one", "u1"),
      humanMsg("Idea two", "u2"),
      humanMsg("Idea three", "u3"),
    ]);
    const lotsOfAgreement = makeSession([
      humanMsg("I agree", "u1"),
      humanMsg("+1", "u2"),
      humanMsg("Same", "u3"),
      humanMsg("I agree", "u4"),
    ]);

    expect(momentumScore(lotsOfAgreement)).toBeLessThan(momentumScore(normal));
  });
});

describe("detectSituation", () => {
  it("returns 'confused' when confusion detected", () => {
    const session = makeSession([
      humanMsg("Let's start", "u1"),
      humanMsg("I am confused about this", "u2"),
    ]);
    expect(detectSituation(session)).toBe("confused");
  });

  it("returns 'barrier' when venting and low momentum", () => {
    const session = makeSession([
      humanMsg("This is stupid", "u1"),
      humanMsg("Still confused", "u1"),
      humanMsg("Same", "u1"),
    ]);
    expect(detectSituation(session)).toBe("barrier");
  });

  it("returns 'stalled' when momentum is low without venting", () => {
    const session = makeSession([
      humanMsg("ok", "u1"),
      humanMsg("ok", "u1"),
      humanMsg("ok", "u1"),
    ]);
    expect(detectSituation(session)).toBe("stalled");
  });

  it("returns 'healthy' for balanced conversation", () => {
    const session = makeSession([
      humanMsg("Idea", "u1"),
      humanMsg("Response", "u2"),
      humanMsg("Follow up", "u3"),
      humanMsg("Another take", "u4"),
    ]);
    expect(detectSituation(session)).toBe("healthy");
  });
});
