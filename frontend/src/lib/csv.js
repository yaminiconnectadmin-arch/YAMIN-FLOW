/**
 * CSV export utility. Client-side only, no dependencies.
 *
 * @param filename e.g. "orders-2026-07-15.csv"
 * @param rows array of objects
 * @param columns [{ key, label, format? }]
 */
export function exportCsv(filename, rows, columns) {
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => escape(c.format ? c.format(row[c.key], row) : row[c.key]))
        .join(",")
    )
    .join("\n");
  const csv = `${header}\n${body}\n`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function ExportButton({ filename, rows, columns, disabled }) {
  const handle = () => {
    const ts = new Date().toISOString().slice(0, 10);
    exportCsv(filename.replace("{date}", ts), rows, columns);
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || !rows?.length}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#E5E7EB] text-sm font-medium text-[#0A2342] hover:border-[#F28C18] hover:text-[#D96B0B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="export-csv-button"
      title="Export as CSV"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Export CSV
    </button>
  );
}
