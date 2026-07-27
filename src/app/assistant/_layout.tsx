import { useAssistantStore } from '@/features/assistant/store';
import { useAuth } from '@/context/AuthContext';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

/**
 * Feature layout. Besides the Stack, it bridges the auth token from React
 * context into the Zustand store so store actions can stay token-free.
 */
export default function AssistantLayout() {
  const { token } = useAuth();
  const setAuthToken = useAssistantStore((s) => s.setAuthToken);

  useEffect(() => {
    setAuthToken(token);
  }, [token, setAuthToken]);

  return (
    <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
