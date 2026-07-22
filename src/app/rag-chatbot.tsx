import { useAuth } from '@/context/AuthContext';
import { RagFeaturesModal } from '@/features/rag/RagFeaturesModal';
import { RagInsightsPanel } from '@/features/rag/RagInsightsPanel';
import { RagPipelineCard } from '@/features/rag/RagPipelineCard';
import {
  ChatMessage,
  initialPipeline,
  PIPELINE_STEPS,
  PipelineState,
  QueryMeta,
  RagEvaluation,
  RagSource,
} from '@/features/rag/ragTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentPickerAsset } from 'expo-document-picker';
import { useRouter } from 'expo-router';
import {
  BarChart3Icon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  FileTextIcon,
  HomeIcon,
  InfoIcon,
  LinkIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PanelRightIcon,
  PaperclipIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { BASE_URL, RagApis } from '../services/api';
import { authedFetch, http } from '../services/http';

const VIOLET = '#7c3aed';
const VIEW_MODE_KEY = 'rag_view_mode'; // 'dev' | 'user' — Developer view is the default

export default function RagChatbotScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  // Seconds elapsed since the current query started, shown in the "Thinking…"
  // indicator so a slow first (cold) response reads as progress, not a hang.
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [asset, setAsset] = useState<DocumentPickerAsset | null>(null);
  const [ingestions, setIngestions] = useState<any[]>([]);
  const [ingestionsLoading, setIngestionsLoading] = useState(true);
  const [selectedIngestions, setSelectedIngestions] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // View mode: 'dev' shows the full RAG mechanics (pipeline, insights, eval);
  // 'user' is a clean chat-only experience. Developer is the default.
  const [devMode, setDevMode] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((v) => {
      if (v === 'user') setDevMode(false);
    });
  }, []);
  const switchMode = (dev: boolean) => {
    setDevMode(dev);
    if (!dev) setShowInsights(false); // dev-only overlay never lingers in user view
    AsyncStorage.setItem(VIEW_MODE_KEY, dev ? 'dev' : 'user');
  };

  // Live query insights
  const [sources, setSources] = useState<RagSource[]>([]);
  const [evaluation, setEvaluation] = useState<RagEvaluation | null>(null);
  const [queryMeta, setQueryMeta] = useState<QueryMeta | null>(null);
  const [pipeline, setPipeline] = useState<PipelineState>(initialPipeline());
  const [evaluate, setEvaluate] = useState(true);
  const [activeSource, setActiveSource] = useState<RagSource | null>(null);

  const { width } = useWindowDimensions();
  const isWide = width >= 768; // sidebar inline
  const isXWide = width >= 1200; // insights panel inline

  const patchPipeline = (patch: PipelineState) => setPipeline((prev) => ({ ...prev, ...patch }));

  /** Apply a server-emitted `stage` event: record the REAL ms for that stage and
   *  advance the "active" marker to the next stage that hasn't run yet. */
  const applyStage = (evt: { name: string; ms?: number; info?: string; skipped?: boolean }) => {
    setPipeline((prev) => {
      if (!(evt.name in prev)) return prev;
      const next: PipelineState = { ...prev };
      next[evt.name] = evt.skipped
        ? { status: 'skipped' }
        : {
            status: 'done',
            sub: `${Math.round(evt.ms ?? 0)}ms${evt.info ? ` · ${evt.info}` : ''}`,
          };
      const idx = PIPELINE_STEPS.findIndex((s) => s.key === evt.name);
      for (let i = idx + 1; i < PIPELINE_STEPS.length; i++) {
        const key = PIPELINE_STEPS[i].key;
        const status = next[key]?.status;
        if (status === 'pending') {
          next[key] = { ...next[key], status: 'active' };
          break;
        }
        if (status !== 'done' && status !== 'skipped') break;
      }
      return next;
    });
  };

  async function getAllMessages(chatId: string) {
    http.get(RagApis.getallMessages(chatId)).then((res) => {
      setMessages(res.data.data.messages);
    });
  }
  async function getAllChats() {
    setChatsLoading(true);
    http
      .get(RagApis.getallChats)
      .then((res) => {
        setAllChats(res.data.data);
      })
      .finally(() => setChatsLoading(false));
  }
  async function getAllIngestedFiles() {
    setIngestionsLoading(true);
    http
      .get(RagApis.getallIngestions)
      .then((res) => {
        setIngestions(res.data.data);
      })
      .finally(() => setIngestionsLoading(false));
  }
  async function deleteIngestion(id: string) {
    setSelectedChat(null);
    http.delete(RagApis.deleteFile(id)).then(() => {
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'file deleted successfully',
      });
      getAllIngestedFiles();
    });
  }
  async function deleteChat(chatId: string) {
    setSelectedChat(null);
    http.delete(RagApis.deleteChat(chatId)).then(() => {
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'chat deleted successfully',
      });
      getAllChats();
    });
  }

  const data = new FormData();

  useEffect(() => {
    getAllIngestedFiles();
    getAllChats();
  }, []);

  useEffect(() => {
    if (asset) handleUpload(asset, 'file');
  }, [asset]);

  useEffect(() => {
    if (!loading) {
      setThinkingSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setThinkingSeconds(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [loading]);

  const startNewQuery = () => {
    setSelectedChat(null);
    setMessages([]);
    setSources([]);
    setEvaluation(null);
    setQueryMeta(null);
    setPipeline(initialPipeline());
    if (!isWide) setShowSidebar(false);
  };

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

      const response = await authedFetch(`${BASE_URL}/rag/ingest/${action}?${query}`, {
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
    if (!inputText.trim() || loading || streaming) return;
    const userMessage = inputText.trim();
    setInputText('');

    const t0 = Date.now();
    const meta: QueryMeta = { question: userMessage, startedAt: t0, chatId: selectedChat };
    const updated: ChatMessage[] = [...messages, { role: 'user', content: userMessage, meta }];
    setMessages(updated);
    setLoading(true);
    setStreaming(true);
    setSources([]);
    setEvaluation(null);
    setQueryMeta(meta);
    setPipeline({ ...initialPipeline(), embed: { status: 'active' } });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    let accumulated = '';
    let streamSources: RagSource[] = [];

    try {
      const response = await authedFetch(`${BASE_URL}/rag/query/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          // Eval scores are a developer-view feature — don't spend judge LLM
          // calls when the panel that shows them is hidden.
          evaluate: devMode && evaluate,
          ingestions: selectedIngestions,
          chat_id: selectedChat,
        }),
      });
      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === 'stage') {
            // Real server-side timing for one pipeline stage.
            applyStage(event);
          } else if (event.type === 'sources') {
            streamSources = event.sources ?? [];
            setSources(streamSources);
            meta.cached = !!event.cached;
          } else if (event.type === 'token') {
            accumulated += event.token;
            setLoading(false);
            setMessages([...updated, { role: 'assistant', content: accumulated }]);
          } else if (event.type === 'citations') {
            meta.cited = event.cited ?? [];
            setQueryMeta({ ...meta });
          } else if (event.type === 'evaluation') {
            meta.evaluation = event.evaluation ?? null;
            setEvaluation(meta.evaluation ?? null);
          } else if (event.type === 'done') {
            meta.durationMs = Date.now() - t0;
            meta.serverMs = event.total_ms ?? null;
            meta.grounded = event.grounded ?? true;
            meta.cached = meta.cached || !!event.cached;
            meta.chatId = event.chat_id ?? meta.chatId;
            meta.sources = streamSources;
            setQueryMeta({ ...meta });
            // Server stage events are the source of truth; anything still
            // pending/active at `done` genuinely didn't run.
            setPipeline((prev) => {
              const next = { ...prev };
              for (const { key } of PIPELINE_STEPS) {
                const st = next[key]?.status;
                if (st === 'pending' || st === 'active') next[key] = { status: 'skipped' };
              }
              return next;
            });
            setMessages([...updated, { role: 'assistant', content: accumulated, meta }]);
            if (event.chat_id && !selectedChat) {
              setSelectedChat(event.chat_id);
              getAllChats();
            }
          } else if (event.type === 'error') {
            const errorMessage = event.message ?? 'Something went wrong. Please try again.';
            setLoading(false);
            patchPipeline({
              gate: { status: 'failed', sub: 'No answer' },
              stream: { status: 'skipped' },
              persist: { status: 'skipped' },
            });
            setMessages([...updated, { role: 'assistant', content: errorMessage }]);
            Toast.show({ type: 'error', text1: 'Unable to answer', text2: errorMessage });
            await reader.cancel();
            return;
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
      setStreaming(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Web: send on Enter, newline on Shift+Enter. The composer is `multiline`, and
  // react-native-web only fires onSubmitEditing for multiline inputs when the
  // legacy `blurOnSubmit` prop is set — so we intercept the keydown ourselves.
  const handleComposerKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (e?.key === 'Enter' && !e?.shiftKey && !e?.nativeEvent?.isComposing) {
      e.preventDefault();
      handleSendStream();
    }
  };

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/bmp',
          'image/tiff',
        ],
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
      startNewQuery();
    } else {
      setSelectedChat(chatId);
      getAllMessages(chatId);
    }
    if (!isWide) setShowSidebar(false);
  };

  const openSource = (citation: number) => {
    const list = queryMeta?.sources?.length ? queryMeta.sources : sources;
    const found = list.find((s) => s.citation === citation);
    if (found) setActiveSource(found);
  };

  /* Render answer text with [n] citation chips */
  const renderAnswerText = (content: string) => {
    const parts = content.split(/(\[\d+\])/g);
    return (
      <Text className="text-sm leading-relaxed text-gray-800">
        {parts.map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/);
          if (!m) return part;
          return (
            <Text
              key={i}
              onPress={() => openSource(Number(m[1]))}
              className="text-xs font-bold text-violet-600">
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  /* ---------------- View mode toggle (Developer | Simple) ---------------- */
  const ModeToggle = ({ compact }: { compact?: boolean }) => (
    <View className="flex-row items-center rounded-xl bg-gray-100 p-0.5">
      {(
        [
          { dev: true, label: compact ? 'Dev' : 'Developer' },
          { dev: false, label: compact ? 'Simple' : 'Simple' },
        ] as const
      ).map((m) => {
        const active = devMode === m.dev;
        return (
          <TouchableOpacity
            key={m.label}
            onPress={() => switchMode(m.dev)}
            activeOpacity={0.8}
            className={`rounded-[10px] px-3 py-1.5 ${active ? 'bg-white shadow-sm' : ''}`}>
            <Text
              className={`text-xs font-semibold ${active ? 'text-violet-700' : 'text-gray-400'}`}>
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ---------------- Sidebar ---------------- */
  type NavItem = {
    label: string;
    icon: typeof HomeIcon;
    onPress?: () => void;
    active?: boolean;
    soon?: boolean;
  };
  const navItems: NavItem[] = [
    { label: 'Chat', icon: MessageSquareIcon, active: true },
    // Platform sections are developer-view concerns; hide them in Simple view.
    ...(devMode
      ? [
          { label: 'Analytics', icon: BarChart3Icon, soon: true },
          { label: 'Datasets', icon: DatabaseIcon, soon: true },
        ]
      : []),
    { label: 'Features', icon: InfoIcon, onPress: () => setShowFeatures(true) },
  ];

  const Sidebar = (
    <View
      className="border-gray-200 bg-white"
      style={isWide ? { width: 288, borderRightWidth: 1 } : { flex: 1 }}>
      {/* Logo */}
      <View className="flex-row items-center gap-2.5 border-b border-gray-100 px-5 py-4">
        <View className="h-8 w-8 items-center justify-center rounded-xl bg-violet-600">
          <SparklesIcon size={16} color="#fff" />
        </View>
        <Text className="text-base font-bold text-gray-900">RAG Assistant</Text>
      </View>

      <View className="px-4 pt-4">
        <TouchableOpacity
          onPress={startNewQuery}
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 shadow-sm">
          <PlusIcon size={16} color="#fff" strokeWidth={2.5} />
          <Text className="text-sm font-semibold text-white">New Query</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* Nav */}
        <View className="gap-0.5">
          {navItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              disabled={item.soon}
              onPress={item.onPress}
              activeOpacity={0.7}
              className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${
                item.active ? 'bg-violet-50' : ''
              }`}>
              <item.icon
                size={17}
                color={item.active ? VIOLET : item.soon ? '#c4c4cf' : '#6b7280'}
              />
              <Text
                className={`flex-1 text-sm ${
                  item.active
                    ? 'font-semibold text-violet-700'
                    : item.soon
                      ? 'text-gray-300'
                      : 'text-gray-600'
                }`}>
                {item.label}
              </Text>
              {item.soon && (
                <Text className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold text-gray-400">
                  SOON
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Documents */}
        <Text className="mt-6 mb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          Documents
        </Text>
        <TouchableOpacity
          onPress={handlePick}
          disabled={isUploading}
          className={`flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-2.5 ${
            isUploading ? 'opacity-50' : ''
          }`}
          activeOpacity={0.8}>
          {isUploading ? (
            <ActivityIndicator size="small" color={VIOLET} />
          ) : (
            <PaperclipIcon size={14} color={VIOLET} />
          )}
          <Text className="text-xs font-semibold text-violet-700">
            {isUploading ? 'Uploading…' : 'Upload PDF / Text / Docx / Image'}
          </Text>
        </TouchableOpacity>

        <View className="mt-2 flex-row items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-1">
          <LinkIcon size={13} color="#9ca3af" style={{ marginLeft: 8 }} />
          <TextInput
            onChangeText={setInputUrl}
            placeholder="Paste a URL"
            className="flex-1 px-1 py-1.5 text-xs text-gray-800 outline-0"
            placeholderTextColor="#9ca3af"
            keyboardType="url"
            autoCapitalize="none"
            value={inputUrl}
          />
          <TouchableOpacity
            onPress={() => handleUpload(null, 'url')}
            disabled={isUploading || !inputUrl.trim()}
            className={`rounded-lg px-3 py-1.5 ${inputUrl.trim() ? 'bg-violet-600' : 'bg-gray-300'}`}>
            <Text className="text-xs font-medium text-white">Add</Text>
          </TouchableOpacity>
        </View>

        {uploadStatus ? (
          <Text
            className={`mt-2 text-xs ${
              uploadStatus.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'
            }`}>
            {uploadStatus}
          </Text>
        ) : null}

        <View className="mt-3 gap-1">
          {ingestionsLoading ? (
            <View className="flex-row items-center gap-2 py-2">
              <ActivityIndicator size="small" color={VIOLET} />
              <Text className="text-xs text-gray-400">Loading documents…</Text>
            </View>
          ) : ingestions.length === 0 ? (
            <Text className="py-1 text-xs text-gray-400">No documents yet</Text>
          ) : (
            ingestions.map((it) => {
              const active = selectedIngestions.includes(it.doc_id);
              return (
                <View
                  key={it.doc_id}
                  className={`flex-row items-center gap-2 rounded-xl px-2.5 py-2 ${
                    active ? 'bg-violet-50' : ''
                  }`}>
                  <TouchableOpacity
                    onPress={() => toggleIngestion(it.doc_id)}
                    className="flex-1 flex-row items-center gap-2.5">
                    <View
                      className={`h-4 w-4 items-center justify-center rounded border ${
                        active ? 'border-violet-600 bg-violet-600' : 'border-gray-300'
                      }`}>
                      {active && <Text className="text-[10px] text-white">✓</Text>}
                    </View>
                    <FileTextIcon size={14} color={active ? VIOLET : '#9ca3af'} />
                    <Text
                      numberOfLines={1}
                      className={`flex-1 text-xs ${
                        active ? 'font-medium text-violet-700' : 'text-gray-600'
                      }`}>
                      {it?.source}
                    </Text>
                  </TouchableOpacity>
                  {user?.role == 'admin' && (
                    <TouchableOpacity onPress={() => deleteIngestion(it.doc_id)} hitSlop={8}>
                      <Trash2Icon color="#ef4444" size={15} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Recent Queries */}
        <Text className="mt-6 mb-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          Recent Queries
        </Text>
        {chatsLoading ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator size="small" color={VIOLET} />
            <Text className="text-xs text-gray-400">Loading chats…</Text>
          </View>
        ) : allChats.length === 0 ? (
          <Text className="py-1 text-xs text-gray-400">No queries yet</Text>
        ) : (
          <View className="gap-0.5">
            {allChats.map((it) => {
              const active = selectedChat === it.id;
              return (
                <TouchableOpacity
                  key={it.id}
                  onPress={() => selectChat(it.id)}
                  className={`flex-row items-center gap-2.5 rounded-xl px-3 py-2.5 ${
                    active ? 'bg-violet-600' : ''
                  }`}>
                  <MessageSquareIcon size={14} color={active ? '#fff' : '#9ca3af'} />
                  <Text
                    numberOfLines={1}
                    className={`flex-1 text-xs ${
                      active ? 'font-medium text-white' : 'text-gray-600'
                    }`}>
                    {it?.title}
                  </Text>
                  {user?.role == 'admin' && (
                    <TouchableOpacity onPress={() => deleteChat(it.id)} hitSlop={8}>
                      <Trash2Icon color={active ? '#fecaca' : '#ef4444'} size={15} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* User footer */}
      <View className="flex-row items-center gap-3 border-t border-gray-100 px-4 py-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-violet-100">
          <Text className="text-sm font-bold text-violet-700">
            {(user?.name || user?.email || 'G').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="text-xs font-semibold text-gray-800">
            {user?.name || 'Guest'}
          </Text>
          <Text numberOfLines={1} className="text-[10px] text-gray-400">
            {user?.is_guest ? 'Guest workspace' : user?.email}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} hitSlop={8}>
          <LogOutIcon size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* ---------------- Insights (right panel) ---------------- */
  const Insights = (
    <RagInsightsPanel
      sources={sources}
      meta={queryMeta}
      evaluation={evaluation}
      user={user}
      selectedCount={selectedIngestions.length}
      evaluate={evaluate}
      onPressSource={(s) => setActiveSource(s)}
    />
  );

  const pipelineStarted = Object.values(pipeline).some((s) => s.status !== 'pending');

  /* ---------------- Center panel ---------------- */
  const ChatPanel = (
    <View className="flex-1 bg-gray-50">
      {/* Mobile top bar */}
      {!isWide && (
        <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            className="rounded-lg bg-gray-100 p-2">
            <MenuIcon size={18} color="#374151" />
          </TouchableOpacity>
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <SparklesIcon size={14} color="#fff" />
          </View>
          <Text className="flex-1 text-base font-bold text-gray-900">RAG Assistant</Text>
          <ModeToggle compact />
          {devMode && (
            <TouchableOpacity
              onPress={() => setShowInsights(true)}
              className="rounded-lg bg-gray-100 p-2">
              <PanelRightIcon size={18} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Desktop header */}
      {isWide && (
        <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
          <View>
            <View className="flex-row items-center gap-2.5">
              <Text className="text-xl font-bold text-gray-900">RAG Query</Text>
              <View className="flex-row items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
                <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <Text className="text-[11px] font-semibold text-emerald-700">
                  {streaming ? 'Streaming' : 'Ready'}
                </Text>
              </View>
            </View>
            <Text className="mt-0.5 text-xs text-gray-400">
              Ask anything. Get grounded answers with citations.
            </Text>
          </View>
          <View className="ml-auto flex-row items-center gap-2.5">
            <ModeToggle />
            {devMode && !isXWide && (
              <TouchableOpacity
                onPress={() => setShowInsights(true)}
                className="flex-row items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2">
                <PanelRightIcon size={15} color="#374151" />
                <Text className="text-xs font-medium text-gray-600">Insights</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-5"
        contentContainerStyle={{
          paddingBottom: 20,
          maxWidth: 860,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <View className="mt-10 items-center justify-center rounded-3xl border border-gray-100 bg-white py-16 shadow-sm">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
              <SparklesIcon size={26} color={VIOLET} />
            </View>
            <Text className="text-base font-bold text-gray-900">Ask your documents</Text>
            <Text className="mt-1 px-8 text-center text-xs text-gray-400">
              Upload a document, pick a scope, then ask anything.{'\n'}Answers are grounded with
              citations.
            </Text>
          </View>
        ) : (
          messages?.map((msg, idx) => {
            if (msg.role === 'user') {
              return (
                <View
                  key={idx}
                  className="mb-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                  <View className="mb-1.5 flex-row items-center justify-between">
                    <Text className="text-xs font-semibold text-gray-400">Your Question</Text>
                    {msg.meta?.startedAt && (
                      <Text className="text-[10px] text-gray-400">
                        {new Date(msg.meta.startedAt).toLocaleTimeString()}
                      </Text>
                    )}
                  </View>
                  <Text className="text-[15px] font-medium text-gray-900">{msg.content}</Text>
                </View>
              );
            }
            const isLast = idx === messages.length - 1;
            const m = msg.meta;
            return (
              <View
                key={idx}
                className="mb-4 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <View className="mb-2.5 flex-row items-center gap-2">
                  <SparklesIcon size={15} color={VIOLET} />
                  <Text className="text-sm font-bold text-violet-700">
                    Answer{isLast && streaming ? ' (Streaming)' : ''}
                  </Text>
                  {isLast && streaming && <ActivityIndicator size="small" color={VIOLET} />}
                </View>
                {renderAnswerText(msg.content)}
                {m?.durationMs != null && (
                  <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3">
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2Icon
                        size={14}
                        color={m.grounded === false ? '#f59e0b' : '#10b981'}
                      />
                      <Text
                        className={`text-xs font-medium ${
                          m.grounded === false ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                        {m.grounded === false ? 'Not grounded' : 'Grounded Answer'}
                      </Text>
                    </View>
                    {!!m.cited?.length && (
                      <Text className="text-xs text-gray-500">
                        {m.cited.length} citation{m.cited.length > 1 ? 's' : ''}
                      </Text>
                    )}
                    {devMode && (
                      <View className="flex-row items-center gap-1">
                        <ClockIcon size={12} color="#9ca3af" />
                        <Text className="text-xs text-gray-500">
                          {(m.durationMs / 1000).toFixed(2)}s
                        </Text>
                      </View>
                    )}
                    {devMode && m.cached && (
                      <Text className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                        Cached
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {loading && (
          <View className="mb-4 self-start rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={VIOLET} />
              <Text className="text-sm text-gray-500">
                Thinking…{thinkingSeconds > 0 ? ` ${thinkingSeconds}s` : ''}
              </Text>
            </View>
            {thinkingSeconds >= 6 && (
              <Text className="mt-1 text-[11px] text-gray-400">
                The first query warms up the model — this can take ~20s.
              </Text>
            )}
          </View>
        )}

        {devMode && pipelineStarted && <RagPipelineCard pipeline={pipeline} live={streaming} />}
      </ScrollView>

      {/* Composer */}
      <View className="border-t border-gray-100 bg-white px-4 pt-3 pb-4">
        <View style={{ maxWidth: 860, width: '100%', alignSelf: 'center' }}>
          <View className="rounded-2xl border border-gray-200 bg-gray-50 px-3 pt-2 pb-2">
            <TextInput
              className="max-h-24 px-1 py-2 text-sm text-gray-800 outline-0"
              placeholder={messages.length ? 'Ask a follow-up question…' : 'Ask a question…'}
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendStream}
              onKeyPress={handleComposerKeyPress}
              submitBehavior="blurAndSubmit"
            />
            <View className="mt-1 flex-row items-center gap-3">
              <TouchableOpacity onPress={handlePick} hitSlop={8} disabled={isUploading}>
                <PaperclipIcon size={17} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowFeatures(true)} hitSlop={8}>
                <InfoIcon size={17} color="#6b7280" />
              </TouchableOpacity>
              {devMode && (
                <View className="ml-auto flex-row items-center gap-2">
                  <Text className="text-xs text-gray-500">Evaluate</Text>
                  <Switch
                    value={evaluate}
                    onValueChange={setEvaluate}
                    trackColor={{ true: VIOLET, false: '#d1d5db' }}
                    thumbColor="#fff"
                    {...(Platform.OS === 'web' ? { activeThumbColor: '#fff' } : {})}
                  />
                </View>
              )}
              <TouchableOpacity
                onPress={handleSendStream}
                disabled={!inputText.trim() || loading || streaming}
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  devMode ? '' : 'ml-auto'
                } ${inputText.trim() && !loading && !streaming ? 'bg-violet-600' : 'bg-gray-200'}`}
                activeOpacity={0.8}>
                <SendIcon
                  size={16}
                  color={inputText.trim() && !loading && !streaming ? '#fff' : '#9ca3af'}
                />
              </TouchableOpacity>
            </View>
          </View>
          <Text className="mt-2 text-center text-[10px] text-gray-400">
            Streaming responses may take a few seconds to complete.
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <RagFeaturesModal visible={showFeatures} onClose={() => setShowFeatures(false)} />

      {/* Source detail modal */}
      <Modal
        visible={!!activeSource}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveSource(null)}>
        <TouchableOpacity
          className="flex-1 items-center justify-center bg-black/40 px-5"
          activeOpacity={1}
          onPress={() => setActiveSource(null)}>
          <TouchableOpacity
            activeOpacity={1}
            className="w-full max-w-lg rounded-2xl bg-white p-5"
            onPress={() => {}}>
            <View className="mb-3 flex-row items-center gap-2.5">
              <View className="h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
                <Text className="text-xs font-bold text-white">{activeSource?.citation}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-sm font-bold text-gray-900">
                  {activeSource?.source}
                </Text>
                <Text className="text-[11px] text-gray-400">
                  {activeSource?.page_number != null
                    ? `Page ${activeSource.page_number}`
                    : 'Source passage'}
                  {activeSource?.confidence_score != null
                    ? ` · score ${activeSource.confidence_score.toFixed(2)}`
                    : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setActiveSource(null)} hitSlop={8}>
                <XIcon size={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-72 rounded-xl bg-gray-50 p-3">
              <Text className="text-xs leading-relaxed text-gray-700">
                {activeSource?.chunk_text}
              </Text>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {isWide ? (
        <View className="flex-1 flex-row bg-gray-50">
          {Sidebar}
          {ChatPanel}
          {isXWide && devMode && (
            <View className="border-l border-gray-200 bg-gray-50" style={{ width: 320 }}>
              {Insights}
            </View>
          )}
        </View>
      ) : (
        <View className="flex-1 bg-gray-50">{ChatPanel}</View>
      )}

      {/* Sidebar overlay (mobile) */}
      {!isWide && showSidebar && (
        <View className="absolute inset-0 flex-row" style={{ zIndex: 50 }}>
          <View className="bg-white" style={{ width: '85%', maxWidth: 340 }}>
            <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-3">
              <Text className="text-base font-semibold text-gray-900">Menu</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)} hitSlop={8}>
                <XIcon size={20} color="#9ca3af" />
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

      {/* Insights overlay (mobile / medium screens) */}
      {devMode && !isXWide && showInsights && (
        <View className="absolute inset-0 flex-row justify-end" style={{ zIndex: 50 }}>
          <TouchableOpacity
            className="flex-1 bg-black/30"
            activeOpacity={1}
            onPress={() => setShowInsights(false)}
          />
          <View className="bg-gray-50" style={{ width: '88%', maxWidth: 360 }}>
            <View className="flex-row items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
              <Text className="text-base font-semibold text-gray-900">Query Insights</Text>
              <TouchableOpacity onPress={() => setShowInsights(false)} hitSlop={8}>
                <XIcon size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {Insights}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
