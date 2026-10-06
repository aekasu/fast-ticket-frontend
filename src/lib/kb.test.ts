import { describe, expect, it } from "vitest";
import { nestCategories } from "./kb";

describe("nestCategories", () => {
  it("puts children under their parent with a depth, keeping the order within a level", () => {
    const out = nestCategories([
      { id: 1, parent_id: null },
      { id: 3, parent_id: 2 },
      { id: 2, parent_id: 1 },
      { id: 4, parent_id: 0 },
    ]);
    expect(out.map((c) => [c.id, c.depth])).toEqual([[1, 0], [2, 1], [3, 2], [4, 0]]);
  });
  it("treats a missing parent as a root and survives a cycle", () => {
    expect(nestCategories([{ id: 5, parent_id: 99 }]).map((c) => c.depth)).toEqual([0]);
    expect(nestCategories([{ id: 1, parent_id: 2 }, { id: 2, parent_id: 1 }]).map((c) => c.id)).toEqual([1, 2]);
  });
});
