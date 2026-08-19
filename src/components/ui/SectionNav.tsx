import { DrawerActions } from 'expo-router/react-navigation';
import { useNavigation, usePathname, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

export type NavItem = { label: string; href: string };

/** The learning section's destinations, in the order the design lists them.
 *  Insights sits after Notes: it's something to read about yourself, not a place
 *  work gets done, so it belongs with the reference material rather than up with
 *  Today and Roadmaps. */
export const LEARNING_NAV: NavItem[] = [
  { label: 'Today', href: '/learning' },
  { label: 'Roadmaps', href: '/learning/roadmaps' },
  // Third because it is a *doing* screen, and the only one that works on a day
  // with nothing waiting — the others below are records to read.
  { label: 'Practice', href: '/learning/practice' },
  { label: 'Digests', href: '/learning/digests' },
  { label: 'Notes', href: '/learning/notes' },
  { label: 'Insights', href: '/learning/misconceptions' },
  { label: 'Settings', href: '/learning/settings' },
  // Last, and deliberately so: it explains the rules — why a topic won't tick
  // off, why a retry is held back — which is something you go looking for once
  // you've met one of them, not the first thing anyone should be reading.
  { label: 'Help', href: '/learning/help' },
];

/**
 * Where the nav switches from a pill row to a sidebar.
 *
 * A width check rather than a `web:` variant, because the thing that decides
 * which layout works is how much room there is, not which platform is running:
 * a browser window dragged narrow needs the pills, and a tablet in landscape is
 * as good a home for the sidebar as a desktop.
 */
export const SIDEBAR_BREAKPOINT = 768;

export function useWideNav() {
  return useWindowDimensions().width >= SIDEBAR_BREAKPOINT;
}

/** Exact match: a roadmap detail route (/learning/<id>) is not "Today", and
 *  nothing in the nav should light up for it. */
function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href;
}

/**
 * Section switcher for narrow screens — the horizontal pills. Renders nothing
 * once the sidebar takes over, so screens can keep passing it to `ScreenHeader`
 * unconditionally instead of each repeating the breakpoint check.
 *
 * It scrolls sideways rather than wrapping: a wrapped second line pushes page
 * content down by a whole row on exactly the narrow screens that can least
 * afford it.
 */
export default function SectionNav({ items = LEARNING_NAV }: { items?: NavItem[] }) {
  const router = useRouter();
  const isActive = useIsActive();
  const wide = useWideNav();

  if (wide) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-3 -mb-1"
      contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <TouchableOpacity
            key={item.href}
            // `navigate` returns to an existing screen instead of pushing a
            // second copy of it onto the stack.
            onPress={() => router.navigate(item.href as any)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`rounded-full border px-3.5 py-1.5 ${
              active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}>
            <Text
              className={`text-[13px] font-semibold ${active ? 'text-primary' : 'text-ink-soft'}`}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * The same five destinations as a left rail, for screens wide enough to spend
 * 224px on navigation. Mounted once by the learning layout, so it stays put
 * while the screen beside it changes.
 */
export function SectionSidebar({
  items = LEARNING_NAV,
  title = 'Learning',
}: {
  items?: NavItem[];
  title?: string;
}) {
  const router = useRouter();
  const isActive = useIsActive();
  const navigation = useNavigation();

  return (
    <View className="border-line bg-surface w-56 border-r px-3 py-5">
      <Text className="text-ink mb-1 px-2 text-[20px] font-extrabold">{title}</Text>

      {/* The way out of the section. On a wide screen the stack's back arrow is
          hidden — these are lateral moves — so without this the app drawer would
          be unreachable from every screen but Today. */}
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        className="mb-4 px-2 py-1">
        <Text className="text-ink-faint text-[13px] font-medium">☰ All apps</Text>
      </TouchableOpacity>

      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <TouchableOpacity
            key={item.href}
            onPress={() => router.navigate(item.href as any)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`mb-1 rounded-lg px-3 py-2.5 ${active ? 'bg-primary-soft' : ''}`}>
            <Text
              className={`text-[15px] ${
                active ? 'text-primary font-bold' : 'text-ink-soft font-medium'
              }`}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
