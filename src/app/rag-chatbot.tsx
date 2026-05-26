import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { DocumentPickerAsset } from 'expo-document-picker';
import { BASE_URL, RagApis } from '../services/api';
import Spinner from '../components/ui/Spinner';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function RagChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [asset, setAsset] = useState<DocumentPickerAsset | null>(null);

  async function getAllIngestedFiles() {
    axios.get(`${BASE_URL}${RagApis.getallFiles}`).then((res) => {
      res.data;
    });
  }

  useEffect(() => {
    getAllIngestedFiles();
    if (asset) {
      handleUpload(asset, 'file');
    }
  }, [asset]);

  const handleUpload = async (asset: DocumentPickerAsset | null, action: 'url' | 'file') => {
    if (isUploading) return;

    if (action === 'url' && !inputUrl.trim()) {
      setUploadStatus('✗ Please enter a valid URL');
      return;
    }

    if (action === 'file' && !asset) {
      setUploadStatus('✗ Please select a file');
      return;
    }

    setIsUploading(true);
    setUploadStatus(action === 'url' ? 'Adding URL...' : 'Uploading file...');

    const formData = new FormData();

    try {
      if (action === 'file' && asset) {
        if (Platform.OS === 'web') {
          const blob = await fetch(asset.uri).then((r) => r.blob());
          formData.append('file', blob, asset.name);
        } else {
          formData.append('file', {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType ?? 'application/octet-stream',
          } as any);
        }
      }

      formData.append(
        'data',
        JSON.stringify({
          url: inputUrl.trim(),
          type: action,
        })
      );

      const query = new URLSearchParams({
        page: '2',
        isAdming: 'false',
      }).toString();

      const response = await fetch(`${BASE_URL}/rag/ingest/${action}?${query}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }

      setUploadStatus(
        action === 'url' ? '✓ URL added successfully' : `✓ "${asset?.name}" uploaded successfully`
      );

      if (action === 'url') {
        setInputUrl('');
      }
    } catch (err: unknown) {
      setUploadStatus(`✗ ${err instanceof Error ? err.message : 'Something went wrong'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;
    const userMessage = inputText.trim();
    setInputText('');
    const updated: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(updated);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await fetch(`${BASE_URL}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, evaluate: true }),
      });
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const data = await response.json();
      setMessages([
        ...updated,
        { role: 'assistant', content: data.answer ?? data.response ?? JSON.stringify(data) },
      ]);
    } catch (err: unknown) {
      setMessages([
        ...updated,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      setAsset(result.assets[0]);
    } catch (error) {
      setUploadStatus('✗ Failed to pick file');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <View className="flex-1 bg-gray-50">
        <View className="border-b border-gray-200 bg-white px-5 pt-6 pb-4 shadow-sm">
          <Text className="text-2xl font-bold text-gray-900">RAG Chatbot</Text>
          <Text className="mt-1 text-sm text-gray-500">
            Upload a document and ask questions about it
          </Text>
          <TouchableOpacity
            onPress={handlePick}
            disabled={isUploading}
            className={`mt-4 flex-row items-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-3 ${isUploading ? 'opacity-50' : ''}`}
            activeOpacity={0.7}>
            {isUploading && <Spinner size="small" color="#3b82f6" />}
            <Text className="text-sm font-semibold text-white">
              {isUploading ? 'Uploading...' : '📎 Upload PDF / Text'}
            </Text>
          </TouchableOpacity>
          {uploadStatus ? (
            <Text
              className={`mt-1.5 text-xs ${uploadStatus.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {uploadStatus}
            </Text>
          ) : null}
          <Text className="my-3 text-center text-sm text-gray-400">OR</Text>
          <View className="flex-row items-center gap-x-2 rounded-2xl border border-gray-200 bg-gray-50 p-2">
            <TextInput
              onChangeText={setInputUrl}
              multiline
              numberOfLines={2}
              placeholder="add url"
              className="flex-1 px-3 py-2 text-sm text-gray-800 outline-none"
              placeholderTextColor="#9ca3af"
              keyboardType="url"
              autoCapitalize="none"
              value={inputUrl}
            />
            <TouchableOpacity
              onPress={() => handleUpload(null, 'url')}
              disabled={isUploading || !inputUrl.trim()}
              className={`rounded-xl px-4 py-3 ${inputUrl.trim() ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <Text className="font-medium text-white">Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4 py-5"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <View className="items-center justify-center rounded-3xl bg-white py-16 shadow-sm">
              <Text className="mb-4 text-5xl">💬</Text>
              <Text className="text-center text-sm text-gray-500">
                {Platform.OS === 'web'
                  ? 'Upload a document above, then start chatting!'
                  : 'Start chatting to ask questions'}
              </Text>
            </View>
          ) : (
            messages.map((msg, idx) => (
              <View
                key={idx}
                className={`mb-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                style={{
                  maxWidth: '80%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                <View
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-blue-600'
                      : 'rounded-bl-sm border border-gray-200 bg-white'
                  }`}>
                  <Text
                    className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))
          )}
          {loading && (
            <View style={{ alignSelf: 'flex-start' }} className="mb-3">
              <View className="flex-row items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3">
                <Spinner size="small" color="#3b82f6" />
                <Text className="text-sm text-gray-500">Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View className="border-t border-gray-100 bg-white px-4 pt-3 pb-6">
          <View className="flex-row items-end gap-2">
            <TextInput
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none"
              style={{ maxHeight: 96 }}
              placeholder="Ask a question..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || loading}
              className={`h-12 w-12 items-center justify-center rounded-2xl ${inputText.trim() && !loading ? 'bg-blue-600' : 'bg-gray-200'}`}
              activeOpacity={0.8}>
              <Text
                className={`text-lg ${inputText.trim() && !loading ? 'text-white' : 'text-gray-400'}`}>
                ➜
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
