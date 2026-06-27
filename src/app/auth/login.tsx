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

export default function LoginScreen() {
  const router = useRouter();
  const { login, createGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError('');
    try {
      await createGuest();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create guest session');
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-3xl text-white">🤖</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Welcome back</Text>
          <Text className="mb-8 text-base text-gray-500">Sign in to your AI Toolkit account</Text>

          <View className="w-full max-w-sm">
            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 p-3">
                <Text className="text-sm text-red-600">{error}</Text>
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

            <View className="mb-2">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Password</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/auth/forgot-password')}
              className="mb-6 self-end"
              activeOpacity={0.7}>
              <Text className="text-sm font-medium text-indigo-600">Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading || guestLoading}
              className="mb-3 items-center rounded-xl bg-indigo-600 py-3.5"
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGuest}
              disabled={loading || guestLoading}
              className="mb-6 items-center rounded-xl border border-gray-200 bg-white py-3.5"
              activeOpacity={0.8}>
              {guestLoading ? (
                <ActivityIndicator color="#6366f1" />
              ) : (
                <Text className="text-base font-medium text-gray-700">Continue as Guest</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-gray-500">Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.replace('/auth/signup')}>
                <Text className="text-sm font-semibold text-indigo-600"> Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
