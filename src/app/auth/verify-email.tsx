import { useAuth } from '@/context/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { verifyEmail, resendVerification, token } = useAuth();
  // Email is passed from signup / forgot flows: /auth/verify-email?email=...
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (!email.trim() || code.trim().length !== 6) {
      setError('Enter your email and the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await verifyEmail(email.trim(), code.trim());
      // Logged-in users land back in the app; otherwise send them to sign in.
      router.replace(token ? '/' : '/auth/login');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError('Enter your email first');
      return;
    }
    setResending(true);
    setError('');
    setInfo('');
    try {
      await resendVerification(email.trim());
      setInfo('If this email needs verification, a new code is on its way.');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not resend the code');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-3xl text-white">✉️</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Verify your email</Text>
          <Text className="mb-8 text-center text-base text-gray-500">
            Enter the 6-digit code we sent to your email
          </Text>

          <View className="w-full max-w-sm">
            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 p-3">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}
            {info ? (
              <View className="mb-4 rounded-xl bg-emerald-50 p-3">
                <Text className="text-sm text-emerald-700">{info}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Email</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="mb-6">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Verification code</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-lg tracking-[8px] text-gray-900"
                placeholder="000000"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                onSubmitEditing={handleVerify}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading}
              className="mb-4 items-center rounded-xl bg-indigo-600 py-3.5"
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Verify Email</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={resending}
              className="mb-6 items-center py-2"
              activeOpacity={0.7}>
              <Text className="text-sm font-semibold text-indigo-600">
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1">
              <TouchableOpacity onPress={() => router.replace(token ? '/' : '/auth/login')}>
                <Text className="text-sm font-semibold text-gray-500">
                  {token ? 'Skip for now' : 'Back to sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
