import { notFound } from "next/navigation";
import { CannedEdit } from "@/components/canned-screens";
import { canManageCanned } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Canned Response" };

export default async function CannedResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !canManageCanned(await requireMe())) notFound();
  return <CannedEdit id={Number(id)} />;
}
