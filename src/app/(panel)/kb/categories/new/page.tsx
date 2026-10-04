import { notFound } from "next/navigation";
import { CategoryNew } from "@/components/category-screens";
import { canManageFaqs } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "Add Category" };

export default async function NewCategoryPage() {
  if (!canManageFaqs(await requireMe())) notFound();
  return <CategoryNew />;
}
