import { notFound } from "next/navigation";
import { SECTIONS } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export default async function NotBuilt({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const me = await requireMe();
  const section = SECTIONS.find((s) => s.href === `/${slug}`);
  // Same answer as the API gives for what the agent may not open: it is simply not there.
  if (!section || !section.visible(me)) notFound();
  return (
    <section>
      <h1 className="text-xl font-bold text-slate-800">{section.label}</h1>
      <p className="mt-2 text-sm text-slate-500">Not built yet.</p>
    </section>
  );
}
