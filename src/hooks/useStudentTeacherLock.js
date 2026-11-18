import { useEffect, useState } from 'react';
import api from '../lib/api';
import { getAccessToken } from '../lib/authSession';
import { teacherLockFromSubscriptions } from '../lib/studentTeacherLock';

const LOCK_TTL_MS = 15 * 1000;
let cachedLockEntry = null;
let inflightLockPromise = null;

export function clearStudentTeacherLockCache() {
  cachedLockEntry = null;
  inflightLockPromise = null;
}

function readValidCachedLock() {
  const tokenKey = getAccessToken() || 'cookie';
  if (
    cachedLockEntry
    && cachedLockEntry.tokenKey === tokenKey
    && Date.now() - cachedLockEntry.fetchedAt < LOCK_TTL_MS
  ) {
    return cachedLockEntry.lock;
  }
  return undefined;
}

async function resolveStudentTeacherLock() {
  const tokenKey = getAccessToken() || 'cookie';
  const cached = readValidCachedLock();
  if (cached !== undefined) return cached;

  if (inflightLockPromise && inflightLockPromise.tokenKey === tokenKey) {
    return inflightLockPromise.promise;
  }

  const promise = api.get('/api/subscriptions/me', { auth: true })
    .then((result) => {
      const lock = teacherLockFromSubscriptions(result?.subscriptions || []);
      cachedLockEntry = { tokenKey, lock, fetchedAt: Date.now() };
      return lock;
    })
    .catch(() => null)
    .finally(() => {
      if (inflightLockPromise?.tokenKey === tokenKey) {
        inflightLockPromise = null;
      }
    });

  inflightLockPromise = { tokenKey, promise };
  return promise;
}

export function useStudentTeacherLock(enabled) {
  const [state, setState] = useState(() => {
    if (!enabled) return { loading: false, lock: null };
    const cached = readValidCachedLock();
    return cached !== undefined
      ? { loading: false, lock: cached }
      : { loading: true, lock: null };
  });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    resolveStudentTeacherLock().then((lock) => {
      if (!cancelled) setState({ loading: false, lock });
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return enabled ? state : { loading: false, lock: null };
}
