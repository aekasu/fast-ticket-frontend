import { LiveStatus, NewTicketsBar } from "@/components/live-updates";
import { LogoutButton } from "@/components/logout-button";
import { PanelNav } from "@/components/panel-nav";
import { Providers } from "@/components/providers";
import { SECTIONS } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

// Same top-level menu as osTicket's staff panel. The server enforces permissions; the menu only hides what the
// agent cannot use (GET /auth/me).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const items = SECTIONS.filter((section) => section.visible(me)).map(({ href, label, also }) => ({ href, label, also }));

  return (
    <Providers>
      <header className="bg-sky-800 text-slate-100">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 pt-3 text-sm">
          <span className="text-lg font-bold">Staff Control Panel</span>
          {/* A plain GET form, so it works before the page's scripts have loaded. */}
          <form action="/search" method="get" role="search" className="flex items-center gap-1">
            <input
              type="search"
              name="q"
              aria-label="Find anything"
              placeholder="Search tickets, users, organizations"
              maxLength={100}
              className="w-64 rounded border border-sky-600 bg-sky-900 px-2 py-1 text-sm text-white placeholder:text-sky-300"
            />
            <button type="submit" className="rounded border border-sky-500 px-2 py-1 text-sm hover:bg-sky-700">
              Go
            </button>
          </form>
          <p>
            <LiveStatus />
            Welcome, <strong>{me.name}</strong> | <LogoutButton />
          </p>
        </div>
        <div className="mx-auto max-w-screen-2xl px-4 pt-2">
          <PanelNav items={items} />
        </div>
      </header>
      <NewTicketsBar />
      <main className="mx-auto max-w-screen-2xl px-4 py-6">{children}</main>
    </Providers>
  );
}
