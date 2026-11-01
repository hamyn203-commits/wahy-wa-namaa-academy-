import { useI18n } from '../../../i18n';
import {
  Video,
  BookOpen,
  Mic,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';

export default function LearningExperienceSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';

  const features = [
    {
      icon: Video,
      title: isAr ? 'جلسات مباشرة مع المعلم' : 'Live teacher sessions',
      desc: isAr ? 'تعلّم مباشر يساعد على تصحيح القراءة والمتابعة خطوة بخطوة.' : 'Direct sessions make recitation correction and guided progress easier.',
    },
    {
      icon: BookOpen,
      title: isAr ? 'مسار واضح لكل طالب' : 'A clear learning path',
      desc: isAr ? 'الخطة تتدرج حسب المستوى والهدف بدل تجربة واحدة تناسب الجميع.' : 'Learning progresses around the student’s level and goal rather than a one-size-fits-all path.',
    },
    {
      icon: Mic,
      title: isAr ? 'تدريب ومراجعة بين الحصص' : 'Practice between lessons',
      desc: isAr ? 'أنشطة وواجبات تساعد على تثبيت ما تم تعلمه والاستعداد للقاء التالي.' : 'Practice activities help consolidate learning and prepare for the next session.',
    },
    {
      icon: BarChart3,
      title: isAr ? 'متابعة التقدم' : 'Progress follow-up',
      desc: isAr ? 'رؤية أوضح لما تم إنجازه وما يحتاج إلى مزيد من العمل.' : 'A clearer view of what has been achieved and what still needs attention.',
    },
  ];

  return (
    <section className="wn-home-section wn-home-section--mint" id="experience">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">{isAr ? 'تجربة التعلم' : 'LEARNING EXPERIENCE'}</span>
          <h2>{isAr ? 'روح التلقي القرآني، بأدوات رقمية بسيطة وواضحة' : 'The spirit of Quran learning, supported by simple digital tools'}</h2>
          <p>{isAr ? 'التقنية هنا تخدم المعلم والطالب، ولا تسرق التركيز من القرآن.' : 'Technology supports the teacher and learner without distracting from the Quran itself.'}</p>
        </div>

        <div className="wn-experience-layout">
          <div className="wn-experience-grid">
            {features.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="wn-experience-card">
                <span className="wn-icon-box"><Icon size={22} strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>

          <aside className="wn-learning-panel">
            <div className="wn-learning-panel__top">
              <span className="wn-learning-panel__live"><i /> {isAr ? 'جلسة تعليم مباشرة' : 'Live learning session'}</span>
              <CalendarClock size={18} />
            </div>

            <div className="wn-learning-panel__mushaf">
              <span>{isAr ? 'مقطع اليوم' : 'Today’s passage'}</span>
              <p className="font-quran">وَقُل رَّبِّ زِدْنِي عِلْمًا</p>
              <small>{isAr ? 'طه: ١١٤' : 'Taha 20:114'}</small>
            </div>

            <div className="wn-learning-panel__checklist">
              {[
                isAr ? 'تلاوة وتصحيح مباشر' : 'Live recitation and correction',
                isAr ? 'هدف واضح للحصة' : 'A clear lesson goal',
                isAr ? 'خطوة تالية قابلة للتطبيق' : 'An actionable next step',
              ].map((item) => (
                <span key={item}><CheckCircle2 size={15} /> {item}</span>
              ))}
            </div>

            <LocalizedLink to="/free-trial" locale={locale} className="wn-btn wn-btn--primary wn-btn--block">
              <Sparkles size={16} />
              <span>{isAr ? 'جرّب التجربة بحصة تعريفية' : 'Try the experience'}</span>
            </LocalizedLink>
          </aside>
        </div>
      </div>
    </section>
  );
}
