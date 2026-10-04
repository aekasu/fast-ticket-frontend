import { notFound } from "next/navigation";
import { OrgEdit } from "@/components/org-form";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Edit Organization" };

export default async function EditOrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !canBrowseDirectory(await requireMe())) notFound();
  return <OrgEdit id={Number(id)} />;
}
