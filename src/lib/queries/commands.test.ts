import { describe, expect, it } from "vitest";
import { CommandFailed } from "./commands";

describe("CommandFailed", () => {
  it("unpacks the JSON field errors osTicket appends to its message", () => {
    const e = new CommandFailed('Ticket was not created: {"user":"Incomplete client information"}');
    expect(e.message).toBe("Ticket was not created: Incomplete client information");
    expect(e.fields).toEqual({ user: "Incomplete client information" });
  });

  it("joins several field errors", () => {
    const e = new CommandFailed('Staff member not saved: {"email":"Valid email is required","username":"Already in use"}');
    expect(e.message).toBe("Staff member not saved: Valid email is required; Already in use");
    expect(Object.keys(e.fields)).toEqual(["email", "username"]);
  });

  it("keeps a plain message as it is", () => {
    const e = new CommandFailed("Ticket is not assigned to a team.");
    expect(e.message).toBe("Ticket is not assigned to a team.");
    expect(e.fields).toEqual({});
  });

  it("keeps text that only looks like JSON", () => {
    const e = new CommandFailed("Refused: {not json}");
    expect(e.message).toBe("Refused: {not json}");
  });
});
