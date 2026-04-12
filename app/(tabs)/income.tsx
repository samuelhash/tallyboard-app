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
import { useRouter } from 'expo-router';
import { useAppStore } from '../../store/useAppStore';
import { useIncome } from '../../hooks/useIncome';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../lib/formatters';
import type { IncomeRecord } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  'YouTube', 'TikTok', 'Twitch', 'Patreon',
  'Stripe', 'PayPal', 'Brand Deal', 'Affiliate', 'Other',
];

const CATEGORIES = [
  'Ad Revenue', 'Sponsorship', 'Merch', 'Affiliate',
  'Tips', 'Subscription', 'Other',
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
                    <View className="w-1 h-4 bg-accent rounded-full mr-3" />
                  )}
                  {opt !== value && <View style={{ width: 16 }} />}
                  <Text
                    className={opt === value ? 'text-accent text-base' : 'text-text-primary text-base'}
                    style={{ fontFamily: opt === value ? 'Inter_600SemiBold' : 'Inter_400Regular' }}
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

// ─── Income Row ──────────────────────────────────────────────────────────────

function IncomeRow({ item, onPress }: { item: IncomeRecord; onPress: () => void }) {
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
          {item.platform}
        </Text>
        <Text
          className="text-text-secondary text-sm mt-0.5"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {item.category} · {item.date}
        </Text>
        {item.description ? (
          <Text
            className="text-text-secondary text-xs mt-1"
            style={{ fontFamily: 'Inter_400Regular' }}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        ) : null}
      </View>
      <Text
        className="text-accent text-lg"
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        {formatCurrency(Number(item.amount))}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function IncomeScreen() {
  const router = useRouter();
  const { income, incomeLoading } = useAppStore();
  const { fetchIncome, addIncome, updateIncome, deleteIncome } = useIncome();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [category, setCategory] = useState('Ad Revenue');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchIncome();
  }, []);

  function openAddModal() {
    setEditingRecord(null);
    setAmount('');
    setPlatform('YouTube');
    setCategory('Ad Revenue');
    setDate(todayISO());
    setDescription('');
    setFormError('');
    setShowModal(true);
  }

  function openEditModal(record: IncomeRecord) {
    setEditingRecord(record);
    setAmount(String(record.amount));
    setPlatform(record.platform);
    setCategory(record.category);
    setDate(record.date);
    setDescription(record.description ?? '');
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
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError('Date must be in YYYY-MM-DD format');
      return;
    }
    setSaving(true);
    if (editingRecord) {
      const { error } = await updateIncome(editingRecord.id, {
        amount: parsed,
        platform,
        category,
        date,
        description: description.trim() || undefined,
      });
      setSaving(false);
      if (error) {
        setFormError(error.message);
      } else {
        closeModal();
      }
    } else {
      const { error } = await addIncome({
        amount: parsed,
        platform,
        category,
        date,
        description: description.trim() || undefined,
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
    const recordLabel = `${editingRecord.platform} · ${formatCurrency(Number(editingRecord.amount))}`;

    if (Platform.OS === 'web') {
      // Alert.alert callbacks are unreliable on web — use window.confirm directly
      // eslint-disable-next-line no-restricted-globals
      const confirmed = (window as any).confirm(`Delete this income record?\n${recordLabel}`);
      if (!confirmed) return;
      setDeleting(true);
      const { error } = await deleteIncome(recordId);
      setDeleting(false);
      if (error) {
        setFormError(error.message);
      } else {
        closeModal();
        fetchIncome();
      }
    } else {
      Alert.alert(
        'Delete this income record?',
        recordLabel,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleting(true);
              const { error } = await deleteIncome(recordId);
              setDeleting(false);
              if (error) {
                setFormError(error.message);
              } else {
                closeModal();
                fetchIncome();
              }
            },
          },
        ]
      );
    }
  }

  const total = income.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-14 pb-4">
        <View>
          <Text
            className="text-text-primary text-2xl"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Income
          </Text>
          {income.length > 0 && (
            <Text
              className="text-accent text-sm mt-0.5"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {formatCurrency(total)} total
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/import')}
            style={{
              height: 36,
              paddingHorizontal: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#262626',
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              Import CSV
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-10 h-10 bg-accent rounded-full items-center justify-center"
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
      </View>

      {/* Body */}
      {incomeLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#34D399" size="large" />
        </View>
      ) : income.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <TouchableOpacity
            className="w-16 h-16 bg-accent rounded-full items-center justify-center mb-5"
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
            No income tracked yet.{'\n'}Tap + to add your first entry.
          </Text>
        </View>
      ) : (
        <FlatList
          data={income}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <IncomeRow item={item} onPress={() => openEditModal(item)} />
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
                    {editingRecord ? 'Edit Income' : 'Add Income'}
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

                  {/* Platform */}
                  <PickerSelect
                    label="Platform"
                    value={platform}
                    options={PLATFORMS}
                    onChange={setPlatform}
                  />

                  {/* Category */}
                  <PickerSelect
                    label="Category"
                    value={category}
                    options={CATEGORIES}
                    onChange={setCategory}
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

                  {/* Description */}
                  <Input
                    label="Description (optional)"
                    placeholder="e.g. March ad revenue"
                    value={description}
                    onChangeText={setDescription}
                  />

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
                        {deleting ? 'Deleting…' : 'Delete Record'}
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
