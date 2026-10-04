import { Suspense } from "react";
import { TicketList } from "@/components/ticket-list";

export const metadata = { title: "Tickets" };

export default function TicketsPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense>
      <TicketList />
    </Suspense>
  );
}
