import { AlertTriangle, Clock, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherSchedulePanel({
  schedule,
  scheduleLoading,
  scheduleError,
  scheduleLoaded,
  onRetrySchedule,
  savingSchedule,
  saveSchedule,
  addScheduleSlot,
  updateScheduleSlot,
  removeScheduleSlot,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const sc = tp.schedule || {};
  const errDict = tp.errors || {};
  const an = tp.analytics || {};
  const weekdays = tp.weekdays || {};

  if (scheduleError && !scheduleLoaded) {
    return (
      <div className="wn-teacher-schedule">
        <div
          role="alert"
          className="rounded-2xl border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] p-6 text-center space-y-3"
        >
          <AlertTriangle size={28} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
          <h3 className="text-base font-bold text-[var(--wn-heading)]">
            {errDict.dashboardLoadFailed || 'تعذر تحميل الجدول الأسبوعي'}
          </h3>
          <p className="text-sm text-[var(--wn-text-secondary)]">
            {an.errorDesc || 'تحقق من الاتصال ثم أعد المحاولة.'}
          </p>
          <button
            type="button"
            onClick={onRetrySchedule}
            className="wn-btn wn-btn--primary min-h-[44px] inline-flex items-center gap-2"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{errDict.retry || 'إعادة المحاولة'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (scheduleLoading && !scheduleLoaded) {
    return (
      <div className="wn-teacher-schedule space-y-4" role="status" aria-live="polite">
        <span className="sr-only">{sc.title || 'جدولك الأسبوعي'}</span>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="wn-teacher-schedule">
      <div className="wn-teacher-schedule__intro">
        <div>
          <span>{sc.eyebrow || 'إدارة التوفر'}</span>
          <h3>{sc.title || 'جدولك الأسبوعي'}</h3>
          <p>{sc.subtitle || 'يمكنك إضافة أكثر من فترة في اليوم نفسه. يمنع النظام الفترات المتداخلة تلقائيًا.'}</p>
        </div>
        <button
          type="button"
          onClick={saveSchedule}
          disabled={savingSchedule || scheduleError || scheduleLoading || !scheduleLoaded}
          className="wn-teacher-primary-action min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {savingSchedule && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          <span>{savingSchedule ? (sc.savingBtn || 'جاري الحفظ…') : (sc.saveBtn || 'حفظ التوفر')}</span>
        </button>
      </div>

      <div className="wn-teacher-schedule__days">
        {schedule.map((day, dayIndex) => {
          const dayLabel = weekdays[day.day] || day.label;
          return (
            <section key={day.day} className="wn-teacher-schedule-day">
              <div className="wn-teacher-schedule-day__heading">
                <div>
                  <strong>{dayLabel}</strong>
                  <small>
                    {day.slots.length
                      ? formatMsg(sc.availableSlotCount || '{count} فترة متاحة', { count: day.slots.length })
                      : (sc.unavailable || 'غير متاح')}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => addScheduleSlot(dayIndex)}
                  className="min-h-[44px]"
                >
                  <Plus size={15} aria-hidden="true" /> {sc.addSlotBtn || 'إضافة فترة'}
                </button>
              </div>

              {day.slots.length === 0 ? (
                <div className="wn-teacher-schedule-day__off">
                  {sc.noSlotsForDay || 'لا توجد أوقات متاحة في هذا اليوم'}
                </div>
              ) : (
                <div className="wn-teacher-schedule-day__slots">
                  {day.slots.map((slot, slotIndex) => (
                    <div key={`${day.day}-${slotIndex}`}>
                      <Clock size={16} aria-hidden="true" />
                      <input
                        type="time"
                        className="input-field"
                        aria-label={`${dayLabel} — ${sc.startTimeAria || 'وقت البداية'} ${slotIndex + 1}`}
                        value={slot.startTime}
                        onChange={(event) => updateScheduleSlot(dayIndex, slotIndex, 'startTime', event.target.value)}
                      />
                      <span>{sc.toLabel || 'إلى'}</span>
                      <input
                        type="time"
                        className="input-field"
                        aria-label={`${dayLabel} — ${sc.endTimeAria || 'وقت النهاية'} ${slotIndex + 1}`}
                        value={slot.endTime}
                        onChange={(event) => updateScheduleSlot(dayIndex, slotIndex, 'endTime', event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeScheduleSlot(dayIndex, slotIndex)}
                        aria-label={sc.removeSlotAria || 'حذف الفترة'}
                        className="min-h-[44px] min-w-[44px] grid place-items-center"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
