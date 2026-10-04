import { notFound } from "next/navigation";
import { TicketNew } from "@/components/ticket-new";
import { canCreateTickets } from "@/lib/nav";
import { requireMe } from "@/lib/server/session";

export const metadata = { title: "New Ticket" };

export default async function NewTicketPage() {
  // Same answer as for anything the agent may not use: it is not there.
  if (!canCreateTickets(await requireMe())) notFound();
  return <TicketNew />;
}
