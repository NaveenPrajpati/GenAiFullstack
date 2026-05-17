import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef } from 'react';
import { BASE_URL } from '../services/api';
import Spinner from '../components/ui/Spinner';
import WebFileUpload from '../components/ui/WebFileUpload';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function RagChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleUpload = async (file: unknown) => {
    setIsUploading(true);
    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file as Blob);
    try {
      const response = await fetch(`${BASE_URL}/app1/ingest`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      setUploadStatus(`✓ "${(file as File).name}" uploaded successfully`);
    } catch (err: unknown) {
      setUploadStatus(`✗ Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      const response = await fetch(`${BASE_URL}/app1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage }),
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

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="flex-1 bg-gray-50">
        <View className="border-b border-gray-200 bg-white px-5 py-4">
          <Text className="text-xl font-bold text-gray-900">🤖 RAG Chatbot</Text>
          <Text className="mt-1 text-sm text-gray-500">
            Upload a document and ask questions about it
          </Text>
          <WebFileUpload
            onUpload={handleUpload}
            isUploading={isUploading}
            uploadStatus={uploadStatus}
          />
        </View>

        <ScrollView ref={scrollRef} className="flex-1 p-4">
          {messages.length === 0 ? (
            <View className="items-center justify-center py-16">
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

        <View className="border-t border-gray-200 bg-white px-4 py-3">
          <View className="flex-row items-end gap-2">
            <TextInput
              className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-800"
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
              className={`h-11 w-11 items-center justify-center rounded-xl ${inputText.trim() && !loading ? 'bg-blue-600' : 'bg-gray-200'}`}
              activeOpacity={0.8}>
              <Text
                className={`text-lg ${inputText.trim() && !loading ? 'text-white' : 'text-gray-400'}`}>
                ↑
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
