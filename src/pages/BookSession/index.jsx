import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, Globe, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import { teacherPublicImage, teacherImageFallback } from '../../lib/teacherMedia';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useToast } from '../../context/ToastProvider';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import '../../styles/session-experience.css';

const DEVICE_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
  } catch {
    return 'Africa/Cairo';
  }
})();

export default function BookSession() {
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [timezone, setTimezone] = useState(DEVICE_TIMEZONE);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [existingTrial, setExistingTrial] = useState(null);
  const [availabilityData, setAvailabilityData] = useState({ configured: false, teacherTimezone: '', slots: [] });

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale) + '?redirect=' + encodeURIComponent('/book-trial/' + teacherId));
      return;
    }

    if (user?.role !== 'student') {
      navigate(localizedPath('/journey', locale), { replace: true });
      return;
    }
    if (!user?.name?.trim() || !user?.phone?.trim() || (user?.onboarding?.required && !user?.onboarding?.completed)) {
      navigate(localizedPath('/profile/setup', locale) + '?next=' + encodeURIComponent(localizedPath('/journey', locale)), { replace: true });
      return;
    }
    if (user?.onboarding?.trackSelected !== true) {
      navigate(localizedPath('/journey', locale), { replace: true });
      return;
    }

    Promise.all([
      api.get('/api/teachers/' + teacherId),
      api.get('/api/sessions/my-sessions?type=trial&limit=100', { auth: true }).catch(() => ({ sessions: [] })),
      api.get('/api/sessions/available-slots/' + teacherId + '?days=14').catch(() => ({
        configured: false,
        teacherTimezone: '',
        slots: [],
      })),
    ])
      .then(([teacherData, sessionData, availability]) => {
        setTeacher(teacherData);
        setAvailabilityData({
          configured: Boolean(availability?.configured),
          teacherTimezone: availability?.teacherTimezone || teacherData?.availabilityTimezone || '',
          slots: Array.isArray(availability?.slots) ? availability.slots : [],
        });
        const active = (sessionData.sessions || []).find((session) => {
          const sessionTeacherId = String(session.teacher?._id || session.teacher || '');
          return sessionTeacherId === String(teacherId) && ['pending', 'accepted'].includes(session.status);
        });
        setExistingTrial(active || null);
      })
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false));
  }, [teacherId, navigate, locale, authLoading, isAuthenticated, user]);

  const dateKeyInTimezone = (value, zone) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  const fallbackDates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return date.toISOString().split('T')[0];
  });

  const availableDates = availabilityData.configured
    ? [...new Set(
        availabilityData.slots.map((slot) => dateKeyInTimezone(slot.startsAt, timezone)),
      )]
    : fallbackDates;

  const fallbackTimes = [];
  for (let hour = 8; hour <= 20; hour += 1) {
    fallbackTimes.push(String(hour).padStart(2, '0') + ':00');
    fallbackTimes.push(String(hour).padStart(2, '0') + ':30');
  }

  const slotsForSelectedDate = availabilityData.configured
    ? availabilityData.slots.filter((slot) => dateKeyInTimezone(slot.startsAt, timezone) === selectedDate)
    : [];

  const baseTimezones = [
    ['Africa/Cairo', isAr ? 'القاهرة' : 'Cairo'],
    ['Asia/Riyadh', isAr ? 'الرياض' : 'Riyadh'],
    ['Asia/Dubai', isAr ? 'دبي' : 'Dubai'],
    ['Asia/Kuwait', isAr ? 'الكويت' : 'Kuwait'],
    ['Asia/Qatar', isAr ? 'قطر' : 'Qatar'],
    ['Asia/Amman', isAr ? 'عمّان' : 'Amman'],
    ['Asia/Beirut', isAr ? 'بيروت' : 'Beirut'],
    ['Europe/London', 'London'],
    ['Europe/Paris', 'Paris'],
    ['America/New_York', 'New York'],
  ];
  const timezones = baseTimezones.some(([value]) => value === DEVICE_TIMEZONE)
    ? baseTimezones
    : [[DEVICE_TIMEZONE, isAr ? 'توقيت جهازك' : 'Your device timezone'], ...baseTimezones];

  const submit = async (event) => {
    event.preventDefault();
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setSubmitting(true);
    try {
      const scheduledAt = availabilityData.configured
        ? selectedTime
        : `${selectedDate}T${selectedTime}:00`;

      await api.post('/api/sessions/trial', {
        teacherId,
        scheduledAt,
        timezone,
        notes,
      }, { auth: true });

      toast.success(
        isAr
          ? 'تم إرسال طلب الحصة التجريبية بنجاح!'
          : 'Your trial session request has been submitted!',
      );
      navigate(localizedPath('/student/dashboard', locale));
    } catch (err) {
      if (err.code === 'TRIAL_ALREADY_EXISTS' && err.data?.existingSession) {
        setExistingTrial(err.data.existingSession);
        setShowConfirmation(false);
      } else {
        toast.error(err.message || (isAr ? 'تعذر إرسال طلب الحجز' : 'Unable to send booking request'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-session-shell">
          <div className="wn-booking-wrap" aria-hidden="true">
            <section className="wn-booking-card">
              <div className="wn-booking-head">
                <Skeleton className="h-4 w-36 bg-white/15" />
                <div className="wn-booking-teacher mt-4">
                  <Skeleton className="h-20 w-20 rounded-2xl bg-white/15 shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-7 w-56 bg-white/20 mb-2" />
                    <Skeleton className="h-4 w-36 bg-white/15" />
                  </div>
                </div>
              </div>
              <div className="wn-booking-form">
                <Skeleton className="h-14 w-full rounded-xl" />
                <div className="grid md:grid-cols-2 gap-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            </section>
          </div>
          <p className="sr-only" role="status">
            {isAr ? 'جاري تحميل مواعيد الحجز...' : 'Loading booking slots...'}
          </p>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!teacher) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-session-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-public-empty max-w-xl w-full"><h3>{isAr ? 'ملف المعلم غير متاح' : 'Teacher profile unavailable'}</h3></div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const name = teacher.user?.name || teacher.personalInfo?.fullName || (isAr ? 'معلم قرآن' : 'Quran teacher');
  const photo = teacherPublicImage(teacher.media?.profilePhoto || teacher.user?.avatar);
  const currentStep = showConfirmation ? 2 : selectedDate && selectedTime ? 1.5 : 1;

  return (
    <>
      <GlobalHeader />
      <main className="wn-session-shell">
        <div className="wn-booking-wrap">
          <section className="wn-booking-card">
            <div className="wn-booking-head">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="wn-auth-visual__eyebrow">
                  <Sparkles size={14} /> {isAr ? 'حجز جلسة تعريفية مجانية' : 'BOOK A FREE INTRODUCTORY SESSION'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#efd28e]">
                  <ShieldCheck size={14} /> {isAr ? 'مجانية 100% — بدون بطاقة بنكية' : '100% Free — No card required'}
                </span>
              </div>

              <div className="wn-booking-teacher mt-4">
                <img src={photo} alt={name} onError={teacherImageFallback} loading="eager" decoding="async" />
                <div>
                  <h1>{isAr ? 'اختر موعدًا مناسبًا' : 'Choose a suitable time'}</h1>
                  <p>{isAr ? 'مع ' + name : 'With ' + name}</p>
                </div>
              </div>

              {/* 3-Step Visual Progress Indicator */}
              <div className="wn-booking-steps" aria-label={isAr ? 'خطوات الحجز' : 'Booking steps'}>
                <div className={currentStep >= 1 ? 'wn-booking-step is-active' : 'wn-booking-step'}>
                  <span className="wn-booking-step__num">1</span>
                  <span>{isAr ? 'اختيار اليوم والوقت' : 'Pick date & time'}</span>
                </div>
                <div className="wn-booking-step__line" />
                <div className={currentStep >= 2 ? 'wn-booking-step is-active' : 'wn-booking-step'}>
                  <span className="wn-booking-step__num">2</span>
                  <span>{isAr ? 'مراجعة التفاصيل' : 'Review details'}</span>
                </div>
                <div className="wn-booking-step__line" />
                <div className="wn-booking-step">
                  <span className="wn-booking-step__num">3</span>
                  <span>{isAr ? 'تأكيد الموعد' : 'Confirm session'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="wn-booking-form">
              {existingTrial && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <strong className="block">
                        {existingTrial.status === 'accepted'
                          ? (isAr ? 'لديك حصة تجريبية مقبولة بالفعل مع هذا المعلم' : 'You already have an accepted trial with this teacher')
                          : (isAr ? 'لديك طلب حصة تجريبية قيد انتظار هذا المعلم' : 'You already have a pending trial request with this teacher')}
                      </strong>
                      {existingTrial.scheduledAt && (
                        <p className="text-sm mt-1">
                          {isAr ? 'الموعد: ' : 'Time: '}
                          {formatSessionDateTime(existingTrial, isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })} ({sessionTimeZone(existingTrial)})
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(localizedPath('/student/dashboard', locale))}
                        className="mt-3 text-sm font-bold underline"
                      >
                        {isAr ? 'عرض حالة الطلب في لوحة الطالب' : 'View request status in student dashboard'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="wn-booking-note">
                {availabilityData.configured
                  ? (isAr
                    ? `المواعيد التالية مأخوذة مباشرة من جدول المعلم (${availabilityData.teacherTimezone || 'توقيت المعلم'})، وتظهر لك حسب المنطقة الزمنية التي تختارها.`
                    : `These times come directly from the tutor schedule (${availabilityData.teacherTimezone || 'tutor timezone'}) and are shown in your selected timezone.`)
                  : (isAr
                    ? 'لم يحدد المعلم جدول توفر بعد؛ أرسل الوقت المقترح وسيقوم المعلم بتأكيده أو اقتراح بديل.'
                    : 'The tutor has not configured availability yet; send a preferred time for confirmation.')}
              </div>

              {/* Interactive Visual Date Strip */}
              {availableDates.length > 0 && (
                <div className="wn-booking-visual-group">
                  <span className="wn-booking-visual-title">
                    <Calendar size={15} /> {isAr ? 'اختر اليوم المناسب سريعًا:' : 'Quickly pick a day:'}
                  </span>
                  <div className="wn-booking-date-strip">
                    {availableDates.slice(0, 7).map((date) => {
                      const representative = availabilityData.configured
                        ? availabilityData.slots.find((slot) => dateKeyInTimezone(slot.startsAt, timezone) === date)?.startsAt
                        : date + 'T12:00:00';
                      const dObj = new Date(representative);
                      const weekday = dObj.toLocaleDateString(isAr ? 'ar-EG' : 'en', {
                        timeZone: availabilityData.configured ? timezone : undefined,
                        weekday: 'short',
                      });
                      const dayNum = dObj.toLocaleDateString(isAr ? 'ar-EG' : 'en', {
                        timeZone: availabilityData.configured ? timezone : undefined,
                        day: 'numeric',
                      });
                      const monthShort = dObj.toLocaleDateString(isAr ? 'ar-EG' : 'en', {
                        timeZone: availabilityData.configured ? timezone : undefined,
                        month: 'short',
                      });
                      const isSelected = selectedDate === date;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime('');
                            setShowConfirmation(false);
                          }}
                          className={isSelected ? 'wn-booking-date-chip is-selected' : 'wn-booking-date-chip'}
                        >
                          <small>{weekday}</small>
                          <strong>{dayNum}</strong>
                          <span>{monthShort}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Visual Time Slot Pills when a date is selected */}
              {selectedDate && (
                <div className="wn-booking-visual-group">
                  <span className="wn-booking-visual-title">
                    <Clock size={15} /> {isAr ? 'اختر الفترة الزمنية:' : 'Pick a time slot:'}
                  </span>
                  <div className="wn-booking-time-pills">
                    {(availabilityData.configured
                      ? slotsForSelectedDate.map((slot) => ({
                          value: slot.startsAt,
                          label: new Date(slot.startsAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en', {
                            timeZone: timezone,
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        }))
                      : fallbackTimes.slice(0, 12).map((time) => ({ value: time, label: time }))
                    ).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setSelectedTime(item.value);
                          setShowConfirmation(false);
                        }}
                        className={selectedTime === item.value ? 'wn-booking-time-pill is-selected' : 'wn-booking-time-pill'}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="wn-booking-field">
                  <label><Calendar size={15} className="inline ml-1" /> {isAr ? 'التاريخ' : 'Date'}</label>
                  <select value={selectedDate} onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedTime('');
                  }} required>
                    <option value="">{isAr ? 'اختر تاريخًا' : 'Choose a date'}</option>
                    {availableDates.map((date) => {
                      const representative = availabilityData.configured
                        ? availabilityData.slots.find((slot) => dateKeyInTimezone(slot.startsAt, timezone) === date)?.startsAt
                        : date + 'T12:00:00';
                      return (
                        <option key={date} value={date}>
                          {new Date(representative).toLocaleDateString(isAr ? 'ar-EG' : 'en', {
                            timeZone: availabilityData.configured ? timezone : undefined,
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="wn-booking-field">
                  <label><Clock size={15} className="inline ml-1" /> {isAr ? 'الوقت' : 'Time'}</label>
                  <select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} required disabled={!selectedDate}>
                    <option value="">{isAr ? 'اختر وقتًا' : 'Choose a time'}</option>
                    {availabilityData.configured
                      ? slotsForSelectedDate.map((slot) => (
                          <option key={slot.startsAt} value={slot.startsAt}>
                            {new Date(slot.startsAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en', {
                              timeZone: timezone,
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </option>
                        ))
                      : fallbackTimes.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
              </div>

              <div className="wn-booking-field">
                <label><Globe size={15} className="inline ml-1" /> {isAr ? 'المنطقة الزمنية' : 'Timezone'}</label>
                <select value={timezone} onChange={(event) => {
                  setTimezone(event.target.value);
                  setSelectedDate('');
                  setSelectedTime('');
                }} required>
                  {timezones.map(([value,label]) => <option key={value} value={value}>{label} — {value}</option>)}
                </select>
              </div>

              <div className="wn-booking-field">
                <label>{isAr ? 'ملاحظات للمعلم (اختياري)' : 'Notes for the teacher (optional)'}</label>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder={isAr ? 'مثال: أريد التركيز على التجويد أو تحديد المستوى.' : 'Example: I want to focus on Tajweed or assess my level.'} />
              </div>

              {existingTrial ? (
                <button
                  type="button"
                  onClick={() => navigate(localizedPath('/student/dashboard', locale))}
                  className="wn-btn wn-btn--secondary wn-btn--lg wn-btn--block"
                >
                  {isAr ? 'اذهب إلى طلبك الحالي' : 'Go to your existing request'}
                </button>
              ) : showConfirmation ? (
                <div className="wn-booking-confirm">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={19} className="text-[var(--wn-gold-dark)] mt-0.5" />
                    <div className="flex-1">
                      <strong className="text-[var(--wn-emerald-deep)]">{isAr ? 'راجع طلبك قبل الإرسال' : 'Review your request'}</strong>
                      <div className="wn-booking-summary">
                        <span><b>{isAr ? 'المعلم:' : 'Teacher:'}</b> {name}</span>
                        <span>
                          <b>{isAr ? 'التاريخ:' : 'Date:'}</b>{' '}
                          {availabilityData.configured && selectedTime
                            ? new Date(selectedTime).toLocaleDateString(isAr ? 'ar-EG' : 'en', { timeZone: timezone })
                            : selectedDate}
                        </span>
                        <span>
                          <b>{isAr ? 'الوقت:' : 'Time:'}</b>{' '}
                          {availabilityData.configured && selectedTime
                            ? new Date(selectedTime).toLocaleTimeString(isAr ? 'ar-EG' : 'en', {
                                timeZone: timezone,
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : selectedTime}
                        </span>
                        <span><b>{isAr ? 'المنطقة:' : 'Timezone:'}</b> {timezone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mt-4">
                    <button type="button" onClick={() => setShowConfirmation(false)} className="wn-btn wn-btn--secondary wn-btn--block">{isAr ? 'تعديل' : 'Edit'}</button>
                    <button type="submit" disabled={submitting} className="wn-btn wn-btn--primary wn-btn--block disabled:opacity-60">
                      <CheckCircle size={16} /> {submitting ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'تأكيد الطلب' : 'Confirm request')}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="submit" className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block">{isAr ? 'مراجعة الحجز' : 'Review booking'}</button>
              )}
            </form>
          </section>
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}
