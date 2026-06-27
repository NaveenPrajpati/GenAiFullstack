import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import type { ReactNode } from 'react';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ScreenHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isMobile = width <= 800;
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
        },
      ]}
      className="border-b border-gray-200 bg-white px-5 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-3 pr-2">
          {isMobile && (
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              className="rounded-lg bg-gray-100 px-3 py-2"
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open menu">
              <Text className="text-base text-gray-700">☰</Text>
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">{title}</Text>
            {typeof subtitle === 'string' ? (
              <Text className="mt-0.5 text-sm text-gray-500" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            )}
          </View>
        </View>
        {!!right && <View className="flex-row items-center gap-2">{right}</View>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },

  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});
