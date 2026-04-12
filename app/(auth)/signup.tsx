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
import { signUpWithEmail, signInWithGoogle } from '../../lib/auth';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [successMessage, setSuccessMessage] = useState('');

  function validate() {
    const newErrors: typeof errors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    const { data, error } = await signUpWithEmail(email, password);
    setLoading(false);
    if (error) {
      setErrors({ general: error.message });
    } else if (data.session === null) {
      setSuccessMessage('Check your email to confirm your account.');
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
              Start tracking your creator income
            </Text>
          </View>

          {successMessage ? (
            <View className="bg-surface border border-accent rounded-xl p-4 mb-6">
              <Text className="text-accent text-center" style={{ fontFamily: 'Inter_400Regular' }}>
                {successMessage}
              </Text>
            </View>
          ) : (
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
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
              />
              <Input
                label="Confirm Password"
                placeholder="Repeat your password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
              />

              {errors.general && (
                <Text className="text-red-500 text-sm text-center">{errors.general}</Text>
              )}

              <Button
                title="Create Account"
                onPress={handleSignUp}
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
          )}

          {/* Login link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-text-secondary" style={{ fontFamily: 'Inter_400Regular' }}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-accent font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                  Sign in
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
