import { notFound } from "next/navigation";
import { UserEdit } from "@/components/user-form";
import { canBrowseDirectory } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Edit User" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !canBrowseDirectory(await requireMe())) notFound();
  return <UserEdit id={Number(id)} />;
}
