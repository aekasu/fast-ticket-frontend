import { notFound } from "next/navigation";
import { TicketEdit } from "@/components/ticket-edit";

export const metadata = { title: "Edit Ticket" };

export default async function EditTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <TicketEdit id={Number(id)} />;
}
