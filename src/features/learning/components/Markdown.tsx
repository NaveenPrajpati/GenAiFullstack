/**
 * Chat-themed wrapper around `EnrichedMarkdownText` (react-native-enriched-markdown).
 *
 * Centralizes the Markdown styling used by the learning chat bubbles so every
 * assistant message renders consistently. Pass `streaming` while tokens are
 * still arriving — the native renderer fades in newly appended text, which is
 * the library's recommended LLM-streaming affordance (no manual cursor needed).
 *
 * Note: this is a native Fabric component, so it renders in a dev/release build
 * (and on web), not in Expo Go.
 */
import { Linking, Platform } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

// Tuned to match the chat bubbles: 14px gray-800 body, gray-900 headings/bold,
// violet inline code and links, dark code blocks.
const chatMarkdownStyle: MarkdownStyle = {
  paragraph: { fontSize: 14, lineHeight: 21, color: '#1f2937', marginTop: 0, marginBottom: 6 },
  h1: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 6, marginBottom: 4 },
  h2: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 6, marginBottom: 4 },
  h3: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 6, marginBottom: 4 },
  h4: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4, marginBottom: 2 },
  h5: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 4, marginBottom: 2 },
  h6: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4, marginBottom: 2 },
  list: {
    fontSize: 14,
    lineHeight: 21,
    color: '#1f2937',
    markerColor: '#6b7280',
    bulletColor: '#6b7280',
    gapWidth: 6,
  },
  strong: { color: '#111827' },
  link: { color: '#6d28d9', underline: true },
  code: { fontFamily: MONO, fontSize: 13, color: '#6d28d9', backgroundColor: '#f5f3ff' },
  codeBlock: {
    fontFamily: MONO,
    fontSize: 13,
    backgroundColor: '#1f2937',
    color: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  blockquote: { color: '#4b5563', borderColor: '#ddd6fe', borderWidth: 3, gapWidth: 8 },
};

export function ChatMarkdown({ markdown, streaming }: { markdown: string; streaming?: boolean }) {
  // `streamingAnimation` is a native-only affordance. The web renderer forwards
  // unknown props straight onto its <div>, so passing it there triggers React's
  // "unrecognized DOM attribute" warning — omit it off native.
  const nativeOnlyProps = Platform.OS === 'web' ? {} : { streamingAnimation: !!streaming };
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      markdownStyle={chatMarkdownStyle}
      {...nativeOnlyProps}
      allowTrailingMargin={false}
      selectable
      onLinkPress={(e) => Linking.openURL(e.url).catch(() => {})}
    />
  );
}
