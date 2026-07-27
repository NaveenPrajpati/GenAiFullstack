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
/**
 * The supervisor sits above the three agents rather than beside them, so it gets
 * a featured card instead of a grid slot — the grid below is the specialist
 * tools you can still open directly.
 */
const FEATURED = {
  href: '/assistant',
  emoji: '✨',
  title: 'Assistant',
  tag: 'One chat, every skill',
  desc: 'Ask for anything and the right specialist picks it up — a study roadmap, your task list, or a week of meals. Some requests use more than one, and you approve anything that changes your data before it happens.',
  skills: [
    { emoji: '🎓', label: 'Learning coach' },
    { emoji: '🪄', label: 'Personal assistant' },
    { emoji: '🥗', label: 'Meal planner' },
  ],
} as const;

/**
 * The RAG chatbot is its own product, not one of the Assistant's skills: it has
 * its own data (documents you upload) and its own interaction model. It gets a
 * peer card rather than a slot in the skills grid.
 */
const RAG = {
  href: '/rag-chatbot',
  emoji: '🤖',
  title: 'RAG Chatbot',
  tag: 'Chat with your documents',
  desc: 'Upload PDFs, Word docs, scanned images, or links, then ask questions in plain English. Answers stream in with inline citations, a live retrieval pipeline, and grounding scores — so you always see where the answer came from.',
  iconBg: 'bg-violet-100',
  btnBg: 'bg-violet-600',
  bar: 'bg-violet-500',
} as const;

/** The three agents the Assistant routes to — each also opens on its own. */
const SKILLS = [
  {
    href: '/learning',
    emoji: '🎓',
    title: 'Learning',
    tag: 'Study smarter',
    desc: 'Turn any subject into a sequenced roadmap with prerequisites and hour estimates, get concepts explained, take quizzes, and track what you have covered.',
    iconBg: 'bg-amber-100',
    btnBg: 'bg-amber-600',
    bar: 'bg-amber-500',
  },
  {
    href: '/personal-assistant',
    emoji: '🪄',
    title: 'Personal Assistant',
    tag: 'Stay on top of things',
    desc: 'Capture tasks and reminders in plain language, see what is overdue or due today, break big goals into steps, and keep notes it remembers for you.',
    iconBg: 'bg-sky-100',
    btnBg: 'bg-sky-600',
    bar: 'bg-sky-500',
  },
  {
    href: '/meal-planner',
    emoji: '🥗',
    title: 'Meal Planner',
    tag: 'Plan your week',
    desc: 'Generate a week of meals around your diet, allergies and dislikes, log what you actually ate, and turn the plan into a consolidated grocery list.',
    iconBg: 'bg-emerald-100',
    btnBg: 'bg-emerald-600',
    bar: 'bg-emerald-500',
  },
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // `shouldShowAlert` split into banner + list in expo-notifications SDK 53;
    // both true is the equivalent of the old single flag.
    shouldShowBanner: true,
    shouldShowList: true,
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
                ✨ {SKILLS.length + 2} AI tools
              </Text>
            </View>
            <Text className={`font-bold text-gray-900 ${isGrid ? 'text-4xl' : 'text-3xl'}`}>
              AI Toolkit
            </Text>
            <Text
              className={`mt-2 leading-relaxed text-gray-600 ${isGrid ? 'max-w-xl text-base' : 'text-base'}`}>
              Two ways in: chat with your own documents, or use the Assistant — one conversation
              that routes to a learning coach, a task manager, and a meal planner, and asks before
              it changes anything.
            </Text>
          </View>
        </View>

        {/* RAG — its own product, so it leads and stands apart from the skills. */}
        <View className="items-center px-4 pt-6">
          <View
            className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white"
            style={{
              maxWidth: CONTENT_MAX_WIDTH,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 2,
            }}>
            <View className={`h-1.5 ${RAG.bar}`} />
            <View className={isGrid ? 'p-6' : 'p-5'}>
              <View className="flex-row items-start gap-4">
                <View className={`h-12 w-12 ${RAG.iconBg} items-center justify-center rounded-xl`}>
                  <Text className="text-2xl">{RAG.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-gray-900">{RAG.title}</Text>
                  <Text className="mb-2 text-xs font-medium text-gray-400">{RAG.tag}</Text>
                  <Text
                    className={`mb-4 leading-relaxed text-gray-600 ${isGrid ? 'max-w-2xl text-sm' : 'text-sm'}`}>
                    {RAG.desc}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.navigate(RAG.href)}
                    className={`${RAG.btnBg} self-start rounded-lg px-4 py-2.5`}
                    activeOpacity={0.8}
                    accessibilityRole="button">
                    <Text className="text-sm font-medium text-white">Launch →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Featured: the unified assistant */}
        <View className="items-center px-4 pt-6">
          <View
            className="w-full overflow-hidden rounded-2xl bg-indigo-600"
            style={{
              maxWidth: CONTENT_MAX_WIDTH,
              shadowColor: '#4f46e5',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
            <View className={isGrid ? 'p-8' : 'p-6'}>
              <View className="flex-row items-center gap-2">
                <View className="rounded-full bg-white/15 px-2.5 py-1">
                  <Text className="text-xs font-semibold text-white">New</Text>
                </View>
                <Text className="text-xs font-medium text-indigo-200">{FEATURED.tag}</Text>
              </View>

              <View className="mt-3 flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                  <Text className="text-2xl">{FEATURED.emoji}</Text>
                </View>
                <Text className={`font-bold text-white ${isGrid ? 'text-3xl' : 'text-2xl'}`}>
                  {FEATURED.title}
                </Text>
              </View>

              <Text
                className={`mt-3 leading-relaxed text-indigo-100 ${isGrid ? 'max-w-2xl text-base' : 'text-sm'}`}>
                {FEATURED.desc}
              </Text>

              <View className="mt-4 flex-row flex-wrap gap-2">
                {FEATURED.skills.map((s) => (
                  <View
                    key={s.label}
                    className="flex-row items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                    <Text className="text-xs">{s.emoji}</Text>
                    <Text className="text-xs font-medium text-white">{s.label}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => router.navigate(FEATURED.href)}
                className="mt-5 self-start rounded-lg bg-white px-5 py-2.5"
                activeOpacity={0.85}
                accessibilityRole="button">
                <Text className="text-sm font-semibold text-indigo-700">Start chatting →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* The Assistant's skills, which also stand alone. */}
        <View className="items-center px-4 py-6">
          <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
            <Text className="text-sm font-semibold text-gray-700">Assistant skills</Text>
            <Text className="mt-0.5 mb-3 text-xs text-gray-400">
              The Assistant brings these in for you — or open one directly to browse everything it
              has stored.
            </Text>
          </View>
          <View
            style={{
              width: '100%',
              maxWidth: CONTENT_MAX_WIDTH,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: CARD_GAP,
            }}>
            {SKILLS.map((app) =>
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
