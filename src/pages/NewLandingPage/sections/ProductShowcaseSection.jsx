import { useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  Mic2,
  Radio,
  BarChart3,
  MessageCircleHeart,
  CalendarCheck2,
  BookOpenCheck,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Headphones,
  ShieldCheck,
  UserCheck,
  Eye,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

function Waveform({ active }) {
  return (
    <div className={`wn-product-wave ${active ? 'is-energized' : ''}`} aria-hidden="true" data-visual-mask>
      {Array.from({ length: 28 }).map((_, index) => <i key={index} style={{ '--i': index }} />)}
    </div>
  );
}

export default function ProductShowcaseSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [studioMode, setStudioMode] = useState('listen');
  const [activeMilestone, setActiveMilestone] = useState(3);
  const [classroomRole, setClassroomRole] = useState('student');

  const studioModes = [
    {
      id: 'listen',
      icon: Headphones,
      label: isAr ? 'استماع للنموذج' : 'Model Audio',
      status: isAr ? 'قراءة متقنة بضبط المخارج والمدود' : 'Reference recitation with clear Tajweed',
      tags: isAr
        ? ['تحقيق ضم القاف في «وَقُل»', 'ترقيق الراء والمد الطبيعي']
        : ['Clear Qaf articulation', 'Balanced natural elongation'],
    },
    {
      id: 'record',
      icon: Radio,
      label: isAr ? 'تسجيل الطالب' : 'Student Practice',
      status: isAr ? 'يحاكي الطالب التلاوة ويثبّت النطق قبل الحصة' : 'Learner practices & records before the live session',
      tags: isAr
        ? ['مقارنة ذاتية هادئة', 'إعادة التسجيل بلا حرج']
        : ['Calm self-paced practice', 'Unlimited retries before class'],
    },
    {
      id: 'review',
      icon: BookOpenCheck,
      label: isAr ? 'ملاحظات التجويد' : 'Tajweed Notes',
      status: isAr ? 'تغذية راجعة محددة تنتقل معك للجلسة القادمة' : 'Targeted notes carried into your next live lesson',
      tags: isAr
        ? ['إتقان قلقلة الدال في «زِدْنِي»', 'إتمام الكسرة والمد في «عِلْمًا»']
        : ['Qalqalah clarity on Dal', 'Clean ending stop (Iwad Madd)'],
    },
  ];

  const milestones = [
    {
      step: 1,
      state: 'done',
      title: isAr ? '١. تقييم المستوى المجاني' : '1. Free Level Assessment',
      desc: isAr ? 'قياس دقة القراءة ومخارج الحروف وتحديد نقطة الانطلاق الحقيقية.' : 'Assess current reading fluency and set an honest starting baseline.',
    },
    {
      step: 2,
      state: 'done',
      title: isAr ? '٢. التلقين وتصحيح التلاوة' : '2. Guided Oral Correction',
      desc: isAr ? 'قراءة الورد الجديد أمام المعلم لضمان الحفظ السليم الخالي من اللحن.' : 'Read new verses aloud with the tutor first so memorization starts error-free.',
    },
    {
      step: 3,
      state: 'current',
      title: isAr ? '٣. الحفظ الجديد المنضبط' : '3. Structured New Hifz',
      desc: isAr ? 'تسميع المقدار المقرر بوتيرة متزنة تناسب عمر الطالب ووقته الأسبوعي.' : 'Recite the assigned passage at a sustainable weekly rhythm.',
    },
    {
      step: 4,
      state: 'upcoming',
      title: isAr ? '٤. ربط المحفوظ والمراجعة' : '4. Revision & Linking',
      desc: isAr ? 'دمج الورد الجديد بما سبقه عبر دورة مراجعة قريبة وبعيدة منتظمة.' : 'Connect new verses with prior Surahs through scheduled revision loops.',
    },
    {
      step: 5,
      state: 'upcoming',
      title: isAr ? '٥. التثبيت وإشهاد الإتقان' : '5. Mastery & Certification',
      desc: isAr ? 'اختبار إتمام الجزء أو المرحلة وإصدار شهادة رقمية قابلة للتحقق.' : 'Stage evaluation and verifiable digital completion certificate.',
    },
  ];

  const classroomViews = {
    student: {
      label: isAr ? 'الطالب' : 'Student',
      icon: UserCheck,
      headline: isAr ? 'مصحف واضح ودور تسميع منظم' : 'Focused Mushaf & clear recitation turn',
      items: [
        { icon: CalendarCheck2, text: isAr ? 'هدف الحصة معروض بوضوح أعلى الشاشة' : 'Lesson goal pinned clearly on screen' },
        { icon: Mic2, text: isAr ? 'تنبيه هادئ عند حلول دورك في التسميع' : 'Calm visual cue when it is your turn to recite' },
        { icon: CheckCircle2, text: isAr ? 'واجب الحصة القادمة يُحفظ تلقائياً في لوحتك' : 'Next homework saved directly to your dashboard' },
      ],
    },
    teacher: {
      label: isAr ? 'المعلم' : 'Tutor',
      icon: Radio,
      headline: isAr ? 'إدارة عادلة للوقت وتقييم فوري لكل طالب' : 'Fair time allocation & structured evaluation',
      items: [
        { icon: BookOpenCheck, text: isAr ? 'تدوين السورة المسمّعة وملاحظات التجويد لحظياً' : 'Log recited Surah & Tajweed notes in real time' },
        { icon: CalendarCheck2, text: isAr ? 'متابعة حضور كل طالب وتنظيم طابور الحلقة' : 'Track attendance and manage circle queue smoothly' },
        { icon: CheckCircle2, text: isAr ? 'اعتماد تقرير الحصة بضغطة واحدة عند الختام' : 'Publish individual post-lesson reports on completion' },
      ],
    },
    guardian: {
      label: isAr ? 'ولي الأمر' : 'Parent',
      icon: Eye,
      headline: isAr ? 'مراقبة مطمئنة وشات محمي بالكامل' : 'Peaceful observer access & safeguarded chat',
      items: [
        { icon: ShieldCheck, text: isAr ? 'إمكانية حضور حصة الابن كمراقب للاطمئنان' : 'Optional silent observer mode for child sessions' },
        { icon: CheckCircle2, text: isAr ? 'حجب تلقائي للأرقام والروابط الخارجية في المحادثة' : 'Automatic blocking of phone numbers & external links' },
        { icon: MessageCircleHeart, text: isAr ? 'استلام التقرير التفصيلي فور انتهاء الدرس' : 'Receive full lesson evaluation right after class' },
      ],
    },
  };

  const reportRows = [
    {
      label: isAr ? 'ما تم تسميعه اليوم' : 'Recited today',
      value: isAr ? 'سورة المزمل (١ – ١٥) • إتقان ممتاز' : 'Surah Al-Muzzammil (1–15) • Strong mastery',
    },
    {
      label: isAr ? 'ملاحظة التجويد' : 'Tajweed focus',
      value: isAr ? 'تحسن ملحوظ في زمن الغنّة والمد المتصل' : 'Clear improvement in Ghunnah & connected Madd',
    },
    {
      label: isAr ? 'ورد الحصة القادمة' : 'Next session target',
      value: isAr ? 'إتمام السورة + مراجعة سورة الملك' : 'Complete Surah + revise Surah Al-Mulk',
    },
  ];

  const currentStudio = studioModes.find((mode) => mode.id === studioMode) || studioModes[0];
  const currentMilestone = milestones.find((item) => item.step === activeMilestone) || milestones[2];
  const currentClassroom = classroomViews[classroomRole] || classroomViews.student;

  return (
    <section className="wn-product-showcase" id="learning-tools">
      <div className="page-container">
        <div className="wn-section-split-heading wn-product-showcase__heading">
          <div>
            <span className="wn-approved-eyebrow">
              <Sparkles size={14} />
              {isAr ? 'معاينة تفاعلية للمنصة' : 'INTERACTIVE PLATFORM PREVIEW'}
            </span>
            <h2 className="wn-home-title">
              {isAr ? 'جرّب بنفسك كيف تعمل أدوات وَحْيٌ وَنَمَاء بهدوء حول القرآن' : 'Experience how Wahy Wa Namaa works quietly around the Quran'}
            </h2>
            <p className="wn-home-lead">
              {isAr
                ? 'انقر على أوضاع التلاوة ومحطات الحفظ ومنظور الفصل المباشر لتستكشف كيف ترافقك المنصة أنت وأسرتك.'
                : 'Interact with the recitation modes, Hifz milestones, and classroom roles below to preview the learner & family workflow.'}
            </p>
          </div>

          <span className="wn-product-showcase__demo-label">
            {isAr ? 'معاينة حية قابلة للتجربة' : 'Interactive product sandbox'}
          </span>
        </div>

        <div className="wn-product-bento">
          {/* Tile 1: Interactive Recitation Studio */}
          <article className="wn-product-tile wn-product-tile--recitation">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon"><Mic2 size={20} /></span>
              <span className="wn-product-status"><i /> {isAr ? 'استوديو التلاوة' : 'Recitation studio'}</span>
            </div>

            <div className="wn-product-recitation">
              <div className="wn-product-recitation__verse">
                <span>{isAr ? 'مقطع التدريب التطبيقي' : 'Interactive practice passage'}</span>
                <p className="font-quran">وَقُل رَّبِّ زِدْنِي عِلْمًا</p>
              </div>
              <Waveform active={studioMode === 'record'} />
              <div className="wn-product-recitation__controls" role="tablist" aria-label={isAr ? 'أوضاع استوديو التلاوة' : 'Recitation studio modes'}>
                {studioModes.map(({ id, icon: ModeIcon, label }) => {
                  const active = id === studioMode;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      key={id}
                      onClick={() => setStudioMode(id)}
                      className={`wn-studio-mode-btn ${active ? 'is-active' : ''}`}
                    >
                      <ModeIcon size={15} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="wn-studio-feedback" aria-live="polite">
                <strong>{currentStudio.status}</strong>
                <div className="wn-studio-feedback__tags">
                  {currentStudio.tags.map((tag) => (
                    <span key={tag}><CheckCircle2 size={13} /> {tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="wn-product-tile__copy">
              <h3>{isAr ? 'التغذية الراجعة جزء متصل برحلة التعلّم' : 'Feedback stays connected to the learning loop'}</h3>
              <p>{isAr ? 'يتدرب الطالب بين الحصص، ويراجع ملاحظات التجويد بدقة ليدخل جلسته التالية بثقة أعلى.' : 'Learners practice calmly between classes and enter their next lesson with clear improvement targets.'}</p>
            </div>
          </article>

          {/* Tile 2: Interactive 5-Milestone Hifz Map */}
          <article className="wn-product-tile wn-product-tile--journey">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon wn-product-icon--mint"><BarChart3 size={19} /></span>
              <span className="wn-product-kicker">{isAr ? 'خريطة الحفظ التفاعلية' : 'INTERACTIVE HIFZ MAP'}</span>
            </div>

            <div className="wn-hifz-map wn-hifz-map--interactive" role="tablist" aria-label={isAr ? 'مراحل مسار الحفظ' : 'Hifz milestones'}>
              {milestones.map((item, idx) => {
                const isSelected = item.step === activeMilestone;
                const stateClass = item.state === 'done' ? 'is-done' : item.state === 'current' ? 'is-current' : '';
                return (
                  <span key={item.step} className="wn-hifz-map__group">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-label={item.title}
                      onClick={() => setActiveMilestone(item.step)}
                      className={`wn-hifz-node ${stateClass} ${isSelected ? 'is-selected' : ''}`}
                    >
                      {item.step}
                    </button>
                    {idx < milestones.length - 1 && <i aria-hidden="true" />}
                  </span>
                );
              })}
            </div>

            <div className="wn-hifz-detail" aria-live="polite">
              <strong>{currentMilestone.title}</strong>
              <p>{currentMilestone.desc}</p>
            </div>

            <h3>{isAr ? 'تقدّم مرئي بدل الإحساس بالتشتت' : 'Visible progress instead of scattered activity'}</h3>
            <p>{isAr ? 'اضغط على أرقام المحطات أعلاه لمعاينة كيف ينتقل الطالب من التقييم الأولي حتى الإتقان.' : 'Select any milestone number above to see how each learner moves from assessment to retention.'}</p>
          </article>

          {/* Tile 3: Interactive Live Classroom Perspectives */}
          <article className="wn-product-tile wn-product-tile--classroom">
            <div className="wn-classroom-tabs" role="tablist" aria-label={isAr ? 'منظور الغرفة المباشرة' : 'Classroom role perspective'}>
              {Object.entries(classroomViews).map(([key, view]) => {
                const RoleIcon = view.icon;
                const active = key === classroomRole;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    key={key}
                    onClick={() => setClassroomRole(key)}
                    className={`wn-classroom-tab ${active ? 'is-active' : ''}`}
                  >
                    <RoleIcon size={14} />
                    <span>{view.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="wn-product-classroom__screen" aria-live="polite">
              <div className="wn-product-classroom__teacher">
                <span><Radio size={18} /></span>
                <strong>{isAr ? `منظور ${currentClassroom.label}` : `${currentClassroom.label} View`}</strong>
                <small>{currentClassroom.headline}</small>
              </div>
              <div className="wn-product-classroom__rail">
                {currentClassroom.items.map(({ icon: ItemIcon, text }) => (
                  <span key={text}><ItemIcon size={15} /> {text}</span>
                ))}
              </div>
            </div>
            <div className="wn-product-tile__copy">
              <h3>{isAr ? 'فصل مباشر يحترم دور الطالب والمعلم والأسرة' : 'A live classroom tailored for learner, tutor, and parent'}</h3>
              <p>{isAr ? 'واجهة هادئة خالية من الضجيج تركز على المصحف والتسميع مع حماية تلقائية للمحادثة.' : 'Calm, distraction-free classroom UI with synchronized Mushaf and built-in safeguarding.'}</p>
            </div>
          </article>

          {/* Tile 4: Structured Family Report */}
          <article className="wn-product-tile wn-product-tile--family">
            <div className="wn-product-tile__top">
              <span className="wn-product-icon wn-product-icon--gold"><MessageCircleHeart size={19} /></span>
              <span className="wn-product-kicker">{isAr ? 'نموذج تقرير الأسرة' : 'SESSION REPORT SAMPLE'}</span>
            </div>

            <div className="wn-family-report wn-family-report--structured">
              {reportRows.map((row, index) => (
                <div key={row.label} className="wn-family-report__row">
                  <span>{index + 1}</span>
                  <div>
                    <small>{row.label}</small>
                    <p>{row.value}</p>
                  </div>
                  <CheckCircle2 size={15} />
                </div>
              ))}
            </div>

            <h3>{isAr ? 'تقرير مفهوم وعملي بعد كل حصة' : 'Actionable report after every lesson'}</h3>
            <p>{isAr ? 'يعرف الطالب وولي الأمر بدقة ما أُنجز اليوم وما المطلوب تحضيره للقاء القادم.' : 'Families see exactly what was recited, how it was evaluated, and what to prepare next.'}</p>
          </article>
        </div>

        <div className="wn-product-showcase__cta">
          <LocalizedLink
            to="/free-trial"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/free-trial')}
            className="wn-btn wn-btn--primary wn-btn--lg"
          >
            <span>{isAr ? 'احجز حصتك التجريبية المجانية الآن' : 'Book your free trial session now'}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
