import { describe, expect, it } from "vitest";
import { dispositionName } from "./download";

describe("dispositionName", () => {
  it("reads the quoted and the bare form", () => {
    expect(dispositionName('attachment; filename="Ticket-100001.pdf"')).toBe("Ticket-100001.pdf");
    expect(dispositionName("attachment; filename=ticket-7.zip")).toBe("ticket-7.zip");
  });
  it("prefers the encoded form", () => {
    expect(dispositionName("attachment; filename=\"a.pdf\"; filename*=UTF-8''caf%C3%A9.pdf")).toBe("café.pdf");
  });
  it("is null without a header", () => {
    expect(dispositionName(null)).toBeNull();
    expect(dispositionName("inline")).toBeNull();
  });
});
