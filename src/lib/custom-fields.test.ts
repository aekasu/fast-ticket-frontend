import { describe, expect, it } from "vitest";
import { chosenKeys, collectCustomFields, customDefs, displayValue, parseChoices, type Answer, type FieldDef } from "./custom-fields";

const def = (over: Partial<FieldDef>): FieldDef => ({ id: 1, name: "f", label: "F", type: "text", ...over });

describe("customDefs", () => {
  it("drops the form's core fields, disabled fields and types that cannot be typed", () => {
    const defs = [
      def({ name: "subject", type: "text" }),
      def({ name: "message", type: "thread" }),
      def({ name: "ticket_ref", type: "text" }),
      def({ name: "hidden", type: "text", is_enabled: false }),
      def({ name: "banner", type: "info" }),
      def({ name: "attachment", type: "files" }),
      def({ name: "flag", type: "bool" }),
    ];
    expect(customDefs(defs, "T").map((d) => d.name)).toEqual(["ticket_ref", "flag"]);
    expect(customDefs([def({ name: "email" }), def({ name: "badge" })], "U").map((d) => d.name)).toEqual(["badge"]);
  });
});

describe("parseChoices", () => {
  it("reads key:Label lines and tolerates a bare line", () => {
    expect(parseChoices({ choices: "a:Alpha\nb:Beta\r\n\nGamma" })).toEqual([
      { key: "a", label: "Alpha" },
      { key: "b", label: "Beta" },
      { key: "Gamma", label: "Gamma" },
    ]);
  });
  it("is empty without configuration", () => {
    expect(parseChoices(null)).toEqual([]);
    expect(parseChoices({ choices: null })).toEqual([]);
  });
});

describe("displayValue", () => {
  const a = (over: Partial<Answer>): Answer => ({ name: "f", label: "F", type: "text", ...over });
  it("shows text as it is", () => expect(displayValue(a({ value: "hello" }))).toBe("hello"));
  it("shows a bool as Yes or No, and nothing when unset", () => {
    expect(displayValue(a({ type: "bool", value: "1" }))).toBe("Yes");
    expect(displayValue(a({ type: "bool", value: "0" }))).toBe("No");
    expect(displayValue(a({ type: "bool", value: null }))).toBe("");
  });
  it("shows the labels of the chosen options, not osTicket's JSON map", () => {
    expect(displayValue(a({ type: "choices", value: '{"a":"Alpha"}' }))).toBe("Alpha");
    expect(displayValue(a({ type: "choices", value: '{"a":"Alpha","b":"Beta"}' }))).toBe("Alpha, Beta");
    expect(displayValue(a({ type: "choices", value: null }))).toBe("");
  });
  it("reads a multiple choice, stored as a list of keys, with labels when the definition is known", () => {
    const answer = a({ type: "choices", value: '["x","z"]' });
    expect(displayValue(answer)).toBe("x, z");
    expect(displayValue(answer, { configuration: { choices: "x:Ex\ny:Why\nz:Zed" } })).toBe("Ex, Zed");
    expect(displayValue(a({ type: "choices", value: '["q"]' }), { configuration: { choices: "x:Ex" } })).toBe("q");
  });
  it("keeps a choices value that is not the JSON map", () => expect(displayValue(a({ type: "choices", value: "plain" }))).toBe("plain"));
});

describe("chosenKeys", () => {
  it("returns the keys of the stored map", () => {
    expect(chosenKeys({ name: "f", label: "F", type: "choices", value: '{"b":"Beta"}' })).toEqual(["b"]);
    expect(chosenKeys({ name: "f", label: "F", type: "choices", value: '["x","z"]' })).toEqual(["x", "z"]);
    expect(chosenKeys(undefined)).toEqual([]);
  });
});

describe("collectCustomFields", () => {
  const defs = [def({ name: "note" }), def({ name: "flag", type: "bool" }), def({ name: "pick", type: "choices" }), def({ name: "many", type: "choices", configuration: { multiselect: true } })];
  const form = (entries: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  };

  it("on create sends only what was filled in", () => {
    expect(collectCustomFields(form([["cf:note", "  hi "], ["cf:pick", "a"]]), defs)).toEqual({ note: "hi", pick: "a" });
    expect(collectCustomFields(form([["cf:flag", "on"], ["cf:many", "a"], ["cf:many", "b"]]), defs)).toEqual({ flag: true, many: ["a", "b"] });
    expect(collectCustomFields(form([]), defs)).toEqual({});
  });

  it("on edit sends only what changed", () => {
    const answers: Answer[] = [
      { name: "note", label: "N", type: "text", value: "old" },
      { name: "flag", label: "F", type: "bool", value: "1" },
      { name: "pick", label: "P", type: "choices", value: '{"a":"Alpha"}' },
    ];
    // note unchanged, flag unchanged (still on), pick unchanged
    expect(collectCustomFields(form([["cf:note", "old"], ["cf:flag", "on"], ["cf:pick", "a"]]), defs, answers)).toEqual({});
    // note changed, flag cleared, pick changed
    expect(collectCustomFields(form([["cf:note", "new"], ["cf:pick", "b"]]), defs, answers)).toEqual({ note: "new", flag: false, pick: "b" });
  });

  it("on edit can clear a text answer and a choice", () => {
    const answers: Answer[] = [
      { name: "note", label: "N", type: "text", value: "old" },
      { name: "pick", label: "P", type: "choices", value: '{"a":"Alpha"}' },
    ];
    expect(collectCustomFields(form([]), defs, answers)).toEqual({ note: "", pick: "" });
  });
});
