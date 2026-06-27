import DrawerContent from '@/components/layout/DrawerContent';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useRouter, useSegments } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Toast from 'react-native-toast-message';
import '../../global.css';
function AppDrawer() {
  const { token, isReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { width } = useWindowDimensions();

  // Wait for the navigator to mount before any programmatic navigation
  useEffect(() => {
    setMounted(true);
  }, []);

  const inAuth = segments[0] === 'auth';
  // convert-guest is an authenticated auth route: a logged-in guest visits it to
  // upgrade, so it must be exempt from the "token → leave auth" redirect.
  const onConvertGuest = inAuth && segments.includes('convert-guest');

  useEffect(() => {
    if (!mounted || !isReady) return;
    if (!token && !inAuth) {
      router.replace('/auth/login');
    } else if (token && inAuth && !onConvertGuest) {
      router.replace('/');
    }
  }, [token, segments, mounted, isReady]);
  const isMobile = width <= 800;
  const showDrawer = !!token && !inAuth;
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: showDrawer && isMobile,
        headerTitle: 'All apps',
        headerStyle: { backgroundColor: '#ffffff', elevation: 0, shadowOpacity: 0 },
        headerShadowVisible: false,

        headerLeft: () => <DrawerToggleButton tintColor="#374151" />,
        drawerType: !showDrawer ? 'front' : isMobile ? 'front' : 'permanent',
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: showDrawer && isMobile,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Home' }} />
      <Drawer.Screen name="rag-chatbot" options={{ headerTitle: 'Rag Chatbot' }} />
      <Drawer.Screen
        name="meal-planner"
        options={{ drawerLabel: 'Meal planner', headerShown: false }}
      />
      <Drawer.Screen name="learning" options={{ drawerLabel: 'Learning', headerShown: false }} />
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
  return (
    <AuthProvider>
      <AppDrawer />
      <Toast />
    </AuthProvider>
  );
}
