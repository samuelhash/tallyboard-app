import '../global.css';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Platform, View, ActivityIndicator } from 'react-native';
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
  // Remove any existing favicon links first
  document.querySelectorAll('link[rel*="icon"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = `data:image/svg+xml,${svg}`;
  document.head.appendChild(link);
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAppStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#34D399" size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { setSession, setLoading } = useAppStore();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // Get initial session and route accordingly
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        router.replace('/(tabs)');
      }
    });

    // Listen for auth changes and drive navigation directly
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === 'SIGNED_IN') {
          router.replace('/(tabs)');
        } else if (event === 'SIGNED_OUT') {
          router.replace('/(auth)/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#34D399" size="large" />
      </View>
    );
  }

  return (
    <AuthGuard>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack>
    </AuthGuard>
  );
}
