import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email.trim());
      setSent(true);
      // Hand off to the reset screen where the user enters the emailed code.
      router.push(`/auth/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-3xl text-white">🔑</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Forgot password</Text>
          <Text className="mb-8 text-center text-base text-gray-500">
            Enter your email and we'll send you a link to reset your password
          </Text>

          <View className="w-full max-w-sm">
            {sent ? (
              <View className="mb-6 rounded-xl bg-emerald-50 p-4">
                <Text className="text-sm text-emerald-700">
                  If an account exists for {email.trim()}, a reset link is on its way. Check your
                  inbox.
                </Text>
              </View>
            ) : (
              <>
                {error ? (
                  <View className="mb-4 rounded-xl bg-red-50 p-3">
                    <Text className="text-sm text-red-600">{error}</Text>
                  </View>
                ) : null}

                <View className="mb-6">
                  <Text className="mb-1.5 text-sm font-medium text-gray-700">Email</Text>
                  <TextInput
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    placeholder="you@example.com"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className="mb-6 items-center rounded-xl bg-indigo-600 py-3.5"
                  activeOpacity={0.8}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-gray-500">Remembered it?</Text>
              <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                <Text className="text-sm font-semibold text-indigo-600"> Back to sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
