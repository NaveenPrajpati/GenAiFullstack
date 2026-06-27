import { useAuth } from '@/context/AuthContext';
import { usePersonalAssistantStore } from '@/features/personal-assistant/store';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

/**
 * Feature layout. Besides the Stack, it bridges the auth token from React
 * context into the Zustand store so store actions can stay token-free.
 */
export default function PersonalAssistantLayout() {
  const { token } = useAuth();
  const setAuthToken = usePersonalAssistantStore((s) => s.setAuthToken);

  useEffect(() => {
    setAuthToken(token);
  }, [token, setAuthToken]);

  return (
    <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="task/[id]" />
      <Stack.Screen name="agenda" />
      <Stack.Screen name="notes" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
