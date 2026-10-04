import { describe, expect, it } from "vitest";
import { expandCanned, htmlToText, type CannedContext } from "./canned";

const ctx: CannedContext = {
  ticket: {
    id: 7,
    number: "387564",
    subject: "Printer offline",
    created: "2026-09-29T19:12:43",
    status: "Open",
    priority: "High",
    topic: "General Inquiry",
    department: "Support",
    ownerName: "Grace Brewster Hopper",
    ownerEmail: "grace@example.com",
  },
  agent: { name: "Admin User", email: "admin@example.local" },
};

describe("expandCanned", () => {
  it("fills in the variables osTicket's sample response uses", () => {
    const { text, unresolved } = expandCanned(
      "Hi %{ticket.name.first},\n\nYour ticket #%{ticket.number} created on %{ticket.create_date} is in\n%{ticket.dept.name} department.",
      ctx,
    );
    expect(text).toBe("Hi Grace,\n\nYour ticket #387564 created on 9/29/26 7:12 PM is in\nSupport department.");
    expect(unresolved).toEqual([]);
  });

  it("splits a name into first and last, and copes with one word or none", () => {
    expect(expandCanned("%{ticket.name.first}|%{ticket.name.last}", ctx).text).toBe("Grace|Hopper");
    const single = { ...ctx, ticket: { ...ctx.ticket, ownerName: "Cher" } };
    expect(expandCanned("%{ticket.name.first}|%{ticket.name.last}", single).text).toBe("Cher|");
    // An unknown owner is not replaced by nothing: the variable stays and is reported.
    const none = { ...ctx, ticket: { ...ctx.ticket, ownerName: null } };
    expect(expandCanned("[%{ticket.name}]", none)).toEqual({ text: "[%{ticket.name}]", unresolved: ["ticket.name"] });
  });

  it("leaves a variable it cannot resolve as written and reports it once", () => {
    const { text, unresolved } = expandCanned("%{ticket.due_date} and %{ticket.due_date} and %{ticket.number}", ctx);
    expect(text).toBe("%{ticket.due_date} and %{ticket.due_date} and 387564");
    expect(unresolved).toEqual(["ticket.due_date"]);
  });

  it("does not invent a value it does not have", () => {
    const noEmail = { ...ctx, ticket: { ...ctx.ticket, ownerEmail: null } };
    expect(expandCanned("%{ticket.email}", noEmail)).toEqual({ text: "%{ticket.email}", unresolved: ["ticket.email"] });
    expect(expandCanned("%{ticket.email}", ctx).text).toBe("grace@example.com");
  });

  it("allows spaces inside the braces and uses the agent's details", () => {
    expect(expandCanned("%{ staff.name } <%{staff.email}>", ctx).text).toBe("Admin User <admin@example.local>");
  });
});

describe("htmlToText", () => {
  it("turns line breaks and paragraphs into newlines and drops other tags", () => {
    expect(htmlToText("Hi,<br>\n<br>\nYour <b>ticket</b> is open.")).toBe("Hi,\n\nYour ticket is open.");
    expect(htmlToText("<p>One</p><p>Two &amp; three</p>")).toBe("One\nTwo & three");
  });

  it("returns plain text untouched", () => {
    expect(htmlToText("plain 1 < 2 text")).toBe("plain 1 < 2 text");
  });
});
