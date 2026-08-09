/**
 * App entry.
 *
 * This exists only so the Android widget task can be registered alongside
 * expo-router's own entry. `registerWidgetTaskHandler` installs a headless
 * task, which the OS invokes with the app closed — so it has to be registered
 * at module scope here, not from inside a screen.
 */

import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/features/learning/widgets/taskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

// prettier-ignore
import 'expo-router/entry';
