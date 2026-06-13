import { Stack } from 'expo-router';

export default function LearningLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="digests" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
