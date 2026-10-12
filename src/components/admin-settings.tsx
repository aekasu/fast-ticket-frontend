"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getJson } from "@/lib/api/raw";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { useAdminLookups } from "@/lib/queries/admin-lookups";
import { useTicketStatuses } from "@/lib/queries/reference";
import { NoticeBar, field, primary, type Notice } from "./action-ui";

type Value = boolean | number | string | string[] | null;

const WORDS: Record<string, string> = { id: "ID", ip: "IP", kb: "KB", sla: "SLA", sql: "SQL", sys: "system", url: "URL", dept: "department", acl: "ACL", pw: "password", passwd: "password", max: "maximum", acct: "account", http: "HTTP", https: "HTTPS", smtp: "SMTP", cron: "cron", "2fa": "2FA", lang: "language", langs: "languages", img: "image", req: "required", auth: "authentication", collabs: "collaborators", resp: "response" };

/** `ticket_alert_dept_manager` as "Ticket alert department manager". */
function humanize(key: string): string {
  const text = key
    .split("_")
    .map((w) => WORDS[w] ?? w)
    .join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface Choice {
  value: string;
  label: string;
}

/** Settings whose value is the id of a department, priority, SLA plan or help topic (0 = none). */
const LOOKUP_KEYS: Record<string, "departments" | "priorities" | "slas" | "topics" | "statuses"> = {
  default_dept_id: "departments",
  default_priority_id: "priorities",
  default_task_priority_id: "priorities",
  default_sla_id: "slas",
  default_task_sla_id: "slas",
  default_help_topic: "topics",
  default_ticket_status_id: "statuses",
};

/**
 * One of osTicket's Admin Panel settings pages. The API gives the section's keys flat and typed; this renders each
 * by its type and sends only what changed. osTicket validates the whole section and a refusal (a field → message
 * object) is shown as worded.
 */
export function AdminSettings({ section, title, note }: { section: string; title: string; note?: string }) {
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const settings = useQuery({ queryKey: ["admin", "settings", section], queryFn: () => getJson<Record<string, Value>>(`/api/v1/settings/${section}`) });
  // The drop-down choices osTicket itself lists (admin), and the lookups behind the default-id settings.
  const enumerated = useQuery({ queryKey: ["admin", "settings", "options"], staleTime: 5 * 60_000, queryFn: () => getJson<{ options: Record<string, Choice[]> }>("/api/v1/settings/options") });
  const lookups = useAdminLookups();
  const statuses = useTicketStatuses();
  const data = settings.data;
  if (settings.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data) return <p role="alert" className="text-sm text-red-700">{settings.error?.message ?? "Unable to load."}</p>;
  const current = data;

  function choicesFor(k: string): Choice[] | null {
    const listed = enumerated.data?.options[k];
    if (listed) return listed;
    const kind = LOOKUP_KEYS[k];
    if (!kind) return null;
    const rows = kind === "statuses" ? (statuses.data ?? []).map((st) => ({ value: st.id, label: st.name })) : lookups.options[kind];
    if (rows.length === 0) return null;
    return [{ value: "0", label: "— None —" }, ...rows.map((o) => ({ value: String(o.value), label: o.label }))];
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const form = new FormData(e.currentTarget);
    const body: Record<string, Value> = {};
    for (const [k, v] of Object.entries(current)) {
      let next: Value;
      if (typeof v === "boolean") next = form.get(k) === "on";
      else if (typeof v === "number") next = form.get(k) === "" ? v : Number(form.get(k));
      else if (Array.isArray(v)) next = String(form.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      else next = String(form.get(k) ?? "");
      if (JSON.stringify(next) !== JSON.stringify(v)) body[k] = next;
    }
    if (Object.keys(body).length === 0) return setNotice({ kind: "error", text: "No changes to save." });
    setBusy(true);
    try {
      await runCommand({ method: "PATCH", path: `/api/v1/settings/${section}`, body, key: key.current() });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: ["admin", "settings", section] });
      setVersion((n) => n + 1);
      setNotice({ kind: "ok", text: "Successfully updated settings." });
    } catch (error) {
      if (error instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    }
    setBusy(false);
  }

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">{title}</h1>
      {note && <p className="mb-3 max-w-3xl text-sm text-slate-600">{note}</p>}
      <form key={version} onSubmit={save} className="max-w-3xl space-y-2 border border-slate-300 bg-white p-4" aria-label={`${title} settings`}>
        <NoticeBar notice={notice} />
        {Object.entries(current).map(([k, v]) =>
          typeof v === "boolean" ? (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={k} defaultChecked={v} /> {humanize(k)}
            </label>
          ) : choicesFor(k) ? (
            <SelectRow key={k} name={k} label={humanize(k)} value={v} choices={choicesFor(k) ?? []} />
          ) : (
            <label key={k} className="grid items-center gap-1 sm:grid-cols-[16rem_1fr]">
              <span className="text-sm font-semibold text-slate-700">{humanize(k)}</span>
              <input name={k} type={typeof v === "number" ? "number" : "text"} defaultValue={Array.isArray(v) ? v.join(", ") : (v ?? "")} className={field} />
            </label>
          ),
        )}
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

function SelectRow({ name, label, value, choices }: { name: string; label: string; value: Value; choices: Choice[] }) {
  const current = value === null ? "" : String(value);
  // A stored value osTicket does not list is kept as it is rather than silently changed on save.
  const known = choices.some((c) => c.value === current);
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[16rem_1fr]">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select name={name} defaultValue={current} className={field}>
        {!known && <option value={current}>{current === "" ? "—" : current}</option>}
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
