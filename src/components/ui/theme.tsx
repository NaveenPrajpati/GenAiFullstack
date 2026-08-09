import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';

export type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'ui.scheme';

/**
 * Points the token variables in `global.css` at the other direction.
 *
 * Native and web get there differently. Native has a real appearance setting,
 * and `prefers-color-scheme` in the compiled stylesheet answers to it — so
 * `Appearance.setColorScheme` is the whole implementation. The browser has no
 * writable equivalent (react-native-web's Appearance is read-only: calling
 * `setColorScheme` there throws), so web puts a class on <html> instead, which
 * the `:root.dark` / `:root.light` rules key off.
 */
function apply(scheme: Scheme) {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') return; // static render / SSR pass
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(scheme);
    // Keeps scrollbars, form controls and the browser's own chrome in step.
    root.style.colorScheme = scheme;
    return;
  }
  Appearance.setColorScheme(scheme);
}

/**
 * The same values as the CSS variables in `global.css`, for the handful of
 * places that take a colour rather than a class name — `ActivityIndicator`,
 * lucide icons, `StatusBar`. Keep the two in step; the stylesheet is the
 * original and this is the copy.
 */
export const PALETTE = {
  light: {
    bg: '#f4f4ef',
    surface: '#ffffff',
    surfaceAlt: '#f0f0eb',
    line: '#e4e4dc',
    ink: '#16160f',
    inkSoft: '#5c5c55',
    inkFaint: '#8a8a80',
    primary: '#5b5bd6',
    onPrimary: '#ffffff',
    success: '#5f8f57',
    warning: '#c9a93f',
    danger: '#b04a3a',
    streak: '#be8134',
  },
  dark: {
    bg: '#101219',
    surface: '#1a1d26',
    surfaceAlt: '#232733',
    line: '#2c3140',
    ink: '#edeef3',
    inkSoft: '#a9afbf',
    inkFaint: '#7a8194',
    primary: '#8ecae6',
    onPrimary: '#0d1017',
    success: '#7fa972',
    warning: '#d6bc4e',
    danger: '#c86b5c',
    streak: '#d08a48',
  },
} as const;

export function useColors() {
  return PALETTE[useTheme((s) => s.scheme)];
}

const osScheme = (): Scheme => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

type ThemeState = {
  scheme: Scheme;
  /** True once the user has picked a side, which stops the OS from overriding it. */
  pinned: boolean;
  /**
   * True once the saved choice has been read back from storage.
   *
   * Until then `scheme` is only the OS guess, which may be about to be replaced
   * by the opposite value. The splash screen waits on this so the app never
   * paints its first frame in the wrong theme and then flips.
   */
  hydrated: boolean;
  setScheme: (scheme: Scheme) => void;
  toggle: () => void;
};

export const useTheme = create<ThemeState>((set, get) => ({
  scheme: osScheme(),
  pinned: false,
  hydrated: false,
  setScheme: (scheme) => {
    apply(scheme);
    set({ scheme, pinned: true });
    AsyncStorage.setItem(STORAGE_KEY, scheme).catch(() => {});
  },
  toggle: () => get().setScheme(get().scheme === 'dark' ? 'light' : 'dark'),
}));

/**
 * Mount once, above everything. Restores the saved choice, and until one is
 * made keeps following the OS — a device that flips to dark at sunset should
 * take the app with it.
 */
export function useThemeSync() {
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return;
        const pinned = saved === 'dark' || saved === 'light';
        const scheme: Scheme = pinned ? (saved as Scheme) : osScheme();
        apply(scheme);
        // `hydrated` is set even when nothing was saved and even when the read
        // failed: in both cases the OS scheme is the final answer, so there is
        // nothing further to wait for.
        useTheme.setState({ scheme, pinned, hydrated: true });
      });

    // Registered unconditionally, because the choice can also be *cleared*
    // during a session; `pinned` decides whether the event is acted on.
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (useTheme.getState().pinned) return;
      const next: Scheme = colorScheme === 'dark' ? 'dark' : 'light';
      apply(next);
      useTheme.setState({ scheme: next });
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
