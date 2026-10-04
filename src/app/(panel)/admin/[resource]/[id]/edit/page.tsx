import { notFound } from "next/navigation";
import { AdminEdit } from "@/components/admin-screens";
import { RESOURCES } from "@/lib/admin/resources";

export const metadata = { title: "Admin Panel" };

export default async function AdminEditPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: slug, id } = await params;
  if (!RESOURCES[slug] || !/^\d+$/.test(id)) notFound();
  return <AdminEdit resourceKey={slug} id={Number(id)} />;
}
