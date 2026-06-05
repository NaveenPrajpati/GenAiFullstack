import { MealPlannerApis } from '@/services/api';
import axios from 'axios';
import { useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Spinner from '../components/ui/Spinner';
import { useStreaming } from '../hooks/useStreaming';

export default function Mealplanner() {
  const [inputText, setInputText] = useState('');
  const { text, loading, error, stream, stop, reset } = useStreaming();

  const handleSubmit = () => {
    if (!inputText.trim() || loading) return;
    stream('/meal-planner/query', { text: inputText });
  };
  const handleAsk = () => {
    console.log(MealPlannerApis.query);

    axios
      .post(MealPlannerApis.query, { text: inputText })
      .then((res) => {
        console.log(res.data);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const handleClear = () => {
    setInputText('');
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
        <Text className="text-xl font-bold text-gray-900">📝 Summarizer</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Paste your text below and get a concise summary
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <TextInput
            className="text-sm leading-relaxed text-gray-800"
            style={{ minHeight: 128, textAlignVertical: 'top' }}
            placeholder="Paste your article, report, or meeting notes here..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            value={inputText}
            onChangeText={setInputText}
          />
          <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3">
            <Text className="text-xs text-gray-400">
              {inputText.length.toLocaleString()} characters
            </Text>
            <View className="flex-row gap-2">
              {inputText.length > 0 && (
                <TouchableOpacity
                  onPress={handleClear}
                  className="rounded-lg bg-gray-100 p-4"
                  activeOpacity={0.7}>
                  <Text className="text-sm text-gray-600">Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleAsk}
                disabled={!inputText.trim() && !loading}
                className={`rounded-lg p-4 ${loading ? 'bg-red-500' : 'bg-violet-600'} ${!inputText.trim() && !loading ? 'opacity-50' : ''}`}
                activeOpacity={0.8}>
                {loading ? (
                  <View className="flex-row items-center gap-2">
                    <Spinner size="small" color="white" />
                    <Text className="text-xl font-medium text-white">Stop</Text>
                  </View>
                ) : (
                  <Text className="text-xl font-medium text-white">Ask</Text>
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
              <Text className="text-sm font-semibold text-gray-700">Summary</Text>
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
                <Spinner size="small" color="#7c3aed" />
                <Text className="text-sm text-gray-500">Summarizing...</Text>
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
