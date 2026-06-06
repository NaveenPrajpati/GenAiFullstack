import { usePathname, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_ITEMS = [
  { href: '/', emoji: '🏠', label: 'Home' },
  { href: '/rag-chatbot', emoji: '🤖', label: 'Chatbot' },
  { href: '/meal-planner', emoji: '📝', label: 'Summary' },
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
    <View className="border-t border-gray-200 bg-white" style={{ paddingBottom: insets.bottom }}>
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
              className="items-center px-4 py-2"
              activeOpacity={0.7}>
              <Text className="text-xl">{item.emoji}</Text>
              <Text
                className={`mt-0.5 text-xs ${active ? 'font-semibold text-indigo-600' : 'text-gray-500'}`}>
                {item.label}
              </Text>
              {active && (
                <View className="absolute right-0 bottom-0 left-0 h-0.5 rounded-t-full bg-indigo-600" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
