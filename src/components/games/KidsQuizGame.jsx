import { useEffect, useRef, useState } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function KidsQuizGame() {
  const { t, dir } = useI18n();
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const quizCopy = t.lms?.kids?.quizGame || {};
  const questions = [
    {
      prompt: quizCopy.q1 || 'How many Arabic letters are there?',
      options: ['28', '30', '26'],
      correct: 0,
    },
    {
      prompt: quizCopy.q2 || 'What is the rule for Noon Sakinah and Tanween?',
      options: [
        quizCopy.q2Opt1 || 'Izhar, Idgham, Iqlab, or Ikhfa',
        quizCopy.q2Opt2 || 'Idgham only',
        quizCopy.q2Opt3 || 'Ikhfa only',
      ],
      correct: 0,
    },
    {
      prompt: quizCopy.q3 || 'Where is the letter Qaf in the word Quran?',
      options: [
        quizCopy.q3Opt1 || 'Start',
        quizCopy.q3Opt2 || 'Middle',
        quizCopy.q3Opt3 || 'End',
      ],
      correct: 0,
    },
  ];

  const q = questions[idx];

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) setScore((s) => s + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (idx + 1 >= questions.length) setDone(true);
      else {
        setIdx((n) => n + 1);
        setPicked(null);
      }
    }, 700);
  };

  const reset = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIdx(0);
    setScore(0);
    setPicked(null);
    setDone(false);
  };

  if (done) {
    return (
      <div
        dir={dir}
        className="rounded-2xl p-8 text-center border border-[var(--wn-border-strong)] bg-[var(--wn-gold-soft)] text-[var(--wn-text-primary)] shadow-sm"
      >
        <Trophy className="mx-auto text-[var(--wn-text-gold)] mb-4" size={48} aria-hidden="true" />
        <h3 className="text-2xl font-bold mb-2 text-[var(--wn-heading)]">
          {quizCopy.wellDone || 'Well done!'}
        </h3>
        <p className="text-lg text-[var(--wn-text-secondary)] mb-6">
          {t.lms?.kids?.score || 'Score'}: {score} / {questions.length}
        </p>
        <button
          type="button"
          onClick={reset}
          className="wn-btn wn-btn--primary min-h-[44px]"
        >
          <RotateCcw size={18} aria-hidden="true" />
          <span>{t.lms?.kids?.playAgain || 'Play again'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="rounded-2xl p-6 shadow-md border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)]"
    >
      <p className="text-xs text-[var(--wn-text-gold)] font-semibold mb-2">
        {quizCopy.questionOf || 'Question'} {idx + 1} {quizCopy.ofLabel || 'of'} {questions.length}
      </p>
      <h3 className="text-lg font-bold mb-5 text-[var(--wn-heading)]">{q.prompt}</h3>
      <div className="grid gap-3">
        {q.options.map((label, i) => (
          <button
            key={label}
            type="button"
            disabled={picked !== null}
            onClick={() => pick(i)}
            className={`text-start min-h-[44px] px-4 py-3 rounded-xl border-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:cursor-default ${
              picked === null
                ? 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-gold)] hover:bg-[var(--wn-gold-soft)]'
                : i === q.correct
                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]'
                  : picked === i
                    ? 'border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]'
                    : 'border-[var(--wn-border)] opacity-60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
