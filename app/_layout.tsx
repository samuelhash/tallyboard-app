import '../global.css';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Platform, View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

// Inject favicon + title for web (bypasses Metro MIME issues and Safari SVG limitations)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'TallyBoard';
  const svg = encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<rect width="32" height="32" rx="6" fill="#0A0A0A"/>' +
    '<rect x="4" y="20" width="6" height="8" rx="1" fill="#34D399"/>' +
    '<rect x="13" y="13" width="6" height="15" rx="1" fill="#34D399"/>' +
    '<rect x="22" y="6" width="6" height="22" rx="1" fill="#34D399"/>' +
    '</svg>'
  );
  document.querySelectorAll('link[rel*="icon"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = `data:image/svg+xml,${svg}`;
  document.head.appendChild(link);
}

async function fetchOnboardedStatus(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('id', userId)
      .single();
    // null means old user created before the column existed — treat as onboarded
    return data?.onboarded ?? true;
  } catch {
    return true; // don't trap existing users on error
  }
}

export default function RootLayout() {
  const { setSession } = useAppStore();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [authReady, setAuthReady] = useState(false);
  const [session, setLocalSession] = useState<Session | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      let ob: boolean | null = null;
      if (session) {
        ob = await fetchOnboardedStatus(session.user.id);
        if (!mounted) return;
      }
      setSession(session); // keep store in sync for other screens
      setLocalSession(session);
      setOnboarded(ob);
      setAuthReady(true);
    });

    // Listen for auth changes after initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AUTH STATE CHANGED', event, session);
        if (!mounted || event === 'INITIAL_SESSION') return;
        let ob: boolean | null = null;
        if (session) {
          ob = await fetchOnboardedStatus(session.user.id);
          if (!mounted) return;
        }
        setSession(session);
        setLocalSession(session);
        setOnboarded(ob);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Single navigation effect — fires when auth state is determined or changes
  useEffect(() => {
    if (!authReady || !fontsLoaded) return;
    if (!session) {
      router.replace('/(auth)/login');
    } else if (onboarded === false) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [authReady, fontsLoaded, session, onboarded]);

  if (!fontsLoaded || !authReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#34D399" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      <Stack.Screen name="reports" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
