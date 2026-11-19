import { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';

const LETTERS = [
  { ar: 'أ', hintKey: 'alif', fallback: 'First letter of the alphabet' },
  { ar: 'ب', hintKey: 'ba', fallback: 'In the word for house (Bayt)' },
  { ar: 'ت', hintKey: 'ta', fallback: 'In the word for student (Tilmidh)' },
  { ar: 'ث', hintKey: 'tha', fallback: 'In the word for fruit (Thamar)' },
  { ar: 'ج', hintKey: 'jim', fallback: 'In the word for camel (Jamal)' },
];

function pickOptions(correct) {
  const others = LETTERS.map((l) => l.ar).filter((a) => a !== correct);
  const wrong = others.sort(() => Math.random() - 0.5).slice(0, 2);
  return [correct, ...wrong].sort(() => Math.random() - 0.5);
}

export default function KidsLettersGame() {
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

  const current = LETTERS[idx];
  const options = useMemo(() => pickOptions(current.ar), [current.ar]);
  const lettersCopy = t.lms?.kids?.lettersGame || {};
  const hintsCopy = lettersCopy.hints || {};

  const pick = (letter) => {
    if (picked !== null) return;
    setPicked(letter);
    if (letter === current.ar) setScore((s) => s + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (idx + 1 >= LETTERS.length) setDone(true);
      else {
        setIdx((n) => n + 1);
        setPicked(null);
      }
    }, 600);
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
        className="rounded-2xl p-8 text-center border border-[var(--wn-border-mint)] bg-[var(--wn-surface-mint)] text-[var(--wn-text-primary)] shadow-sm"
      >
        <Trophy className="mx-auto text-[var(--wn-text-gold)] mb-4" size={48} aria-hidden="true" />
        <h3 className="text-2xl font-bold mb-2 text-[var(--wn-heading)]">
          {lettersCopy.greatJob || 'Great job!'}
        </h3>
        <p className="text-lg mb-6 text-[var(--wn-text-secondary)]">
          {lettersCopy.correctCount || 'Correct letters'}: {score}/{LETTERS.length}
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
      <p className="text-xs text-[var(--wn-link)] font-semibold mb-2">
        {lettersCopy.letterProgress || 'Letter'} {idx + 1}/{LETTERS.length}
      </p>
      <p className="text-[var(--wn-text-secondary)] text-sm mb-4">
        {hintsCopy[current.hintKey] || current.fallback}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {options.map((letter) => (
          <button
            key={letter}
            type="button"
            disabled={picked !== null}
            onClick={() => pick(letter)}
            className={`min-h-[44px] text-3xl font-bold py-5 rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:cursor-default ${
              picked === null
                ? 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] hover:border-[var(--wn-link)] hover:bg-[var(--wn-emerald-soft)]'
                : letter === current.ar
                  ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]'
                  : picked === letter
                    ? 'border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]'
                    : 'border-[var(--wn-border)] opacity-50'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}
