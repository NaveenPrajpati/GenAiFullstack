import ChatBot from '@/components/layout/ChatBot';
import { SectionSidebar, useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';

export default function LearningLayout() {
  const colors = useColors();
  const wide = useWideNav();
  // The tutor follows the learner across the section, so it's mounted once here
  // rather than per screen — that also keeps one chat thread alive as they
  // navigate. Settings is the exception: it's a form, with nothing to ask about.
  const pathname = usePathname();
  const showChat = pathname.split('/')[2] !== 'settings';

  return (
    <View className="bg-bg flex-1">
      {/* Sidebar and stack sit side by side, so the rail survives navigation
          instead of being re-mounted by each screen. Below the breakpoint it
          isn't rendered at all and `SectionNav`'s pills take over inside each
          screen's header. */}
      <View className="flex-1 flex-row">
        {wide && <SectionSidebar />}

        <View className="flex-1">
          {/* The native header is a real surface on device, so it takes the theme
              too — otherwise every screen behind this stack keeps a white bar. */}
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackButtonDisplayMode: 'minimal',
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.ink },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}>
            <Stack.Screen name="index" />
            {/* With the rail visible these are lateral moves, not a drill-down,
                so the stack's own back-arrow header would be misleading. */}
            <Stack.Screen name="roadmaps" />
            <Stack.Screen name="[id]" options={{ title: 'Roadmap' }} />
            <Stack.Screen name="quiz" />
            <Stack.Screen name="notes" options={{ title: 'My notes' }} />
            <Stack.Screen name="digests" options={{}} />
            <Stack.Screen name="settings" options={{}} />
          </Stack>
        </View>
      </View>

      {showChat && (
        <View className="absolute right-8 bottom-8">
          <ChatBot />
        </View>
      )}
    </View>
  );
}
