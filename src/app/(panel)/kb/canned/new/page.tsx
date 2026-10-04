import { notFound } from "next/navigation";
import { CannedNew } from "@/components/canned-screens";
import { canManageCanned } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Add Canned Response" };

export default async function NewCannedPage() {
  if (!canManageCanned(await requireMe())) notFound();
  return <CannedNew />;
}
