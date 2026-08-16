/**
 * Push notifications: registering the device, and acting on a tap.
 *
 * This lives above the navigator rather than on a screen. Registration used to
 * sit in the landing screen's effect, which tied it to visiting the launcher —
 * and since `@/navigation/apps` *replaces* the root entry, that screen unmounts
 * the moment either app is opened. A response listener registered there would
 * be torn down at the same instant, so a notification tapped while the user was
 * inside an app would have nothing left listening for it.
 */
import { apiClient } from '@/context/AuthContext';
import { openAgentsApp } from '@/navigation/apps';
import { UserApis } from '@/services/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { routeForNotification } from './routes';

/**
 * The Android channel every notification is posted to. The name is a contract
 * with the server, which sends `channelId: "default"` on every message: a
 * message whose channel doesn't exist here falls back to one at default
 * importance, which raises no banner and plays no sound — indistinguishable,
 * from the user's side, from a notification that never arrived.
 */
export const ANDROID_CHANNEL_ID = 'default';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // `shouldShowAlert` split into banner + list in expo-notifications SDK 53;
    // both true is the equivalent of the old single flag.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * The device's Expo push token, or null when there won't be one: the web build,
 * a simulator, or a user who declined the permission prompt.
 *
 * All three are ordinary outcomes rather than errors — declining is a choice,
 * and a simulator cannot receive pushes by design — so none of them interrupts
 * the user. The previous version raised an `alert()` for the last two, which
 * fired on every cold start in a simulator and nagged anyone who had already
 * said no once.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  const granted =
    existing === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
  if (!granted) return null;

  // projectId is auto-resolved in dev, but MUST be passed explicitly in
  // standalone/preview builds or getExpoPushTokenAsync() throws.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] missing EAS projectId — cannot obtain a push token');
    return null;
  }

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/**
 * Keeps the backend's copy of this device's push token current, and routes a
 * tapped notification to the screen it refers to.
 *
 * @param token the session. Registration is pointless without one — the endpoint
 *   maps the push token to a user via the auth header — and so is navigation,
 *   which would only bounce off the login redirect.
 * @param canNavigate whether the navigator has mounted and the current route
 *   already agrees with the session. Navigating before then is how a deep link
 *   ends up replaced by the landing screen a frame later, when the root's own
 *   session redirect resolves.
 */
export function usePushNotifications({
  token,
  canNavigate,
}: {
  token: string | null;
  canNavigate: boolean;
}) {
  // A tap and the readiness to act on it arrive in either order — a cold start
  // resolves the notification long before the session, a tap on an app already
  // running long after. Both are held in refs and reconciled by `flush`, so
  // neither has to re-render anything to reach the other.
  const pendingRoute = useRef<string | null>(null);
  const ready = canNavigate && !!token;
  const readyRef = useRef(ready);

  const flush = useCallback(() => {
    const route = pendingRoute.current;
    if (!route || !readyRef.current) return;
    pendingRoute.current = null;
    // Every notification target lives inside `(agents)`, and crossing into that
    // world is a launch rather than a push — see `@/navigation/apps`.
    openAgentsApp(route);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getDevicePushToken()
      .then((pushToken) => {
        if (!pushToken || cancelled) return;
        // Mapped to the user server-side via the auth header, so the device is
        // re-registered whenever the session changes hands.
        return apiClient(token).patch(UserApis.pushToken, { expo_push_token: pushToken });
      })
      .catch((err) => console.warn('[push] token registration failed', err));

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    // A cold start can surface the same tap twice — once through the stored
    // last-response, once through the listener, if it registers in time — and
    // the two would race to navigate. Identity is per session only; the stored
    // response is dealt with by clearing it below.
    const seen = new Set<string>();

    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || !active) return;
      const id = response.notification.request.identifier;
      if (seen.has(id)) return;
      seen.add(id);
      const route = routeForNotification(response.notification.request.content.data);
      // Null means the payload named nothing this build knows how to open. The
      // tap has already foregrounded the app, which is the whole of what an
      // unrecognised notification promises.
      if (!route) return;
      pendingRoute.current = route;
      flush();
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handle);

    // A tap that *launched* the app happened before the listener above existed,
    // so it has to be collected after the fact — this is the read that makes a
    // notification work from a cold start rather than only from the background.
    handle(Notifications.getLastNotificationResponse());
    // And then dropped, or it would be selected again on every later launch:
    // the stored response outlives the process that handled it.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});

    return () => {
      active = false;
      subscription.remove();
    };
  }, [flush]);

  // The gate opening is the other half of the reconciliation: a tap that landed
  // while the app was still deciding whether to show the login screen is
  // delivered here instead, once the route has stopped moving.
  useEffect(() => {
    readyRef.current = ready;
    flush();
  }, [ready, flush]);
}
