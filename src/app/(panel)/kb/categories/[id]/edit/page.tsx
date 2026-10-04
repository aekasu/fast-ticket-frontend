import { notFound } from "next/navigation";
import { CategoryEdit } from "@/components/category-screens";

export const metadata = { title: "Edit Category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <CategoryEdit id={Number(id)} />;
}
