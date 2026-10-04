import { notFound } from "next/navigation";
import { TicketView } from "@/components/ticket-view";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <TicketView id={Number(id)} />;
}
