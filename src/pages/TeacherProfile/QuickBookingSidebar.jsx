import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import { localizedPath } from '../../lib/locale';

const DEVICE_TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
  } catch {
    return 'Africa/Cairo';
  }
})();

function dateKeyInZone(value, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export default function QuickBookingSidebar({
  teacherId,
  availability,
  availabilityLoading,
  isLockedToThisTeacher,
  onBookTrial,
  copy,
  locale,
}) {
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const groupedDays = useMemo(() => {
    if (!availability?.configured || !Array.isArray(availability.slots) || !availability.slots.length) {
      return [];
    }
    const map = new Map();
    for (const slot of availability.slots) {
      const key = dateKeyInZone(slot.startsAt, DEVICE_TIMEZONE);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    }
    return Array.from(map.entries()).slice(0, 5).map(([dayKey, slots]) => ({
      dayKey,
      slots: slots.slice(0, 8),
    }));
  }, [availability]);

  const activeDayKey = groupedDays.some((item) => item.dayKey === selectedDay)
    ? selectedDay
    : (groupedDays[0]?.dayKey || '');
  const activeDaySlots = groupedDays.find((item) => item.dayKey === activeDayKey)?.slots || [];

  const handleBookClick = () => {
    onBookTrial({
      date: selectedSlot ? activeDayKey : '',
      time: selectedSlot || '',
    });
  };

  if (isLockedToThisTeacher) {
    return (
      <>
        <aside className="lg:sticky lg:top-24">
          <div className="wn-tp-card wn-tp-card--booking p-5 md:p-6 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-emerald-soft)] px-3 py-1 text-xs font-extrabold text-[var(--wn-emerald-dark)]">
              <CheckCircle2 size={14} />
              {copy.lockedTutorBadge}
            </span>
            <h2 className="text-lg font-extrabold text-[var(--wn-heading)]">{copy.lockedTutorTitle}</h2>
            <p className="text-sm leading-relaxed text-[var(--wn-text-secondary)]">{copy.lockedTutorDesc}</p>
            <Link
              to={localizedPath('/student/dashboard?tab=sessions', locale)}
              className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block"
            >
              <Calendar size={17} />
              <span>{copy.goToMySessions}</span>
            </Link>
          </div>
        </aside>

        <div className="wn-tp-mobile-bar px-4 pt-3 lg:hidden">
          <Link
            to={localizedPath('/student/dashboard?tab=sessions', locale)}
            className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block"
          >
            <Calendar size={17} />
            <span>{copy.goToMySessions}</span>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <aside className="lg:sticky lg:top-24">
        <div className="wn-tp-card wn-tp-card--booking p-5 md:p-6 space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-gold-soft)] px-3 py-1 text-xs font-extrabold text-[var(--wn-gold-dark)]">
            <Sparkles size={14} />
            {copy.freeTrialBadge}
          </span>

          <div>
            <h2 className="text-xl font-black text-[var(--wn-heading)]">{copy.bookingHeading}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--wn-text-secondary)]">{copy.bookingSubheading}</p>
          </div>

          {availabilityLoading ? (
            <div className="space-y-2.5" aria-hidden="true">
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
              </div>
            </div>
          ) : groupedDays.length > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-bold text-[var(--wn-text-secondary)] flex items-center gap-1.5">
                  <Calendar size={14} className="text-[var(--wn-emerald)]" />
                  <span>{copy.pickDayLabel}</span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {groupedDays.map(({ dayKey, slots }) => {
                    const first = new Date(slots[0].startsAt);
                    const isSelected = dayKey === activeDayKey;
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => {
                          setSelectedDay(dayKey);
                          setSelectedSlot('');
                        }}
                        className={`wn-tp-slot-chip px-2 py-2 text-center ${isSelected ? 'is-selected' : ''}`}
                      >
                        <small className="block text-[11px] opacity-80">
                          {first.toLocaleDateString(copy.isAr ? 'ar-EG' : 'en', {
                            timeZone: DEVICE_TIMEZONE,
                            weekday: 'short',
                          })}
                        </small>
                        <strong className="block text-xs font-extrabold">
                          {first.toLocaleDateString(copy.isAr ? 'ar-EG' : 'en', {
                            timeZone: DEVICE_TIMEZONE,
                            day: 'numeric',
                            month: 'short',
                          })}
                        </strong>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeDaySlots.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-[var(--wn-text-secondary)] flex items-center gap-1.5">
                    <Clock size={14} className="text-[var(--wn-emerald)]" />
                    <span>{copy.pickTimeLabel}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {activeDaySlots.map((slot) => {
                      const isPicked = selectedSlot === slot.startsAt;
                      return (
                        <button
                          key={slot.startsAt}
                          type="button"
                          onClick={() => setSelectedSlot(isPicked ? '' : slot.startsAt)}
                          className={`wn-tp-slot-chip px-2 py-2 text-xs font-bold ${isPicked ? 'is-selected' : ''}`}
                        >
                          {new Date(slot.startsAt).toLocaleTimeString(copy.isAr ? 'ar-EG' : 'en', {
                            timeZone: DEVICE_TIMEZONE,
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-3.5 text-xs leading-relaxed text-[var(--wn-emerald-dark)]">
              {copy.noSlotsNotice}
            </div>
          )}

          <button
            type="button"
            onClick={handleBookClick}
            data-teacher-id={teacherId}
            className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block"
          >
            <Calendar size={17} />
            <span>{selectedSlot ? copy.bookSelectedSlot : copy.bookTrialAction}</span>
          </button>

          <ul className="space-y-2 border-t border-[var(--wn-border)] pt-3 text-xs text-[var(--wn-text-secondary)]">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0 text-[var(--wn-emerald)]" />
              <span>{copy.trustPoint1}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock size={14} className="shrink-0 text-[var(--wn-emerald)]" />
              <span>{copy.trustPoint2}</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={14} className="shrink-0 text-[var(--wn-emerald)]" />
              <span>{copy.trustPoint3}</span>
            </li>
          </ul>
        </div>
      </aside>

      <div className="wn-tp-mobile-bar px-4 pt-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] font-bold text-[var(--wn-gold-dark)]">{copy.freeTrialBadge}</span>
            <strong className="block truncate text-sm font-extrabold text-[var(--wn-heading)]">
              {selectedSlot
                ? new Date(selectedSlot).toLocaleString(copy.isAr ? 'ar-EG' : 'en', {
                    timeZone: DEVICE_TIMEZONE,
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : copy.bookingHeading}
            </strong>
          </div>
          <button
            type="button"
            onClick={handleBookClick}
            className="wn-btn wn-btn--primary wn-btn--md shrink-0"
          >
            {selectedSlot ? copy.bookSelectedSlot : copy.bookTrialAction}
          </button>
        </div>
      </div>
    </>
  );
}
