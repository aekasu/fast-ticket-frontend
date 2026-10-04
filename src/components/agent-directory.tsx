"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useDepartments } from "@/lib/queries/reference";
import { DashboardTabs } from "./dashboard-tabs";
import { Pager } from "./pager";
import { useState } from "react";

const PAGE_SIZE = 25;

export function AgentDirectory() {
  const router = useRouter();
  const params = useSearchParams();
  const departments = useDepartments();
  const q = params.get("q") ?? "";
  const deptId = /^\d+$/.test(params.get("did") ?? "") ? Number(params.get("did")) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(q);

  const { data, error, isFetching } = useQuery({
    queryKey: ["agents", "directory", { q, deptId, page }],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/agents", {
        params: { query: { q: q || undefined, dept_id: deptId, sort: "name", page, page_size: PAGE_SIZE } },
      });
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
    placeholderData: keepPreviousData,
  });

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/directory?${next.toString()}`);
  }
  const total = data?.total ?? 0;

  return (
    <div>
      <DashboardTabs current="directory" />
      <h1 className="mb-3 text-xl font-bold text-slate-800">Agents</h1>
      <form
        className="mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: search.trim(), page: null });
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search agents"
          placeholder="Search by name, email or phone"
          maxLength={100}
          className="w-72 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
        />
        <select aria-label="Department" value={deptId ?? ""} onChange={(e) => go({ did: e.target.value, page: null })} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm">
          <option value="">— All Departments —</option>
          {departments.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
          Search
        </button>
        <span className="ml-auto text-xs text-slate-500">{isFetching ? "Loading…" : `${total} agent${total === 1 ? "" : "s"}`}</span>
      </form>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Name", "Department", "Email Address", "Phone Number", "Extension", "Mobile Number"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id} className="border-t border-slate-200 hover:bg-sky-50">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2">{a.dept_name}</td>
                <td className="px-3 py-2">{a.email}</td>
                <td className="px-3 py-2">{a.phone}</td>
                <td className="px-3 py-2">{a.phone_ext}</td>
                <td className="px-3 py-2">{a.mobile}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No agents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={page * PAGE_SIZE < total} onPage={(p) => go({ page: String(p) })} />
    </div>
  );
}
