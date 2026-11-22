import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL
    || (typeof extra.apiBaseUrl === 'string' ? extra.apiBaseUrl : '')
    || 'https://api.wahywanamaa.com'
);

export const SITE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_SITE_URL
    || (typeof extra.siteUrl === 'string' ? extra.siteUrl : '')
    || 'https://wahywanamaa.com'
);

export const APP_AUDIENCE = 'learner' as const;
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const CLIENT_PLATFORM = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
