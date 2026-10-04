// The API sends naive ISO timestamps ("2026-10-04T12:00:00"); they are UTC (see notes/BACKEND_REQUESTS.md).
export function parseApiDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** osTicket's date-time style, as its lists show it: `10/4/26 6:45 PM` (no zero padding, 12-hour clock). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseApiDate(value);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear() % 100} ${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}
