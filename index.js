/**
 * App entry.
 *
 * Two things have to happen before expo-router takes over, which is why this
 * file exists instead of pointing `main` straight at `expo-router/entry`:
 *
 *  - The native splash has to be pinned. `preventAutoHideAsync` only counts if
 *    it runs before the root view attaches, and a call inside `app/_layout.tsx`
 *    is already too late — expo-router pulls route modules in through
 *    `require.context` while rendering, by which point the splash has gone and
 *    the window behind it is visible.
 *  - The Android widget task has to be registered. The OS invokes it with the
 *    app closed, so it cannot live inside a screen.
 *
 * `expo-router/entry` is `require`d rather than imported so it evaluates after
 * both. ES imports hoist, so an `import` here would run the router first and
 * undo the point of the file.
 */
import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

// Rejects only if the splash is already gone, which is harmless.
SplashScreen.preventAutoHideAsync().catch(() => {});

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/features/learning/widgets/taskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

require('expo-router/entry');
