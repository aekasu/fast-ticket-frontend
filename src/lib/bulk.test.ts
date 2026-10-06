import { describe, expect, it } from "vitest";
import { runMany, summarize } from "./bulk";

describe("runMany", () => {
  it("runs every id, counts the done and keeps each refusal", async () => {
    const seen: number[] = [];
    const result = await runMany([1, 2, 3, 4, 5], async (id) => {
      seen.push(id);
      if (id % 2 === 0) throw new Error(`no ${id}`);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(result.done).toBe(3);
    expect(result.failed.map((f) => f.id).sort()).toEqual([2, 4]);
  });
  it("copes with nothing to do and never runs more than the limit at once", async () => {
    expect(await runMany([], async () => {})).toEqual({ done: 0, failed: [] });
    let running = 0;
    let peak = 0;
    await runMany([1, 2, 3, 4, 5, 6], async () => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    }, 2);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("summarize", () => {
  it("groups the refused by reason", () => {
    const text = summarize("Closed", { done: 1, failed: [{ id: 2, message: "Access denied" }, { id: 3, message: "Access denied" }] }, (id) => `#${id}`);
    expect(text).toBe("Closed 1 ticket. #2, #3: Access denied");
  });
});
