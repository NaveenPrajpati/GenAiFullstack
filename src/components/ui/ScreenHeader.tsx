import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { MenuIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PageBody } from './Page';
import { useColors } from './theme';

export default function ScreenHeader({
  title,
  subtitle,
  right,
  children,
  actions,
  showMenu = true,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Screen-level controls — "New chat", section links. */
  right?: ReactNode;
  /** Alias for `right`, kept because several screens already pass this name. */
  actions?: ReactNode;
  /** A nav row or chip strip, laid out under the title. */
  children?: ReactNode;
  showMenu?: boolean;
}) {
  const navigation = useNavigation();
  const colors = useColors();

  return (
    <PageBody className="pt-3 pb-2 md:pt-5">
      <View className="flex-row items-center gap-3">
        {/* The drawer is this app's only navigation, and the learning stack hides
            the native header — without this button there is no way into it on
            web, and only an undiscoverable edge-swipe on a phone. */}
        {showMenu && (
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            className="bg-surface-alt h-10 w-10 items-center justify-center rounded-xl"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open menu">
            <MenuIcon size={18} color={colors.inkSoft} />
          </TouchableOpacity>
        )}

        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="text-ink text-[26px] leading-tight font-extrabold md:text-[28px]">
            {title}
          </Text>
          {typeof subtitle === 'string' ? (
            <Text numberOfLines={1} className="text-ink-soft mt-0.5 text-[13px]">
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>

        {(!!right || !!actions) && (
          <View className="shrink-0 flex-row items-center gap-2">
            {right}
            {actions}
          </View>
        )}
      </View>

      {children}
    </PageBody>
  );
}
