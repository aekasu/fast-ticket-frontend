// Tickets this browser created itself: their `ticket.created` event is not news to the agent who just opened them.
const own = new Set<string>();

export function markOwnTicket(id: number | string) {
  own.add(String(id));
}

/** The ids of the tickets other people created, from the ids the stream announced. */
export function othersTickets(announced: readonly string[]): string[] {
  return announced.filter((id) => !own.has(id));
}
