import * as FileSystem from 'expo-file-system';

export interface QuranGameProgress {
  xp: number;
  gamesWon: number;
  streakDays: number;
  lastPlayedDate: string; // YYYY-MM-DD
  gardenTrees: number;
  gardenFlowers: number;
  gardenLanterns: number;
  bestCombo: number;
}

const DEFAULT_PROGRESS: QuranGameProgress = {
  xp: 0,
  gamesWon: 0,
  streakDays: 0,
  lastPlayedDate: '',
  gardenTrees: 1,
  gardenFlowers: 2,
  gardenLanterns: 0,
  bestCombo: 0,
};

const FILE_PATH = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}wn_quran_games_progress.json`;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadGameProgress(): Promise<QuranGameProgress> {
  if (!FILE_PATH) return DEFAULT_PROGRESS;
  try {
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return DEFAULT_PROGRESS;
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    const parsed = JSON.parse(raw) as Partial<QuranGameProgress>;
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export async function recordGameWin(params: {
  earnedXp: number;
  bestCombo: number;
  perfect: boolean;
}): Promise<QuranGameProgress> {
  const prev = await loadGameProgress();
  const today = todayKey();
  let nextStreak = prev.streakDays;

  if (prev.lastPlayedDate !== today) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    nextStreak = prev.lastPlayedDate === yKey ? prev.streakDays + 1 : 1;
  }

  const next: QuranGameProgress = {
    xp: prev.xp + Math.max(10, params.earnedXp),
    gamesWon: prev.gamesWon + 1,
    streakDays: Math.max(1, nextStreak),
    lastPlayedDate: today,
    gardenTrees: prev.gardenTrees + (params.perfect ? 1 : 0),
    gardenFlowers: prev.gardenFlowers + 1,
    gardenLanterns: prev.gardenLanterns + (prev.gamesWon > 0 && (prev.gamesWon + 1) % 3 === 0 ? 1 : 0),
    bestCombo: Math.max(prev.bestCombo, params.bestCombo),
  };

  if (FILE_PATH) {
    await FileSystem.writeAsStringAsync(FILE_PATH, JSON.stringify(next)).catch(() => {});
  }
  return next;
}
