import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  Mic2,
  Video,
  BarChart3,
  MessageCircleHeart,
  LibraryBig,
  Sparkles,
  CheckCircle2,
  Waves,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function ImmersiveLearningSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const [activeId, setActiveId] = useState('recite');

  const features = [
    {
      id: 'recite',
      stageFocus: 'recite',
      icon: Mic2,
      title: isAr ? 'تحليل التلاوة ومراجعة الأداء' : 'Recitation practice & review',
      text: isAr
        ? 'تدريب صوتي بين الحصص يمكّن الطالب من تسجيل تلاوته ومراجعة مواضع التحسين قبل لقاء المعلم.'
        : 'Audio practice between lessons helps learners record recitation and spot improvement areas early.',
      stageNote: isAr ? 'يركز على: ضبط المخارج والمدود قبل التسميع المباشر' : 'Focuses on: articulation & Madd accuracy before class',
    },
    {
      id: 'classroom',
      stageFocus: 'recite',
      icon: Video,
      title: isAr ? 'فصل قرآني مباشر بمصحف متزامن' : 'Live classroom with synced Mushaf',
      text: isAr
        ? 'غرفة تسميع هادئة تجمع الصوت الواضح، المصحف المتزامن، وإدارة أدوار الطلاب في الحلقة.'
        : 'Focused live room uniting clear audio, synchronized Mushaf pages, and structured turn-taking.',
      stageNote: isAr ? 'يركز على: المشافهة الحية وتنظيم وقت كل طالب بدقة' : 'Focuses on: live oral correction & fair student turns',
    },
    {
      id: 'progress',
      stageFocus: 'progress',
      icon: BarChart3,
      title: isAr ? 'سجل حفظ ومراجعة متصل' : 'Unified Hifz & revision log',
      text: isAr
        ? 'تتحول كل حصة مكتملة إلى خطوة موثقة في رصيد الحفظ والمراجعة لتبقى الرؤية واضحة دائماً.'
        : 'Every completed session updates memorization and revision records into one coherent timeline.',
      stageNote: isAr ? 'يركز على: التوازن بين الحفظ الجديد وتثبيت المحفوظ السابق' : 'Focuses on: balancing new Hifz with long-term retention',
    },
    {
      id: 'family',
      stageFocus: 'family',
      icon: MessageCircleHeart,
      title: isAr ? 'طمأنينة الأسرة وتقارير الجلسات' : 'Parent visibility & session reports',
      text: isAr
        ? 'يصل لولي الأمر ملخص واضح بعد كل حصة يبيّن السورة المسمّعة ومستوى الإتقان وواجب اللقاء القادم.'
        : 'Parents receive structured post-session summaries showing recited Surahs, mastery, and homework.',
      stageNote: isAr ? 'يركز على: إشراك الأسرة بصورة هادئة ومنظمة بعد كل درس' : 'Focuses on: actionable family updates after every lesson',
    },
    {
      id: 'library',
      stageFocus: 'progress',
      icon: LibraryBig,
      title: isAr ? 'الواجبات والمكتبة في مكان واحد' : 'Assignments & library in one hub',
      text: isAr
        ? 'تسليم الواجبات الصوتية والمواد المساندة مرتبط مباشرة بملف الطالب دون تشتت عبر تطبيقات خارجية.'
        : 'Audio homework and study resources stay connected inside the learner’s account without app-switching.',
      stageNote: isAr ? 'يركز على: استمرارية التعلم طوال الأسبوع داخل حساب موحد' : 'Focuses on: seamless weekly continuity in one account',
    },
  ];

  const activeFeature = features.find((item) => item.id === activeId) || features[0];

  return (
    <section className="wn-immersive" id="platform-experience">
      <div className="wn-immersive__grid-glow" aria-hidden="true" />
      <div className="page-container wn-immersive__layout">
        <div className="wn-immersive__content">
          <span className="wn-immersive__eyebrow">
            <Sparkles size={14} />
            {isAr ? 'منظومة التعلم المتكاملة' : 'INTEGRATED LEARNING ECOSYSTEM'}
          </span>

          <h2>
            {isAr ? (
              <>ليست مجرد مكالمة فيديو.<br /><strong>بيئة قرآنية مترابطة حول المصحف.</strong></>
            ) : (
              <>More than video calls.<br /><strong>A connected ecosystem built around the Mushaf.</strong></>
            )}
          </h2>

          <p className="wn-immersive__lead">
            {isAr
              ? 'كل أداة في المنصة مصممة لتخدم لحظة التلقي بين المعلم والطالب، وتربط ما يحدث داخل الحلقة بما يتدرب عليه الطالب طوال الأسبوع.'
              : 'Every tool serves the live teaching moment and connects classroom recitation with guided weekly practice.'}
          </p>

          <div className="wn-immersive__features" role="tablist" aria-label={isAr ? 'عناصر منظومة التعلم' : 'Ecosystem features'}>
            {features.map(({ id, icon: Icon, title, text }) => {
              const selected = id === activeFeature.id;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  key={id}
                  onClick={() => setActiveId(id)}
                  className={`wn-immersive-feature wn-immersive-feature--btn ${selected ? 'is-active' : ''}`}
                >
                  <span><Icon size={18} strokeWidth={1.6} /></span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <LocalizedLink
            to="/ai"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/ai')}
            className="wn-btn wn-btn--accent wn-btn--lg"
          >
            <Waves size={17} />
            <span>{isAr ? 'استكشف أدوات التلاوة الذكية' : 'Explore smart recitation tools'}</span>
          </LocalizedLink>
        </div>

        <div className="wn-quran-3d-stage" aria-label={isAr ? 'عرض بصري ثلاثي الأبعاد لتجربة التعلم' : '3D visual of the learning experience'}>
          <div className="wn-quran-3d-stage__halo" aria-hidden="true" />
          <div className="wn-quran-3d-stage__arch" aria-hidden="true" />

          <div className="wn-quran-book3d" aria-hidden="true">
            <div className="wn-quran-book3d__shadow" />
            <div className="wn-quran-book3d__left">
              <div className="wn-quran-book3d__page-lines">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="wn-quran-book3d__right">
              <div className="wn-quran-book3d__page-lines">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
            <div className="wn-quran-book3d__spine" />
            <div className="wn-quran-book3d__light">✦</div>
          </div>

          <div className={`wn-float-card wn-float-card--recite ${activeFeature.stageFocus === 'recite' ? 'is-highlighted' : ''}`}>
            <span className="wn-float-card__icon"><Mic2 size={16} /></span>
            <div>
              <strong>{isAr ? 'تسميع وتلاوة' : 'Live recitation'}</strong>
              <small>{isAr ? 'مصحف متزامن • تصحيح فوري' : 'Synced Mushaf • live feedback'}</small>
            </div>
          </div>

          <div className={`wn-float-card wn-float-card--progress ${activeFeature.stageFocus === 'progress' ? 'is-highlighted' : ''}`}>
            <div className="wn-progress-ring"><span>✦</span></div>
            <div>
              <strong>{isAr ? 'سجل الإتقان' : 'Mastery log'}</strong>
              <small>{isAr ? 'حفظ • مراجعة • واجبات' : 'Hifz • review • tasks'}</small>
            </div>
          </div>

          <div className={`wn-float-card wn-float-card--family ${activeFeature.stageFocus === 'family' ? 'is-highlighted' : ''}`}>
            <span className="wn-float-card__icon"><CheckCircle2 size={16} /></span>
            <div>
              <strong>{isAr ? 'تقرير الحصة جاهز' : 'Session report ready'}</strong>
              <small>{isAr ? 'إشعار فوري لولي الأمر' : 'Instant family summary'}</small>
            </div>
          </div>

          <div className="wn-stage-focus-note" aria-live="polite">
            {activeFeature.stageNote}
          </div>

          <div className="wn-quran-3d-stage__caption">
            <span>{isAr ? 'وَحْيٌ' : 'WAHY'}</span>
            <i />
            <span>{isAr ? 'نَمَاء' : 'NAMAA'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
