import { Stack } from 'expo-router';

/**
 * Dedicated auth stack. Lives outside the app Drawer so the unauthenticated
 * flow (login, signup, password recovery, guest upgrade) has its own navigation
 * history without any drawer chrome. The root layout's guard sends users here
 * whenever there is no session token.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="convert-guest" options={{ headerShown: false }} />
    </Stack>
  );
}
