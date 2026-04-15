import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { generateReportHTML } from '../lib/pdf-generator';
import { formatCurrency } from '../lib/formatters';
import type { IncomeRecord, ExpenseRecord, InvoiceRecord } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'ytd' | 'last_year' | 'custom';
type ReportType = 'income' | 'expense' | 'pl';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getPresetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this_month':
      return {
        start: toISO(new Date(y, m, 1)),
        end: toISO(new Date(y, m + 1, 0)),
      };
    case 'last_month':
      return {
        start: toISO(new Date(y, m - 1, 1)),
        end: toISO(new Date(y, m, 0)),
      };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return {
        start: toISO(new Date(y, q * 3, 1)),
        end: toISO(new Date(y, q * 3 + 3, 0)),
      };
    }
    case 'ytd':
      return {
        start: toISO(new Date(y, 0, 1)),
        end: toISO(now),
      };
    case 'last_year':
      return {
        start: toISO(new Date(y - 1, 0, 1)),
        end: toISO(new Date(y - 1, 11, 31)),
      };
    default:
      return {
        start: toISO(new Date(y, m, 1)),
        end: toISO(new Date(y, m + 1, 0)),
      };
  }
}

function fmtDateLabel(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? '#34D399' : '#262626',
        backgroundColor: selected ? 'rgba(52,211,153,0.1)' : '#1A1A1A',
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: selected ? '#34D399' : '#A3A3A3',
          fontSize: 13,
          fontFamily: selected ? 'Inter_600SemiBold' : 'Inter_400Regular',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E1E1E' }}>
      <Text style={{ color: '#A3A3A3', fontSize: 14, fontFamily: 'Inter_400Regular' }}>{label}</Text>
      <Text style={{ color: color ?? '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'last_year', label: 'Last Year' },
];

const REPORT_TYPES: { key: ReportType; label: string; desc: string }[] = [
  { key: 'income', label: 'Income Summary', desc: 'Revenue only' },
  { key: 'expense', label: 'Expense Summary', desc: 'Expenses only' },
  { key: 'pl', label: 'Full P&L', desc: 'Revenue, expenses, net profit' },
];

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAppStore();

  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [reportType, setReportType] = useState<ReportType>('pl');
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Preview data
  const [previewData, setPreviewData] = useState<{
    revenue: number;
    expenses: number;
    net: number;
    incomeCount: number;
    expenseCount: number;
    invoicePaidTotal: number;
    invoiceOutstandingCount: number;
  } | null>(null);

  const dateRange = getPresetRange(preset);

  // Fetch preview totals
  const fetchPreview = useCallback(async () => {
    if (!user) return;
    setPreviewing(true);
    try {
      const [incomeRes, expenseRes, invoiceRes] = await Promise.all([
        supabase
          .from('income')
          .select('amount')
          .eq('user_id', user.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end),
        supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', user.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end),
        supabase
          .from('invoices')
          .select('amount, status, paid_date, issued_date')
          .eq('user_id', user.id),
      ]);

      const incomeRevenue = (incomeRes.data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
      const invoiceData = (invoiceRes.data ?? []) as Pick<InvoiceRecord, 'amount' | 'status' | 'paid_date' | 'issued_date'>[];
      const invoicePaidTotal = invoiceData
        .filter((i) => i.status === 'paid' && i.paid_date && i.paid_date >= dateRange.start && i.paid_date <= dateRange.end)
        .reduce((s, i) => s + i.amount, 0);
      const invoiceOutstandingCount = invoiceData
        .filter((i) => (i.status === 'pending' || i.status === 'overdue') && i.issued_date >= dateRange.start && i.issued_date <= dateRange.end)
        .length;
      const revenue = incomeRevenue + invoicePaidTotal;
      const expenses = (expenseRes.data ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0);
      setPreviewData({
        revenue,
        expenses,
        net: revenue - expenses,
        incomeCount: (incomeRes.data ?? []).length,
        expenseCount: (expenseRes.data ?? []).length,
        invoicePaidTotal,
        invoiceOutstandingCount,
      });
    } finally {
      setPreviewing(false);
    }
  }, [user, dateRange.start, dateRange.end]);

  // Fetch on mount and when range changes
  React.useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);

    try {
      // Full data fetch
      const [incomeRes, expenseRes, invoiceRes] = await Promise.all([
        supabase
          .from('income')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .order('date', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)
          .order('date', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .order('issued_date', { ascending: false }),
      ]);

      if (incomeRes.error) throw incomeRes.error;
      if (expenseRes.error) throw expenseRes.error;

      const html = generateReportHTML({
        dateRange,
        reportType,
        userEmail: user.email ?? '',
        displayName: user.user_metadata?.full_name ?? user.email ?? '',
        incomeRecords: (incomeRes.data ?? []) as IncomeRecord[],
        expenseRecords: (expenseRes.data ?? []) as ExpenseRecord[],
        invoiceRecords: (invoiceRes.data ?? []) as InvoiceRecord[],
      });

      if (Platform.OS === 'web') {
        // On web: open print dialog (browsers will offer Save as PDF)
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        } else {
          // Fallback: trigger download via blob
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tallyboard-report-${dateRange.start}-${dateRange.end}.html`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        // Native: generate PDF and share
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share TallyBoard Report',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('PDF saved', `Saved to: ${uri}`);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }

  const netColor = previewData && previewData.net < 0 ? '#EF4444' : '#34D399';
  const showRevenue = reportType === 'income' || reportType === 'pl';
  const showExpenses = reportType === 'expense' || reportType === 'pl';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }} hitSlop={12}>
          <Text style={{ color: '#34D399', fontSize: 24, lineHeight: 28 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontFamily: 'Inter_700Bold' }}>
            Reports
          </Text>
          <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
            Generate a tax-ready PDF
          </Text>
        </View>
      </View>

      {/* ── Beta Banner ── */}
      <View
        style={{
          backgroundColor: 'rgba(251,191,36,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(251,191,36,0.25)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 28,
        }}
      >
        <Text style={{ color: '#FCD34D', fontSize: 12, fontFamily: 'Inter_500Medium' }}>
          ⚡ PDF export will be a Pro feature at launch — free during beta.
        </Text>
      </View>

      {/* ── Date Range ── */}
      <Text
        style={{
          color: '#A3A3A3',
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}
      >
        Date Range
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <SelectChip
            key={p.key}
            label={p.label}
            selected={preset === p.key}
            onPress={() => setPreset(p.key)}
          />
        ))}
      </View>
      <Text
        style={{
          color: '#666',
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          marginBottom: 28,
        }}
      >
        {fmtDateLabel(dateRange.start)} – {fmtDateLabel(dateRange.end)}
      </Text>

      {/* ── Report Type ── */}
      <Text
        style={{
          color: '#A3A3A3',
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}
      >
        Report Type
      </Text>
      <View style={{ marginBottom: 28 }}>
        {REPORT_TYPES.map((rt) => (
          <TouchableOpacity
            key={rt.key}
            onPress={() => setReportType(rt.key)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1A1A1A',
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: reportType === rt.key ? '#34D399' : '#262626',
              padding: 14,
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: reportType === rt.key ? '#34D399' : '#444',
                backgroundColor: reportType === rt.key ? '#34D399' : 'transparent',
                marginRight: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {reportType === rt.key && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A0A0A' }} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                {rt.label}
              </Text>
              <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                {rt.desc}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Preview ── */}
      <Text
        style={{
          color: '#A3A3A3',
          fontSize: 11,
          fontFamily: 'Inter_600SemiBold',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}
      >
        Preview
      </Text>
      <View
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#262626',
          padding: 16,
          marginBottom: 32,
        }}
      >
        {previewing ? (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator color="#34D399" size="small" />
          </View>
        ) : previewData ? (
          <>
            {showRevenue && (
              <SummaryRow
                label="Total Revenue"
                value={formatCurrency(previewData.revenue)}
                color="#34D399"
              />
            )}
            {showExpenses && (
              <SummaryRow
                label="Total Expenses"
                value={formatCurrency(previewData.expenses)}
                color="#EF4444"
              />
            )}
            {reportType === 'pl' && (
              <SummaryRow
                label="Net Profit"
                value={formatCurrency(previewData.net)}
                color={netColor}
              />
            )}
            <SummaryRow
              label="Income Records"
              value={String(previewData.incomeCount)}
            />
            <SummaryRow
              label="Expense Records"
              value={String(previewData.expenseCount)}
            />
            {previewData.invoicePaidTotal > 0 && (
              <SummaryRow
                label="Paid Invoices (Brand Deals)"
                value={formatCurrency(previewData.invoicePaidTotal)}
                color="#34D399"
              />
            )}
            {previewData.invoiceOutstandingCount > 0 && (
              <SummaryRow
                label="Outstanding Invoices"
                value={String(previewData.invoiceOutstandingCount)}
                color="#FBBF24"
              />
            )}
          </>
        ) : (
          <Text style={{ color: '#666', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16 }}>
            No data available
          </Text>
        )}
      </View>

      {/* ── Generate Button ── */}
      <TouchableOpacity
        onPress={handleGenerate}
        disabled={generating}
        style={{
          backgroundColor: generating ? '#1A1A1A' : '#34D399',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          opacity: generating ? 0.6 : 1,
        }}
      >
        {generating ? (
          <ActivityIndicator color="#34D399" size="small" />
        ) : (
          <Text style={{ color: '#0A0A0A', fontSize: 15, fontFamily: 'Inter_700Bold' }}>
            Generate PDF
          </Text>
        )}
      </TouchableOpacity>

      <Text
        style={{
          color: '#555',
          fontSize: 11,
          fontFamily: 'Inter_400Regular',
          textAlign: 'center',
          marginTop: 12,
        }}
      >
        {Platform.OS === 'web'
          ? 'Opens a print dialog — choose "Save as PDF" in your browser.'
          : 'Opens the share sheet to save or send your PDF.'}
      </Text>
    </ScrollView>
  );
}
