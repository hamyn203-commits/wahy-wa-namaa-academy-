import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  HeartHandshake,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
  Baby,
  GraduationCap,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import './start.css';

const validSections = ['men', 'women'];

const START_COPY = {
  ar: {
    seoTitle: 'ابدأ معنا | أكاديمية وَحْيٌ وَنَمَاء',
    seoDesc: 'اختر قسم الرجال والأطفال أو قسم السيدات، ثم سجل كطالب أو ولي أمر.',
    brand: 'وَحْيٌ وَنَمَاء',
    progressLabel: 'مراحل بدء التسجيل',
    welcome: 'الترحيب',
    sectionStep: 'القسم',
    accountStep: '٣. نوع الحساب',
    eyebrow: 'خطوة بسيطة نحو رحلة مباركة',
    heroTitleA: 'ابدأ معنا، ',
    heroTitleEm: 'واختر قسمك',
    welcomePrefix: 'أهلًا بك في ',
    heroDesc: 'اختر القسم المناسب أولًا، وبعدها نساعدك على إنشاء حسابك كطالب أو ولي أمر بخطوات واضحة.',
    roleDesc: 'الآن اختر طريقة الانضمام. هل ستتعلم بنفسك أم ستتابع تعليم أبنائك؟',
    chooseSectionAria: 'اختيار قسم الدراسة',
    chooseSectionBtn: 'اختيار هذا القسم',
    menTitle: 'قسم الرجال والأطفال',
    menDesc: 'مسار للرجال والأولاد، مع برامج تأسيس وحفظ وتجويد تناسب المراحل العمرية.',
    menDetail: 'الرجال • الأولاد',
    womenTitle: 'قسم السيدات',
    womenDesc: 'مسار للسيدات والبنات مع معلمات متخصصات وتجربة تعليمية مناسبة.',
    womenDetail: 'السيدات • البنات',
    selectedSection: 'القسم المختار:',
    changeSection: 'تغيير القسم',
    chooseAccountAria: 'اختيار نوع الحساب',
    learnerAccount: 'حساب متعلم',
    iAmStudentM: 'أنا طالب',
    iAmStudentF: 'أنا طالبة',
    studentDesc: 'سجل بياناتك وابدأ رحلة تعلم القرآن مع المسار الذي يناسب مستواك.',
    registerStudentM: 'التسجيل كطالب',
    registerStudentF: 'التسجيل كطالبة',
    familyAccount: 'حساب أسرة',
    iAmParent: 'أنا ولي أمر',
    parentDesc: 'أنشئ حساب ولي أمر لمتابعة الأبناء وتقارير الحضور والتقدم التعليمي.',
    registerParent: 'التسجيل كولي أمر',
    childTip: 'لو التسجيل لطفل، يفضل إنشاء حساب ولي الأمر أولًا لمتابعة رحلة الطفل.',
    freeTrialCta: 'تريد تجربة حصة مجانية أولًا بدون حساب؟',
    plansCta: 'استعرض الباقات وجدول المقارنة',
    existingPrompt: 'عندك حساب بالفعل؟',
    signIn: 'سجّل الدخول',
  },
  en: {
    seoTitle: 'Get Started | Wahy Wa Namaa Academy',
    seoDesc: 'Choose your section, then join as a student or a parent.',
    brand: 'WAHY WA NAMAA',
    progressLabel: 'Enrollment steps',
    welcome: 'Welcome',
    sectionStep: 'Section',
    accountStep: '3. Account',
    eyebrow: 'A clear beginning to your journey',
    heroTitleA: 'Start with us, ',
    heroTitleEm: 'choose your section',
    welcomePrefix: 'Welcome to ',
    heroDesc: 'Choose the section that suits you. Then create a student or parent account in a few clear steps.',
    roleDesc: 'Now choose how to join. Are you learning, or managing a child’s learning?',
    chooseSectionAria: 'Choose learning section',
    chooseSectionBtn: 'Choose this section',
    menTitle: 'Men & children',
    menDesc: 'Quran learning for men and boys, with age-appropriate memorization and tajweed.',
    menDetail: 'Men • boys',
    womenTitle: 'Women & girls',
    womenDesc: 'Dedicated learning for women and girls with female tutors.',
    womenDetail: 'Women • girls',
    selectedSection: 'Selected section:',
    changeSection: 'Change',
    chooseAccountAria: 'Choose account type',
    learnerAccount: 'Learner account',
    iAmStudentM: 'I am a student',
    iAmStudentF: 'I am a student',
    studentDesc: 'Create your account and begin a learning path tailored to your level.',
    registerStudentM: 'Register as student',
    registerStudentF: 'Register as student',
    familyAccount: 'Parent account',
    iAmParent: 'I am a parent',
    parentDesc: 'Set up a parent account to follow your children’s lessons and progress.',
    registerParent: 'Register as parent',
    childTip: 'For a child, consider creating the parent account first to manage their learning.',
    freeTrialCta: 'Want a free trial class first?',
    plansCta: 'Compare study plans & pricing',
    existingPrompt: 'Already have an account?',
    signIn: 'Sign in',
  },
  fr: {
    seoTitle: 'Commencer | Académie Wahy Wa Namaa',
    eyebrow: 'Un début clair pour votre parcours',
    heroTitleA: 'Commencez avec nous, ',
    heroTitleEm: 'choisissez votre section',
    welcomePrefix: 'Bienvenue dans ',
    menTitle: 'Section Hommes & Enfants',
    womenTitle: 'Section Femmes & Filles',
    chooseSectionBtn: 'Choisir cette section',
    changeSection: 'Modifier',
    iAmStudentM: 'Je suis élève',
    iAmStudentF: 'Je suis élève',
    iAmParent: 'Je suis parent',
    registerStudentM: 'S’inscrire comme élève',
    registerStudentF: 'S’inscrire comme élève',
    registerParent: 'S’inscrire comme parent',
    freeTrialCta: 'Vous souhaitez d’abord un cours d’essai gratuit ?',
    plansCta: 'Comparer les forfaits et tarifs',
    existingPrompt: 'Déjà un compte ?',
    signIn: 'Se connecter',
  },
  de: {
    seoTitle: 'Starten | Wahy Wa Namaa Akademie',
    eyebrow: 'Ein klarer Beginn Ihrer Lernreise',
    heroTitleA: 'Starten Sie mit uns, ',
    heroTitleEm: 'Bereich wählen',
    welcomePrefix: 'Willkommen bei ',
    menTitle: 'Männer & Kinder',
    womenTitle: 'Frauen & Mädchen',
    chooseSectionBtn: 'Bereich wählen',
    changeSection: 'Ändern',
    iAmStudentM: 'Ich bin Schüler',
    iAmStudentF: 'Ich bin Schülerin',
    iAmParent: 'Ich bin Elternteil',
    registerStudentM: 'Als Schüler registrieren',
    registerStudentF: 'Als Schülerin registrieren',
    registerParent: 'Als Elternteil registrieren',
    freeTrialCta: 'Zuerst eine kostenlose Probestunde testen?',
    plansCta: 'Pläne & Preise vergleichen',
    existingPrompt: 'Schon ein Konto?',
    signIn: 'Anmelden',
  },
  tr: {
    seoTitle: 'Başlayın | Wahy Wa Namaa Akademisi',
    eyebrow: 'Yolculuğunuza net bir başlangıç',
    heroTitleA: 'Bizimle başlayın, ',
    heroTitleEm: 'bölümünüzü seçin',
    welcomePrefix: 'Hoş geldiniz: ',
    menTitle: 'Erkekler ve Çocuklar',
    womenTitle: 'Hanımlar ve Kız Çocukları',
    chooseSectionBtn: 'Bu bölümü seç',
    changeSection: 'Değiştir',
    iAmStudentM: 'Öğrenciyim',
    iAmStudentF: 'Öğrenciyim',
    iAmParent: 'Veliyim',
    registerStudentM: 'Öğrenci olarak kaydol',
    registerStudentF: 'Öğrenci olarak kaydol',
    registerParent: 'Veli olarak kaydol',
    freeTrialCta: 'Önce ücretsiz deneme dersi ister misiniz?',
    plansCta: 'Planları ve fiyatları karşılaştırın',
    existingPrompt: 'Zaten hesabınız var mı?',
    signIn: 'Giriş yap',
  },
  ur: {
    seoTitle: 'آغاز کریں | وحی و نما اکیڈمی',
    eyebrow: 'بابرکت سفر کی ایک آسان شروعات',
    heroTitleA: 'ہمارے ساتھ شروع کریں، ',
    heroTitleEm: 'اپنا شعبہ منتخب کریں',
    welcomePrefix: 'خوش آمدید: ',
    menTitle: 'مرد اور بچے',
    womenTitle: 'خواتین اور بچیاں',
    chooseSectionBtn: 'یہ شعبہ منتخب کریں',
    changeSection: 'تبدیل کریں',
    iAmStudentM: 'میں طالب علم ہوں',
    iAmStudentF: 'میں طالبہ ہوں',
    iAmParent: 'میں سرپرست ہوں',
    registerStudentM: 'بطور طالب علم رجسٹر ہوں',
    registerStudentF: 'بطور طالبہ رجسٹر ہوں',
    registerParent: 'بطور سرپرست رجسٹر ہوں',
    freeTrialCta: 'کیا آپ پہلے مفت آزمائشی کلاس لینا چاہتے ہیں؟',
    plansCta: 'پیکجز اور قیمتوں کا موازنہ دیکھیں',
    existingPrompt: 'پہلے سے اکاؤنٹ موجود ہے؟',
    signIn: 'لاگ ان کریں',
  },
  id: {
    seoTitle: 'Mulai | Akademi Wahy Wa Namaa',
    eyebrow: 'Awal yang jelas untuk perjalanan Anda',
    heroTitleA: 'Mulai bersama kami, ',
    heroTitleEm: 'pilih bagian Anda',
    welcomePrefix: 'Selamat datang di ',
    menTitle: 'Putra & Anak',
    womenTitle: 'Muslimah & Putri',
    chooseSectionBtn: 'Pilih bagian ini',
    changeSection: 'Ubah',
    iAmStudentM: 'Saya siswa',
    iAmStudentF: 'Saya siswi',
    iAmParent: 'Saya wali/orang tua',
    registerStudentM: 'Daftar sebagai siswa',
    registerStudentF: 'Daftar sebagai siswi',
    registerParent: 'Daftar sebagai wali',
    freeTrialCta: 'Ingin mencoba kelas gratis terlebih dahulu?',
    plansCta: 'Bandingkan paket & harga',
    existingPrompt: 'Sudah punya akun?',
    signIn: 'Masuk',
  },
  ms: {
    seoTitle: 'Mula | Akademi Wahy Wa Namaa',
    eyebrow: 'Permulaan yang jelas untuk perjalanan anda',
    heroTitleA: 'Mulakan bersama kami, ',
    heroTitleEm: 'pilih bahagian anda',
    welcomePrefix: 'Selamat datang ke ',
    menTitle: 'Lelaki & Kanak-Kanak',
    womenTitle: 'Wanita & Puteri',
    chooseSectionBtn: 'Pilih bahagian ini',
    changeSection: 'Tukar',
    iAmStudentM: 'Saya pelajar',
    iAmStudentF: 'Saya pelajar',
    iAmParent: 'Saya penjaga',
    registerStudentM: 'Daftar sebagai pelajar',
    registerStudentF: 'Daftar sebagai pelajar',
    registerParent: 'Daftar sebagai penjaga',
    freeTrialCta: 'Ingin cuba kelas percuma dahulu?',
    plansCta: 'Bandingkan pelan & harga',
    existingPrompt: 'Sudah mempunyai akaun?',
    signIn: 'Log masuk',
  },
  ku: {
    seoTitle: 'دەست پێبکە | ئەکادیمیای وەحی و نەما',
    eyebrow: 'هەنگاوێکی سادە بەرەو گەشتێکی پیرۆز',
    heroTitleA: 'لەگەڵمان دەست پێبکە، ',
    heroTitleEm: 'بەشەکەت هەڵبژێرە',
    welcomePrefix: 'بەخێربێیت بۆ ',
    menTitle: 'بەشی پیاوان و منداڵان',
    womenTitle: 'بەشی خانمان',
    chooseSectionBtn: 'ئەم بەشە هەڵبژێرە',
    changeSection: 'گۆڕین',
    iAmStudentM: 'من فێرخوازێکم',
    iAmStudentF: 'من فێرخوازێکی کچم',
    iAmParent: 'من بەخێوکارم',
    registerStudentM: 'تۆماربوون وەک فێرخواز',
    registerStudentF: 'تۆماربوون وەک فێرخواز',
    registerParent: 'تۆماربوون وەک بەخێوکار',
    freeTrialCta: 'دەتەوێت سەرەتا وانەیەکی تاقیکاری خۆڕایی تاقیبکەیتەوە؟',
    plansCta: 'پێداچوونەوەی پلان و نرخەکان',
    existingPrompt: 'پێشتر هەژمارت هەیە؟',
    signIn: 'چوونەژوورەوە',
  },
};

export default function StartPage() {
  const { locale, isRTL, dir } = useI18n();
  const baseCopy = isRTL ? START_COPY.ar : START_COPY.en;
  const copy = { ...baseCopy, ...(START_COPY[locale] || {}) };
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState(() => validSections.includes(searchParams.get('section')) ? searchParams.get('section') : '');
  const lp = (path) => localizedPath(path, locale);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const ChangeChevron = isRTL ? ChevronLeft : ChevronRight;
  const contentRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [section]);

  const sections = [
    {
      id: 'men',
      title: copy.menTitle,
      description: copy.menDesc,
      detail: copy.menDetail,
      icon: GraduationCap,
      className: 'wn-start-choice--men',
    },
    {
      id: 'women',
      title: copy.womenTitle,
      description: copy.womenDesc,
      detail: copy.womenDetail,
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
        title: copy.seoTitle,
        description: copy.seoDesc,
        url: '/start',
      }} />
      <GlobalHeader />
      <main className="wn-start-page" dir={dir}>
        <div className="wn-start-halo wn-start-halo--first" aria-hidden="true" />
        <div className="wn-start-halo wn-start-halo--second" aria-hidden="true" />
        <div className="page-container wn-start-content" ref={contentRef} style={{ scrollMarginTop: '6rem' }}>
          <div className="wn-start-top">
            <div className="wn-start-mark"><BookOpenCheck size={21} strokeWidth={1.8} aria-hidden="true" /><span>{copy.brand}</span></div>
            <div className="wn-start-progress" aria-label={copy.progressLabel}>
              <span className="is-done"><Check size={13} aria-hidden="true" /> {copy.welcome}</span>
              <span className={section ? 'is-done' : 'is-active'}>{section ? <Check size={13} aria-hidden="true" /> : '2.'} {copy.sectionStep}</span>
              <span className={section ? 'is-active' : ''}>{copy.accountStep}</span>
            </div>
          </div>

          <div className="wn-start-intro" key={section ? 'roles' : 'sections'}>
            <span className="wn-start-eyebrow"><Sparkles size={15} aria-hidden="true" /> {copy.eyebrow}</span>
            <h1>{!section
              ? <>{copy.heroTitleA}<em>{copy.heroTitleEm}</em></>
              : <>{copy.welcomePrefix}<em>{current.title}</em></>}</h1>
            <p>{!section ? copy.heroDesc : copy.roleDesc}</p>
          </div>

          {!section ? (
            <div className="wn-start-grid" aria-label={copy.chooseSectionAria}>
              {sections.map(({ id, title, description, detail, icon: Icon, className }) => (
                <button className={'wn-start-choice ' + className} key={id} type="button" onClick={() => setSection(id)}>
                  <span className="wn-start-choice__symbol" aria-hidden="true"><Icon size={34} strokeWidth={1.4} /></span>
                  <span className="wn-start-choice__detail">{detail}</span>
                  <strong>{title}</strong>
                  <span className="wn-start-choice__description">{description}</span>
                  <span className="wn-start-choice__action">{copy.chooseSectionBtn} <ArrowIcon size={17} aria-hidden="true" /></span>
                  <span className="wn-start-choice__ornament" aria-hidden="true">✦</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="wn-start-summary">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>{copy.selectedSection} <strong>{current.title}</strong></span>
                <button type="button" onClick={() => setSection('')}>{copy.changeSection} <ChangeChevron size={14} aria-hidden="true" /></button>
              </div>
              <div className="wn-start-grid wn-start-grid--roles" aria-label={copy.chooseAccountAria}>
                <Link to={registrationLink('student')} className="wn-start-choice wn-start-choice--student">
                  <span className="wn-start-choice__symbol" aria-hidden="true"><UserRound size={32} strokeWidth={1.5} /></span>
                  <span className="wn-start-choice__detail">{copy.learnerAccount}</span>
                  <strong>{section === 'women' ? copy.iAmStudentF : copy.iAmStudentM}</strong>
                  <span className="wn-start-choice__description">{copy.studentDesc}</span>
                  <span className="wn-start-choice__action">{section === 'women' ? copy.registerStudentF : copy.registerStudentM} <ArrowIcon size={17} aria-hidden="true" /></span>
                </Link>
                <Link to={registrationLink('guardian')} className="wn-start-choice wn-start-choice--guardian">
                  <span className="wn-start-choice__symbol" aria-hidden="true"><Users size={32} strokeWidth={1.5} /></span>
                  <span className="wn-start-choice__detail">{copy.familyAccount}</span>
                  <strong>{copy.iAmParent}</strong>
                  <span className="wn-start-choice__description">{copy.parentDesc}</span>
                  <span className="wn-start-choice__action">{copy.registerParent} <ArrowIcon size={17} aria-hidden="true" /></span>
                </Link>
              </div>
              <div className="wn-start-helper"><Baby size={17} aria-hidden="true" /><span>{copy.childTip}</span></div>
            </>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-3xl mx-auto">
            <Link
              to={lp('/free-trial')}
              className="min-h-[44px] flex items-center justify-between gap-3 rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-4 py-3 text-sm font-bold text-[var(--wn-heading)] shadow-sm hover:border-[var(--wn-gold)] transition"
            >
              <span className="inline-flex items-center gap-2">
                <Gift size={16} className="text-[var(--wn-text-gold)] shrink-0" aria-hidden="true" />
                <span>{copy.freeTrialCta}</span>
              </span>
              <ArrowIcon size={15} className="shrink-0" aria-hidden="true" />
            </Link>
            <Link
              to={lp('/plans')}
              className="min-h-[44px] flex items-center justify-between gap-3 rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-4 py-3 text-sm font-bold text-[var(--wn-heading)] shadow-sm hover:border-[var(--wn-emerald)] transition"
            >
              <span className="inline-flex items-center gap-2">
                <ListChecks size={16} className="text-[var(--wn-link)] shrink-0" aria-hidden="true" />
                <span>{copy.plansCta}</span>
              </span>
              <ArrowIcon size={15} className="shrink-0" aria-hidden="true" />
            </Link>
          </div>

          <p className="wn-start-existing">{copy.existingPrompt} <Link to={lp('/login')}>{copy.signIn} <ArrowIcon size={14} aria-hidden="true" /></Link></p>
        </div>
      </main>
      <GlobalFooter />
    </>
  );
}
