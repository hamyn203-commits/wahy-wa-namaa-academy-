import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Clock, ExternalLink, LogOut, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nProvider';
import { SITE_URL } from '../lib/config';
import { colors, fonts, radius, shadows, spacing } from '../theme/tokens';
import { IslamicHero } from './IslamicHero';
import { PrimaryButton } from './PrimaryButton';

export function TeacherApprovalGate() {
  const { user, refreshUser, logout } = useAuth();
  const { locale, isRTL, t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);

  const status = user?.teacherApprovalStatus || 'pending';
  const reviewNote = String(user?.teacherReviewNote || '').trim();
  const requestedChanges = Array.isArray(user?.teacherRequestedChanges) ? user.teacherRequestedChanges : [];
  const hasSubmittedApplication = status !== 'pending' || Boolean(user?.onboarding?.teacherApplicationReady);

  const statusText =
    status === 'under-review'
      ? t.gate.statusUnderReview
      : status === 'rejected'
        ? t.gate.statusRejected
        : status === 'suspended'
          ? t.gate.statusSuspended
          : t.gate.statusPending;

  const description = hasSubmittedApplication
    ? status === 'under-review' || requestedChanges.length > 0
      ? t.gate.descChanges
      : t.gate.descPending
    : t.gate.descIncomplete;

  const isWarning = status === 'under-review' || status === 'rejected' || status === 'suspended';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  const openWebApplication = () => {
    void Linking.openURL(`${SITE_URL}/${locale}/register/teacher`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <IslamicHero
          badge={t.brand.name}
          title={t.gate.title}
          subtitle={user?.name || user?.email}
          isRTL={isRTL}
          compact
        />

        <View style={styles.body}>
          <View style={styles.card}>
            <View style={[styles.statusHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.iconWrap, isWarning ? styles.warnBg : styles.emeraldBg]}>
                {isWarning ? (
                  <AlertTriangle size={24} color={colors.warning} />
                ) : (
                  <Clock size={24} color={colors.emerald} />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={[styles.statusLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.gate.statusLabel}
                </Text>
                <Text style={[styles.statusValue, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {statusText}
                </Text>
              </View>
            </View>

            <Text style={[styles.desc, { textAlign: isRTL ? 'right' : 'left' }]}>{description}</Text>

            {reviewNote ? (
              <View style={styles.noteBox}>
                <Text style={[styles.noteTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.gate.reviewNoteTitle}
                </Text>
                <Text style={[styles.noteBody, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {reviewNote}
                </Text>
              </View>
            ) : null}

            {requestedChanges.length > 0 ? (
              <View style={styles.changesBox}>
                <Text style={[styles.changesTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {t.gate.requestedChangesTitle}
                </Text>
                {requestedChanges.map((item) => (
                  <Text
                    key={item.key}
                    style={[styles.changeItem, { textAlign: isRTL ? 'right' : 'left' }]}
                  >
                    • {item.label}{item.note ? `: ${item.note}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                label={t.gate.refreshStatusBtn}
                onPress={() => void handleRefresh()}
                loading={refreshing}
                icon={<RefreshCw size={17} color={colors.textInverse} />}
              />
              <PrimaryButton
                label={t.gate.completeAppBtn}
                variant="secondary"
                onPress={openWebApplication}
                icon={<ExternalLink size={17} color={colors.emeraldDark} />}
              />
              <PrimaryButton
                label={t.gate.logoutBtn}
                variant="ghost"
                onPress={() => void logout()}
                icon={<LogOut size={17} color={colors.emeraldDark} />}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.lg },
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  statusHeader: { alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnBg: { backgroundColor: colors.warningSoft },
  emeraldBg: { backgroundColor: colors.emeraldSoft },
  statusLabel: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
  },
  statusValue: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.textPrimary,
  },
  desc: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 23,
  },
  noteBox: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.sand,
    padding: spacing.md,
    gap: 4,
  },
  noteTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.goldDark,
  },
  noteBody: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  changesBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F3B8B2',
    padding: spacing.md,
    gap: 6,
  },
  changesTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.danger,
  },
  changeItem: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  actions: { gap: spacing.sm },
});
