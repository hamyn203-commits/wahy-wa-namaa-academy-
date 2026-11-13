import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Award,
  Sparkles,
  CheckCircle,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Bookmark,
  Compass
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

export default function TracksPage() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const [activeTrack, setActiveTrack] = useState('memorization');
  const [activePlan, setActivePlan] = useState('full');
  const [activeMatn, setActiveMatn] = useState('tuhfa');

  // Track 1: التحفيظ والمراجعة المتقنة
  const memorizationPlans = [
    {
      id: 'amma',
      title: isAr ? 'خطة جزء عم والمفصل' : 'Juz Amma & Mufassal Plan',
      duration: isAr ? 'شهرين (8 أسابيع)' : '2 Months (8 Weeks)',
      target: isAr ? 'للمبتدئين والناشئة لتأسيس الحفظ الصحيح وتثبيت قصار السور' : 'For beginners and youth to build solid memorization of short surahs',
      dailyWorkload: isAr ? 'نصف صفحة إلى صفحة يومياً مع التلقين المباشر' : 'Half to 1 page daily with live dictation',
      reviewSystem: isAr ? 'مراجعة الماضي القريب (السور الـ 3 السابقة يومياً) والماضي البعيد نهاية الأسبوع' : 'Daily review of last 3 surahs, weekly review of all saved',
      highlight: isAr ? 'أنسب بداية لمن يرغب بالانطلاق في مدارج القرآن' : 'Ideal kickoff for systematic Quran learning'
    },
    {
      id: 'five-juz',
      title: isAr ? 'خطة الـ 5 أجزاء (المرحلة الفضية)' : '5 Juz Silver Plan',
      duration: isAr ? '6 إلى 8 أشهر' : '6 to 8 Months',
      target: isAr ? 'إتقان حفظ الأجزاء الخمسة الأخيرة (من الأحقاف إلى الناس) أو أول 5 أجزاء' : 'Mastery of 5 Juz (Ahqaf to Nas or first 5 Juz)',
      dailyWorkload: isAr ? 'صفحة يومياً تسميعاً وضبطاً بالأحكام' : '1 page daily with full Tajweed rules',
      reviewSystem: isAr ? 'مراجعة حزب يومياً (نصف جزء) وفق جدول الماضي والحاضر الراسخ' : '1 Hizb daily revision (half juz) via Past & Present rule',
      highlight: isAr ? 'بناء قاعدة قوية تنقلك لمرحلة الحفظ الكامل' : 'Solid stepping stone to complete memorization'
    },
    {
      id: 'full',
      title: isAr ? 'خطة القرآن كاملاً (حفظ الحذاق)' : 'Complete Quran Master Plan',
      duration: isAr ? 'سنتان إلى 3 سنوات' : '2 to 3 Years',
      target: isAr ? 'حفظ القرآن كاملاً عن ظهر قلب مع التثبيت الراسخ وضبط المتشابهات' : 'Full memorization of the Noble Quran with solid retention',
      dailyWorkload: isAr ? 'وجه إلى وجهين يومياً مع اختبار أسبوعي متدرج' : '1 to 2 pages daily with progressive weekly testing',
      reviewSystem: isAr ? 'المراجعة القريبة (آخر 10 أوجه) + المراجعة البعيدة (جزء إلى جزأين يومياً)' : 'Near review (last 10 pages) + Far review (1-2 Juz daily)',
      highlight: isAr ? 'خطة طويلة المدى تجمع الحفظ الجديد بالمراجعة المستمرة' : 'A long-term plan combining new memorization with structured review'
    }
  ];

  // Track 2: المتون التجويدية والسند المتصل
  const matnDetails = {
    tuhfa: {
      name: isAr ? 'متن تحفة الأطفال والغلمان' : 'Tuhfat Al-Atfal',
      author: isAr ? 'العلامة الشيخ سليمان الجمزوري رحمه الله' : 'Sheikh Sulaiman Al-Jamzuri',
      verses: isAr ? '61 بيتاً من بحر الرجز' : '61 poetic verses',
      level: isAr ? 'المستوى الأول (تأسيس أحكام التجويد)' : 'Level 1 (Tajweed Foundation)',
      description: isAr
        ? 'المنظومة الأوسع انتشاراً وقبولاً في العالم الإسلامي للمبتدئين، تشتمل على أحكام النون الساكنة والتنوين، والميم والنون المشددتين، والميم الساكنة، وحكم اللامات، وأحكام المثلين والمتقاربين والمتجانسين، وأقسام المد وأحكامه.'
        : 'The most popular didactic poem for beginners covering nun sakina, tanween, meem, idgham, and lengthening rules.',
      topics: isAr ? [
        'أحكام النون الساكنة والتنوين (الإظهار، الإدغام، الإقلاب، الإخفاء)',
        'حكم الميم والنون المشددتين والميم الساكنة',
        'حكم لام أل ولام الفعل',
        'في المثلين والمتقاربين والمتجانسين',
        'أقسام المد وأحكامه وتفصيل المد الأصلي والفرعي'
      ] : [
        'Rules of Nun Sakinah and Tanween (Izhar, Idgham, Iqlab, Ikhfa)',
        'Rules of Meem & Nun Mushaddadatayn and Meem Sakinah',
        'Rules of Lam in definite article and verbs',
        'Similar, close, and homogenous letter pairs',
        'Divisions and rulings of Madd (primary and secondary)'
      ]
    },
    jazariya: {
      name: isAr ? 'متن المقدمة الجزرية' : 'Al-Muqaddimah Al-Jazariyyah',
      author: isAr ? 'الإمام الحافظ شمس الدين ابن الجزري رحمه الله' : 'Imam Ibn Al-Jazari',
      verses: isAr ? '107 أبيات' : '107 poetic verses',
      level: isAr ? 'المستوى المتقدم (عمدة علم التجويد لطلاب الإجازة)' : 'Advanced Level (The Core of Tajweed for Ijazah)',
      description: isAr
        ? 'المرجع الأساسي الأعظم لكل قارئ ومقرئ على وجه الأرض، تفصّل مخارج الحروف الـ 17 وصفاتها اللازمة والعارضة، والتفخيم والترقيق، والمقطوع والموصول من الكلمات في رسم المصحف العثماني، وباب همز الوصل.'
        : 'The universal masterpiece required for all Ijazah aspirants, detailing the 17 letter articulation points and characteristics.',
      topics: isAr ? [
        'باب مخارج الحروف وصفاتها اللازمة والمتضادة',
        'باب التجويد وتفصيل مراتب التفخيم والترقيق',
        'أحكام الراءات واللامات وتخليص الحروف المتجاورة',
        'باب المقطوع والموصول والتاءات في المصحف الشريف',
        'أحكام الوقف والابتداء وهمز الوصل وتفصيل الأداء'
      ] : [
        'The 17 points of articulation and letter characteristics',
        'Tajweed science, levels of heavy and light letters',
        'Rulings of Raa and Laam',
        'Connected and disconnected words in Ottoman script',
        'Waqf (stopping), Ibtida (starting), and Hamzatul Wasl'
      ]
    },
    shatibiyyah: {
      name: isAr ? 'متن الشاطبية (حرز الأماني ووجه التهاني)' : 'Al-Shatibiyyah (Hirz Al-Amani)',
      author: isAr ? 'الإمام أبو القاسم الشاطبي الرعيني الأندلسي' : 'Imam Al-Qasim bin Firruh Al-Shatibi',
      verses: isAr ? '1173 بيتاً في القراءات السبع' : '1173 poetic verses',
      level: isAr ? 'المستوى العالي (القراءات السبع المتواترة)' : 'Expert Level (The 7 Mutawatir Qira\'at)',
      description: isAr
        ? 'درّة المتون القرآنية وتاج كتب القراءات، نظمت القراءات السبع من طريق التيسير للإمام الداني برمزية بديعة وسلاسة لا نظير لها، تمهد للإجازة الكبرى في القراءات السبع.'
        : 'The pinnacle text for the 7 canonical Quranic readings with intricate poetic codes and comprehensive rules.',
      topics: isAr ? [
        'رموز القراء السبعة ورواتهم الأربعة عشر',
        'باب الاستعاذة والبسملة وسورة أم القرآن',
        'باب الإدغام الكبير وهاء الكناية والمد والقصر',
        'باب الهمزتين من كلمة ومن كلمتين ونقل الحركة',
        'فرش الحروف لكل سور القرآن من البقرة إلى الناس'
      ] : [
        'Codes and symbols of the 7 reciters and their 14 transmitters',
        'Rules of Isti\'adha, Basmalah, and Surah Al-Fatihah',
        'Major assimilation (Idgham Kabeer), pronouns, elongation',
        'Rules for single and paired Hamzas, and vocal transfer',
        'Detailed word-by-word variations from Baqarah to An-Nas'
      ]
    }
  };

  const pageTitle = isAr
    ? 'المسارات التعليمية التخصصية | أكاديمية وَحْيٌ وَنَمَاء'
    : 'Educational Tracks | Wahy Wa Namaa Academy';
  const pageDescription = isAr
    ? 'اكتشف مسارات التحفيظ والمراجعة، والتجويد المتقدم والإجازة عند الأهلية، وتأسيس الأطفال بخطوات تعليمية متدرجة.'
    : 'Explore the 3 educational tracks: Memorization & Revision, Ijazah & Tajweed Matn, and Kids Quranic Foundation.';

  return (
    <>
      <SEOHead
        page={{
          url: '/tracks',
          title: pageTitle,
          description: pageDescription,
          schema: [
            createWebPageSchema({
              name: pageTitle,
              description: pageDescription,
              url: '/tracks',
              type: 'CollectionPage',
            }),
            createBreadcrumbSchema([
              { name: isAr ? 'الرئيسية' : 'Home', url: '/' },
              { name: isAr ? 'المسارات التعليمية' : 'Educational Tracks', url: '/tracks' },
            ]),
          ],
        }}
      />
      <GlobalHeader />

      <main className="wn-program-shell">
        {/* ═══ Hero Section ═══ */}
        <section className="wn-public-hero">
          <div className="absolute inset-0 opacity-10 pointer-events-none" />
          <div className="page-container relative z-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--azhar-gold-leaf)]/20 border border-[var(--azhar-gold-bright)]/40 text-[var(--azhar-gold-bright)] text-sm font-semibold mb-6">
              <Sparkles size={16} />
              <span>{isAr ? 'مسارات تعليمية متدرجة' : 'STRUCTURED QURAN LEARNING'}</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              {isAr ? 'المسارات التعليمية التخصصية' : 'Specialized Quranic Educational Tracks'}
            </h1>
            <p className="text-emerald-100 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed mb-10">
              {isAr
                ? 'ثلاثة مسارات تعليمية تساعد الطالب على الانتقال من التأسيس إلى الحفظ والإتقان، مع وضوح في الأهداف والمراجعة والخطوة التالية.'
                : 'Three structured learning paths that guide students from foundations to memorization and advanced recitation goals.'}
            </p>

            {/* Quick Track Switcher Pills */}
            <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
              {[
                { id: 'memorization', label: isAr ? 'مسار التحفيظ والمراجعة' : 'Memorization & Revision', icon: BookOpen },
                { id: 'ijazah', label: isAr ? 'مسار الإجازة والمتون' : 'Ijazah & Matn Texts', icon: Award },
                { id: 'kids', label: isAr ? 'مسار تأسيس الأطفال' : 'Kids Foundation', icon: Sparkles },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTrack === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTrack(t.id)}
                    className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm md:text-base transition-all shadow-md ${
                      active
                        ? 'bg-[var(--azhar-gold-bright)] text-[var(--athar-navy)] ring-2 ring-white shadow-lg scale-105'
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Content Sections ═══ */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <AnimatePresence mode="wait">
            {/* ══════════════════════════════════════════════════════════════════════════
                1. مسار التحفيظ والمراجعة المتقنة
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'memorization' && (
              <motion.div
                key="memorization"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header Card */}
                <div className="bg-white rounded-3xl p-8 border border-emerald-100 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {isAr ? 'المسار الأول — رعاية الوحي' : 'Track 1 — Quran Memorization'}
                      </span>
                      <h2 className="text-3xl font-black text-slate-900">
                        {isAr ? 'مسار التحفيظ والمراجعة المتقنة' : 'Quran Memorization & Mastery Track'}
                      </h2>
                      <p className="text-slate-600 max-w-2xl text-base leading-relaxed">
                        {isAr
                          ? 'خطة حفظ تجمع التلقين المباشر بالحفظ الجديد والمراجعة المنظمة تحت إشراف معلمين متخصصين.'
                          : 'A proven memorization paradigm combining 1-on-1 recitation with the dual Past & Present retention method.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/free-trial', locale)}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isAr ? 'احجز حصة تقييم مجانية' : 'Book Free Evaluation'}</span>
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>

                {/* منهجية الماضي والحاضر التوضيحية */}
                <div className="bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/70 rounded-3xl p-8 border border-amber-200/70 shadow-sm">
                  <div className="text-center max-w-2xl mx-auto mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center mx-auto mb-3">
                      <Compass size={28} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {isAr ? 'منهجية الماضي والحاضر: سر الحفظ الراسخ' : 'The Past & Present Memorization Formula'}
                    </h3>
                    <p className="text-slate-600 text-sm">
                      {isAr
                        ? 'القرآن أشد تفلتاً من الإبل في عقلها؛ لذا تعتمد أكاديمية وَحْيٌ وَنَمَاء على هذا الثلاثي الذهبي اليومي:'
                        : 'Retention requires disciplined stratification between new memorization and structured historical revision:'}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">1</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">{isAr ? 'الحاضر' : 'Present'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-900">{isAr ? 'الحفظ الجديد (المقدار اليومي)' : 'New Daily Memorization'}</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {isAr
                          ? 'قراءة وتصحيح التلاوة وتوضيح معاني الكلمات مع الشيخ قبل البدء بالحفظ، ثم تسميع المقدار المحدد بدون أي لحن.'
                          : 'Live recitation verification with the teacher before memorizing, ensuring zero mispronunciation.'}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">2</span>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">{isAr ? 'الماضي القريب' : 'Near Past'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-900">{isAr ? 'مراجعة الأيام الأخيرة' : 'Recent Days Review'}</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {isAr
                          ? 'تسميع آخر 5 إلى 10 أوجه حفظها الطالب خلال الأسبوع المنصرم يومياً قبل الشروع في حفظ الوجه الجديد لربط الآيات.'
                          : 'Mandatory daily recitation of the last 5-10 pages learned over the preceding week to connect sequences.'}
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">3</span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">{isAr ? 'الماضي البعيد' : 'Far Past'}</span>
                      </div>
                      <h4 className="font-bold text-lg text-slate-900">{isAr ? 'الورد التثبيتي العام' : 'Cumulative Maintenance'}</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {isAr
                          ? 'جدول أسبوعي وشهرية لمراجعة كامل المحفوظ القديم (جزء إلى جزأين يومياً) حتى لا يتفلت أي حرف على مر الشهور.'
                          : 'Rolling weekly and monthly cycles reciting 1-2 Juz daily to permanently stabilize old retention.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* الخطط الثلاث التفاعلية */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{isAr ? 'خطط الحفظ المخصصة' : 'Tailored Memorization Plans'}</h3>
                      <p className="text-slate-600 text-sm">{isAr ? 'اختر الخطة المناسبة لوقتك وأهدافك الشخصية' : 'Select the plan that fits your target and daily schedule'}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    {memorizationPlans.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setActivePlan(p.id)}
                        className={`cursor-pointer rounded-3xl p-6 border transition-all relative flex flex-col justify-between ${
                          activePlan === p.id
                            ? 'bg-white border-emerald-500 shadow-xl ring-2 ring-emerald-500/30'
                            : 'bg-white/80 border-slate-200 hover:border-emerald-300 shadow-sm'
                        }`}
                      >
                        {activePlan === p.id && (
                          <span className="absolute top-4 left-4 text-emerald-600">
                            <CheckCircle size={22} className="fill-emerald-100" />
                          </span>
                        )}

                        <div className="space-y-4">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            <Calendar size={13} className="inline ml-1" /> {p.duration}
                          </span>
                          <h4 className="text-xl font-bold text-slate-900">{p.title}</h4>
                          <p className="text-slate-600 text-sm leading-relaxed">{p.target}</p>

                          <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
                            <div className="flex items-start gap-2">
                              <Bookmark size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                              <span><strong>{isAr ? 'المقدار اليومي: ' : 'Daily: '}</strong>{p.dailyWorkload}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <ShieldCheck size={14} className="text-amber-600 mt-0.5 shrink-0" />
                              <span><strong>{isAr ? 'نظام المراجعة: ' : 'Revision: '}</strong>{p.reviewSystem}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <Link
                            to={localizedPath(`/register/student?plan=${p.id}`, locale)}
                            className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition ${
                              activePlan === p.id
                                ? 'bg-emerald-700 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <span>{isAr ? 'التسجيل في هذه الخطة' : 'Enroll in this plan'}</span>
                            <ArrowRight size={15} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                2. مسار الإجازة وشرح المتون التجويدية
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'ijazah' && (
              <motion.div
                key="ijazah"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header */}
                <div className="bg-white rounded-3xl p-8 border border-amber-200 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                        {isAr ? 'المسار الثاني — تاج الإسناد' : 'Track 2 — Sanad & Ijazah'}
                      </span>
                      <h2 className="text-3xl font-black text-slate-900">
                        {isAr ? 'مسار التجويد المتقدم والإجازة' : 'Advanced Tajweed & Ijazah'}
                      </h2>
                      <p className="text-slate-600 max-w-2xl text-base leading-relaxed">
                        {isAr
                          ? 'دراسة معمقة للمتون التجويدية الثلاثة الكبرى (تحفة الأطفال، الجزرية، الشاطبية) واجتياز اختباراتها وضوابطها لنيل الإجازة القرآنية بسند متصل لرسول الله ﷺ.'
                          : 'In-depth study of classical Tajweed texts leading to certified Ijazah in Hafs, Asim, and the 10 Qira\'at.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/register/student?track=ijazah', locale)}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isAr ? 'التقديم لاختبار القبول' : 'Apply for Audition'}</span>
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>

                {/* متون التجويد المعتمدة */}
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
                    {[
                      { id: 'tuhfa', label: isAr ? '1. متن تحفة الأطفال' : '1. Tuhfat Al-Atfal' },
                      { id: 'jazariya', label: isAr ? '2. متن المقدمة الجزرية' : '2. Al-Muqaddimah Al-Jazariyyah' },
                      { id: 'shatibiyyah', label: isAr ? '3. متن الشاطبية (القراءات السبع)' : '3. Al-Shatibiyyah' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveMatn(m.id)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                          activeMatn === m.id
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Matn Details Card */}
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-slate-900">{matnDetails[activeMatn].name}</h3>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                          {matnDetails[activeMatn].verses}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                          {matnDetails[activeMatn].level}
                        </span>
                      </div>

                      <p className="text-sm text-slate-500 font-medium">
                        {isAr ? 'الناظم المحقق: ' : 'Author: '}
                        <span className="text-slate-800 font-bold">{matnDetails[activeMatn].author}</span>
                      </p>

                      <p className="text-slate-600 leading-relaxed text-base">
                        {matnDetails[activeMatn].description}
                      </p>

                      <div className="space-y-2 pt-2">
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <Layers size={16} className="text-emerald-700" />
                          <span>{isAr ? 'أهم الأبواب والمسائل التي يدرسها الطالب:' : 'Core Topics Covered:'}</span>
                        </h4>
                        <ul className="grid sm:grid-cols-2 gap-2 text-xs text-slate-700">
                          {matnDetails[activeMatn].topics.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-gradient-to-b from-amber-50/70 to-orange-50/40 rounded-2xl p-6 border border-amber-200/80 flex flex-col justify-between space-y-6">
                      <div className="space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                          <GraduationCap size={26} />
                        </div>
                        <h4 className="font-bold text-lg text-slate-900">{isAr ? 'مزايا دراسة المتن بالأكاديمية' : 'Academy Matn Features'}</h4>
                        <ul className="text-xs text-slate-700 space-y-2">
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-amber-600" />
                            <span>{isAr ? 'شرح تحليلي متدرج بيتًا بيتًا' : 'Detailed verse-by-verse explanation'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-amber-600" />
                            <span>{isAr ? 'اختبار حفظ المتن تحريرياً وشفهياً' : 'Written and oral memorization exam'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-amber-600" />
                            <span>{isAr ? 'إجازة وسند خاص بالمتن من كبار الشيوخ' : 'Special Matn certificate from senior Sheikhs'}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-amber-600" />
                            <span>{isAr ? 'نسخة PDF محققة ملونة مجاناً' : 'Free colored verified PDF download'}</span>
                          </li>
                        </ul>
                      </div>

                      <Link
                        to={localizedPath('/library', locale)}
                        className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold shadow-sm hover:bg-amber-50 transition"
                      >
                        <Bookmark size={14} />
                        <span>{isAr ? 'تحميل نص المتن من المكتبة' : 'Download Matn Text'}</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* شروط السند المتصل والروايات المتاحة */}
                <div className="bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden">
                  <div className="relative z-10 space-y-8">
                    <div className="text-center max-w-2xl mx-auto space-y-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">{isAr ? 'ضوابط الأمانة العلمية' : 'Academic & Spiritual Requirements'}</span>
                      <h3 className="text-2xl md:text-3xl font-black">{isAr ? 'شروط التقدّم لمسار الإجازة' : 'Requirements for the Ijazah path'}</h3>
                      <p className="text-slate-400 text-sm">
                        {isAr
                          ? 'السند أمانة دينية عظيمة، لا يُمنح إلا لمن استوفى الضوابط الموروثة عن أئمة القراءة جيلاً بعد جيل:'
                          : 'Sanad is a sacred chain of trust awarded only upon satisfying strict classical standards:'}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4">
                      {[
                        {
                          title: isAr ? 'حفظ القرآن كاملاً' : 'Full Memorization',
                          desc: isAr ? 'عن ظهر قلب بإتقان تام للآيات والمتشابهات بدون تردد.' : 'Complete retention from memory without hesitation.'
                        },
                        {
                          title: isAr ? 'إتقان علم التجويد' : 'Mastery of Tajweed',
                          desc: isAr ? 'دراسة واجتياز متن الجزرية وتحفة الأطفال وضبط المخارج والصفات.' : 'Full mastery and passing exams for Jazariyyah and Tuhfa.'
                        },
                        {
                          title: isAr ? 'الختمة الكاملة غيباً' : 'Full Oral Recitation',
                          desc: isAr ? 'قراءة ختمة كاملة من الفاتحة إلى الناس على الشيخ المجاز جلسة بجلسة.' : 'Reciting the entire Quran orally to the Sheikh session by session.'
                        },
                        {
                          title: isAr ? 'الإجازة عند الأهلية' : 'Ijazah when eligible',
                          desc: isAr ? 'إصدار الإجازة أو السند يعتمد على أهلية الطالب، وتوفر معلم مجاز، واستيفاء شروط البرنامج.' : 'Issuing an Ijazah or Sanad depends on learner eligibility, an appropriately qualified teacher, and program requirements.'
                        }
                      ].map((cond, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
                          <span className="text-amber-400 font-mono text-sm font-bold">0{i+1}.</span>
                          <h4 className="font-bold text-base text-white">{cond.title}</h4>
                          <p className="text-slate-400 text-xs leading-relaxed">{cond.desc}</p>
                        </div>
                      ))}
                    </div>

                    {/* الروايات والقراءات المتاحة */}
                    <div className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-300">{isAr ? 'الروايات والقراءات المتاحة للإجازة:' : 'Available Narrations for Ijazah:'}</p>
                        <p className="text-sm text-slate-300">
                          {isAr
                            ? 'رواية حفص عن عاصم • قراءة عاصم (حفص وشعبة) • قراءة الإمام نافع (ورش وقالون) • القراءات السبع • القراءات العشر الصغرى والكبرى'
                            : 'Hafs from Asim • Asim (Hafs & Shu\'bah) • Nafi\' (Warsh & Qalun) • 7 Qira\'at • 10 Minor & Major Qira\'at'}
                        </p>
                      </div>

                      <Link
                        to={localizedPath('/teachers?specialty=ijazah', locale)}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                      >
                        {isAr ? 'عرض شيوخ ومقرئي الإجازة' : 'View Certified Scholars'}
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════════
                3. مسار تأسيس الأطفال والبراعم
            ══════════════════════════════════════════════════════════════════════════ */}
            {activeTrack === 'kids' && (
              <motion.div
                key="kids"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-emerald-500/10 rounded-3xl p-8 border border-amber-200 shadow-sm relative overflow-hidden">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                        {isAr ? 'المسار الثالث — براعم النور' : 'Track 3 — Young Buds Foundation'}
                      </span>
                      <h2 className="text-3xl font-black text-slate-900">
                        {isAr ? 'مسار تأسيس الأطفال: القاعدة النورانية ونور البيان' : 'Kids Quranic Foundation: Noorania & Noor Al-Bayan'}
                      </h2>
                      <p className="text-slate-600 max-w-2xl text-base leading-relaxed">
                        {isAr
                          ? 'رحلة مرحة ومتقنة تنقل الطفل من الصفر لتهجئة القرآن الكريم وقراءته برسم المصحف، مع تدريبات النطق السليم لمخارج الحروف والتلقين التفاعلي بالصوت والصورة.'
                          : 'A joyful and structured path taking children from basic letter recognition to reading directly from the Mushaf with correct articulation.'}
                      </p>
                    </div>

                    <Link
                      to={localizedPath('/programs/kids', locale)}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg transition-all"
                    >
                      <span>{isAr ? 'صفحة مسابقات وجوائز الأطفال' : 'Kids Contests & Awards'}</span>
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>

                {/* المنهجان التأسيسيان */}
                <div className="grid md:grid-cols-2 gap-8">
                  {/* نور البيان */}
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        {isAr ? 'المنهج الأكثر شمولاً' : 'Most Comprehensive'}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">{isAr ? 'من 4 إلى 10 سنوات' : 'Ages 4-10'}</span>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900">{isAr ? 'منهج نور البيان لترتيل القرآن' : 'Noor Al-Bayan Curriculum'}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {isAr
                        ? 'منهج تربوي مصري عريق يعتمد التدرج المنطقي: الحروف الهجائية، الحركات القصيرة (فتح، كسر، ضم)، المدود الثلاثة، التنوين، السكون، اللام الشمسية والقمرية، والشدة مع الترتيل.'
                        : 'A renowned pedagogical system teaching short vowels, three extensions (Madd), tanween, sukun, and shaddah directly applied to Quranic verses.'}
                    </p>

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-bold text-slate-700">{isAr ? 'مخرجات تعلم نور البيان:' : 'Learning Outcomes:'}</h4>
                      <ul className="text-xs text-slate-600 space-y-1.5">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>{isAr ? 'القدرة على تهجئة وقراءة أي كلمة في المصحف الشريف' : 'Ability to spell and recite any word from the Mushaf'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>{isAr ? 'التمييز البصري بين الرسم الإملائي والرسم العثماني' : 'Visual distinction between standard & Ottoman script'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-600" />
                          <span>{isAr ? 'تطبيق أحكام الغنن والقلقلة عملياً أثناء القراءة' : 'Practical application of Ghunnah and Qalqalah'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* القاعدة النورانية */}
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900">
                        {isAr ? 'المنهج الصوتي العالمي' : 'Acoustic Precision'}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">{isAr ? 'لكل البراعم والمبتدئين' : 'All Young Beginners'}</span>
                    </div>

                    <h3 className="text-2xl font-bold text-slate-900">{isAr ? 'منهج القاعدة النورانية' : 'Al-Qa\'ida Al-Nooraniyya'}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {isAr
                        ? 'تأليف الشيخ نور محمد حقاني، ترتكز على الضبط النغمي والفونيمي الدقيق للحرف العربي، وتدريب عضلة اللسان والفك على مخارج الحروف من غير إرهاق.'
                        : 'Designed by Sheikh Noor Muhammad Haqqani, focusing on precise phonetics and exercising jaw muscles for authentic Arabic pronunciation.'}
                    </p>

                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-bold text-slate-700">{isAr ? 'مخرجات تعلم القاعدة النورانية:' : 'Learning Outcomes:'}</h4>
                      <ul className="text-xs text-slate-600 space-y-1.5">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-amber-600" />
                          <span>{isAr ? 'فصاحة اللسان وتفخيم وترقيق الحروف باحترافية' : 'Tongue eloquence and mastering heavy & light letters'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-amber-600" />
                          <span>{isAr ? 'التدريب التناغمي على الحروف المركبة والمقطعة' : 'Harmonious practice on compound and disjointed letters'}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-amber-600" />
                          <span>{isAr ? 'تجهيز الطفل للانخراط الفوري في مسار التحفيظ' : 'Immediate readiness for full Quran memorization track'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* تدريبات مخارج الحروف المصورة */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                  <div className="text-center max-w-xl mx-auto space-y-2">
                    <h3 className="text-2xl font-bold text-slate-900">{isAr ? 'تدريبات النطق السليم ومخارج الحروف للأطفال' : 'Child-Friendly Articulation & Phonetics'}</h3>
                    <p className="text-slate-600 text-sm">
                      {isAr
                        ? 'شرح مبسط ومصور لمخارج الحروف الخمسة العامة بالرسوم التوضيحية والصوت التفاعلي:'
                        : 'Visual, simplified explanations of the 5 major articulation zones:'}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      {
                        name: isAr ? 'الجوف' : 'Al-Jawf (Oral Cavity)',
                        letters: isAr ? 'حروف المد الثلاثة (ا، و، ي)' : 'Madd letters (A, W, Y)',
                        color: 'border-blue-200 bg-blue-50/50 text-blue-900',
                        desc: isAr ? 'مخرج مقدر يخرج منه الهواء الممدود براحة.' : 'Estimated outlet for long vowel airflow.'
                      },
                      {
                        name: isAr ? 'الحلق' : 'Al-Halq (Throat)',
                        letters: isAr ? 'أ، هـ، ع، ح، غ، خ' : 'Hamzah, Haa, Ayn, Haa, Ghayn, Khaa',
                        color: 'border-emerald-200 bg-emerald-50/50 text-emerald-900',
                        desc: isAr ? 'أقصى، وسط، وأدنى الحلق مع التمييز الواضح.' : 'Deep, middle, and upper throat sounds.'
                      },
                      {
                        name: isAr ? 'اللسان' : 'Al-Lisan (Tongue)',
                        letters: isAr ? '18 حرفاً (الضاد، القاف، الكاف...)' : '18 letters (Dhad, Qaf, Kaf...)',
                        color: 'border-amber-200 bg-amber-50/50 text-amber-900',
                        desc: isAr ? 'المخرج الأوسع الذي نوليه تدريباً فردياً خاصاً.' : 'The largest zone receiving personalized drill.'
                      },
                      {
                        name: isAr ? 'الشفتان' : 'Al-Shafatan (Lips)',
                        letters: isAr ? 'الفاء، الباء، الميم، الواو' : 'Faa, Baa, Meem, Waw',
                        color: 'border-purple-200 bg-purple-50/50 text-purple-900',
                        desc: isAr ? 'انطباق وانفتاح الشفتين بنطق طفولي نقي.' : 'Clean closure and rounding of the lips.'
                      },
                      {
                        name: isAr ? 'الخيشوم' : 'Al-Khayshum (Nasal)',
                        letters: isAr ? 'صوت الغنة (الميم والنون)' : 'Ghunnah sound (M & N)',
                        color: 'border-rose-200 bg-rose-50/50 text-rose-900',
                        desc: isAr ? 'الرنين الأنفي الجميل الذي يزين التلاوة.' : 'Sweet nasal resonance enriching recitation.'
                      }
                    ].map((m, idx) => (
                      <div key={idx} className={`rounded-2xl p-4 border ${m.color} space-y-2 flex flex-col justify-between`}>
                        <div className="space-y-1">
                          <h4 className="font-bold text-base">{m.name}</h4>
                          <p className="text-xs font-semibold opacity-90">{m.letters}</p>
                        </div>
                        <p className="text-[11px] opacity-75 leading-relaxed pt-2 border-t border-current/10">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══ Bottom Call to Action ═══ */}
        <section className="bg-gradient-to-br from-emerald-900 via-[var(--azhar-green-deep)] to-slate-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              {isAr ? 'ابدأ رحلتك القرآنية اليوم في المسار المناسب لك' : 'Begin Your Quranic Journey Today in Your Selected Track'}
            </h2>
            <p className="text-emerald-100 text-base max-w-2xl mx-auto">
              {isAr
                ? 'جلسة تعريفية مجانية لتحديد المستوى وفهم الهدف واقتراح المسار المناسب لك أو لطفلك.'
                : 'A free introductory assessment to understand your level and recommend a suitable learning path.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link
                to={localizedPath('/free-trial', locale)}
                className="px-8 py-3.5 rounded-xl font-bold bg-gradient-to-r from-[var(--azhar-gold-bright)] to-amber-500 text-slate-950 shadow-lg hover:shadow-xl hover:scale-105 transition-all text-base"
              >
                {isAr ? 'احجز حصتك التجريبية الآن' : 'Book Your Free Trial Now'}
              </Link>
              <Link
                to={localizedPath('/courses', locale)}
                className="px-8 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all text-base"
              >
                {isAr ? 'استعراض كافة الدورات' : 'Browse All Courses'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
