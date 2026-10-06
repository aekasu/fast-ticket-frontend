import { describe, expect, it } from "vitest";
import { htmlToText } from "./canned";

describe("htmlToText", () => {
  it("turns line breaks and paragraphs into newlines and drops other tags", () => {
    expect(htmlToText("Hi,<br>\n<br>\nYour <b>ticket</b> is open.")).toBe("Hi,\n\nYour ticket is open.");
    expect(htmlToText("<p>One</p><p>Two &amp; three</p>")).toBe("One\nTwo & three");
  });

  it("returns plain text untouched", () => {
    expect(htmlToText("plain 1 < 2 text")).toBe("plain 1 < 2 text");
  });
});
