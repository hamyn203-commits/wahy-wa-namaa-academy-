import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TeacherSession } from '../types/teacher';
import { getSessionTitle } from './formatters';

/**
 * Schedules offline-capable local alerts 15 minutes and 5 minutes before each upcoming accepted session.
 * Works even when the phone temporarily loses internet before class.
 */
export async function syncLocalSessionReminders(
  sessions: TeacherSession[],
  locale: 'ar' | 'en' = 'ar'
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = Date.now();
    const upcoming = sessions
      .filter((s) => s.status === 'accepted')
      .map((s) => ({ session: s, startMs: new Date(s.scheduledAt).getTime() }))
      .filter((item) => Number.isFinite(item.startMs) && item.startMs > now + 60 * 1000)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 12);

    for (const { session, startMs } of upcoming) {
      const titleName = getSessionTitle(session, locale);

      for (const minsBefore of [15, 5]) {
        const triggerMs = startMs - minsBefore * 60 * 1000;
        if (triggerMs <= now + 30 * 1000) continue;

        await Notifications.scheduleNotificationAsync({
          content: {
            title:
              locale === 'ar'
                ? `تذكير بحصة خلال ${minsBefore} دقائق`
                : `Session in ${minsBefore} minutes`,
            body:
              locale === 'ar'
                ? `حصة ${titleName} تبدأ قريباً — استعد لدخول القاعة.`
                : `Your session with ${titleName} starts soon.`,
            sound: true,
            data: { sessionId: session._id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(triggerMs),
          },
        }).catch(() => {});
      }
    }
  } catch {
    // Non-blocking
  }
}
