// The API sends naive ISO timestamps ("2026-10-04T12:00:00"); they are UTC (see notes/BACKEND_REQUESTS.md).
export function parseApiDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** osTicket's list style: MM/DD/YY HH:MM. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseApiDate(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${pad(d.getFullYear() % 100)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
