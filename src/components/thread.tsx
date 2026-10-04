"use client";

import type { components } from "@/lib/api/schema";
import { formatDateTime } from "@/lib/format";
import { SafeHtml } from "./safe-html";

type Entry = components["schemas"]["ThreadEntry"];

const ENTRY_STYLE: Record<string, { label: string; box: string }> = {
  M: { label: "Message", box: "border-sky-200 bg-sky-50" },
  R: { label: "Response", box: "border-emerald-200 bg-emerald-50" },
  N: { label: "Internal Note", box: "border-amber-200 bg-amber-50" },
  E: { label: "Event", box: "border-slate-200 bg-slate-50" },
};

function size(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** A ticket's or task's thread: messages, responses, internal notes and events, oldest first. */
export function Thread({ entries, attachmentHref }: { entries: Entry[]; attachmentHref: (attachmentId: number) => string }) {
  return (
    <ol className="mt-3 space-y-3">
        {entries.map((entry) => {
          const style = ENTRY_STYLE[entry.type] ?? ENTRY_STYLE.E;
          return (
            <li key={entry.id} className={`border ${style.box} ${entry.type === "E" ? "px-3 py-1.5 text-xs text-slate-600" : ""}`}>
              {entry.type === "E" ? (
                <p>
                  {formatDateTime(entry.created)} — {entry.title || entry.body}
                  {entry.poster ? ` (${entry.poster})` : ""}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-inherit px-3 py-1.5 text-sm">
                    <span>
                      <strong>{entry.poster ?? "Unknown"}</strong> <span className="text-slate-500">· {style.label}</span>
                      {entry.is_edited && <span className="text-slate-500"> · edited</span>}
                    </span>
                    <time className="text-xs text-slate-500">{formatDateTime(entry.created)}</time>
                  </div>
                  <div className="px-3 py-2 text-sm">
                    {entry.title && <p className="mb-1 font-semibold">{entry.title}</p>}
                    <SafeHtml html={entry.body} />
                    {entry.attachments.length > 0 && (
                      <ul className="mt-2 border-t border-inherit pt-2 text-xs">
                        {entry.attachments.map((a) => (
                          <li key={a.id}>
                            <a href={attachmentHref(a.id)} className="text-sky-800 underline">
                              {a.name}
                            </a>{" "}
                            <span className="text-slate-500">({size(a.size)})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
    </ol>
  );
}
