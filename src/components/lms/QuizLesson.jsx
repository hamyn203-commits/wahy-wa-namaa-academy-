import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import Skeleton from '../shared/Skeleton';
import api from '../../lib/api';

const RTL_LANGS = ['ar', 'ur', 'ku'];

const qText = (q, locale) => (
  RTL_LANGS.includes(locale)
    ? (q?.question?.[locale] || q?.question?.ar || q?.question?.en || q?.text?.[locale] || q?.text?.ar || q?.text?.en || '')
    : (q?.question?.[locale] || q?.question?.en || q?.question?.ar || q?.text?.[locale] || q?.text?.en || q?.text?.ar || '')
);

const optText = (opt, locale) => (
  RTL_LANGS.includes(locale)
    ? (opt?.text?.[locale] || opt?.text?.ar || opt?.text?.en || '')
    : (opt?.text?.[locale] || opt?.text?.en || opt?.text?.ar || '')
);

const pickLocalized = (obj, locale) => (
  RTL_LANGS.includes(locale)
    ? (obj?.[locale] || obj?.ar || obj?.en || '')
    : (obj?.[locale] || obj?.en || obj?.ar || '')
);

export default function QuizLesson({ lesson, locale: propLocale, onComplete }) {
  const { locale: ctxLocale, t, dir } = useI18n();
  const locale = propLocale || ctxLocale;
  const toast = useToast();
  const quizId = lesson?.content?.quiz?._id || lesson?.content?.quiz;

  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadQuiz = useCallback(async () => {
    if (!quizId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get(`/api/quizzes/${quizId}`, { auth: true });
      setQuiz(data);
    } catch (err) {
      setQuiz(null);
      setLoadError(err?.message || t.lms?.quiz?.loadError || 'Unable to load quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [quizId, t.lms?.quiz?.loadError]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const startQuiz = async () => {
    if (!quizId || starting) return;
    setStarting(true);
    try {
      const att = await api.post(`/api/quizzes/${quizId}/start`, {}, { auth: true });
      const unlockedQuiz = await api.get(`/api/quizzes/${quizId}`, { auth: true }).catch(() => null);
      if (unlockedQuiz) setQuiz(unlockedQuiz);
      setAttempt(att);
      setAnswers({});
      setResult(null);
    } catch (err) {
      toast.error(err?.message || t.lms?.quiz?.startError || 'Could not start the quiz. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const setAnswer = (qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }));

  const submitQuiz = async () => {
    if (submitting || !attempt?._id) return;
    const totalQuestions = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
    if (Object.keys(answers).length < totalQuestions) {
      toast.error(t.lms?.quiz?.emptyError || 'Please answer all questions before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      // Keep answer updates sequential to avoid Mongoose VersionError on the attempt document.
      for (const [qId, answer] of Object.entries(answers)) {
        await api.put(`/api/quizzes/attempts/${attempt._id}/answer`, { questionId: qId, answer }, { auth: true });
      }
      const final = await api.post(`/api/quizzes/attempts/${attempt._id}/submit`, {}, { auth: true });
      setResult(final);
      if (final?.isPassed) onComplete?.();
    } catch (err) {
      toast.error(err?.message || t.lms?.quiz?.submitError || 'Could not submit your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q, i) => {
    const type = q.type || 'multiple-choice';
    const label = `${i + 1}. ${qText(q, locale)}`;
    const fieldId = `quiz-q-${q._id}`;

    if (type === 'short-answer' || type === 'fill-blank') {
      return (
        <div key={q._id} className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-6 text-[var(--wn-text-primary)]">
          <label htmlFor={fieldId} className="block font-bold mb-4 text-[var(--wn-heading)]">{label}</label>
          <input
            id={fieldId}
            type="text"
            className="w-full min-h-[44px] rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3.5 py-2.5 text-[var(--wn-text-primary)] placeholder:text-[var(--wn-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            value={answers[q._id] || ''}
            onChange={(e) => setAnswer(q._id, e.target.value)}
            placeholder={
              type === 'fill-blank'
                ? (t.lms?.quiz?.fillBlankPlaceholder || 'Fill in the blank...')
                : (t.lms?.quiz?.shortAnswerPlaceholder || 'Your answer...')
            }
          />
        </div>
      );
    }

    if (type === 'true-false') {
      const tfOptions = Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((opt) => {
            const text = optText(opt, locale);
            return { value: text, label: text };
          })
        : [
            { value: 'True', label: t.lms?.quiz?.trueOption || 'True' },
            { value: 'False', label: t.lms?.quiz?.falseOption || 'False' },
          ];

      return (
        <div key={q._id} className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-6 text-[var(--wn-text-primary)]">
          <p id={`${fieldId}-label`} className="font-bold mb-4 text-[var(--wn-heading)]">{label}</p>
          <div className="flex flex-wrap gap-3" role="group" aria-labelledby={`${fieldId}-label`}>
            {tfOptions.map((opt) => {
              const selected = answers[q._id] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswer(q._id, opt.value)}
                  aria-pressed={selected}
                  className={
                    'flex-1 min-w-[120px] min-h-[44px] px-4 py-2.5 rounded-xl border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ' +
                    (selected
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-border-mint)]')
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (type === 'essay') {
      return (
        <div key={q._id} className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-6 text-[var(--wn-text-primary)]">
          <label htmlFor={fieldId} className="block font-bold mb-4 text-[var(--wn-heading)]">{label}</label>
          <textarea
            id={fieldId}
            rows={4}
            className="w-full rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] p-3.5 text-[var(--wn-text-primary)] placeholder:text-[var(--wn-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            value={answers[q._id] || ''}
            onChange={(e) => setAnswer(q._id, e.target.value)}
            placeholder={t.lms?.quiz?.essayPlaceholder || 'Write your detailed answer here...'}
          />
        </div>
      );
    }

    return (
      <fieldset key={q._id} className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-6 text-[var(--wn-text-primary)]">
        <legend className="font-bold mb-4 text-[var(--wn-heading)]">{label}</legend>
        <div className="space-y-2.5">
          {(q.options || []).map((opt, j) => {
            const val = optText(opt, locale);
            const optId = `${fieldId}-opt-${j}`;
            const checked = answers[q._id] === val;
            return (
              <label
                key={j}
                htmlFor={optId}
                className={
                  'flex items-center gap-3 min-h-[44px] p-3.5 rounded-xl cursor-pointer border transition focus-within:ring-2 focus-within:ring-[var(--wn-focus)] ' +
                  (checked
                    ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]'
                    : 'border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] hover:border-[var(--wn-border-mint)]')
                }
              >
                <input
                  id={optId}
                  type="radio"
                  name={q._id}
                  className="accent-[var(--wn-emerald)] h-4 w-4 shrink-0"
                  checked={checked}
                  onChange={() => setAnswer(q._id, val)}
                />
                <span>{val}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4 py-4" role="status" aria-live="polite" dir={dir}>
        <span className="sr-only">{t.lms?.loading || t.common?.loading || 'Loading…'}</span>
        <Skeleton className="h-8 w-56 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
        <Skeleton className="h-12 w-40 mx-auto rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-8 text-center" role="alert" dir={dir}>
        <p className="text-[var(--wn-text-danger)] font-semibold mb-4">{loadError}</p>
        <button type="button" onClick={loadQuiz} className="wn-btn wn-btn--primary min-h-[44px]">
          <RefreshCw size={16} aria-hidden="true" />
          <span>{t.common?.retry || 'Try again'}</span>
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <p className="text-[var(--wn-text-secondary)] text-center py-6" dir={dir}>
        {t.lms?.quiz?.unavailable || 'Quiz is currently unavailable'}
      </p>
    );
  }

  if (result) {
    const scoreHidden = result.score === undefined || result.score === null;
    if (scoreHidden) {
      return (
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-8 text-center text-[var(--wn-text-primary)]" dir={dir}>
          <Clock size={44} className="mx-auto mb-3 text-[var(--wn-text-gold)]" aria-hidden="true" />
          <p className="text-lg font-bold text-[var(--wn-heading)]">
            {t.lms?.quiz?.pendingReview || 'Your answers have been submitted and are pending review.'}
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-8 text-center text-[var(--wn-text-primary)]" dir={dir}>
        <div className={`text-5xl font-bold mb-3 ${result.isPassed ? 'text-[var(--wn-success)]' : 'text-[var(--wn-text-danger)]'}`}>
          {result.score?.percentage ?? 0}%
        </div>
        <p className="text-xl font-bold mb-2 inline-flex items-center justify-center gap-2 text-[var(--wn-heading)]">
          {result.isPassed ? (
            <CheckCircle size={22} className="text-[var(--wn-success)]" aria-hidden="true" />
          ) : (
            <XCircle size={22} className="text-[var(--wn-text-danger)]" aria-hidden="true" />
          )}
          <span>{result.isPassed ? (t.lms?.quiz?.passed || 'Passed') : (t.lms?.quiz?.failed || 'Not passed yet — try again')}</span>
        </p>
        <p className="text-[var(--wn-text-secondary)] text-sm">
          {t.lms?.quiz?.requiredScore || 'Required score'}: {quiz.settings?.passingScore || 60}%
        </p>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-8 text-center text-[var(--wn-text-primary)]" dir={dir}>
        <h2 className="text-2xl font-bold mb-3 text-[var(--wn-heading)]">{pickLocalized(quiz.title, locale)}</h2>
        <p className="text-[var(--wn-text-secondary)] mb-6">
          {quiz.questionCount ?? quiz.questions?.length ?? 0} {t.lms?.quiz?.questionsLabel || 'questions'} — {quiz.settings?.maxAttempts || 3} {t.lms?.quiz?.attemptsLabel || 'attempts'}
        </p>
        <button
          type="button"
          onClick={startQuiz}
          disabled={starting}
          className="wn-btn wn-btn--primary min-h-[44px]"
        >
          {starting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          <span>{t.lms?.quiz?.start || 'Start Quiz'}</span>
        </button>
      </div>
    );
  }

  const allAnswered = Object.keys(answers).length >= (quiz.questions?.length || 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir={dir}>
      {(quiz.questions || []).map(renderQuestion)}
      <button
        type="button"
        onClick={submitQuiz}
        disabled={submitting || !allAnswered}
        className="wn-btn wn-btn--primary w-full min-h-[44px]"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
        <span>
          {submitting
            ? (t.lms?.quiz?.submitting || 'Submitting answers…')
            : (t.lms?.quiz?.submit || 'Submit Answers')}
        </span>
      </button>
    </div>
  );
}
