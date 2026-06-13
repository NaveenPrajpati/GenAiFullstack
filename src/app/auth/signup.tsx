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

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password || !confirm) {
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
      await signup(name.trim(), email.trim(), password);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to create account');
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
            <Text className="text-3xl text-white">🤖</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Create account</Text>
          <Text className="mb-8 text-base text-gray-500">Join AI Toolkit for free</Text>

          <View className="w-full max-w-sm">
            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 p-3">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Name</Text>
              <TextInput
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                placeholder="john"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="default"
                value={name}
                onChangeText={setName}
              />
            </View>
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

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Password</Text>
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
                onSubmitEditing={handleSignup}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={handleSignup}
              disabled={loading}
              className="mb-6 items-center rounded-xl bg-indigo-600 py-3.5"
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Create Account</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-1">
              <Text className="text-sm text-gray-500">Already have an account?</Text>
              <TouchableOpacity onPress={() => router.replace('/auth/login')}>
                <Text className="text-sm font-semibold text-indigo-600"> Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
