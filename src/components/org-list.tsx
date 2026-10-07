"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { type OrgSort, useOrgs } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { DirectoryTabs } from "./directory-tabs";
import { ColumnsPicker, useCustomColumns } from "./custom-columns";
import { Pager } from "./pager";

const PAGE_SIZE = 25;
const SORTS: OrgSort[] = ["name", "users", "created", "updated"];

const COLUMNS: { label: string; sort: OrgSort }[] = [
  { label: "Name", sort: "name" },
  { label: "Users", sort: "users" },
  { label: "Created", sort: "created" },
  { label: "Last Updated", sort: "updated" },
];

/** Search, sort and page are in the URL, like the other lists. */
export function OrgList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const q = params.get("q") ?? "";
  const sortParam = params.get("sort") as OrgSort | null;
  const sort: OrgSort = sortParam && SORTS.includes(sortParam) ? sortParam : "name";
  const descending = params.get("dir") === "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(q);
  const custom = useCustomColumns("O");
  const { data, error, isFetching } = useOrgs({ fields: custom.fields, q: q || undefined, sort, descending, page, page_size: PAGE_SIZE });
  const total = data?.total ?? 0;

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`/orgs?${next.toString()}`);
  }

  return (
    <div>
      <DirectoryTabs current="orgs" />
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
          aria-label="Search organizations"
          placeholder="Search by name, address, phone or website"
          maxLength={100}
          className="w-80 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
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
        <span className="text-xs text-slate-500">{isFetching ? "Loading…" : `${total} organization${total === 1 ? "" : "s"}`}</span>
        <ColumnsPicker defs={custom.defs} selected={custom.selected} onChange={(names) => go({ cols: names.join(",") || null, page: null })} />
        {me && hasGlobal(me, "org.create") && (
          <Link href="/orgs/new" className="ml-auto rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add Organization
          </Link>
        )}
      </form>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.label} className="px-3 py-2 font-semibold">
                  <button type="button" className="uppercase hover:underline" onClick={() => go({ sort: col.sort, dir: sort === col.sort && !descending ? "desc" : "asc", page: null })}>
                    {col.label}
                    {sort === col.sort && <span aria-hidden> {descending ? "▼" : "▲"}</span>}
                  </button>
                </th>
              ))}
              {custom.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.id} className="border-t border-slate-200 hover:bg-sky-50">
                <td className="px-3 py-2">
                  <Link href={`/orgs/${o.id}`} className="font-medium text-sky-800 hover:underline">
                    {o.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{o.user_count}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(o.created)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(o.updated)}</td>
              {custom.cells(o.custom_fields).map((c, i) => (
                <td key={i} className="px-3 py-2">
                  {c}
                </td>
              ))}
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + custom.headers.length} className="px-3 py-6 text-center text-slate-500">
                  {q ? "No organizations match your search." : "Query returned 0 results."}
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
