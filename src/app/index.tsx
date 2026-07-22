import { apiClient, useAuth } from '@/context/AuthContext';
import { UserApis } from '@/services/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
const APPS = [
  {
    href: '/rag-chatbot',
    emoji: '🤖',
    title: 'RAG Assistant',
    tag: 'Ask your documents',
    desc: 'Upload PDFs, Word docs, scanned images, or links, then ask questions in plain English. Answers stream in with inline citations, a live retrieval pipeline, and grounding scores — so you always see where the answer came from.',
    iconBg: 'bg-violet-100',
    btnBg: 'bg-violet-600',
    bar: 'bg-violet-500',
  },

  {
    href: '/learning',
    emoji: '📚',
    title: 'Learning Planner',
    tag: 'Study smarter',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-amber-100',
    btnBg: 'bg-amber-600',
    bar: 'bg-amber-500',
  },
  {
    href: '/meal-planner',
    emoji: '📝',
    title: 'Meal Plannner',
    tag: 'Plan your week',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-emerald-100',
    btnBg: 'bg-emerald-600',
    bar: 'bg-emerald-500',
  },
  {
    href: '/personal-assistant',
    emoji: '✉️',
    title: 'Personal Assistant',
    tag: 'Write faster',
    desc: 'Draft replies, summarize threads, fix grammar, or improve your email writing style.',
    iconBg: 'bg-sky-100',
    btnBg: 'bg-sky-600',
    bar: 'bg-sky-500',
  },
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const CONTENT_MAX_WIDTH = 1180;
const CARD_GAP = 20;

export default function HomeScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { width } = useWindowDimensions();

  // Mobile stays single column; web/tablet grows into a 2 or 3 column grid
  // instead of stretching full-width rows across the screen.
  const columns = width >= 1024 ? 3 : width >= 700 ? 2 : 1;
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const cardWidth = columns === 1 ? '100%' : (contentWidth - CARD_GAP * (columns - 1)) / columns;

  useEffect(() => {
    if (!token || Platform.OS === 'web') return;
    registerForPushNotificationsAsync()
      .then((pushToken) => {
        if (pushToken) {
          // Send this token to the FastAPI backend, mapped to the user via the auth header.
          apiClient(token)
            .patch(UserApis.pushToken, { expo_push_token: pushToken })
            .catch((err) => console.log('registerPushToken', err));
        }
      })
      .catch((err) => console.log('registerForPushNotificationsAsync', err));
  }, [token]);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      // projectId is auto-resolved in dev, but MUST be passed explicitly in
      // standalone/preview builds or getExpoPushTokenAsync() throws.
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.log('registerForPushNotificationsAsync', 'Missing EAS projectId');
        return;
      }
      // Extract the exact stable Expo token string format
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  }

  const isGrid = columns > 1;

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="items-center border-b border-gray-200 bg-white px-6 py-10">
          <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
            <View className="mb-3 flex-row items-center gap-2 self-start rounded-full bg-violet-50 px-3 py-1">
              <Text className="text-xs font-semibold text-violet-700">
                ✨ {APPS.length} AI tools
              </Text>
            </View>
            <Text className={`font-bold text-gray-900 ${isGrid ? 'text-4xl' : 'text-3xl'}`}>
              AI Toolkit
            </Text>
            <Text
              className={`mt-2 leading-relaxed text-gray-600 ${isGrid ? 'max-w-xl text-base' : 'text-base'}`}>
              A collection of AI-powered tools to boost your productivity — from a
              retrieval-augmented assistant that answers questions straight from your documents, to
              writing and planning helpers. Pick a tool below to get started.
            </Text>
          </View>
        </View>

        {/* App grid */}
        <View className="items-center px-4 py-6">
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX_WIDTH,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: CARD_GAP,
            }}>
            {APPS.map((app) =>
              isGrid ? (
                <View
                  key={app.href}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
                  style={{
                    width: cardWidth,
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}>
                  <View className={`h-1.5 ${app.bar}`} />
                  <View className="flex-1 p-6" style={{ minHeight: 260 }}>
                    <View
                      className={`h-12 w-12 ${app.iconBg} items-center justify-center rounded-xl`}>
                      <Text className="text-2xl">{app.emoji}</Text>
                    </View>
                    <Text className="mt-4 text-lg font-semibold text-gray-900">{app.title}</Text>
                    <Text className="mt-0.5 text-xs font-medium text-gray-400">{app.tag}</Text>
                    <Text className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
                      {app.desc}
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.navigate(app.href)}
                      className={`${app.btnBg} mt-4 flex-row items-center justify-center gap-1.5 self-start rounded-lg px-4 py-2.5`}
                      activeOpacity={0.8}>
                      <Text className="text-sm font-medium text-white">Launch →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View
                  key={app.href}
                  className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white"
                  style={{
                    shadowColor: '#000',
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}>
                  <View className={`h-1.5 ${app.bar}`} />
                  <View className="p-5">
                    <View className="flex-row items-start gap-4">
                      <View
                        className={`h-12 w-12 ${app.iconBg} items-center justify-center rounded-xl`}>
                        <Text className="text-2xl">{app.emoji}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-gray-900">{app.title}</Text>
                        <Text className="mb-2 text-xs font-medium text-gray-400">{app.tag}</Text>
                        <Text className="mb-4 text-sm leading-relaxed text-gray-600">
                          {app.desc}
                        </Text>
                        <TouchableOpacity
                          onPress={() => router.navigate(app.href)}
                          className={`${app.btnBg} self-start rounded-lg px-4 py-2`}
                          activeOpacity={0.8}>
                          <Text className="text-sm font-medium text-white">Launch →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
