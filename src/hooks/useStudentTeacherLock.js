import { useEffect, useState } from 'react';
import api from '../lib/api';
import { teacherLockFromSubscriptions } from '../lib/studentTeacherLock';

export function useStudentTeacherLock(enabled) {
  const [state, setState] = useState({ loading: true, lock: null });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api.get('/api/subscriptions/me', { auth: true })
      .then((result) => {
        if (!cancelled) setState({ loading: false, lock: teacherLockFromSubscriptions(result?.subscriptions || []) });
      })
      .catch(() => {
        // The backend still enforces the lock on booking and payment.
        if (!cancelled) setState({ loading: false, lock: null });
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return enabled ? state : { loading: false, lock: null };
}

