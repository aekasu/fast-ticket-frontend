import { notFound } from "next/navigation";
import { UserView } from "@/components/user-view";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !canBrowseDirectory(await requireMe())) notFound();
  return <UserView id={Number(id)} />;
}
