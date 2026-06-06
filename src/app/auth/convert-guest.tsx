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

export default function ConvertGuestScreen() {
  const router = useRouter();
  const { user, convertGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConvert() {
    if (!email.trim() || !password || !confirm) {
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
      await convertGuest(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to upgrade account');
    } finally {
      setLoading(false);
    }
  }

  if (!user?.is_guest) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="mb-4 text-lg font-semibold text-gray-900">Already registered</Text>
        <Text className="mb-6 text-center text-gray-500">
          Your account is already a full account.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          className="rounded-xl bg-indigo-600 px-6 py-3">
          <Text className="font-semibold text-white">Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500">
            <Text className="text-3xl text-white">⭐</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">Upgrade account</Text>
          <Text className="mb-2 text-base text-gray-500">
            Save your progress by creating a full account
          </Text>
          <View className="mb-8 rounded-lg bg-amber-50 px-4 py-2">
            <Text className="text-sm text-amber-700">
              Guest session · expires in 24 h
            </Text>
          </View>

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
                onSubmitEditing={handleConvert}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              onPress={handleConvert}
              disabled={loading}
              className="mb-3 items-center rounded-xl bg-emerald-500 py-3.5"
              activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">Upgrade to Full Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              className="items-center py-2"
              activeOpacity={0.7}>
              <Text className="text-sm text-gray-500">Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
