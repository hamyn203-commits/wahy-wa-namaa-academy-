import { useI18n } from '../../../i18n';
import {
  GraduationCap,
  HeartHandshake,
  Compass,
  ShieldCheck,
  Clock,
  Sprout,
  Sparkles,
} from 'lucide-react';

export default function WhyWahyNamaaSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';

  const pillars = [
    {
      num: '01',
      icon: GraduationCap,
      title: isAr ? 'التلقي بالمشافهة والإتقان' : 'Oral Mastery & Precision',
      desc: isAr
        ? 'القرآن يُتلقّى من أفواه المتقنين؛ لذلك نبني كل حلقة على الاستماع المباشر وتصحيح التلاوة الحقيقي لا مجرد المحتوى المسجل.'
        : 'The Quran is transmitted person-to-person; every circle prioritizes live recitation and direct scholarly correction.',
    },
    {
      num: '02',
      icon: Sprout,
      title: isAr ? 'القرآن أثرٌ ونماء في السلوك' : 'Growth Beyond Memorization',
      desc: isAr
        ? 'لا نقف عند حدود التسميع، بل نربط الآيات بالفهم والتهذيب وبناء علاقة قلبية مستمرة مع كتاب الله.'
        : 'We connect recitation and memorization to reflection, character refinement, and a lifelong bond with the Quran.',
    },
    {
      num: '03',
      icon: HeartHandshake,
      title: isAr ? 'الرفق بالمتعلم ومراعاة الفروق' : 'Compassionate Pedagogy',
      desc: isAr
        ? 'نختار المعلم القادر على التحبيب والصبر والتشجيع، بحيث يُقبل الطفل والكبير على حصته بشوق وطمأنينة.'
        : 'Instructors are chosen for patience, warmth, and encouragement alongside scholarly mastery.',
    },
    {
      num: '04',
      icon: Compass,
      title: isAr ? 'ثبات القليل خير من انقطاع الكثير' : 'Sustainable Pacing',
      desc: isAr
        ? 'نصمم الورد والمراجعة على قدر طاقة المتعلم ليترسخ المحفوظ في الصدر دون ضغط يؤدي إلى الفتور.'
        : 'Study loads are calibrated to each learner’s capacity so retention stays strong without burnout.',
    },
    {
      num: '05',
      icon: ShieldCheck,
      title: isAr ? 'بيئة تربوية تحفظ الخصوصية' : 'Safeguarded Environment',
      desc: isAr
        ? 'ضوابط واضحة تفصل الأقسام وتحمي الصغار وتمنح الأسرة ثقة كاملة في كل تفاعل داخل الأكاديمية.'
        : 'Strict safeguarding, dedicated women’s circles, and transparent oversight protect every learner.',
    },
    {
      num: '06',
      icon: Clock,
      title: isAr ? 'انسجام مع إيقاع الأسرة والعمل' : 'Built Around Real Routines',
      desc: isAr
        ? 'تنوع في أوقات الحلقات وأحجامها من الحلقة الجماعية وحتى الفردية لتبقى صلتك بالقرآن حاضرة مهما انشغلت.'
        : 'Flexible circle sizes and time-zone-friendly schedules keep Quran learning steady across busy weeks.',
    },
  ];

  return (
    <section className="wn-approved-why" id="why-wahy-namaa">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <Sparkles size={14} /> {isAr ? 'فلسفتنا التربوية' : 'OUR EDUCATIONAL PHILOSOPHY'}
          </span>
          <h2>
            {isAr
              ? 'أصالة التلقي القرآني… بهدوء ووضوح يناسب المتعلم المعاصر'
              : 'Authentic Quranic pedagogy delivered with calm, modern clarity'}
          </h2>
          <p>
            {isAr
              ? 'ستة مرتكزات تربوية تحكم اختيار المعلمين، وتصميم الحلقات، وطريقة مرافقة الطالب من أول آية.'
              : 'Six pedagogical commitments guide how we select scholars, structure circles, and support every learner.'}
          </p>
        </div>

        <div className="wn-approved-why__grid">
          {pillars.map(({ num, icon: Icon, title, desc }) => (
            <article key={num} className="wn-approved-why-card wn-why-card-editorial">
              <div className="wn-why-card-editorial__top">
                <span className="wn-icon-box wn-icon-box--gold"><Icon size={22} strokeWidth={1.6} /></span>
                <span className="wn-why-card-editorial__num" aria-hidden="true">{num}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
