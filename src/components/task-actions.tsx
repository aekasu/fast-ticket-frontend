"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { can, useMe } from "@/lib/queries/me";
import { useDepartments } from "@/lib/queries/reference";
import { taskKeys, useTaskAssignees } from "@/lib/queries/tasks";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";
import { parseApiDate } from "@/lib/format";

type Task = components["schemas"]["TaskDetail"];
type Panel = "assign" | "transfer" | "edit" | "close" | "reopen" | null;

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = parseApiDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskToolbar({ task }: { task: Task }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tasks/${task.task_id}`, taskKeys.all);
  const departments = useDepartments();
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [targetDept, setTargetDept] = useState("");

  const dept = task.dept_id;
  const isOpen = task.status.state === "open";
  const assigned = task.assignee_staff_id != null || task.team_id != null;
  const canAssign = can(me, dept, "task.assign");
  const canTransfer = can(me, dept, "task.transfer");
  const canEdit = can(me, dept, "task.edit");
  const canClose = can(me, dept, "task.close");
  const { data: options } = useTaskAssignees(task.task_id, panel === "assign");

  function toggle(next: Panel) {
    clear();
    setNote("");
    setPanel(panel === next ? null : next);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const comment = note.trim() ? { note: note.trim() } : {};
    let ok = false;
    if (panel === "assign") {
      const [kind, id] = assignee.split(":");
      if (!id) return;
      const label = [...(options?.agents ?? []), ...(options?.teams ?? [])].find((o) => String(o.id) === id)?.name ?? "";
      ok = await run("assign", { ...(kind === "team" ? { team_id: Number(id) } : { staff_id: Number(id) }), ...comment }, `Task assigned to ${label}.`);
    } else if (panel === "transfer") {
      if (!targetDept) return;
      const name = departments.data?.find((d) => String(d.id) === targetDept)?.name ?? "";
      ok = await run("transfer", { dept_id: Number(targetDept), ...comment }, `Task transferred to ${name}.`);
    } else if (panel === "close") ok = await run("close", comment, "Task closed.");
    else if (panel === "reopen") ok = await run("reopen", comment, "Task reopened.");
    else if (panel === "edit") {
      const text = (name: string) => String(form.get(name) ?? "").trim();
      const body: Record<string, unknown> = {};
      if (text("title") !== task.title) body.title = text("title");
      const due = text("due_date");
      if (due !== toLocalInput(task.due_date)) body.due_date = due ? new Date(due).toISOString() : null;
      if (Object.keys(body).length === 0) {
        // Nothing to send: say so rather than queueing an empty edit.
        clear();
        return;
      }
      ok = await run("", { ...body, ...comment }, "Task updated."); // empty action: PATCH the task itself
    }
    if (ok) {
      setPanel(null);
      setNote("");
      setAssignee("");
      setTargetDept("");
    }
  }

  const titles = { assign: "Assign", transfer: "Transfer", edit: "Edit Task", close: "Close Task", reopen: "Reopen Task" } as const;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {isOpen && !assigned && canAssign && (
          <button type="button" className={button} disabled={busy} onClick={() => run("claim", {}, "Task assigned to you.")}>
            Claim
          </button>
        )}
        {isOpen && canAssign && (
          <button type="button" className={button} onClick={() => toggle("assign")} aria-expanded={panel === "assign"}>
            Assign
          </button>
        )}
        {canEdit && (
          <button type="button" className={button} onClick={() => toggle("edit")} aria-expanded={panel === "edit"}>
            Edit
          </button>
        )}
        {canTransfer && (
          <button type="button" className={button} onClick={() => toggle("transfer")} aria-expanded={panel === "transfer"}>
            Transfer
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
                ?.filter((d) => d.id !== task.dept_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          )}
          {panel === "edit" && (
            <>
              <input aria-label="Title" name="title" required defaultValue={task.title} maxLength={255} className={field} />
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Due Date</span>
                <input aria-label="Due Date" name="due_date" type="datetime-local" defaultValue={toLocalInput(task.due_date)} className={field} />
              </label>
            </>
          )}
          <textarea aria-label="Comments" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comments (optional)" className={field} />
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Working…" : panel === "edit" ? "Save" : titles[panel].split(" ")[0]}
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

/** osTicket's "Post Update" and "Post Internal Note" tabs under a task's thread. */
export function TaskReplyBox({ task }: { task: Task }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tasks/${task.task_id}`, taskKeys.all);
  const canReply = can(me, task.dept_id, "task.reply");
  const [tab, setTab] = useState<"reply" | "note">("reply");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const noteTab = tab === "note" || !canReply;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const ok = noteTab
      ? await run("note", { note: message, ...(title.trim() ? { title: title.trim() } : {}) }, "Internal note posted.")
      : await run("reply", { message }, "Update posted.");
    if (ok) {
      setMessage("");
      setTitle("");
    }
  }

  const tabClass = (active: boolean) => `-mb-px border border-b-0 px-4 py-2 text-sm font-medium ${active ? "border-slate-300 bg-white" : "border-transparent text-sky-800"}`;
  return (
    <section className="mt-6" aria-label="Post a task response">
      <div className="flex border-b border-slate-300" role="tablist">
        {canReply && (
          <button role="tab" type="button" aria-selected={!noteTab} className={tabClass(!noteTab)} onClick={() => { setTab("reply"); clear(); }}>
            Post Update
          </button>
        )}
        <button role="tab" type="button" aria-selected={noteTab} className={tabClass(noteTab)} onClick={() => { setTab("note"); clear(); }}>
          Post Internal Note
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3 border border-t-0 border-slate-300 bg-white p-4">
        <NoticeBar notice={notice} />
        {noteTab && <input aria-label="Note title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={255} className={field} />}
        <textarea
          aria-label={noteTab ? "Internal note" : "Update"}
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={noteTab ? "Internal note: visible to agents only" : "Post an update to the task's collaborators"}
          className={field}
        />
        <p className="text-xs text-slate-500">Attachments cannot be uploaded yet (the API has no upload).</p>
        <button type="submit" disabled={busy || !message.trim()} className={primary}>
          {busy ? "Posting…" : noteTab ? "Post Note" : "Post Update"}
        </button>
      </form>
    </section>
  );
}
