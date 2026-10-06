"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { htmlToText } from "@/lib/canned";
import { can, useMe } from "@/lib/queries/me";
import { taskKeys } from "@/lib/queries/tasks";
import { ticketKeys } from "@/lib/queries/tickets";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";

type Ticket = components["schemas"]["TicketDetail"];
type Entry = components["schemas"]["ThreadEntry"];

/**
 * Edit and Resend for one thread entry of a ticket or a task. The API gates both by the reply permission and osTicket
 * applies its own rule (your own post, a department manager, or `thread.edit`), whose refusal is shown as it words it.
 * Editing gives the entry a new id and hides the old one, so after a save the thread simply shows the new version.
 */
export function TicketEntryActions({ ticket, entry }: { ticket: Ticket; entry: Entry }) {
  return <EntryActions base={`/api/v1/tickets/${ticket.ticket_id}/thread/${entry.id}`} keys={ticketKeys.all} deptId={ticket.dept_id} permission="ticket.reply" entry={entry} />;
}

export function TaskEntryActions({ task, entry }: { task: components["schemas"]["TaskDetail"]; entry: Entry }) {
  return <EntryActions base={`/api/v1/tasks/${task.task_id}/thread/${entry.id}`} keys={taskKeys.all} deptId={task.dept_id} permission="task.reply" entry={entry} />;
}

function EntryActions({ base, keys, deptId, permission, entry }: { base: string; keys: readonly unknown[]; deptId: number | null | undefined; permission: string; entry: Entry }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(base, keys);
  const [editing, setEditing] = useState(false);
  if (!can(me, deptId, permission)) return null;

  const isReply = entry.type === "R";
  const label = isReply ? "reply" : entry.type === "N" ? "note" : "message";

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { body: String(form.get("body") ?? "") };
    if (entry.type === "N" && String(form.get("title") ?? "").trim()) body.title = String(form.get("title")).trim();
    if (isReply && form.get("resend") === "on") body.resend = true;
    if (await run("", body, `The ${label} was updated.`, "PATCH")) setEditing(false);
  }

  return (
    <div className="mt-2 text-xs">
      {!editing && (
        <span className="flex gap-3">
          <button type="button" className="text-sky-800 underline" onClick={() => { clear(); setEditing(true); }}>
            Edit this {label}
          </button>
          {isReply && (
            <button type="button" disabled={busy} className="text-sky-800 underline disabled:opacity-50" onClick={() => run("resend", {}, "The reply was sent again.", "POST")}>
              Resend this reply
            </button>
          )}
        </span>
      )}
      <div className="mt-2">
        <NoticeBar notice={notice} />
      </div>
      {editing && (
        <form onSubmit={save} className="mt-2 max-w-2xl space-y-2 border border-slate-300 bg-white p-3" aria-label={`Edit this ${label}`}>
          {entry.type === "N" && <input name="title" aria-label="Note title" defaultValue={entry.title ?? ""} maxLength={255} className={field} />}
          <textarea name="body" aria-label={`Edit the ${label}`} required rows={6} defaultValue={htmlToText(entry.body)} className={field} />
          {isReply && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="resend" /> Email the edited reply to the recipients again
            </label>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className={button} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
