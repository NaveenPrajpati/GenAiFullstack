import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

const NAV_ITEMS = [
  { href: '/', emoji: '🏠', label: 'Home', desc: 'Dashboard' },
  { href: '/rag-chatbot', emoji: '🤖', label: 'RAG Chatbot', desc: 'Document Q&A' },
  { href: '/summarizer', emoji: '📝', label: 'Summarizer', desc: 'Text summary' },
  { href: '/web-scraper', emoji: '🌐', label: 'Web Scraper', desc: 'URL to summary' },
  { href: '/email-assistant', emoji: '✉️', label: 'Email Assistant', desc: 'Email helper' },
  { href: '/recipe-generator', emoji: '🍳', label: 'Recipe Generator', desc: 'Cook with AI' },
] as const;

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '' : pathname === href;

  return (
    <View className="w-64 bg-gray-900 flex flex-col" style={{ minHeight: '100%' }}>
      <View className="px-5 py-5 border-b border-gray-800">
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-lg bg-indigo-600 items-center justify-center">
            <Text className="text-white font-bold text-sm">AI</Text>
          </View>
          <View>
            <Text className="text-white font-semibold text-base">AI Toolkit</Text>
            <Text className="text-gray-400 text-xs">Full Stack Apps</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.navigate(item.href)}
              className={`mx-2 my-0.5 px-3 py-2.5 rounded-lg flex-row items-center gap-3 ${active ? 'bg-indigo-600' : ''}`}
              activeOpacity={0.7}>
              <View
                className={`w-8 h-8 rounded-lg items-center justify-center ${active ? 'bg-indigo-500' : 'bg-gray-800'}`}>
                <Text className="text-base">{item.emoji}</Text>
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-gray-300'}`}>
                  {item.label}
                </Text>
                <Text className="text-gray-500 text-xs">{item.desc}</Text>
              </View>
              {active && <View className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View className="p-4 border-t border-gray-800">
        <Text className="text-gray-600 text-xs text-center">Gen Ai Apps</Text>
      </View>
    </View>
  );
}
