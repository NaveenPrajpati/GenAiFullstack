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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  // Reset token arrives via the email deep link, e.g. /auth/reset-password?token=abc
  const { token: resetToken } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!resetToken) {
      setError('Missing or invalid reset link');
      return;
    }
    if (!password || !confirm) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(resetToken, password);
      setDone(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <View className="mb-6 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500">
          <Text className="text-3xl text-white">✓</Text>
        </View>
        <Text className="mb-2 text-2xl font-bold text-gray-900">Password updated</Text>
        <Text className="mb-8 text-center text-gray-500">
          You can now sign in with your new password.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/auth/login')}
          className="rounded-xl bg-indigo-600 px-6 py-3"
          activeOpacity={0.8}>
          <Text className="font-semibold text-white">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-3xl text-white">🔒</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Reset password</Text>
          <Text className="mb-8 text-center text-base text-gray-500">
            Choose a new password for your account
          </Text>

          <View className="w-full max-w-sm">
            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 p-3">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">New password</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                placeholder="Min. 8 characters"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View className="mb-6">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Confirm password</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={handleReset}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={handleReset}
              disabled={loading}
              className="mb-6 items-center rounded-xl bg-indigo-600 py-3.5"
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Reset Password</Text>
              )}
            </TouchableOpacity>

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
