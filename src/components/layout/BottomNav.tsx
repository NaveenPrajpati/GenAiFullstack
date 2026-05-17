import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_ITEMS = [
  { href: '/', emoji: '🏠', label: 'Home' },
  { href: '/rag-chatbot', emoji: '🤖', label: 'Chatbot' },
  { href: '/summarizer', emoji: '📝', label: 'Summary' },
  { href: '/web-scraper', emoji: '🌐', label: 'Scraper' },
  { href: '/email-assistant', emoji: '✉️', label: 'Email' },
  { href: '/recipe-generator', emoji: '🍳', label: 'Recipe' },
] as const;

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname === '' : pathname === href;

  return (
    <View className="bg-white border-t border-gray-200" style={{ paddingBottom: insets.bottom }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.navigate(item.href)}
              className="items-center py-2 px-4"
              activeOpacity={0.7}>
              <Text className="text-xl">{item.emoji}</Text>
              <Text
                className={`text-xs mt-0.5 ${active ? 'text-indigo-600 font-semibold' : 'text-gray-500'}`}>
                {item.label}
              </Text>
              {active && (
                <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
