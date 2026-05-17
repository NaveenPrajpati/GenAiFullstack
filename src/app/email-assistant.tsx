import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useStreaming } from '@/hooks/useStreaming';

type Action = 'auto' | 'draft' | 'summarize' | 'fix-grammar' | 'improve';

const ACTIONS: { id: Action; emoji: string; label: string }[] = [
  { id: 'auto', emoji: '✨', label: 'Auto Detect' },
  { id: 'draft', emoji: '✏️', label: 'Draft Reply' },
  { id: 'summarize', emoji: '📋', label: 'Summarize' },
  { id: 'fix-grammar', emoji: '🔤', label: 'Fix Grammar' },
  { id: 'improve', emoji: '🚀', label: 'Improve' },
];

const PLACEHOLDERS: Record<Action, string> = {
  auto: 'Paste your email here. AI will automatically detect what you need...',
  draft: 'Paste the email you want to reply to...',
  summarize: 'Paste the email thread to summarize...',
  'fix-grammar': 'Paste your email to fix grammar and spelling...',
  improve: 'Paste your email to make it more professional...',
};

const BUTTON_LABELS: Record<Action, string> = {
  auto: 'Process',
  draft: 'Draft',
  summarize: 'Summarize',
  'fix-grammar': 'Fix',
  improve: 'Improve',
};

const RESULT_LABELS: Record<Action, string> = {
  auto: 'Result',
  draft: 'Draft Reply',
  summarize: 'Summary',
  'fix-grammar': 'Fixed Email',
  improve: 'Improved Email',
};

export default function EmailAssistantScreen() {
  const [emailText, setEmailText] = useState('');
  const [selectedAction, setSelectedAction] = useState<Action>('auto');
  const { text, loading, error, stream, stop, reset } = useStreaming();

  const handleSubmit = () => {
    if (!emailText.trim() || loading) return;
    stream('/email-assistant/process/stream', { email: emailText, action: selectedAction });
  };

  const handleClear = () => {
    setEmailText('');
    reset();
  };

  const handleCopy = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <Text className="text-xl font-bold text-gray-900">✉️ Email Assistant</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Draft, summarize, fix, or improve your emails
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              onPress={() => setSelectedAction(action.id)}
              className={`flex-row items-center gap-1.5 rounded-xl border px-3 py-2 ${
                selectedAction === action.id
                  ? 'border-sky-600 bg-sky-600'
                  : 'border-gray-200 bg-white'
              }`}
              activeOpacity={0.7}>
              <Text className="text-sm">{action.emoji}</Text>
              <Text
                className={`text-sm font-medium ${selectedAction === action.id ? 'text-white' : 'text-gray-700'}`}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <TextInput
            className="text-sm leading-relaxed text-gray-800"
            style={{ minHeight: 128, textAlignVertical: 'top' }}
            placeholder={PLACEHOLDERS[selectedAction]}
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            value={emailText}
            onChangeText={setEmailText}
          />
          <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
            <Text className="text-xs text-gray-400">
              {emailText.length.toLocaleString()} characters
            </Text>
            <View className="flex-row gap-2">
              {emailText.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  className="rounded-lg bg-gray-100 px-3 py-1.5"
                  activeOpacity={0.7}>
                  <Text className="text-sm text-gray-600">Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={loading ? stop : handleSubmit}
                disabled={!emailText.trim() && !loading}
                className={`rounded-lg px-4 py-1.5 ${loading ? 'bg-red-500' : 'bg-sky-600'} ${!emailText.trim() && !loading ? 'opacity-50' : ''}`}
                activeOpacity={0.8}>
                {loading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-sm font-medium text-white">Stop</Text>
                  </View>
                ) : (
                  <Text className="text-sm font-medium text-white">
                    {BUTTON_LABELS[selectedAction]}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {error ? (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {(text || loading) && (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">
                {RESULT_LABELS[selectedAction]}
              </Text>
              {text && !loading && (
                <TouchableOpacity
                  onPress={handleCopy}
                  className="rounded-lg bg-gray-100 px-3 py-1"
                  activeOpacity={0.7}>
                  <Text className="text-xs text-gray-600">Copy</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading && !text ? (
              <View className="flex-row items-center gap-2 py-2">
                <ActivityIndicator size="small" color="#0284c7" />
                <Text className="text-sm text-gray-500">Processing...</Text>
              </View>
            ) : (
              <Text className="text-sm leading-relaxed text-gray-800">
                {text}
                {loading ? '▌' : ''}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
