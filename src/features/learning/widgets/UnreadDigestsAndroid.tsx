/**
 * The Android home screen widget, via `react-native-android-widget`.
 *
 * `expo-widgets` ships an Android target, but as of 57.0.8 its Glance renderer
 * is a stub that draws the widget's *name* and ignores props entirely, so
 * Android is served by this library instead. The two platforms therefore share
 * the payload and the copy (`./payload`) but not the layout — there is no
 * common rendering primitive between SwiftUI and Glance.
 *
 * These are not React Native views: `FlexWidget`/`TextWidget` compile to a
 * Glance tree, so only the props in this library's own style types apply.
 * No NativeWind, no `View`, no `StyleSheet`.
 */
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { headline, subline, WIDGET_DEEP_LINK, type DigestWidgetData } from './payload';

type Theme = 'light' | 'dark';

const PALETTE = {
  light: { bg: '#FFFFFF', ink: '#11181C', faint: '#6B7280' },
  dark: { bg: '#1C1C1E', ink: '#F2F2F7', faint: '#9CA3AF' },
} as const;

const ACCENT = '#F59E0B';
const CAUGHT_UP = '#22C55E';

export type UnreadDigestsAndroidProps = {
  data: DigestWidgetData;
  theme?: Theme;
  /** Widget width in dp, from `WidgetInfo`. Below this the roadmap line is
   *  dropped rather than allowed to wrap into the count. */
  width?: number;
};

export function UnreadDigestsAndroid({
  data,
  theme = 'light',
  width = 0,
}: UnreadDigestsAndroidProps) {
  const colors = PALETTE[theme];
  const caughtUp = data.count === 0;
  const tint = caughtUp ? CAUGHT_UP : ACCENT;
  // Roughly a 2-cell-wide widget; narrower than this and only the count fits.
  const roomy = width >= 180;

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: WIDGET_DEEP_LINK }}
      accessibilityLabel={`${headline(data)}. ${subline(data)}`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <TextWidget
          text={caughtUp ? '✓' : String(data.count)}
          style={{ fontSize: roomy ? 40 : 32, fontWeight: 'bold', color: tint }}
        />
        <TextWidget
          text={caughtUp ? 'done' : 'waiting'}
          style={{ fontSize: 11, color: colors.faint }}
        />
      </FlexWidget>

      {roomy && (
        <FlexWidget
          style={{
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginLeft: 14,
            flex: 1,
          }}>
          <TextWidget
            text={headline(data)}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 15, fontWeight: 'bold', color: colors.ink }}
          />
          <TextWidget
            text={subline(data)}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 13, color: colors.faint, marginTop: 2 }}
          />
          {!!data.roadmap && (
            <TextWidget
              text={data.roadmap}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}
            />
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
