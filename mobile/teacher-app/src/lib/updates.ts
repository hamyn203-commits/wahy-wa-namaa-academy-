import * as Updates from 'expo-updates';
import { api } from './api';
import { APP_AUDIENCE, APP_VERSION, CLIENT_PLATFORM } from './config';

export interface BinaryUpdateStatus {
  app: string;
  platform: string;
  currentVersion: string;
  latestVersion: string;
  minVersion: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
  downloadUrl: string;
  releaseNotes?: {
    ar?: string;
    en?: string;
  };
}

export interface UpdateCheckResult {
  otaDownloaded: boolean;
  binary: BinaryUpdateStatus | null;
}

export async function checkAndFetchOtaUpdate(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) {
    return false;
  }
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    return Boolean(fetched.isNew);
  } catch {
    return false;
  }
}

export async function reloadToApplyOtaUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  await Updates.reloadAsync();
}

export async function checkBinaryUpdate(): Promise<BinaryUpdateStatus | null> {
  try {
    const query = new URLSearchParams({
      app: APP_AUDIENCE,
      platform: CLIENT_PLATFORM === 'ios' ? 'ios' : 'android',
      version: APP_VERSION,
    });
    return await api.get<BinaryUpdateStatus>(`/api/mobile/config?${query.toString()}`);
  } catch {
    return null;
  }
}

export async function runFullUpdateCheck(): Promise<UpdateCheckResult> {
  const [otaDownloaded, binary] = await Promise.all([
    checkAndFetchOtaUpdate(),
    checkBinaryUpdate(),
  ]);
  return { otaDownloaded, binary };
}
