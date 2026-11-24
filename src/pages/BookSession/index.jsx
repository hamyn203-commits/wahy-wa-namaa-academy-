import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, Globe, AlertCircle, Sparkles, ShieldCheck, Loader2, RefreshCw, UserRound } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import EmptyState from '../../components/shared/EmptyState';
import Skeleton from '../../components/shared/Skeleton';
import TeacherAvatar from '../../components/shared/TeacherAvatar';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import api from '../../lib/api';
import { teacherPublicImage } from '../../lib/teacherMedia';
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
  const [searchParams] = useSearchParams();
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const bk = t?.student?.booking || {};
  const bkSteps = bk.steps || {};
  const bkTz = bk.timezones || {};
  const common = t?.common || {};
  const intlLocale = resolveIntlLocale(locale);

  const [teacher, setTeacher] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => String(searchParams.get('date') || '').slice(0, 10));
  const [selectedTime, setSelectedTime] = useState(() => String(searchParams.get('time') || ''));
  const [timezone, setTimezone] = useState(DEVICE_TIMEZONE);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [existingTrial, setExistingTrial] = useState(null);
  const [availabilityData, setAvailabilityData] = useState({ configured: false, teacherTimezone: '', slots: [] });

  const loadBookingData = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
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
      .catch(() => {
        setTeacher(null);
        setLoadFailed(true);
      })
      .finally(() => setLoading(false));
  }, [teacherId]);

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
      const returnToBooking = localizedPath('/book-trial/' + teacherId, locale);
      navigate(localizedPath('/profile/setup', locale) + '?next=' + encodeURIComponent(returnToBooking), { replace: true });
      return;
    }

    loadBookingData();
  }, [teacherId, navigate, locale, authLoading, isAuthenticated, user, loadBookingData]);

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
    ['Africa/Cairo', bkTz.cairo || 'Cairo'],
    ['Asia/Riyadh', bkTz.riyadh || 'Riyadh'],
    ['Asia/Dubai', bkTz.dubai || 'Dubai'],
    ['Asia/Kuwait', bkTz.kuwait || 'Kuwait'],
    ['Asia/Qatar', bkTz.qatar || 'Qatar'],
    ['Asia/Amman', bkTz.amman || 'Amman'],
    ['Asia/Beirut', bkTz.beirut || 'Beirut'],
    ['Europe/London', bkTz.london || 'London'],
    ['Europe/Paris', bkTz.paris || 'Paris'],
    ['America/New_York', bkTz.newYork || 'New York'],
  ];
  const timezones = baseTimezones.some(([value]) => value === DEVICE_TIMEZONE)
    ? baseTimezones
    : [[DEVICE_TIMEZONE, bk.yourDeviceTimezone || 'Your device timezone'], ...baseTimezones];

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
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

      toast.success(bk.submitSuccess || 'Your trial session request has been submitted!');
      navigate(localizedPath('/student/dashboard', locale));
    } catch (err) {
      if (err.code === 'TRIAL_ALREADY_EXISTS' && err.data?.existingSession) {
        setExistingTrial(err.data.existingSession);
        setShowConfirmation(false);
      } else {
        toast.error(err.message || bk.submitError || 'Unable to send booking request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-session-shell" dir={dir}>
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
            {bk.loadingSlots || 'Loading booking slots…'}
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
        <main className="wn-session-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="max-w-xl w-full">
            <EmptyState
              icon={UserRound}
              title={bk.teacherUnavailable || 'Teacher profile unavailable'}
              description={loadFailed ? (t?.student?.errors?.loadFailed || 'Could not load data. Please try again.') : undefined}
              action={
                loadFailed ? (
                  <button
                    type="button"
                    onClick={loadBookingData}
                    className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    <span>{common.retry || 'Try again'}</span>
                  </button>
                ) : undefined
              }
            />
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const name = teacher.user?.name || teacher.personalInfo?.fullName || (bk.quranTeacher || 'Quran teacher');
  const photo = teacherPublicImage(teacher.media?.profilePhoto || teacher.user?.avatar);
  const currentStep = showConfirmation ? 2 : selectedDate && selectedTime ? 1.5 : 1;

  return (
    <>
      <SEOHead page={{ title: bk.seoTitle || 'Book a trial session', url: '/book-trial/' + teacherId, noindex: true }} />
      <GlobalHeader />
      <main className="wn-session-shell" dir={dir}>
        <div className="wn-booking-wrap">
          <section className="wn-booking-card">
            <div className="wn-booking-head">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="wn-auth-visual__eyebrow">
                  <Sparkles size={14} aria-hidden="true" /> {bk.eyebrow || 'BOOK A FREE INTRODUCTORY SESSION'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[var(--wn-gold)]">
                  <ShieldCheck size={14} aria-hidden="true" /> {bk.freeBadge || '100% Free — No card required'}
                </span>
              </div>

              <div className="wn-booking-teacher mt-4">
                <TeacherAvatar
                  src={photo}
                  name={name}
                  alt={name}
                  size="md"
                  loading="eager"
                  className="h-20 w-20 rounded-2xl shrink-0"
                />
                <div>
                  <h1>{bk.title || 'Choose a suitable time'}</h1>
                  <p>{bk.withTeacher || 'With'} {name}</p>
                </div>
              </div>

              {/* 3-Step Visual Progress Indicator */}
              <div className="wn-booking-steps" aria-label={bk.stepsAria || 'Booking steps'}>
                <div className={currentStep >= 1 ? 'wn-booking-step is-active' : 'wn-booking-step'}>
                  <span className="wn-booking-step__num">1</span>
                  <span>{bkSteps.pickDateTime || 'Pick date & time'}</span>
                </div>
                <div className="wn-booking-step__line" />
                <div className={currentStep >= 2 ? 'wn-booking-step is-active' : 'wn-booking-step'}>
                  <span className="wn-booking-step__num">2</span>
                  <span>{bkSteps.reviewDetails || 'Review details'}</span>
                </div>
                <div className="wn-booking-step__line" />
                <div className="wn-booking-step">
                  <span className="wn-booking-step__num">3</span>
                  <span>{bkSteps.confirmSession || 'Confirm session'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="wn-booking-form">
              {existingTrial && (
                <div className="rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] p-4 text-[var(--wn-text-primary)]">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-[var(--wn-text-gold)]" aria-hidden="true" />
                    <div>
                      <strong className="block">
                        {existingTrial.status === 'accepted'
                          ? (bk.existingAccepted || 'You already have an accepted trial with this teacher')
                          : (bk.existingPending || 'You already have a pending trial request with this teacher')}
                      </strong>
                      {existingTrial.scheduledAt && (
                        <p className="text-sm mt-1 text-[var(--wn-text-secondary)]">
                          {bk.existingTime || 'Time:'}{' '}
                          {formatSessionDateTime(existingTrial, intlLocale, { dateStyle: 'medium', timeStyle: 'short' })} ({sessionTimeZone(existingTrial)})
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(localizedPath('/student/dashboard', locale))}
                        className="mt-2 min-h-[44px] inline-flex items-center text-sm font-bold text-[var(--wn-link)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                      >
                        {bk.viewRequestStatus || 'View request status in student dashboard'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="wn-booking-note">
                {availabilityData.configured
                  ? `${bk.availabilityFromSchedule || 'These slots come directly from the tutor schedule and are displayed in your selected timezone.'}${availabilityData.teacherTimezone ? ` (${availabilityData.teacherTimezone})` : ''}`
                  : (bk.availabilityPending || 'The tutor has not configured availability yet; send a preferred time for confirmation.')}
              </div>

              {/* Interactive Visual Date Strip */}
              {availableDates.length > 0 && (
                <div className="wn-booking-visual-group">
                  <span className="wn-booking-visual-title">
                    <Calendar size={15} aria-hidden="true" /> {bk.pickDay || 'Quickly pick a day:'}
                  </span>
                  <div className="wn-booking-date-strip">
                    {availableDates.slice(0, 7).map((date) => {
                      const representative = availabilityData.configured
                        ? availabilityData.slots.find((slot) => dateKeyInTimezone(slot.startsAt, timezone) === date)?.startsAt
                        : date + 'T12:00:00';
                      const dObj = new Date(representative);
                      const weekday = dObj.toLocaleDateString(intlLocale, {
                        timeZone: availabilityData.configured ? timezone : undefined,
                        weekday: 'short',
                      });
                      const dayNum = dObj.toLocaleDateString(intlLocale, {
                        timeZone: availabilityData.configured ? timezone : undefined,
                        day: 'numeric',
                      });
                      const monthShort = dObj.toLocaleDateString(intlLocale, {
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
                          className={`min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                            isSelected ? 'wn-booking-date-chip is-selected' : 'wn-booking-date-chip'
                          }`}
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
                    <Clock size={15} aria-hidden="true" /> {bk.pickSlot || 'Pick a time slot:'}
                  </span>
                  <div className="wn-booking-time-pills">
                    {(availabilityData.configured
                      ? slotsForSelectedDate.map((slot) => ({
                          value: slot.startsAt,
                          label: new Date(slot.startsAt).toLocaleTimeString(intlLocale, {
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
                        className={`min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
                          selectedTime === item.value ? 'wn-booking-time-pill is-selected' : 'wn-booking-time-pill'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="wn-booking-field">
                  <label htmlFor="book-date">
                    <Calendar size={15} className="inline me-1" aria-hidden="true" /> {bk.dateLabel || 'Date'}
                  </label>
                  <select
                    id="book-date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                      setSelectedTime('');
                    }}
                    required
                    className="min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <option value="">{bk.chooseDate || 'Choose a date'}</option>
                    {availableDates.map((date) => {
                      const representative = availabilityData.configured
                        ? availabilityData.slots.find((slot) => dateKeyInTimezone(slot.startsAt, timezone) === date)?.startsAt
                        : date + 'T12:00:00';
                      return (
                        <option key={date} value={date}>
                          {new Date(representative).toLocaleDateString(intlLocale, {
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
                  <label htmlFor="book-time">
                    <Clock size={15} className="inline me-1" aria-hidden="true" /> {bk.timeLabel || 'Time'}
                  </label>
                  <select
                    id="book-time"
                    value={selectedTime}
                    onChange={(event) => setSelectedTime(event.target.value)}
                    required
                    disabled={!selectedDate}
                    className="min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <option value="">{bk.chooseTime || 'Choose a time'}</option>
                    {availabilityData.configured
                      ? slotsForSelectedDate.map((slot) => (
                          <option key={slot.startsAt} value={slot.startsAt}>
                            {new Date(slot.startsAt).toLocaleTimeString(intlLocale, {
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
                <label htmlFor="book-timezone">
                  <Globe size={15} className="inline me-1" aria-hidden="true" /> {bk.timezoneLabel || 'Timezone'}
                </label>
                <select
                  id="book-timezone"
                  value={timezone}
                  onChange={(event) => {
                    setTimezone(event.target.value);
                    setSelectedDate('');
                    setSelectedTime('');
                  }}
                  required
                  className="min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  {timezones.map(([value, label]) => <option key={value} value={value}>{label} — {value}</option>)}
                </select>
              </div>

              <div className="wn-booking-field">
                <label htmlFor="book-notes">{bk.notesLabel || 'Notes for the teacher (optional)'}</label>
                <textarea
                  id="book-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder={bk.notesPlaceholder || 'Example: I want to focus on Tajweed or assess my level.'}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                />
              </div>

              {existingTrial ? (
                <button
                  type="button"
                  onClick={() => navigate(localizedPath('/student/dashboard', locale))}
                  className="wn-btn wn-btn--secondary wn-btn--lg wn-btn--block min-h-[44px]"
                >
                  {bk.goToExisting || 'Go to your existing request'}
                </button>
              ) : showConfirmation ? (
                <div className="wn-booking-confirm">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={19} className="text-[var(--wn-text-gold)] mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="flex-1">
                      <strong className="text-[var(--wn-heading)]">{bk.reviewHeading || 'Review your request'}</strong>
                      <div className="wn-booking-summary">
                        <span><b>{bk.teacherField || 'Teacher:'}</b> {name}</span>
                        <span>
                          <b>{bk.dateField || 'Date:'}</b>{' '}
                          {availabilityData.configured && selectedTime
                            ? new Date(selectedTime).toLocaleDateString(intlLocale, { timeZone: timezone })
                            : selectedDate}
                        </span>
                        <span>
                          <b>{bk.timeField || 'Time:'}</b>{' '}
                          {availabilityData.configured && selectedTime
                            ? new Date(selectedTime).toLocaleTimeString(intlLocale, {
                                timeZone: timezone,
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : selectedTime}
                        </span>
                        <span><b>{bk.timezoneField || 'Timezone:'}</b> {timezone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mt-4">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowConfirmation(false)}
                      className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    >
                      {bk.editBtn || 'Edit'}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="wn-btn wn-btn--primary wn-btn--block min-h-[44px] inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                      <span>{submitting ? (bk.sending || 'Sending…') : (bk.confirmBtn || 'Confirm request')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button type="submit" className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block min-h-[44px]">
                  {bk.reviewBtn || 'Review booking'}
                </button>
              )}
            </form>
          </section>
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}

