import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Languages, Video } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import SessionTranslateChat from '../../components/live/SessionTranslateChat';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { dashboardPathForRole } from '../../lib/navigation';
import api from '../../lib/api';
import '../../styles/session-experience.css';

export default function MeetingRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const { user, ready } = useRequireAuth(['student', 'teacher', 'admin']);

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(null);
  const [myLang, setMyLang] = useState('ar');
  const [partnerLang, setPartnerLang] = useState('id');

  useEffect(() => {
    if (!ready || !user) return;
    Promise.all([
      api.get('/api/meetings/session/' + sessionId, { auth: true }),
      api.get('/api/sessions/' + sessionId + '/translate/languages', { auth: true }),
    ]).then(([meet, langData]) => {
      setMeeting(meet);
      const isTeacher = user.role === 'teacher' || user.role === 'admin';
      if (isTeacher) {
        setMyLang(langData.teacher?.lang || 'ar');
        setPartnerLang(langData.student?.lang || 'id');
      } else {
        setMyLang(langData.student?.lang || user.preferences?.language || 'id');
        setPartnerLang(langData.teacher?.lang || 'ar');
      }
    }).catch(() => navigate(dashboardPathForRole(user?.role, locale))).finally(() => setLoading(false));
  }, [ready, sessionId, navigate, user, locale]);

  if (!ready || loading) {
    return <div className="wn-meeting-shell grid place-items-center"><span className="w-9 h-9 rounded-full border-2 border-white/20 border-t-[#efd28e] animate-spin" /></div>;
  }

  const meetUrl = meeting?.meeting?.url;

  return (
    <div className="wn-meeting-shell">
      <GlobalHeader />
      <div className="wn-meeting-bar">
        <span className="flex items-center gap-2"><Languages size={16} /> {isAr ? 'جلسة مع ترجمة فورية' : 'Session with live translation'}</span>
        <Link to={dashboardPathForRole(user?.role, locale)} className="wn-meeting-back">
          <ArrowRight size={14} /> {isAr ? 'لوحة التحكم' : 'Dashboard'}
        </Link>
      </div>

      <div className="wn-meeting-content">
        <div className="wn-meeting-stage">
          {meetUrl ? (
            <iframe title="meeting" src={meetUrl} allow="camera; microphone; fullscreen" />
          ) : (
            <div className="wn-meeting-empty">
              <div>
                <Video size={46} className="mx-auto opacity-50" />
                <p className="mt-3">{isAr ? 'لم يُضف رابط الاجتماع لهذه الجلسة بعد.' : 'A meeting link has not been added to this session yet.'}</p>
              </div>
            </div>
          )}
        </div>

        <aside className="wn-meeting-chat">
          <SessionTranslateChat sessionId={sessionId} myLang={myLang} partnerLang={partnerLang} isAr={isAr} />
        </aside>
      </div>
    </div>
  );
}
