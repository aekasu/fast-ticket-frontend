import Link from "next/link";

type Tab = "dashboard" | "report" | "directory" | "profile";

/** osTicket's Dashboard sub-menu. */
export function DashboardTabs({ current }: { current: Tab }) {
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "dashboard", href: "/", label: "Dashboard" },
    { key: "report", href: "/report", label: "Activity Report" },
    { key: "directory", href: "/directory", label: "Agent Directory" },
    { key: "profile", href: "/profile", label: "My Profile" },
  ];
  return (
    <ul className="mb-4 flex border-b border-slate-300" aria-label="Dashboard">
      {tabs.map((t) => (
        <li key={t.key}>
          <Link
            href={t.href}
            className={`-mb-px block border border-b-0 px-4 py-2 text-sm font-medium ${
              t.key === current ? "border-slate-300 bg-white text-slate-900" : "border-transparent text-sky-800 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
