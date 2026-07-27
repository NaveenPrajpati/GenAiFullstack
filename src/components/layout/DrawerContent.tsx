import { useAuth } from '@/context/AuthContext';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { usePathname, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';

interface NavItem {
  href: string;
  emoji: string;
  label: string;
  desc: string;
  /** The Assistant's skills. Nested to show they belong to it — each is still
   *  its own route, so it stays usable on its own. */
  children?: NavItem[];
}

/**
 * Two top-level products: the RAG chatbot (your documents) and the Assistant
 * (the supervisor over three agents). RAG is deliberately a peer, not a skill —
 * it has its own data and interaction model.
 *
 * Home isn't listed: tapping the "AI Toolkit" header goes there.
 */
const NAV_ITEMS: NavItem[] = [
  { href: '/rag-chatbot', emoji: '🤖', label: 'RAG Chatbot', desc: 'Chat with your documents' },
  {
    href: '/assistant',
    emoji: '✨',
    label: 'Assistant',
    desc: 'One chat, every skill',
    children: [
      { href: '/learning', emoji: '🎓', label: 'Learning', desc: 'Roadmaps & AI tutor' },
      {
        href: '/personal-assistant',
        emoji: '🪄',
        label: 'Personal Assistant',
        desc: 'Tasks, agenda & notes',
      },
      { href: '/meal-planner', emoji: '🥗', label: 'Meal Planner', desc: 'Plan your weekly diet' },
    ],
  },
];

function NavRow({
  item,
  active,
  nested,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  nested?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`my-0.5 flex-row items-center gap-3 rounded-lg px-3 ${
        nested ? 'py-2' : 'py-2.5'
      } ${active ? 'bg-indigo-600' : ''}`}
      activeOpacity={0.7}
      accessibilityRole="button">
      <View
        className={`${nested ? 'h-7 w-7' : 'h-8 w-8'} items-center justify-center rounded-lg ${
          active ? 'bg-indigo-500' : 'bg-gray-800'
        }`}>
        <Text className={nested ? 'text-sm' : 'text-base'}>{item.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text
          className={`${nested ? 'text-[13px]' : 'text-sm'} font-medium ${
            active ? 'text-white' : 'text-gray-300'
          }`}>
          {item.label}
        </Text>
        <Text className={`${nested ? 'text-[10px]' : 'text-xs'} text-gray-500`}>{item.desc}</Text>
      </View>
      {active && <View className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
    </TouchableOpacity>
  );
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${m}m`;
}

function getInitials(user: { first_name?: string; last_name?: string; name?: string }): string {
  if (user.first_name && user.last_name) {
    return (user.first_name[0] + user.last_name[0]).toUpperCase();
  }
  if (user.name) return user.name.slice(0, 2).toUpperCase();
  return 'U';
}

export default function DrawerContent(props: DrawerContentComponentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [expiry, setExpiry] = useState(() => formatExpiry(user?.expires_at ?? null));

  // OTA update state: idle → available → updating
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'updating'>('idle');

  // Check for an OTA update on mount (no-op in dev / Expo Go)
  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!cancelled && result.isAvailable) setUpdateStatus('available');
      } catch {
        // Offline or no update channel — ignore silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyUpdate = useCallback(async () => {
    if (updateStatus === 'updating') return;
    setUpdateStatus('updating');
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      // Download/reload failed — let the user retry
      setUpdateStatus('available');
    }
  }, [updateStatus]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleNavigate = (href: string) => {
    router.navigate(href);
    if (Platform.OS !== 'web') props.navigation.closeDrawer();
  };

  // Refresh expiry label every minute for guest users
  useEffect(() => {
    if (!user?.is_guest || !user.expires_at) return;
    setExpiry(formatExpiry(user.expires_at));
    const id = setInterval(() => setExpiry(formatExpiry(user.expires_at!)), 60_000);
    return () => clearInterval(id);
  }, [user]);

  return (
    <View className="flex-1 bg-gray-800" style={{ paddingTop: Platform.OS !== 'web' ? 40 : 0 }}>
      {/* Header — doubles as the Home link, so Home needs no nav row. */}
      <TouchableOpacity
        onPress={() => handleNavigate('/')}
        className={`border-b border-gray-700 px-5 py-4 ${isActive('/') ? 'bg-gray-700/40' : ''}`}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Go to home">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <Text className="text-sm font-bold text-white">AI</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-white">AI Toolkit</Text>
            <Text className="text-xs text-gray-400">
              {isActive('/') ? 'Home' : 'Tap for home'}
            </Text>
          </View>
          {isActive('/') && <View className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
        </View>
      </TouchableOpacity>

      {/* User profile section */}
      {user && (
        <View className="border-b border-gray-700 px-4 py-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-500">
              <Text className="text-sm font-bold text-white">{getInitials(user)}</Text>
            </View>
            <View className="flex-1 overflow-hidden">
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            {user.is_guest && (
              <View className="rounded-md bg-amber-500/20 px-2 py-0.5">
                <Text className="text-xs font-medium text-amber-400">Guest</Text>
              </View>
            )}
          </View>

          {/* Guest expiry + verify email CTA */}
          {user.is_guest && (
            <View className="mt-3 rounded-xl bg-gray-700 p-3">
              <View className="mb-2 flex-row items-center gap-1.5">
                <Text className="text-xs text-amber-400">⏱ {expiry}</Text>
              </View>
              <Text className="mb-2.5 text-xs leading-relaxed text-gray-400">
                Save your session — create a free account before it expires.
              </Text>
              <TouchableOpacity
                onPress={() => handleNavigate('/auth/convert-guest')}
                className="items-center rounded-lg bg-indigo-600 py-2"
                activeOpacity={0.8}>
                <Text className="text-xs font-semibold text-white">Verify Email & Upgrade</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Nav items */}
      <DrawerContentScrollView
        // {...props}
        contentContainerStyle={{ flexGrow: 1 }}
        style={{ backgroundColor: 'transparent' }}>
        {NAV_ITEMS.map((item) => (
          <View key={item.href}>
            <NavRow
              item={item}
              active={isActive(item.href)}
              onPress={() => handleNavigate(item.href)}
            />
            {/* Skills, indented under the Assistant they belong to. The rule on
                the left ties them to it; they remain individually tappable. */}
            {!!item.children?.length && (
              <View className="mb-1 ml-7 border-l border-gray-700 pl-2">
                {item.children.map((child) => (
                  <NavRow
                    key={child.href}
                    item={child}
                    nested
                    active={isActive(child.href)}
                    onPress={() => handleNavigate(child.href)}
                  />
                ))}
              </View>
            )}
          </View>
        ))}
      </DrawerContentScrollView>

      {/* OTA update banner */}
      {updateStatus !== 'idle' && (
        <View className="border-t border-gray-700 px-4 pt-3">
          <TouchableOpacity
            onPress={handleApplyUpdate}
            disabled={updateStatus === 'updating'}
            className="flex-row items-center gap-3 rounded-xl bg-emerald-600/20 px-3 py-2.5"
            activeOpacity={0.8}>
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              {updateStatus === 'updating' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-base">⬇️</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-emerald-300">
                {updateStatus === 'updating' ? 'Updating…' : 'Update available'}
              </Text>
              <Text className="text-xs text-emerald-400/70">
                {updateStatus === 'updating'
                  ? 'Downloading & restarting'
                  : 'Tap to update to the latest version'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout */}
      <View className="border-t border-gray-700 p-4">
        <TouchableOpacity
          onPress={logout}
          className="flex-row items-center gap-3 rounded-lg px-3 py-2.5"
          activeOpacity={0.7}>
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-gray-800">
            <Text className="text-base">🚪</Text>
          </View>
          <Text className="text-sm font-medium text-gray-400">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
