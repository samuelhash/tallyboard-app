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
  Switch,
} from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import { useExpenses } from '../../hooks/useExpenses';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../lib/formatters';
import type { ExpenseRecord } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPENSE_ACCENT = '#F87171';

const CATEGORIES = [
  'Equipment', 'Software', 'Travel', 'Outsourcing',
  'Office', 'Education', 'Marketing', 'Other',
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
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
    <View className="w-full">
      <Text
        className="text-text-secondary text-sm mb-2"
        style={{ fontFamily: 'Inter_500Medium' }}
      >
        {label}
      </Text>
      <TouchableOpacity
        className="bg-surface border border-border rounded-xl px-4 py-4 flex-row items-center justify-between"
        onPress={() => setOpen(true)}
      >
        <Text
          className="text-text-primary text-base"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {value}
        </Text>
        <Text className="text-text-secondary text-base">▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              className="bg-surface border border-border rounded-2xl overflow-hidden"
              style={{ width: 320 }}
            >
              <Text
                className="text-text-secondary text-xs px-4 pt-4 pb-2"
                style={{ fontFamily: 'Inter_500Medium' }}
              >
                {label.toUpperCase()}
              </Text>
              {options.map((opt, i) => (
                <TouchableOpacity
                  key={opt}
                  className="px-4 py-3 flex-row items-center"
                  style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#262626' }}
                  onPress={() => { onChange(opt); setOpen(false); }}
                >
                  {opt === value && (
                    <View style={{ width: 4, height: 16, backgroundColor: EXPENSE_ACCENT, borderRadius: 2, marginRight: 12 }} />
                  )}
                  {opt !== value && <View style={{ width: 16 }} />}
                  <Text
                    style={{
                      fontFamily: opt === value ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      color: opt === value ? EXPENSE_ACCENT : '#FFFFFF',
                      fontSize: 16,
                    }}
                  >
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

// ─── Expense Row ─────────────────────────────────────────────────────────────

function ExpenseRow({ item, onPress }: { item: ExpenseRecord; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center py-4"
      style={{ borderBottomWidth: 1, borderBottomColor: '#262626' }}
      activeOpacity={0.7}
    >
      <View className="flex-1 mr-4">
        <Text
          className="text-text-primary text-base"
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          {item.description}
        </Text>
        <Text
          className="text-text-secondary text-sm mt-0.5"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {item.category} · {item.date}
          {item.is_recurring ? ' · Recurring' : ''}
        </Text>
      </View>
      <Text
        style={{ fontFamily: 'Inter_700Bold', color: EXPENSE_ACCENT, fontSize: 18 }}
      >
        {formatCurrency(Number(item.amount))}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const { expenses, expensesLoading } = useAppStore();
  const { fetchExpenses, addExpense, updateExpense, deleteExpense } = useExpenses();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Equipment');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [isRecurring, setIsRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    console.log('[Expenses] mounted');
    fetchExpenses();
  }, []);

  function openAddModal() {
    setEditingRecord(null);
    setAmount('');
    setCategory('Equipment');
    setDescription('');
    setDate(todayISO());
    setIsRecurring(false);
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(record: ExpenseRecord) {
    setEditingRecord(record);
    setAmount(String(record.amount));
    setCategory(record.category);
    setDescription(record.description);
    setDate(record.date);
    setIsRecurring(record.is_recurring);
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFormError('');
    setEditingRecord(null);
  }

  async function handleSave() {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setFormError('Enter a valid amount greater than 0');
      return;
    }
    if (!description.trim()) {
      setFormError('Description is required');
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('Date must be in YYYY-MM-DD format');
      return;
    }
    setSaving(true);
    if (editingRecord) {
      const { error } = await updateExpense(editingRecord.id, {
        amount: parsed,
        category,
        description: description.trim(),
        date,
        is_recurring: isRecurring,
      });
      setSaving(false);
      if (error) {
        setFormError(error.message);
      } else {
        closeModal();
      }
    } else {
      const { error } = await addExpense({
        amount: parsed,
        currency: 'USD',
        category,
        description: description.trim(),
        date,
        is_recurring: isRecurring,
      });
      setSaving(false);
      if (error) {
        setFormError(error.message);
      } else {
        closeModal();
      }
    }
  }

  async function handleDelete() {
    if (!editingRecord) return;
    const recordId = editingRecord.id;
    const recordLabel = `${editingRecord.description} · ${formatCurrency(Number(editingRecord.amount))}`;

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      const confirmed = (window as any).confirm(`Delete this expense?\n${recordLabel}`);
      if (!confirmed) return;
      setDeleting(true);
      const { error } = await deleteExpense(recordId);
      setDeleting(false);
      if (error) {
        setFormError(error.message);
      } else {
        closeModal();
        fetchExpenses();
      }
    } else {
      Alert.alert(
        'Delete this expense?',
        recordLabel,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleting(true);
              const { error } = await deleteExpense(recordId);
              setDeleting(false);
              if (error) {
                setFormError(error.message);
              } else {
                closeModal();
                fetchExpenses();
              }
            },
          },
        ]
      );
    }
  }

  const total = expenses.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-14 pb-4">
        <View>
          <Text
            className="text-text-primary text-2xl"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Expenses
          </Text>
          {expenses.length > 0 && (
            <Text
              style={{ color: EXPENSE_ACCENT, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 2 }}
            >
              {formatCurrency(total)} total
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={{ width: 40, height: 40, backgroundColor: EXPENSE_ACCENT, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          onPress={openAddModal}
        >
          <Text
            className="text-background text-2xl font-bold"
            style={{ lineHeight: 28, marginTop: -2 }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {expensesLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={EXPENSE_ACCENT} size="large" />
        </View>
      ) : expenses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <TouchableOpacity
            style={{ width: 64, height: 64, backgroundColor: EXPENSE_ACCENT, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
            onPress={openAddModal}
          >
            <Text
              className="text-background text-3xl font-bold"
              style={{ lineHeight: 36, marginTop: -2 }}
            >
              +
            </Text>
          </TouchableOpacity>
          <Text
            className="text-text-secondary text-base text-center"
            style={{ fontFamily: 'Inter_400Regular', lineHeight: 24 }}
          >
            No expenses tracked yet.{'\n'}Tap + to add your first expense.
          </Text>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseRow item={item} onPress={() => openEditModal(item)} />
          )}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <View
              className="bg-background border-t border-border"
              style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
              >
                {/* Modal header */}
                <View className="flex-row items-center justify-between mb-6">
                  <Text
                    className="text-text-primary text-xl"
                    style={{ fontFamily: 'Inter_700Bold' }}
                  >
                    {editingRecord ? 'Edit Expense' : 'Add Expense'}
                  </Text>
                  <TouchableOpacity onPress={closeModal} className="p-2">
                    <Text
                      className="text-text-secondary text-xl"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="gap-4">
                  {/* Amount */}
                  <Input
                    label="Amount *"
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />

                  {/* Category */}
                  <PickerSelect
                    label="Category"
                    value={category}
                    options={CATEGORIES}
                    onChange={setCategory}
                  />

                  {/* Description */}
                  <Input
                    label="Description *"
                    placeholder="e.g. Adobe Creative Cloud"
                    value={description}
                    onChangeText={setDescription}
                  />

                  {/* Date */}
                  <Input
                    label="Date"
                    placeholder="YYYY-MM-DD"
                    value={date}
                    onChangeText={setDate}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  {/* Recurring toggle */}
                  <View className="flex-row items-center justify-between py-2">
                    <Text
                      className="text-text-secondary text-sm"
                      style={{ fontFamily: 'Inter_500Medium' }}
                    >
                      Recurring
                    </Text>
                    <Switch
                      value={isRecurring}
                      onValueChange={setIsRecurring}
                      trackColor={{ false: '#262626', true: EXPENSE_ACCENT }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {formError ? (
                    <Text
                      className="text-red-500 text-sm"
                      style={{ fontFamily: 'Inter_400Regular' }}
                    >
                      {formError}
                    </Text>
                  ) : null}

                  <Button
                    title="Save"
                    onPress={handleSave}
                    loading={saving}
                    className="mt-2"
                  />

                  {editingRecord && (
                    <TouchableOpacity
                      onPress={handleDelete}
                      disabled={deleting}
                      className="items-center py-4"
                    >
                      <Text
                        style={{ fontFamily: 'Inter_600SemiBold', color: deleting ? '#7f1d1d' : '#ef4444', fontSize: 15 }}
                      >
                        {deleting ? 'Deleting…' : 'Delete Expense'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <Button title="Cancel" variant="ghost" onPress={closeModal} />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
