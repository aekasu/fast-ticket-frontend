import { notFound } from "next/navigation";
import { OrgView } from "@/components/org-view";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Organization" };

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !canBrowseDirectory(await requireMe())) notFound();
  return <OrgView id={Number(id)} />;
}
