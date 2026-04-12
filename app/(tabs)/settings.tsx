import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { signOut } from '../../lib/auth';
import { useAppStore } from '../../store/useAppStore';

export default function SettingsScreen() {
  const { user } = useAppStore();
  const [loading, setLoading] = React.useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    setLoading(false);
  }

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
        loading={loading}
      />
    </ScrollView>
  );
}
