import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, Search, X } from 'lucide-react-native';
import { SURAHS, SurahMeta } from '../lib/surahs';
import { colors, fonts, radius, spacing } from '../theme/tokens';

interface SurahPickerModalProps {
  visible: boolean;
  isRTL?: boolean;
  onClose: () => void;
  onSelect: (surah: SurahMeta) => void;
}

export function SurahPickerModal({ visible, isRTL = true, onClose, onSelect }: SurahPickerModalProps) {
  const [query, setQuery] = useState('');
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.nameAr.includes(q) ||
        s.nameEn.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={[styles.head, { flexDirection: rowDir }]}>
            <Text style={styles.title}>{isRTL ? 'اختر السورة (114 سورة)' : 'Select Surah (114)'}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { flexDirection: rowDir }]}>
            <Search size={17} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { textAlign: align }]}
              value={query}
              onChangeText={setQuery}
              placeholder={isRTL ? 'ابحث باسم السورة أو رقمها...' : 'Search surah name or number...'}
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.number)}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                  onClose();
                }}
                style={({ pressed }) => [styles.row, { flexDirection: rowDir }, pressed && styles.pressed]}
              >
                <View style={styles.numBadge}>
                  <Text style={styles.numText}>{item.number}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.surahAr, { textAlign: align }]}>سورة {item.nameAr}</Text>
                  <Text style={[styles.surahMeta, { textAlign: align }]}>
                    {item.nameEn} • {item.ayahs} {isRTL ? 'آية' : 'ayahs'} • {isRTL ? `الجزء ${item.juz}` : `Juz ${item.juz}`}
                  </Text>
                </View>
                <BookOpen size={16} color={colors.emerald} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5, 39, 29, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    maxHeight: '84%',
    gap: spacing.md,
  },
  flex: { flex: 1 },
  head: { alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontFamily: fonts.extraBold, color: colors.emeraldDeep },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  list: { maxHeight: 420 },
  listContent: { gap: spacing.xs, paddingBottom: spacing.lg },
  row: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { backgroundColor: colors.emeraldSoft },
  numBadge: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontSize: 12, fontFamily: fonts.extraBold, color: colors.emeraldDark },
  surahAr: { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },
  surahMeta: { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary },
});
