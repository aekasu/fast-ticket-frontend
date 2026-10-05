"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { LiveUpdates } from "./live-updates";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: false } } }));
  return (
    <QueryClientProvider client={client}>
      <LiveUpdates>{children}</LiveUpdates>
    </QueryClientProvider>
  );
}
