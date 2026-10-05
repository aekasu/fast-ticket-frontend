import { describe, expect, it } from "vitest";
import { StaleBatch, queryKeysForEvent } from "./keys";

describe("queryKeysForEvent", () => {
  it("maps the aggregates the screens read", () => {
    expect(queryKeysForEvent("ticket")).toEqual([["tickets"]]);
    expect(queryKeysForEvent("task")).toEqual([["tasks"]]);
    expect(queryKeysForEvent("user")).toEqual([["users"]]);
    expect(queryKeysForEvent("org")).toEqual([["orgs"], ["users"]]);
    expect(queryKeysForEvent("kb.faq")).toEqual([["kb"]]);
    expect(queryKeysForEvent("kb.category")).toEqual([["kb"]]);
    expect(queryKeysForEvent("kb.canned")).toEqual([["kb"]]);
  });

  it("treats an agent's own change as able to change what they may do", () => {
    expect(queryKeysForEvent("staff")).toContainEqual(["me"]);
    expect(queryKeysForEvent("dept")).toContainEqual(["me"]);
    expect(queryKeysForEvent("team")).toContainEqual(["admin"]);
  });

  it("refetches everything for an aggregate it does not know, rather than miss a change", () => {
    expect(queryKeysForEvent("something.new")).toBe("all");
    expect(queryKeysForEvent("")).toBe("all");
  });
});

describe("StaleBatch", () => {
  it("collapses a burst into one entry per query prefix", () => {
    const batch = new StaleBatch();
    for (let i = 0; i < 20; i++) batch.add("ticket");
    batch.add("user");
    expect(batch.pending).toBe(true);
    expect(batch.take()).toEqual([["tickets"], ["users"]]);
  });

  it("is empty again after it is taken", () => {
    const batch = new StaleBatch();
    batch.add("task");
    batch.take();
    expect(batch.pending).toBe(false);
    expect(batch.take()).toEqual([]);
  });

  it("one unknown event makes the whole batch 'all'", () => {
    const batch = new StaleBatch();
    batch.add("ticket");
    batch.add("brand.new");
    expect(batch.take()).toBe("all");
    expect(batch.take()).toEqual([]);
  });
});
