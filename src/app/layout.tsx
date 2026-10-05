import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Staff Control Panel", template: "%s | Staff Control Panel" },
  description: "Demo frontend for fast-ticket, a REST API over osTicket",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (a dark-mode one, say) add attributes to <html> before React loads; this silences that one element.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
