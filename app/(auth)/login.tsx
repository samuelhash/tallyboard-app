import React, { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { signInWithEmail, signInWithGoogle } from '../../lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  function validate() {
    const newErrors: typeof errors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignIn() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const { error } = await signInWithEmail(email, password);
    setLoading(false);
    if (error) {
      setErrors({ general: error.message });
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      setErrors({ general: error.message });
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: '100%', maxWidth: 400, paddingHorizontal: 24 }}>
          {/* Logo / Brand */}
          <View className="mb-10">
            <Text className="text-accent text-4xl font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
              TallyBoard
            </Text>
            <Text className="text-text-secondary text-base mt-2" style={{ fontFamily: 'Inter_400Regular' }}>
              Your creator finance dashboard
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
            />
            <Input
              label="Password"
              placeholder="Min. 8 characters"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
            />

            {errors.general && (
              <Text className="text-red-500 text-sm text-center">{errors.general}</Text>
            )}

            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={loading}
              className="mt-2"
            />

            {/* Divider */}
            <View className="flex-row items-center gap-3 my-2">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
                or
              </Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <Button
              title="Continue with Google"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              variant="outline"
            />
          </View>

          {/* Sign up link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text className="text-accent font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Sign up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
