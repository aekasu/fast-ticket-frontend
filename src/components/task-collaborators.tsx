"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { useUserOptions } from "@/lib/queries/directory";
import { can, useMe } from "@/lib/queries/me";
import { taskKeys } from "@/lib/queries/tasks";
import { NoticeBar, button, field, useRunner } from "./action-ui";

type Task = components["schemas"]["TaskDetail"];

/**
 * osTicket's "Collaborators" row on a task, with an add action. osTicket's task page checks the *ticket* edit
 * permission for it, and has no change or remove for a task's collaborators.
 */
export function TaskCollaborators({ task }: { task: Task }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/tasks/${task.task_id}`, taskKeys.all);
  const canAdd = can(me, task.dept_id, "ticket.edit");
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const users = useUserOptions(adding);
  const present = new Set(task.collaborators.map((c) => c.user_id));
  const candidates = (users.data ?? []).filter((u) => !present.has(u.id));

  if (task.collaborators.length === 0 && !canAdd) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const name = users.data?.find((u) => String(u.id) === userId)?.name ?? "";
    if (await run("collaborators", { user_id: Number(userId) }, `${name} added as a collaborator.`)) {
      setUserId("");
      setAdding(false);
    }
  }

  return (
    <section className="mt-4 max-w-2xl" aria-label="Task collaborators">
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Collaborators ({task.collaborators.length})</h2>
      {task.collaborators.length > 0 ? (
        <ul className="border border-slate-300 bg-white text-sm">
          {task.collaborators.map((c) => (
            <li key={c.user_id} className="border-b border-slate-200 px-3 py-1.5 last:border-b-0">
              {c.name} <span className="text-slate-500">&lt;{c.email}&gt;</span>
              {!c.is_active && <span className="ml-2 text-xs text-slate-500">(disabled)</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No collaborators.</p>
      )}
      <div className="mt-2">
        <NoticeBar notice={notice} />
      </div>
      {canAdd &&
        (adding ? (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2" aria-label="Add a task collaborator">
            <select aria-label="User" required value={userId} onChange={(e) => setUserId(e.target.value)} className={`${field} max-w-xs`}>
              <option value="">— Select a user —</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} &lt;{u.email}&gt;
                </option>
              ))}
            </select>
            <button type="submit" disabled={busy || !userId} className={button}>
              {busy ? "Adding…" : "Add Collaborator"}
            </button>
            <button type="button" className="text-sm text-sky-800 underline" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className={button}
            onClick={() => {
              clear();
              setAdding(true);
            }}
          >
            Add Collaborator
          </button>
        ))}
      {adding && users.data === null && !users.isLoading && <p className="mt-1 text-sm text-amber-800">Your account cannot list users, so people cannot be picked here.</p>}
    </section>
  );
}
