import { useState } from 'react';
import { Star, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import api from '../../lib/api';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';

const PRAISE_CHIPS_AR = [
  'إتقان التجويد والمخارج',
  'صبر وتشجيع رائع',
  'شرح واضح ومبسط',
  'التزام بالموعد',
];

const PRAISE_CHIPS_EN = [
  'Masterful Tajweed',
  'Patient & encouraging',
  'Clear explanation',
  'Punctual & organized',
];

const RATING_LABELS_AR = {
  1: 'يحتاج تحسيناً',
  2: 'مقبول',
  3: 'جيد',
  4: 'جيد جداً',
  5: 'ممتاز — بارك الله فيه',
};

const RATING_LABELS_EN = {
  1: 'Needs improvement',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

export default function PostSessionRatingModal({
  sessionContext,
  onComplete,
  onSkip,
}) {
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const isAr = locale === 'ar';
  const roomT = t?.live?.room || {};

  const [rating, setRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [wouldContinue, setWouldContinue] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const sessionId = sessionContext?.sessionId || '';
  const sessionType = sessionContext?.sessionType || 'regular';
  const teacherName = sessionContext?.teacherName || (isAr ? 'معلم الحلقة' : 'Your Tutor');
  const chips = isAr ? PRAISE_CHIPS_AR : PRAISE_CHIPS_EN;
  const ratingLabels = isAr ? RATING_LABELS_AR : RATING_LABELS_EN;

  const sessionBadge =
    sessionType === 'trial'
      ? isAr ? 'حصة تجريبية' : 'Trial Session'
      : sessionType === 'group_circle'
        ? isAr ? 'حلقة جماعية' : 'Group Circle'
        : isAr ? 'حصة فردية' : '1-on-1 Session';

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!sessionId) {
      onComplete?.();
      return;
    }

    setSubmitting(true);
    const mergedComment = [
      selectedTags.length ? selectedTags.join(' · ') : '',
      comment.trim(),
    ]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 1000);

    try {
      let savedAny = false;
      try {
        await api.post(
          '/api/reviews',
          {
            sessionId,
            teacherId: sessionContext?.teacherId || undefined,
            rating,
            comment: mergedComment,
            wouldContinue,
          },
          { auth: true }
        );
        savedAny = true;
      } catch (revErr) {
        const msg = String(revErr?.message || '');
        if (!msg.toLowerCase().includes('already reviewed')) {
          throw revErr;
        }
        savedAny = true;
      }

      await api
        .put(
          `/api/sessions/${encodeURIComponent(sessionId)}/feedback`,
          {
            rating,
            comment: mergedComment,
            wouldContinue,
          },
          { auth: true }
        )
        .then(() => {
          savedAny = true;
        })
        .catch(() => {});

      if (savedAny) {
        toast.success(
          roomT.ratingSuccessToast ||
            (isAr ? 'جزاك الله خيراً! تم حفظ تقييمك للمعلم بنجاح' : 'Thank you! Your tutor rating has been saved.')
        );
      }
      onComplete?.();
    } catch (err) {
      toast.error(err?.message || (isAr ? 'تعذر حفظ التقييم حالياً' : 'Could not submit rating right now'));
      setSubmitting(false);
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-session-rating-title"
    >
      <div className="w-full max-w-lg rounded-3xl border-2 border-[var(--wn-gold)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] shadow-2xl overflow-hidden my-auto">
        <div className="bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] px-6 py-5 text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>{sessionBadge}</span>
          </div>
          <p className="text-xs opacity-90">
            {roomT.sessionEndedBanner || (isAr ? 'تقبّل الله منكم — انتهت الحصة بحمد الله' : 'The session has ended')}
          </p>
          <h2 id="post-session-rating-title" className="text-xl font-extrabold">
            {roomT.rateTutorTitle || (isAr ? 'قيّم المعلم والحصة' : 'Rate Your Tutor & Session')}
          </h2>
          <p className="text-sm font-semibold text-[var(--wn-gold-light)]">{teacherName}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center space-y-2">
            <p className="text-xs text-[var(--wn-text-secondary)]">
              {roomT.rateTutorSubtitle || (isAr ? 'رأيك يساعدنا على الارتقاء بجودة الحلقات القرآنية' : 'Your feedback helps us improve')}
            </p>
            <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label={roomT.rateTutorTitle || 'Rating'}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    disabled={submitting}
                    onClick={() => setRating(star)}
                    aria-checked={rating === star}
                    role="radio"
                    aria-label={`${star} / 5`}
                    className={`min-h-[48px] min-w-[48px] rounded-2xl border transition inline-flex items-center justify-center cursor-pointer ${
                      active
                        ? 'border-[var(--wn-gold)] bg-[var(--wn-gold-soft)] text-[var(--wn-gold)] scale-105'
                        : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-tertiary)] hover:border-[var(--wn-gold)]'
                    }`}
                  >
                    <Star size={26} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-bold text-[var(--wn-link)]">
              {ratingLabels[rating]} ({rating} / 5)
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {chips.map((chip) => {
              const chosen = selectedTags.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  disabled={submitting}
                  onClick={() => toggleTag(chip)}
                  aria-pressed={chosen}
                  className={`min-h-[38px] px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer inline-flex items-center gap-1 ${
                    chosen
                      ? 'border-[var(--wn-emerald)] bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]'
                      : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-secondary)]'
                  }`}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  <span>{chip}</span>
                </button>
              );
            })}
          </div>

          <div>
            <textarea
              rows={3}
              disabled={submitting}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                roomT.ratingCommentPlaceholder ||
                (isAr ? 'اكتب انطباعك عن شرح المعلم وأسلوبه (اختياري)…' : 'Share your thoughts about the session (optional)…')
              }
              className="input-field w-full text-sm"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm font-semibold text-[var(--wn-text-primary)] min-h-[44px] cursor-pointer rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-3.5 py-2">
            <input
              type="checkbox"
              disabled={submitting}
              checked={wouldContinue}
              onChange={(e) => setWouldContinue(e.target.checked)}
              className="h-4 w-4 accent-[var(--wn-emerald)]"
            />
            <span>
              {roomT.wouldContinueLabel ||
                (isAr ? 'أرغب في الاستمرار بالدراسة مع هذا المعلم' : 'I would like to continue learning with this tutor')}
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 font-bold disabled:opacity-60 cursor-pointer"
            >
              {submitting && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
              <span>
                {roomT.submitRatingCta || (isAr ? 'إرسال التقييم والعودة للوحتي' : 'Submit Rating & Return')}
              </span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSkip?.()}
              className="min-h-[48px] px-4 rounded-xl border border-[var(--wn-border)] text-xs font-bold text-[var(--wn-text-secondary)] hover:bg-[var(--wn-surface-soft)] cursor-pointer"
            >
              {roomT.skipRatingCta || (isAr ? 'العودة للوحتي لاحقاً' : 'Skip for now')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
