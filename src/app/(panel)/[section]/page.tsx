import { notFound } from "next/navigation";

const SECTIONS: Record<string, string> = {
  users: "Users",
  tasks: "Tasks",
  tickets: "Tickets",
  kb: "Knowledge Base",
  admin: "Admin Panel",
};

export default async function NotBuilt({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = SECTIONS[section];
  if (!title) notFound();
  return (
    <section>
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Not built yet.</p>
    </section>
  );
}
