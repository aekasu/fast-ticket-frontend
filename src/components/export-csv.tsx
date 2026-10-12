"use client";

import { useState } from "react";
import { saveFile } from "@/lib/download";
import { button } from "./action-ui";

/**
 * Export of a list as CSV: the list's own filters and sort go to the export endpoint (no paging; the API caps it at
 * 10000 rows), plus the Columns menu's custom fields as `fields`. The API words a refusal.
 */
export function ExportCsv({ path, filters, fields, name }: { path: string; filters: Record<string, string | number | boolean | undefined>; fields?: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    setBusy(true);
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, fields })) {
      if (value !== undefined && value !== "") q.set(key, String(value));
    }
    try {
      await saveFile(`${path}?${q}`, `${name}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className={button} disabled={busy} onClick={download}>
        {busy ? "Exporting…" : "Export CSV"}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </>
  );
}
