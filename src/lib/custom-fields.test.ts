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
    // A field the agent may not type (osTicket's is_editable) is left out.
    expect(customDefs([def({ name: "locked", is_editable: false })], "U")).toEqual([]);
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
  const a = (over: Partial<Answer>): Answer => ({ name: "f", label: "F", type: "text", kind: "text", ...over });
  it("shows text as it is", () => expect(displayValue(a({ value: "hello" }))).toBe("hello"));
  it("shows a bool as Yes or No, and nothing when unset", () => {
    expect(displayValue(a({ type: "bool", kind: "bool", bool_value: true }))).toBe("Yes");
    expect(displayValue(a({ type: "bool", kind: "bool", bool_value: false }))).toBe("No");
    expect(displayValue(a({ type: "bool", kind: "bool", bool_value: null }))).toBe("");
  });
  it("shows the labels of the chosen options", () => {
    expect(displayValue(a({ type: "choices", kind: "choices", choices: [{ key: "a", label: "Alpha" }] }))).toBe("Alpha");
    expect(displayValue(a({ type: "choices", kind: "choices", choices: [{ key: "a", label: "Alpha" }, { key: "b", label: "Beta" }] }))).toBe("Alpha, Beta");
    expect(displayValue(a({ type: "choices", kind: "choices", choices: [] }))).toBe("");
  });
});

describe("chosenKeys", () => {
  it("returns the keys of the chosen options", () => {
    expect(chosenKeys({ name: "f", label: "F", type: "choices", kind: "choices", choices: [{ key: "x", label: "Ex" }, { key: "z", label: "Zed" }] })).toEqual(["x", "z"]);
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
      { name: "note", label: "N", type: "text", kind: "text", value: "old" },
      { name: "flag", label: "F", type: "bool", kind: "bool", bool_value: true },
      { name: "pick", label: "P", type: "choices", kind: "choices", choices: [{ key: "a", label: "Alpha" }] },
    ];
    // note unchanged, flag unchanged (still on), pick unchanged
    expect(collectCustomFields(form([["cf:note", "old"], ["cf:flag", "on"], ["cf:pick", "a"]]), defs, answers)).toEqual({});
    // note changed, flag cleared, pick changed
    expect(collectCustomFields(form([["cf:note", "new"], ["cf:pick", "b"]]), defs, answers)).toEqual({ note: "new", flag: false, pick: "b" });
  });

  it("on edit can clear a text answer and a choice", () => {
    const answers: Answer[] = [
      { name: "note", label: "N", type: "text", kind: "text", value: "old" },
      { name: "pick", label: "P", type: "choices", kind: "choices", choices: [{ key: "a", label: "Alpha" }] },
    ];
    expect(collectCustomFields(form([]), defs, answers)).toEqual({ note: "", pick: "" });
  });
});

describe("custom-list fields", () => {
  const list = def({ name: "colour", type: "list-7", list_items: [{ id: 11, value: "Red" }, { id: 12, value: "Blue" }] });

  it("can be typed, offer the list's items, and send item ids", () => {
    expect(customDefs([list], "T").map((d) => d.name)).toEqual(["colour"]);
    expect(parseChoices(null, list)).toEqual([{ key: "11", label: "Red" }, { key: "12", label: "Blue" }]);
    const form = new FormData();
    form.append("cf:colour", "12");
    expect(collectCustomFields(form, [list])).toEqual({ colour: 12 });
  });

  it("send a list of ids when several can be chosen, and null when the answer is cleared", () => {
    const many = { ...list, configuration: { multiselect: true } };
    const form = new FormData();
    form.append("cf:colour", "11");
    form.append("cf:colour", "12");
    expect(collectCustomFields(form, [many])).toEqual({ colour: [11, 12] });
    const answers: Answer[] = [{ name: "colour", label: "Colour", type: "list-7", kind: "choices", choices: [{ key: "11", label: "Red" }] }];
    expect(collectCustomFields(new FormData(), [list], answers)).toEqual({ colour: null });
  });
});
