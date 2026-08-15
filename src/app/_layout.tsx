import { useColors, useTheme, useThemeSync } from '@/components/ui/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/features/learning/store';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import '../../global.css';

// The matching `preventAutoHideAsync` lives in `index.js`, not here: this file
// is loaded by expo-router's `require.context` during render, which is after
// the root view attaches and therefore too late to pin the splash.

/**
 * The root holds no chrome of its own — just the session guard and four
 * mutually exclusive worlds:
 *
 *  - `index`    — the landing screen, a launcher for the two apps below. It is
 *                 deliberately not inside either one: it has no drawer over it
 *                 and nothing behind it.
 *  - `(agents)` — the drawer app: the supervisor and its three skills.
 *  - `(rag)`    — the RAG chatbot, which is its own product with its own
 *                 sidebar, and deliberately has no drawer behind it.
 *  - `auth`     — the signed-out flow.
 *
 * Route groups keep the URLs unchanged (`/`, `/assistant`, `/rag-chatbot`), so
 * this split is invisible to links and deep links. Switching worlds goes
 * through `@/navigation/apps`, which replaces rather than pushes — see there
 * for why crossing between them intentionally leaves nothing to go back to.
 */
function RootNavigator() {
  const { token, isReady } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const colors = useColors();
  const themeHydrated = useTheme((s) => s.hydrated);
  // Remembers the protected route a signed-out user was trying to reach (e.g. a
  // shared /rag-chatbot link) so we can send them there once they log in.
  const pendingRedirect = useRef<string | null>(null);

  // Wait for the navigator to mount before any programmatic navigation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Seed the home screen widget once there's a session.
  //
  // The widget renders whatever the store last pushed, and the only thing that
  // populated the store was the Learning screen's focus effect — so a learner
  // who never opened that tab saw a widget insisting there was nothing to read.
  // Fetching here ties the widget to having an account rather than to which
  // screen happened to be visited.
  useEffect(() => {
    if (!isReady || !token) return;
    useLearningStore.getState().fetchUnreadDigests();
  }, [isReady, token]);

  // `auth` is the one top-level route outside a group, so this reads the same
  // as it did before the split.
  const inAuth = segments[0] === 'auth';
  // Some auth routes are visited *while authenticated*: a logged-in guest upgrades
  // via convert-guest, and a freshly-signed-up user may verify their email. Both
  // must be exempt from the "token → leave auth" redirect.
  const onAuthedAuthRoute =
    inAuth && (segments.includes('convert-guest') || segments.includes('verify-email'));

  useEffect(() => {
    if (!mounted || !isReady) return;
    if (!token && !inAuth) {
      // Stash the intended destination (skip the home route — that's the default).
      if (pathname && pathname !== '/') pendingRedirect.current = pathname;
      router.replace('/auth/login');
    } else if (token && inAuth && !onAuthedAuthRoute) {
      const target = pendingRedirect.current ?? '/';
      pendingRedirect.current = null;
      router.replace(target);
    }
  }, [token, segments, mounted, isReady]);

  // The route the redirect above is steering toward has been reached.
  //
  // That redirect runs in an effect, so a signed-out launch renders `/` for a
  // beat before replacing it with the login screen. Lifting the splash on
  // `isReady` alone would expose that intermediate screen, so the splash waits
  // for the route to agree with the session.
  const routeSettled = token ? !inAuth || onAuthedAuthRoute : inAuth;

  // Everything the first frame depends on is now known: the session, the saved
  // theme, and the route. Anything slower than this — the widget seed, stats,
  // digests — is allowed to stream in behind a screen the user can already see.
  useEffect(() => {
    if (mounted && isReady && themeHydrated && routeSettled) {
      // One frame of headroom so the content is actually committed before the
      // splash lifts; hiding in the same tick still reveals an empty window.
      const frame = requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
      return () => cancelAnimationFrame(frame);
    }

    // Failsafe. Gating the splash on four conditions means any one of them
    // hanging — an auth call that never returns, a redirect that can't settle —
    // would strand the user on the splash with no way forward. A brief empty
    // frame is recoverable; an app that never starts is not.
    const bail = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 5000);
    return () => clearTimeout(bail);
  }, [mounted, isReady, themeHydrated, routeSettled]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Each child is a whole app. A push animation would frame the switch as
        // a drill-down you can swipe out of; a cross-fade reads as a relaunch,
        // which is what it is. The gesture is off for the same reason — with
        // one entry on this stack there is nothing behind to reveal.
        animation: 'fade',
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(agents)" />
      <Stack.Screen name="(rag)" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}

export default function MainLayout() {
  // Restores the saved light/dark choice and, until one is made, keeps the app
  // tied to the OS. Mounted above the navigator so the first paint is already
  // in the right direction.
  useThemeSync();
  const scheme = useTheme((s) => s.scheme);

  return (
    <AuthProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <Toast />
    </AuthProvider>
  );
}
