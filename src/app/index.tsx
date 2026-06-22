import { apiClient, useAuth } from '@/context/AuthContext';
import { UserApis } from '@/services/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
const APPS = [
  {
    href: '/rag-chatbot',
    emoji: '🤖',
    title: 'RAG Chatbot',
    desc: 'Upload PDFs or text files and ask questions. Get accurate answers powered by retrieval-augmented generation.',
    iconBg: 'bg-blue-100',
    btnBg: 'bg-blue-600',
    bar: 'bg-blue-500',
  },
  {
    href: '/meal-planner',
    emoji: '📝',
    title: 'Meal Plannner',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-violet-100',
    btnBg: 'bg-violet-600',
    bar: 'bg-violet-500',
  },
  {
    href: '/learning',
    emoji: '📝',
    title: 'Learning Planner',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-violet-100',
    btnBg: 'bg-violet-600',
    bar: 'bg-violet-500',
  },

  {
    href: '/personal-assistant',
    emoji: '✉️',
    title: 'Personal Assistant',
    desc: 'Draft replies, summarize threads, fix grammar, or improve your email writing style.',
    iconBg: 'bg-sky-100',
    btnBg: 'bg-sky-600',
    bar: 'bg-sky-500',
  },
] as const;

import { EnrichedMarkdownText } from 'react-native-enriched-markdown';

const MyComponent = () => {
  const content = `# Hello World\nThis is **bold** text and a [Link](https://google.com).`;

  return (
    <EnrichedMarkdownText
      markdown={content}
      flavor="github"
      onLinkPress={(url) => console.log('Opening:', url)}
    />
  );
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export default function HomeScreen() {
  const router = useRouter();
  const { token } = useAuth();

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

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-gray-50">
        <View className="border-b border-gray-200 bg-white px-6 py-8">
          {/* <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-2xl text-white">🤖</Text>
          </View> */}
          <Text className="mb-2 text-3xl font-bold text-gray-900">AI Toolkit</Text>
          <Text className="text-base leading-relaxed text-gray-600">
            A collection of AI-powered tools to boost your productivity. Select an app to get
            started.
          </Text>
        </View>

        <MyComponent />

        <View className="gap-4 p-4">
          {APPS.map((app) => (
            <View
              key={app.href}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <View className={`h-1.5 ${app.bar}`} />
              <View className="p-5">
                <View className="flex-row items-start gap-4">
                  <View
                    className={`h-12 w-12 ${app.iconBg} items-center justify-center rounded-xl`}>
                    <Text className="text-2xl">{app.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-lg font-semibold text-gray-900">{app.title}</Text>
                    <Text className="mb-4 text-sm leading-relaxed text-gray-600">{app.desc}</Text>
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
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
