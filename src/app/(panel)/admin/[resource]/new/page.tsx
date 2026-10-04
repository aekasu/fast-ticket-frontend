import { notFound } from "next/navigation";
import { AdminNew } from "@/components/admin-screens";
import { RESOURCES } from "@/lib/admin/resources";

export const metadata = { title: "Admin Panel" };

export default async function AdminNewPage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: slug } = await params;
  const resource = RESOURCES[slug];
  if (!resource || resource.canCreate === false) notFound();
  return <AdminNew resourceKey={slug} />;
}
