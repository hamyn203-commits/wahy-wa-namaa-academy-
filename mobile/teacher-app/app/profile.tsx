import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Clock, Send } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import { useI18n } from '../src/i18n/I18nProvider';
import { useTheme } from '../src/context/ThemeContext';
import { api } from '../src/lib/api';
import { uploadTeacherProfilePhotoDirect } from '../src/lib/directUpload';
import { TeacherProfileChangeRequest, TeacherProfileData } from '../src/types/teacher';
import { IslamicHero } from '../src/components/IslamicHero';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { SkeletonDashboard } from '../src/components/SkeletonCard';
import { StateView } from '../src/components/StateView';
import { colors, fonts, radius, shadows, spacing } from '../src/theme/tokens';

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useI18n();
  const { palette } = useTheme();
  const align = isRTL ? 'right' : 'left';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pendingReq, setPendingReq] = useState<TeacherProfileChangeRequest | null>(null);
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [university, setUniversity] = useState('');
  const [faculty, setFaculty] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('0');
  const [ijazat, setIjazat] = useState('0');
  const [bio, setBio] = useState('');
  const [pickedPhoto, setPickedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [profRes, reqRes] = await Promise.all([
        api.get<{ teacher?: TeacherProfileData }>('/api/teachers/dashboard/profile', { auth: true }),
        api.get<{ request?: TeacherProfileChangeRequest | null }>('/api/teachers/dashboard/profile-change', { auth: true }),
      ]);
      const td = profRes.teacher;
      if (td) {
        setFullName(td.personalInfo?.fullName || user?.name || '');
        setCity(td.personalInfo?.city || '');
        setUniversity(td.academicInfo?.university || '');
        setFaculty(td.academicInfo?.faculty || '');
        setQualification(td.academicInfo?.qualification || '');
        setExperience(String(td.academicInfo?.teachingExperience ?? 0));
        setIjazat(String(td.academicInfo?.numberOfIjazat ?? 0));
        setBio(td.academicInfo?.bio || '');
      }
      setPendingReq(reqRes.request || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.common.errorGeneric, user?.name]);

  useEffect(() => {
    void loadProfile(false);
  }, [loadProfile]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.common.errorTitle, 'يرجى السماح بصلاحية معرض الصور.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPickedPhoto(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const media: Record<string, unknown> = {};
      if (pickedPhoto?.uri) {
        const uploaded = await uploadTeacherProfilePhotoDirect({
          uri: pickedPhoto.uri,
          ownerId: String(user?._id || user?.id || ''),
          fileName: pickedPhoto.fileName,
          mimeType: pickedPhoto.mimeType,
          fileSize: pickedPhoto.fileSize,
        });
        media.profilePhoto = uploaded;
      }

      await api.post(
        '/api/teachers/dashboard/profile-change',
        {
          changes: {
            fullName: fullName.trim(),
            city: city.trim(),
            university: university.trim(),
            faculty: faculty.trim(),
            qualification: qualification.trim(),
            teachingExperience: Number(experience) || 0,
            numberOfIjazat: Number(ijazat) || 0,
            bio: bio.trim(),
          },
          media,
        },
        { auth: true }
      );
      setPickedPhoto(null);
      await loadProfile(true);
      Alert.alert('تم الإرسال', 'تم إرسال طلب تعديل الملف العام للإدارة للمراجعة.');
    } catch (err) {
      Alert.alert(t.common.errorTitle, err instanceof Error ? err.message : t.common.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const hasPending = pendingReq?.status === 'pending';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top']}>
      <IslamicHero
        title={t.profile.title}
        subtitle={t.profile.subtitle}
        isRTL={isRTL}
        onBack={() => router.back()}
        compact
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadProfile(true)} tintColor={colors.emerald} />
        }
      >
        {loading ? (
          <SkeletonDashboard />
        ) : error ? (
          <StateView
            mode="error"
            title={t.common.errorTitle}
            description={error}
            actionLabel={t.common.retry}
            onAction={() => void loadProfile(false)}
          />
        ) : (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { textAlign: align }]}>{t.profile.editTitle}</Text>

            {hasPending ? (
              <View style={styles.pendingBox}>
                <Clock size={18} color={colors.warning} />
                <Text style={[styles.pendingText, { textAlign: align }]}>{t.profile.pendingBanner}</Text>
              </View>
            ) : null}

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.fullName}</Text>
            <TextInput style={[styles.input, { textAlign: align }]} value={fullName} onChangeText={setFullName} editable={!hasPending} />

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.city}</Text>
            <TextInput style={[styles.input, { textAlign: align }]} value={city} onChangeText={setCity} editable={!hasPending} />

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.university}</Text>
            <TextInput style={[styles.input, { textAlign: align }]} value={university} onChangeText={setUniversity} editable={!hasPending} />

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.faculty}</Text>
            <TextInput style={[styles.input, { textAlign: align }]} value={faculty} onChangeText={setFaculty} editable={!hasPending} />

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.qualification}</Text>
            <TextInput style={[styles.input, { textAlign: align }]} value={qualification} onChangeText={setQualification} editable={!hasPending} />

            <View style={styles.twoCol}>
              <View style={styles.flex}>
                <Text style={[styles.label, { textAlign: align }]}>{t.profile.experience}</Text>
                <TextInput style={styles.input} value={experience} onChangeText={setExperience} keyboardType="number-pad" editable={!hasPending} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.label, { textAlign: align }]}>{t.profile.ijazat}</Text>
                <TextInput style={styles.input} value={ijazat} onChangeText={setIjazat} keyboardType="number-pad" editable={!hasPending} />
              </View>
            </View>

            <Text style={[styles.label, { textAlign: align }]}>{t.profile.bio}</Text>
            <TextInput
              style={[styles.textArea, { textAlign: align }]}
              value={bio}
              onChangeText={setBio}
              multiline
              editable={!hasPending}
            />

            <PrimaryButton
              label={pickedPhoto ? t.profile.photoSelected : t.profile.pickPhoto}
              variant="secondary"
              disabled={hasPending}
              onPress={() => void pickPhoto()}
              icon={<Camera size={16} color={colors.emeraldDark} />}
            />

            <PrimaryButton
              label={t.profile.submitChange}
              disabled={hasPending}
              loading={submitting}
              onPress={() => void handleSubmit()}
              icon={<Send size={16} color={colors.textInverse} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ivory },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  sectionTitle: { fontSize: 16, fontFamily: fonts.extraBold, color: colors.emeraldDeep, marginBottom: 4 },
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pendingText: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.warning },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 4 },
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 90,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    padding: spacing.md,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
});
