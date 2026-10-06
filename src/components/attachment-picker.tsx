"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { attachmentProblem, formatBytes } from "@/lib/attachments";

/** The size and count limits for attachments (open to every agent). */
export function useAttachmentLimits() {
  return useQuery({
    queryKey: ["settings", "attachments"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.GET("/api/v1/settings/attachments")).data ?? null,
  });
}

/** A file picker for a reply or note: the chosen files are held by the parent, and checked against the API's limits. */
export function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const limits = useAttachmentLimits().data ?? undefined;
  const problem = attachmentProblem(files, limits);
  return (
    <div className="space-y-1">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">Attachments</span>
        <input
          type="file"
          multiple
          aria-label="Attach files"
          onChange={(e) => {
            onChange([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="text-sm" aria-label="Files to attach">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3">
              <span>
                {f.name} <span className="text-slate-500">({formatBytes(f.size)})</span>
              </span>
              <button type="button" className="text-red-800 underline" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                Remove {f.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {limits && <p className="text-xs text-slate-500">Up to {limits.max_files} files, {formatBytes(limits.max_file_bytes)} each.</p>}
      {problem && (
        <p role="alert" className="text-sm text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}
