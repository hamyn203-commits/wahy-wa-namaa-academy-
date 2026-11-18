import api from './api';

const CACHE_TTL_MS = 60 * 1000;
const bundleCache = new Map();
const inflightRequests = new Map();

export function getCachedTeacherBundle(teacherId) {
  const id = String(teacherId || '').trim();
  if (!id) return null;
  const entry = bundleCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    bundleCache.delete(id);
    return null;
  }
  return entry.data;
}

export async function fetchTeacherBundle(teacherId, { force = false } = {}) {
  const id = String(teacherId || '').trim();
  if (!id) return { teacher: null, reviews: [], availability: { configured: false, teacherTimezone: '', slots: [] } };

  if (!force) {
    const cached = getCachedTeacherBundle(id);
    if (cached) return cached;
  }

  if (inflightRequests.has(id)) {
    return inflightRequests.get(id);
  }

  const encodedId = encodeURIComponent(id);
  const promise = Promise.allSettled([
    api.get(`/api/teachers/${encodedId}`),
    api.get(`/api/reviews/teacher/${encodedId}`),
    api.get(`/api/sessions/available-slots/${encodedId}?days=14`),
  ])
    .then(([teacherRes, reviewsRes, availabilityRes]) => {
      const teacherPayload = teacherRes.status === 'fulfilled' && teacherRes.value?._id
        ? teacherRes.value
        : null;
      const reviewsPayload = reviewsRes.status === 'fulfilled' && Array.isArray(reviewsRes.value?.reviews)
        ? reviewsRes.value.reviews
        : [];
      const availPayload = availabilityRes.status === 'fulfilled' && availabilityRes.value
        ? {
            configured: Boolean(availabilityRes.value.configured),
            teacherTimezone: availabilityRes.value.teacherTimezone || teacherPayload?.availabilityTimezone || '',
            slots: Array.isArray(availabilityRes.value.slots) ? availabilityRes.value.slots : [],
          }
        : { configured: false, teacherTimezone: '', slots: [] };

      const bundle = {
        teacher: teacherPayload,
        reviews: reviewsPayload,
        availability: availPayload,
      };
      if (teacherPayload) {
        bundleCache.set(id, { data: bundle, fetchedAt: Date.now() });
      }
      return bundle;
    })
    .finally(() => {
      inflightRequests.delete(id);
    });

  inflightRequests.set(id, promise);
  return promise;
}

export function prefetchTeacherBundle(teacherId) {
  const id = String(teacherId || '').trim();
  if (!id) return;
  fetchTeacherBundle(id).catch(() => {});
}
