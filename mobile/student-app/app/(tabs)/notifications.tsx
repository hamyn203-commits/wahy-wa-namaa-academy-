import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, BookOpen, CalendarClock, CheckCheck, MessageCircle } from 'lucide-react-native';
import { useI18n } from '../../src/i18n/I18nProvider';
import { api } from '../../src/lib/api';
import { IslamicHero } from '../../src/components/IslamicHero';
import { SkeletonCard } from '../../src/components/SkeletonCard';
import { StateView } from '../../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../../src/theme/tokens';
import { LocalizedText, NotificationItem } from '../../src/types/academy';

function pickText(value: string | LocalizedText | undefined, locale: 'ar' | 'en'): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.ar || value.en || '';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await api.get<{ notifications?: NotificationItem[] } | NotificationItem[]>(
        '/api/notifications?limit=40',
        { auth: true }
      );
      setItems(Array.isArray(data) ? data : data.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.notifications.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.notifications.loadError]);

  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    try {
      await api.put(`/api/notifications/${encodeURIComponent(id)}/read`, {}, { auth: true });
    } catch { /* non-blocking */ }
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.put('/api/notifications/read-all', {}, { auth: true });
    } catch { /* non-blocking */ }
  };

  const handleOpenNotification = (item: NotificationItem) => {
    if (!item.isRead) void markRead(item._id);
    const type = String(item.type || '').toLowerCase();
    const actionUrl = String(item.data?.actionUrl || '').toLowerCase();
    if (type.includes('support') || actionUrl.includes('support')) {
      router.push('/support');
    } else if (type.includes('homework') || actionUrl.includes('homework')) {
      router.push('/(tabs)/homework');
    } else if (type.includes('session') || type.includes('live') || actionUrl.includes('session')) {
      router.push('/(tabs)/sessions');
    } else if (type.includes('certificate') || type.includes('badge')) {
      router.push('/progress');
    }
  };

  const renderIcon = (type = '') => {
    const lower = type.toLowerCase();
    if (lower.includes('homework')) return <BookOpen size={17} color={colors.goldDark} />;
    if (lower.includes('support')) return <MessageCircle size={17} color={colors.teal} />;
    if (lower.includes('session')) return <CalendarClock size={17} color={colors.emerald} />;
    return <Bell size={17} color={colors.emerald} />;
  };

  const unreadCount = items.filter((n) => !n.isRead).length;
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <IslamicHero
        title={t.notifications.title}
        subtitle={t.notifications.subtitle}
        isRTL={isRTL}
        compact
        rightSlot={
          unreadCount > 0 ? (
            <Pressable onPress={() => void markAllRead()} style={styles.markAllBtn}>
              <CheckCheck size={15} color={colors.goldBright} />
              <Text style={styles.markAllText}>{t.notifications.markAllRead}</Text>
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={loading || error ? [] : items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={colors.emerald}
            colors={[colors.emerald]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.md }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : error ? (
            <StateView
              mode="error"
              title={t.notifications.loadError}
              description={error}
              actionLabel={t.common.retry}
              onAction={() => loadNotifications(false)}
            />
          ) : (
            <StateView
              mode="empty"
              title={t.notifications.emptyTitle}
              description={t.notifications.emptyDesc}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleOpenNotification(item)}
            style={({ pressed }) => [
              styles.card,
              !item.isRead && styles.cardUnread,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.row, { flexDirection: rowDir }]}>
              <View style={[styles.iconWrap, !item.isRead && styles.iconUnread]}>
                {renderIcon(item.type)}
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.title, { textAlign: align }]}>
                  {pickText(item.title, locale) || t.notifications.title}
                </Text>
                <Text style={[styles.message, { textAlign: align }]}>
                  {pickText(item.message, locale)}
                </Text>
                <Text style={[styles.date, { textAlign: align }]}>
                  {new Date(item.createdAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                </Text>
              </View>
              {!item.isRead ? <View style={styles.unreadDot} /> : null}
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.emeraldNight },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(212, 175, 107, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 107, 0.45)',
  },
  markAllText: { color: colors.goldBright, fontSize: 12, fontFamily: fonts.bold },
  listContent: {
    flexGrow: 1,
    backgroundColor: colors.ivory,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardUnread: {
    borderColor: colors.borderMint,
    backgroundColor: colors.mintSoft,
  },
  pressed: { opacity: 0.85 },
  row: { gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.ivoryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconUnread: { backgroundColor: colors.emeraldSoft },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  message: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  date: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary, marginTop: 2 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.emerald,
    marginTop: 6,
  },
});
