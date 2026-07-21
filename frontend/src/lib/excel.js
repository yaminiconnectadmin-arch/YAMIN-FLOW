import * as XLSX from "xlsx";

/**
 * Export data to a formatted Excel (.xlsx) file.
 */
export function exportExcel(filename, rows, columns, sheetName = "Sheet1") {
  const header = columns.map((c) => c.label);
  const data = rows.map((row) =>
    columns.map((c) => {
      const raw = row[c.key];
      if (c.rawNumber) return Number(raw || 0);
      if (c.format) {
        const formatted = c.format(raw, row);
        if (typeof formatted === "string") return formatted;
        return String(formatted ?? "");
      }
      return raw ?? "";
    })
  );

  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = columns.map((c) => ({ wch: c.width || 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename.replace("{date}", ts));
}

export function ExportExcelButton({ filename, rows, columns, sheetName, disabled, label }) {
  const handle = () => {
    if (!rows?.length) return;
    exportExcel(filename, rows, columns, sheetName || "Data");
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || !rows?.length}
      className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-[#16A34A] text-sm font-medium text-[#16A34A] hover:bg-[#F0FDF4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="export-excel-button"
      title="Export as Excel (.xlsx)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      {label || "Export Excel"}
    </button>
  );
}
