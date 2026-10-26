import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, HeartHandshake, ShieldCheck, Sparkles, Users, UserRound, Baby, GraduationCap } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import './start.css';

const validSections = ['men', 'women'];

export default function StartPage() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState(() => validSections.includes(searchParams.get('section')) ? searchParams.get('section') : '');
  const lp = (path) => localizedPath(path, locale);
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const sections = [
    {
      id: 'men',
      title: isAr ? 'قسم الرجال والأطفال' : 'Men & children',
      description: isAr ? 'مسار للرجال والأولاد، مع برامج تأسيس وحفظ وتجويد تناسب المراحل العمرية.' : 'Quran learning for men and boys, with age-appropriate memorization and tajweed.',
      detail: isAr ? 'الرجال • الأولاد' : 'Men • boys',
      icon: GraduationCap,
      className: 'wn-start-choice--men',
    },
    {
      id: 'women',
      title: isAr ? 'قسم السيدات' : 'Women & girls',
      description: isAr ? 'مسار للسيدات والبنات مع معلمات متخصصات وتجربة تعليمية مناسبة.' : 'Dedicated learning for women and girls with female tutors.',
      detail: isAr ? 'السيدات • البنات' : 'Women • girls',
      icon: HeartHandshake,
      className: 'wn-start-choice--women',
    },
  ];
  const current = sections.find((item) => item.id === section);
  const registrationLink = (role) => {
    const params = new URLSearchParams({ section });
    return lp('/register/' + role) + '?' + params.toString();
  };

  return (
    <>
      <SEOHead page={{
        title: isAr ? 'ابدأ معنا | أكاديمية وَحْيٌ وَنَمَاء' : 'Get Started | Wahy Wa Namaa Academy',
        description: isAr ? 'اختر قسم الرجال والأطفال أو قسم السيدات، ثم سجل كطالب أو ولي أمر.' : 'Choose your section, then join as a student or a parent.',
        url: '/start',
      }} />
      <GlobalHeader />
      <main className="wn-start-page" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="wn-start-halo wn-start-halo--first" aria-hidden="true" />
        <div className="wn-start-halo wn-start-halo--second" aria-hidden="true" />
        <div className="page-container wn-start-content">
          <div className="wn-start-top">
            <div className="wn-start-mark"><BookOpenCheck size={21} strokeWidth={1.8} /><span>{isAr ? 'وَحْيٌ وَنَمَاء' : 'WAHY WA NAMAA'}</span></div>
            <div className="wn-start-progress" aria-label={isAr ? 'مراحل بدء التسجيل' : 'Enrollment steps'}>
              <span className="is-done"><Check size={13} /> {isAr ? 'الترحيب' : 'Welcome'}</span>
              <span className={section ? 'is-done' : 'is-active'}>{section ? <Check size={13} /> : '٢'} {isAr ? 'القسم' : 'Section'}</span>
              <span className={section ? 'is-active' : ''}>{isAr ? '٣. نوع الحساب' : '3. Account'}</span>
            </div>
          </div>

          <div className="wn-start-intro" key={section ? 'roles' : 'sections'}>
            <span className="wn-start-eyebrow"><Sparkles size={15} /> {isAr ? 'خطوة بسيطة نحو رحلة مباركة' : 'A clear beginning to your journey'}</span>
            <h1>{!section
              ? (isAr ? <>ابدأ معنا، <em>واختر قسمك</em></> : <>Start with us, <em>choose your section</em></>)
              : (isAr ? <>أهلًا بك في <em>{current.title}</em></> : <>Welcome to <em>{current.title}</em></>)}</h1>
            <p>{!section
              ? (isAr ? 'اختر القسم المناسب أولًا، وبعدها هنساعدك تنشئ حسابك كطالب أو ولي أمر بخطوات واضحة.' : 'Choose the section that suits you. Then create a student or parent account in a few clear steps.')
              : (isAr ? 'الآن اختر طريقة الانضمام. هل ستتعلم بنفسك أم ستتابع تعليم أبنائك؟' : 'Now choose how to join. Are you learning, or managing a child’s learning?')}</p>
          </div>

          {!section ? (
            <div className="wn-start-grid" aria-label={isAr ? 'اختيار قسم الدراسة' : 'Choose learning section'}>
              {sections.map(({ id, title, description, detail, icon: Icon, className }) => (
                <button className={'wn-start-choice ' + className} key={id} type="button" onClick={() => setSection(id)}>
                  <span className="wn-start-choice__symbol" aria-hidden="true"><Icon size={34} strokeWidth={1.4} /></span>
                  <span className="wn-start-choice__detail">{detail}</span>
                  <strong>{title}</strong>
                  <span className="wn-start-choice__description">{description}</span>
                  <span className="wn-start-choice__action">{isAr ? 'اختيار هذا القسم' : 'Choose this section'} <ArrowIcon size={17} /></span>
                  <span className="wn-start-choice__ornament" aria-hidden="true">✦</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="wn-start-summary">
                <ShieldCheck size={18} />
                <span>{isAr ? 'القسم المختار:' : 'Selected section:'} <strong>{current.title}</strong></span>
                <button type="button" onClick={() => setSection('')}>{isAr ? 'تغيير القسم' : 'Change'} <ChevronRight size={14} /></button>
              </div>
              <div className="wn-start-grid wn-start-grid--roles" aria-label={isAr ? 'اختيار نوع الحساب' : 'Choose account type'}>
                <Link to={registrationLink('student')} className="wn-start-choice wn-start-choice--student">
                  <span className="wn-start-choice__symbol" aria-hidden="true"><UserRound size={32} strokeWidth={1.5} /></span>
                  <span className="wn-start-choice__detail">{isAr ? 'حساب متعلم' : 'Learner account'}</span>
                  <strong>{isAr ? 'أنا طالب / طالبة' : 'I am a student'}</strong>
                  <span className="wn-start-choice__description">{isAr ? 'سجل بياناتك وابدأ رحلة تعلم القرآن مع المسار الذي يناسب مستواك.' : 'Create your account and begin a learning path tailored to your level.'}</span>
                  <span className="wn-start-choice__action">{isAr ? 'التسجيل كطالب' : 'Register as student'} <ArrowIcon size={17} /></span>
                </Link>
                <Link to={registrationLink('guardian')} className="wn-start-choice wn-start-choice--guardian">
                  <span className="wn-start-choice__symbol" aria-hidden="true"><Users size={32} strokeWidth={1.5} /></span>
                  <span className="wn-start-choice__detail">{isAr ? 'حساب أسرة' : 'Parent account'}</span>
                  <strong>{isAr ? 'أنا ولي أمر' : 'I am a parent'}</strong>
                  <span className="wn-start-choice__description">{isAr ? 'أنشئ حساب ولي أمر لمتابعة الأبناء وتقارير الحضور والتقدم التعليمي.' : 'Set up a parent account to follow your children’s lessons and progress.'}</span>
                  <span className="wn-start-choice__action">{isAr ? 'التسجيل كولي أمر' : 'Register as parent'} <ArrowIcon size={17} /></span>
                </Link>
              </div>
              <div className="wn-start-helper"><Baby size={17} /><span>{isAr ? 'لو التسجيل لطفل، يفضل إنشاء حساب ولي الأمر أولًا لمتابعة رحلة الطفل.' : 'For a child, consider creating the parent account first to manage their learning.'}</span></div>
            </>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-3xl mx-auto">
            <Link
              to={lp('/free-trial')}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-white/80 px-4 py-3 text-sm font-bold text-emerald-950 shadow-sm hover:border-amber-400 transition"
            >
              <span>{isAr ? '🎁 تريد تجربة حصة مجانية أولاً بدون حساب؟' : '🎁 Want a free trial class first?'}</span>
              <ArrowIcon size={15} />
            </Link>
            <Link
              to={lp('/plans')}
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/70 bg-white/80 px-4 py-3 text-sm font-bold text-emerald-950 shadow-sm hover:border-emerald-400 transition"
            >
              <span>{isAr ? '📋 استعرض الباقات وجدول المقارنة' : '📋 Compare study plans & pricing'}</span>
              <ArrowIcon size={15} />
            </Link>
          </div>

          <p className="wn-start-existing">{isAr ? 'عندك حساب بالفعل؟' : 'Already have an account?'} <Link to={lp('/login')}>{isAr ? 'سجّل الدخول' : 'Sign in'} <ArrowIcon size={14}/></Link></p>
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}
