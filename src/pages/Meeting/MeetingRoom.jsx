import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Languages, Video, AlertCircle, RotateCcw } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import SessionTranslateChat from '../../components/live/SessionTranslateChat';
import Skeleton from '../../components/shared/Skeleton';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import { localizedPath } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import api from '../../lib/api';
import '../../styles/session-experience.css';

export default function MeetingRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const { user, ready } = useRequireAuth(['student', 'guardian', 'teacher', 'admin']);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [meeting, setMeeting] = useState(null);
  const [myLang, setMyLang] = useState('ar');
  const [partnerLang, setPartnerLang] = useState('id');

  const fetchMeeting = useCallback(async () => {
    if (!ready || !user) return;
    setLoading(true);
    setLoadError('');
    try {
      const [meet, langData] = await Promise.all([
        api.get('/api/meetings/session/' + sessionId, { auth: true }),
        api.get('/api/sessions/' + sessionId + '/translate/languages', { auth: true }).catch(() => ({})),
      ]);
      const rawUrl = String(meet?.meeting?.url || '').trim();
      if (rawUrl.startsWith('/live/')) {
        navigate(localizedPath(rawUrl, locale), { replace: true });
        return;
      }
      setMeeting(meet);
      const isTeacher = user.role === 'teacher' || user.role === 'admin';
      if (isTeacher) {
        setMyLang(langData.teacher?.lang || 'ar');
        setPartnerLang(langData.student?.lang || 'id');
      } else {
        setMyLang(langData.student?.lang || user.preferences?.language || 'id');
        setPartnerLang(langData.teacher?.lang || 'ar');
      }
    } catch (err) {
      const msg = err?.message || t.common.errorTitle;
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [ready, user, sessionId, navigate, locale, t, toast]);

  useEffect(() => {
    fetchMeeting();
  }, [fetchMeeting]);

  if (!ready || loading) {
    return (
      <div className="wn-meeting-shell p-4 space-y-4" dir={dir} role="status" aria-busy="true" aria-label={t.common.loading}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="wn-meeting-shell" dir={dir}>
        <GlobalHeader />
        <div className="flex-1 flex items-center justify-center p-6">
          <div role="alert" className="max-w-md w-full rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-6 text-center space-y-4">
            <AlertCircle size={36} className="mx-auto text-[var(--wn-text-danger)]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[var(--wn-text-primary)]">{t.common.errorTitle}</h2>
            <p className="text-sm text-[var(--wn-text-secondary)]">{loadError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={fetchMeeting}
                className="btn-primary min-h-[44px] inline-flex items-center gap-2"
              >
                <RotateCcw size={16} aria-hidden="true" />
                <span>{t.common.retry}</span>
              </button>
              <Link
                to={dashboardPathForRole(user?.role, locale)}
                className="btn-secondary min-h-[44px] inline-flex items-center gap-2"
              >
                {isRTL ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
                <span>{t.live.meeting.dashboard}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rawMeetUrl = String(meeting?.meeting?.url || '').trim();
  const isObserver = Boolean(meeting?.meeting?.isObserver || user?.role === 'guardian');
  const meetUrl = /^https:\/\//i.test(rawMeetUrl) ? rawMeetUrl : '';

  return (
    <div className="wn-meeting-shell" dir={dir}>
      <GlobalHeader />
      <div className="wn-meeting-bar flex-wrap">
        <span className="flex items-center gap-2">
          <Languages size={16} aria-hidden="true" />
          {t.live.meeting.liveTranslationSession}
        </span>
        <Link to={dashboardPathForRole(user?.role, locale)} className="wn-meeting-back min-h-[44px]">
          {isRTL ? <ArrowRight size={14} aria-hidden="true" /> : <ArrowLeft size={14} aria-hidden="true" />}
          <span>{t.live.meeting.dashboard}</span>
        </Link>
      </div>

      <div className="wn-meeting-content">
        <div className="wn-meeting-stage">
          {meetUrl ? (
            <iframe
              title={t.live.meeting.liveTranslationSession}
              src={meetUrl}
              referrerPolicy="no-referrer"
              allow={isObserver ? 'fullscreen' : 'camera; microphone; fullscreen'}
            />
          ) : (
            <div className="wn-meeting-empty">
              <div>
                <Video size={46} className="mx-auto opacity-50" aria-hidden="true" />
                <p className="mt-3">{t.live.meeting.noMeetingLink}</p>
              </div>
            </div>
          )}
        </div>

        {!isObserver && (
          <aside className="wn-meeting-chat">
            <SessionTranslateChat sessionId={sessionId} myLang={myLang} partnerLang={partnerLang} uiLocale={locale} />
          </aside>
        )}
      </div>
    </div>
  );
}
