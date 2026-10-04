import Link from "next/link";

/** osTicket's Users page has two sub-menus: the user directory and the organizations. */
export function DirectoryTabs({ current }: { current: "users" | "orgs" }) {
  const tab = (active: boolean) =>
    `-mb-px block border border-b-0 px-4 py-2 text-sm font-medium ${active ? "border-slate-300 bg-white text-slate-900" : "border-transparent text-sky-800 hover:bg-slate-200"}`;
  return (
    <ul className="mb-4 flex border-b border-slate-300" aria-label="Directory">
      <li>
        <Link href="/users" className={tab(current === "users")}>
          User Directory
        </Link>
      </li>
      <li>
        <Link href="/orgs" className={tab(current === "orgs")}>
          Organizations
        </Link>
      </li>
    </ul>
  );
}
