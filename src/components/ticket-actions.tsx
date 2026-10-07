"use client";

import Link from "next/link";
import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { api } from "@/lib/api/client";
import { useCannedList } from "@/lib/queries/kb";
import { AttachmentPicker, useAttachmentLimits } from "./attachment-picker";
import { can, useMe } from "@/lib/queries/me";
import { useDepartments, useTicketStatuses } from "@/lib/queries/reference";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";
import { attachmentProblem, encodeFile } from "@/lib/attachments";
import { ticketKeys, useAssignees } from "@/lib/queries/tickets";

type Ticket = components["schemas"]["TicketDetail"];

type Panel = "assign" | "transfer" | "close" | "reopen" | "release" | null;

export function TicketToolbar({ ticket }: { ticket: Ticket }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tickets/${ticket.ticket_id}`, ticketKeys.all);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [targetDept, setTargetDept] = useState("");
  const departments = useDepartments();

  const dept = ticket.dept_id;
  const isOpen = ticket.status.state === "open";
  const assigned = ticket.assignee_staff_id != null || ticket.team_id != null;
  const canAssign = can(me, dept, "ticket.assign");
  const canClose = can(me, dept, "ticket.close");
  const canRelease = can(me, dept, "ticket.release");
  const canTransfer = can(me, dept, "ticket.transfer");
  const canEdit = can(me, dept, "ticket.edit");
  const canAddTask = can(me, dept, "task.create");
  const canMark = can(me, dept, "ticket.markanswered");
  const { data: options } = useAssignees(ticket.ticket_id, panel === "assign");

  function toggle(next: Panel) {
    clear();
    setNote("");
    setPanel(panel === next ? null : next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = note.trim() ? { note: note.trim() } : {};
    let ok = false;
    if (panel === "assign") {
      const [kind, id] = assignee.split(":");
      if (!id) return;
      const label = [...(options?.agents ?? []), ...(options?.teams ?? [])].find((o) => String(o.id) === id)?.name ?? "";
      ok =
        kind === "team"
          ? await run("assign-team", { team_id: Number(id), ...text }, `Ticket assigned to ${label}.`)
          : await run("assign", { staff_id: Number(id), ...text }, `Ticket assigned to ${label}.`);
    } else if (panel === "transfer") {
      if (!targetDept) return;
      const name = departments.data?.find((d) => String(d.id) === targetDept)?.name ?? "";
      ok = await run("transfer", { dept_id: Number(targetDept), ...text }, `Ticket transferred to ${name}.`);
    } else if (panel === "close") ok = await run("close", text, "Ticket closed.");
    else if (panel === "reopen") ok = await run("reopen", text, "Ticket reopened.");
    else if (panel === "release")
      // osTicket refuses to release a team (or agent) the ticket does not have, so ask only for what is assigned.
      ok = await run("release", { staff: ticket.assignee_staff_id != null, team: ticket.team_id != null, ...text }, "Ticket released.");
    if (ok) {
      setPanel(null);
      setNote("");
      setAssignee("");
      setTargetDept("");
    }
  }

  const titles = { assign: "Assign", transfer: "Transfer", close: "Close Ticket", reopen: "Reopen Ticket", release: "Release Ticket" } as const;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {isOpen && !assigned && canAssign && (
          <button type="button" className={button} disabled={busy} onClick={() => run("claim", {}, "Ticket assigned to you.")}>
            Claim
          </button>
        )}
        {isOpen && canAssign && (
          <button type="button" className={button} onClick={() => toggle("assign")} aria-expanded={panel === "assign"}>
            Assign
          </button>
        )}
        {canEdit && (
          <Link href={`/tickets/${ticket.ticket_id}/edit`} className={button}>
            Edit
          </Link>
        )}
        {canAddTask && (
          <Link href={`/tasks/new?ticket_id=${ticket.ticket_id}`} className={button}>
            Add Task
          </Link>
        )}
        {canTransfer && (
          <button type="button" className={button} onClick={() => toggle("transfer")} aria-expanded={panel === "transfer"}>
            Transfer
          </button>
        )}
        {isOpen && assigned && canRelease && (
          <button type="button" className={button} onClick={() => toggle("release")}>
            Release
          </button>
        )}
        {isOpen && canMark && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() =>
              ticket.is_answered ? run("unanswered", {}, "Marked as unanswered.") : run("answered", {}, "Marked as answered.")
            }
          >
            {ticket.is_answered ? "Mark as Unanswered" : "Mark as Answered"}
          </button>
        )}
        {isOpen && canClose && (
          <button type="button" className={button} onClick={() => toggle("close")}>
            Close
          </button>
        )}
        {!isOpen && canClose && (
          <button type="button" className={button} onClick={() => toggle("reopen")}>
            Reopen
          </button>
        )}
      </div>

      <div className="mt-3">
        <NoticeBar notice={notice} />
      </div>

      {panel && (
        <form onSubmit={submit} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">{titles[panel]}</h3>
          {panel === "assign" && (
            <select aria-label="Assign to" required value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
              <option value="">— Select an agent or team —</option>
              {(options?.agents.length ?? 0) > 0 && (
                <optgroup label="Agents">
                  {options!.agents.map((a) => (
                    <option key={`a${a.id}`} value={`staff:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {(options?.teams.length ?? 0) > 0 && (
                <optgroup label="Teams">
                  {options!.teams.map((t) => (
                    <option key={`t${t.id}`} value={`team:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
          {panel === "transfer" && (
            <select aria-label="Department" required value={targetDept} onChange={(e) => setTargetDept(e.target.value)} className={field}>
              <option value="">— Select a department —</option>
              {departments.data
                ?.filter((d) => d.id !== ticket.dept_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          )}
          <textarea aria-label="Comments" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comments (optional)" className={field} />
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Working…" : titles[panel].split(" ")[0]}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** osTicket's "Post Reply" and "Post Internal Note" tabs under the thread. */
export function TicketReplyBox({ ticket }: { ticket: Ticket }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tickets/${ticket.ticket_id}`, ticketKeys.all);
  const [tab, setTab] = useState<"reply" | "note">("reply");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [cannedNote, setCannedNote] = useState<string | null>(null);
  const [append, setAppend] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [signature, setSignature] = useState("none");
  const [statusId, setStatusId] = useState("");
  const statuses = useTicketStatuses().data ?? [];
  const limits = useAttachmentLimits().data ?? undefined;
  const canned = useCannedList();

  const canReply = can(me, ticket.dept_id, "ticket.reply");
  // The picker offers enabled responses that are global or belong to this ticket's department.
  const pickable = (canned.data ?? []).filter((c) => c.is_enabled && (!c.dept_id || c.dept_id === ticket.dept_id));

  async function insertCanned(id: number) {
    setCannedNote(null);
    if (!id) return;
    // osTicket fills in the ticket's variables itself; the plain form is what the reply box holds.
    const { data, error } = await api.GET("/api/v1/tickets/{ticket_id}/canned/{canned_id}", {
      params: { path: { ticket_id: ticket.ticket_id, canned_id: id }, query: { plain: true } },
    });
    if (!data) return setCannedNote(error ? "Could not load the canned response." : null);
    const text = data.response ?? "";
    setMessage((current) => (append && current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
    if (data.files?.length) setCannedNote(`This response has files in osTicket (not added to this reply): ${data.files.map((f) => f.name).join(", ")}`);
  }
  // Notes follow the agent's access to the ticket; the server decides, so the tab is always offered.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || attachmentProblem(files, limits)) return;
    const attachments = {
      ...(files.length ? { attachments: await Promise.all(files.map(encodeFile)) } : {}),
      ...(statusId ? { status_id: Number(statusId) } : {}),
    };
    const ok =
      tab === "reply"
        ? await run("reply", { message, signature, ...attachments }, "Reply posted.")
        : await run("note", { message, ...(title.trim() ? { title: title.trim() } : {}), ...attachments }, "Internal note posted.");
    if (ok) {
      setMessage("");
      setTitle("");
      setFiles([]);
      setStatusId("");
    }
  }

  return (
    <section className="mt-6" aria-label="Post a response">
      <div className="flex border-b border-slate-300" role="tablist">
        {canReply && (
          <button
            role="tab"
            type="button"
            aria-selected={tab === "reply"}
            onClick={() => {
              setTab("reply");
              clear();
            }}
            className={`-mb-px border border-b-0 px-4 py-2 text-sm font-medium ${tab === "reply" ? "border-slate-300 bg-white" : "border-transparent text-sky-800"}`}
          >
            Post Reply
          </button>
        )}
        <button
          role="tab"
          type="button"
          aria-selected={tab === "note" || !canReply}
          onClick={() => {
            setTab("note");
            clear();
          }}
          className={`-mb-px border border-b-0 px-4 py-2 text-sm font-medium ${tab === "note" || !canReply ? "border-slate-300 bg-white" : "border-transparent text-sky-800"}`}
        >
          Post Internal Note
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3 border border-t-0 border-slate-300 bg-white p-4">
        <NoticeBar notice={notice} />
        {tab === "reply" && canReply && pickable.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Canned response"
              value=""
              onChange={(e) => insertCanned(Number(e.target.value))}
              className={`${field} max-w-xs`}
            >
              <option value="">— Select a canned response —</option>
              {pickable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-slate-700">
              <input type="checkbox" checked={append} onChange={(e) => setAppend(e.target.checked)} /> Append
            </label>
          </div>
        )}
        {cannedNote && (
          <p role="status" className="text-xs text-amber-800">
            {cannedNote}
          </p>
        )}
        {(tab === "note" || !canReply) && (
          <input aria-label="Note title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={255} className={field} />
        )}
        <textarea
          aria-label={tab === "reply" && canReply ? "Response" : "Internal note"}
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tab === "reply" && canReply ? "Type your response to the user" : "Internal note: visible to agents only"}
          className={field}
        />
        {tab === "reply" && canReply && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Signature</span>
            <select aria-label="Signature" value={signature} onChange={(e) => setSignature(e.target.value)} className={`${field} max-w-xs`}>
              <option value="none">None</option>
              <option value="mine">My Signature</option>
              <option value="dept">Department Signature</option>
            </select>
            <span className="text-xs text-slate-500">Added to the email only, not to the stored reply.</span>
          </label>
        )}
        <AttachmentPicker files={files} onChange={setFiles} />
        {statuses.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Ticket Status</span>
            <select aria-label="Ticket status" value={statusId} onChange={(e) => setStatusId(e.target.value)} className={`${field} max-w-xs`}>
              <option value="">— Unchanged —</option>
              {statuses.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={busy || !message.trim() || attachmentProblem(files, limits) !== null} className={primary}>
          {busy ? "Posting…" : tab === "reply" && canReply ? "Post Reply" : "Post Note"}
        </button>
      </form>
    </section>
  );
}
