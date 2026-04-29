import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

export default function SettingsScreen() {
  const { user } = useAppStore();
  const router = useRouter();
  const handleSignOut = async () => {
    alert('Signing out...');
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-12">
      <Text
        className="text-text-primary text-2xl mb-8"
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        Settings
      </Text>

      <Card className="mb-4">
        <Text
          className="text-text-secondary text-sm mb-2"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          ACCOUNT
        </Text>
        <Text
          className="text-text-primary text-base"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          {user?.email ?? '—'}
        </Text>
      </Card>

      <Card className="mb-4">
        <Text
          className="text-text-secondary text-sm mb-3"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          REPORTS
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/reports')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 4,
          }}
        >
          <View>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_500Medium' }}>
              PDF Reports
            </Text>
            <Text style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
              Generate tax-ready P&amp;L reports
            </Text>
          </View>
          <Text style={{ color: '#34D399', fontSize: 18 }}>→</Text>
        </TouchableOpacity>
      </Card>

      <Card className="mb-8">
        <Text
          className="text-text-secondary text-sm mb-2"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          PREFERENCES
        </Text>
        <Text
          className="text-accent text-lg"
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          Coming soon
        </Text>
        <Text
          className="text-text-secondary text-sm mt-1"
          style={{ fontFamily: 'Inter_400Regular' }}
        >
          Currency, fiscal year, and notification settings.
        </Text>
      </Card>

      <Button
        title="Sign Out"
        variant="outline"
        onPress={handleSignOut}
      />
    </ScrollView>
  );
}
