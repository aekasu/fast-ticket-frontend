/** osTicket's label / value tables on a ticket, task, user or organization page. */
export function Info({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="w-full border border-slate-300 bg-white text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-t border-slate-200 first:border-t-0">
            <th className="w-40 bg-slate-100 px-3 py-1.5 text-left font-semibold text-slate-700">{label}:</th>
            <td className="px-3 py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
