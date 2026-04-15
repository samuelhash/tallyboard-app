import type { IncomeRecord, ExpenseRecord, InvoiceRecord } from '../types';

export interface ReportData {
  dateRange: { start: string; end: string };
  reportType: 'income' | 'expense' | 'pl';
  userEmail: string;
  displayName?: string;
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
  invoiceRecords?: InvoiceRecord[];
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtDateRange(start: string, end: string): string {
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

export function generateReportHTML(data: ReportData): string {
  const { dateRange, reportType, userEmail, displayName, incomeRecords, expenseRecords, invoiceRecords = [] } = data;

  // Only paid invoices with paid_date in range count toward revenue
  const paidInvoicesInRange = invoiceRecords.filter(
    (i) => i.status === 'paid' && i.paid_date && i.paid_date >= dateRange.start && i.paid_date <= dateRange.end
  );
  const outstandingInvoices = invoiceRecords.filter(
    (i) => (i.status === 'pending' || i.status === 'overdue') &&
      i.issued_date >= dateRange.start && i.issued_date <= dateRange.end
  );

  const totalRevenue = incomeRecords.reduce((s, r) => s + r.amount, 0) +
    paidInvoicesInRange.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Revenue breakdown by platform + category
  const revByPlatform = new Map<string, { count: number; total: number }>();
  for (const r of incomeRecords) {
    const key = r.platform;
    const cur = revByPlatform.get(key) ?? { count: 0, total: 0 };
    revByPlatform.set(key, { count: cur.count + 1, total: cur.total + r.amount });
  }
  const platformRows = [...revByPlatform.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([platform, { count, total }]) => `
      <tr>
        <td>${esc(platform)}</td>
        <td class="num">${count}</td>
        <td class="num amount">${fmt(total)}</td>
      </tr>`)
    .join('');

  // Expense breakdown by category
  const expByCategory = new Map<string, { count: number; total: number }>();
  for (const r of expenseRecords) {
    const key = r.category;
    const cur = expByCategory.get(key) ?? { count: 0, total: 0 };
    expByCategory.set(key, { count: cur.count + 1, total: cur.total + r.amount });
  }
  const expCatRows = [...expByCategory.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, { count, total }]) => `
      <tr>
        <td>${esc(cat)}</td>
        <td class="num">${count}</td>
        <td class="num amount red">${fmt(total)}</td>
      </tr>`)
    .join('');

  // Income records table
  const incomeRows = [...incomeRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.platform)}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.description ?? '—')}</td>
        <td class="num amount">${fmt(r.amount)}</td>
      </tr>`)
    .join('');

  // Expense records table
  const expenseRows = [...expenseRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.category)}</td>
        <td>${esc(r.description ?? '—')}</td>
        <td class="num amount red">${fmt(r.amount)}</td>
      </tr>`)
    .join('');

  // Outstanding invoice rows
  const outstandingInvoiceRows = [...outstandingInvoices]
    .sort((a, b) => a.issued_date.localeCompare(b.issued_date))
    .map((i) => `
      <tr>
        <td>${esc(i.brand_name)}</td>
        <td>${fmtDate(i.issued_date)}</td>
        <td>${i.due_date ? fmtDate(i.due_date) : '—'}</td>
        <td style="text-transform:capitalize">${esc(i.status)}</td>
        <td class="num amount">${fmt(i.amount)}</td>
      </tr>`)
    .join('');

  // Paid invoice rows
  const paidInvoiceRows = [...paidInvoicesInRange]
    .sort((a, b) => (a.paid_date ?? '').localeCompare(b.paid_date ?? ''))
    .map((i) => `
      <tr>
        <td>${esc(i.brand_name)}</td>
        <td>${fmtDate(i.issued_date)}</td>
        <td>${i.paid_date ? fmtDate(i.paid_date) : '—'}</td>
        <td class="num amount mint">${fmt(i.amount)}</td>
      </tr>`)
    .join('');

  const reportLabel =
    reportType === 'income' ? 'Income Summary' :
    reportType === 'expense' ? 'Expense Summary' :
    'Profit & Loss';

  const showIncome = reportType === 'income' || reportType === 'pl';
  const showExpense = reportType === 'expense' || reportType === 'pl';

  const netProfitClass = netProfit >= 0 ? 'mint' : 'red';

  const generatedOn = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const summaryCards =
    reportType === 'income' ? `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value mint">${fmt(totalRevenue)}</div>
          <div class="summary-sub">${incomeRecords.length} records</div>
        </div>
      </div>` :
    reportType === 'expense' ? `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Expenses</div>
          <div class="summary-value red">${fmt(totalExpenses)}</div>
          <div class="summary-sub">${expenseRecords.length} records</div>
        </div>
      </div>` :
    `<div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value mint">${fmt(totalRevenue)}</div>
          <div class="summary-sub">${incomeRecords.length} records</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Expenses</div>
          <div class="summary-value red">${fmt(totalExpenses)}</div>
          <div class="summary-sub">${expenseRecords.length} records</div>
        </div>
        <div class="summary-card highlight">
          <div class="summary-label">Net Profit</div>
          <div class="summary-value ${netProfitClass}">${fmt(netProfit)}</div>
          <div class="summary-sub">${netProfit >= 0 ? 'Profitable' : 'Net loss'}</div>
        </div>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>TallyBoard Financial Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    color: #111;
    background: #fff;
    padding: 40px 48px;
    max-width: 900px;
    margin: 0 auto;
  }

  /* Header */
  .header { border-bottom: 3px solid #34D399; padding-bottom: 20px; margin-bottom: 28px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .report-title { font-size: 26px; font-weight: 700; color: #111; letter-spacing: -0.3px; }
  .report-badge {
    background: #34D399;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 4px;
    letter-spacing: 0.3px;
  }
  .header-meta { margin-top: 10px; display: flex; gap: 32px; flex-wrap: wrap; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-size: 13px; color: #333; font-weight: 500; }

  /* Beta banner */
  .beta-banner {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 12px;
    color: #92400e;
    margin-bottom: 24px;
  }

  /* Summary */
  .section-title {
    font-size: 11px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 12px;
  }
  .summary-grid {
    display: flex;
    gap: 16px;
    margin-bottom: 32px;
    flex-wrap: wrap;
  }
  .summary-card {
    flex: 1;
    min-width: 150px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px 20px;
  }
  .summary-card.highlight { border-color: #34D399; border-width: 2px; }
  .summary-label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .summary-value { font-size: 22px; font-weight: 700; line-height: 1.2; }
  .summary-sub { font-size: 11px; color: #999; margin-top: 4px; }
  .mint { color: #059669; }
  .red { color: #dc2626; }

  /* Tables */
  .section { margin-bottom: 36px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f9fafb; }
  th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 10px;
    border-bottom: 1px solid #e5e7eb;
  }
  td {
    padding: 8px 10px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    font-size: 12.5px;
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }
  .num { text-align: right; }
  .amount { font-weight: 600; }
  td.amount.mint { color: #059669; }
  td.amount.red { color: #dc2626; }

  /* Footer */
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #9ca3af;
  }
  .footer-brand { font-weight: 600; color: #34D399; }

  @media print {
    body { padding: 20px 24px; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div class="report-title">TallyBoard Financial Report</div>
    <div class="report-badge">${reportLabel}</div>
  </div>
  <div class="header-meta">
    <div class="meta-item">
      <span class="meta-label">Period</span>
      <span class="meta-value">${fmtDateRange(dateRange.start, dateRange.end)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Generated</span>
      <span class="meta-value">${generatedOn}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Account</span>
      <span class="meta-value">${esc(displayName ?? userEmail)}</span>
    </div>
  </div>
</div>

<div class="beta-banner">
  ⚡ PDF export will be a Pro feature at launch — free during beta.
</div>

<div class="section-title">Summary</div>
${summaryCards}

${showIncome && incomeRecords.length > 0 ? `
<div class="section">
  <div class="section-title">Revenue Breakdown by Platform</div>
  <table>
    <thead><tr>
      <th>Platform</th>
      <th class="num">Records</th>
      <th class="num">Total</th>
    </tr></thead>
    <tbody>${platformRows}</tbody>
  </table>
</div>` : ''}

${showExpense && expenseRecords.length > 0 ? `
<div class="section">
  <div class="section-title">Expense Breakdown by Category</div>
  <table>
    <thead><tr>
      <th>Category</th>
      <th class="num">Records</th>
      <th class="num">Total</th>
    </tr></thead>
    <tbody>${expCatRows}</tbody>
  </table>
</div>` : ''}

${showIncome && incomeRecords.length > 0 ? `
<div class="section">
  <div class="section-title">Income Records (${incomeRecords.length})</div>
  <table>
    <thead><tr>
      <th>Date</th>
      <th>Platform</th>
      <th>Category</th>
      <th>Description</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${incomeRows}</tbody>
  </table>
</div>` : ''}

${showExpense && expenseRecords.length > 0 ? `
<div class="section">
  <div class="section-title">Expense Records (${expenseRecords.length})</div>
  <table>
    <thead><tr>
      <th>Date</th>
      <th>Category</th>
      <th>Description</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>
</div>` : ''}

${showIncome && incomeRecords.length === 0 && showExpense && expenseRecords.length === 0 ? `
<div style="text-align:center; padding: 40px; color: #9ca3af; font-size: 14px;">
  No records found for the selected period.
</div>` : ''}

${outstandingInvoices.length > 0 ? `
<div class="section">
  <div class="section-title">Outstanding Invoices (${outstandingInvoices.length})</div>
  <table>
    <thead><tr>
      <th>Brand</th>
      <th>Issued</th>
      <th>Due</th>
      <th>Status</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${outstandingInvoiceRows}</tbody>
    <tfoot><tr style="background:#f9fafb">
      <td colspan="4" style="font-weight:700;font-size:12px;">Total Outstanding</td>
      <td class="num amount">${fmt(outstandingInvoices.reduce((s, i) => s + i.amount, 0))}</td>
    </tr></tfoot>
  </table>
</div>` : ''}

${paidInvoicesInRange.length > 0 ? `
<div class="section">
  <div class="section-title">Paid Invoices — Brand Deals (${paidInvoicesInRange.length})</div>
  <table>
    <thead><tr>
      <th>Brand</th>
      <th>Issued</th>
      <th>Paid</th>
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${paidInvoiceRows}</tbody>
    <tfoot><tr style="background:#f9fafb">
      <td colspan="3" style="font-weight:700;font-size:12px;">Total Paid</td>
      <td class="num amount mint">${fmt(paidInvoicesInRange.reduce((s, i) => s + i.amount, 0))}</td>
    </tr></tfoot>
  </table>
</div>` : ''}

<div class="footer">
  <span>Generated by <span class="footer-brand">TallyBoard</span> · tallyboard-app.vercel.app</span>
  <span>${generatedOn}</span>
</div>

</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
