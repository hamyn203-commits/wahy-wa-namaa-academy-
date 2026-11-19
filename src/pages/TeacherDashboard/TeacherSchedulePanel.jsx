import { Clock, Loader2, Plus, X } from 'lucide-react';

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function TeacherSchedulePanel({
  schedule,
  savingSchedule,
  saveSchedule,
  addScheduleSlot,
  updateScheduleSlot,
  removeScheduleSlot,
  t,
}) {
  const tp = t?.teacherPortal || {};
  const sc = tp.schedule || {};
  const weekdays = tp.weekdays || {};

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
          disabled={savingSchedule}
          className="wn-teacher-primary-action min-h-[44px] inline-flex items-center justify-center gap-2"
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
