"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNav({ items }: { items: { href: string; label: string; also?: string[] }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Main">
      {items.map((item) => {
        const active = [item.href, ...(item.also ?? [])].some((prefix) => (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium ${active ? "bg-white text-slate-900" : "text-slate-100 hover:bg-sky-900"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
