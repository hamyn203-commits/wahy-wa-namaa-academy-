import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { dashboardPathForRole, isSafeInternalRedirect, postAuthDestination } from '../../lib/navigation';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useToast } from '../../context/ToastProvider';
import Skeleton from '../../components/shared/Skeleton';

export default function ProfileSetup() {
  const { user, ready } = useRequireAuth(['student', 'guardian', 'teacher']);
  const { saveOnboarding } = useAuth();
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const ps = t?.student?.profileSetup || {};
  const psErrors = ps.errors || {};
  const psLevels = ps.levels || {};
  const psRels = ps.relationships || {};

  const next = searchParams.get('next');
  const dashboardDestination = dashboardPathForRole(user?.role, locale);
  const destination = isSafeInternalRedirect(next)
    ? postAuthDestination({ redirect: next, role: user?.role, locale })
    : dashboardDestination;

  const [data, setData] = useState({
    name: '',
    phone: '',
    age: '',
    gender: '',
    whatsappPhone: '',
    preferredTrack: 'memorization',
    currentLevel: 'beginner',
    memorizedJuz: 0,
    memorizationDetails: '',
    bio: '',
    guardianContact: { name: '', phone: '', relationship: '' },
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setData((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(prev)
            .filter((k) => user[k] !== undefined && user[k] !== null)
            .map((k) => [k, user[k]])
        ),
      }));
    }
  }, [user]);

  useEffect(() => {
    // A returning student with a completed profile should not be asked to fill it again.
    if (!ready || user?.role !== 'student' || !user?.onboarding?.completed ||
        !user?.name?.trim() || !user?.phone?.trim() || !isSafeInternalRedirect(next)) return;
    if (new URL(next, 'https://wahy.local').pathname.endsWith('/journey')) {
      navigate(next, { replace: true, state: { profileJustSaved: true } });
    }
  }, [ready, user, next, navigate]);

  if (!ready) {
    return (
      <main dir={dir} className="min-h-screen bg-[var(--wn-bg)] py-12 px-4">
        <div className="mx-auto max-w-xl rounded-2xl bg-[var(--wn-surface)] p-8 border border-[var(--wn-border)] space-y-4" role="status" aria-live="polite">
          <span className="sr-only">{ps.loading || 'Loading profile…'}</span>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  const demographicsLocked = Boolean(user?.role === 'student' && user?.onboarding?.completed && user?.age && user?.gender);
  const isMinor = user?.role === 'student' && Number(data.age) > 0 && Number(data.age) < 18;

  const validate = () => {
    const errs = {};
    const requiredMsg = ps.validationRequired || 'Please fill in all required fields to continue.';
    if (!String(data.name || '').trim()) errs.name = requiredMsg;
    if (!String(data.phone || '').trim()) errs.phone = requiredMsg;
    if (user.role === 'student' && !demographicsLocked) {
      if (!data.age || !['male', 'female'].includes(data.gender)) {
        if (!data.age) errs.age = psErrors.demographicsRequired || requiredMsg;
        if (!['male', 'female'].includes(data.gender)) errs.gender = psErrors.demographicsRequired || requiredMsg;
      }
    }
    if (isMinor) {
      if (!String(data.guardianContact?.name || '').trim()) errs.guardianName = requiredMsg;
      if (!String(data.guardianContact?.phone || '').trim()) errs.guardianPhone = requiredMsg;
      if (!String(data.guardianContact?.relationship || '').trim()) errs.guardianRelationship = requiredMsg;
    }
    return errs;
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError(psErrors.demographicsRequired || ps.validationRequired || 'Please fill in all required fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const payload = { name: data.name, phone: data.phone, whatsappPhone: data.whatsappPhone, bio: data.bio };
      if (user.role === 'student') {
        Object.assign(payload, {
          ...(demographicsLocked ? {} : { age: data.age ? Number(data.age) : undefined, gender: data.gender || undefined }),
          memorizedJuz: Number(data.memorizedJuz),
          preferredTrack: data.preferredTrack,
          currentLevel: data.currentLevel,
          memorizationDetails: data.memorizationDetails,
        });
        payload.guardianContact = data.guardianContact;
      }
      const saved = await saveOnboarding(payload);
      if (!saved.onboarding?.completed) {
        throw new Error(psErrors.incomplete || 'Required details are still incomplete.');
      }
      toast.success(ps.submitted || 'Profile saved successfully');
      navigate(destination, { replace: true, state: { profileJustSaved: true } });
    } catch (e) {
      setError(e.message || psErrors.saveFailed || ps.error || 'Could not save your details.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const clearFieldError = (key) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const inputClass = 'input-field w-full mt-2 min-h-[44px] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-[var(--wn-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]';

  return (
    <main className="min-h-screen bg-[var(--wn-bg)] text-[var(--wn-text-primary)] py-12 px-4" dir={dir}>
      <section className="mx-auto max-w-xl rounded-2xl bg-[var(--wn-surface)] p-6 sm:p-8 shadow-sm border border-[var(--wn-border)]">
        <h1 className="text-2xl font-bold text-[var(--wn-heading)] mb-2">{ps.title || 'Complete Your Profile'}</h1>
        {error && (
          <p role="alert" className="mb-5 rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] p-4 text-sm font-semibold text-[var(--wn-text-danger)]">
            {error}
          </p>
        )}
        <p className="text-sm text-[var(--wn-text-secondary)] mb-6">
          {ps.subtitle || 'Fill in your details so we can match you with the best teacher and track'}{' '}
          {user.role === 'teacher' ? (ps.teacherPendingNotice || '') : ''}
        </p>

        <form className="space-y-4" onSubmit={save} noValidate>
          <div>
            <label htmlFor="ps-name" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
              {ps.fullNameLabel || 'Full name'}
            </label>
            <input
              id="ps-name"
              className={inputClass}
              type="text"
              required
              value={data.name ?? ''}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'ps-name-err' : undefined}
              onChange={(e) => {
                clearFieldError('name');
                setData((p) => ({ ...p, name: e.target.value }));
              }}
            />
            {fieldErrors.name && (
              <p id="ps-name-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="ps-phone" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
              {ps.phoneLabel || 'Phone number (required)'}
            </label>
            <input
              id="ps-phone"
              className={inputClass}
              type="tel"
              autoComplete="tel"
              required
              value={data.phone || ''}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? 'ps-phone-err' : 'ps-phone-hint'}
              onChange={(event) => {
                clearFieldError('phone');
                setData((prev) => ({ ...prev, phone: event.target.value }));
              }}
            />
            <span id="ps-phone-hint" className="block text-xs font-normal text-[var(--wn-text-secondary)] mt-1">
              {ps.phoneHint || 'Enter a valid phone number with country code'}
            </span>
            {fieldErrors.phone && (
              <p id="ps-phone-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.phone}</p>
            )}
          </div>

          <div>
            <label htmlFor="ps-whatsapp" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
              {ps.whatsappLabel || 'WhatsApp (optional)'}
            </label>
            <input
              id="ps-whatsapp"
              className={inputClass}
              type="tel"
              value={data.whatsappPhone ?? ''}
              onChange={(e) => setData((p) => ({ ...p, whatsappPhone: e.target.value }))}
            />
          </div>

          {user.role === 'student' && (
            <>
              <div>
                <label htmlFor="ps-age" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ps.ageLabel || 'Age'}
                </label>
                <input
                  id="ps-age"
                  className={inputClass}
                  type="number"
                  min="4"
                  max="100"
                  required={!demographicsLocked}
                  disabled={demographicsLocked}
                  value={data.age ?? ''}
                  aria-invalid={Boolean(fieldErrors.age)}
                  aria-describedby={fieldErrors.age ? 'ps-age-err' : undefined}
                  onChange={(e) => {
                    clearFieldError('age');
                    setData((p) => ({ ...p, age: e.target.value }));
                  }}
                />
                {fieldErrors.age && (
                  <p id="ps-age-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.age}</p>
                )}
              </div>

              <div>
                <label htmlFor="ps-gender" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ps.genderLabel || 'Gender'}
                </label>
                <select
                  id="ps-gender"
                  className={inputClass}
                  required={!demographicsLocked}
                  disabled={demographicsLocked}
                  value={data.gender}
                  aria-invalid={Boolean(fieldErrors.gender)}
                  aria-describedby={fieldErrors.gender ? 'ps-gender-err' : undefined}
                  onChange={(e) => {
                    clearFieldError('gender');
                    setData((p) => ({ ...p, gender: e.target.value }));
                  }}
                >
                  <option value="">{ps.selectGender || 'Select gender'}</option>
                  <option value="male">{ps.male || 'Male'}</option>
                  <option value="female">{ps.female || 'Female'}</option>
                </select>
                {fieldErrors.gender && (
                  <p id="ps-gender-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.gender}</p>
                )}
              </div>

              <div>
                <label htmlFor="ps-level" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ps.currentLevelLabel || 'Current level (initial assessment)'}
                </label>
                <select
                  id="ps-level"
                  className={inputClass}
                  value={data.currentLevel || 'beginner'}
                  aria-describedby="ps-level-hint"
                  onChange={(e) => setData((p) => ({ ...p, currentLevel: e.target.value }))}
                >
                  <option value="beginner">{psLevels.beginner || 'Beginner'}</option>
                  <option value="intermediate">{psLevels.intermediate || 'Intermediate'}</option>
                  <option value="advanced">{psLevels.advanced || 'Advanced'}</option>
                  <option value="ijazah">{psLevels.ijazah || 'Ijazah level'}</option>
                </select>
                <span id="ps-level-hint" className="block text-xs font-normal text-[var(--wn-text-secondary)] mt-1">
                  {ps.currentLevelHint || 'This is provisional; your tutor confirms your actual level during the trial session.'}
                </span>
              </div>

              <div>
                <label htmlFor="ps-juz" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ps.memorizedJuzLabel || 'Memorized Juz (0–30)'}
                </label>
                <input
                  id="ps-juz"
                  className={inputClass}
                  type="number"
                  min="0"
                  max="30"
                  value={data.memorizedJuz ?? ''}
                  onChange={(e) => setData((p) => ({ ...p, memorizedJuz: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="ps-details" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                  {ps.detailsLabel || 'Memorization Details'}
                </label>
                <input
                  id="ps-details"
                  className={inputClass}
                  type="text"
                  value={data.memorizationDetails ?? ''}
                  onChange={(e) => setData((p) => ({ ...p, memorizationDetails: e.target.value }))}
                />
              </div>

              <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-4 space-y-3">
                <h2 className="font-bold text-[var(--wn-heading)]">{ps.guardianSectionTitle || 'Guardian details'}</h2>
                <p className="text-sm text-[var(--wn-text-secondary)]">
                  {ps.guardianSectionNote || 'Required for learners under 18, optional for adults.'}
                </p>

                <div>
                  <label htmlFor="ps-guardian-name" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {ps.guardianNameLabel || 'Guardian name'}
                  </label>
                  <input
                    id="ps-guardian-name"
                    className={inputClass}
                    value={data.guardianContact?.name || ''}
                    type="text"
                    required={isMinor}
                    aria-invalid={Boolean(fieldErrors.guardianName)}
                    aria-describedby={fieldErrors.guardianName ? 'ps-gname-err' : undefined}
                    onChange={(event) => {
                      clearFieldError('guardianName');
                      setData((prev) => ({
                        ...prev,
                        guardianContact: { ...prev.guardianContact, name: event.target.value },
                      }));
                    }}
                  />
                  {fieldErrors.guardianName && (
                    <p id="ps-gname-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.guardianName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ps-guardian-phone" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {ps.guardianPhoneLabel || 'Guardian phone'}
                  </label>
                  <input
                    id="ps-guardian-phone"
                    className={inputClass}
                    value={data.guardianContact?.phone || ''}
                    type="tel"
                    required={isMinor}
                    aria-invalid={Boolean(fieldErrors.guardianPhone)}
                    aria-describedby={fieldErrors.guardianPhone ? 'ps-gphone-err' : undefined}
                    onChange={(event) => {
                      clearFieldError('guardianPhone');
                      setData((prev) => ({
                        ...prev,
                        guardianContact: { ...prev.guardianContact, phone: event.target.value },
                      }));
                    }}
                  />
                  {fieldErrors.guardianPhone && (
                    <p id="ps-gphone-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.guardianPhone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ps-guardian-rel" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {ps.relationshipLabel || 'Relationship'}
                  </label>
                  <select
                    id="ps-guardian-rel"
                    className={inputClass}
                    value={data.guardianContact?.relationship || ''}
                    required={isMinor}
                    aria-invalid={Boolean(fieldErrors.guardianRelationship)}
                    aria-describedby={fieldErrors.guardianRelationship ? 'ps-grel-err' : undefined}
                    onChange={(event) => {
                      clearFieldError('guardianRelationship');
                      setData((prev) => ({
                        ...prev,
                        guardianContact: { ...prev.guardianContact, relationship: event.target.value },
                      }));
                    }}
                  >
                    <option value="">{ps.selectRelationship || 'Select relationship'}</option>
                    <option value="father">{psRels.father || 'Father'}</option>
                    <option value="mother">{psRels.mother || 'Mother'}</option>
                    <option value="guardian">{psRels.guardian || 'Guardian'}</option>
                    <option value="other">{psRels.other || 'Other'}</option>
                  </select>
                  {fieldErrors.guardianRelationship && (
                    <p id="ps-grel-err" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{fieldErrors.guardianRelationship}</p>
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="ps-bio" className="block text-sm font-semibold text-[var(--wn-text-primary)]">
              {ps.bioLabel || 'Short bio (optional)'}
            </label>
            <input
              id="ps-bio"
              className={inputClass}
              type="text"
              value={data.bio ?? ''}
              onChange={(e) => setData((p) => ({ ...p, bio: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !data.name.trim()}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] p-3 font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            <span>{saving ? (ps.saving || 'Saving…') : (ps.saveAndContinue || 'Save & Continue')}</span>
          </button>

          <button
            type="button"
            className="w-full min-h-[44px] inline-flex items-center justify-center rounded-xl text-sm font-semibold text-[var(--wn-text-secondary)] underline hover:text-[var(--wn-link)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            onClick={() => navigate(dashboardDestination, { replace: true })}
          >
            {ps.skipLater || ps.skipForNow || 'Complete later'}
          </button>
        </form>
      </section>
    </main>
  );
}

