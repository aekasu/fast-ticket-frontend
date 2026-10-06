"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useTask } from "@/lib/queries/tasks";
import { TaskEntryActions } from "./entry-actions";
import { TaskCollaborators } from "./task-collaborators";
import { TaskReplyBox, TaskToolbar } from "./task-actions";
import { CustomFieldsView } from "./custom-fields";
import { Info } from "./info-table";
import { Thread } from "./thread";
export function TaskView({ id }: { id: number }) {
  const { data: task, error, isLoading } = useTask(id);

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          task: Unknown or invalid ID.
        </p>
        <Link href="/tasks" className="text-sm text-sky-800 underline">
          Back to tasks
        </Link>
      </div>
    );
  }
  if (error || !task) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the task."}</p>;

  const assignee = [task.assignee_name, task.team_name].filter(Boolean).join(" / ");
  const posts = task.thread.filter((e) => e.type !== "E");

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/tasks" className="text-sky-800 hover:underline">
          ← Tasks
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">
        Task #{task.number} <span className="ml-2 text-base font-normal text-slate-600">{task.title}</span>
      </h1>

      <TaskToolbar task={task} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Info
          rows={[
            // osTicket calls a closed task "Completed"; the API names the status "Closed".
            ["Status", task.status.state === "closed" ? "Completed" : task.status.name],
            ["Created", formatDateTime(task.created)],
            ["Due Date", formatDateTime(task.due_date)],
          ]}
        />
        <Info
          rows={[
            ["Department", task.dept_name],
            ["Assigned To", assignee || <span className="text-slate-500">— Unassigned —</span>],
            [
              "Ticket",
              task.ticket_id != null ? (
                <Link key="ticket" href={`/tickets/${task.ticket_id}`} className="text-sky-800 hover:underline">
                  Ticket #{task.ticket_number}
                </Link>
              ) : (
                ""
              ),
            ],
          ]}
        />
      </div>

      <TaskCollaborators task={task} />

      <CustomFieldsView answers={task.custom_fields} form="A" />

      <h2 className="mt-4 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Task Thread ({posts.length})</h2>
      <Thread entries={task.thread} attachmentHref={(attachmentId) => `/api/v1/tasks/${task.task_id}/attachments/${attachmentId}`} renderActions={(entry) => <TaskEntryActions task={task} entry={entry} />} />

      <TaskReplyBox task={task} />
    </div>
  );
}
