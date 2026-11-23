import { AlertTriangle, CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import { resolveIntlLocale } from '../../lib/locale';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherProfileTab({
  teacher,
  user,
  statusLabel,
  profileChange,
  profileEdit,
  setProfileEdit,
  profileFiles,
  setProfileFiles,
  savingProfileChange,
  submitProfileChange,
  onOpenAi,
  locale,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const acc = tp.account || {};
  const intlLocale = resolveIntlLocale(locale);
  const teacherName = teacher?.personalInfo?.fullName || user?.name || tp.welcome?.tutorFallback || 'معلمنا';
  const rawEmail = String(user?.email || '').trim();
  const displayEmail = rawEmail && !rawEmail.endsWith('@phone.wahywanamaa.local') ? rawEmail : '—';
  const pendingReview = profileChange?.status === 'pending';

  return (
    <div className="wn-teacher-profile-view">
      <section className="wn-teacher-profile-card">
        <div className="wn-teacher-profile-card__top">
          <TeacherAvatar
            src={teacher?.media?.profilePhoto}
            name={teacherName}
            alt={teacherName}
            size="lg"
            className="wn-teacher-profile-card__avatar rounded-full shrink-0"
          />
          <div>
            <span className="wn-teacher-profile-card__status">
              <CheckCircle2 size={14} aria-hidden="true" /> {statusLabel(teacher?.status)}
            </span>
            <h3>{teacherName}</h3>
            <p>
              {teacher?.academicInfo?.qualification
                || teacher?.academicInfo?.specialization
                || acc.defaultQualification
                || 'معلم قرآن كريم'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAi}
            className="wn-teacher-ai-button min-h-[44px]"
          >
            <Sparkles size={16} aria-hidden="true" /> {acc.aiAssistantBtn || 'مساعد المعلم'}
          </button>
        </div>

        <div className="wn-teacher-profile-grid">
          <InfoRow label={acc.emailLabel || 'البريد'} value={displayEmail} />
          <InfoRow label={acc.phoneLabel || 'الهاتف'} value={teacher?.personalInfo?.phone || user?.phone} />
          <InfoRow label={acc.countryLabel || 'البلد'} value={teacher?.personalInfo?.country} />
          <InfoRow label={acc.cityLabel || 'المدينة'} value={teacher?.personalInfo?.city} />
          <InfoRow label={acc.universityLabel || 'الجامعة'} value={teacher?.academicInfo?.university} />
          <InfoRow label={acc.specializationLabel || 'التخصص'} value={teacher?.academicInfo?.specialization} />
          <InfoRow label={acc.experienceLabel || 'سنوات الخبرة'} value={teacher?.quranInfo?.teachingExperience} />
          <InfoRow label={acc.ijazatLabel || 'الإجازات'} value={teacher?.quranInfo?.numberOfIjazat} />
        </div>

        <div className="wn-teacher-profile-note">
          <AlertTriangle size={17} aria-hidden="true" />
          <div>
            <strong>{acc.publicNoteTitle || 'بيانات الملف العام'}</strong>
            <p>{acc.publicNoteDesc || 'أي تعديل ترسله هنا لا يظهر للطلاب إلا بعد مراجعة الإدارة واعتماده.'}</p>
          </div>
        </div>

        {profileChange && (
          <div
            className={`mt-5 rounded-xl border p-4 text-sm ${
              profileChange.status === 'pending'
                ? 'border-[var(--wn-gold)]/40 bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)]'
                : profileChange.status === 'approved'
                  ? 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                  : 'border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]'
            }`}
          >
            <strong className="block">
              {profileChange.status === 'pending'
                ? (acc.changePending || 'طلب التعديل قيد مراجعة الإدارة')
                : profileChange.status === 'approved'
                  ? (acc.changeApproved || 'آخر تعديل تم اعتماده')
                  : (acc.changeRejected || 'آخر تعديل لم يتم اعتماده')}
            </strong>
            {profileChange.adminNote ? (
              <p className="mt-1">
                {formatMsg(acc.adminNote || 'ملاحظة الإدارة: {note}', { note: profileChange.adminNote })}
              </p>
            ) : null}
            {profileChange.createdAt ? (
              <small className="block mt-1 opacity-80">
                {new Date(profileChange.createdAt).toLocaleString(intlLocale)}
              </small>
            ) : null}
          </div>
        )}

        <form
          onSubmit={submitProfileChange}
          className="mt-6 rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5"
        >
          <div className="mb-4">
            <h4 className="font-bold text-[var(--wn-heading)]">{acc.editTitle || 'تعديل الملف العام'}</h4>
            <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
              {acc.editSubtitle || 'حدّث بياناتك أو وسائطك، ثم أرسلها للمراجعة. البيانات الحالية تظل منشورة حتى اعتماد التغيير.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['fullName', acc.fieldFullName || 'الاسم العام'],
              ['city', acc.fieldCity || 'المدينة'],
              ['university', acc.fieldUniversity || 'الجامعة / جهة الدراسة'],
              ['faculty', acc.fieldFaculty || 'الكلية'],
              ['qualification', acc.fieldQualification || 'المؤهل'],
            ].map(([key, label]) => {
              const inputId = `profile-edit-${key}`;
              return (
                <div key={key}>
                  <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {label}
                  </label>
                  <input
                    id={inputId}
                    className="input-field w-full mt-1"
                    value={profileEdit[key]}
                    disabled={pendingReview}
                    onChange={(event) => setProfileEdit((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </div>
              );
            })}
            <div>
              <label htmlFor="profile-edit-exp" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                {acc.fieldExperience || 'سنوات الخبرة'}
              </label>
              <input
                id="profile-edit-exp"
                type="number"
                min="0"
                max="80"
                className="input-field w-full mt-1"
                value={profileEdit.teachingExperience}
                disabled={pendingReview}
                onChange={(event) => setProfileEdit((current) => ({ ...current, teachingExperience: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="profile-edit-ijazat" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                {acc.fieldIjazat || 'عدد الإجازات'}
              </label>
              <input
                id="profile-edit-ijazat"
                type="number"
                min="0"
                max="100"
                className="input-field w-full mt-1"
                value={profileEdit.numberOfIjazat}
                disabled={pendingReview}
                onChange={(event) => setProfileEdit((current) => ({ ...current, numberOfIjazat: event.target.value }))}
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="profile-edit-bio" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
              {acc.fieldBio || 'نبذة تظهر للطلاب'}
            </label>
            <textarea
              id="profile-edit-bio"
              rows={4}
              maxLength={1200}
              className="input-field w-full mt-1"
              value={profileEdit.bio}
              disabled={pendingReview}
              onChange={(event) => setProfileEdit((current) => ({ ...current, bio: event.target.value }))}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['profilePhoto', acc.filePhoto || 'صورة شخصية جديدة', 'image/jpeg,image/png'],
              ['introductionVideo', acc.fileIntroVideo || 'فيديو تعريفي جديد', 'video/mp4,video/webm,video/quicktime'],
              ['recitationVideo', acc.fileRecitationVideo || 'فيديو تلاوة جديد', 'video/mp4,video/webm,video/quicktime'],
              ['teachingMethodVideo', acc.fileMethodVideo || 'فيديو طريقة تدريس جديد', 'video/mp4,video/webm,video/quicktime'],
            ].map(([key, label, accept]) => {
              const fileId = `profile-file-${key}`;
              return (
                <label
                  key={key}
                  htmlFor={fileId}
                  className="rounded-xl border border-dashed border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 text-sm text-[var(--wn-text-primary)] cursor-pointer focus-within:ring-2 focus-within:ring-[var(--wn-focus)]"
                >
                  <strong className="block mb-2 text-[var(--wn-heading)]">{label}</strong>
                  <input
                    id={fileId}
                    type="file"
                    accept={accept}
                    disabled={pendingReview}
                    className="block w-full text-xs text-[var(--wn-text-secondary)]"
                    onChange={(event) => setProfileFiles((current) => ({ ...current, [key]: event.target.files?.[0] || null }))}
                  />
                  {profileFiles[key] ? (
                    <small className="block mt-1 text-[var(--wn-badge-emerald-text)]">{profileFiles[key].name}</small>
                  ) : null}
                </label>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={savingProfileChange || pendingReview}
            className="wn-btn wn-btn--primary min-h-[44px] mt-5 inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingProfileChange ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            <span>
              {savingProfileChange
                ? (acc.submittingBtn || 'جاري الإرسال…')
                : pendingReview
                  ? (acc.underReviewBtn || 'قيد المراجعة')
                  : (acc.submitChangesBtn || 'إرسال التعديلات للمراجعة')}
            </span>
          </button>
        </form>
      </section>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] rounded-lg p-3">
      <span className="text-[var(--wn-text-secondary)] text-xs">{label}</span>
      <p className="font-semibold text-[var(--wn-text-primary)]">{value || '—'}</p>
    </div>
  );
}
