import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency } from '../lib/formatters';
import { Button } from '../components/ui/Button';
import {
  detectFormat,
  hasRevenueColumn,
  parseYouTube,
  parsePayPal,
  parseStripe,
  parseGeneric,
  isZipBuffer,
  extractCsvFromZip,
  type CsvFormat,
  type ParseResult,
} from '../lib/csv-parser';

// ─── Constants ────────────────────────────────────────────────────────────────

const MINT = '#34D399';

const FORMAT_LABELS: Record<CsvFormat, string> = {
  youtube: 'YouTube Analytics',
  paypal: 'PayPal',
  stripe: 'Stripe',
  generic: 'Generic / Bank CSV',
};

const PLATFORMS = [
  'YouTube', 'TikTok', 'Twitch', 'Patreon',
  'Stripe', 'PayPal', 'Brand Deal', 'Affiliate', 'Other',
];

const CATEGORIES = [
  'Ad Revenue', 'Sponsorship', 'Merch', 'Affiliate',
  'Tips', 'Subscription', 'Other',
];

const FORMATS: CsvFormat[] = ['youtube', 'paypal', 'stripe', 'generic'];

// ─── Picker ───────────────────────────────────────────────────────────────────

import { Modal } from 'react-native';

function PickerSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 }}>
        {label}
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#1A1A1A',
          borderWidth: 1,
          borderColor: '#262626',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: '#FFFFFF', fontFamily: 'Inter_400Regular', fontSize: 15 }}>{value}</Text>
        <Text style={{ color: '#A3A3A3' }}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#262626', borderRadius: 16, overflow: 'hidden', width: 300 }}>
              <Text style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                {label.toUpperCase()}
              </Text>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  style={{ paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#262626', flexDirection: 'row', alignItems: 'center' }}
                  onPress={() => { onChange(opt); setOpen(false); }}
                >
                  {opt === value && (
                    <View style={{ width: 3, height: 14, backgroundColor: MINT, borderRadius: 2, marginRight: 10 }} />
                  )}
                  {opt !== value && <View style={{ width: 13 }} />}
                  <Text style={{ color: opt === value ? MINT : '#FFFFFF', fontFamily: opt === value ? 'Inter_600SemiBold' : 'Inter_400Regular', fontSize: 15 }}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ marginVertical: 16 }}>
      <View style={{ backgroundColor: '#262626', borderRadius: 6, height: 8, overflow: 'hidden' }}>
        <View style={{ backgroundColor: MINT, height: 8, width: `${pct}%` as any, borderRadius: 6 }} />
      </View>
      <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, textAlign: 'center' }}>
        {done} / {total} records
      </Text>
    </View>
  );
}

// ─── Sample CSV ───────────────────────────────────────────────────────────────

function downloadSampleCsv() {
  const csv = [
    'Date,Estimated revenue (USD)',
    '2026-04-01,12.45',
    '2026-04-02,18.92',
    '2026-04-03,7.30',
    '2026-04-04,22.18',
    '2026-04-05,15.66',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'youtube_revenue_sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Auto-detected column helper ──────────────────────────────────────────────

function getAutoDetectedCols(
  format: CsvFormat,
  headers: string[]
): { amount: string; date: string } {
  const lc = (s: string) => s.toLowerCase().trim();
  if (format === 'youtube') {
    return {
      amount: headers.find((h) => lc(h).includes('revenue')) ?? '(not found)',
      date: headers.find((h) => lc(h).includes('publish time') || lc(h) === 'date') ?? '(not found)',
    };
  }
  if (format === 'paypal') {
    return {
      amount: headers.find((h) => lc(h) === 'net') ?? 'Net',
      date: headers.find((h) => lc(h) === 'date') ?? 'Date',
    };
  }
  if (format === 'stripe') {
    return {
      amount: headers.find((h) => lc(h) === 'amount') ?? 'Amount',
      date: headers.find((h) => lc(h).includes('created')) ?? 'Created (UTC)',
    };
  }
  return { amount: '', date: '' };
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
      {[1, 2, 3, 4].map((s) => (
        <View
          key={s}
          style={{
            width: s === step ? 20 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: s === step ? MINT : s < step ? '#2D5A47' : '#262626',
          }}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ImportScreen() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setIncome = useAppStore((s) => s.setIncome);

  // ── Step state ──
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── File / parse state ──
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [parseError, setParseError] = useState('');
  const [zipStatus, setZipStatus] = useState('');

  // ── Format state ──
  const [detectedFormat, setDetectedFormat] = useState<CsvFormat>('generic');
  const [selectedFormat, setSelectedFormat] = useState<CsvFormat>('generic');

  // ── Mapping state ──
  const [defaultPlatform, setDefaultPlatform] = useState('YouTube');
  const [defaultCategory, setDefaultCategory] = useState('Ad Revenue');
  const [amountCol, setAmountCol] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');

  // ── Parsed result ──
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);

  // ── Import state ──
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // ── Step 1: pick file ─────────────────────────────────────────────────────

  async function handlePickFile() {
    setPicking(true);
    setParseError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? '*/*' : 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        setPicking(false);
        return;
      }

      const asset = result.assets[0];
      const originalName = asset.name ?? 'file.csv';

      // Read raw bytes so we can detect ZIPs
      setZipStatus('');
      let csvContent: string;
      let resolvedName = originalName;

      if (Platform.OS === 'web') {
        const resp = await fetch(asset.uri);
        const buf = await resp.arrayBuffer();

        if (isZipBuffer(buf)) {
          const { csv, name } = await extractCsvFromZip(buf, setZipStatus);
          csvContent = csv;
          resolvedName = name;
        } else {
          csvContent = new TextDecoder().decode(buf);
        }
      } else {
        // Native: check extension as a proxy for ZIP
        if (originalName.toLowerCase().endsWith('.zip')) {
          const FileSystem = await import('expo-file-system');
          const b64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: (FileSystem as any).EncodingType.Base64,
          });
          const binary = atob(b64);
          const buf = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buf);
          for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
          const { csv, name } = await extractCsvFromZip(buf, setZipStatus);
          csvContent = csv;
          resolvedName = name;
        } else {
          const FileSystem = await import('expo-file-system');
          csvContent = await FileSystem.readAsStringAsync(asset.uri);
        }
      }

      setZipStatus('');

      // Parse CSV
      const parsed = Papa.parse<Record<string, string>>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        setParseError(`Failed to parse CSV: ${parsed.errors[0].message}`);
        setPicking(false);
        return;
      }

      const rows = parsed.data;
      const hdrs = parsed.meta.fields ?? [];

      if (rows.length === 0) {
        setParseError('CSV appears to be empty.');
        setPicking(false);
        return;
      }

      setFileName(resolvedName);
      setRawRows(rows);
      setHeaders(hdrs);

      const fmt = detectFormat(hdrs);
      setDetectedFormat(fmt);
      setSelectedFormat(fmt);

      // Detect YouTube content-stats CSVs regardless of detected format.
      // A content stats export has YouTube-specific columns but no revenue data.
      // Because it lacks "Estimated revenue", detectFormat() returns 'generic',
      // so we cannot gate on fmt === 'youtube'. Instead we look for YouTube
      // content markers combined with the absence of any revenue column.
      const lch = hdrs.map((h) => h.toLowerCase());
      const hasYouTubeContentMarker = lch.some(
        (h) =>
          h.includes('video title') ||
          h.includes('watch time') ||
          h.includes('video id') ||
          h.includes('average view duration') ||
          h.includes('impressions')
      );
      if (hasYouTubeContentMarker && !hasRevenueColumn(hdrs)) {
        setParseError(
          "This file has no revenue data. You uploaded a content stats CSV. Go to YouTube Studio → Analytics → Revenue tab and export from there. If your channel isn't monetized, use the Sample CSV button below to test with fake data instead."
        );
        setPicking(false);
        return;
      }

      // Pre-select generic column map
      if (fmt === 'generic') {
        const amtGuess = hdrs.find((h) => /amount|total|revenue|price|net|gross/i.test(h)) ?? hdrs[0];
        const dateGuess = hdrs.find((h) => /date|time|created/i.test(h)) ?? hdrs[1] ?? hdrs[0];
        const descGuess = hdrs.find((h) => /desc|name|memo|note|narr/i.test(h));
        setAmountCol(amtGuess ?? '');
        setDateCol(dateGuess ?? '');
        setDescCol(descGuess ?? '');
      }

      setStep(2);
    } catch (e: any) {
      setParseError(e?.message ?? 'Unknown error reading file');
    }
    setPicking(false);
  }

  // ── Step 2 → 3: build preview ─────────────────────────────────────────────

  function handleFormatConfirm() {
    // Reject YouTube CSVs that have no revenue column — these are content/views
    // exports which contain no usable revenue data.
    if (selectedFormat === 'youtube' && !hasRevenueColumn(headers)) {
      setParseError(
        "This file has no revenue data. You uploaded a content stats CSV. Go to YouTube Studio → Analytics → Revenue tab and export from there. If your channel isn't monetized, use the Sample CSV button below to test with fake data instead."
      );
      return;
    }
    setParseError('');
    setStep(3);
  }

  // ── Step 3 → 4: parse then immediately import ───────────────────────────

  async function handleImportDirect() {
    let result: ParseResult;
    try {
      switch (selectedFormat) {
        case 'youtube':
          result = parseYouTube(rawRows);
          break;
        case 'paypal':
          result = parsePayPal(rawRows);
          break;
        case 'stripe':
          result = parseStripe(rawRows);
          break;
        default:
          if (!amountCol || !dateCol) return;
          result = parseGeneric(
            rawRows,
            { amount: amountCol, date: dateCol, description: descCol || undefined },
            defaultPlatform,
            defaultCategory
          );
      }
    } catch (e: any) {
      setParseError(e?.message ?? 'Parse error — check your CSV format.');
      setStep(1); // send them back to step 1 where the error is displayed
      return;
    }
    setParsedResult(result);
    setStep(4);

    if (!user || result.records.length === 0) return;

    setImporting(true);
    setImportProgress({ done: 0, total: result.records.length });

    const CHUNK = 50;
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    const total = result.records.length;

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = result.records
        .slice(i, i + CHUNK)
        .map((r) => ({ ...r, user_id: user.id }));

      const { error } = await supabase.from('income').insert(chunk);
      if (error) {
        failed += chunk.length;
        errors.push(`Rows ${i + 1}–${Math.min(i + CHUNK, total)}: ${error.message}`);
      } else {
        success += chunk.length;
      }
      setImportProgress({ done: i + chunk.length, total });
    }

    // Refresh store
    if (success > 0) {
      const { data } = await supabase
        .from('income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) setIncome(data as any);
    }

    setImporting(false);
    setImportResult({ success, failed, errors });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // Filter the "Total" summary row before preview so it doesn't pollute the table.
  const contentCol = headers[0] ?? '';
  const previewRows = rawRows
    .filter((r) => (r[contentCol] ?? '').trim().toLowerCase() !== 'total')
    .slice(0, 5);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#262626' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16, padding: 4 }}>
          <Text style={{ color: '#A3A3A3', fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold', flex: 1 }}>
          Import CSV
        </Text>
        {fileName ? (
          <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular', maxWidth: 160 }} numberOfLines={1}>
            {fileName}
          </Text>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <StepDots step={step} />

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
              Upload a CSV file
            </Text>
            <Text style={{ color: '#A3A3A3', fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 32, lineHeight: 22 }}>
              Supports YouTube Analytics, PayPal, Stripe, or any generic bank/payment CSV.
            </Text>

            <TouchableOpacity
              onPress={handlePickFile}
              disabled={picking}
              style={{
                borderWidth: 2,
                borderColor: '#262626',
                borderStyle: 'dashed',
                borderRadius: 16,
                padding: 40,
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              {picking ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator color={MINT} size="large" style={{ marginBottom: 14 }} />
                  {zipStatus ? (
                    <Text style={{ color: MINT, fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' }}>
                      {zipStatus}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 40, marginBottom: 16 }}>📂</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
                    Pick CSV file
                  </Text>
                  <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
                    Browse your files — CSV or ZIP accepted
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {parseError ? (
              <View style={{ backgroundColor: '#2D1515', borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', padding: 14, marginBottom: 16 }}>
                <Text style={{ color: '#EF4444', fontSize: 14, fontFamily: 'Inter_400Regular' }}>{parseError}</Text>
              </View>
            ) : null}

            {/* Sample CSV download */}
            <TouchableOpacity
              onPress={downloadSampleCsv}
              style={{
                backgroundColor: '#1A1A1A',
                borderWidth: 1,
                borderColor: MINT,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 20,
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ color: MINT, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                Download Sample CSV
              </Text>
              <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 }}>
                5 rows of test data — upload it right back to try the import flow
              </Text>
            </TouchableOpacity>

            <View style={{ backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 16 }}>
              <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Supported formats
              </Text>
              {[
                ['YouTube Analytics', 'Revenue report CSV from YouTube Studio'],
                ['PayPal', 'Transaction history CSV from PayPal'],
                ['Stripe', 'Payments CSV from Stripe Dashboard'],
                ['Generic', 'Any CSV with date and amount columns'],
              ].map(([name, desc]) => (
                <View key={name} style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <View style={{ width: 6, height: 6, backgroundColor: MINT, borderRadius: 3, marginTop: 6, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{name}</Text>
                    <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular' }}>{desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 2: Format Detection ── */}
        {step === 2 && (
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
              Format detected
            </Text>
            <Text style={{ color: '#A3A3A3', fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 28, lineHeight: 22 }}>
              We analysed your headers and found a match. Confirm or override below.
            </Text>

            {/* Detection result badge */}
            <View style={{ backgroundColor: '#0D2E1F', borderRadius: 14, borderWidth: 1, borderColor: MINT, padding: 20, marginBottom: 24, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>
                {detectedFormat === 'youtube' ? '▶' : detectedFormat === 'paypal' ? '💳' : detectedFormat === 'stripe' ? '⚡' : '📄'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Detected
                </Text>
                <Text style={{ color: MINT, fontSize: 18, fontFamily: 'Inter_700Bold' }}>
                  {FORMAT_LABELS[detectedFormat]}
                </Text>
              </View>
            </View>

            {/* Headers found */}
            <View style={{ backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 14, marginBottom: 24 }}>
              <Text style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Columns found ({headers.length})
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20 }}>
                {headers.join('  ·  ')}
              </Text>
            </View>

            {/* Override */}
            <PickerSelect
              label="Format (override if needed)"
              value={FORMAT_LABELS[selectedFormat]}
              options={FORMATS.map((f) => FORMAT_LABELS[f])}
              onChange={(label) => {
                const fmt = FORMATS.find((f) => FORMAT_LABELS[f] === label) ?? 'generic';
                setSelectedFormat(fmt);
              }}
            />

            <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 10, marginBottom: 20 }}>
              {rawRows.length.toLocaleString()} rows found in file
            </Text>

            {parseError ? (
              <View style={{ backgroundColor: '#2D1515', borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', padding: 14, marginBottom: 20 }}>
                <Text style={{ color: '#EF4444', fontSize: 14, fontFamily: 'Inter_400Regular' }}>{parseError}</Text>
              </View>
            ) : null}

            <Button title="Looks right — continue" onPress={handleFormatConfirm} />
            <Button title="Back" variant="ghost" onPress={() => { setParseError(''); setStep(1); }} />
          </View>
        )}

        {/* ── Step 3: Preview & Map ── */}
        {step === 3 && (
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
              Preview & map
            </Text>
            <Text style={{ color: '#A3A3A3', fontSize: 15, fontFamily: 'Inter_400Regular', marginBottom: 24, lineHeight: 22 }}>
              {selectedFormat === 'generic'
                ? 'Tell us which columns hold the amount and date.'
                : `Auto-mapped for ${FORMAT_LABELS[selectedFormat]}. Set a default platform and category below.`}
            </Text>

            {/* Preview table */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                First {previewRows.length} rows
              </Text>
              {Platform.OS === 'web' ? (
                // Proper HTML table on web for correct alignment
                // @ts-ignore – HTML elements work via react-native-web
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #262626' }}>
                  {/* @ts-ignore */}
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                    {/* @ts-ignore */}
                    <thead>
                      {/* @ts-ignore */}
                      <tr>
                        {headers.slice(0, 6).map((h) => (
                          // @ts-ignore
                          <th
                            key={h}
                            style={{
                              color: MINT,
                              fontSize: 11,
                              fontWeight: '600',
                              padding: '8px 12px',
                              textAlign: 'left',
                              backgroundColor: '#1A1A1A',
                              borderBottom: '1px solid #262626',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                            {/* @ts-ignore */}
                          </th>
                        ))}
                        {/* @ts-ignore */}
                      </tr>
                      {/* @ts-ignore */}
                    </thead>
                    {/* @ts-ignore */}
                    <tbody>
                      {previewRows.map((row, ri) => (
                        // @ts-ignore
                        <tr key={ri} style={{ backgroundColor: ri % 2 === 0 ? '#111111' : '#0A0A0A' }}>
                          {headers.slice(0, 6).map((h) => (
                            // @ts-ignore
                            <td
                              key={h}
                              style={{
                                color: '#D1D5DB',
                                padding: '8px 12px',
                                borderBottom: '1px solid #1A1A1A',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {row[h] ?? '—'}
                              {/* @ts-ignore */}
                            </td>
                          ))}
                          {/* @ts-ignore */}
                        </tr>
                      ))}
                      {/* @ts-ignore */}
                    </tbody>
                    {/* @ts-ignore */}
                  </table>
                  {/* @ts-ignore */}
                </div>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator>
                  <View>
                    <View style={{ flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 8, marginBottom: 2 }}>
                      {headers.slice(0, 6).map((h) => (
                        <View key={h} style={{ width: 130, padding: 8, borderRightWidth: 1, borderRightColor: '#262626' }}>
                          <Text style={{ color: MINT, fontSize: 11, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{h}</Text>
                        </View>
                      ))}
                    </View>
                    {previewRows.map((row, ri) => (
                      <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri % 2 === 0 ? '#111' : '#0A0A0A', marginBottom: 1 }}>
                        {headers.slice(0, 6).map((h) => (
                          <View key={h} style={{ width: 130, padding: 8, borderRightWidth: 1, borderRightColor: '#1A1A1A' }}>
                            <Text style={{ color: '#D1D5DB', fontSize: 12, fontFamily: 'Inter_400Regular' }} numberOfLines={1}>
                              {row[h] ?? '—'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              {headers.length > 6 && (
                <Text style={{ color: '#6B7280', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 }}>
                  +{headers.length - 6} more columns not shown
                </Text>
              )}
            </View>

            {/* Generic column mapping */}
            {selectedFormat === 'generic' && (
              <View style={{ gap: 16, marginBottom: 24 }}>
                <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Column mapping
                </Text>
                <PickerSelect
                  label="Amount column *"
                  value={amountCol}
                  options={headers}
                  onChange={setAmountCol}
                />
                <PickerSelect
                  label="Date column *"
                  value={dateCol}
                  options={headers}
                  onChange={setDateCol}
                />
                <PickerSelect
                  label="Description column (optional)"
                  value={descCol || '— none —'}
                  options={['— none —', ...headers]}
                  onChange={(v) => setDescCol(v === '— none —' ? '' : v)}
                />
              </View>
            )}

            {/* Auto-detected columns for known formats (read-only) */}
            {selectedFormat !== 'generic' && (() => {
              const cols = getAutoDetectedCols(selectedFormat, headers);
              return (
                <View style={{ backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 14, marginBottom: 24 }}>
                  <Text style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                    Auto-detected columns
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 4 }}>
                    Revenue from{' '}
                    <Text style={{ color: MINT, fontFamily: 'Inter_600SemiBold' }}>{cols.amount}</Text>
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 14, fontFamily: 'Inter_400Regular' }}>
                    Date from{' '}
                    <Text style={{ color: MINT, fontFamily: 'Inter_600SemiBold' }}>{cols.date}</Text>
                  </Text>
                </View>
              );
            })()}

            {/* Default platform / category overrides — hidden for locked formats */}
            {selectedFormat !== 'youtube' && (
              <View style={{ gap: 16, marginBottom: 28 }}>
                <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Defaults for all imported rows
                </Text>
                <PickerSelect
                  label="Platform"
                  value={defaultPlatform}
                  options={PLATFORMS}
                  onChange={setDefaultPlatform}
                />
                <PickerSelect
                  label="Category"
                  value={defaultCategory}
                  options={CATEGORIES}
                  onChange={setDefaultCategory}
                />
              </View>
            )}

            <Button
              title="Import"
              onPress={handleImportDirect}
              disabled={selectedFormat === 'generic' && (!amountCol || !dateCol)}
            />
            <Button title="Back" variant="ghost" onPress={() => setStep(2)} />
          </View>
        )}

        {/* ── Step 4: Confirm & Import ── */}
        {step === 4 && (
          <View>

            {/* Importing in progress */}
            {importing && importProgress && (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <ActivityIndicator color={MINT} size="large" style={{ marginBottom: 24 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
                  Importing…
                </Text>
                <ProgressBar done={importProgress.done} total={importProgress.total} />
              </View>
            )}

            {/* Import done */}
            {!importing && importResult && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                  <Text style={{ fontSize: 56, marginBottom: 16 }}>
                    {importResult.failed === 0 ? '✅' : '⚠️'}
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 8 }}>
                    {importResult.failed === 0 ? 'Import complete!' : 'Imported with errors'}
                  </Text>
                  <Text style={{ color: '#A3A3A3', fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
                    {importResult.success.toLocaleString()} records imported successfully
                    {importResult.failed > 0 ? `, ${importResult.failed} failed` : ''}
                  </Text>
                </View>

                <View style={{ backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#262626', padding: 20, marginBottom: 20 }}>
                  <SummaryRow label="Successfully imported" value={importResult.success.toLocaleString()} accent />
                  <SummaryRow label="Failed" value={importResult.failed.toLocaleString()} />
                </View>

                {importResult.errors.length > 0 && (
                  <View style={{ backgroundColor: '#1A1510', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B', padding: 14, marginBottom: 20 }}>
                    <Text style={{ color: '#F59E0B', fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 }}>
                      Insert errors:
                    </Text>
                    {importResult.errors.map((e, i) => (
                      <Text key={i} style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 3 }}>
                        · {e}
                      </Text>
                    ))}
                  </View>
                )}

                <Button
                  title="Back to Income"
                  onPress={() => { router.back(); }}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function MappingRow({ from, to }: { from: string; to: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Text style={{ color: '#6B7280', fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 }}>{from}</Text>
      <Text style={{ color: '#A3A3A3', fontSize: 13, marginHorizontal: 8 }}>→</Text>
      <Text style={{ color: '#D1D5DB', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 }}>{to}</Text>
    </View>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ color: '#A3A3A3', fontSize: 14, fontFamily: 'Inter_400Regular' }}>{label}</Text>
      <Text style={{ color: accent ? MINT : '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold' }}>{value}</Text>
    </View>
  );
}
