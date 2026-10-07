"use client";

import Link from "next/link";
import { useState } from "react";
import { AttachmentPicker, useAttachmentLimits } from "./attachment-picker";
import { StoredFiles } from "./stored-files";
import { attachmentProblem, encodeFile } from "@/lib/attachments";
import type { components } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { canManageCanned } from "@/lib/nav";
import { createdId } from "@/lib/queries/directory";
import { kbKeys, useCanned, useCannedList } from "@/lib/queries/kb";
import { useMe } from "@/lib/queries/me";
import { useDepartments } from "@/lib/queries/reference";
import { useSubmitCommand } from "@/lib/queries/submit";
import { field } from "./action-ui";
import { DeleteButton } from "./delete-button";
import { FormButtons, FormError, FormRow, formBox } from "./form-kit";
import { KbTabs } from "./kb-tabs";

type Canned = components["schemas"]["CannedDetail"];

export function CannedList() {
  const { data: me } = useMe();
  const list = useCannedList();
  const departments = useDepartments();
  const dept = (id: number) => (id ? (departments.data?.find((d) => d.id === id)?.name ?? "…") : "— All Departments —");
  return (
    <div>
      <KbTabs current="canned" showCanned />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Canned Responses</h1>
        {me && canManageCanned(me) && (
          <Link href="/kb/canned/new" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add New Response
          </Link>
        )}
      </div>
      {list.error && <p role="alert" className="mb-3 text-sm text-red-700">{list.error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Title", "Status", "Department", "Last Updated"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.data?.map((c) => (
              <tr key={c.id} className="border-t border-slate-200 hover:bg-sky-50">
                <td className="px-3 py-2">
                  <Link href={`/kb/canned/${c.id}`} className="font-medium text-sky-800 hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.is_enabled ? "Active" : "Disabled"}</td>
                <td className="px-3 py-2">{dept(c.dept_id ?? 0)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(c.updated)}</td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No canned responses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CannedFormBody({ canned }: { canned?: Canned }) {
  const departments = useDepartments();
  const { submit, error, setError, busy } = useSubmitCommand([kbKeys.canned]);
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const limits = useAttachmentLimits().data ?? undefined;
  if (departments.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = attachmentProblem(files, limits);
    if (problem) return setError(problem);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "");
    const next = {
      title: text("title").trim(),
      response: text("response"),
      notes: text("notes"),
      dept_id: Number(text("dept_id")),
      is_enabled: text("is_enabled") === "1",
    };
    const added = files.length ? { attachments: await Promise.all(files.map(encodeFile)) } : {};
    if (canned) {
      const body: Record<string, unknown> = { ...added, ...(removed.length ? { remove_attachment_ids: removed } : {}) };
      for (const k of Object.keys(next) as (keyof typeof next)[]) if (next[k] !== (canned[k] ?? (k === "is_enabled" ? false : k === "dept_id" ? 0 : ""))) body[k] = next[k];
      if (Object.keys(body).length === 0) return setError("No changes to save.");
      await submit("PATCH", `/api/v1/canned/${canned.id}`, body, () => "/kb/canned");
    } else {
      await submit("POST", "/api/v1/canned", { ...next, ...added }, (r) => (createdId(r) ? "/kb/canned" : "/kb/canned"));
    }
  }

  return (
    <>
      <FormError message={error} />
      <form onSubmit={onSubmit} className={formBox}>
        <FormRow label="Status" required>
          <select name="is_enabled" defaultValue={canned ? (canned.is_enabled ? "1" : "0") : "1"} className={field}>
            <option value="1">Active</option>
            <option value="0">Disabled</option>
          </select>
        </FormRow>
        <FormRow label="Department" required>
          <select name="dept_id" defaultValue={canned?.dept_id ?? 0} className={field}>
            <option value={0}>— All Departments —</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Title" required>
          <input name="title" required defaultValue={canned?.title} maxLength={255} className={field} />
        </FormRow>
        <FormRow label="Canned Response" required>
          <textarea name="response" required rows={10} defaultValue={canned?.response ?? ""} className={field} />
        </FormRow>
        <FormRow label="Attachments">
          <div className="space-y-2">
            {canned && <StoredFiles files={canned.attachments} hrefOf={(id) => `/api/v1/canned/${canned.id}/attachments/${id}`} removed={removed} onToggle={(id) => setRemoved((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]))} />}
            <AttachmentPicker files={files} onChange={setFiles} />
          </div>
        </FormRow>
        <FormRow label="Internal Notes">
          <textarea name="notes" rows={3} defaultValue={canned?.notes ?? ""} className={field} />
        </FormRow>
        <p className="text-xs text-slate-500">Supported variables such as %{"{"}ticket.number{"}"} are filled in when the response is used.</p>
        <FormButtons busy={busy} submitLabel={canned ? "Save Changes" : "Add Response"} cancelHref="/kb/canned" />
      </form>
    </>
  );
}

export function CannedNew() {
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/kb/canned" className="text-sky-800 hover:underline">
          ← Canned Responses
        </Link>
      </p>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Add New Canned Response</h1>
      <CannedFormBody />
    </div>
  );
}

/** osTicket edits a canned response on its own page ("Update Canned Response"), with Delete beside it. */
export function CannedEdit({ id }: { id: number }) {
  const { data: me } = useMe();
  const { data: canned, error, isLoading } = useCanned(id);
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error instanceof ApiError && error.status === 404) return <p className="text-sm">Unknown or invalid canned response ID.</p>;
  if (error || !canned) return <p role="alert" className="text-sm text-red-700">{error?.message ?? "Unable to load the canned response."}</p>;
  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/kb/canned" className="text-sky-800 hover:underline">
          ← Canned Responses
        </Link>
      </p>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-800">Update Canned Response — {canned.title}</h1>
        {me && canManageCanned(me) && <DeleteButton noun="canned response" path={`/api/v1/canned/${canned.id}`} redirectTo="/kb/canned" invalidate={kbKeys.canned} />}
      </div>
      {me && !canManageCanned(me) ? <p className="text-sm">Access denied. You do not have permission to manage canned responses.</p> : <CannedFormBody canned={canned} />}
    </div>
  );
}
