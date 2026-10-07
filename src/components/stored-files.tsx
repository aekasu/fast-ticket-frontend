"use client";

import { formatBytes } from "@/lib/attachments";

export interface StoredFile {
  id: number;
  name: string;
  size: number;
  inline: boolean;
}

/** The files already on a record: each downloads, and (when `onToggle` is given) can be marked for removal on save. */
export function StoredFiles({ files, hrefOf, removed, onToggle }: { files: StoredFile[]; hrefOf: (id: number) => string; removed?: number[]; onToggle?: (id: number) => void }) {
  const shown = files.filter((f) => !f.inline);
  if (shown.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm" aria-label="Attached files">
      {shown.map((f) => {
        const gone = removed?.includes(f.id);
        return (
          <li key={f.id} className="flex items-center gap-3">
            <a href={hrefOf(f.id)} className={`text-sky-800 underline ${gone ? "line-through opacity-60" : ""}`}>
              {f.name}
            </a>
            <span className="text-slate-500">({formatBytes(f.size)})</span>
            {onToggle && (
              <label className="flex items-center gap-1 text-red-800">
                <input type="checkbox" checked={!!gone} onChange={() => onToggle(f.id)} aria-label={`Remove ${f.name}`} /> Remove
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
