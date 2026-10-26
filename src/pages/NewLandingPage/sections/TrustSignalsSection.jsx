import { useI18n } from '../../../i18n';
import {
  ShieldCheck,
  HeartHandshake,
  LockKeyhole,
  BadgeCheck,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';

export default function TrustSignalsSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const signals = [
    {
      icon: ShieldCheck,
      badge: isAr ? 'حماية الأسرة والأطفال' : 'Child & Family Safety',
      title: isAr ? 'بيئة آمنة للأطفال ومتابعة مباشرة لولي الأمر' : 'Child-safe environment with live parent oversight',
      desc: isAr
        ? 'لوحة خاصة لولي الأمر لمتابعة الحصص والتقارير، مع حق حضور الحصة كمراقب وفلتر أمان في الشات يمنع مشاركة الأرقام أو الروابط الخارجية.'
        : 'Dedicated parent portal for session reports, observer classroom access, and strict chat filtering that blocks phone numbers and external links.',
      points: [
        isAr ? 'وضع مراقبة الحصة لولي الأمر' : 'Parent classroom observer mode',
        isAr ? 'حظر تلقائي للأرقام والروابط في الشات' : 'Automatic phone & link chat guard',
      ],
    },
    {
      icon: HeartHandshake,
      badge: isAr ? 'خصوصية تامة' : 'Complete Privacy',
      title: isAr ? 'قسم مستقل للسيدات بمعلمات مجازات' : 'Dedicated women’s section with certified female tutors',
      desc: isAr
        ? 'حلقات مخصصة للسيدات والفتيات بإشراف معلمات متقنات ومجازات فقط، مع مراعاة الخصوصية الكاملة في الغرف المباشرة والتواصل.'
        : 'Exclusive learning circles for women and girls led strictly by qualified female instructors in a private, comfortable environment.',
      points: [
        isAr ? 'معلمات مجازات ومتخصصات فقط' : 'Certified female instructors only',
        isAr ? 'فصل كامل بين الأقسام والحلقات' : 'Strict section & circle separation',
      ],
    },
    {
      icon: LockKeyhole,
      badge: isAr ? 'شفافية وأمان مالي' : 'Verified Payments',
      title: isAr ? 'تحويل موثق ومراجعة دقيقة قبل التفعيل' : 'Protected transfer proofs & verified settlement',
      desc: isAr
        ? 'تُرفع إيصالات التحويل (InstaPay أو المحافظ أو الحساب البنكي) في مساحة مشفرة خاصة، وتُراجع من الإدارة لضمان تفعيل اشتراكك وحفظ حقوقك.'
        : 'Transfer receipts (InstaPay, mobile wallets, or bank transfers) are stored privately and verified by the academy team before activation.',
      points: [
        isAr ? 'تخزين خاص ومؤمّن لإثباتات الدفع' : 'Private encrypted proof storage',
        isAr ? 'أسعار واضحة بلا رسوم خفية' : 'Transparent pricing with no hidden fees',
      ],
    },
    {
      icon: BadgeCheck,
      badge: isAr ? 'بداية بلا التزام' : 'Risk-Free Start',
      title: isAr ? 'حصة تجريبية مجانية وتسكين حسب المستوى' : 'Free trial session & accurate level placement',
      desc: isAr
        ? 'يبدأ الطالب بحصة تقييم مجانية مع المعلم لتحديد مستواه بدقة، ثم نرشح له الحلقة الأنسب لسنّه ومستواه قبل دفع أي اشتراك.'
        : 'Begin with a free evaluation session to assess recitation level accurately before choosing and paying for the right circle.',
      points: [
        isAr ? 'تقييم مستوى مجاني قبل الاشتراك' : 'Free level assessment before subscribing',
        isAr ? 'تسكين متجانس في العمر والمستوى' : 'Age- and level-matched circles',
      ],
    },
  ];

  const footerAssurances = [
    isAr ? 'إمكانية تغيير المعلم أو موعد الحلقة' : 'Flexible tutor or schedule changes',
    isAr ? 'تقارير دورية بعد كل حصة' : 'Structured progress reports after every session',
    isAr ? 'شهادات إتمام رقمية قابلة للتحقق' : 'Verifiable digital completion certificates',
  ];

  return (
    <section className="wn-home-section wn-home-section--ivory" id="trust-signals">
      <div className="page-container">
        <div className="wn-approved-section-heading">
          <span className="wn-approved-eyebrow">
            <ShieldCheck size={14} />
            {isAr ? 'معايير الأمان والثقة' : 'TRUST & SAFEGUARDING'}
          </span>
          <h2>
            {isAr
              ? 'مصممة لراحة بال الأسرة وأمان المتعلم'
              : 'Built for family peace of mind and learner safety'}
          </h2>
          <p>
            {isAr
              ? 'نجمع بين الضبط التربوي والأمان التقني في كل خطوة: من دخول الفصل الافتراضي وحتى متابعة ولي الأمر وتوثيق المدفوعات.'
              : 'Every layer of the platform is engineered around educational integrity, child safeguarding, and transparent financial operations.'}
          </p>
        </div>

        <div className="wn-trust-grid">
          {signals.map(({ icon: Icon, badge, title, desc, points }) => (
            <article key={title} className="wn-trust-card">
              <div className="wn-trust-card__top">
                <span className="wn-icon-box wn-icon-box--emerald">
                  <Icon size={22} strokeWidth={1.7} />
                </span>
                <span className="wn-trust-card__badge">{badge}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <ul className="wn-trust-card__points">
                {points.map((point) => (
                  <li key={point}>
                    <CheckCircle2 size={15} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="wn-trust-strip">
          <div className="wn-trust-strip__items">
            {footerAssurances.map((item) => (
              <span key={item} className="wn-trust-strip__item">
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </span>
            ))}
          </div>
          <LocalizedLink to="/free-trial" locale={locale} className="wn-btn wn-btn--primary wn-btn--sm">
            <span>{isAr ? 'احجز حصتك التجريبية المجانية' : 'Book your free trial'}</span>
            <ArrowIcon size={15} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
