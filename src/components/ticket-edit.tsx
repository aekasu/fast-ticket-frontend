"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";
import { parseApiDate } from "@/lib/format";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { can, useMe } from "@/lib/queries/me";
import { usePriorities, useSlas, useTopics } from "@/lib/queries/reference";
import { ticketKeys, useTicket } from "@/lib/queries/tickets";
import { collectCustomFields, customDefs } from "@/lib/custom-fields";
import { useFormDefinition } from "@/lib/queries/forms";
import { CustomFieldInputs } from "./custom-fields";

const field = "w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm";
const SOURCES = ["Phone", "Email", "Web", "API", "Other"];

/** `YYYY-MM-DDTHH:MM` in the browser's timezone, for a datetime-local input. */
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = parseApiDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[11rem_1fr]">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

/** osTicket's "Edit Ticket": only what changed is sent (PATCH), with an optional internal note. */
export function TicketEdit({ id }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const { data: me } = useMe();
  const { data: ticket, error, isLoading } = useTicket(id);
  const topics = useTopics();
  const priorities = usePriorities();
  const slas = useSlas();
  const formDefs = useFormDefinition("T");
  const custom = customDefs(formDefs.data ?? [], "T");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The selects take their value from defaultValue when they mount, so their options must already be there:
  // otherwise the browser picks the first option and a plain Save would change the ticket.
  if (isLoading || topics.isLoading || priorities.isLoading || slas.isLoading || formDefs.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid ticket ID.</p>;
  if (error || !ticket) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the ticket."}</p>;
  if (me && !can(me, ticket.dept_id, "ticket.edit")) return <p className="text-sm">Access denied. You do not have permission to edit this ticket.</p>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body: Record<string, unknown> = {};
    if (text("subject") !== ticket.subject) body.subject = text("subject");
    if (text("priority_id") && Number(text("priority_id")) !== ticket.priority_id) body.priority_id = Number(text("priority_id"));
    if (text("topic_id") && Number(text("topic_id")) !== ticket.topic_id) body.topic_id = Number(text("topic_id"));
    if (form.has("sla_id") && Number(text("sla_id")) !== (ticket.sla_id ?? 0)) body.sla_id = Number(text("sla_id"));
    if (text("source") && text("source") !== ticket.source) body.source = text("source");
    const due = text("due_date");
    if (due !== toLocalInput(ticket.due_date)) body.due_date = due ? new Date(due).toISOString() : null;
    const answers = collectCustomFields(form, custom, ticket.custom_fields);
    if (Object.keys(answers).length > 0) body.custom_fields = answers;
    if (text("note")) body.note = text("note");

    if (Object.keys(body).filter((k) => k !== "note").length === 0) {
      setMessage("No changes to save.");
      return;
    }
    setBusy(true);
    try {
      await runCommand({ method: "PATCH", path: `/api/v1/tickets/${ticket.ticket_id}`, body, key: key.current() });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      router.push(`/tickets/${ticket.ticket_id}`);
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setMessage(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href={`/tickets/${ticket.ticket_id}`} className="text-sky-800 hover:underline">
          ← Ticket #{ticket.number}
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Update Ticket #{ticket.number}</h1>
      {message && (
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {message}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-w-3xl space-y-3 border border-slate-300 bg-white p-4">
        <Row label="Subject">
          <input name="subject" required defaultValue={ticket.subject} maxLength={255} className={field} />
        </Row>
        <Row label="Priority">
          <select name="priority_id" defaultValue={ticket.priority_id ?? ""} className={field}>
            {priorities.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.desc}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Help Topic">
          <select name="topic_id" defaultValue={ticket.topic_id ?? ""} className={field}>
            <option value="" disabled>
              — Select Help Topic —
            </option>
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.topic}
              </option>
            ))}
          </select>
        </Row>
        {slas.data && (
          <Row label="SLA Plan">
            <select name="sla_id" defaultValue={ticket.sla_id ?? 0} className={field}>
              <option value={0}>— None —</option>
              {slas.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Row>
        )}
        <Row label="Ticket Source">
          <select name="source" defaultValue={ticket.source} className={field}>
            {[...new Set([ticket.source, ...SOURCES])].filter(Boolean).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Row>
        <Row label="Due Date">
          <input name="due_date" type="datetime-local" defaultValue={toLocalInput(ticket.due_date)} className={field} />
        </Row>
        <CustomFieldInputs defs={custom} answers={ticket.custom_fields} />
        <Row label="Internal Note">
          <textarea name="note" rows={3} placeholder="Reason for the update (optional)" className={field} />
        </Row>
        <p className="text-xs text-slate-500">
          The due date is entered in your browser&apos;s timezone and must be in the future; clear it to remove it.
        </p>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
          <Link href={`/tickets/${ticket.ticket_id}`} className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
