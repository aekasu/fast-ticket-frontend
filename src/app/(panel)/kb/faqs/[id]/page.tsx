import { notFound } from "next/navigation";
import { FaqView } from "@/components/faq-view";

export const metadata = { title: "FAQ" };

export default async function FaqPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <FaqView id={Number(id)} />;
}
