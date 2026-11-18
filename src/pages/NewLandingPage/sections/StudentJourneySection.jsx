import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  BookOpen,
  Repeat2,
  BadgeCheck,
  Sprout,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function StudentJourneySection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const [activeStep, setActiveStep] = useState('01');

  const stages = [
    {
      step: '01',
      icon: BookOpen,
      title: isAr ? 'نتعلّم ونحدد المستوى' : 'Assess & Begin',
      text: isAr
        ? 'نبدأ بحصة تقييم مجانية هادئة نتعرف فيها على مستوى القراءة والحفظ ونحدد نقطة الانطلاق الواقعية.'
        : 'Start with a calm, free assessment lesson to evaluate reading fluency and define the right starting point.',
      outcome: isAr ? 'المخرج: بطاقة تحديد مستوى وتوصية بالحلقة الأنسب' : 'Outcome: Level profile & matched circle recommendation',
    },
    {
      step: '02',
      icon: Repeat2,
      title: isAr ? 'نحفظ ونراجع بانتظام' : 'Memorize & Revise',
      text: isAr
        ? 'نبني إيقاعاً أسبوعياً ثابتاً يجمع بين التلقين الصحيح للورد الجديد وتثبيت المحفوظ السابق دون انقطاع.'
        : 'Build a steady weekly rhythm pairing accurate new recitation with structured revision cycles.',
      outcome: isAr ? 'المخرج: ورد أسبوعي منتظم وتقارير متابعة بعد كل حصة' : 'Outcome: Steady weekly Wird & post-session reports',
    },
    {
      step: '03',
      icon: BadgeCheck,
      title: isAr ? 'نتقن التلاوة والأحكام' : 'Master Tajweed',
      text: isAr
        ? 'نرتقي بجودة المخارج والصفات وأحكام التجويد تطبيقياً حتى تصبح القراءة السليمة سجية للطالب.'
        : 'Refine articulation, letter qualities, and applied Tajweed until fluent recitation feels natural.',
      outcome: isAr ? 'المخرج: تلاوة متقنة واجتياز تقييمات المراحل القرآنية' : 'Outcome: Fluent recitation & stage mastery evaluations',
    },
    {
      step: '04',
      icon: Sprout,
      title: isAr ? 'ننمو بالقرآن علماً وعملاً' : 'Grow & Certify',
      text: isAr
        ? 'تكتمل الرحلة بشهادات إتمام موثقة أو مواصلة السير نحو الختم والإجازة بالسند المتصل.'
        : 'Earn verifiable completion certificates and continue toward full Khatmah and connected Sanad Ijazah.',
      outcome: isAr ? 'المخرج: شهادة رقمية قابلة للتحقق وأثر مستمر في الحياة' : 'Outcome: Verifiable certificate & lifelong Quran habit',
    },
  ];

  const currentStage = stages.find((item) => item.step === activeStep) || stages[0];

  return (
    <section className="wn-home-section wn-home-section--ivory" id="journey">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{isAr ? 'رحلة الطالب' : 'THE STUDENT JOURNEY'}</span>
          <h2>{isAr ? 'من أول خطوة إلى عادة قرآنية راسخة ومستمرة' : 'From the first step to a lasting Quran habit'}</h2>
          <p>{isAr ? 'أربع مراحل مترابطة تجعل مسار التقدم ومخرجات كل خطوة واضحة للطالب والأسرة.' : 'Four connected stages make progress and outcomes transparent for learners and families.'}</p>
        </div>

        <div className="wn-journey-grid">
          {stages.map(({ step, icon: Icon, title, text, outcome }, index) => {
            const isSelected = step === currentStage.step;
            return (
              <article
                key={step}
                onClick={() => setActiveStep(step)}
                onMouseEnter={() => setActiveStep(step)}
                className={`wn-journey-card wn-journey-card--interactive ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="wn-journey-card__head">
                  <span className="wn-journey-card__icon"><Icon size={22} strokeWidth={1.55} /></span>
                  <span className="wn-journey-card__step">{step}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="wn-journey-card__outcome">
                  <CheckCircle2 size={14} />
                  <span>{outcome}</span>
                </div>
                {index < stages.length - 1 && <span className="wn-journey-card__line" aria-hidden="true" />}
              </article>
            );
          })}
        </div>

        <div className="wn-journey-cta">
          <div>
            <strong>{isAr ? 'ابدأ من مستواك الحالي، لا من نقطة مفترضة.' : 'Start from your actual level, not an assumed one.'}</strong>
            <span>{currentStage.outcome}</span>
          </div>
          <LocalizedLink
            to="/start"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/start')}
            className="wn-btn wn-btn--primary"
          >
            <Sparkles size={16} />
            {isAr ? 'ابدأ رحلتك التعليمية' : 'Start your learning journey'}
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
