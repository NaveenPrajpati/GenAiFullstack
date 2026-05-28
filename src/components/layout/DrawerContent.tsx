import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';

const NAV_ITEMS = [
  { href: '/', emoji: '🏠', label: 'Home', desc: 'Dashboard' },
  { href: '/rag-chatbot', emoji: '🤖', label: 'RAG Chatbot', desc: 'Document Q&A' },
  { href: '/summarizer', emoji: '📝', label: 'Summarizer', desc: 'Text summary' },
  { href: '/web-scraper', emoji: '🌐', label: 'Web Scraper', desc: 'URL to summary' },
  { href: '/email-assistant', emoji: '✉️', label: 'Email Assistant', desc: 'Email helper' },
  { href: '/recipe-generator', emoji: '🍳', label: 'Recipe Generator', desc: 'Cook with AI' },
] as const;

export default function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '' : pathname === href;

  const handleNavigate = (href: string) => {
    router.navigate(href);
    if (Platform.OS !== 'web') props.navigation.closeDrawer();
  };

  return (
    <View className="flex-1 bg-gray-900">
      <View className="border-b border-gray-800 px-5 py-5">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <Text className="text-sm font-bold text-white">AI</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-white">AI Toolkit</Text>
            <Text className="text-xs text-gray-400">Full Stack Apps</Text>
          </View>
        </View>
      </View>

      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: 'transparent' }}>
        <View className="py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <TouchableOpacity
                key={item.href}
                onPress={() => handleNavigate(item.href)}
                className={`mx-2 my-0.5 flex-row items-center gap-3 rounded-lg px-3 py-2.5 ${active ? 'bg-indigo-600' : ''}`}
                activeOpacity={0.7}>
                <View
                  className={`h-8 w-8 items-center justify-center rounded-lg ${active ? 'bg-indigo-500' : 'bg-gray-800'}`}>
                  <Text className="text-base">{item.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-300'}`}>
                    {item.label}
                  </Text>
                  <Text className="text-xs text-gray-500">{item.desc}</Text>
                </View>
                {active && <View className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </DrawerContentScrollView>

      <View className="border-t border-gray-800 p-4">
        <Text className="text-center text-xs text-gray-600">Gen Ai Apps</Text>
      </View>
    </View>
  );
}
