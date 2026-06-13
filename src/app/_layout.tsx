import DrawerContent from '@/components/layout/DrawerContent';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useRouter, useSegments } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
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

  useEffect(() => {
    if (!mounted || !isReady) return;
    const inAuth = segments[0] === 'auth';
    if (!token && !inAuth) {
      router.replace('/auth/login');
    } else if (token && inAuth) {
      router.replace('/');
    }
  }, [token, segments, mounted, isReady]);
  const isMobile = width <= 500;
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: isMobile,
        headerTitle: 'All apps',
        headerStyle: { backgroundColor: '#ffffff', elevation: 0, shadowOpacity: 0 },
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor="#374151" />,
        drawerType: isMobile ? 'front' : 'permanent',
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: isMobile,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Home' }} />
      <Drawer.Screen name="rag-chatbot" options={{ headerTitle: 'Rag Chatbot' }} />
      <Drawer.Screen name="meal-planner" options={{ drawerLabel: 'Meal planner' }} />
      <Drawer.Screen name="learning" options={{ drawerLabel: 'Learning', headerTitle: 'Learning' }} />
      <Drawer.Screen name="learning-tracker" options={{ drawerLabel: 'Learning Tracker' }} />
      <Drawer.Screen name="personal-assistant" options={{ drawerLabel: 'Personal Assistant' }} />
      <Drawer.Screen name="web-scraper" options={{ drawerLabel: 'Web Scraper' }} />
      <Drawer.Screen name="email-assistant" options={{ drawerLabel: 'Email Assistant' }} />
      <Drawer.Screen name="recipe-generator" options={{ drawerLabel: 'Recipe Generator' }} />
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
    </AuthProvider>
  );
}
