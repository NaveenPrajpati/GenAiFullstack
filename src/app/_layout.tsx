import DrawerContent from '@/components/layout/DrawerContent';
import { useColors, useTheme, useThemeSync } from '@/components/ui/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useLearningStore } from '@/features/learning/store';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import '../../global.css';

// The matching `preventAutoHideAsync` lives in `index.js`, not here: this file
// is loaded by expo-router's `require.context` during render, which is after
// the root view attaches and therefore too late to pin the splash.

function AppDrawer() {
  const { token, isReady } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { width } = useWindowDimensions();
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

  const isMobile = width <= 800;
  const showDrawer = !!token && !inAuth;
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        // headerTitle: 'All apps',
        headerStyle: { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },

        headerLeft: () => <DrawerToggleButton tintColor={colors.inkSoft} />,
        // drawerType: !showDrawer ? 'front' : isMobile ? 'front' : 'permanent',
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: showDrawer && isMobile,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ title: 'Home' }} />
      <Drawer.Screen name="assistant" options={{ drawerLabel: 'Assistant', headerShown: true }} />
      <Drawer.Screen name="rag-chatbot" options={{ headerTitle: 'Rag Chatbot' }} />
      <Drawer.Screen
        name="meal-planner"
        options={{ drawerLabel: 'Meal planner', headerShown: false }}
      />
      <Drawer.Screen name="learning" options={{ title: 'Learning', headerShown: false }} />
      <Drawer.Screen
        name="personal-assistant"
        options={{ drawerLabel: 'Personal Assistant', headerShown: false }}
      />
      <Drawer.Screen
        name="auth"
        options={{ drawerItemStyle: { display: 'none' }, headerShown: false, swipeEnabled: false }}
      />
    </Drawer>
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
      <AppDrawer />
      <Toast />
    </AuthProvider>
  );
}
