import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { Drawer } from 'expo-router/drawer';
import DrawerContent from '@/components/layout/DrawerContent';
import { DrawerToggleButton } from '@react-navigation/drawer';
import '../../global.css';
export default function MainLayout() {
  const isWeb = Platform.OS === 'web';

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: !isWeb,
        headerTitle: 'All apps',
        headerStyle: { backgroundColor: '#ffffff', elevation: 0, shadowOpacity: 0 },
        headerShadowVisible: false,
        headerLeft: () => <DrawerToggleButton tintColor="#374151" />,
        drawerType: isWeb ? 'permanent' : 'front',
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: !isWeb,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Home' }} />
      <Drawer.Screen name="rag-chatbot" options={{ drawerLabel: 'RAG Chatbot' }} />
      <Drawer.Screen name="summarizer" options={{ drawerLabel: 'Summarizer' }} />
      <Drawer.Screen name="web-scraper" options={{ drawerLabel: 'Web Scraper' }} />
      <Drawer.Screen name="email-assistant" options={{ drawerLabel: 'Email Assistant' }} />
      <Drawer.Screen name="recipe-generator" options={{ drawerLabel: 'Recipe Generator' }} />
    </Drawer>
  );
}
