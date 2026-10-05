// Which cached queries an event makes stale. An event only says "this changed" (see notes/EVENTS.md); the answer is to
// refetch what is on screen, so this maps an event's aggregate to the query-key prefixes that read it.

export type StaleKeys = readonly (readonly string[])[] | "all";

const ADMIN_RECORDS = ["dept", "team", "topic", "sla", "priority", "form", "banlist", "page", "email", "template", "schedule"];

export function queryKeysForEvent(aggregateType: string): StaleKeys {
  if (aggregateType === "ticket") return [["tickets"]];
  if (aggregateType === "task") return [["tasks"]];
  if (aggregateType === "user") return [["users"]];
  if (aggregateType === "org") return [["orgs"], ["users"]];
  if (aggregateType.startsWith("kb.")) return [["kb"]];
  // An agent's own record, role or department can change what they may do and what the admin screens list.
  if (aggregateType === "staff") return [["admin"], ["reference"], ["agents"], ["me"]];
  if (ADMIN_RECORDS.includes(aggregateType)) return [["admin"], ["reference"], ["forms"], ["me"]];
  // An aggregate the frontend does not know: refetch everything rather than miss a change.
  return "all";
}

/** Collects the stale keys of a burst of events, so that a flurry causes one refetch of each query, not one per event. */
export class StaleBatch {
  private all = false;
  private keys = new Map<string, readonly string[]>();

  add(aggregateType: string) {
    const keys = queryKeysForEvent(aggregateType);
    if (keys === "all") this.all = true;
    else for (const key of keys) this.keys.set(key.join("/"), key);
  }

  /** What to invalidate now, and reset. `"all"` means every query. */
  take(): StaleKeys {
    const out: StaleKeys = this.all ? "all" : [...this.keys.values()];
    this.all = false;
    this.keys.clear();
    return out;
  }

  get pending() {
    return this.all || this.keys.size > 0;
  }
}
