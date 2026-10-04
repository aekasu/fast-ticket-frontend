import { notFound } from "next/navigation";
import { CannedList } from "@/components/canned-screens";
import { canManageCanned } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Canned Responses" };

export default async function CannedPage() {
  if (!canManageCanned(await requireMe())) notFound();
  return <CannedList />;
}
