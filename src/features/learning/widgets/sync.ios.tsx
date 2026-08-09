/**
 * The iOS home screen / Lock Screen widget, via `expo-widgets`.
 *
 * The layout function is marked `'widget'`, which is what lets it be bundled
 * separately and evaluated inside the WidgetKit extension rather than in the
 * app. That has a hard consequence: it may only use `@expo/ui/swift-ui` and its
 * own props. No Zustand, no fetch, no NativeWind — none of that exists in the
 * extension. All state arrives as `props`, pushed by `syncDigestWidget`.
 *
 * This file is `.ios.tsx` on purpose: `@expo/ui/swift-ui` resolves to SwiftUI
 * source that requires native views, so importing it on Android would throw at
 * module scope. Metro picks the platform sibling instead.
 */
import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import {
  badge,
  badgeCaption,
  headline,
  subline,
  tone,
  toWidgetData,
  WIDGET_DEEP_LINK,
  type DigestWidgetData,
} from './payload';
import type { Digest } from '../types';

/** Must match the `name` in the `expo-widgets` plugin config in app.json. */
const WIDGET_NAME = 'UnreadDigests';

// The queue count is the one thing readable at a glance, so it carries the
// accent; everything else is deliberately secondary. Grey for `unsynced`, so a
// widget with no data never reads as a real result.
const TINT = {
  waiting: '#F59E0B',
  caughtUp: '#22C55E',
  unsynced: '#8E8E93',
} as const;

function UnreadDigestsLayout(props: DigestWidgetData, environment: WidgetEnvironment) {
  'widget';

  const tint = TINT[tone(props)];

  // Lock Screen accessory families are monochrome and tiny — a count and a
  // word is all that survives at that size.
  if (environment.widgetFamily === 'accessoryInline') {
    return <Text>{headline(props)}</Text>;
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(WIDGET_DEEP_LINK)]}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{headline(props)}</Text>
        <Text modifiers={[font({ size: 12 }), lineLimit(1)]}>{subline(props)}</Text>
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={14} modifiers={[padding({ all: 16 }), widgetURL(WIDGET_DEEP_LINK)]}>
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 44, weight: 'bold' }), foregroundStyle(tint)]}>
            {badge(props)}
          </Text>
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#8E8E93')]}>
            {badgeCaption(props)}
          </Text>
        </VStack>

        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>
            {headline(props)}
          </Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('#8E8E93'), lineLimit(2)]}>
            {subline(props)}
          </Text>
          {!!props.roadmap && (
            <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93'), lineLimit(1)]}>
              {props.roadmap}
            </Text>
          )}
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // systemSmall — the default. Only the count and the topic fit.
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[padding({ all: 14 }), widgetURL(WIDGET_DEEP_LINK)]}>
      <Text modifiers={[font({ size: 40, weight: 'bold' }), foregroundStyle(tint)]}>
        {badge(props)}
      </Text>
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>
        {headline(props)}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93'), lineLimit(2)]}>
        {subline(props)}
      </Text>
    </VStack>
  );
}

const widget = createWidget<DigestWidgetData>(WIDGET_NAME, UnreadDigestsLayout);

/**
 * Pushes the current queue to the widget.
 *
 * `updateSnapshot` rather than `updateTimeline`: the queue changes when the
 * learner acts or the server drips a new digest, neither of which is on a clock
 * we could schedule ahead of time.
 */
export function syncDigestWidget(digests: Digest[]): void {
  try {
    widget.updateSnapshot(toWidgetData(digests));
  } catch {
    // Never let a widget refresh take a screen down with it.
  }
}
