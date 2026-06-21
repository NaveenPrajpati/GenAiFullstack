import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPickerAsset } from 'expo-document-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BASE_URL, RagApis } from '../services/api';

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
  const [ingestions, setIngestions] = useState<any[]>([]);
  const [selectedIngestions, setSelectedIngestions] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [allChats, setAllChats] = useState<any[]>([]);

  // UI state
  const [showSidebar, setShowSidebar] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 768; // tablet / web breakpoint

  async function getAllMessages(chatId: string) {
    axios.get(`${BASE_URL}${RagApis.getallMessages(chatId)}`).then((res) => {
      setMessages(res.data.data.messages);
    });
  }
  async function getAllChats() {
    axios.get(`${BASE_URL}${RagApis.getallChats}`).then((res) => {
      setAllChats(res.data.data);
    });
  }
  async function getAllIngestedFiles() {
    axios.get(`${BASE_URL}${RagApis.getallFiles}`).then((res) => {
      setIngestions(res.data.data);
    });
  }

  useEffect(() => {
    getAllIngestedFiles();
    getAllChats();
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

      formData.append('data', JSON.stringify({ url: inputUrl.trim(), type: action }));

      const query = new URLSearchParams({ page: '2', isAdming: 'false' }).toString();

      const response = await fetch(`${BASE_URL}/rag/ingest/${action}?${query}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed (${response.status})`);

      setUploadStatus(
        action === 'url' ? '✓ URL added successfully' : `✓ "${asset?.name}" uploaded successfully`
      );
      if (action === 'url') setInputUrl('');
      getAllIngestedFiles();
    } catch (err: unknown) {
      setUploadStatus(`✗ ${err instanceof Error ? err.message : 'Something went wrong'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendStream = async () => {
    if (!inputText.trim() || loading) return;
    const userMessage = inputText.trim();
    setInputText('');
    const updated: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(updated);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await fetch(`${BASE_URL}/rag/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          evaluate: true,
          ingestions: selectedIngestions,
        }),
      });
      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === 'token') {
            accumulated += event.token;
            setLoading(false);
            setMessages([...updated, { role: 'assistant', content: accumulated }]);
          }
        }
      }
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

  const toggleIngestion = (docId: any) => {
    setSelectedIngestions((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const selectChat = (chatId: any) => {
    if (selectedChat === chatId) {
      setSelectedChat(null);
      setMessages([]);
    } else {
      setSelectedChat(chatId);
      getAllMessages(chatId);
    }
    if (!isWide) setShowSidebar(false);
  };

  /* ---------------- Sidebar (sources + chats) ---------------- */
  const Sidebar = (
    <View
      className="border-gray-200 bg-white"
      style={isWide ? { width: 300, borderRightWidth: 1 } : { flex: 1 }}>
      {/* Upload section */}
      <View className="border-b border-gray-100 px-5 pt-6 pb-5">
        <Text className="text-xl font-bold text-gray-900">RAG Chatbot</Text>
        <Text className="mt-1 text-xs text-gray-500">
          Upload a document and ask questions about it
        </Text>

        <TouchableOpacity
          onPress={handlePick}
          disabled={isUploading}
          className={`mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 ${
            isUploading ? 'opacity-50' : ''
          }`}
          activeOpacity={0.8}>
          {isUploading && <ActivityIndicator size="small" color="#fff" />}
          <Text className="text-sm font-semibold text-white">
            {isUploading ? 'Uploading...' : '📎 Upload PDF / Text'}
          </Text>
        </TouchableOpacity>

        {uploadStatus ? (
          <Text
            className={`mt-2 text-xs ${
              uploadStatus.startsWith('✓') ? 'text-green-600' : 'text-red-500'
            }`}>
            {uploadStatus}
          </Text>
        ) : null}

        <View className="my-3 flex-row items-center gap-2">
          <View className="h-px flex-1 bg-gray-200" />
          <Text className="text-xs text-gray-400">OR</Text>
          <View className="h-px flex-1 bg-gray-200" />
        </View>

        <View className="flex-row items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5">
          <TextInput
            onChangeText={setInputUrl}
            placeholder="Paste a URL"
            className="flex-1 px-2 py-2 text-sm text-gray-800"
            placeholderTextColor="#9ca3af"
            keyboardType="url"
            autoCapitalize="none"
            value={inputUrl}
          />
          <TouchableOpacity
            onPress={() => handleUpload(null, 'url')}
            disabled={isUploading || !inputUrl.trim()}
            className={`rounded-xl px-4 py-2.5 ${inputUrl.trim() ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <Text className="text-sm font-medium text-white">Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sources */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <Text className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Sources
        </Text>
        {ingestions.length === 0 ? (
          <Text className="mb-4 text-xs text-gray-400">No sources yet</Text>
        ) : (
          <View className="mb-5 gap-1.5">
            {ingestions.map((it) => {
              const active = selectedIngestions.includes(it.doc_id);
              return (
                <TouchableOpacity
                  key={it.doc_id}
                  onPress={() => toggleIngestion(it.doc_id)}
                  className={`flex-row items-center gap-2 rounded-lg px-3 py-2 ${
                    active ? 'bg-blue-50' : 'bg-gray-50'
                  }`}>
                  <View
                    className={`h-4 w-4 items-center justify-center rounded border ${
                      active ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                    {active && <Text className="text-[10px] text-white">✓</Text>}
                  </View>
                  <Text
                    numberOfLines={1}
                    className={`flex-1 text-sm ${active ? 'text-blue-700' : 'text-gray-700'}`}>
                    {it?.source}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Chats
        </Text>
        {allChats.length === 0 ? (
          <Text className="text-xs text-gray-400">No chats yet</Text>
        ) : (
          <View className="gap-1">
            {allChats.map((it) => {
              const active = selectedChat === it.id;
              return (
                <TouchableOpacity
                  key={it.id}
                  onPress={() => selectChat(it.id)}
                  className={`rounded-lg px-3 py-2.5 ${active ? 'bg-blue-600' : 'bg-gray-50'}`}>
                  <Text
                    numberOfLines={1}
                    className={`text-sm ${active ? 'font-medium text-white' : 'text-gray-700'}`}>
                    {it?.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );

  /* ---------------- Chat panel ---------------- */
  const ChatPanel = (
    <View className="flex-1 bg-gray-50">
      {/* Mobile top bar */}
      {!isWide && (
        <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            className="rounded-lg bg-gray-100 px-3 py-2">
            <Text className="text-base">☰</Text>
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">RAG Chatbot</Text>
          {selectedIngestions.length > 0 && (
            <View className="rounded-full bg-blue-100 px-2 py-0.5">
              <Text className="text-xs font-medium text-blue-700">
                {selectedIngestions.length} source{selectedIngestions.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-5"
        contentContainerStyle={{
          paddingBottom: 20,
          maxWidth: 820,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <View className="mt-10 items-center justify-center rounded-3xl bg-white py-16 shadow-sm">
            <Text className="mb-4 text-5xl">💬</Text>
            <Text className="px-8 text-center text-sm text-gray-500">
              Upload a document, pick a source, then start chatting!
            </Text>
          </View>
        ) : (
          messages?.map((msg, idx) => (
            <View
              key={idx}
              className={`mb-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              style={{
                maxWidth: '85%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
              <View
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'rounded-br-sm bg-blue-600'
                    : 'rounded-bl-sm border border-gray-200 bg-white shadow-sm'
                }`}>
                <Text
                  className={`text-sm leading-relaxed ${
                    msg.role === 'user' ? 'text-white' : 'text-gray-800'
                  }`}>
                  {msg.content}
                </Text>
              </View>
            </View>
          ))
        )}
        {loading && (
          <View style={{ alignSelf: 'flex-start' }} className="mb-3">
            <View className="flex-row items-center gap-2 rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text className="text-sm text-gray-500">Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Composer */}
      <View className="border-t border-gray-100 bg-white px-4 pt-3 pb-6">
        <View
          className="flex-row items-end gap-2"
          style={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}>
          <TextInput
            className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800"
            style={{ maxHeight: 96 }}
            placeholder="Ask a question..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSendStream}
            blurOnSubmit
          />
          <TouchableOpacity
            onPress={handleSendStream}
            disabled={!inputText.trim() || loading}
            className={`h-12 w-12 items-center justify-center rounded-2xl ${
              inputText.trim() && !loading ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            activeOpacity={0.8}>
            <Text
              className={`text-lg ${
                inputText.trim() && !loading ? 'text-white' : 'text-gray-400'
              }`}>
              ➜
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      style={{ flex: 1 }}>
      {isWide ? (
        // Web / tablet: side-by-side layout
        <View className="flex-1 flex-row bg-gray-50">
          {Sidebar}
          {ChatPanel}
        </View>
      ) : (
        // Mobile: chat full screen, sidebar as overlay
        <View className="flex-1 bg-gray-50">
          {ChatPanel}
          {showSidebar && (
            <View className="absolute inset-0 flex-row" style={{ zIndex: 50 }}>
              <View className="bg-white" style={{ width: '85%', maxWidth: 340 }}>
                <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
                  <Text className="text-base font-semibold text-gray-900">Menu</Text>
                  <TouchableOpacity onPress={() => setShowSidebar(false)}>
                    <Text className="text-lg text-gray-400">✕</Text>
                  </TouchableOpacity>
                </View>
                {Sidebar}
              </View>
              <TouchableOpacity
                className="flex-1 bg-black/30"
                activeOpacity={1}
                onPress={() => setShowSidebar(false)}
              />
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
