import Link from "next/link";

type Tab = "faqs" | "categories" | "canned";

/** osTicket's Knowledge Base sub-menu. */
export function KbTabs({ current, showCanned }: { current: Tab; showCanned: boolean }) {
  const tabs: { key: Tab; href: string; label: string; show: boolean }[] = [
    { key: "faqs", href: "/kb", label: "FAQs", show: true },
    { key: "categories", href: "/kb/categories", label: "Categories", show: true },
    { key: "canned", href: "/kb/canned", label: "Canned Responses", show: showCanned },
  ];
  return (
    <ul className="mb-4 flex border-b border-slate-300" aria-label="Knowledge base">
      {tabs
        .filter((t) => t.show)
        .map((t) => (
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
