"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { canCreateTasks } from "@/lib/nav";
import { useMe } from "@/lib/queries/me";
import { type TaskQueue, type TaskSort, useTaskCounts, useTaskList } from "@/lib/queries/tasks";

const PAGE_SIZE = 25;
const SORTS: TaskSort[] = ["updated", "created", "due_date", "number", "title", "dept", "ticket", "closed"];
const QUEUES: TaskQueue[] = ["open", "overdue", "assigned", "closed"];

// osTicket's task columns. `sort` is the API key (none: not sortable through the API).
const COLUMNS: { label: string; sort?: TaskSort }[] = [
  { label: "Number", sort: "number" },
  { label: "Ticket", sort: "ticket" },
  { label: "Date Created", sort: "created" },
  { label: "Title", sort: "title" },
  { label: "Department", sort: "dept" },
  { label: "Agent" },
];

export function TaskList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const queueParam = params.get("queue") as TaskQueue | null;
  const queue: TaskQueue = queueParam && QUEUES.includes(queueParam) ? queueParam : "open";
  const q = params.get("q") ?? "";
  const sortParam = params.get("sort") as TaskSort | null;
  const sort: TaskSort = sortParam && SORTS.includes(sortParam) ? sortParam : "updated";
  const descending = params.get("dir") !== "asc";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const { queues, error: countsError } = useTaskCounts();
  const { data, error, isFetching } = useTaskList({
    queue,
    q: q || undefined,
    sort,
    descending,
    page,
    page_size: PAGE_SIZE,
  });
  const [search, setSearch] = useState(q);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/tasks?${next.toString()}`);
  }

  // The API lists the tabs the agent's queues give, with osTicket's titles and counts.
  const tabs = queues.length ? queues : [{ key: "open", title: "Open", count: undefined }];
  const canCreate = me ? canCreateTasks(me) : false;

  return (
    <div>
      <ul className="mb-4 flex flex-wrap border-b border-slate-300" aria-label="Task queues">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={`/tasks?queue=${t.key}`}
              className={`-mb-px block border border-b-0 px-4 py-2 text-sm font-medium ${
                t.key === queue ? "border-slate-300 bg-white text-slate-900" : "border-transparent text-sky-800 hover:bg-slate-200"
              }`}
            >
              {t.title} <span className="text-xs text-slate-500">({t.count ?? "…"})</span>
            </Link>
          </li>
        ))}
        {canCreate && (
          <li>
            <Link href="/tasks/new" className="-mb-px block border border-transparent px-4 py-2 text-sm font-medium text-sky-800 hover:bg-slate-200">
              New Task
            </Link>
          </li>
        )}
      </ul>
      {countsError && <p className="mb-2 text-sm text-red-700">Counts unavailable: {countsError.message}</p>}

      <form
        className="mb-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim(), page: null });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          placeholder="Search tasks"
          aria-label="Search tasks"
          className="w-72 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
          Search
        </button>
        {q && (
          <button
            type="button"
            className="text-sm text-sky-800 underline"
            onClick={() => {
              setSearch("");
              go({ q: null, page: null });
            }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{isFetching ? "Loading…" : `${total} task${total === 1 ? "" : "s"}`}</span>
      </form>

      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}

      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-3 py-2 font-semibold">
                  {col.sort ? (
                    <button
                      type="button"
                      className="uppercase hover:underline"
                      onClick={() => go({ sort: col.sort!, dir: sort === col.sort && descending ? "asc" : "desc", page: null })}
                    >
                      {col.label}
                      {sort === col.sort && <span aria-hidden> {descending ? "▼" : "▲"}</span>}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((t) => (
              <tr key={t.task_id} data-overdue={t.is_overdue || undefined} className={`border-t border-slate-200 hover:bg-sky-50 ${t.is_overdue ? "text-red-700" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link href={`/tasks/${t.task_id}`} className="font-medium text-sky-800 hover:underline">
                    {t.number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {t.ticket_id != null && (
                    <Link href={`/tickets/${t.ticket_id}`} className="text-sky-800 hover:underline">
                      {t.ticket_number}
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.created)}</td>
                <td className="px-3 py-2">
                  <Link href={`/tasks/${t.task_id}`} className="text-sky-800 hover:underline">
                    {t.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{t.dept_name}</td>
                <td className="px-3 py-2">{t.assignee_name ?? t.team_name ?? ""}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-slate-500">
                  {q ? "No tasks match your search." : "Query returned 0 results."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-3 flex items-center gap-3 text-sm" aria-label="Pages">
          <button type="button" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })} className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })} className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40">
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
