import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { useInvoices } from '../../hooks/useInvoices';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../lib/formatters';
import type { InvoiceRecord, InvoiceStatus } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES: InvoiceStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  pending:   { bg: '#FBBF24', text: '#1A1A1A' },
  paid:      { bg: '#34D399', text: '#1A1A1A' },
  overdue:   { bg: '#EF4444', text: '#FFFFFF' },
  cancelled: { bg: '#6B7280', text: '#FFFFFF' },
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { bg, text } = STATUS_COLORS[status];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: text, fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' }}>
        {status}
      </Text>
    </View>
  );
}

// ─── Picker ──────────────────────────────────────────────────────────────────

function PickerSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ width: '100%', marginBottom: 16 }}>
      <Text style={{ color: '#A3A3A3', fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 8 }}>
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
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_400Regular', textTransform: 'capitalize' }}>
          {value}
        </Text>
        <Text style={{ color: '#A3A3A3', fontSize: 12 }}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, borderWidth: 1, borderColor: '#262626', width: 280, overflow: 'hidden' }}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => { onChange(opt); setOpen(false); }}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#262626',
                  backgroundColor: value === opt ? 'rgba(52,211,153,0.08)' : 'transparent',
                }}
              >
                <Text style={{
                  color: value === opt ? '#34D399' : '#FFFFFF',
                  fontSize: 15,
                  fontFamily: value === opt ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  textTransform: 'capitalize',
                }}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | InvoiceStatus;
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InvoicesScreen() {
  const { invoices, invoicesLoading } = useAppStore();
  const { fetchInvoices, addInvoice, updateInvoice, deleteInvoice, markAsPaid } = useInvoices();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);

  // Form state
  const [brandName, setBrandName] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('pending');
  const [issuedDate, setIssuedDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    console.log('[Invoices] mounted');
    if (invoices.length === 0) fetchInvoices();
  }, []);

  // ── Stats ──
  const today = todayISO();
  const currentMonth = today.slice(0, 7); // YYYY-MM

  const outstandingTotal = invoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((s, i) => s + i.amount, 0);

  const paidThisMonth = invoices
    .filter((i) => i.status === 'paid' && i.paid_date?.startsWith(currentMonth))
    .reduce((s, i) => s + i.amount, 0);

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

  // ── Filtered list ──
  const filtered = filterTab === 'all'
    ? invoices
    : invoices.filter((i) => i.status === filterTab);

  // ── Form helpers ──
  function openAdd() {
    setEditingInvoice(null);
    setBrandName('');
    setAmount('');
    setStatus('pending');
    setIssuedDate(todayISO());
    setDueDate('');
    setPaidDate('');
    setNotes('');
    setShowForm(true);
  }

  function openEdit(invoice: InvoiceRecord) {
    setEditingInvoice(invoice);
    setBrandName(invoice.brand_name);
    setAmount(String(invoice.amount));
    setStatus(invoice.status);
    setIssuedDate(invoice.issued_date);
    setDueDate(invoice.due_date ?? '');
    setPaidDate(invoice.paid_date ?? '');
    setNotes(invoice.notes ?? '');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingInvoice(null);
  }

  async function handleSave() {
    if (!brandName.trim()) return Alert.alert('Required', 'Brand name is required.');
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Required', 'Enter a valid amount.');
    if (!issuedDate) return Alert.alert('Required', 'Issued date is required.');

    setSaving(true);
    const record = {
      brand_name: brandName.trim(),
      amount: parsedAmount,
      currency: 'USD',
      status,
      issued_date: issuedDate,
      due_date: dueDate || null,
      paid_date: status === 'paid' ? (paidDate || todayISO()) : null,
      notes: notes.trim() || null,
    };

    if (editingInvoice) {
      const { error } = await updateInvoice(editingInvoice.id, record);
      if (error) Alert.alert('Error', error.message);
    } else {
      const { error } = await addInvoice(record);
      if (error) Alert.alert('Error', error.message);
    }
    setSaving(false);
    closeForm();
  }

  async function handleDelete() {
    if (!editingInvoice) return;
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Delete invoice for ${editingInvoice.brand_name}? This cannot be undone.`
      );
      if (!confirmed) return;
      const { error } = await deleteInvoice(editingInvoice.id);
      if (error) Alert.alert('Error', error.message);
      else closeForm();
    } else {
      Alert.alert(
        'Delete Invoice',
        `Delete invoice for ${editingInvoice.brand_name}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const { error } = await deleteInvoice(editingInvoice.id);
              if (error) Alert.alert('Error', error.message);
              else closeForm();
            },
          },
        ]
      );
    }
  }

  async function handleMarkPaid(invoice: InvoiceRecord) {
    const { error } = await markAsPaid(invoice.id);
    if (error) Alert.alert('Error', error.message);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* ── Header ── */}
      <View style={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'Inter_700Bold' }}>
            Invoices
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#34D399',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#0A0A0A', fontSize: 22, lineHeight: 26, fontFamily: 'Inter_700Bold' }}>+</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stat Cards ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 14 }}>
            <Text style={{ color: '#A3A3A3', fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Outstanding
            </Text>
            <Text style={{ color: '#FBBF24', fontSize: 15, fontFamily: 'Inter_700Bold' }} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(outstandingTotal)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 14 }}>
            <Text style={{ color: '#A3A3A3', fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Paid This Month
            </Text>
            <Text style={{ color: '#34D399', fontSize: 15, fontFamily: 'Inter_700Bold' }} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(paidThisMonth)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#262626', padding: 14 }}>
            <Text style={{ color: '#A3A3A3', fontSize: 10, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Overdue
            </Text>
            <Text style={{ color: overdueCount > 0 ? '#EF4444' : '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold' }}>
              {overdueCount}
            </Text>
          </View>
        </View>

        {/* ── Filter Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilterTab(tab.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: filterTab === tab.key ? '#34D399' : '#262626',
                backgroundColor: filterTab === tab.key ? 'rgba(52,211,153,0.1)' : '#1A1A1A',
              }}
            >
              <Text style={{
                color: filterTab === tab.key ? '#34D399' : '#A3A3A3',
                fontSize: 13,
                fontFamily: filterTab === tab.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Invoice List ── */}
      {invoicesLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#34D399" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 12 }}>
            {filterTab === 'all' ? 'No invoices yet' : `No ${filterTab} invoices`}
          </Text>
          <Text style={{ color: '#A3A3A3', fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 }}>
            {filterTab === 'all'
              ? 'No invoices tracked yet. Tap + to log your first brand deal.'
              : `No invoices with status "${filterTab}".`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={{
                backgroundColor: '#1A1A1A',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: item.status === 'overdue' ? 'rgba(239,68,68,0.3)' : '#262626',
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1, marginRight: 10 }} numberOfLines={1}>
                  {item.brand_name}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={{ color: '#34D399', fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>
                {formatCurrency(item.amount)}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                  Issued {fmtDate(item.issued_date)}
                </Text>
                {item.due_date && (
                  <Text style={{ color: item.status === 'overdue' ? '#EF4444' : '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                    Due {fmtDate(item.due_date)}
                  </Text>
                )}
              </View>
              {item.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => handleMarkPaid(item)}
                  style={{
                    marginTop: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#34D399',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#34D399', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                    Mark as Paid
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Add / Edit Form Modal ── */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={closeForm}
          />
          <View
            style={{
              backgroundColor: '#0A0A0A',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: '#262626',
              paddingTop: 20,
              paddingHorizontal: 24,
              paddingBottom: Platform.OS === 'ios' ? 40 : 24,
              maxHeight: '90%',
            }}
          >
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 20 }} />

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 24 }}>
                {editingInvoice ? 'Edit Invoice' : 'Add Invoice'}
              </Text>

              <Input
                label="Brand Name *"
                placeholder="e.g. Nike, Squarespace"
                value={brandName}
                onChangeText={setBrandName}
              />

              <Input
                label="Amount *"
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              <PickerSelect
                label="Status"
                value={status}
                options={STATUSES}
                onChange={(v) => setStatus(v as InvoiceStatus)}
              />

              <Input
                label="Issued Date *"
                placeholder="YYYY-MM-DD"
                value={issuedDate}
                onChangeText={setIssuedDate}
              />

              <Input
                label="Due Date (optional)"
                placeholder="YYYY-MM-DD"
                value={dueDate}
                onChangeText={setDueDate}
              />

              {status === 'paid' && (
                <Input
                  label="Paid Date"
                  placeholder="YYYY-MM-DD"
                  value={paidDate}
                  onChangeText={setPaidDate}
                />
              )}

              <Input
                label="Notes (optional)"
                placeholder="Campaign details, payment terms…"
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: editingInvoice ? 0 : 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Cancel" onPress={closeForm} variant="ghost" />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} disabled={saving} />
                </View>
              </View>

              {editingInvoice && (
                <TouchableOpacity
                  onPress={handleDelete}
                  style={{
                    marginTop: 16,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: '#EF4444', fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>
                    Delete Invoice
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
