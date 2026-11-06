export type CSVCell = string | number | boolean | null | undefined;

/**
 * Arma un CSV compatible con Excel en español:
 * separador ";" y BOM UTF-8 para que se vean bien las tildes.
 */
export function toCSV(rows: CSVCell[][]): string {
  const escape = (value: CSVCell): string => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);
    if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return '﻿' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
}

export function downloadFile(filename: string, content: string | Blob, mime: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
