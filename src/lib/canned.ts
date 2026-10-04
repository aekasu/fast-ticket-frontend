import { formatDateTime } from "./format";

// Canned responses are stored as osTicket templates: HTML with `%{variable}` placeholders that osTicket fills in
// from the ticket when an agent picks one. The API returns the template as stored, so the frontend fills in the
// variables it can resolve and leaves the rest as written, reporting them.

export interface CannedContext {
  ticket: {
    id: number;
    number: string;
    subject: string;
    created: string;
    status: string;
    priority: string | null | undefined;
    topic: string | null | undefined;
    department: string | null | undefined;
    ownerName: string | null | undefined;
    ownerEmail: string | null | undefined;
  };
  agent: { name: string; email: string };
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const last = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

/**
 * The variables a response may use, as osTicket names them. A variable whose value is not known (no owner email
 * because the agent may not read the user directory, say) is left out, so it stays as written and is reported
 * rather than being replaced by nothing.
 */
export function cannedVariables(ctx: CannedContext): Record<string, string> {
  const { ticket, agent } = ctx;
  const owner = ticket.ownerName;
  const all: Record<string, string | null | undefined> = {
    "ticket.id": String(ticket.id),
    "ticket.number": ticket.number,
    "ticket.subject": ticket.subject,
    "ticket.create_date": formatDateTime(ticket.created),
    "ticket.status": ticket.status,
    "ticket.priority": ticket.priority,
    "ticket.topic": ticket.topic,
    "ticket.dept.name": ticket.department,
    "ticket.name": owner,
    "ticket.name.first": owner ? first(owner) : null,
    "ticket.name.last": owner ? last(owner) : null,
    "ticket.email": ticket.ownerEmail,
    "staff.name": agent.name,
    "staff.name.first": first(agent.name),
    "staff.name.last": last(agent.name),
    "staff.email": agent.email,
  };
  return Object.fromEntries(Object.entries(all).filter((e): e is [string, string] => e[1] != null));
}

/** Fill in the `%{variable}` placeholders; the ones that cannot be resolved stay as written and are listed. */
export function expandCanned(template: string, ctx: CannedContext): { text: string; unresolved: string[] } {
  const variables = cannedVariables(ctx);
  const unresolved: string[] = [];
  const text = template.replace(/%\{\s*([a-zA-Z0-9_.]+)\s*\}/g, (match, name: string) => {
    if (name in variables) return variables[name];
    if (!unresolved.includes(name)) unresolved.push(name);
    return match;
  });
  return { text, unresolved };
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };

/**
 * A canned response is HTML; the reply box is plain text. Line breaks and paragraphs become newlines, other tags are
 * dropped and entities decoded. Text that is not HTML is returned as it is.
 */
export function htmlToText(html: string): string {
  if (!/<\/?[a-z][\s\S]*?>/i.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
