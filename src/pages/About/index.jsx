import { Link } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { motion } from 'framer-motion';
import {
  Target,
  Globe,
  Heart,
  Sparkles,
  BookOpenCheck,
  Sprout,
  ShieldCheck,
  Award,
  Users,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import '../../styles/public-experience.css';

export default function About() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const lp = (path) => localizedPath(path, locale);
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const values = [
    {
      icon: Target,
      title: isAr ? 'رسالتنا' : 'Our mission',
      text: isAr
        ? 'تقديم تعليم قرآني واضح ومتدرج يجمع بين الإتقان وحسن التوجيه.'
        : 'Provide clear, structured Quran learning that combines mastery with thoughtful guidance.',
    },
    {
      icon: Globe,
      title: isAr ? 'تعلم بلا حدود مكانية' : 'Learning beyond location',
      text: isAr
        ? 'تجربة رقمية تساعد الطالب على التعلم من مكانه وبالوقت المتاح له.'
        : 'A digital experience that helps learners study from where they are and around their available time.',
    },
    {
      icon: Heart,
      title: isAr ? 'الرفق والاحترام' : 'Care and respect',
      text: isAr
        ? 'نريد أن تكون رحلة القرآن هادئة ومحترمة ومناسبة لعمر الطالب واحتياجه.'
        : 'We want Quran learning to feel calm, respectful, and appropriate to each learner’s age and needs.',
    },
    {
      icon: Sprout,
      title: isAr ? 'النماء قبل الأرقام' : 'Growth before vanity metrics',
      text: isAr
        ? 'نركز على تقدم حقيقي يمكن فهمه ومتابعته، لا على أرقام تسويقية غير موثقة.'
        : 'We focus on understandable, trackable progress rather than unverified marketing numbers.',
    },
  ];

  const methodologySteps = [
    {
      num: '٠١',
      icon: Sparkles,
      title: isAr ? 'تقييم مجاني وتحديد المستوى' : '1. Free evaluation & level check',
      desc: isAr
        ? 'نبدأ بحصة تجريبية تعريفية مجانية ١٠٠٪ لفهم مستوى القراءة والحفظ وتحديد المسار الأنسب بدقة.'
        : 'We start with a 100% free introductory session to assess reading and memorization level accurately.',
    },
    {
      num: '٠٢',
      icon: ShieldCheck,
      title: isAr ? 'تعيين المعلم أو المعلمة الأنسب' : '2. Dedicated tutor matching',
      desc: isAr
        ? 'نخصص معلمات مجازات بالكامل لقسم السيدات والبنات، ومعلمين مجازين لقسم الرجال والأولاد.'
        : 'Dedicated certified female instructors for sisters and girls, and certified male tutors for men and boys.',
    },
    {
      num: '٠٣',
      icon: BookOpenCheck,
      title: isAr ? 'حلقات تفاعلية وتثبيت تراكمي' : '3. Live interactive sessions',
      desc: isAr
        ? 'تسميع مباشر وتصحيح لحظي لمخارج الحروف وأحكام التجويد مع خطة مراجعة تمنع التفلت.'
        : 'Live recitation and immediate pronunciation correction paired with a structured cumulative review plan.',
    },
    {
      num: '٠٤',
      icon: Award,
      title: isAr ? 'تقارير دورية وشهادات موثقة' : '4. Progress reports & QR certificates',
      desc: isAr
        ? 'متابعة مستمرة لولي الأمر والطالب بعد كل حصة، مع شهادات إتمام رسمية قابلة للتحقق عبر رمز QR.'
        : 'Continuous guardian and student tracking after every lesson, culminating in QR-verifiable certificates.',
    },
  ];

  return (
    <>
      <SEOHead
        page={{
          title: isAr ? 'عن أكاديمية وَحْيٌ وَنَمَاء' : 'About Wahy Wa Namaa Academy',
          description: isAr
            ? 'تعرف على رؤية ورسالة ومنهجية أكاديمية وحي ونماء لتعليم القرآن.'
            : 'Learn about the vision, mission, and methodology behind Wahy Wa Namaa Academy.',
          url: '/about',
          type: 'website',
        }}
      />
      <GlobalHeader />

      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} /> {isAr ? 'من نحن' : 'ABOUT US'}
              </span>
              <h1>{isAr ? 'وحيٌ نتعلّمه… ونماءٌ نعيشه' : 'Revelation we learn. Growth we live.'}</h1>
              <p>
                {isAr
                  ? 'وحي ونماء أكاديمية قرآنية رقمية نبني فيها تجربة تعلم تجمع أصالة التلقي مع أدوات حديثة تخدم الطالب والمعلم والأسرة.'
                  : 'Wahy Wa Namaa is a digital Quran academy combining authentic learning with modern tools that support learners, teachers, and families.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={lp('/start')} className="wn-btn wn-btn--accent">
                  {isAr ? 'ابدأ رحلتك الآن' : 'Start your journey'}
                  <ArrowIcon size={16} />
                </Link>
                <Link to={lp('/teachers')} className="wn-btn wn-btn--secondary">
                  <Users size={16} />
                  {isAr ? 'تصفح المعلمين' : 'Browse teachers'}
                </Link>
              </div>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core">
                <BookOpenCheck size={46} strokeWidth={1.25} />
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid">
            {values.map(({ icon: Icon, title, text }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="wn-public-feature-card"
              >
                <span>
                  <Icon size={21} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </div>

          {/* 4-Step Educational Methodology Section */}
          <div className="mt-10">
            <div className="mb-5 text-center">
              <span className="wn-public-eyebrow">
                <Sparkles size={14} /> {isAr ? 'كيف نتعلم معًا؟' : 'HOW WE LEARN'}
              </span>
              <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-[var(--wn-emerald-deep)]">
                {isAr ? 'منهجيتنا التعليمية في ٤ خطوات واضحة' : 'Our 4-Step Educational Methodology'}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {methodologySteps.map(({ num, icon: Icon, title, desc }) => (
                <article
                  key={num}
                  className="rounded-2xl border border-[rgba(212,175,107,0.22)] bg-white/90 p-5 shadow-sm transition hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-emerald-dark)]">
                      <Icon size={20} />
                    </span>
                    <span className="font-display text-xl font-black text-[var(--wn-gold-dark)] opacity-60">
                      {num}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--wn-emerald-deep)]">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-[var(--wn-text-secondary)]">{desc}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 wn-public-track-banner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{isAr ? 'فلسفة الاسم' : 'THE NAME'}</span>
                <h2>{isAr ? 'وَحْيٌ وَنَمَاء' : 'Wahy Wa Namaa'}</h2>
                <p>
                  {isAr
                    ? 'الوحي هو الأصل الذي نتلقى منه، والنماء هو الأثر الذي نرجو أن يظهر في العلم والسلوك والاستمرار.'
                    : 'Wahy is the source we learn from; Namaa is the growth we hope to see in knowledge, character, and consistency.'}
                </p>
              </div>
              <Link to={lp('/free-trial')} className="wn-btn wn-btn--accent shrink-0">
                {isAr ? 'احجز حصتك التجريبية المجانية' : 'Book your free trial'}
                <ArrowIcon size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
