import { useAuth } from '@/context/AuthContext';
import { useMealPlannerStore } from '@/features/meal-planner/store';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

/**
 * Feature layout. Besides the Stack, it bridges the auth token from React
 * context into the Zustand store so store actions can stay token-free.
 */
export default function MealPlannerLayout() {
  const { token } = useAuth();
  const setAuthToken = useMealPlannerStore((s) => s.setAuthToken);

  useEffect(() => {
    setAuthToken(token);
  }, [token, setAuthToken]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="plan/[id]" />
      <Stack.Screen name="grocery/[id]" />
      <Stack.Screen name="preferences" />
    </Stack>
  );
}
