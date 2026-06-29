import { Stack } from 'expo-router';

export default function LearningLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Roadmap' }} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="digests" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
