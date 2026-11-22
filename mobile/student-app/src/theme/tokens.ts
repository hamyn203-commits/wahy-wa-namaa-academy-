import { Platform, ViewStyle } from 'react-native';

/**
 * Wahy Wa Namaa Academy — Official Brand Design Tokens (Mobile v1.1)
 * Mirrors src/styles/brand.css with Cairo Arabic typography and soft layered depth.
 */
export const colors = {
  emerald: '#0F6B4F',
  emeraldLight: '#178865',
  emeraldDark: '#0A4A37',
  emeraldDeep: '#073528',
  emeraldNight: '#05271D',
  emeraldSoft: '#E7F3EE',
  teal: '#3B9C8E',
  tealSoft: '#E6F5F3',
  mint: '#D8EDE6',
  mintSoft: '#EEF7F3',

  ivory: '#F8F6F0',
  ivoryDeep: '#EFECE2',
  cream: '#FDFCF8',
  gold: '#D4AF6B',
  goldBright: '#E4C282',
  goldDark: '#8F6B2A',
  goldSoft: '#FBF3E2',
  sand: '#E8DCC3',
  white: '#FFFFFF',

  textPrimary: '#13241D',
  textSecondary: '#4B5B53',
  textTertiary: '#73827A',
  textInverse: '#FBFAF5',

  border: '#E6E0D0',
  borderSoft: '#EFEADF',
  borderStrong: '#D5CCB6',
  borderMint: '#C5E1D6',

  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warning: '#B54708',
  warningSoft: '#FEF3C7',
  success: '#0F6B4F',
  successSoft: '#E7F3EE',
  info: '#1D4ED8',
  infoSoft: '#EFF6FF',
} as const;

export const fonts = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semiBold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
  quran: 'Amiri_400Regular',
  quranBold: 'Amiri_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const shadows: Record<'card' | 'elevated' | 'gold' | 'tabBar', ViewStyle> = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#073528',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: { elevation: 2 },
    default: {},
  }) || {},
  elevated: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#073528',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    android: { elevation: 5 },
    default: {},
  }) || {},
  gold: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#8F6B2A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },
    android: { elevation: 4 },
    default: {},
  }) || {},
  tabBar: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#073528',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: { elevation: 10 },
    default: {},
  }) || {},
};

/** Minimum 48dp touch target per Android Material Design 3 guidelines */
export const TOUCH_MIN = 48;
