import { useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/store/learningStore';
import Spinner from '@/components/ui/Spinner';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DigestsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { digests, digestsLoading, fetchDigests } = useLearningStore();

  useEffect(() => {
    if (token) fetchDigests(token);
  }, [token]);

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Daily Digests</Text>
        <Text className="mt-1 text-sm text-gray-500">AI-curated summaries of your topics</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {digestsLoading && (
          <View className="items-center py-12">
            <Spinner size="large" />
            <Text className="mt-3 text-sm text-gray-400">Loading digests…</Text>
          </View>
        )}

        {!digestsLoading && digests.length === 0 && (
          <View className="items-center rounded-xl border border-dashed border-gray-300 bg-white p-10">
            <Text className="mb-2 text-5xl">📰</Text>
            <Text className="mb-1 text-base font-semibold text-gray-900">No digests yet</Text>
            <Text className="mb-4 text-center text-sm leading-relaxed text-gray-500">
              Enable daily digests in Settings to receive AI-curated learning summaries.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/learning/settings')}
              className="rounded-lg bg-violet-600 px-5 py-3"
              activeOpacity={0.8}>
              <Text className="text-sm font-medium text-white">Open Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        {digests.map((digest) => {
          const date = new Date(digest.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          return (
            <View
              key={digest._id}
              className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
              <View className="mb-2 flex-row items-start justify-between">
                <Text className="flex-1 pr-2 text-base font-semibold text-gray-900">
                  {digest.topicTitle}
                </Text>
                <Text className="text-xs text-gray-400">{date}</Text>
              </View>

              {digest.bullets.map((b, i) => (
                <Text key={i} className="mb-1 text-sm leading-relaxed text-gray-600">
                  • {b}
                </Text>
              ))}

              {digest.resources.length > 0 && (
                <View className="mt-3 border-t border-gray-100 pt-3">
                  <Text className="mb-1.5 text-xs font-semibold text-gray-500">Resources</Text>
                  {digest.resources.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => Linking.openURL(r.url).catch(() => {})}
                      className="mb-1">
                      <Text className="text-sm text-violet-600 underline">{r.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
