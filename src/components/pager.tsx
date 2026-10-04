"use client";

const btn = "rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40";

/** Previous / Next for a list whose total is unknown: a full page means there may be another. */
export function Pager({ page, hasNext, onPage }: { page: number; hasNext: boolean; onPage: (page: number) => void }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="mt-3 flex items-center gap-3 text-sm" aria-label="Pages">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn}>
        Previous
      </button>
      <span>Page {page}</span>
      <button type="button" disabled={!hasNext} onClick={() => onPage(page + 1)} className={btn}>
        Next
      </button>
    </nav>
  );
}
