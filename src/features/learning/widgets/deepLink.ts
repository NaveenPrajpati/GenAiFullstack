/**
 * Where a widget tap sends you — read off the running app rather than fixed.
 *
 * Dev, preview and production are separate installs with separate schemes (see
 * `VARIANTS` in app.config.js). A scheme is claimed per install, not per package
 * id, so if all three declared `aiapps://` the OS would be free to route a tap
 * to whichever one it decided owned the scheme: tapping the dev widget could
 * open production, against production's data.
 *
 * This sits outside `./payload` deliberately. That module is the serialisable
 * record the widget renders from, and keeps itself to plain data; this is a
 * build-time constant that happens to be read at runtime.
 */
import Constants from 'expo-constants';

/** The catch-up screen — `/learning`, hostless, hence the third slash. */
const WIDGET_PATH = '/learning';

/**
 * Production's scheme, used when the config can't be read.
 *
 * That means a context with no native Constants module, which in practice is
 * the iOS widget extension — bundled separately from the app. expo-constants
 * warns rather than throws there, so this keeps the one variant whose scheme it
 * actually is correct, and leaves iOS exactly where it was before variants.
 */
const FALLBACK_SCHEME = 'aiapps';

function appScheme(): string {
  // `scheme` is allowed to be declared as an array; the first is canonical.
  const configured = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configured) ? configured[0] : configured;
  return scheme || FALLBACK_SCHEME;
}

export const WIDGET_DEEP_LINK = `${appScheme()}://${WIDGET_PATH}`;
