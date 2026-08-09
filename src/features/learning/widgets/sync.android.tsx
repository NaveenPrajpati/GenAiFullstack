/**
 * Android's half of the widget sync.
 *
 * Unlike iOS — where props are pushed straight into the extension — Android
 * re-renders the widget from a *headless JS context* that cannot see the store.
 * So the write is two steps: persist the payload, then ask the system to
 * redraw. `./taskHandler` reads that same persisted payload when the redraw is
 * triggered by the OS instead of by us.
 */
import { requestWidgetUpdate } from 'react-native-android-widget';

import { UnreadDigestsAndroid } from './UnreadDigestsAndroid';
import { saveWidgetData, toWidgetData } from './payload';
import type { Digest } from '../types';

/** Must match the widget `name` in the app.json plugin config. */
export const ANDROID_WIDGET_NAME = 'UnreadDigests';

export function syncDigestWidget(digests: Digest[]): void {
  const data = toWidgetData(digests);

  // Persisting is what makes the OS-driven redraws correct, so it happens even
  // if no widget is currently on the home screen.
  void saveWidgetData(data).then(() =>
    requestWidgetUpdate({
      widgetName: ANDROID_WIDGET_NAME,
      renderWidget: ({ width }) => ({
        light: <UnreadDigestsAndroid data={data} theme="light" width={width} />,
        dark: <UnreadDigestsAndroid data={data} theme="dark" width={width} />,
      }),
      // Nothing to do — the payload is already saved, so whenever a widget is
      // added it renders the current queue immediately.
      widgetNotFound: () => {},
    }).catch(() => {
      // A failed redraw must never surface as an unhandled rejection.
    })
  );
}
