import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { colors as lightColors } from '../theme/tokens';

const THEME_KEY = 'wn_teacher_theme_mode';

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  emerald: string;
  emeraldSoft: string;
  gold: string;
  goldSoft: string;
}

const LIGHT_PALETTE: ThemePalette = {
  bg: lightColors.ivory,
  surface: lightColors.white,
  surfaceAlt: lightColors.cream,
  border: lightColors.borderSoft,
  text: lightColors.textPrimary,
  textSecondary: lightColors.textSecondary,
  textTertiary: lightColors.textTertiary,
  emerald: lightColors.emerald,
  emeraldSoft: lightColors.emeraldSoft,
  gold: lightColors.gold,
  goldSoft: lightColors.goldSoft,
};

const DARK_PALETTE: ThemePalette = {
  bg: '#081712',
  surface: '#0F251E',
  surfaceAlt: '#153128',
  border: '#1F4236',
  text: '#F2F6F3',
  textSecondary: '#B3C7BE',
  textTertiary: '#7FA093',
  emerald: '#20A079',
  emeraldSoft: '#153A2E',
  gold: '#E4C282',
  goldSoft: '#2E2616',
};

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  palette: ThemePalette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    void SecureStore.getItemAsync(THEME_KEY)
      .then((saved) => {
        if (active && (saved === 'light' || saved === 'dark')) {
          setMode(saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'light' ? 'dark' : 'light';
      if (Platform.OS !== 'web') {
        void SecureStore.setItemAsync(THEME_KEY, next).catch(() => {});
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      palette: mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE,
      toggleTheme,
    }),
    [mode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { mode: 'light', isDark: false, palette: LIGHT_PALETTE, toggleTheme: () => {} };
  }
  return ctx;
}
