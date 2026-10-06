import { describe, expect, it } from "vitest";
import { markOwnTicket, othersTickets } from "./new-tickets";

describe("othersTickets", () => {
  it("leaves out the tickets this browser created", () => {
    markOwnTicket(7);
    expect(othersTickets(["6", "7", "8"])).toEqual(["6", "8"]);
  });
});
