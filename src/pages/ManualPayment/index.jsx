import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  CreditCard,
  GraduationCap,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import LocalizedLink from '../../components/LocalizedLink';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { resolveIntlLocale } from '../../lib/locale';
import { usdLocalEquivalentNote } from '../../lib/regionalPricing';

function textValue(value, locale) {
  if (typeof value === 'string') return value;
  return value?.[locale] || value?.ar || value?.en || '';
}

function teacherName(teacher, fallback) {
  return teacher?.personalInfo?.fullName || teacher?.user?.name || fallback;
}

export default function ManualPayment() {
  const { locale, dir, t } = useI18n();
  const mp = t.payments.manual;
  const mpRef = useRef(mp);
  const toast = useToast();

  useEffect(() => {
    mpRef.current = mp;
  }, [mp]);
  const [params] = useSearchParams();
  const slug = params.get('course') || '';
  const subscriptionId = params.get('subscription') || '';
  const studentIdParam = params.get('student') || '';
  const isSubscription = Boolean(subscriptionId);

  const [course, setCourse] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [preferredTeacherId, setPreferredTeacherId] = useState('');
  const [config, setConfig] = useState(null);
  const [method, setMethod] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadSeq, setReloadSeq] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});

  const teacherSelectId = useId();
  const teacherErrorId = useId();
  const methodSelectId = useId();
  const methodErrorId = useId();
  const transferRefId = useId();
  const proofInputId = useId();
  const proofErrorId = useId();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const paymentConfig = await api.get('/api/payments/config');
        if (cancelled) return;

        setConfig(paymentConfig);
        setMethod(paymentConfig?.methods?.[0]?.id || '');

        if (isSubscription) {
          const subscriptionResult = await api.get(
            '/api/subscriptions/' + encodeURIComponent(subscriptionId),
            { auth: true }
          );
          if (cancelled) return;

          const currentSubscription = subscriptionResult.subscription;
          setSubscription(currentSubscription);

          // A tutor already recorded on the subscription is final for the student.
          if (currentSubscription?.preferredTeacher) {
            const lockedTeacher = currentSubscription.preferredTeacher;
            setTeachers([lockedTeacher]);
            setPreferredTeacherId(lockedTeacher?._id || lockedTeacher || '');
            return;
          }

          const teacherQuery = currentSubscription?.section === 'ladies'
            ? '?limit=100&gender=female&sortBy=rating&sortOrder=desc'
            : '?limit=100&sortBy=rating&sortOrder=desc';

          const teacherResult = await api.get('/api/teachers' + teacherQuery);
          if (cancelled) return;

          const list = teacherResult?.teachers || [];
          setTeachers(list);
          setPreferredTeacherId(
            currentSubscription?.preferredTeacher?._id
              || currentSubscription?.preferredTeacher
              || list[0]?._id
              || ''
          );
          return;
        }

        if (!slug) {
          setLoadError({ kind: 'incomplete', message: '' });
          toast.error(mpRef.current.incompleteError);
          return;
        }

        const courseData = await api.get('/api/courses/' + encodeURIComponent(slug));
        if (!cancelled) setCourse(courseData);
      } catch (error) {
        if (!cancelled) {
          const msg = error?.message || '';
          setLoadError({ kind: 'failed', message: msg });
          toast.error(msg || mpRef.current.loadingError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, subscriptionId, isSubscription, reloadSeq, toast]);

  const selectedMethod = useMemo(
    () => config?.methods?.find((item) => item.id === method),
    [config, method]
  );

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => String(teacher._id) === String(preferredTeacherId)),
    [teachers, preferredTeacherId]
  );

  const amountDue = isSubscription
    ? Number(subscription?.totalAmountMinor || 0) / 100
    : Number(course?.price || 0);

  const intlLocale = resolveIntlLocale(locale);
  const formattedAmount = useMemo(
    () => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(amountDue),
    [intlLocale, amountDue]
  );

  const currency = isSubscription
    ? (subscription?.currency || 'EGP')
    : (course?.currency || 'EGP');

  const paymentTitle = isSubscription
    ? (locale === 'ar'
      ? subscription?.pricingSnapshot?.nameAr || mp.subscriptionDefault
      : subscription?.pricingSnapshot?.nameEn || subscription?.pricingSnapshot?.nameAr || mp.subscriptionDefault)
    : textValue(course?.title, locale) || slug;

  const sectionLabel = subscription?.section === 'ladies'
    ? mp.sectionLadies
    : mp.sectionMenChildren;

  const resolvedLoadError = loadError
    ? (loadError.message || (loadError.kind === 'incomplete' ? mp.incompleteError : mp.loadingError))
    : '';

  const copyDestination = async () => {
    if (!selectedMethod?.destination) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await navigator.clipboard.writeText(selectedMethod.destination);
      toast.success(mp.copied);
    } catch {
      toast.error(mp.copyFailed);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    if (!proof) nextErrors.proof = mp.errors.noProof;
    if (!method) nextErrors.method = mp.errors.noMethod;
    if (isSubscription && !preferredTeacherId) nextErrors.preferredTeacherId = mp.errors.noTutor;

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      toast.error(nextErrors.proof || nextErrors.method || nextErrors.preferredTeacherId);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const storageFile = await uploadFileDirect(proof, 'payment-proof');
      const payload = {
        method,
        transferReference: transferReference.trim(),
        proofReference: storageFile.url,
        proofFilename: storageFile.name,
        proofContentType: storageFile.contentType,
        proofSize: storageFile.size,
      };

      const result = isSubscription
        ? await api.post(
            '/api/payments/subscription/' + encodeURIComponent(subscriptionId) + '/manual',
            {
              ...payload,
              preferredTeacherId,
            },
            { auth: true }
          )
        : await api.post(
            '/api/payments/course/' + encodeURIComponent(slug) + '/manual',
            payload,
            { auth: true }
          );

      setPaymentId(result.paymentId);
      toast.success(mp.success.submitted);
    } catch (error) {
      if (error.code === 'PAYMENT_REVIEW_PENDING' && error.data?.paymentId) {
        setPaymentId(error.data.paymentId);
      }
      toast.error(error.message || mp.errors.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (paymentId) {
    return (
      <>
        <SEOHead page={{ title: mp.seoTitle, description: mp.seoDesc, noindex: true, canonical: false }} />
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="wn-detail-card max-w-2xl w-full p-8 text-center">
            <CheckCircle size={52} className="mx-auto text-[var(--wn-emerald)] mb-4" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-[var(--wn-heading)] mb-3">
              {mp.success.reviewTitle}
            </h1>

            {isSubscription ? (
              <>
                <p className="text-[var(--wn-text-secondary)] mb-3">
                  {subscription?.renewalOf ? mp.success.renewMsg : mp.success.placementMsg}
                </p>
                {selectedTeacher ? (
                  <div className="rounded-xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] p-4 mb-4">
                    <p className="text-xs text-[var(--wn-text-secondary)]">{mp.success.preferenceLabel}</p>
                    <strong className="text-[var(--wn-emerald-dark)]">
                      {teacherName(selectedTeacher, mp.teacherFallback)}
                    </strong>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-[var(--wn-text-secondary)] mb-3">{mp.success.courseMsg}</p>
            )}

            <p className="text-xs text-[var(--wn-text-tertiary)] mb-6">
              {mp.success.paymentIdLabel.replace('{id}', paymentId)}
            </p>
            <LocalizedLink
              to={studentIdParam ? '/guardian/dashboard' : '/student/dashboard'}
              locale={locale}
              className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center justify-center"
            >
              {studentIdParam ? mp.success.backGuardian : mp.success.backStudent}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  return (
    <>
      <SEOHead page={{ title: mp.seoTitle, description: mp.seoDesc, noindex: true, canonical: false }} />
      <GlobalHeader />
      <main className="wn-detail-shell" dir={dir}>
        <div className="page-container py-10 max-w-3xl">
          <div className="wn-detail-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <CreditCard className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
              <div>
                <h1 className="text-2xl font-bold text-[var(--wn-heading)]">{mp.title}</h1>
                <p className="text-sm text-[var(--wn-text-secondary)]">{paymentTitle}</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4 py-4" role="status" aria-live="polite" aria-label={mp.title}>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : loadError ? (
              <div
                role="alert"
                className="rounded-xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] p-5 text-sm text-[var(--wn-status-danger-text)] space-y-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="font-medium leading-6">{resolvedLoadError}</p>
                </div>
                <button
                  id="retry"
                  type="button"
                  onClick={() => setReloadSeq((n) => n + 1)}
                  className="wn-btn wn-btn--secondary min-h-[44px] inline-flex items-center gap-2"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{mp.retry}</span>
                </button>
              </div>
            ) : !config?.configured ? (
              <div className="rounded-xl bg-[var(--wn-status-warn-bg)] border border-[var(--wn-status-warn-border)] p-4 text-sm text-[var(--wn-status-warn-text)]">
                {mp.notConfigured}
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-5">
                <div className="rounded-xl bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] p-4">
                  <p className="text-sm text-[var(--wn-text-secondary)]">{mp.amountDue}</p>
                  <p className="text-2xl font-bold text-[var(--wn-emerald-dark)]">
                    {formattedAmount} {currency}
                  </p>
                  {currency === 'USD' ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--wn-emerald-dark)]">
                      {usdLocalEquivalentNote(dir === 'rtl')}
                    </p>
                  ) : null}
                  {isSubscription ? (
                    <div className="mt-2 text-xs text-[var(--wn-text-secondary)] space-y-1">
                      <p>{mp.sectionLabel}: <strong>{sectionLabel}</strong></p>
                      <p>
                        {mp.sessionsCount}:{' '}
                        <strong>{subscription?.sessionCount || '—'}</strong>
                      </p>
                    </div>
                  ) : null}
                  {config.recipientName ? (
                    <p className="text-xs text-[var(--wn-text-secondary)] mt-2">
                      {mp.recipient}: {config.recipientName}
                    </p>
                  ) : null}
                </div>

                {isSubscription ? (
                  <div>
                    <label
                      htmlFor={teacherSelectId}
                      className="text-sm font-semibold text-[var(--wn-text-primary)] flex items-center gap-2"
                    >
                      <GraduationCap size={17} className="text-[var(--wn-emerald)] shrink-0" aria-hidden="true" />
                      <span>
                        {subscription?.renewalOf ? mp.renewSameTutor : mp.tutorQuestion}
                      </span>
                    </label>
                    <select
                      id={teacherSelectId}
                      required
                      aria-label={mp.chooseTutorAria}
                      aria-invalid={Boolean(fieldErrors.preferredTeacherId)}
                      aria-describedby={fieldErrors.preferredTeacherId ? teacherErrorId : undefined}
                      value={preferredTeacherId}
                      onChange={(event) => {
                        setPreferredTeacherId(event.target.value);
                        if (fieldErrors.preferredTeacherId) {
                          setFieldErrors((prev) => ({ ...prev, preferredTeacherId: '' }));
                        }
                      }}
                      disabled={Boolean(subscription?.renewalOf)}
                      className="mt-2 w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl px-3 py-3 disabled:bg-[var(--wn-surface-sunken)] disabled:text-[var(--wn-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    >
                      <option value="">{mp.chooseTutorPlaceholder}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                          {teacherName(teacher, mp.teacherFallback)}
                          {teacher.rating?.average
                            ? ` — ${new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(teacher.rating.average))}/5`
                            : ''}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.preferredTeacherId ? (
                      <p id={teacherErrorId} role="alert" className="mt-1.5 text-xs font-medium text-[var(--wn-text-danger)]">
                        {fieldErrors.preferredTeacherId}
                      </p>
                    ) : null}
                    <p className="text-xs text-[var(--wn-text-secondary)] mt-2">
                      {subscription?.renewalOf
                        ? mp.renewHint
                        : subscription?.section === 'ladies'
                          ? mp.ladiesHint
                          : mp.defaultHint}
                    </p>
                  </div>
                ) : null}

                <div>
                  <label htmlFor={methodSelectId} className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {mp.transferMethod}
                  </label>
                  <select
                    id={methodSelectId}
                    aria-invalid={Boolean(fieldErrors.method)}
                    aria-describedby={fieldErrors.method ? methodErrorId : undefined}
                    value={method}
                    onChange={(event) => {
                      setMethod(event.target.value);
                      if (fieldErrors.method) {
                        setFieldErrors((prev) => ({ ...prev, method: '' }));
                      }
                    }}
                    className="mt-2 w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    {config.methods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id === 'mobile_wallet' ? mp.mobileWalletLabel : item.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.method ? (
                    <p id={methodErrorId} role="alert" className="mt-1.5 text-xs font-medium text-[var(--wn-text-danger)]">
                      {fieldErrors.method}
                    </p>
                  ) : null}
                </div>

                {selectedMethod ? (
                  <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
                    <p className="text-xs text-[var(--wn-text-secondary)] mb-1">{mp.transferTo}</p>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="break-all text-[var(--wn-text-primary)]">
                        {selectedMethod.destination}
                      </strong>
                      <button
                        type="button"
                        onClick={copyDestination}
                        className="wn-btn wn-btn--secondary !px-3 !py-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center shrink-0"
                        aria-label={mp.copyAria}
                      >
                        <Copy size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <label htmlFor={transferRefId} className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {mp.transferRefLabel}
                  </label>
                  <input
                    id={transferRefId}
                    value={transferReference}
                    onChange={(event) => setTransferReference(event.target.value)}
                    placeholder={mp.transferRefPlaceholder}
                    maxLength={160}
                    className="mt-2 w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  />
                </div>

                <div>
                  <label htmlFor={proofInputId} className="block text-sm font-semibold text-[var(--wn-text-primary)]">
                    {mp.proofLabel}
                  </label>
                  <div className="mt-2 border-2 border-dashed border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] rounded-xl p-5 text-center overflow-hidden">
                    <Upload size={26} className="mx-auto mb-2 text-[var(--wn-emerald)]" aria-hidden="true" />
                    <p className="text-xs text-[var(--wn-text-secondary)] mb-3">{mp.proofSelectHint}</p>
                    <input
                      id={proofInputId}
                      required
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      aria-invalid={Boolean(fieldErrors.proof)}
                      aria-describedby={fieldErrors.proof ? proofErrorId : undefined}
                      onChange={(event) => {
                        setProof(event.target.files?.[0] || null);
                        if (fieldErrors.proof) {
                          setFieldErrors((prev) => ({ ...prev, proof: '' }));
                        }
                      }}
                      className="block w-full max-w-full overflow-hidden text-ellipsis text-sm text-[var(--wn-text-secondary)] file:me-3 file:min-h-[44px] file:cursor-pointer file:rounded-lg file:border file:border-[var(--wn-border)] file:bg-[var(--wn-surface)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[var(--wn-text-primary)]"
                    />
                    {proof ? (
                      <p className="mt-2 truncate text-xs font-medium text-[var(--wn-emerald)]">
                        {proof.name}
                      </p>
                    ) : null}
                  </div>
                  {fieldErrors.proof ? (
                    <p id={proofErrorId} role="alert" className="mt-1.5 text-xs font-medium text-[var(--wn-text-danger)]">
                      {fieldErrors.proof}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] p-4 text-xs text-[var(--wn-text-secondary)] leading-6">
                  {isSubscription ? mp.disclaimerSub : mp.disclaimerCourse}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                      <span>{mp.submitting}</span>
                    </>
                  ) : mp.submitBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}
