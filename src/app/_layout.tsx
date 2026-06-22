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

  useEffect(() => {
    if (!mounted || !isReady) return;
    if (!token && !inAuth) {
      router.replace('/auth/login');
    } else if (token && inAuth) {
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
        // When hidden, collapse to a non-permanent, non-swipeable drawer.
        drawerType: !showDrawer ? 'front' : isMobile ? 'front' : 'permanent',
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: showDrawer && isMobile,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Home' }} />
      <Drawer.Screen name="rag-chatbot" options={{ headerTitle: 'Rag Chatbot' }} />
      <Drawer.Screen name="meal-planner" options={{ drawerLabel: 'Meal planner' }} />
      <Drawer.Screen
        name="learning"
        options={{ drawerLabel: 'Learning', headerTitle: 'Learning' }}
      />
      <Drawer.Screen name="personal-assistant" options={{ drawerLabel: 'Personal Assistant' }} />
      <Drawer.Screen
        name="auth/login"
        options={{ drawerItemStyle: { display: 'none' }, headerShown: false, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="auth/signup"
        options={{ drawerItemStyle: { display: 'none' }, headerShown: false, swipeEnabled: false }}
      />
      <Drawer.Screen
        name="auth/convert-guest"
        options={{
          drawerItemStyle: { display: 'none' },
          headerTitle: 'Complete Registration',
          swipeEnabled: false,
        }}
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
