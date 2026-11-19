import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mic, BookOpen, GraduationCap, Loader2, Sparkles, Upload, Square, Radio, AlertCircle } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';
import { api } from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useAuth } from '../../hooks/useAuth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import { localizedPath } from '../../lib/locale';
import { loginPathForLocale } from '../../lib/navigation';

const TAB_CONFIG = [
  { id: 'quran', key: 'tajweed', icon: BookOpen, roles: ['student', 'teacher', 'guardian', 'admin'] },
  { id: 'recitation', key: 'recitation', icon: Mic, roles: ['student', 'teacher', 'admin'] },
  { id: 'student', key: 'studyPlan', icon: GraduationCap, roles: ['student', 'admin'] },
  { id: 'teacher', key: 'lessonPrep', icon: Bot, roles: ['teacher', 'admin'] },
];

const REC_KEYS = ['tajweed', 'makhraj', 'waqf', 'mad', 'ghunnah', 'noonSakinah'];

export default function AIHub() {
  const navigate = useNavigate();
  const { locale, dir, isRTL, t } = useI18n();
  const toast = useToast();
  const { isAuthenticated, user } = useAuth();
  const role = user?.role || '';

  const visibleTabs = useMemo(() => {
    return TAB_CONFIG
      .filter((item) => (role ? item.roles.includes(role) : item.id === 'quran'))
      .map((item) => ({
        ...item,
        label: t.aiHub.tabs[item.key],
      }));
  }, [role, t]);

  const [tab, setTab] = useState('quran');
  const [loading, setLoading] = useState(false);
  const [loadingReportId, setLoadingReportId] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [errorBanner, setErrorBanner] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [goal, setGoal] = useState('');
  const [level, setLevel] = useState('beginner');
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [teacherResult, setTeacherResult] = useState(null);
  const [studentPlan, setStudentPlan] = useState(null);
  const [recitationReport, setRecitationReport] = useState(null);
  const [surah, setSurah] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState([]);
  const fileRef = useRef(null);
  const tabRefs = useRef([]);
  const recorder = useAudioRecorder();

  useEffect(() => {
    if (!visibleTabs.some((item) => item.id === tab)) {
      setTab(visibleTabs[0]?.id || 'quran');
    }
  }, [visibleTabs, tab]);

  useEffect(() => {
    if (!isAuthenticated) {
      const target = localizedPath('/ai', locale);
      navigate(
        `${loginPathForLocale(locale)}?redirect=${encodeURIComponent(target)}`,
        { replace: true }
      );
      return;
    }

    let cancelled = false;

    if (role === 'admin') {
      api.get('/api/ai/status', { auth: true })
        .then((data) => {
          if (!cancelled) setAiStatus(data);
        })
        .catch(() => {});
    } else {
      setAiStatus(null);
    }

    if (['student', 'teacher', 'admin'].includes(role)) {
      api.get('/api/ai/recitation-reports', { auth: true })
        .then((d) => {
          if (!cancelled) setReports(d.reports || []);
        })
        .catch(() => {});
    } else {
      setReports([]);
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role, navigate, locale]);

  const clearError = (field) => {
    setErrorBanner('');
    if (field && fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const askQuran = async (e) => {
    e.preventDefault();
    if (!question.trim()) {
      setFieldErrors((prev) => ({ ...prev, question: t.aiHub.validationRequired }));
      return;
    }
    setLoading(true);
    setErrorBanner('');
    try {
      const res = await api.post('/api/ai/quran-assistant', { question: question.trim(), locale }, { auth: true });
      setAnswer(res.answer);
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAudio = async (file) => {
    if (!file || loading) return;
    setLoading(true);
    setErrorBanner('');
    try {
      let res;
      // Avoid Vercel's 4.5 MB serverless request payload cap by uploading larger files directly to private object storage first.
      if (file.size > 4 * 1024 * 1024) {
        const uploaded = await uploadFileDirect(file, 'recitation-audio');
        res = await api.post(
          '/api/ai/recitation-analyze',
          {
            storageRef: uploaded.url,
            contentType: uploaded.contentType || file.type,
            filename: uploaded.name || file.name || 'recitation.webm',
            locale,
            ...(surah.trim() ? { surah: surah.trim() } : {}),
          },
          { auth: true }
        );
      } else {
        const fd = new FormData();
        fd.append('audio', file, file.name || 'recitation.webm');
        fd.append('locale', locale);
        if (surah.trim()) fd.append('surah', surah.trim());
        res = await api.post('/api/ai/recitation-analyze', fd, { auth: true });
      }
      setRecitationReport(res);
      setSelectedReport(null);
      setReports((prev) => [res, ...prev]);
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      recorder.reset();
    }
  };

  const analyzeRecording = async () => {
    if (!recorder.audioBlob || loading) return;
    await analyzeAudio(new File([recorder.audioBlob], 'recitation.webm', { type: 'audio/webm' }));
  };

  const startLiveRecording = async () => {
    setErrorBanner('');
    try {
      await recorder.start();
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    }
  };

  const getStudentPlan = async (e) => {
    e?.preventDefault?.();
    if (!goal.trim()) {
      setFieldErrors((prev) => ({ ...prev, goal: t.aiHub.validationRequired }));
      return;
    }
    setLoading(true);
    setErrorBanner('');
    try {
      const res = await api.post('/api/ai/student-assistant', { goal: goal.trim(), level, locale }, { auth: true });
      setStudentPlan(res);
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (id) => {
    if (!id || loadingReportId) return;
    setLoadingReportId(id);
    setErrorBanner('');
    try {
      const r = await api.get(`/api/ai/recitation-reports/${id}`, { auth: true });
      setSelectedReport(r?.report || r);
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoadingReportId(null);
    }
  };

  const displayReport = selectedReport || recitationReport;

  const getTeacherHelp = async (e) => {
    e?.preventDefault?.();
    if (!teacherPrompt.trim()) {
      setFieldErrors((prev) => ({ ...prev, teacherPrompt: t.aiHub.validationRequired }));
      return;
    }
    setLoading(true);
    setErrorBanner('');
    try {
      const res = await api.post('/api/ai/teacher-assistant', { prompt: teacherPrompt.trim(), locale }, { auth: true });
      setTeacherResult(res);
    } catch (err) {
      const msg = err?.message || t.aiHub.errorFallback;
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTabKeyDown = (event, index) => {
    if (!visibleTabs.length) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = isRTL
        ? (index - 1 + visibleTabs.length) % visibleTabs.length
        : (index + 1) % visibleTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = isRTL
        ? (index + 1) % visibleTabs.length
        : (index - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleTabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const targetTab = visibleTabs[nextIndex];
    if (!targetTab) return;
    setTab(targetTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="wn-ai-shell" dir={dir}>
      <SEOHead page={{ url: '/ai', noindex: true, canonical: false }} />
      <GlobalHeader />
      <main className="wn-ai-wrap">
        <div className="wn-ai-heading">
          <div className="wn-ai-heading__icon">
            <Sparkles className="text-[var(--wn-emerald)]" size={28} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t.aiHub.title}</h1>
            <p className="text-[var(--wn-text-secondary)] text-sm">
              {aiStatus?.mode === 'cloud'
                ? `${t.aiHub.connectedProvider} — ${aiStatus.activeProvider}`
                : t.aiHub.platformAvailable}
            </p>
            <p className="text-xs text-[var(--wn-text-tertiary)] mt-0.5">{t.aiHub.roleNotice}</p>
            {aiStatus?.chain && (
              <div className="flex flex-wrap gap-1 mt-1">
                {aiStatus.chain.filter((p) => p !== 'local').map((p) => (
                  <span
                    key={p}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      aiStatus[p]
                        ? 'bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)] border-[var(--wn-border-mint)]'
                        : 'bg-[var(--wn-surface-sunken)] text-[var(--wn-text-secondary)] border-[var(--wn-border)]'
                    }`}
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="wn-ai-tabs" role="tablist" aria-label={t.aiHub.tabListAria}>
          {visibleTabs.map(({ id, label, icon: Icon }, idx) => (
            <button
              key={id}
              ref={(el) => { tabRefs.current[idx] = el; }}
              id={`ai-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`ai-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => {
                setTab(id);
                setErrorBanner('');
              }}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`wn-ai-tab min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${tab === id ? 'is-active' : ''}`}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div
          id={`ai-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`ai-tab-${tab}`}
          className="wn-ai-panel"
        >
          {errorBanner && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--wn-text-danger)]"
            >
              <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
              <span>{errorBanner}</span>
            </div>
          )}

          {tab === 'quran' && (
            <form onSubmit={askQuran} className="space-y-4" noValidate>
              <label htmlFor="ai-quran-question" className="block font-semibold text-[var(--wn-text-primary)]">
                {t.aiHub.askLabel}
              </label>
              <textarea
                id="ai-quran-question"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  clearError('question');
                }}
                rows={3}
                aria-invalid={Boolean(fieldErrors.question)}
                aria-describedby={fieldErrors.question ? 'ai-quran-question-error' : undefined}
                className="w-full border rounded-lg p-3"
                placeholder={t.aiHub.askPlaceholder}
              />
              {fieldErrors.question && (
                <p id="ai-quran-question-error" className="text-xs text-[var(--wn-text-danger)] font-semibold">
                  {fieldErrors.question}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn-primary min-h-[44px] flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Bot size={18} aria-hidden="true" />}
                <span>{loading ? t.aiHub.generating : t.aiHub.askBtn}</span>
              </button>
              {answer && (
                <div className="wn-ai-result whitespace-pre-wrap">
                  {answer}
                </div>
              )}
            </form>
          )}

          {tab === 'recitation' && ['student', 'teacher', 'admin'].includes(role) && (
            <div className="space-y-4">
              <p className="text-[var(--wn-text-secondary)]">{t.aiHub.recitationInstructions}</p>
              <div>
                <label htmlFor="ai-recitation-surah" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                  {t.aiHub.surahLabel}
                </label>
                <input
                  id="ai-recitation-surah"
                  value={surah}
                  onChange={(e) => setSurah(e.target.value)}
                  className="w-full border rounded-lg p-3"
                  placeholder={t.aiHub.surahLabel}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => analyzeAudio(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={loading}
                  className="btn-primary min-h-[44px] flex items-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
                  <span>{loading ? t.aiHub.generating : t.aiHub.uploadFileBtn}</span>
                </button>

                {recorder.state === 'recording' ? (
                  <button
                    type="button"
                    onClick={recorder.stop}
                    className="min-h-[44px] flex items-center gap-2 px-4 py-2 bg-[var(--wn-danger)] text-[var(--wn-white)] rounded-lg font-semibold cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                  >
                    <Square size={16} aria-hidden="true" />
                    <span>{t.aiHub.stopRecordingBtn} ({recorder.duration}{t.aiHub.secondsUnit})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startLiveRecording}
                    disabled={loading}
                    className="btn-secondary min-h-[44px] flex items-center gap-2"
                  >
                    <Radio size={16} aria-hidden="true" />
                    <span>{t.aiHub.recordLiveBtn}</span>
                  </button>
                )}

                {recorder.state === 'recorded' && (
                  <button
                    type="button"
                    onClick={analyzeRecording}
                    disabled={loading}
                    className="btn-primary min-h-[44px] flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                    <span>{loading ? t.aiHub.generating : t.aiHub.analyzeRecordingBtn}</span>
                  </button>
                )}
              </div>

              {displayReport && (
                <div className="border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-[var(--wn-text-primary)]">{t.aiHub.overallScore}</span>
                    <span className="text-2xl text-[var(--wn-emerald)] font-bold">{displayReport.overallScore}%</span>
                  </div>
                  {displayReport.offline && (
                    <p className="text-xs bg-[var(--wn-gold-soft)] text-[var(--wn-badge-gold-text)] border border-[var(--wn-border)] rounded p-2">
                      {t.aiHub.offlineNotice}
                    </p>
                  )}
                  {REC_KEYS.map((key) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1 text-[var(--wn-text-primary)]">
                        <span>{t.aiHub.recitationLabels[key]}</span>
                        <span>{displayReport[key]?.score ?? '—'}%</span>
                      </div>
                      <div className="bg-[var(--wn-surface-sunken)] h-2 rounded-full overflow-hidden">
                        <div className="bg-[var(--wn-emerald)] h-2 rounded-full" style={{ width: `${displayReport[key]?.score || 0}%` }} />
                      </div>
                      {(displayReport[key]?.notes || []).map((n, i) => (
                        <p key={i} className="text-xs text-[var(--wn-text-secondary)] mt-1">• {n}</p>
                      ))}
                    </div>
                  ))}
                  {displayReport.transcript && (
                    <p className="text-xs bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] p-2 rounded">
                      <strong>{t.aiHub.transcriptLabel}:</strong> {displayReport.transcript}
                    </p>
                  )}
                  {(displayReport.recommendations || []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--wn-text-primary)] mb-1">{t.aiHub.recommendationsLabel}</p>
                      <ul className="text-sm text-[var(--wn-text-secondary)] list-disc ps-5">
                        {displayReport.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {reports.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-[var(--wn-text-primary)]">{t.aiHub.previousReports}</h3>
                  <div className="space-y-2">
                    {reports.slice(0, 8).map((r) => {
                      const rid = r.reportId || r._id;
                      const isLoadingThis = loadingReportId === rid;
                      return (
                        <button
                          key={rid}
                          type="button"
                          disabled={Boolean(loadingReportId)}
                          onClick={() => loadReport(rid)}
                          className="w-full min-h-[44px] text-sm border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-3 flex items-center justify-between gap-2 hover:bg-[var(--wn-emerald-soft)] text-start cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                        >
                          <span className="truncate">{r.surah || r.filename || r.reportId}</span>
                          <span className="inline-flex items-center gap-1.5 text-[var(--wn-text-accent)] font-semibold shrink-0">
                            {isLoadingThis && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                            {r.overallScore}%
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'student' && ['student', 'admin'].includes(role) && (
            <form onSubmit={getStudentPlan} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ai-student-goal" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                  {t.aiHub.goalLabel}
                </label>
                <input
                  id="ai-student-goal"
                  value={goal}
                  onChange={(e) => {
                    setGoal(e.target.value);
                    clearError('goal');
                  }}
                  aria-invalid={Boolean(fieldErrors.goal)}
                  aria-describedby={fieldErrors.goal ? 'ai-student-goal-error' : undefined}
                  className="w-full border rounded-lg p-3"
                  placeholder={t.aiHub.goalPlaceholder}
                />
                {fieldErrors.goal && (
                  <p id="ai-student-goal-error" className="text-xs text-[var(--wn-text-danger)] font-semibold mt-1">
                    {fieldErrors.goal}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="ai-student-level" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                  {t.aiHub.levelLabel}
                </label>
                <select
                  id="ai-student-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full border rounded-lg p-3"
                >
                  <option value="beginner">{t.aiHub.levels.beginner}</option>
                  <option value="intermediate">{t.aiHub.levels.intermediate}</option>
                  <option value="advanced">{t.aiHub.levels.advanced}</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="btn-primary min-h-[44px] flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <GraduationCap size={18} aria-hidden="true" />}
                <span>{loading ? t.aiHub.generating : t.aiHub.createPlanBtn}</span>
              </button>
              {studentPlan && (
                <div className="space-y-2">
                  {studentPlan.dailyPlan?.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-3 border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg p-3"
                    >
                      <span>{item.task}</span>
                      <span className="text-[var(--wn-text-secondary)] shrink-0">
                        {item.duration} {t.aiHub.minutesUnit}
                      </span>
                    </div>
                  ))}
                  {studentPlan.aiNotes && (
                    <p className="text-sm text-[var(--wn-text-secondary)] whitespace-pre-wrap">{studentPlan.aiNotes}</p>
                  )}
                </div>
              )}
            </form>
          )}

          {tab === 'teacher' && ['teacher', 'admin'].includes(role) && (
            <form onSubmit={getTeacherHelp} className="space-y-4" noValidate>
              <div>
                <label htmlFor="ai-teacher-prompt" className="block text-sm font-semibold text-[var(--wn-text-primary)] mb-1.5">
                  {t.aiHub.promptLabel}
                </label>
                <textarea
                  id="ai-teacher-prompt"
                  value={teacherPrompt}
                  onChange={(e) => {
                    setTeacherPrompt(e.target.value);
                    clearError('teacherPrompt');
                  }}
                  rows={3}
                  aria-invalid={Boolean(fieldErrors.teacherPrompt)}
                  aria-describedby={fieldErrors.teacherPrompt ? 'ai-teacher-prompt-error' : undefined}
                  className="w-full border rounded-lg p-3"
                  placeholder={t.aiHub.teacherPlaceholder}
                />
                {fieldErrors.teacherPrompt && (
                  <p id="ai-teacher-prompt-error" className="text-xs text-[var(--wn-text-danger)] font-semibold mt-1">
                    {fieldErrors.teacherPrompt}
                  </p>
                )}
              </div>
              <button type="submit" disabled={loading} className="btn-primary min-h-[44px] flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Bot size={18} aria-hidden="true" />}
                <span>{loading ? t.aiHub.generating : t.aiHub.teacherHelpBtn}</span>
              </button>
              {teacherResult && (
                <div className="space-y-2">
                  <ul className="list-disc ps-5 text-[var(--wn-text-primary)]">
                    {(teacherResult.suggestions || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  {teacherResult.lessonPlan && (
                    <div className="bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] rounded-lg p-3 text-sm whitespace-pre-wrap">
                      {teacherResult.lessonPlan}
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}