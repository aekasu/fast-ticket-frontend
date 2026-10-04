import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await requireMe();
  return (
    <section>
      <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        Signed in as <strong>{me.username}</strong> ({me.is_admin ? "administrator" : "agent"}).
      </p>
    </section>
  );
}
