import { notFound } from "next/navigation";
import { AdminView } from "@/components/admin-screens";
import { RESOURCES } from "@/lib/admin/resources";

export const metadata = { title: "Admin Panel" };

export default async function AdminViewPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource: slug, id } = await params;
  if (!RESOURCES[slug] || !/^\d+$/.test(id)) notFound();
  return <AdminView resourceKey={slug} id={Number(id)} />;
}
