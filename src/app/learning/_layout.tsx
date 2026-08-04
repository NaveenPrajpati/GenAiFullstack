import ChatBot from '@/components/layout/ChatBot';
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

export default function LearningLayout() {
  // The tutor follows the learner across the section, so it's mounted once here
  // rather than per screen — that also keeps one chat thread alive as they
  // navigate. Settings is the exception: it's a form, with nothing to ask about.
  const pathname = usePathname();
  const showChat = pathname.split('/')[2] !== 'settings';

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="roadmaps" options={{ headerShown: false }} />
        <Stack.Screen name="[id]" options={{ title: 'Roadmap' }} />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="notes" options={{ title: 'My notes' }} />
        <Stack.Screen name="digests" />
        <Stack.Screen name="settings" />
      </Stack>

      {showChat && (
        <View className="absolute right-4 bottom-4">
          <ChatBot />
        </View>
      )}
    </View>
  );
}
