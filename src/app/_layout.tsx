import DrawerContent from '@/components/layout/DrawerContent';
import { useColors, useTheme, useThemeSync } from '@/components/ui/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import '../../global.css';
function AppDrawer() {
  const { token, isReady } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { width } = useWindowDimensions();
  const colors = useColors();
  // Remembers the protected route a signed-out user was trying to reach (e.g. a
  // shared /rag-chatbot link) so we can send them there once they log in.
  const pendingRedirect = useRef<string | null>(null);

  // Wait for the navigator to mount before any programmatic navigation
  useEffect(() => {
    setMounted(true);
  }, []);

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
