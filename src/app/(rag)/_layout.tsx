import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * The RAG app's shell.
 *
 * A bare stack on purpose. The screen draws its own sidebar, top bar and
 * insights panel, so a navigator header would be a second, redundant chrome —
 * and a drawer behind it would undo the point of the split. Landing on
 * `/rag-chatbot` should feel like opening a different app, because it is one.
 *
 * The header the drawer used to supply also supplied the status-bar inset, so
 * the safe area is handled here instead.
 */
export default function RagLayout() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* This app is fixed-light regardless of the theme the agent suite is in,
          so the status bar has to be pinned dark or it vanishes into the white
          top bar whenever the user has chosen dark mode. */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f9fafb' },
        }}>
        <Stack.Screen name="rag-chatbot" />
      </Stack>
    </SafeAreaView>
  );
}
