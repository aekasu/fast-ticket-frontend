import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminList, Unavailable } from "@/components/admin-screens";
import { findAdminItem } from "@/lib/admin/menu";
import { RESOURCES } from "@/lib/admin/resources";

export const metadata = { title: "Admin Panel" };

export default async function AdminResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: slug } = await params;
  const found = findAdminItem(slug);
  if (!found) notFound();
  // Only the key crosses to the client component: the config holds functions.
  if (!found.item.resource || !RESOURCES[found.item.resource]) return <Unavailable item={found.item} />;
  return (
    <Suspense>
      <AdminList resourceKey={found.item.resource} />
    </Suspense>
  );
}
