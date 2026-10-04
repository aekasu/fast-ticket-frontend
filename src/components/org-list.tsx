"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { useOrgs } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { DirectoryTabs } from "./directory-tabs";
import { Pager } from "./pager";

const PAGE_SIZE = 25;

export function OrgList() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: me } = useMe();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const { data, error, isFetching } = useOrgs({ page, page_size: PAGE_SIZE });

  return (
    <div>
      <DirectoryTabs current="orgs" />
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-slate-500">{isFetching ? "Loading…" : ""}</span>
        {me && hasGlobal(me, "org.create") && (
          <Link href="/orgs/new" className="ml-auto rounded bg-sky-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-900">
            Add Organization
          </Link>
        )}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Name", "Created", "Last Updated"].map((h) => (
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
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(o.created)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(o.updated)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  Query returned 0 results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Search and member counts are not available through the API yet.</p>
      <Pager page={page} hasNext={(data?.items.length ?? 0) === PAGE_SIZE} onPage={(p) => router.push(`/orgs?page=${p}`)} />
    </div>
  );
}
