import { notFound } from "next/navigation";
import { FaqEdit } from "@/components/faq-form";

export const metadata = { title: "Edit FAQ" };

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <FaqEdit id={Number(id)} />;
}
