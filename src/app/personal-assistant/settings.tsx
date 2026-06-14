import Spinner from '@/components/ui/Spinner';
import { usePersonalAssistantStore } from '@/features/personal-assistant/store';
import type { PendingApproval } from '@/features/personal-assistant/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

function approvalTitle(a: PendingApproval): string {
  if (a.title) return a.title;
  if (a.tasks?.length) return `Delete ${a.tasks.length} task(s)`;
  if (a.type) return a.type.replace(/_/g, ' ');
  return 'Pending item';
}

export default function PASettingsScreen() {
  const router = useRouter();
  const {
    digestEnabled,
    digestToggling,
    toggleDigest,
    approvals,
    approvalsLoading,
    loadApprovals,
  } = usePersonalAssistantStore();

  useEffect(() => {
    loadApprovals();
  }, []);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-2">
          <Text className="text-sm text-violet-600">← Assistant</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Settings</Text>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Daily digest */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-semibold text-gray-900">Daily task digest</Text>
              <Text className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Get a summary of your tasks every day at 8am.
              </Text>
            </View>
            {digestToggling ? (
              <Spinner size="small" />
            ) : (
              <Switch
                value={digestEnabled}
                onValueChange={toggleDigest}
                trackColor={{ true: '#7c3aed', false: '#e5e7eb' }}
                thumbColor="#ffffff"
                accessibilityLabel="Toggle daily task digest"
              />
            )}
          </View>
        </View>

        {/* Notifications / Approvals inbox */}
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-900">Notifications & approvals</Text>
            <TouchableOpacity onPress={loadApprovals}>
              <Text className="text-xs font-medium text-violet-600">Refresh</Text>
            </TouchableOpacity>
          </View>

          {approvalsLoading && approvals.length === 0 && (
            <View className="items-center py-6">
              <Spinner />
            </View>
          )}

          {!approvalsLoading && approvals.length === 0 && (
            <Text className="py-4 text-center text-sm text-gray-400">No pending items.</Text>
          )}

          {approvals.map((a, i) => (
            <View
              key={a.id ?? a.thread_id ?? i}
              className="mb-2 flex-row items-center justify-between border-b border-gray-100 pb-2">
              <View className="flex-1 pr-2">
                <Text className="text-sm text-gray-800 capitalize">{approvalTitle(a)}</Text>
                {!!a.created_at && (
                  <Text className="text-xs text-gray-400">
                    {new Date(a.created_at).toLocaleString()}
                  </Text>
                )}
              </View>
              {!!a.status && (
                <View className="rounded-full bg-gray-100 px-2 py-0.5">
                  <Text className="text-xs text-gray-600 capitalize">{a.status}</Text>
                </View>
              )}
            </View>
          ))}

          <Text className="mt-2 text-xs leading-relaxed text-gray-400">
            Delete approvals are confirmed inline in chat. This inbox shows their history along with
            daily digests.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
