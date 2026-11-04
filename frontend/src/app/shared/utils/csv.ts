import { QueryItem } from '../models';

export type CsvCell = string | number | boolean | null | undefined;

export function csvCell(value: CsvCell): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function csvRows(rows: readonly (readonly CsvCell[])[]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const QUERY_CSV_COLUMNS = [
  'query_text',
  'estimated_search_volume',
  'competitive_difficulty',
  'opportunity_score',
  'domain_visible',
  'visibility_position',
  'discovered_at',
] as const;

export function queriesCsv(rows: readonly QueryItem[]): string {
  return csvRows([
    QUERY_CSV_COLUMNS,
    ...rows.map((row) => QUERY_CSV_COLUMNS.map((column) => row[column])),
  ]);
}

export function queryCsvFilename(domain: string, date = new Date()): string {
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${domain.replace(/[^a-zA-Z0-9.-]/g, '-')}-queries-${day}.csv`;
}
