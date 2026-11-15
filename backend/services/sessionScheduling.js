'use strict';

const DEFAULT_TIMEZONE = 'Africa/Cairo';
const WEEKDAY_MAP = {
  Sunday: 'sunday',
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
};

function safeTimeZone(value) {
  const candidate = String(value || DEFAULT_TIMEZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function zonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const map = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: WEEKDAY_MAP[map.weekday],
  };
}

function localDateTimeToUtc(localDateTime, timeZone) {
  const match = String(localDateTime || '').match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };

  if (
    desired.month < 1 || desired.month > 12
    || desired.day < 1 || desired.day > 31
    || desired.hour < 0 || desired.hour > 23
    || desired.minute < 0 || desired.minute > 59
    || desired.second < 0 || desired.second > 59
  ) {
    return null;
  }

  const targetWallClock = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );

  let guess = targetWallClock;
  const zone = safeTimeZone(timeZone);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(guess), zone);
    const observedWallClock = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const delta = targetWallClock - observedWallClock;
    if (Math.abs(delta) < 1000) break;
    guess += delta;
  }

  const result = new Date(guess);
  const confirmed = zonedParts(result, zone);
  const matches = (
    confirmed.year === desired.year
    && confirmed.month === desired.month
    && confirmed.day === desired.day
    && confirmed.hour === desired.hour
    && confirmed.minute === desired.minute
  );

  return matches && !Number.isNaN(result.getTime()) ? result : null;
}

function parseRequestedDateTime(value, timeZone) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/Z$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalizedLocal = raw.length === 16 ? raw + ':00' : raw;
  const zoned = localDateTimeToUtc(normalizedLocal, timeZone);
  if (zoned) return zoned;

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
}

function teacherAvailabilityDecision(teacher, scheduledAt, durationMinutes = 60) {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return { allowed: false, configured: false, code: 'INVALID_SESSION_TIME' };
  }

  const availability = Array.isArray(teacher?.availability) ? teacher.availability : [];
  if (!availability.length) {
    return {
      allowed: true,
      configured: false,
      timeZone: safeTimeZone(teacher?.availabilityTimezone),
    };
  }

  const timeZone = safeTimeZone(teacher?.availabilityTimezone);
  const parts = zonedParts(date, timeZone);
  const day = availability.find((item) => item.day === parts.weekday);
  if (!day) {
    return { allowed: false, configured: true, timeZone, code: 'TEACHER_UNAVAILABLE' };
  }

  const start = (parts.hour * 60) + parts.minute;
  const end = start + Math.max(15, Number(durationMinutes || 60));

  const slot = (day.slots || []).find((item) => {
    const slotStart = timeToMinutes(item.startTime);
    const slotEnd = timeToMinutes(item.endTime);
    return slotStart != null && slotEnd != null && start >= slotStart && end <= slotEnd;
  });

  return {
    allowed: Boolean(slot),
    configured: true,
    timeZone,
    code: slot ? null : 'TEACHER_UNAVAILABLE',
    matchedSlot: slot || null,
  };
}

function overlaps(startA, durationA, startB, durationB) {
  const aStart = new Date(startA).getTime();
  const bStart = new Date(startB).getTime();
  const aEnd = aStart + (Math.max(15, Number(durationA || 60)) * 60 * 1000);
  const bEnd = bStart + (Math.max(15, Number(durationB || 60)) * 60 * 1000);
  return aStart < bEnd && bStart < aEnd;
}

function addLocalDays(parts, days) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function localDateString(parts) {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function generateTeacherSlotStarts(teacher, {
  days = 14,
  intervalMinutes = 30,
  durationMinutes = 60,
  now = new Date(),
} = {}) {
  const availability = Array.isArray(teacher?.availability) ? teacher.availability : [];
  if (!availability.length) return [];

  const timeZone = safeTimeZone(teacher?.availabilityTimezone);
  const today = zonedParts(now, timeZone);
  const results = [];

  for (let offset = 0; offset < Math.max(1, Number(days || 14)); offset += 1) {
    const localDay = addLocalDays(today, offset);
    const noon = localDateTimeToUtc(localDateString(localDay) + 'T12:00:00', timeZone);
    if (!noon) continue;
    const weekday = zonedParts(noon, timeZone).weekday;
    const configuredDay = availability.find((item) => item.day === weekday);
    if (!configuredDay) continue;

    for (const slot of configuredDay.slots || []) {
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      if (slotStart == null || slotEnd == null) continue;

      for (
        let minute = slotStart;
        minute + durationMinutes <= slotEnd;
        minute += intervalMinutes
      ) {
        const hours = Math.floor(minute / 60);
        const minutes = minute % 60;
        const local = localDateString(localDay)
          + 'T'
          + String(hours).padStart(2, '0')
          + ':'
          + String(minutes).padStart(2, '0')
          + ':00';
        const utc = localDateTimeToUtc(local, timeZone);
        if (!utc || utc.getTime() <= now.getTime()) continue;
        results.push({
          startsAt: utc,
          duration: durationMinutes,
          teacherTimeZone: timeZone,
          teacherLocalDate: localDateString(localDay),
          teacherLocalTime: String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0'),
        });
      }
    }
  }

  return results.sort((a, b) => a.startsAt - b.startsAt);
}

function circleLocalDateKey(circleId, scheduledAt, timeZone) {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (!circleId || Number.isNaN(date.getTime())) return null;
  const parts = zonedParts(date, safeTimeZone(timeZone));
  return `${String(circleId)}:${localDateString(parts)}`;
}

function circleScheduleDecision(circle, scheduledAt, durationMinutes = 60) {
  const date = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return { allowed: false, configured: false, code: 'INVALID_SESSION_TIME' };
  }
  const schedule = Array.isArray(circle?.schedule) ? circle.schedule : [];
  const timeZone = safeTimeZone(circle?.timezone);
  if (!schedule.length) {
    return { allowed: true, configured: false, timeZone };
  }
  const parts = zonedParts(date, timeZone);
  const start = (parts.hour * 60) + parts.minute;
  const end = start + Math.max(15, Number(durationMinutes || 60));

  const matchedSlot = schedule.find((row) => {
    if (String(row?.day || '').trim().toLowerCase() !== parts.weekday) return false;
    const slotStart = timeToMinutes(row.startTime);
    const slotEnd = timeToMinutes(row.endTime);
    if (slotStart == null || slotEnd == null) return false;
    // Allow starting within the configured circle slot window (with 15m grace tolerance)
    return start >= (slotStart - 15) && end <= (slotEnd + 15);
  });

  return {
    allowed: Boolean(matchedSlot),
    configured: true,
    timeZone,
    code: matchedSlot ? null : 'CIRCLE_SCHEDULE_MISMATCH',
    matchedSlot: matchedSlot || null,
  };
}

module.exports = {
  DEFAULT_TIMEZONE,
  safeTimeZone,
  zonedParts,
  localDateTimeToUtc,
  parseRequestedDateTime,
  teacherAvailabilityDecision,
  circleLocalDateKey,
  circleScheduleDecision,
  overlaps,
  generateTeacherSlotStarts,
};
