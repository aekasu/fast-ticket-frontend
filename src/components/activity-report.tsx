"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { DashboardTabs } from "./dashboard-tabs";
import { field } from "./action-ui";

const PERIODS = [
  ["until_today", "Up to today"],
  ["one_week", "One week"],
  ["two_weeks", "Two weeks"],
  ["one_month", "One month"],
  ["one_quarter", "One quarter"],
] as const;
const GROUPS = [
  ["department", "Department"],
  ["topic", "Help Topic"],
  ["agent", "Agent"],
] as const;
type Period = (typeof PERIODS)[number][0];
type Group = (typeof GROUPS)[number][0];

const COLORS = ["#0369a1", "#15803d", "#b45309", "#7c3aed", "#be123c", "#475569"];

function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/** osTicket's Dashboard: tickets opened, assigned, overdue, closed, reopened and deleted per department, topic or agent over a period. */
export function ActivityReport() {
  const [start, setStart] = useState(monthAgo);
  const [period, setPeriod] = useState<Period>("until_today");
  const [group, setGroup] = useState<Group>("department");
  const report = useQuery({
    queryKey: ["dashboard-report", start, period, group],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/dashboard/report", { params: { query: { start, period, group } } });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
  const r = report.data;

  function csv() {
    if (!r) return;
    const quote = (c: string) => `"${c.replaceAll('"', '""')}"`;
    const text = [r.table.columns, ...r.table.rows].map((row) => row.map(quote).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `stats-${start}-${group}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <DashboardTabs current="report" />
      <h1 className="mb-3 text-xl font-bold text-slate-800">Activity Report</h1>
      <form className="mb-4 flex flex-wrap items-end gap-3" aria-label="Report options" onSubmit={(e) => e.preventDefault()}>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Report timeframe</span>
          <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={field}>
            {PERIODS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Group by</span>
          <select value={group} onChange={(e) => setGroup(e.target.value as Group)} className={field}>
            {GROUPS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!r} onClick={csv} className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50">
          Export CSV
        </button>
      </form>

      {report.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {report.error && <p role="alert" className="text-sm text-red-700">{report.error.message}</p>}
      {r && (
        <>
          <Plot days={r.plot.days} series={r.plot.series} />
          <table className="mt-4 w-full border border-slate-300 bg-white text-left text-sm" aria-label="Activity">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                {r.table.columns.map((c) => (
                  <th key={c} className="px-3 py-2 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.table.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-200">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {r.table.rows.length === 0 && (
                <tr>
                  <td colSpan={r.table.columns.length} className="px-3 py-3 text-center text-slate-500">
                    No activity in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** One line per event over the days of the report, drawn inline: no chart library. */
function Plot({ days, series }: { days: string[]; series: { event: string; counts: number[] }[] }) {
  const W = 720;
  const H = 180;
  const max = Math.max(1, ...series.flatMap((s) => s.counts));
  const x = (i: number) => (days.length <= 1 ? W / 2 : 30 + (i * (W - 40)) / (days.length - 1));
  const y = (v: number) => H - 20 - (v * (H - 40)) / max;
  return (
    <figure aria-label="Activity per day" className="border border-slate-300 bg-white p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Events per day, ${days[0] ?? ""} to ${days[days.length - 1] ?? ""}`}>
        <line x1="30" y1={H - 20} x2={W - 10} y2={H - 20} stroke="#cbd5e1" />
        <text x="2" y="24" fontSize="11" fill="#475569">
          {max}
        </text>
        {series.map((s, k) => (
          <polyline key={s.event} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2" points={s.counts.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-slate-700">
        {series.map((s, k) => (
          <span key={s.event} className="flex items-center gap-1">
            <span className="inline-block h-2 w-4" style={{ background: COLORS[k % COLORS.length] }} />
            {s.event} ({s.counts.reduce((a, b) => a + b, 0)})
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
