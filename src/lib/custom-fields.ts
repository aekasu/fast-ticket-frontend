// Custom fields: the extra fields an administrator adds to osTicket's ticket, user, organization and task forms.
// The API reports an entity's answers typed (`kind`: text, bool or choices, with the decoded value) and every agent can
// read a form's field definitions (`GET /forms/for/{kind}`) with their type, configuration and whether they are
// required or editable. These helpers turn one into the other.

import type { components } from "@/lib/api/schema";

/** A form field as the agent-facing form endpoint gives it. */
export type FieldDef = Pick<components["schemas"]["AgentFormField"], "id" | "name" | "label" | "type"> &
  Partial<Pick<components["schemas"]["AgentFormField"], "mode" | "hint" | "is_enabled" | "is_required" | "is_editable" | "list_items">> & {
    configuration?: Record<string, unknown> | null;
  };

export type Answer = components["schemas"]["CustomFieldAnswer"];

/** The core fields of each form are edited by the screens' own inputs; everything else is a custom field. */
export const CORE_FIELDS: Record<"T" | "U" | "O" | "A", string[]> = {
  T: ["subject", "message", "priority"],
  U: ["email", "name", "phone", "notes"],
  O: ["name", "address", "phone", "website", "notes"],
  A: ["title", "description"],
};

/** Field types an agent can type an answer for. Others (info, break, files, lists, …) are display-only or not writable. */
export const EDITABLE_TYPES = ["text", "memo", "bool", "choices", "datetime", "phone"] as const;

export function customDefs(defs: FieldDef[], form: keyof typeof CORE_FIELDS): FieldDef[] {
  return defs.filter((d) => d.is_enabled !== false && d.is_editable !== false && !CORE_FIELDS[form].includes(d.name) && (EDITABLE_TYPES as readonly string[]).includes(d.type));
}

export interface Choice {
  key: string;
  label: string;
}

/** A choices field stores its options as lines of `key:Label`. A line with no colon is both key and label. */
export function parseChoices(config: unknown): Choice[] {
  const raw = (config as { choices?: unknown } | null | undefined)?.choices;
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      return i === -1 ? { key: line, label: line } : { key: line.slice(0, i).trim(), label: line.slice(i + 1).trim() };
    });
}

/** What an answer reads as on a page. */
export function displayValue(answer: Answer): string {
  if (answer.kind === "bool") return answer.bool_value == null ? "" : answer.bool_value ? "Yes" : "No";
  if (answer.kind === "choices") return (answer.choices ?? []).map((c) => c.label).join(", ");
  return answer.value ?? "";
}

/** The keys an answer currently holds, for pre-selecting a choices input. */
export function chosenKeys(answer: Answer | undefined): string[] {
  return (answer?.choices ?? []).map((c) => c.key);
}

/** A comparable form of an answer, so an edit sends only what changed. */
function current(def: FieldDef, answer: Answer | undefined): string | boolean | string[] {
  if (def.type === "bool") return answer?.bool_value === true;
  if (def.type === "choices") return chosenKeys(answer);
  return answer?.value ?? "";
}

const sameChoices = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((k, i) => k === [...b].sort()[i]);

/**
 * The `custom_fields` payload from a submitted form. Inputs are named `cf:<variable>`.
 * Creating sends the answers that were filled in; editing sends only those that changed.
 */
export function collectCustomFields(form: FormData, defs: FieldDef[], answers?: Answer[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of defs) {
    const key = `cf:${def.name}`;
    const existing = answers?.find((a) => a.name === def.name);
    let next: string | boolean | string[];
    if (def.type === "bool") next = form.get(key) === "on";
    else if (def.type === "choices") next = form.getAll(key).map(String).filter(Boolean);
    else next = String(form.get(key) ?? "").trim();

    if (answers) {
      const before = current(def, existing);
      const unchanged = Array.isArray(next) ? sameChoices(next, before as string[]) : next === before;
      if (unchanged) continue;
    } else if (next === "" || (Array.isArray(next) && next.length === 0) || next === false) {
      continue;
    }
    // A single-choice field takes one key; a multiple-choice field takes a list.
    out[def.name] = Array.isArray(next) ? (def.configuration?.multiselect ? next : (next[0] ?? "")) : next;
  }
  return out;
}
