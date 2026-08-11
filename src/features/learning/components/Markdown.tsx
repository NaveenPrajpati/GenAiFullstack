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
import { useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';

import { useColors } from '@/components/ui/theme';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * The chat bubble's Markdown styling, built from the palette rather than fixed.
 *
 * The native renderer takes colours, not class names, so this is the one place
 * in the feature that can't go through a token — which is exactly how it came to
 * be the only surface still painted for light mode. Every assistant message
 * renders through here, so in dark mode that was near-black body text on a
 * near-black bubble.
 *
 * `line` backs both code forms rather than `surface-alt`: the bubble is already
 * surface-alt, and a code block the same colour as what's behind it is not a
 * code block.
 */
function chatStyle(c: ReturnType<typeof useColors>): MarkdownStyle {
  return {
    paragraph: { fontSize: 14, lineHeight: 21, color: c.ink, marginTop: 0, marginBottom: 6 },
    h1: { fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 6, marginBottom: 4 },
    h2: { fontSize: 16, fontWeight: '700', color: c.ink, marginTop: 6, marginBottom: 4 },
    h3: { fontSize: 15, fontWeight: '700', color: c.ink, marginTop: 6, marginBottom: 4 },
    h4: { fontSize: 14, fontWeight: '700', color: c.ink, marginTop: 4, marginBottom: 2 },
    h5: { fontSize: 14, fontWeight: '600', color: c.ink, marginTop: 4, marginBottom: 2 },
    h6: { fontSize: 13, fontWeight: '600', color: c.inkSoft, marginTop: 4, marginBottom: 2 },
    list: {
      fontSize: 14,
      lineHeight: 21,
      color: c.ink,
      markerColor: c.inkFaint,
      bulletColor: c.inkFaint,
      gapWidth: 6,
    },
    strong: { color: c.ink },
    link: { color: c.primary, underline: true },
    code: { fontFamily: MONO, fontSize: 13, color: c.primary, backgroundColor: c.line },
    codeBlock: {
      fontFamily: MONO,
      fontSize: 13,
      backgroundColor: c.line,
      color: c.ink,
      borderRadius: 8,
      padding: 10,
      marginTop: 4,
      marginBottom: 4,
    },
    blockquote: { color: c.inkSoft, borderColor: c.primary, borderWidth: 3, gapWidth: 8 },
  };
}

export function ChatMarkdown({ markdown, streaming }: { markdown: string; streaming?: boolean }) {
  const colors = useColors();
  const chatMarkdownStyle = useMemo(() => chatStyle(colors), [colors]);

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
