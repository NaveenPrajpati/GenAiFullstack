import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useState } from 'react';
import { useStreaming } from '../hooks/useStreaming';
import Spinner from '../components/ui/Spinner';

export default function WebScraperScreen() {
  const [url, setUrl] = useState('');
  const { text, loading, error, stream, stop, reset } = useStreaming();

  const handleSubmit = () => {
    if (!url.trim() || loading) return;
    stream('/webscraping/scrap/stream', { url: url.trim() });
  };

  const handleClear = () => {
    setUrl('');
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
        <Text className="text-xl font-bold text-gray-900">🌐 Web Scraper</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Enter a URL to extract and summarize its content
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <TextInput
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-800"
            placeholder="https://example.com/article"
            placeholderTextColor="#9ca3af"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View className="mt-3 flex-row justify-end gap-2">
            {url.length > 0 && (
              <TouchableOpacity
                onPress={handleClear}
                className="rounded-lg bg-gray-100 px-3 py-1.5"
                activeOpacity={0.7}>
                <Text className="text-sm text-gray-600">Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={loading ? stop : handleSubmit}
              disabled={!url.trim() && !loading}
              className={`rounded-lg px-4 py-1.5 ${loading ? 'bg-red-500' : 'bg-emerald-600'} ${!url.trim() && !loading ? 'opacity-50' : ''}`}
              activeOpacity={0.8}>
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <Spinner size="small" color="white" />
                  <Text className="text-sm font-medium text-white">Stop</Text>
                </View>
              ) : (
                <Text className="text-sm font-medium text-white">Scrape & Summarize</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {loading && !text ? (
          <View className="mb-4 flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <Spinner size="small" color="#059669" />
            <Text className="text-sm text-gray-500">Scraping and processing...</Text>
          </View>
        ) : null}

        {text ? (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">Summary</Text>
              {!loading && (
                <TouchableOpacity
                  onPress={handleCopy}
                  className="rounded-lg bg-gray-100 px-3 py-1"
                  activeOpacity={0.7}>
                  <Text className="text-xs text-gray-600">Copy</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text className="text-sm leading-relaxed text-gray-800">
              {text}
              {loading ? '▌' : ''}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
