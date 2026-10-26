import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpenCheck, Check, Clock3,
  Crown, Heart, ShieldCheck, Sparkles, Users, UserRound
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import LocalizedLink from '../../components/LocalizedLink';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useToast } from '../../context/ToastProvider';
import api from '../../lib/api';
import { localizedPath } from '../../lib/locale';
import './plans.css';

const PLAN_DEFS = [
  {
    id: 'community',
    nameAr: 'الحلقة الاقتصادية الكبرى',
    nameEn: 'Community Circle',
    price: 10,
    studentsAr: 'من 15 إلى 20 طالب',
    studentsEn: '15–20 students',
    image: '/images/plans/plan-community.svg',
    badgeAr: 'الأوفر',
    badgeEn: 'Best value',
    tone: 'mint',
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['حلقة جماعية منظمة', 'تسميع بالدور', 'مناسبة للاستمرار بتكلفة منخفضة'],
    featuresEn: ['Structured group circle', 'Turn-based recitation', 'Lowest-cost continuous learning'],
  },
  {
    id: 'group',
    nameAr: 'الحلقة الجماعية',
    nameEn: 'Group Circle',
    price: 20,
    studentsAr: 'من 5 إلى 10 طلاب',
    studentsEn: '5–10 students',
    image: '/images/plans/plan-group.svg',
    badgeAr: 'الأكثر طلبًا',
    badgeEn: 'Most popular',
    tone: 'emerald',
    featured: true,
    durationAr: 'من ساعة إلى ساعتين',
    durationEn: '1–2 hours',
    featuresAr: ['متابعة أكبر لكل طالب', 'وقت تسميع أفضل', 'توازن ممتاز بين السعر والمتابعة'],
    featuresEn: ['More attention per learner', 'More recitation time', 'Strong price-to-attention balance'],
  },
  {
    id: 'focused',
    nameAr: 'الحلقة المركزة',
    nameEn: 'Focused Circle',
    price: 35,
    studentsAr: 'من 3 إلى 5 طلاب',
    studentsEn: '3–5 students',
    image: '/images/plans/plan-focused.svg',
    badgeAr: 'متابعة أقوى',
    badgeEn: 'More focus',
    tone: 'teal',
    durationAr: 'ساعة ونصف',
    durationEn: '90 minutes',
    featuresAr: ['مجموعة صغيرة', 'تصحيح وتوجيه أكثر', 'مناسبة للحفظ والمراجعة المكثفة'],
    featuresEn: ['Small group', 'More correction and coaching', 'Ideal for focused memorization'],
  },
  {
    id: 'mini',
    nameAr: 'الحلقة المصغرة',
    nameEn: 'Mini Circle',
    price: 50,
    studentsAr: 'من 2 إلى 3 طلاب',
    studentsEn: '2–3 students',
    image: '/images/plans/plan-mini.svg',
    badgeAr: 'شبه فردي',
    badgeEn: 'Semi-private',
    tone: 'gold',
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    featuresAr: ['اهتمام شبه فردي', 'وقت أكبر للتسميع', 'خطة متابعة أدق'],
    featuresEn: ['Near-private attention', 'More recitation time', 'More precise follow-up'],
  },
  {
    id: 'private',
    nameAr: 'الحصة الفردية',
    nameEn: 'Private Session',
    price: 100,
    studentsAr: 'طالب واحد',
    studentsEn: '1 student',
    image: '/images/plans/plan-private.svg',
    badgeAr: 'أعلى متابعة',
    badgeEn: 'Maximum attention',
    tone: 'ink',
    from: true,
    durationAr: 'ساعة أو أقل',
    durationEn: 'Up to 60 minutes',
    featuresAr: ['طالب واحد مع المعلم', 'خطة مخصصة بالكامل', 'أقصى مرونة وتركيز'],
    featuresEn: ['One learner with the tutor', 'Fully personalized plan', 'Maximum flexibility and focus'],
  },
];

export default function PlansPage() {
  const { locale } = useI18n();
  const { user, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const renewalId = searchParams.get('renew') || '';
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [audience, setAudience] = useState('general');
  const enrolledSection = user?.role === 'student' && ['men_children', 'ladies'].includes(user?.enrollmentSection)
    ? user.enrollmentSection : null;
  const [sessionCount, setSessionCount] = useState(8);
  const [catalog, setCatalog] = useState(null);
  const [selection, setSelection] = useState(null);
  const [selectingPlan, setSelectingPlan] = useState('');
  const [renewalSource, setRenewalSource] = useState(null);

  useEffect(() => {
    if (!renewalId && enrolledSection) setAudience(enrolledSection === 'ladies' ? 'women' : 'general');
  }, [enrolledSection, renewalId]);

  useEffect(() => {
    let cancelled = false;

    api.get('/api/subscriptions/plans')
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        // Keep the embedded catalog as a resilient display fallback.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!renewalId || !isAuthenticated || user?.role !== 'student') return;

    let cancelled = false;
    api.get('/api/subscriptions/' + encodeURIComponent(renewalId), { auth: true })
      .then((data) => {
        if (cancelled || !data?.subscription) return;
        const source = data.subscription;
        setRenewalSource(source);
        setSessionCount(Number(source.sessionCount || 8));
        setAudience(source.section === 'ladies' ? 'women' : 'general');
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || (isAr ? 'تعذر تحميل بيانات التجديد.' : 'Could not load renewal details.'));
      });

    return () => {
      cancelled = true;
    };
  }, [renewalId, isAuthenticated, user?.role, toast, isAr]);

  const serverPlans = useMemo(
    () => new Map((catalog?.plans || []).map((plan) => [plan.key, plan])),
    [catalog]
  );

  const packageOptions = Array.isArray(catalog?.sessionPacks) && catalog.sessionPacks.length
    ? catalog.sessionPacks
    : [4, 8, 12, 24];

  const plans = useMemo(() => PLAN_DEFS.map((plan) => {
    const serverPlan = serverPlans.get(plan.id);
    const price = serverPlan ? serverPlan.pricePerSessionMinor / 100 : plan.price;
    const minStudents = serverPlan?.minStudents;
    const maxStudents = serverPlan?.maxStudents;

    return {
      ...plan,
      price,
      studentsAr: minStudents && maxStudents
        ? (minStudents === maxStudents ? `${minStudents === 1 ? 'طالب واحد' : minStudents + ' طلاب'}` : `من ${minStudents} إلى ${maxStudents} طالب`)
        : plan.studentsAr,
      studentsEn: minStudents && maxStudents
        ? (minStudents === maxStudents ? `${minStudents} student` : `${minStudents}–${maxStudents} students`)
        : plan.studentsEn,
      durationAr: serverPlan?.durationLabel?.ar || plan.durationAr,
      durationEn: serverPlan?.durationLabel?.en || plan.durationEn,
      packageTotal: price * sessionCount,
    };
  }), [serverPlans, sessionCount]);

  const visiblePlans = renewalSource
    ? plans.filter((plan) => plan.id === renewalSource.planKey)
    : plans;

  const handlePlanSelect = async (plan) => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const returnTo = localizedPath('/plans', locale);
      navigate(localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(returnTo));
      return;
    }

    if (user?.role !== 'student') {
      toast.warning(isAr ? 'اختيار باقات الطلاب متاح من حساب الطالب.' : 'Student packages can only be selected from a student account.');
      return;
    }

    setSelectingPlan(plan.id);
    try {
      const data = renewalSource
        ? await api.post(
            '/api/subscriptions/' + encodeURIComponent(renewalSource._id) + '/renew',
            { sessionCount },
            { auth: true }
          )
        : await api.post('/api/subscriptions/select', {
            planKey: plan.id,
            section: enrolledSection || (audience === 'women' ? 'ladies' : 'men_children'),
            sessionCount,
          }, { auth: true });

      setSelection(data.subscription || null);
      toast.success(
        renewalSource
          ? (isAr
              ? 'تم إنشاء التجديد بنفس المعلم والجروب. أكمل التحويل.'
              : 'Renewal created for the same tutor and group. Complete the transfer.')
          : (isAr
              ? 'تم حفظ اختيارك. اختر الشيخ ثم ارفع إثبات التحويل.'
              : 'Your selection is saved. Choose your tutor, then upload the transfer proof.')
      );

      if (data.subscription?._id) {
        navigate(
          localizedPath('/payment/manual', locale)
          + '?subscription='
          + encodeURIComponent(data.subscription._id)
        );
      }
    } catch (error) {
      toast.error(error.message || (isAr ? 'تعذر حفظ اختيار الباقة.' : 'Could not save the package selection.'));
    } finally {
      setSelectingPlan('');
    }
  };

  const pageTitle = isAr
    ? 'خطط الاشتراك | أكاديمية وحي ونماء'
    : 'Subscription Plans | Wahy Wa Namaa Academy';

  return (
    <>
      <SEOHead
        page={{
          title: pageTitle,
          description: isAr
            ? 'خطط مرنة لتعلّم القرآن تبدأ من 10 جنيه للحصة مع حلقات جماعية، مجموعات مركزة، وحصص فردية، وقسم سيدات مستقل.'
            : 'Flexible Quran learning plans starting from 10 EGP per session, with group, focused, private, and women-only learning options.',
          url: '/plans',
          type: 'website',
        }}
      />
      <GlobalHeader />

      <main className="wn-plans-page">
        <section className="wn-plans-hero">
          <div className="wn-plans-hero__glow" aria-hidden="true" />
          <div className="wn-plans-container wn-plans-hero__grid">
            <div className="wn-plans-hero__copy">
              <span className="wn-plans-kicker"><Sparkles size={16} /> {isAr ? 'خطط تناسب كل بيت' : 'Plans for every learner'}</span>
              <h1>{isAr ? 'ابدأ رحلتك مع القرآن من 10 جنيه للحصة' : 'Start your Quran journey from 10 EGP per session'}</h1>
              <p>
                {isAr
                  ? 'كلما صغر حجم الحلقة زاد وقت المتابعة والتسميع لكل طالب. اختر المستوى الذي يناسب ميزانيتك واحتياجك.'
                  : 'Smaller circles give each learner more recitation and tutor attention. Choose the balance that fits your goals and budget.'}
              </p>
              <div className="wn-plans-hero__proof">
                <span><ShieldCheck size={18} /> {isAr ? 'معلمون ومعلمات معتمدون' : 'Approved tutors'}</span>
                <span><BookOpenCheck size={18} /> {isAr ? 'حفظ وتجويد وتأسيس' : 'Hifz, Tajweed & foundation'}</span>
                <span><Clock3 size={18} /> {isAr ? 'مدة مرنة حسب نوع الخطة' : 'Flexible duration by plan'}</span>
              </div>
            </div>

            <div className="wn-plans-hero__visual">
              <img
                src={audience === 'women' ? '/images/plans/plan-women.svg' : '/images/plans/plan-community.svg'}
                alt={isAr
                  ? (audience === 'women' ? 'حلقة قرآن لقسم السيدات' : 'طلاب في حلقة قرآن جماعية')
                  : (audience === 'women' ? 'Women Quran learning circle' : 'Students in a group Quran circle')}
              />
              <div className="wn-plans-hero__price">
                <small>{isAr ? 'تبدأ من' : 'Starting at'}</small>
                <strong>10 <em>{isAr ? 'جنيه' : 'EGP'}</em></strong>
                <span>{isAr ? 'للحصة' : 'per session'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="wn-plans-control-shell">
          <div className="wn-plans-container">
            <div className="wn-plans-controls">
              <div className="wn-plans-segment" role="tablist" aria-label={isAr ? 'اختيار القسم' : 'Choose section'}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={audience === 'general'}
                  className={audience === 'general' ? 'is-active' : ''}
                  disabled={Boolean(renewalSource) || enrolledSection === 'ladies'}
                  onClick={() => !renewalSource && !enrolledSection && setAudience('general')}
                >
                  <Users size={18} />
                  <span>
                    <strong>{isAr ? 'قسم الرجال والأطفال' : 'Men & children'}</strong>
                    <small>{isAr ? 'رجال وأطفال حسب العمر والمستوى' : 'Men and children by age and level'}</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={audience === 'women'}
                  className={audience === 'women' ? 'is-active is-women' : 'is-women'}
                  disabled={Boolean(renewalSource) || enrolledSection === 'men_children'}
                  onClick={() => !renewalSource && !enrolledSection && setAudience('women')}
                >
                  <Heart size={18} />
                  <span>
                    <strong>{isAr ? 'قسم السيدات' : 'Women’s section'}</strong>
                    <small>{isAr ? 'معلمات متخصصات وبيئة مريحة' : 'Female tutors in a comfortable environment'}</small>
                  </span>
                </button>
              </div>

              <div className="wn-plans-frequency" aria-label={isAr ? 'عدد الحصص في الباقة' : 'Sessions in package'}>
                <span>{isAr ? 'عدد الحصص' : 'Sessions'}</span>
                {packageOptions.map((count) => (
                  <button
                    type="button"
                    key={count}
                    className={sessionCount === count ? 'is-active' : ''}
                    onClick={() => setSessionCount(count)}
                  >
                    {count} {isAr ? (count === 12 ? 'حصة' : 'حصص') : 'sessions'}
                  </button>
                ))}
              </div>
            </div>

            {renewalSource && (
              <aside className="wn-plans-selection" role="status">
                <BadgeCheck size={22} />
                <div>
                  <strong>{isAr ? 'تجديد سريع لنفس الحلقة' : 'Fast renewal for the same circle'}</strong>
                  <p>
                    {isAr
                      ? 'الخطة والمعلم والجروب ثابتون. اختر فقط عدد الحصص الجديدة ثم أكمل التحويل.'
                      : 'Plan, tutor, and group stay the same. Choose only the new session count, then complete the transfer.'}
                  </p>
                </div>
              </aside>
            )}

            {selection && (
              <aside className="wn-plans-selection" role="status">
                <BadgeCheck size={22} />
                <div>
                  <strong>{isAr ? 'تم حفظ اختيار الباقة' : 'Package selection saved'}</strong>
                  <p>
                    {isAr
                      ? `${selection.sessionCount} حصة · الإجمالي ${selection.totalAmountMinor / 100} جنيه · لم يتم الدفع بعد`
                      : `${selection.sessionCount} sessions · total ${selection.totalAmountMinor / 100} EGP · payment not completed`}
                  </p>
                </div>
              </aside>
            )}

            {audience === 'women' && (
              <aside className="wn-plans-women-banner">
                <div className="wn-plans-women-banner__icon"><Heart size={24} /></div>
                <div>
                  <span>{isAr ? 'قسم السيدات' : 'Women’s section'}</span>
                  <h2>{isAr ? 'نفس الخطط والأسعار — مع معلمات فقط' : 'Same plans and pricing — female tutors only'}</h2>
                  <p>{isAr ? 'يتم توزيع الطالبات حسب السن والمستوى، مع الحفاظ على الخصوصية وجودة المتابعة.' : 'Learners are grouped by age and level with privacy and consistent academic follow-up.'}</p>
                </div>
                <img src="/images/plans/plan-women.svg" alt="" aria-hidden="true" />
              </aside>
            )}
          </div>
        </section>

        <section className="wn-plans-catalog">
          <div className="wn-plans-container">
            <div className="wn-plans-heading">
              <span>{isAr ? '5 خطط واضحة' : '5 clear plans'}</span>
              <h2>{isAr ? 'كلما قل العدد، زادت المتابعة' : 'Fewer learners. More tutor attention.'}</h2>
              <p>{isAr ? 'السعر المعروض هو سعر الطالب للحصة الواحدة. اختر 4 أو 8 أو 12 أو 24 حصة، وسيظهر إجمالي الباقة تلقائيًا.' : 'Prices are per learner, per session. Choose 4, 8, 12, or 24 sessions and the package total updates automatically.'}</p>
            </div>

            <div className="wn-plans-grid">
              {visiblePlans.map((plan) => (
                <article key={plan.id} className={'wn-plan-card is-' + plan.tone + (plan.featured ? ' is-featured' : '')}>
                  <div className="wn-plan-card__media">
                    <img src={plan.image} alt={isAr ? plan.nameAr : plan.nameEn} loading="lazy" />
                    <span className="wn-plan-card__badge">{isAr ? plan.badgeAr : plan.badgeEn}</span>
                  </div>

                  <div className="wn-plan-card__body">
                    <div className="wn-plan-card__title">
                      <div>
                        <span>{isAr ? plan.studentsAr : plan.studentsEn}</span>
                        <h3>{isAr ? plan.nameAr : plan.nameEn}</h3>
                      </div>
                      {plan.featured ? <Crown size={22} /> : <BadgeCheck size={21} />}
                    </div>

                    <div className="wn-plan-card__duration">
                      <Clock3 size={15} />
                      <span>{isAr ? 'مدة الحصة:' : 'Session duration:'}</span>
                      <strong>{isAr ? plan.durationAr : plan.durationEn}</strong>
                    </div>

                    <div className="wn-plan-card__price">
                      <span>{isAr ? (plan.from ? 'من' : '') : (plan.from ? 'from' : '')}</span>
                      <strong>{plan.price}</strong>
                      <div>
                        <b>{isAr ? 'جنيه' : 'EGP'}</b>
                        <small>{isAr ? '/ الحصة' : '/ session'}</small>
                      </div>
                    </div>

                    <div className="wn-plan-card__monthly">
                      <span>{sessionCount} {isAr ? (sessionCount === 12 ? 'حصة في الباقة' : 'حصص في الباقة') : 'sessions in package'}</span>
                      <strong>{plan.from && (isAr ? 'من ' : 'from ')}{plan.packageTotal} {isAr ? 'ج' : 'EGP'}</strong>
                    </div>

                    <ul>
                      {(isAr ? plan.featuresAr : plan.featuresEn).map((feature) => (
                        <li key={feature}><Check size={15} /> {feature}</li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="wn-plan-card__cta"
                      onClick={() => handlePlanSelect(plan)}
                      disabled={selectingPlan === plan.id}
                    >
                      {selectingPlan === plan.id
                        ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                        : renewalSource
                          ? (isAr ? 'تجديد الباقة' : 'Renew package')
                          : (isAr ? 'اختيار الخطة' : 'Choose plan')}
                      <ArrowIcon size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {visiblePlans.length > 1 && (
              <div className="wn-plans-compare">
                <div className="wn-plans-compare__header">
                  <h3>{isAr ? 'جدول المقارنة السريع بين الخطط' : 'Quick Plan Comparison'}</h3>
                  <p>{isAr ? 'مقارنة شاملة حسب عدد الطلاب ومدة الحصة والتكلفة الإجمالية للباقة المختارة.' : 'Side-by-side comparison of group size, session duration, and package total.'}</p>
                </div>
                <div className="wn-plans-compare__scroll">
                  <table className="wn-plans-compare__table">
                    <thead>
                      <tr>
                        <th>{isAr ? 'الخطة' : 'Plan'}</th>
                        <th>{isAr ? 'عدد الطلاب' : 'Group size'}</th>
                        <th>{isAr ? 'مدة الحصة' : 'Session duration'}</th>
                        <th>{isAr ? 'سعر الحصة' : 'Per session'}</th>
                        <th>{isAr ? `إجمالي (${sessionCount} ${sessionCount === 12 ? 'حصة' : 'حصص'})` : `Total (${sessionCount} sessions)`}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlans.map((plan) => (
                        <tr key={plan.id} className={plan.featured ? 'is-featured' : ''}>
                          <td>
                            <div className="wn-plans-compare__plan-name">
                              <span>{isAr ? plan.nameAr : plan.nameEn}</span>
                              <span className="wn-plans-compare__tag">{isAr ? plan.badgeAr : plan.badgeEn}</span>
                            </div>
                          </td>
                          <td>{isAr ? plan.studentsAr : plan.studentsEn}</td>
                          <td>{isAr ? plan.durationAr : plan.durationEn}</td>
                          <td><strong>{plan.from ? (isAr ? 'من ' : 'from ') : ''}{plan.price} {isAr ? 'ج' : 'EGP'}</strong></td>
                          <td><strong>{plan.from ? (isAr ? 'من ' : 'from ') : ''}{plan.packageTotal} {isAr ? 'ج' : 'EGP'}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="wn-plans-note">
              <UserRound size={21} />
              <div>
                <strong>{isAr ? 'التسكين حسب المستوى والعمر' : 'Placement by level and age'}</strong>
                <p>{isAr ? 'بعد الحصة التجريبية نرشح الحلقة الأنسب للطالب. الحلقة الاقتصادية 10 جنيه تبدأ عند اكتمال الحد الأدنى المناسب للتشغيل.' : 'After the trial, we recommend the best-fit circle. The 10 EGP community plan starts once the minimum viable group is formed.'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="wn-plans-bottom-cta">
          <div className="wn-plans-container">
            <div>
              <span>{isAr ? 'لسه محتار؟' : 'Not sure yet?'}</span>
              <h2>{isAr ? 'ابدأ بالتجربة، وبعدها نرشح لك الخطة الأنسب' : 'Start with a trial, then we recommend the best plan'}</h2>
            </div>
            <LocalizedLink to="/teachers" locale={locale} className="wn-plans-bottom-cta__button">
              {isAr ? 'اختيار معلم' : 'Choose a tutor'}
              <ArrowIcon size={18} />
            </LocalizedLink>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
