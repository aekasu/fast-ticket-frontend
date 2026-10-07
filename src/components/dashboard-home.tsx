"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { useMe } from "@/lib/queries/me";
import { useTaskCounts } from "@/lib/queries/tasks";
import { useQueueCounts, useTicketList } from "@/lib/queries/tickets";
import { DashboardTabs } from "./dashboard-tabs";

function Card({ href, label, value }: { href: string; label: string; value: number | undefined }) {
  return (
    <Link href={href} className="block border border-slate-300 bg-white px-4 py-3 hover:bg-sky-50">
      <span className="block text-2xl font-bold text-slate-800">{value ?? "…"}</span>
      <span className="text-sm text-sky-800">{label}</span>
    </Link>
  );
}

/**
 * The landing page: the agent's own queues and assigned tickets. osTicket's activity report is its own tab (/report).
 */
export function DashboardHome() {
  const { data: me } = useMe();
  const queues = useQueueCounts();
  const taskCounts = useTaskCounts();
  const mine = useTicketList({ queue: "assigned_me", sort: "updated", descending: true, page: 1, page_size: 5 });
  const count = (key: string) => queues.data?.find((q) => q.key === key)?.count;

  return (
    <div>
      <DashboardTabs current="dashboard" />
      <h1 className="mb-1 text-xl font-bold text-slate-800">Dashboard</h1>
      <p className="mb-4 text-sm text-slate-600">
        Signed in as <strong>{me?.username}</strong> ({me?.is_admin ? "administrator" : "agent"}).
      </p>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Tickets</h2>
      {queues.error && <p role="alert" className="mb-2 text-sm text-red-700">{queues.error.message}</p>}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Ticket queues">
        <Card href="/tickets?queue=open" label="Open" value={count("open")} />
        <Card href="/tickets?queue=answered" label="Answered" value={count("answered")} />
        <Card href="/tickets?queue=overdue" label="Overdue" value={count("overdue")} />
        <Card href="/tickets?queue=closed" label="Closed" value={count("closed")} />
        <Card href="/tickets?queue=mine" label="My Tickets" value={count("mine")} />
        <Card href="/tickets?queue=assigned_me" label="Assigned to Me" value={count("assigned_me")} />
        <Card href="/tickets?queue=assigned_teams" label="Assigned to Teams" value={count("assigned_teams")} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Tasks</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Task queues">
        <Card href="/tasks?queue=open" label="Open" value={taskCounts.counts.open} />
        <Card href="/tasks?queue=overdue" label="Overdue" value={taskCounts.counts.overdue} />
        <Card href="/tasks?queue=assigned" label="My Tasks" value={taskCounts.counts.assigned} />
        <Card href="/tasks?queue=closed" label="Completed" value={taskCounts.counts.closed} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Assigned to me</h2>
      <table className="mb-6 w-full border border-slate-300 bg-white text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {["Ticket", "Last Updated", "Subject", "From", "Priority"].map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mine.data?.items.map((t) => (
            <tr key={t.ticket_id} className="border-t border-slate-200 hover:bg-sky-50">
              <td className="px-3 py-2">
                <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-sky-800 hover:underline">
                  {t.number}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2">{formatDateTime(t.updated)}</td>
              <td className="px-3 py-2">{t.subject}</td>
              <td className="px-3 py-2">{t.user_name}</td>
              <td className="px-3 py-2">{t.priority_name}</td>
            </tr>
          ))}
          {mine.data && mine.data.items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                Nothing is assigned to you.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-sm">
        <Link href="/report" className="text-sky-800 underline">
          Ticket activity report →
        </Link>
      </p>
    </div>
  );
}
