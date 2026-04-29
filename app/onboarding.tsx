import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/useAppStore';
import { useIncome } from '../hooks/useIncome';
import { supabase } from '../lib/supabase';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  'YouTube', 'TikTok', 'Twitch', 'Patreon',
  'Stripe', 'PayPal', 'Brand Deal', 'Affiliate', 'Other',
];

const CATEGORIES = [
  'Total', 'General',
  'Ad Revenue', 'Sponsorship', 'Merch', 'Affiliate',
  'Tips', 'Subscription', 'Other',
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function getFirstName(user: any): string {
  const meta = user?.user_metadata;
  const fullName = meta?.full_name || meta?.name;
  if (fullName) return fullName.split(' ')[0];
  const email: string = user?.email ?? '';
  const prefix = email.split('@')[0];
  return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'there';
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
  onChange: (v: string) => void;
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
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
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
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {opt === value ? (
                    <View className="w-1 h-4 bg-accent rounded-full mr-3" />
                  ) : (
                    <View style={{ width: 16 }} />
                  )}
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

// ─── Progress Dots ───────────────────────────────────────────────────────────

function ProgressDots({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 }}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{
            height: 8,
            width: n === current ? 24 : 8,
            borderRadius: 4,
            backgroundColor: n === current ? '#34D399' : '#262626',
          }}
        />
      ))}
    </View>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function Step1({
  firstName,
  onNext,
  onSkip,
}: {
  firstName: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <View className="bg-surface border border-border rounded-2xl p-8">
      <Text
        style={{ fontFamily: 'Inter_700Bold', fontSize: 26, color: '#FFFFFF', marginBottom: 10 }}
      >
        Welcome to TallyBoard, {firstName}
      </Text>
      <Text
        style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#34D399', marginBottom: 16 }}
      >
        Let's get your finances set up in 60 seconds.
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          color: '#A3A3A3',
          lineHeight: 24,
          marginBottom: 32,
        }}
      >
        Track every dollar you earn, every expense you make, and never dread tax season again.
      </Text>
      <Button title="Let's go" onPress={onNext} className="mb-3" />
      <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#A3A3A3' }}>
          Skip onboarding
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 2: Add First Income ─────────────────────────────────────────────────

function Step2({
  amount, setAmount,
  platform, setPlatform,
  category, setCategory,
  date, setDate,
  description, setDescription,
  formError, setFormError,
  saving,
  onSave,
  onSkip,
}: {
  amount: string; setAmount: (v: string) => void;
  platform: string; setPlatform: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  date: string; setDate: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  formError: string; setFormError: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <View className="bg-surface border border-border rounded-2xl p-8">
      <Text
        style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: '#FFFFFF', marginBottom: 8 }}
      >
        Add your first income
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          color: '#A3A3A3',
          lineHeight: 24,
          marginBottom: 24,
        }}
      >
        Log a recent payment — a sponsorship, ad revenue, anything.
      </Text>

      <View style={{ gap: 16 }}>
        <Input
          label="Amount *"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={(v) => { setAmount(v); setFormError(''); }}
        />
        <PickerSelect
          label="Platform"
          value={platform}
          options={PLATFORMS}
          onChange={setPlatform}
        />
        <PickerSelect
          label="Category"
          value={category}
          options={CATEGORIES}
          onChange={setCategory}
        />
        <Input
          label="Date"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={setDate}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Description (optional)"
          placeholder="e.g. March ad revenue"
          value={description}
          onChangeText={setDescription}
        />

        {formError ? (
          <Text
            style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#ef4444' }}
          >
            {formError}
          </Text>
        ) : null}

        <Button title="Add Income" onPress={onSave} loading={saving} className="mt-2" />
        <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center', paddingVertical: 14 }}>
          <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 14, color: '#A3A3A3' }}>
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 3: CSV Import ───────────────────────────────────────────────────────

function Step3({
  onTryImport,
  onSkip,
  onDownloadSample,
}: {
  onTryImport: () => void;
  onSkip: () => void;
  onDownloadSample: () => void;
}) {
  return (
    <View className="bg-surface border border-border rounded-2xl p-8">
      <Text
        style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: '#FFFFFF', marginBottom: 8 }}
      >
        Or import months of data at once
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 15,
          color: '#A3A3A3',
          lineHeight: 24,
          marginBottom: 32,
        }}
      >
        Drop a CSV from YouTube, PayPal, or Stripe and we'll handle the rest.
      </Text>

      <Button title="Try CSV Import" onPress={onTryImport} className="mb-3" />
      <Button title="Skip to Dashboard" variant="outline" onPress={onSkip} />

      <TouchableOpacity
        onPress={onDownloadSample}
        style={{ alignItems: 'center', paddingVertical: 16, marginTop: 8 }}
      >
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: '#A3A3A3' }}>
          Download Sample CSV
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, setOnboarded } = useAppStore();
  const { addIncome } = useIncome();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  // Step 2 form state
  const [amount, setAmount] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [category, setCategory] = useState('Total');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const firstName = getFirstName(user);

  function goToStep(next: 1 | 2 | 3) {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }

  async function markOnboarded() {
    try {
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarded: true })
          .eq('id', user.id);
      }
      setOnboarded(true);
    } catch (e) {
      console.error('[Onboarding] Failed to mark onboarded:', e);
      setOnboarded(true); // Don't trap the user
    }
  }

  async function completeOnboarding() {
    await markOnboarded();
    router.replace('/(tabs)');
  }

  async function handleAddIncome() {
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
    setFormError('');
    try {
      const { error } = await addIncome({
        amount: parsed,
        platform,
        category,
        date,
        description: description.trim() || undefined,
      });
      if (error) {
        setFormError(error.message);
      } else {
        goToStep(3);
      }
    } catch (e) {
      setFormError('Failed to save. You can skip and add it later.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTryImport() {
    await markOnboarded();
    router.push('/import');
  }

  function downloadSampleCSV() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const rows = [
      'Date,Amount,Platform,Category,Description',
      '2024-03-15,500.00,YouTube,Ad Revenue,March ad revenue',
      '2024-03-20,1200.00,Brand Deal,Sponsorship,ACME Corp spring deal',
      '2024-02-28,89.50,PayPal,Affiliate,Link commissions',
      '2024-02-15,320.00,Patreon,Subscription,February patrons',
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tallyboard-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 bg-background">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            paddingVertical: 48,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 480 }}>
            <ProgressDots current={step} />

            <Animated.View style={{ opacity: fadeAnim }}>
              {step === 1 && (
                <Step1
                  firstName={firstName}
                  onNext={() => goToStep(2)}
                  onSkip={completeOnboarding}
                />
              )}
              {step === 2 && (
                <Step2
                  amount={amount}
                  setAmount={setAmount}
                  platform={platform}
                  setPlatform={setPlatform}
                  category={category}
                  setCategory={setCategory}
                  date={date}
                  setDate={setDate}
                  description={description}
                  setDescription={setDescription}
                  formError={formError}
                  setFormError={setFormError}
                  saving={saving}
                  onSave={handleAddIncome}
                  onSkip={() => goToStep(3)}
                />
              )}
              {step === 3 && (
                <Step3
                  onTryImport={handleTryImport}
                  onSkip={completeOnboarding}
                  onDownloadSample={downloadSampleCSV}
                />
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
