"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { getJson } from "@/lib/api/raw";
import { NoticeBar, button, field, useRunner } from "./action-ui";
import { Info } from "./info-table";
import { Pager } from "./pager";

type Log = { id: number; type: string; title: string; logger: string; ip_address: string; created: string };
const PAGE = 25;

/** osTicket's System Logs: filter by type, read an entry, delete the ticked ones. */
export function AdminLogs() {
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [ticked, setTicked] = useState<number[]>([]);
  const logs = useQuery({
    queryKey: ["admin", "logs", "list", type, page],
    queryFn: () => getJson<{ items: Log[]; total: number }>(`/api/v1/logs?page=${page}&page_size=${PAGE}${type ? `&type=${type}` : ""}`),
  });
  const detail = useQuery({
    queryKey: ["admin", "logs", "detail", open],
    enabled: open != null,
    queryFn: () => getJson<{ log: string }>(`/api/v1/logs/${open}`),
  });
  const { run, busy, notice, clear } = useRunner("/api/v1/logs", ["admin", "logs"]);
  const items = logs.data?.items ?? [];

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">System Logs</h1>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Type</span>
          <select
            aria-label="Log type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
              setTicked([]);
            }}
            className={`${field} max-w-40`}
          >
            <option value="">All</option>
            {["Debug", "Warning", "Error"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={button}
          disabled={busy || ticked.length === 0}
          onClick={async () => {
            clear();
            if (await run("delete", { ids: ticked }, `${ticked.length} log entr${ticked.length === 1 ? "y" : "ies"} deleted.`)) setTicked([]);
          }}
        >
          Delete Selected Entries
        </button>
        <span className="text-xs text-slate-500">{logs.data ? `${logs.data.total} entries` : ""}</span>
      </div>
      <NoticeBar notice={notice} />
      {logs.error && <p role="alert" className="text-sm text-red-700">{logs.error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-8 px-3 py-2" />
              {["Log Title", "Log Type", "Log Date", "IP Address"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-slate-200 hover:bg-sky-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select log ${l.id}`}
                      checked={ticked.includes(l.id)}
                      onChange={(e) => setTicked((t) => (e.target.checked ? [...t, l.id] : t.filter((x) => x !== l.id)))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="font-medium text-sky-800 hover:underline" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
                      {l.title}
                    </button>
                  </td>
                  <td className="px-3 py-2">{l.type}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDateTime(l.created)}</td>
                  <td className="px-3 py-2">{l.ip_address}</td>
                </tr>
                {open === l.id && (
                  <tr className="border-t border-slate-100 bg-slate-50">
                    <td />
                    <td colSpan={4} className="px-3 py-2">
                      <pre className="whitespace-pre-wrap break-words text-xs">{detail.data?.log ?? "Loading…"}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {logs.data && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No log entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={items.length === PAGE} onPage={setPage} />
    </div>
  );
}

type SysInfo = {
  osticket_version: string;
  php_version: string;
  mysql_version: string;
  web_server: string;
  schema_name: string;
  schema_signature: string;
  space_used_mib: number;
  attachment_space_mib: number;
  database_timezone: string;
  interpreted_timezone: string;
  extensions: { key: string; name: string; description: string; loaded: boolean }[];
  php_settings: { name: string; value: string; ok: boolean }[];
  language_packs: { code: string; name: string; version: string | null }[];
};

/** osTicket's System Information page. */
export function AdminSystemInfo() {
  const info = useQuery({ queryKey: ["admin", "system", "info"], queryFn: () => getJson<SysInfo>("/api/v1/system/info") });
  const d = info.data;
  if (info.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!d) return <p role="alert" className="text-sm text-red-700">{info.error?.message ?? "Unable to load."}</p>;
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">System Information</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Info
          rows={[
            ["osTicket Version", d.osticket_version],
            ["Web Server Software", d.web_server],
            ["MySQL Version", d.mysql_version],
            ["PHP Version", d.php_version],
          ]}
        />
        <Info
          rows={[
            ["Schema", `${d.schema_name} (${d.schema_signature})`],
            ["Space Used", `${d.space_used_mib} MiB`],
            ["Space for Attachments", `${d.attachment_space_mib} MiB`],
            ["Timezone", `Database ${d.database_timezone}; interpreted as ${d.interpreted_timezone}`],
          ]}
        />
      </div>
      <h2 className="mt-6 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">PHP Extensions</h2>
      <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2" aria-label="PHP extensions">
        {d.extensions.map((x) => (
          <li key={x.key}>
            <span className={x.loaded ? "text-emerald-800" : "text-red-700"}>{x.loaded ? "✓" : "✗"}</span> {x.name} <span className="text-slate-500">— {x.description}</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">PHP Settings</h2>
      <ul className="mt-2 text-sm" aria-label="PHP settings">
        {d.php_settings.map((x) => (
          <li key={x.name}>
            <span className={x.ok ? "text-emerald-800" : "text-red-700"}>{x.ok ? "✓" : "✗"}</span> {x.name}: <strong>{x.value}</strong>
          </li>
        ))}
      </ul>
      <h2 className="mt-6 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Language Packs</h2>
      <ul className="mt-2 text-sm" aria-label="Language packs">
        {d.language_packs.map((x) => (
          <li key={x.code}>
            {x.name} ({x.code}){x.version ? ` ${x.version}` : ""}
          </li>
        ))}
        {d.language_packs.length === 0 && <li className="text-slate-500">None installed.</li>}
      </ul>
    </div>
  );
}

type Plugin = { id: number; name: string; version: string | null; install_path: string; is_phar: boolean; is_active: boolean; installed: string; instances: { id: number; name: string; is_enabled: boolean }[] };

/** osTicket's Plugins page, read-only: installing, enabling and configuring a plugin runs its code and is not exposed. */
export function AdminPlugins() {
  const plugins = useQuery({ queryKey: ["admin", "plugins"], queryFn: () => getJson<{ plugins: Plugin[] }>("/api/v1/plugins") });
  return (
    <div>
      <h1 className="mb-3 text-xl font-bold text-slate-800">Plugins</h1>
      {plugins.error && <p role="alert" className="text-sm text-red-700">{plugins.error.message}</p>}
      <div className="overflow-x-auto border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {["Plugin Name", "Status", "Version", "Instances", "Date Installed"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plugins.data?.plugins.map((p) => (
              <tr key={p.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.is_active ? "Enabled" : "Disabled"}</td>
                <td className="px-3 py-2">{p.version ?? ""}</td>
                <td className="px-3 py-2">{p.instances.map((i) => `${i.name}${i.is_enabled ? "" : " (disabled)"}`).join(", ")}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatDateTime(p.installed)}</td>
              </tr>
            ))}
            {plugins.data?.plugins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No plugins are installed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Read-only: installing, enabling and configuring a plugin runs its code, so it stays in osTicket.</p>
    </div>
  );
}
