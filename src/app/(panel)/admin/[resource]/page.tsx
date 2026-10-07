import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSettings } from "@/components/admin-settings";
import { AdminLogs, AdminPlugins, AdminSystemInfo } from "@/components/admin-system";
import { AdminList, Unavailable } from "@/components/admin-screens";
import { findAdminItem } from "@/lib/admin/menu";
import { RESOURCES } from "@/lib/admin/resources";

export const metadata = { title: "Admin Panel" };

export default async function AdminResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource: slug } = await params;
  const found = findAdminItem(slug);
  if (!found) notFound();
  if (found.item.screen === "logs") return <AdminLogs />;
  if (found.item.screen === "system") return <AdminSystemInfo />;
  if (found.item.screen === "plugins") return <AdminPlugins />;
  if (found.item.screen === "settings" && found.item.section) {
    const note =
      found.item.section === "pages"
        ? "The landing, offline and thank-you pages. The company profile and logos are not available through the API."
        : found.item.section === "tickets"
          ? "Select-like values take osTicket's own numbers and strings; a refusal comes back with osTicket's wording."
          : undefined;
    return <AdminSettings section={found.item.section} title={found.item.label} note={note} />;
  }
  // Only the key crosses to the client component: the config holds functions.
  if (!found.item.resource || !RESOURCES[found.item.resource]) return <Unavailable item={found.item} />;
  return (
    <Suspense>
      <AdminList resourceKey={found.item.resource} />
    </Suspense>
  );
}
