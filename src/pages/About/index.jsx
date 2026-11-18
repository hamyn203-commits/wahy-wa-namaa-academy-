import { Link } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
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
  const { locale, isRTL, dir, t } = useI18n();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const lp = (path) => localizedPath(path, locale);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const values = [
    {
      icon: Target,
      title: isRTL ? 'رسالتنا' : 'Our mission',
      text: isRTL
        ? 'تقديم تعليم قرآني واضح ومتدرج يجمع بين الإتقان وحسن التوجيه.'
        : 'Provide clear, structured Quran learning that combines mastery with thoughtful guidance.',
    },
    {
      icon: Globe,
      title: isRTL ? 'تعلم بلا حدود مكانية' : 'Learning beyond location',
      text: isRTL
        ? 'تجربة رقمية تساعد الطالب على التعلم من مكانه وبالوقت المتاح له.'
        : 'A digital experience that helps learners study from where they are and around their available time.',
    },
    {
      icon: Heart,
      title: isRTL ? 'الرفق والاحترام' : 'Care and respect',
      text: isRTL
        ? 'نريد أن تكون رحلة القرآن هادئة ومحترمة ومناسبة لعمر الطالب واحتياجه.'
        : 'We want Quran learning to feel calm, respectful, and appropriate to each learner’s age and needs.',
    },
    {
      icon: Sprout,
      title: isRTL ? 'النماء قبل الأرقام' : 'Growth before vanity metrics',
      text: isRTL
        ? 'نركز على تقدم حقيقي يمكن فهمه ومتابعته، لا على أرقام تسويقية غير موثقة.'
        : 'We focus on understandable, trackable progress rather than unverified marketing numbers.',
    },
  ];

  const methodologySteps = [
    {
      num: isRTL ? '٠١' : '01',
      icon: Sparkles,
      title: isRTL ? 'تقييم مجاني وتحديد المستوى' : '1. Free evaluation & level check',
      desc: isRTL
        ? 'نبدأ بحصة تجريبية تعريفية مجانية ١٠٠٪ لفهم مستوى القراءة والحفظ وتحديد المسار الأنسب بدقة.'
        : 'We start with a 100% free introductory session to assess reading and memorization level accurately.',
    },
    {
      num: isRTL ? '٠٢' : '02',
      icon: ShieldCheck,
      title: isRTL ? 'تعيين المعلم أو المعلمة الأنسب' : '2. Dedicated tutor matching',
      desc: isRTL
        ? 'نخصص معلمات مجازات بالكامل لقسم السيدات والبنات، ومعلمين مجازين لقسم الرجال والأولاد.'
        : 'Dedicated certified female instructors for sisters and girls, and certified male tutors for men and boys.',
    },
    {
      num: isRTL ? '٠٣' : '03',
      icon: BookOpenCheck,
      title: isRTL ? 'حلقات تفاعلية وتثبيت تراكمي' : '3. Live interactive sessions',
      desc: isRTL
        ? 'تسميع مباشر وتصحيح لحظي لمخارج الحروف وأحكام التجويد مع خطة مراجعة تمنع التفلت.'
        : 'Live recitation and immediate pronunciation correction paired with a structured cumulative review plan.',
    },
    {
      num: isRTL ? '٠٤' : '04',
      icon: Award,
      title: isRTL ? 'تقارير دورية وشهادات موثقة' : '4. Progress reports & QR certificates',
      desc: isRTL
        ? 'متابعة مستمرة لولي الأمر والطالب بعد كل حصة، مع شهادات إتمام رسمية قابلة للتحقق عبر رمز QR.'
        : 'Continuous guardian and student tracking after every lesson, culminating in QR-verifiable certificates.',
    },
  ];

  const pageTitle = isRTL ? 'عن أكاديمية وَحْيٌ وَنَمَاء' : 'About Wahy Wa Namaa Academy';
  const pageDescription = isRTL
    ? 'تعرف على رؤية ورسالة ومنهجية أكاديمية وحي ونماء لتعليم القرآن.'
    : 'Learn about the vision, mission, and methodology behind Wahy Wa Namaa Academy.';

  return (
    <>
      <SEOHead
        page={{
          title: pageTitle,
          description: pageDescription,
          url: '/about',
          type: 'website',
          schema: [
            createWebPageSchema({
              name: pageTitle,
              description: pageDescription,
              url: '/about',
              type: 'AboutPage',
            }),
            createBreadcrumbSchema([
              { name: t.common?.home || (isRTL ? 'الرئيسية' : 'Home'), url: '/' },
              { name: pageTitle, url: '/about' },
            ]),
          ],
        }}
      />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} aria-hidden="true" /> {t.common?.about || (isRTL ? 'من نحن' : 'ABOUT US')}
              </span>
              <h1>{isRTL ? 'وحيٌ نتعلّمه… ونماءٌ نعيشه' : 'Revelation we learn. Growth we live.'}</h1>
              <p>
                {isRTL
                  ? 'وحي ونماء أكاديمية قرآنية رقمية نبني فيها تجربة تعلم تجمع أصالة التلقي مع أدوات حديثة تخدم الطالب والمعلم والأسرة.'
                  : 'Wahy Wa Namaa is a digital Quran academy combining authentic learning with modern tools that support learners, teachers, and families.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={lp('/start')} className="wn-btn wn-btn--accent min-h-[44px]">
                  {isRTL ? 'ابدأ رحلتك الآن' : 'Start your journey'}
                  <ArrowIcon size={16} aria-hidden="true" />
                </Link>
                <Link to={lp('/teachers')} className="wn-btn wn-btn--secondary min-h-[44px]">
                  <Users size={16} aria-hidden="true" />
                  {t.hero?.cta2 || (isRTL ? 'تصفح المعلمين' : 'Browse teachers')}
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
                  <Icon size={21} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </div>

          <div className="mt-10">
            <div className="mb-5 text-center">
              <span className="wn-public-eyebrow">
                <Sparkles size={14} aria-hidden="true" /> {isRTL ? 'كيف نتعلم معًا؟' : 'HOW WE LEARN'}
              </span>
              <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-[var(--wn-heading)]">
                {isRTL ? 'منهجيتنا التعليمية في ٤ خطوات واضحة' : 'Our 4-Step Educational Methodology'}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {methodologySteps.map(({ num, icon: Icon, title, desc }) => (
                <article
                  key={num}
                  className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 shadow-sm transition hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="font-display text-xl font-black text-[var(--wn-text-gold)] opacity-80">
                      {num}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[var(--wn-heading)]">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-[var(--wn-text-secondary)]">{desc}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-8 wn-public-track-banner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{isRTL ? 'فلسفة الاسم' : 'THE NAME'}</span>
                <h2>{isRTL ? 'وَحْيٌ وَنَمَاء' : 'Wahy Wa Namaa'}</h2>
                <p>
                  {isRTL
                    ? 'الوحي هو الأصل الذي نتلقى منه، والنماء هو الأثر الذي نرجو أن يظهر في العلم والسلوك والاستمرار.'
                    : 'Wahy is the source we learn from; Namaa is the growth we hope to see in knowledge, character, and consistency.'}
                </p>
              </div>
              <Link to={lp('/free-trial')} className="wn-btn wn-btn--accent shrink-0 min-h-[44px]">
                {t.common?.freeTrial || (isRTL ? 'احجز حصتك التجريبية المجانية' : 'Book your free trial')}
                <ArrowIcon size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
