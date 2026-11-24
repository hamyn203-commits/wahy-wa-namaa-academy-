import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { formatDateTime, getLocalizedText } from '../src/lib/formatters';
import { NotificationItem } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { SkeletonCard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

export default function TeacherNotificationsScreen() {
  const router = useRouter();
  const { locale, isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<NotificationItem[]>([]);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get<{ notifications?: NotificationItem[] }>('/api/notifications?limit=40', { auth: true });
      setItems(res.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric]);

  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true, isRead: true } : n)));
    await api.put(`/api/notifications/${id}/read`, {}, { auth: true }).catch(() => {});
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true, isRead: true })));
    await api.put('/api/notifications/read-all', {}, { auth: true }).catch(() => {});
  };

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => {
      const isRead = Boolean(item.read || item.isRead);
      return (
        <Pressable
          onPress={() => void markRead(item._id)}
          style={[styles.card, !isRead && styles.unreadCard, { flexDirection: rowDir }]}
        >
          <View style={[styles.iconBox, !isRead && styles.iconBoxUnread]}>
            <Bell size={18} color={isRead ? colors.textTertiary : colors.emerald} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.title, { textAlign: align }]}>
              {getLocalizedText(item.title, locale)}
            </Text>
            <Text style={[styles.msg, { textAlign: align }]}>
              {getLocalizedText(item.message, locale)}
            </Text>
            <Text style={[styles.time, { textAlign: align }]}>{formatDateTime(item.createdAt, locale)}</Text>
          </View>
        </Pressable>
      );
    },
    [align, locale, rowDir]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.notifications.title}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
        rightSlot={
          <Pressable onPress={() => void markAllRead()} style={styles.markAllBtn} accessibilityRole="button">
            <CheckCheck size={16} color={colors.goldBright} />
            <Text style={styles.markAllText}>{t.notifications.markAllRead}</Text>
          </Pressable>
        }
      />

      {loading ? (
        <View style={styles.pad}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadNotifications(false)}
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadNotifications(true)} tintColor={colors.emerald} />
          }
          ListEmptyComponent={<StateView mode="empty" title={t.notifications.empty} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  pad: { padding: spacing.lg, gap: spacing.md },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  markAllText: { color: colors.textInverse, fontSize: 11, fontFamily: fonts.bold },
  listContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.md,
    ...shadows.card,
  },
  unreadCard: { borderColor: colors.borderMint, backgroundColor: colors.mintSoft },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.ivoryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxUnread: { backgroundColor: colors.emeraldSoft },
  title: { fontSize: 14, fontFamily: fonts.extraBold, color: colors.textPrimary },
  msg: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },
  time: { fontSize: 11, fontFamily: fonts.medium, color: colors.textTertiary, marginTop: 2 },
});
