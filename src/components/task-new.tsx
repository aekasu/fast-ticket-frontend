"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { useDepartments } from "@/lib/queries/reference";
import { taskKeys } from "@/lib/queries/tasks";
import { useTicket } from "@/lib/queries/tickets";
import { collectCustomFields, customDefs } from "@/lib/custom-fields";
import { useFormDefinition } from "@/lib/queries/forms";
import { attachmentProblem, encodeFile } from "@/lib/attachments";
import { field } from "./action-ui";
import { AttachmentPicker, useAttachmentLimits } from "./attachment-picker";
import { CustomFieldInputs } from "./custom-fields";

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[11rem_1fr]">
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {children}
    </label>
  );
}

/** osTicket's "Open a New Task", optionally linked to a ticket (`?ticket_id=`), as from a ticket's Tasks tab. */
export function TaskNew() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const departments = useDepartments();
  const ticketId = /^\d+$/.test(params.get("ticket_id") ?? "") ? Number(params.get("ticket_id")) : undefined;
  const ticket = useTicket(ticketId ?? 0);
  const formDefs = useFormDefinition("A");
  const custom = customDefs(formDefs.data ?? [], "A");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const limits = useAttachmentLimits().data ?? undefined;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problem = attachmentProblem(files, limits);
    if (problem) return setError(problem);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body = {
      title: text("title"),
      description: text("description"),
      dept_id: text("dept_id") ? Number(text("dept_id")) : undefined,
      due_date: text("due_date") ? new Date(text("due_date")).toISOString() : undefined,
      ticket_id: ticketId,
      custom_fields: undefined as Record<string, unknown> | undefined,
      attachments: undefined as Awaited<ReturnType<typeof encodeFile>>[] | undefined,
    };
    if (files.length) body.attachments = await Promise.all(files.map(encodeFile));
    const answers = collectCustomFields(form, custom);
    if (Object.keys(answers).length > 0) body.custom_fields = answers;
    try {
      const result = await runCommand({ method: "POST", path: "/api/v1/tasks/", body, key: key.current() });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: taskKeys.all });
      router.push(`/tasks/${result.task_id}`);
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/tasks" className="text-sky-800 hover:underline">
          ← Tasks
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Open a New Task</h1>
      {ticketId != null && ticket.data && (
        <p className="mb-3 text-sm">
          Linked to <Link href={`/tickets/${ticketId}`} className="text-sky-800 underline">Ticket #{ticket.data.number}</Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} className="max-w-3xl space-y-3 border border-slate-300 bg-white p-4">
        <Row label="Title" required>
          <input name="title" required maxLength={255} className={field} />
        </Row>
        <Row label="Description" required>
          <textarea name="description" required rows={6} className={field} />
        </Row>
        <CustomFieldInputs defs={custom} />
        <Row label="Department">
          <select name="dept_id" className={field} defaultValue="">
            <option value="">— Default —</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Due Date">
          <input name="due_date" type="datetime-local" className={field} />
        </Row>
        <AttachmentPicker files={files} onChange={setFiles} />
        <p className="text-xs text-slate-500">Due date is entered in your browser&apos;s timezone.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
            {busy ? "Creating…" : "Create Task"}
          </button>
          <Link href="/tasks" className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
