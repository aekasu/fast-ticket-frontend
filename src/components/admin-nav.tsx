"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MENU } from "@/lib/admin/menu";

/** osTicket's Admin Panel sub-menu: the five groups, and the pages of the current one. Pages with no API are dimmed. */
export function AdminNav() {
  const pathname = usePathname();
  const slug = pathname.split("/")[2] ?? "";
  const current = ADMIN_MENU.find((g) => g.items.some((i) => i.slug === slug)) ?? ADMIN_MENU[0];
  const firstUsable = (g: (typeof ADMIN_MENU)[number]) => g.items.find((i) => i.resource || i.screen) ?? g.items[0];

  return (
    <div className="mb-4">
      <ul className="flex flex-wrap border-b border-slate-300" aria-label="Admin sections">
        {ADMIN_MENU.map((g) => (
          <li key={g.key}>
            <Link
              href={`/admin/${firstUsable(g).slug}`}
              className={`-mb-px block border border-b-0 px-4 py-2 text-sm font-medium ${
                g.key === current.key ? "border-slate-300 bg-white text-slate-900" : "border-transparent text-sky-800 hover:bg-slate-200"
              }`}
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-3 py-2 text-sm" aria-label={`${current.label} pages`}>
        {current.items.map((i) =>
          i.resource || i.screen ? (
            <li key={i.slug}>
              <Link href={`/admin/${i.slug}`} className={i.slug === slug ? "font-bold text-slate-900" : "text-sky-800 hover:underline"}>
                {i.label}
              </Link>
            </li>
          ) : (
            <li key={i.slug}>
              <Link href={`/admin/${i.slug}`} className={`${i.slug === slug ? "font-bold" : ""} text-slate-400 hover:underline`} title="Not available through the API yet">
                {i.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
