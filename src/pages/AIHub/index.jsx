import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mic, BookOpen, GraduationCap, Loader2, Sparkles, Upload, Square, Radio } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import '../../styles/public-experience.css';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { loginPathForLocale } from '../../lib/navigation';

const TABS = [
  { id: 'quran', label: 'مساعد القرآن', icon: BookOpen },
  { id: 'recitation', label: 'تحليل التلاوة', icon: Mic },
  { id: 'student', label: 'مساعد الطالب', icon: GraduationCap },
  { id: 'teacher', label: 'مساعد المعلم', icon: Bot },
];

const REC_LABELS = {
  tajweed: 'التجويد',
  makhraj: 'مخارج الحروف',
  waqf: 'الوقف والابتداء',
  mad: 'المدود',
  ghunnah: 'الغنة',
  noonSakinah: 'أحكام النون',
};

export default function AIHub() {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState('quran');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [goal, setGoal] = useState('حفظ جزء عم');
  const [level, setLevel] = useState('beginner');
  const [teacherPrompt, setTeacherPrompt] = useState('');
  const [teacherResult, setTeacherResult] = useState(null);
  const [studentPlan, setStudentPlan] = useState(null);
  const [recitationReport, setRecitationReport] = useState(null);
  const [surah, setSurah] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [reports, setReports] = useState([]);
  const fileRef = useRef(null);
  const recorder = useAudioRecorder();

  useEffect(() => {
    if (!isAuthenticated) {
      const target = localizedPath('/ai', locale);
      navigate(
        `${loginPathForLocale(locale)}?redirect=${encodeURIComponent(target)}`,
        { replace: true }
      );
      return;
    }
    api.get('/api/ai/status', { auth: true }).then(setAiStatus).catch(() => {});
    api.get('/api/ai/recitation-reports', { auth: true })
      .then((d) => setReports(d.reports || []))
      .catch(() => {});
  }, [isAuthenticated, navigate, locale]);

  const askQuran = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/api/ai/quran-assistant', { question, locale: 'ar' }, { auth: true });
      setAnswer(res.answer);
    } catch (err) {
      setAnswer(`خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAudio = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('audio', file, file.name || 'recitation.webm');
      fd.append('locale', 'ar');
      if (surah) fd.append('surah', surah);
      const res = await api.post('/api/ai/recitation-analyze', fd, { auth: true });
      setRecitationReport(res);
      setReports((prev) => [res, ...prev]);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
      recorder.reset();
    }
  };

  const analyzeRecording = async () => {
    if (!recorder.audioBlob) return;
    await analyzeAudio(new File([recorder.audioBlob], 'recitation.webm', { type: 'audio/webm' }));
  };

  const getStudentPlan = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/ai/student-assistant', { goal, level, locale: 'ar' }, { auth: true });
      setStudentPlan(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (id) => {
    try {
      const r = await api.get(`/api/ai/recitation-reports/${id}`, { auth: true });
      setSelectedReport(r);
    } catch { /* ignore */ }
  };

  const displayReport = selectedReport || recitationReport;

  const getTeacherHelp = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/ai/teacher-assistant', { prompt: teacherPrompt, locale: 'ar' }, { auth: true });
      setTeacherResult(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wn-ai-shell">
      <SEOHead page={{ url: '/ai', noindex: true, canonical: false }} />
      <GlobalHeader />
      <main className="wn-ai-wrap">
        <div className="wn-ai-heading">
          <div className="wn-ai-heading__icon">
            <Sparkles className="text-emerald-600" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مركز الذكاء الاصطناعي</h1>
            <p className="text-gray-600 text-sm">
              {aiStatus?.mode === 'cloud'
                ? `✓ متصل — ${aiStatus.activeProvider}`
                : 'المساعد متاح داخل المنصة'}
            </p>
            {aiStatus?.chain && (
              <div className="flex flex-wrap gap-1 mt-1">
                {aiStatus.chain.filter((p) => p !== 'local').map((p) => (
                  <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${aiStatus[p] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="wn-ai-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={'wn-ai-tab ' + (tab === id ? 'is-active' : '')}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="wn-ai-panel">
          {tab === 'quran' && (
            <form onSubmit={askQuran} className="space-y-4">
              <label className="block font-semibold">اسأل عن القرآن أو التجويد</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="w-full border rounded-lg p-3"
                placeholder="ما حكم الغنة في التجويد؟"
              />
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Bot size={18} />}
                اسأل
              </button>
              {answer && (
                <div className="wn-ai-result whitespace-pre-wrap">
                  {answer}
                </div>
              )}
            </form>
          )}

          {tab === 'recitation' && (
            <div className="space-y-4">
              <p className="text-gray-600">ارفع ملفاً أو سجّل مباشرة — يمكنك رفع ملف أو تسجيل التلاوة ثم مراجعة التقرير داخل حسابك</p>
              <input value={surah} onChange={(e) => setSurah(e.target.value)} className="w-full border rounded-lg p-3"
                placeholder="السورة (اختياري) — مثلاً: الفاتحة" />

              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="audio/*" className="hidden"
                  onChange={(e) => analyzeAudio(e.target.files?.[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}
                  className="btn-primary flex items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                  رفع ملف
                </button>

                {recorder.state === 'recording' ? (
                  <button type="button" onClick={recorder.stop} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg">
                    <Square size={16} /> إيقاف ({recorder.duration}ث)
                  </button>
                ) : (
                  <button type="button" onClick={() => recorder.start().catch((e) => alert(e.message))} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50">
                    <Radio size={16} /> تسجيل مباشر
                  </button>
                )}

                {recorder.state === 'recorded' && (
                  <button type="button" onClick={analyzeRecording} disabled={loading} className="btn-primary flex items-center gap-2">
                    <Mic size={18} /> تحليل التسجيل
                  </button>
                )}
              </div>

              {displayReport && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">النتيجة الإجمالية</span>
                    <span className="text-2xl text-emerald-600 font-bold">{displayReport.overallScore}%</span>
                  </div>
                  {displayReport.offline && (
                    <p className="text-xs bg-amber-50 text-amber-800 rounded p-2">تم إنشاء التقرير باستخدام الوضع المتاح حاليًا</p>
                  )}
                  {Object.keys(REC_LABELS).map((key) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{REC_LABELS[key]}</span>
                        <span>{displayReport[key]?.score ?? '—'}%</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded-full">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${displayReport[key]?.score || 0}%` }} />
                      </div>
                      {(displayReport[key]?.notes || []).map((n, i) => (
                        <p key={i} className="text-xs text-gray-500 mt-1">• {n}</p>
                      ))}
                    </div>
                  ))}
                  {displayReport.transcript && (
                    <p className="text-xs bg-gray-50 p-2 rounded"><strong>النص:</strong> {displayReport.transcript}</p>
                  )}
                  <ul className="text-sm text-gray-600 list-disc pr-5">
                    {(displayReport.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {reports.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">تقارير سابقة</h3>
                  <div className="space-y-2">
                    {reports.slice(0, 8).map((r) => (
                      <button key={r.reportId || r._id} type="button" onClick={() => loadReport(r.reportId || r._id)}
                        className="w-full text-sm border rounded p-2 flex justify-between hover:bg-emerald-50 text-right">
                        <span>{r.surah || r.filename || r.reportId}</span>
                        <span className="text-emerald-600">{r.overallScore}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'student' && (
            <div className="space-y-4">
              <input value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full border rounded-lg p-3" placeholder="هدفك" />
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border rounded-lg p-3">
                <option value="beginner">مبتدئ</option>
                <option value="intermediate">متوسط</option>
                <option value="advanced">متقدم</option>
              </select>
              <button onClick={getStudentPlan} disabled={loading} className="btn-primary">إنشاء خطة يومية</button>
              {studentPlan && (
                <div className="space-y-2">
                  {studentPlan.dailyPlan?.map((t, i) => (
                    <div key={i} className="flex justify-between border rounded p-3">
                      <span>{t.task}</span>
                      <span className="text-gray-500">{t.duration} د</span>
                    </div>
                  ))}
                  {studentPlan.aiNotes && <p className="text-sm text-gray-600 whitespace-pre-wrap">{studentPlan.aiNotes}</p>}
                </div>
              )}
            </div>
          )}

          {tab === 'teacher' && (
            <div className="space-y-4">
              <textarea
                value={teacherPrompt}
                onChange={(e) => setTeacherPrompt(e.target.value)}
                rows={3}
                className="w-full border rounded-lg p-3"
                placeholder="خطط حصة تجويد للمستوى المتوسط..."
              />
              <button onClick={getTeacherHelp} disabled={loading} className="btn-primary">اقتراحات المعلم</button>
              {teacherResult && (
                <div className="space-y-2">
                  <ul className="list-disc pr-5 text-gray-700">
                    {(teacherResult.suggestions || []).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  {teacherResult.lessonPlan && (
                    <div className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap">{teacherResult.lessonPlan}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <GlobalFooter />
    </div>
  );
}