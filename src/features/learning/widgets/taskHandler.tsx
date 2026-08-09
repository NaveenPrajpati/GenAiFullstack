/**
 * Android's headless widget task.
 *
 * The OS calls this outside the app — on add, on resize, and on its own update
 * schedule — in a JS context with no store, no navigation and no React tree.
 * That is why it reads the payload back from storage instead of being handed
 * one: at this point there is nothing in memory to hand it.
 *
 * Clicks are not handled here. The widget opens the app through an `OPEN_URI`
 * deep link, which the OS routes for us, so `WIDGET_CLICK` never fires.
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { UnreadDigestsAndroid } from './UnreadDigestsAndroid';
import { loadWidgetData } from './payload';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  // Nothing is rendered for a widget being removed, and reading storage for it
  // would be wasted work.
  if (props.widgetAction === 'WIDGET_DELETED') return;

  const data = await loadWidgetData();
  const { width } = props.widgetInfo;

  props.renderWidget({
    light: <UnreadDigestsAndroid data={data} theme="light" width={width} />,
    dark: <UnreadDigestsAndroid data={data} theme="dark" width={width} />,
  });
}
