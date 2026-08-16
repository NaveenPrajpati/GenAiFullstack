import DrawerContent from '@/components/layout/DrawerContent';
import { useColors } from '@/components/ui/theme';
import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { useWindowDimensions } from 'react-native';

/**
 * The agent suite's own navigator.
 *
 * Everything the supervisor can reach lives here, and only that:
 *
 *  - the RAG chatbot used to be a drawer entry, but it is a separate product
 *    with its own data and its own shell, so it owns `app/(rag)` instead;
 *  - the landing screen used to be this drawer's `index`, but it is the
 *    launcher *for* these apps rather than one of them, so it owns `app/index`.
 *
 * Both are reached by relaunching, not by navigating — see `@/navigation/apps`.
 *
 * The session guard and splash handling stay in the root layout — by the time
 * this mounts there is a token.
 */

/**
 * With the landing screen gone there is no `index` here, so the drawer's
 * default screen has to be named. Without this the anchor falls to whichever
 * route sorts first, which would make the drawer open on the meal planner.
 */
export const unstable_settings = { anchor: 'assistant' };

export default function AgentsLayout() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const isMobile = width <= 800;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },

        headerLeft: () => <DrawerToggleButton tintColor={colors.inkSoft} />,
        drawerStyle: { width: 256, backgroundColor: '#111827' },
        swipeEnabled: isMobile,
        overlayColor: 'rgba(0,0,0,0.5)',
      }}>
      <Drawer.Screen name="assistant" options={{ drawerLabel: 'Assistant', headerShown: false }} />
      <Drawer.Screen
        name="meal-planner"
        options={{ drawerLabel: 'Meal planner', headerShown: false }}
      />
      <Drawer.Screen name="learning" options={{ title: 'Learning', headerShown: false }} />
      <Drawer.Screen
        name="personal-assistant"
        options={{ drawerLabel: 'Personal Assistant', headerShown: false }}
      />
    </Drawer>
  );
}
