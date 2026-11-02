import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Copy, CreditCard, GraduationCap, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import LocalizedLink from '../../components/LocalizedLink';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';

function textValue(value, locale) {
  if (typeof value === 'string') return value;
  return value?.[locale] || value?.ar || value?.en || '';
}

function teacherName(teacher) {
  return teacher?.personalInfo?.fullName || teacher?.user?.name || 'معلم';
}

export default function ManualPayment() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const toast = useToast();
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
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
          throw new Error(isAr ? 'بيانات الدفع غير مكتملة' : 'Payment details are incomplete');
        }

        const courseData = await api.get('/api/courses/' + encodeURIComponent(slug));
        if (!cancelled) setCourse(courseData);
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || (isAr ? 'تعذر تحميل بيانات الدفع' : 'Unable to load payment details'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, subscriptionId, isSubscription, toast, isAr]);

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

  const currency = isSubscription
    ? (subscription?.currency || 'EGP')
    : (course?.currency || 'EGP');

  const paymentTitle = isSubscription
    ? (isAr
      ? subscription?.pricingSnapshot?.nameAr || 'اشتراك الأكاديمية'
      : subscription?.pricingSnapshot?.nameEn || 'Academy subscription')
    : textValue(course?.title, locale) || slug;

  const sectionLabel = subscription?.section === 'ladies'
    ? (isAr ? 'قسم السيدات' : 'Women’s section')
    : (isAr ? 'قسم الرجال والأطفال' : 'Men & children');

  const copyDestination = async () => {
    if (!selectedMethod?.destination) return;
    await navigator.clipboard.writeText(selectedMethod.destination);
    toast.success(isAr ? 'تم النسخ' : 'Copied');
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!proof) {
      return toast.error(isAr ? 'ارفع إثبات التحويل أولًا' : 'Upload the transfer proof first');
    }
    if (!method) {
      return toast.error(isAr ? 'اختر طريقة التحويل' : 'Select a transfer method');
    }
    if (isSubscription && !preferredTeacherId) {
      return toast.error(isAr ? 'اختر الشيخ أو المعلمة أولًا' : 'Choose your tutor first');
    }

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
      toast.success(isAr ? 'تم إرسال إثبات التحويل للمراجعة' : 'Transfer proof submitted for review');
    } catch (error) {
      if (error.code === 'PAYMENT_REVIEW_PENDING' && error.data?.paymentId) {
        setPaymentId(error.data.paymentId);
      }
      toast.error(error.message || (isAr ? 'تعذر إرسال إثبات التحويل' : 'Unable to submit transfer proof'));
    } finally {
      setSubmitting(false);
    }
  };

  if (paymentId) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-detail-card max-w-2xl w-full p-8 text-center">
            <CheckCircle size={52} className="mx-auto text-emerald-600 mb-4" />
            <h1 className="text-2xl font-bold mb-3">
              {isAr ? 'التحويل قيد مراجعة الإدارة' : 'Transfer under admin review'}
            </h1>

            {isSubscription ? (
              <>
                <p className="text-gray-600 mb-3">
                  {isAr
                    ? (subscription?.renewalOf
                        ? 'بعد اعتماد التحويل، التجديد سيبقى جاهزًا ويبدأ تلقائيًا عند انتهاء رصيد الباقة الحالية مع نفس الجروب والمعلم.'
                        : 'بعد تأكيد وصول المبلغ، سيتحول طلبك إلى مرحلة التسكين. الإدارة ستضعك في مجموعة مع الشيخ أو المعلمة التي اخترتها.')
                    : (subscription?.renewalOf
                        ? 'After approval, the renewal stays ready and activates automatically when your current package ends, with the same group and tutor.'
                        : 'After the funds are verified, your request moves to placement. Administration will place you in a group with your selected tutor.')}
                </p>
                {selectedTeacher ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-4">
                    <p className="text-xs text-gray-500">{isAr ? 'اختيارك' : 'Your preference'}</p>
                    <strong className="text-emerald-800">{teacherName(selectedTeacher)}</strong>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-gray-600 mb-3">
                {isAr
                  ? 'لن يتم تفعيل الدورة إلا بعد أن تتأكد الإدارة من وصول المبلغ فعليًا.'
                  : 'The course will be activated only after administration verifies that the funds were received.'}
              </p>
            )}

            <p className="text-xs text-gray-400 mb-6">Payment ID: {paymentId}</p>
            <LocalizedLink to={studentIdParam ? '/guardian/dashboard' : '/student/dashboard'} locale={locale} className="wn-btn wn-btn--primary">
              {studentIdParam ? (isAr ? 'العودة إلى لوحة ولي الأمر' : 'Back to guardian dashboard') : (isAr ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard')}
            </LocalizedLink>
            {false && null}
            <LocalizedLink to="/student/dashboard" locale={locale} className="wn-btn wn-btn--primary hidden">
              {isAr ? 'العودة إلى لوحة الطالب' : 'Back to student dashboard'}
            </LocalizedLink>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  return (
    <>
      <GlobalHeader />
      <main className="wn-detail-shell">
        <div className="page-container py-10 max-w-3xl">
          <div className="wn-detail-card p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <CreditCard className="text-emerald-700" />
              <div>
                <h1 className="text-2xl font-bold">
                  {isAr ? 'إتمام الاشتراك والتحويل' : 'Complete subscription payment'}
                </h1>
                <p className="text-sm text-gray-500">{paymentTitle}</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-14"><div className="spinner spinner-lg" /></div>
            ) : !config?.configured ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                {isAr ? 'طرق التحويل لم يتم تفعيلها بعد.' : 'Transfer methods are not configured yet.'}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <p className="text-sm text-gray-600">{isAr ? 'المبلغ المطلوب' : 'Amount due'}</p>
                  <p className="text-2xl font-bold text-emerald-800">
                    {amountDue} {currency}
                  </p>
                  {isSubscription ? (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <p>{isAr ? 'القسم: ' : 'Section: '}<strong>{sectionLabel}</strong></p>
                      <p>
                        {isAr ? 'عدد الحصص: ' : 'Sessions: '}
                        <strong>{subscription?.sessionCount || '—'}</strong>
                      </p>
                    </div>
                  ) : null}
                  {config.recipientName ? (
                    <p className="text-xs text-gray-500 mt-2">
                      {isAr ? 'اسم المستلم: ' : 'Recipient: '}{config.recipientName}
                    </p>
                  ) : null}
                </div>

                {isSubscription ? (
                  <label className="block">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <GraduationCap size={17} className="text-emerald-700" />
                      {subscription?.renewalOf
                        ? (isAr ? 'التجديد مع نفس المعلم' : 'Renew with the same tutor')
                        : (isAr ? 'عايز تدرس مع مين؟' : 'Who would you like to study with?')}
                    </span>
                    <select
                      required
                      aria-label={isAr ? 'اختيار الشيخ أو المعلمة' : 'Choose tutor'}
                      value={preferredTeacherId}
                      onChange={(event) => setPreferredTeacherId(event.target.value)}
                      disabled={Boolean(subscription?.renewalOf)}
                      className="mt-2 w-full border rounded-xl px-3 py-3 disabled:bg-slate-100 disabled:text-slate-600"
                    >
                      <option value="">{isAr ? 'اختر الشيخ أو المعلمة' : 'Choose a tutor'}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                          {teacherName(teacher)}
                          {teacher.rating?.average ? ` — ★ ${Number(teacher.rating.average).toFixed(1)}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      {subscription?.renewalOf
                        ? (isAr
                            ? 'هذا تجديد مباشر لنفس الجروب والمعلم، لذلك لا تحتاج إلى تسكين جديد.'
                            : 'This is a direct renewal for the same group and tutor, so no new placement is needed.')
                        : subscription?.section === 'ladies'
                          ? (isAr ? 'قسم السيدات يعرض المعلمات المعتمدات فقط.' : 'The women’s section shows approved female tutors only.')
                          : (isAr ? 'الإدارة ستحاول تسكينك مع اختيارك بعد اعتماد التحويل.' : 'Administration will place you with your preferred tutor after payment approval.')}
                    </p>
                  </label>
                ) : null}

                <label className="block">
                  <span className="text-sm font-semibold">{isAr ? 'طريقة التحويل' : 'Transfer method'}</span>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value)}
                    className="mt-2 w-full border rounded-xl px-3 py-3"
                  >
                    {config.methods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {isAr && item.id === 'mobile_wallet' ? 'محفظة إلكترونية' : item.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedMethod ? (
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-gray-500 mb-1">{isAr ? 'حوّل إلى' : 'Transfer to'}</p>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="break-all">{selectedMethod.destination}</strong>
                      <button
                        type="button"
                        onClick={copyDestination}
                        className="wn-btn wn-btn--secondary !px-3 !py-2"
                        aria-label={isAr ? 'نسخ رقم التحويل' : 'Copy transfer destination'}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                ) : null}

                <label className="block">
                  <span className="text-sm font-semibold">
                    {isAr ? 'رقم/مرجع العملية (إن وجد)' : 'Transfer reference (if available)'}
                  </span>
                  <input
                    value={transferReference}
                    onChange={(event) => setTransferReference(event.target.value)}
                    maxLength={160}
                    className="mt-2 w-full border rounded-xl px-3 py-3"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">
                    {isAr ? 'صورة أو PDF لإثبات التحويل' : 'Transfer proof image or PDF'}
                  </span>
                  <div className="mt-2 border-2 border-dashed rounded-xl p-5 text-center">
                    <Upload size={26} className="mx-auto mb-2 text-emerald-700" />
                    <input
                      required
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(event) => setProof(event.target.files?.[0] || null)}
                    />
                    {proof ? <p className="text-xs text-emerald-700 mt-2">{proof.name}</p> : null}
                  </div>
                </label>

                <div className="rounded-xl bg-slate-50 border p-4 text-xs text-gray-600 leading-6">
                  {isSubscription
                    ? (isAr
                      ? 'رفع الإيصال لا يفعّل الاشتراك تلقائيًا. الإدارة ستراجع وصول المبلغ أولًا، ثم تنشئ أو تختار المجموعة المناسبة وتسكّنك مع الشيخ أو المعلمة التي اخترتها.'
                      : 'Uploading the receipt does not activate the subscription automatically. Administration verifies the payment first, then creates or selects a suitable group with your chosen tutor.')
                    : (isAr
                      ? 'رفع الإيصال لا يعني قبول الدفع تلقائيًا. الإدارة ستتحقق من وصول المبلغ ثم تفعّل الدورة.'
                      : 'Uploading a receipt does not automatically approve payment. Administration verifies receipt before activation.')}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg disabled:opacity-60"
                >
                  {submitting
                    ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
                    : (isAr ? 'إرسال التحويل للمراجعة' : 'Submit transfer for review')}
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
