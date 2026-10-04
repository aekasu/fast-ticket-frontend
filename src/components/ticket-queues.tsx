"use client";

import Link from "next/link";
import { type QueueKey, useQueueCounts } from "@/lib/queries/tickets";

// osTicket's tabs are the top-level queues; the children of the selected one are its sub-queues.
export function TicketQueues({ current }: { current: QueueKey }) {
  const { data: queues, error } = useQueueCounts();
  if (error) return <p className="text-sm text-red-700">Queues unavailable: {error.message}</p>;
  if (!queues) return <div className="h-16" aria-busy="true" />;

  const top = queues.filter((q) => !q.parent);
  const currentQueue = queues.find((q) => q.key === current);
  const activeTop = currentQueue?.parent ?? current;
  const sub = queues.filter((q) => q.parent === activeTop);

  return (
    <div className="mb-4">
      <ul className="flex border-b border-slate-300" aria-label="Queues">
        {top.map((q) => (
          <li key={q.key}>
            <Link
              href={`/tickets?queue=${q.key}`}
              className={`-mb-px block border border-b-0 px-4 py-2 text-sm font-medium ${
                q.key === activeTop ? "border-slate-300 bg-white text-slate-900" : "border-transparent text-sky-800 hover:bg-slate-200"
              }`}
            >
              {q.title} <span className="text-xs text-slate-500">({q.count})</span>
            </Link>
          </li>
        ))}
      </ul>
      {sub.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-3 py-2 text-sm" aria-label="Sub-queues">
          {sub.map((q) => (
            <li key={q.key}>
              <Link
                href={`/tickets?queue=${q.key}`}
                className={q.key === current ? "font-bold text-slate-900" : "text-sky-800 hover:underline"}
              >
                {q.title} <span className="text-xs text-slate-500">({q.count})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
