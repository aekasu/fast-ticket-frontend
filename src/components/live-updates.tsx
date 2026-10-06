"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { StaleBatch } from "@/lib/live/keys";
import { othersTickets } from "@/lib/live/new-tickets";

export type LiveState = "connecting" | "live" | "offline";
const LiveContext = createContext<LiveState>("connecting");
const FreshContext = createContext<{ ids: string[]; clear: () => void }>({ ids: [], clear: () => {} });

const BATCH_MS = 250;

/**
 * Keeps the screens current. One `EventSource` to `/api/events` (the server holds the WebSocket to the backend); every
 * event says "this changed", and the answer is to refetch the queries that read it (EVENTS.md). Delivery is best-effort
 * with no replay, so every reconnect refetches everything on screen.
 */
export function LiveUpdates({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<LiveState>("connecting");
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    const batch = new StaleBatch();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = 0;

    // A flurry of events becomes one refetch of each affected query.
    const flush = () => {
      timer = undefined;
      const keys = batch.take();
      if (keys === "all") void queryClient.invalidateQueries();
      else for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };

    const source = new EventSource("/api/events");
    source.addEventListener("ready", () => {
      setState("live");
      ready += 1;
      // The first connection follows the page's own fetches; a later one means events may have been missed.
      if (ready > 1) void queryClient.invalidateQueries();
    });
    source.addEventListener("unauthorized", () => {
      source.close();
      // The session is over (no refresh tokens): back to the login screen, like any 401.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    });
    source.onmessage = (event) => {
      try {
        const { type, aggregate_type, aggregate_id } = JSON.parse(event.data) as { type?: string; aggregate_type?: string; aggregate_id?: string };
        if (type === "ticket.created" && aggregate_id) setFresh((ids) => (ids.includes(aggregate_id) ? ids : [...ids, aggregate_id]));
        batch.add(aggregate_type ?? "");
        timer ??= setTimeout(flush, BATCH_MS);
      } catch {
        /* not an event */
      }
    };
    // The browser retries a dropped stream by itself (CONNECTING); a CLOSED one is final.
    source.onerror = () => setState(source.readyState === EventSource.CLOSED ? "offline" : "connecting");

    return () => {
      source.close();
      clearTimeout(timer);
    };
  }, [queryClient]);

  return (
    <LiveContext.Provider value={state}>
      <FreshContext.Provider value={{ ids: fresh, clear: () => setFresh([]) }}>{children}</FreshContext.Provider>
    </LiveContext.Provider>
  );
}

const LABEL: Record<LiveState, string> = { live: "Live", connecting: "Connecting…", offline: "Offline" };
const DOT: Record<LiveState, string> = { live: "bg-emerald-400", connecting: "bg-amber-300", offline: "bg-red-400" };

/** A small header indicator of whether live updates are on. */
export function LiveStatus() {
  const state = useContext(LiveContext);
  return (
    // Plain text, not a live region: it changes state quietly and must not be announced, or confused with the page's notices.
    <span data-live={state} className="mr-3 inline-flex items-center gap-1 text-xs" title="Updates from the backend arrive as they happen">
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[state]}`} />
      {LABEL[state]}
    </span>
  );
}

/** "N new tickets": others' tickets that arrived while this page was open, with a way to the open queue. */
export function NewTicketsBar() {
  const { ids, clear } = useContext(FreshContext);
  const count = othersTickets(ids).length;
  if (count === 0) return null;
  return (
    <div role="status" data-new-tickets={count} className="mx-auto flex max-w-screen-2xl items-center gap-3 border-b border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
      <span>
        {count} new ticket{count === 1 ? "" : "s"} arrived.
      </span>
      <Link href="/tickets?queue=open" onClick={clear} className="font-semibold underline">
        Show open tickets
      </Link>
      <button type="button" onClick={clear} className="ml-auto underline">
        Dismiss
      </button>
    </div>
  );
}
