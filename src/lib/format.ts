// Every timestamp the API sends is ISO 8601 in UTC with a "Z" (`2026-10-03T18:18:02Z`), so it is an instant as it stands.
export function parseApiDate(value: string): Date {
  return new Date(value);
}

/** osTicket's date-time style, as its lists show it: `10/4/26 6:45 PM` (no zero padding, 12-hour clock). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseApiDate(value);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear() % 100} ${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}
