import JSZip from 'jszip';
import type { IncomeRecord } from '../types';

export type CsvFormat = 'youtube' | 'paypal' | 'stripe' | 'generic';

export type ParsedRow = Omit<IncomeRecord, 'id' | 'user_id' | 'created_at'>;

export interface ParseResult {
  records: ParsedRow[];
  skipped: number;
  errors: string[];
}

// ─── ZIP Handling ─────────────────────────────────────────────────────────────

/** Returns true if the raw bytes start with the PK ZIP magic bytes. */
export function isZipBuffer(buf: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buf, 0, 4);
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Given a ZIP ArrayBuffer, extract the best CSV file:
 *   1. "Table data.csv" (YouTube Analytics row-level data)
 *   2. Any .csv that is NOT "Totals.csv"
 *   3. Fallback: first .csv found
 * Returns the raw CSV string and the filename used.
 */
export async function extractCsvFromZip(
  buf: ArrayBuffer,
  onStatus?: (msg: string) => void
): Promise<{ csv: string; name: string }> {
  onStatus?.('ZIP detected — reading archive…');
  const zip = await JSZip.loadAsync(buf);

  const csvFiles = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith('.csv')
  );

  if (csvFiles.length === 0) {
    throw new Error('No CSV files found inside the ZIP.');
  }

  // Priority order
  const tableData = csvFiles.find((f) =>
    f.name.toLowerCase().includes('table data')
  );
  const notTotals = csvFiles.find(
    (f) => !f.name.toLowerCase().includes('totals')
  );
  const chosen = tableData ?? notTotals ?? csvFiles[0];

  const shortName = chosen.name.split('/').pop() ?? chosen.name;
  onStatus?.(`ZIP detected — extracting "${shortName}"…`);

  const csv = await chosen.async('string');
  return { csv, name: shortName };
}

// ─── Revenue Validation ───────────────────────────────────────────────────────

/** Returns true if any header contains the word "revenue" (case-insensitive). */
export function hasRevenueColumn(headers: string[]): boolean {
  return headers.some((h) => /revenue/i.test(h));
}

// ─── Format Detection ─────────────────────────────────────────────────────────

export function detectFormat(headers: string[]): CsvFormat {
  const h = headers.map((s) => s.toLowerCase().trim());

  if (h.some((s) => s.includes('estimated revenue'))) {
    return 'youtube';
  }
  if (
    h.some((s) => s === 'gross') &&
    h.some((s) => s === 'fee') &&
    h.some((s) => s === 'net') &&
    h.some((s) => s === 'type')
  ) {
    return 'paypal';
  }
  if (
    h.some((s) => s === 'amount' || s.includes('amount')) &&
    h.some((s) => s.includes('created')) &&
    h.some((s) => s.includes('description'))
  ) {
    return 'stripe';
  }
  return 'generic';
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────

export function parseDate(raw: string): string | null {
  if (!raw) return null;
  raw = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // YYYY-MM-DD HH:MM... (ISO prefix)
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // MM/DD/YYYY (PayPal)
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, mm, dd, yyyy] = usMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // "Jan 15, 2024" or "January 15, 2024"
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const wordMatch = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (wordMatch) {
    const [, mon, dd, yyyy] = wordMatch;
    const mm = MONTHS[mon.slice(0, 3).toLowerCase()];
    if (mm) return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }

  // "2024-Jan" or "2024-01" (YouTube monthly)
  const monthlyMatch = raw.match(/^(\d{4})-([A-Za-z]{3}|\d{2})$/);
  if (monthlyMatch) {
    const [, yyyy, mon] = monthlyMatch;
    const mm = MONTHS[mon.toLowerCase()] ?? mon.padStart(2, '0');
    return `${yyyy}-${mm}-01`;
  }

  return null;
}

// ─── Amount Parsing ───────────────────────────────────────────────────────────

export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  // Remove $, commas, spaces; handle (X) as negative
  const cleaned = raw.trim().replace(/[$,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return n;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

export function parseYouTube(rows: Record<string, string>[]): ParseResult {
  const records: ParsedRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  if (rows.length === 0) return { records, skipped, errors };

  const headers = Object.keys(rows[0]);
  const lc = (s: string) => s.toLowerCase().trim();

  // ── DEBUG ──────────────────────────────────────────────────────────────────
  console.log('[CSV DEBUG] Headers:', headers);
  console.log('[CSV DEBUG] First 3 rows:', rows.slice(0, 3));
  console.log('[CSV DEBUG] Has revenue column:', headers.some((h) => h.toLowerCase().includes('revenue')));

  // ── REJECT before any other logic ─────────────────────────────────────────
  const hasRevenueCol = headers.some((h) => h.toLowerCase().includes('revenue'));
  if (!hasRevenueCol) {
    throw new Error(
      'This file has no revenue data. You uploaded a content stats CSV. Use the Sample CSV button to test with fake data.'
    );
  }

  // Column matching — always by name, case-insensitive
  const revenueCol  = headers.find((h) => lc(h).includes('revenue')) ?? '';
  const dateCol     = headers.find((h) => lc(h).includes('publish time') || lc(h) === 'date') ?? '';
  const titleCol    = headers.find((h) => lc(h).includes('title')) ?? '';
  // "Content" is the first column in the table-data format; use it to detect summary rows
  const contentCol  = headers.find((h) => lc(h) === 'content') ?? headers[0] ?? '';

  const today = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip the "Total" summary row (first column value)
    const contentVal = (row[contentCol] ?? '').trim();
    if (contentVal.toLowerCase() === 'total') {
      skipped++;
      errors.push(`Row ${i + 2}: skipped: summary row`);
      continue;
    }

    // Revenue
    const rawAmount = revenueCol ? (row[revenueCol] ?? '') : '';
    const amount = parseAmount(rawAmount);
    if (amount === null || amount <= 0) {
      skipped++;
      errors.push(`Row ${i + 2}: skipped: no revenue`);
      continue;
    }

    // Date — fall back to today if column is missing or unparseable
    const rawDate = dateCol ? (row[dateCol] ?? '') : '';
    const date = parseDate(rawDate) ?? today;

    // Description
    const description = titleCol ? (row[titleCol] ?? contentVal) : contentVal;

    records.push({
      amount,
      platform: 'YouTube',
      category: 'Ad Revenue',
      date,
      description: description || 'YouTube video',
    });
  }

  return { records, skipped, errors };
}

// ─── PayPal ───────────────────────────────────────────────────────────────────

export function parsePayPal(rows: Record<string, string>[]): ParseResult {
  const records: ParsedRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  if (rows.length === 0) return { records, skipped, errors };

  const headers = Object.keys(rows[0]);
  const dateCol = headers.find((h) => h.toLowerCase() === 'date') ?? 'Date';
  const netCol = headers.find((h) => h.toLowerCase() === 'net') ?? 'Net';
  const nameCol = headers.find((h) => h.toLowerCase() === 'name') ?? 'Name';
  const typeCol = headers.find((h) => h.toLowerCase() === 'type') ?? 'Type';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = row[typeCol] ?? '';
    const lowerType = type.toLowerCase();

    if (
      lowerType.includes('refund') ||
      lowerType.includes('fee') ||
      lowerType.includes('transfer') ||
      lowerType.includes('withdrawal') ||
      lowerType.includes('debit')
    ) {
      skipped++;
      continue;
    }

    const date = parseDate(row[dateCol] ?? '');
    const amount = parseAmount(row[netCol] ?? '');

    if (!date) {
      skipped++;
      errors.push(`Row ${i + 2}: invalid date "${row[dateCol]}"`);
      continue;
    }
    if (amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    records.push({
      amount,
      platform: 'PayPal',
      category: 'Other',
      date,
      description: row[nameCol] || type || 'PayPal payment',
    });
  }

  return { records, skipped, errors };
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

export function parseStripe(rows: Record<string, string>[]): ParseResult {
  const records: ParsedRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  if (rows.length === 0) return { records, skipped, errors };

  const headers = Object.keys(rows[0]);
  const dateCol =
    headers.find((h) => h.toLowerCase().includes('created')) ?? 'Created (UTC)';
  const amountCol =
    headers.find((h) => h.toLowerCase() === 'amount') ?? 'Amount';
  const descCol =
    headers.find((h) => h.toLowerCase() === 'description') ?? 'Description';
  const statusCol =
    headers.find((h) => h.toLowerCase() === 'status') ?? 'Status';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = (row[statusCol] ?? '').toLowerCase();

    if (
      status &&
      !status.includes('paid') &&
      !status.includes('succeeded') &&
      status !== ''
    ) {
      skipped++;
      continue;
    }

    const date = parseDate(row[dateCol] ?? '');
    let amount = parseAmount(row[amountCol] ?? '');

    if (!date) {
      skipped++;
      errors.push(`Row ${i + 2}: invalid date "${row[dateCol]}"`);
      continue;
    }
    if (amount === null || amount <= 0) {
      skipped++;
      continue;
    }

    // Stripe sometimes exports amounts in cents (> $1000 threshold heuristic)
    if (amount > 100000) amount = amount / 100;

    records.push({
      amount,
      platform: 'Stripe',
      category: 'Other',
      date,
      description: row[descCol] || 'Stripe payment',
    });
  }

  return { records, skipped, errors };
}

// ─── Generic ─────────────────────────────────────────────────────────────────

export function parseGeneric(
  rows: Record<string, string>[],
  columnMap: { amount: string; date: string; description?: string },
  platform: string,
  category: string
): ParseResult {
  const records: ParsedRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const date = parseDate(row[columnMap.date] ?? '');
    const amount = parseAmount(row[columnMap.amount] ?? '');
    const description =
      columnMap.description ? (row[columnMap.description] ?? '') : 'Imported record';

    if (!date) {
      skipped++;
      errors.push(`Row ${i + 2}: invalid date "${row[columnMap.date]}"`);
      continue;
    }
    if (amount === null || amount <= 0) {
      skipped++;
      errors.push(`Row ${i + 2}: invalid amount "${row[columnMap.amount]}"`);
      continue;
    }

    records.push({ amount, platform, category, date, description: description || 'Imported record' });
  }

  return { records, skipped, errors };
}
