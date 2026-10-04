import { notFound } from "next/navigation";
import { OrgNew } from "@/components/org-form";
import { hasGlobal } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Add Organization" };

export default async function NewOrgPage() {
  if (!hasGlobal(await requireMe(), "org.create")) notFound();
  return <OrgNew />;
}
