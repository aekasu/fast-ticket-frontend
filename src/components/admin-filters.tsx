"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getJson } from "@/lib/api/raw";
import type { Row } from "@/lib/admin/resources";
import { useAdminLookups, useTeamsList } from "@/lib/queries/admin-lookups";
import { createdId } from "@/lib/queries/directory";
import { useCannedList } from "@/lib/queries/kb";
import { useTicketStatuses } from "@/lib/queries/reference";
import { useSubmitCommand } from "@/lib/queries/submit";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";
import { FormError, FormRow, formBox } from "./form-kit";

type Option = { key: string; label: string };
type FilterOptions = {
  matches: { group: string; fields: Option[] }[];
  match_types: Option[];
  targets: string[];
  actions: { type: string; label: string; fields: string[]; multi_use: boolean }[];
};
type Rule = { what: string; how: string; val: string };
type Action = { type: string } & Record<string, unknown>;

function useFilterOptions() {
  return useQuery({ queryKey: ["admin", "filters", "options"], staleTime: 5 * 60_000, queryFn: () => getJson<FilterOptions>("/api/v1/filters/options") });
}

/** Rules (what, how, value): at least one is needed. */
function RulesInput({ rules, setRules, options }: { rules: Rule[]; setRules: (r: Rule[]) => void; options?: FilterOptions }) {
  const set = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Rule ${i + 1}`}>
          <select aria-label="Rule field" value={r.what} onChange={(e) => set(i, { what: e.target.value })} className={`${field} max-w-60`}>
            {options?.matches.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.fields.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <select aria-label="Rule match" value={r.how} onChange={(e) => set(i, { how: e.target.value })} className={`${field} max-w-48`}>
            {options?.match_types.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <input aria-label="Rule value" value={r.val} onChange={(e) => set(i, { val: e.target.value })} maxLength={255} className={`${field} min-w-40 flex-1`} />
          <button type="button" className="text-red-800 underline" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
            Remove rule {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className={button}
        onClick={() => setRules([...rules, { what: options?.matches[0]?.fields[0]?.key ?? "email", how: options?.match_types[0]?.key ?? "contains", val: "" }])}
      >
        Add Rule
      </button>
    </div>
  );
}

const asNumber = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

/** One action's inputs: the fields the action type takes, each a select where the API lists the choices. */
function ActionFields({ action, onChange, options }: { action: Action; onChange: (patch: Record<string, unknown>) => void; options?: FilterOptions }) {
  const lk = useAdminLookups();
  const teams = useTeamsList();
  const statuses = useTicketStatuses();
  const canned = useCannedList();
  const fields = options?.actions.find((a) => a.type === action.type)?.fields ?? [];
  const pick = (name: string, label: string, choices: { value: number; label: string }[]) => (
    <select key={name} aria-label={label} value={String(action[name] ?? "")} onChange={(e) => onChange({ [name]: asNumber(e.target.value) })} className={`${field} max-w-60`}>
      <option value="">— Select {label} —</option>
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  );
  return (
    <>
      {fields.map((f) => {
        if (f === "dept_id") return pick(f, "Department", lk.options.departments);
        if (f === "priority_id") return pick(f, "Priority", lk.options.priorities);
        if (f === "sla_id") return pick(f, "SLA Plan", lk.options.slas);
        if (f === "staff_id") return pick(f, "Agent", lk.options.agents);
        if (f === "topic_id") return pick(f, "Help Topic", lk.options.topics);
        if (f === "team_id") return pick(f, "Team", (teams.data ?? []).map((t) => ({ value: t.id, label: t.name })));
        if (f === "status_id") return pick(f, "Status", (statuses.data ?? []).map((t) => ({ value: t.id, label: t.name })));
        if (f === "canned_id") return pick(f, "Canned Response", (canned.data ?? []).map((c) => ({ value: c.id, label: c.title })));
        if (f === "message")
          return <textarea key={f} aria-label="Message" rows={3} value={String(action[f] ?? "")} onChange={(e) => onChange({ [f]: e.target.value })} className={field} />;
        return (
          <input
            key={f}
            aria-label={f === "from_email_id" ? "From email ID" : f.charAt(0).toUpperCase() + f.slice(1)}
            type={f === "from_email_id" ? "number" : "text"}
            value={String(action[f] ?? "")}
            onChange={(e) => onChange({ [f]: f === "from_email_id" ? asNumber(e.target.value) : e.target.value })}
            className={`${field} max-w-60`}
          />
        );
      })}
    </>
  );
}

function ActionsInput({ actions, setActions, options }: { actions: Action[]; setActions: (a: Action[]) => void; options?: FilterOptions }) {
  return (
    <div className="space-y-2">
      {actions.map((a, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2" role="group" aria-label={`Action ${i + 1}`}>
          <select aria-label="Action type" value={a.type} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { type: e.target.value } : x)))} className={`${field} max-w-60`}>
            {options?.actions.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
          <ActionFields action={a} options={options} onChange={(patch) => setActions(actions.map((x, j) => (j === i ? { ...x, ...patch } : x)))} />
          <button type="button" className="text-red-800 underline" onClick={() => setActions(actions.filter((_, j) => j !== i))}>
            Remove action {i + 1}
          </button>
        </div>
      ))}
      <button type="button" className={button} onClick={() => setActions([...actions, { type: options?.actions[0]?.type ?? "reject" }])}>
        Add Action
      </button>
    </div>
  );
}

/** Drops what an action does not take, and empty values, before sending. */
function cleanActions(actions: Action[], options?: FilterOptions) {
  return actions.map((a) => {
    const allowed = new Set(options?.actions.find((t) => t.type === a.type)?.fields ?? []);
    return Object.fromEntries(Object.entries(a).filter(([k, v]) => k === "type" || (allowed.has(k) && v !== "" && v != null)));
  });
}

/** The rules and actions of an existing filter: edited together and saved as whole lists. */
export function FilterRulesActionsEditor({ id, data }: { id: number; data: Row }) {
  const options = useFilterOptions().data;
  const { run, busy, notice, clear } = useRunner(`/api/v1/filters/${id}`, ["admin", "filters"]);
  const [rules, setRules] = useState<Rule[]>(((data.rules as Rule[]) ?? []).map(({ what, how, val }) => ({ what, how, val })));
  const [actions, setActions] = useState<Action[]>(((data.actions as Action[]) ?? []).map((a) => Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== "id" && k !== "sort" && v != null)) as Action));

  return (
    <section className="mt-6 max-w-4xl border border-slate-300 bg-white" aria-label="Rules and actions">
      <h2 className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800">Rules and actions</h2>
      <div className="space-y-4 p-4">
        <NoticeBar notice={notice} />
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Rules ({rules.length})</h3>
          <RulesInput rules={rules} setRules={setRules} options={options} />
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Actions ({actions.length})</h3>
          <ActionsInput actions={actions} setActions={setActions} options={options} />
        </div>
        <button
          type="button"
          disabled={busy || !options}
          className={primary}
          onClick={() => {
            clear();
            run("", { rules, actions: cleanActions(actions, options) }, "Rules and actions saved.", "PATCH");
          }}
        >
          {busy ? "Saving…" : "Save Rules and Actions"}
        </button>
      </div>
    </section>
  );
}

/** Add a filter: its settings, at least one rule, and any actions. */
export function FilterNew() {
  const options = useFilterOptions().data;
  const lk = useAdminLookups();
  const { submit, error, setError, busy } = useSubmitCommand([["admin", "filters"]]);
  const [rules, setRules] = useState<Rule[]>([{ what: "email", how: "contains", val: "" }]);
  const [actions, setActions] = useState<Action[]>([]);
  const [target, setTarget] = useState("Any");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const f = new FormData(event.currentTarget);
    const t = (n: string) => String(f.get(n) ?? "").trim();
    const body = {
      name: t("name"),
      execorder: t("execorder") ? Number(t("execorder")) : undefined,
      is_active: f.get("is_active") === "on",
      target,
      match_all_rules: f.get("match_all_rules") === "on",
      stop_onmatch: f.get("stop_onmatch") === "on",
      notes: t("notes") || undefined,
      rules,
      actions: cleanActions(actions, options),
    };
    await submit("POST", "/api/v1/filters", body, (r) => `/admin/filters/${createdId(r)}`);
  }

  if (!options || lk.loading) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/admin/filters" className="text-sky-800 hover:underline">
          ← Filters
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New Filter</h1>
      <FormError message={error} />
      <form onSubmit={onSubmit} className={formBox}>
        <FormRow label="Filter Name" required>
          <input name="name" required maxLength={32} className={field} />
        </FormRow>
        <FormRow label="Execution Order">
          <input name="execorder" type="number" min={1} defaultValue={99} className={field} />
        </FormRow>
        <FormRow label="Filter Target">
          <select aria-label="Filter target" value={target} onChange={(e) => setTarget(e.target.value)} className={field}>
            {options.targets.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </FormRow>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked /> Filter is active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="match_all_rules" /> All rules must match (otherwise any one)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="stop_onmatch" /> Stop processing further filters on a match
        </label>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Rules</h3>
          <RulesInput rules={rules} setRules={setRules} options={options} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Actions</h3>
          <ActionsInput actions={actions} setActions={setActions} options={options} />
        </div>
        <FormRow label="Admin Notes">
          <textarea name="notes" rows={3} className={field} />
        </FormRow>
        <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
          {busy ? "Saving…" : "Add Filter"}
        </button>
      </form>
    </div>
  );
}
