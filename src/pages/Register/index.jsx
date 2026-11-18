import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Users, Lock, Mail, Phone, Eye, EyeOff, ArrowRight, CheckCircle,
  Sparkles, CheckCircle2, Globe, ArrowLeft, ShieldCheck, ChevronDown, ImagePlus
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import GoogleSignIn from '../../components/GoogleSignIn';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useMarket } from '../../context/MarketProvider';
import { useAuth } from '../../hooks/useAuth.jsx';
import { localizedPath } from '../../lib/locale';
import { dashboardPathForRole, isSafeInternalRedirect, postAuthDestination } from '../../lib/navigation';
import '../../styles/public-experience.css';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useToast } from '../../context/ToastProvider';

const REGISTER_COPY = {
  ar: {
    seoTitle: 'إنشاء حساب',
    brandHeading: 'ابدأ رحلتك القرآنية المباركة',
    brandDesc: 'انضم إلينا اليوم لتتعلم كتاب الله الكريم على يد نخبة من أمهر المعلمين والمعلمات المجازين أونلاين.',
    selectedPlanBadge: 'خطة الدراسة المختارة',
    learningPathLabel: 'المسار التعليمي:',
    groupClass: 'حلقة جماعية',
    privateClass: 'حصة خاصة',
    currentLevelLabel: 'المستوى الحالي:',
    sessionsMonthlyLabel: 'الحصص شهرياً:',
    sessionsUnit: 'حصص',
    estDurationLabel: 'المدة المقدرة:',
    monthlyCostLabel: 'التكلفة الشهرية:',
    egpUnit: 'ج.م',
    perks: [
      'معلمون متخصصون في القرآن والتجويد',
      'جلسات فردية مباشرة وتفاعلية',
      'خطط حفظ ودراسة ذكية ومرنة',
      'شهادات إتمام إلكترونية قابلة للتحقق',
    ],
    trustNote: 'ابدأ بالمعلومات الأساسية فقط، ويمكنك استكمال تفاصيل المسار والمعلم لاحقًا.',
    sectionLabel: 'القسم المختار: ',
    sectionWomen: 'قسم السيدات',
    sectionMen: 'قسم الرجال والأطفال',
    changeSection: 'تغيير القسم',
    studentTab: 'حساب طالب',
    guardianTab: 'حساب ولي أمر',
    guardianTitle: 'إنشاء حساب ولي أمر',
    studentTitle: 'إنشاء حساب طالب',
    guardianSubtitle: 'تابع مسيرة أبنائك في حفظ القرآن وتقارير حضورهم وتقييماتهم',
    studentSubtitle: 'دقيقة واحدة وتبدأ: الاسم والبريد وكلمة المرور تكفي الآن.',
    fullNameLabel: 'الاسم الكامل',
    fullNamePlaceholder: 'أدخل اسمك الكامل',
    emailLabel: 'البريد الإلكتروني',
    guardianPhoneLabel: 'رقم هاتف ولي الأمر',
    studentPhoneLabel: 'رقم الهاتف (اختياري)',
    guardianPhoneNote: 'نستخدم الرقم فقط لمطابقة طلبات ربط أبنائك. لا يتم الربط إلا بعد موافقتك داخل حسابك.',
    studentPhoneNote: 'نحتاجه فقط لتأكيد مواعيد حصصك، ويمكنك إضافته لاحقًا.',
    whatsappSameLabel: 'هذا الرقم عليه واتساب',
    whatsappNumberLabel: 'رقم الواتساب',
    passwordLabel: 'كلمة المرور',
    confirmPasswordLabel: 'تأكيد كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    pwMatch: 'كلمتا المرور متطابقتان',
    pwMismatchYet: 'كلمتا المرور غير متطابقتين بعد',
    pwMismatchErr: 'كلمات المرور غير متطابقة',
    pwLengthErr: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
    pwStrength: {
      1: 'ضعيفة (8 أحرف على الأقل)',
      2: 'متوسطة — أضف أرقاماً أو رموزاً',
      3: 'جيدة وآمنة',
      4: 'قوية جداً وممتازة',
    },
    optionalTitle: 'أضف مستواك وبيانات إضافية الآن',
    optionalBadge: '(اختياري)',
    optionalHint: 'يمكنك تخطي هذه الخطوة واستكمالها لاحقًا من لوحتك.',
    ageLabel: 'العمر',
    genderLabel: 'النوع',
    selectOpt: 'اختر',
    maleOpt: 'ذكر',
    femaleOpt: 'أنثى',
    trackLabel: 'المسار التعليمي',
    trackMem: 'حفظ القرآن',
    trackTaj: 'التجويد والإجازة',
    trackKids: 'تأسيس الأطفال',
    levelLabel: 'مستواك',
    levelBeg: 'مبتدئ',
    levelInt: 'متوسط',
    levelAdv: 'متقدم',
    levelIja: 'طالب إجازة',
    levelOth: 'أخرى — اكتب مستواك',
    customLevelLabel: 'اكتب مستواك',
    memorizedJuzLabel: 'كم جزءًا تحفظ؟ (0 إلى 30)',
    memorizationDetailsLabel: 'تفاصيل الحفظ — السور أو الأجزاء التي تحفظها، أو خطة أخرى',
    memorizationDetailsPlaceholder: 'مثال: أحفظ جزء عم وتبارك، وأريد البدء من سورة البقرة',
    estimateNote: 'اختيارك مبدئي، والمعلم يحدد مستواك الفعلي في الحصة التجريبية.',
    photoLabel: 'الصورة الشخصية (اختيارية)',
    changePhoto: 'تغيير الصورة',
    choosePhoto: 'اختيار صورة',
    photoErr: 'اختر JPG أو PNG بحجم لا يتجاوز 5 ميجابايت',
    photoHint: 'JPG أو PNG بحد أقصى 5 MB.',
    removePhoto: 'إزالة',
    photoWarn: 'تم إنشاء الحساب بنجاح، لكن تعذر حفظ الصورة. يمكنك إضافتها لاحقًا.',
    guardianLinkTitle: 'ربط ولي الأمر',
    guardianLinkDesc: 'اكتب رقم ولي الأمر ليظهر له طلب الربط عندما ينشئ حسابه أو يسجل الدخول. لن يتم الربط تلقائيًا.',
    guardianLinkPhone: 'رقم ولي الأمر',
    relationshipLabel: 'صلة القرابة',
    relFather: 'أب',
    relMother: 'أم',
    relGuardian: 'ولي أمر / وصي',
    relOther: 'صلة أخرى',
    goToLogin: 'الذهاب لتسجيل الدخول',
    submitBtn: 'إنشاء الحساب وبدء الدراسة',
    creatingAccount: 'جاري إنشاء الحساب...',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    signIn: 'تسجيل الدخول',
    backHome: 'العودة للصفحة الرئيسية',
    errNetwork: 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.',
    errRate: 'تمت محاولات تسجيل كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى.',
    errConflict: 'هذا البريد الإلكتروني مسجل بالفعل. سجّل الدخول إلى حسابك، أو استخدم "نسيت كلمة المرور".',
    errServer: 'حدث خطأ مؤقت لدينا أثناء إنشاء الحساب. لم يتم حفظ أي شيء، حاول مرة أخرى بعد قليل.',
    errGeneric: 'تعذر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.',
  },
  en: {
    seoTitle: 'Create account',
    brandHeading: 'Start Your Blessed Quranic Journey',
    brandDesc: 'Join us today to learn the Holy Quran from native certified scholars online at your own schedule.',
    selectedPlanBadge: 'Selected Study Plan',
    learningPathLabel: 'Learning Path:',
    groupClass: 'Group Circle',
    privateClass: 'Private Session',
    currentLevelLabel: 'Current Level:',
    sessionsMonthlyLabel: 'Sessions Monthly:',
    sessionsUnit: 'sessions',
    estDurationLabel: 'Estimated Duration:',
    monthlyCostLabel: 'Monthly Cost:',
    egpUnit: 'EGP',
    perks: [
      'Qualified Quran & Tajweed Tutors',
      'Live 1-on-1 Interactive Classes',
      'Adaptive and Smart Memorization Plans',
      'Verifiable Digital Completion Certificates',
    ],
    trustNote: 'Start with the basics now. You can complete your learning path and teacher preferences later.',
    sectionLabel: 'Learning section: ',
    sectionWomen: 'Women & girls',
    sectionMen: 'Men & children',
    changeSection: 'Change section',
    studentTab: 'Student Account',
    guardianTab: 'Guardian Account',
    guardianTitle: 'Create Guardian Account',
    studentTitle: 'Create Student Account',
    guardianSubtitle: 'Monitor your children’s Quran progress, attendance & teacher reports',
    studentSubtitle: 'One minute to start: name, email and password are enough for now.',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    emailLabel: 'Email Address',
    guardianPhoneLabel: 'Guardian Phone Number',
    studentPhoneLabel: 'Phone Number (Optional)',
    guardianPhoneNote: 'This number is used only to match child-link requests. Nothing is linked until you confirm it.',
    studentPhoneNote: 'Only used to confirm your session times. You can add it later.',
    whatsappSameLabel: 'This number is on WhatsApp',
    whatsappNumberLabel: 'WhatsApp number',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    pwMatch: 'Passwords match',
    pwMismatchYet: 'Passwords do not match yet',
    pwMismatchErr: 'Passwords do not match',
    pwLengthErr: 'Password must be at least 8 characters',
    pwStrength: {
      1: 'Weak (min 8 chars)',
      2: 'Fair — add numbers/symbols',
      3: 'Good password',
      4: 'Very strong password',
    },
    optionalTitle: 'Add your level and extra details now',
    optionalBadge: '(optional)',
    optionalHint: 'You can skip this and complete it later from your dashboard.',
    ageLabel: 'Age',
    genderLabel: 'Gender',
    selectOpt: 'Select',
    maleOpt: 'Male',
    femaleOpt: 'Female',
    trackLabel: 'Learning track',
    trackMem: 'Memorization',
    trackTaj: 'Tajweed / Ijazah',
    trackKids: 'Foundation',
    levelLabel: 'Level',
    levelBeg: 'Beginner',
    levelInt: 'Intermediate',
    levelAdv: 'Advanced',
    levelIja: 'Ijazah',
    levelOth: 'Other — specify',
    customLevelLabel: 'Describe your level',
    memorizedJuzLabel: 'Memorized Juz (0–30)',
    memorizationDetailsLabel: 'Memorization details / custom plan',
    memorizationDetailsPlaceholder: 'Example: I memorized Juz Amma and Tabarak',
    estimateNote: 'This is only a first estimate — your tutor confirms your level in the trial class.',
    photoLabel: 'Profile photo (optional)',
    changePhoto: 'Change photo',
    choosePhoto: 'Choose photo',
    photoErr: 'Choose JPG or PNG up to 5 MB',
    photoHint: 'JPG or PNG, up to 5 MB.',
    removePhoto: 'Remove',
    photoWarn: 'Your account was created, but the optional photo could not be saved.',
    guardianLinkTitle: 'Guardian Linking',
    guardianLinkDesc: 'Enter a guardian phone so a pending request appears when they sign in. Linking is never automatic.',
    guardianLinkPhone: 'Guardian Phone',
    relationshipLabel: 'Relationship',
    relFather: 'Father',
    relMother: 'Mother',
    relGuardian: 'Guardian',
    relOther: 'Other',
    goToLogin: 'Go to sign in',
    submitBtn: 'Create Account & Begin',
    creatingAccount: 'Creating account...',
    alreadyHaveAccount: 'Already have an account?',
    signIn: 'Sign In',
    backHome: 'Back to Homepage',
    errNetwork: 'We could not reach the server. Check your connection and try again.',
    errRate: 'Too many sign-up attempts in a short time. Please wait a few minutes and try again.',
    errConflict: 'This email is already registered. Sign in instead, or use "Forgot password".',
    errServer: 'A temporary server error occurred. Nothing was saved — please try again shortly.',
    errGeneric: 'Registration failed. Please review your details and try again.',
  },
  fr: {
    seoTitle: 'Créer un compte',
    brandHeading: 'Commencez votre parcours coranique',
    brandDesc: 'Rejoignez-nous pour apprendre le Saint Coran en ligne avec des enseignants qualifiés et certifiés.',
    studentTab: 'Compte Élève',
    guardianTab: 'Compte Parent',
    guardianTitle: 'Créer un compte Parent',
    studentTitle: 'Créer un compte Élève',
    guardianSubtitle: 'Suivez les progrès, la présence et les évaluations de vos enfants.',
    studentSubtitle: 'Une minute pour commencer : nom, e-mail et mot de passe suffisent.',
    fullNameLabel: 'Nom complet',
    fullNamePlaceholder: 'Entrez votre nom complet',
    emailLabel: 'Adresse e-mail',
    guardianPhoneLabel: 'Téléphone du parent',
    studentPhoneLabel: 'Téléphone (facultatif)',
    passwordLabel: 'Mot de passe',
    confirmPasswordLabel: 'Confirmer le mot de passe',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    submitBtn: 'Créer le compte et commencer',
    creatingAccount: 'Création du compte...',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    signIn: 'Se connecter',
    backHome: 'Retour à l’accueil',
  },
  de: {
    seoTitle: 'Konto erstellen',
    brandHeading: 'Beginnen Sie Ihre Koran-Reise',
    brandDesc: 'Lernen Sie den Heiligen Koran online mit zertifizierten Lehrkräften nach Ihrem eigenen Zeitplan.',
    studentTab: 'Schülerkonto',
    guardianTab: 'Elternkonto',
    guardianTitle: 'Elternkonto erstellen',
    studentTitle: 'Schülerkonto erstellen',
    guardianSubtitle: 'Verfolgen Sie Fortschritt, Anwesenheit und Berichte Ihrer Kinder.',
    studentSubtitle: 'In einer Minute startklar: Name, E-Mail und Passwort genügen.',
    fullNameLabel: 'Vollständiger Name',
    fullNamePlaceholder: 'Geben Sie Ihren Namen ein',
    emailLabel: 'E-Mail-Adresse',
    guardianPhoneLabel: 'Telefonnummer des Elternteils',
    studentPhoneLabel: 'Telefonnummer (optional)',
    passwordLabel: 'Passwort',
    confirmPasswordLabel: 'Passwort bestätigen',
    showPassword: 'Passwort anzeigen',
    hidePassword: 'Passwort verbergen',
    submitBtn: 'Konto erstellen & starten',
    creatingAccount: 'Konto wird erstellt...',
    alreadyHaveAccount: 'Bereits ein Konto?',
    signIn: 'Anmelden',
    backHome: 'Zur Startseite',
  },
  tr: {
    seoTitle: 'Hesap Oluştur',
    brandHeading: 'Kur’an Yolculuğunuza Başlayın',
    brandDesc: 'Kendi programınıza uygun olarak uzman ve sertifikalı hocalarla çevrimiçi Kur’an öğrenin.',
    studentTab: 'Öğrenci Hesabı',
    guardianTab: 'Veli Hesabı',
    guardianTitle: 'Veli Hesabı Oluştur',
    studentTitle: 'Öğrenci Hesabı Oluştur',
    guardianSubtitle: 'Çocuklarınızın Kur’an ilerlemesini, devam durumunu ve raporlarını takip edin.',
    studentSubtitle: 'Başlamak bir dakika: ad, e-posta ve şifre şimdilik yeterli.',
    fullNameLabel: 'Ad Soyad',
    fullNamePlaceholder: 'Adınızı ve soyadınızı girin',
    emailLabel: 'E-posta Adresi',
    guardianPhoneLabel: 'Veli Telefon Numarası',
    studentPhoneLabel: 'Telefon Numarası (İsteğe bağlı)',
    passwordLabel: 'Şifre',
    confirmPasswordLabel: 'Şifreyi Onayla',
    showPassword: 'Şifreyi göster',
    hidePassword: 'Şifreyi gizle',
    submitBtn: 'Hesap Oluştur ve Başla',
    creatingAccount: 'Hesap oluşturuluyor...',
    alreadyHaveAccount: 'Zaten hesabınız var mı?',
    signIn: 'Giriş Yap',
    backHome: 'Ana Sayfaya Dön',
  },
  ur: {
    seoTitle: 'اکاؤنٹ بنائیں',
    brandHeading: 'اپنا بابرکت قرآنی سفر شروع کریں',
    brandDesc: 'اپنے وقت کے مطابق مستند اساتذہ سے آن لائن قرآن پاک سیکھنے کے لیے آج ہی شامل ہوں۔',
    studentTab: 'طالب علم اکاؤنٹ',
    guardianTab: 'سرپرست اکاؤنٹ',
    guardianTitle: 'سرپرست کا اکاؤنٹ بنائیں',
    studentTitle: 'طالب علم کا اکاؤنٹ بنائیں',
    guardianSubtitle: 'اپنے بچوں کی قرآنی پیش رفت، حاضری اور اساتذہ کی رپورٹس دیکھیں',
    studentSubtitle: 'شروع کرنے کے لیے بس ایک منٹ: نام، ای میل اور پاس ورڈ کافی ہیں۔',
    fullNameLabel: 'پورا نام',
    fullNamePlaceholder: 'اپنا پورا نام درج کریں',
    emailLabel: 'ای میل ایڈریس',
    guardianPhoneLabel: 'سرپرست کا فون نمبر',
    studentPhoneLabel: 'فون نمبر (اختیاری)',
    passwordLabel: 'پاس ورڈ',
    confirmPasswordLabel: 'پاس ورڈ کی تصدیق کریں',
    showPassword: 'پاس ورڈ دکھائیں',
    hidePassword: 'پاس ورڈ چھپائیں',
    submitBtn: 'اکاؤنٹ بنائیں اور شروع کریں',
    creatingAccount: 'اکاؤنٹ بنایا جا رہا ہے...',
    alreadyHaveAccount: 'پہلے سے اکاؤنٹ موجود ہے؟',
    signIn: 'لاگ ان کریں',
    backHome: 'صفحہ اول پر واپس جائیں',
  },
  id: {
    seoTitle: 'Buat Akun',
    brandHeading: 'Mulai Perjalanan Al-Qur’an Anda',
    brandDesc: 'Bergabunglah untuk belajar Al-Qur’an secara daring bersama pengajar bersertifikat sesuai jadwal Anda.',
    studentTab: 'Akun Siswa',
    guardianTab: 'Akun Wali',
    guardianTitle: 'Buat Akun Wali',
    studentTitle: 'Buat Akun Siswa',
    guardianSubtitle: 'Pantau perkembangan Al-Qur’an, kehadiran, dan laporan anak Anda.',
    studentSubtitle: 'Satu menit untuk mulai: nama, email, dan kata sandi sudah cukup.',
    fullNameLabel: 'Nama Lengkap',
    fullNamePlaceholder: 'Masukkan nama lengkap Anda',
    emailLabel: 'Alamat Email',
    guardianPhoneLabel: 'Nomor Telepon Wali',
    studentPhoneLabel: 'Nomor Telepon (Opsional)',
    passwordLabel: 'Kata Sandi',
    confirmPasswordLabel: 'Konfirmasi Kata Sandi',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
    submitBtn: 'Buat Akun & Mulai',
    creatingAccount: 'Membuat akun...',
    alreadyHaveAccount: 'Sudah punya akun?',
    signIn: 'Masuk',
    backHome: 'Kembali ke Beranda',
  },
  ms: {
    seoTitle: 'Cipta Akaun',
    brandHeading: 'Mulakan Perjalanan Al-Quran Anda',
    brandDesc: 'Sertai kami untuk mempelajari Al-Quran secara dalam talian bersama guru bertauliah mengikut jadual anda.',
    studentTab: 'Akaun Pelajar',
    guardianTab: 'Akaun Penjaga',
    guardianTitle: 'Cipta Akaun Penjaga',
    studentTitle: 'Cipta Akaun Pelajar',
    guardianSubtitle: 'Pantau kemajuan Al-Quran, kehadiran, dan laporan guru anak anda.',
    studentSubtitle: 'Seminit untuk bermula: nama, e-mel dan kata laluan sudah memadai.',
    fullNameLabel: 'Nama Penuh',
    fullNamePlaceholder: 'Masukkan nama penuh anda',
    emailLabel: 'Alamat E-mel',
    guardianPhoneLabel: 'Nombor Telefon Penjaga',
    studentPhoneLabel: 'Nombor Telefon (Pilihan)',
    passwordLabel: 'Kata Laluan',
    confirmPasswordLabel: 'Sahkan Kata Laluan',
    showPassword: 'Tunjukkan kata laluan',
    hidePassword: 'Sembunyikan kata laluan',
    submitBtn: 'Cipta Akaun & Mula',
    creatingAccount: 'Mencipta akaun...',
    alreadyHaveAccount: 'Sudah mempunyai akaun?',
    signIn: 'Log Masuk',
    backHome: 'Kembali ke Laman Utama',
  },
  ku: {
    seoTitle: 'دروستکردنی هەژمار',
    brandHeading: 'گەشتە پیرۆزەکەی قورئان دەست پێبکە',
    brandDesc: 'ئەمڕۆ بەشداربە بۆ فێربوونی قورئانی پیرۆز بە شێوەی ئۆنلاین لەلایەن مامۆستایانی مۆڵەتپێدراو بە کاتی خۆت.',
    studentTab: 'هەژماری فێرخواز',
    guardianTab: 'هەژماری بەخێوکار',
    guardianTitle: 'دروستکردنی هەژماری بەخێوکار',
    studentTitle: 'دروستکردنی هەژماری فێرخواز',
    guardianSubtitle: 'چاودێری پێشکەوتن، ئامادەبوون و هەڵسەنگاندنی منداڵەکانت بکە.',
    studentSubtitle: 'یەک خولەک بۆ دەستپێکردن: ناو، ئیمەیڵ و وشەی نهێنی بەسە.',
    fullNameLabel: 'ناوی تەواو',
    fullNamePlaceholder: 'ناوی تەواوت بنووسە',
    emailLabel: 'ئیمەیڵ',
    guardianPhoneLabel: 'ژمارەی تەلەفۆنی بەخێوکار',
    studentPhoneLabel: 'ژمارەی تەلەفۆن (ئارەزوومەندانە)',
    passwordLabel: 'وشەی نهێنی',
    confirmPasswordLabel: 'دڵنیاکردنەوەی وشەی نهێنی',
    showPassword: 'پیشاندانی وشەی نهێنی',
    hidePassword: 'شاردنەوەی وشەی نهێنی',
    submitBtn: 'هەژمار دروست بکە و دەست پێبکە',
    creatingAccount: 'هەژمار دروست دەکرێت...',
    alreadyHaveAccount: 'پێشتر هەژمارت هەیە؟',
    signIn: 'چوونەژوورەوە',
    backHome: 'گەڕانەوە بۆ پەڕەی سەرەکی',
  },
};

function evaluatePasswordStrength(pw, copy) {
  if (!pw) return { score: 0, label: '', color: 'bg-[var(--wn-border)]', textColor: 'text-[var(--wn-text-secondary)]' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 11 || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (pw.length < 8) score = 1;

  const levels = {
    1: { label: copy.pwStrength[1], color: 'bg-[var(--wn-danger)]', textColor: 'text-[var(--wn-text-danger,var(--wn-danger))]' },
    2: { label: copy.pwStrength[2], color: 'bg-[var(--wn-warning)]', textColor: 'text-[var(--wn-warning)]' },
    3: { label: copy.pwStrength[3], color: 'bg-[var(--wn-teal)]', textColor: 'text-[var(--wn-link)]' },
    4: { label: copy.pwStrength[4], color: 'bg-[var(--wn-emerald)]', textColor: 'text-[var(--wn-heading)]' },
  };
  return { score, ...(levels[score] || levels[1]) };
}

function registrationErrorMessage(result, copy) {
  const { status, code, error } = result || {};
  if (code === 'NETWORK_ERROR' || status === 0) return copy.errNetwork;
  if (status === 429) return copy.errRate;
  if (code === 'GUARDIAN_PHONE_ALREADY_REGISTERED') return error;
  if (status === 409) return copy.errConflict;
  if (status >= 500) return copy.errServer;
  return error || copy.errGeneric;
}

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const { register: createAccount } = useAuth();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';

  const planPath = searchParams.get('path') || '';
  const planFreq = searchParams.get('freq') || '';
  const planLevel = searchParams.get('level') || '';
  const planMode = searchParams.get('mode') || 'private';
  const selectedSection = ['men', 'women'].includes(searchParams.get('section')) ? searchParams.get('section') : '';

  const initialRole = searchParams.get('role') === 'guardian' || (typeof window !== 'undefined' && window.location.pathname.includes('/guardian')) ? 'guardian' : 'student';
  const [role, setRole] = useState(initialRole);

  const { marketSlug } = useMarket();
  const isIndonesian = marketSlug === 'indonesia-malaysia';

  const { locale, isRTL, dir } = useI18n();
  const baseCopy = isRTL ? REGISTER_COPY.ar : REGISTER_COPY.en;
  const copy = { ...baseCopy, ...(REGISTER_COPY[locale] || {}) };

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const errorRef = useRef(null);
  const optionalDetailsRef = useRef(null);
  const photoInputRef = useRef(null);
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [photoNotice, setPhotoNotice] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    guardianPhone: '',
    guardianRelationship: 'father',
    whatsappPhone: '',
    age: '',
    gender: selectedSection === 'women' ? 'female' : selectedSection === 'men' ? 'male' : '',
    currentLevel: 'beginner',
    preferredTrack: 'memorization',
    memorizedJuz: '0',
    memorizationDetails: '',
    customLevel: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!error || !errorRef.current) return;
    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    errorRef.current.focus({ preventScroll: true });
  }, [error]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    setErrorStatus(null);

    if (formData.password !== formData.confirmPassword) {
      setError(copy.pwMismatchErr);
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError(copy.pwLengthErr);
      setLoading(false);
      return;
    }

    try {
      const result = await createAccount({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        ...(role === 'student' ? {
          whatsappPhone: whatsappSame ? formData.phone : formData.whatsappPhone,
          age: formData.age,
          gender: formData.gender,
          currentLevel: formData.currentLevel === 'other' ? 'beginner' : formData.currentLevel,
          customLevel: formData.currentLevel === 'other' ? formData.customLevel : '',
          preferredTrack: formData.preferredTrack,
          memorizedJuz: Number(formData.memorizedJuz),
          memorizationDetails: formData.memorizationDetails,
        } : {}),
        password: formData.password,
        role,
        ...(role === 'student' && selectedSection ? { enrollmentSection: selectedSection === 'women' ? 'ladies' : 'men_children' } : {}),
        ...(role === 'student' && formData.guardianPhone.trim()
          ? {
              guardianPhone: formData.guardianPhone.trim(),
              guardianRelationship: formData.guardianRelationship,
            }
          : {}),
        ...(referralCode ? { referralCode } : {}),
        ...(planPath ? { selectedPlan: { path: planPath, freq: planFreq, level: planLevel } } : {}),
      });

      if (!result.success) {
        setErrorStatus(result.status ?? null);
        setError(registrationErrorMessage(result, copy));
        return;
      }

      if (role === 'student' && studentPhoto) {
        try {
          const uploaded = await uploadFileDirect(studentPhoto, 'student-avatar');
          const token = (await import('../../lib/authSession')).getAccessToken();
          const updateResponse = await fetch((await import('../../config')).apiUrl('/api/auth/me'), {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ avatar: uploaded.url }),
          });
          if (!updateResponse.ok) throw new Error('Photo save failed');
        } catch {
          toast.warning(copy.photoWarn);
        }
      }

      const rawRedirect = searchParams.get('redirect');
      navigate(
        role === 'student' && isSafeInternalRedirect(rawRedirect)
          ? postAuthDestination({ redirect: rawRedirect, role: result.user?.role, locale })
          : dashboardPathForRole(result.user?.role, locale),
        { replace: true }
      );
    } catch (err) {
      setError(registrationErrorMessage({ error: err.message }, copy));
    } finally {
      setLoading(false);
    }
  };

  const pathNames = {
    hifz: isRTL ? 'حفظ القرآن وتجويده' : 'Quran Memorization & Tajweed',
    tajweed: isRTL ? 'أحكام التجويد ومخارج الحروف' : 'Tajweed & Pronunciation Rules',
    arabic: isRTL ? 'اللغة العربية الفصحى' : 'Classical Arabic (Fus’ha)'
  };

  const levelNames = {
    beginner: copy.levelBeg,
    intermediate: copy.levelInt,
    advanced: copy.levelAdv
  };

  const getEstimatedDuration = () => {
    const frequency = parseInt(planFreq) || 2;
    if (planPath === 'hifz') {
      if (frequency === 1) return isRTL ? '4.5 سنوات' : '4.5 Years';
      if (frequency === 2) return isRTL ? '2.5 سنة' : '2.5 Years';
      if (frequency === 3) return isRTL ? '1.5 سنة' : '1.5 Years';
      return isRTL ? '10 أشهر' : '10 Months';
    } else if (planPath === 'tajweed') {
      if (frequency === 1) return isRTL ? '6 أشهر' : '6 Months';
      if (frequency === 2) return isRTL ? '4 أشهر' : '4 Months';
      if (frequency === 3) return isRTL ? '3 أشهر' : '3 Months';
      return isRTL ? '6 أسابيع' : '6 Weeks';
    } else {
      if (frequency === 1) return isRTL ? '1.5 سنة' : '1.5 Years';
      if (frequency === 2) return isRTL ? '9 أشهر' : '9 Months';
      if (frequency === 3) return isRTL ? '6 أشهر' : '6 Months';
      return isRTL ? '3 أشهر' : '3 Months';
    }
  };

  const getEstimatedPrice = () => {
    const frequency = parseInt(planFreq) || 2;
    if (isIndonesian) {
      if (planMode === 'group') {
        return { formatted: 'Rp 100.000', currency: 'IDR' };
      } else {
        let rate = 450000;
        if (frequency === 1) rate = 250000;
        else if (frequency === 2) rate = 450000;
        else if (frequency === 3) rate = 600000;
        else if (frequency === 5) rate = 900000;
        return { formatted: `Rp ${rate.toLocaleString('id-ID')}`, currency: 'IDR' };
      }
    } else {
      const monthlyHours = frequency * 4;
      const usdPrice = monthlyHours * 10;
      const egpPrice = monthlyHours * 50;
      return { usd: usdPrice, egp: egpPrice, currency: 'USD/EGP' };
    }
  };

  const planPrice = getEstimatedPrice();
  const planDuration = getEstimatedDuration();

  const fieldClass = 'mt-1.5 block w-full min-h-[44px] rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-3.5 py-3 text-sm font-normal text-[var(--wn-text-primary)] outline-none transition focus:border-[var(--wn-gold)] focus:ring-2 focus:ring-[var(--wn-gold)]/20';
  const iconFieldClass = 'w-full min-h-[44px] rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] ps-12 pe-4 py-3.5 text-sm text-[var(--wn-text-primary)] outline-none transition focus:border-[var(--wn-gold)] focus:ring-2 focus:ring-[var(--wn-gold)]/20';
  const fieldLabelClass = 'block text-xs font-bold text-[var(--wn-text-primary)]';

  return (
    <div className="wn-register-shell flex items-center justify-center" dir={dir}>
      <SEOHead page={{ title: copy.seoTitle, url: '/register', noindex: true }} />
      <div className="w-full max-w-6xl grid lg:grid-cols-12 gap-8 items-stretch">

        {/* Left Column: Brand Intro & Plan Details */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? 40 : -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="wn-register-brand-panel lg:col-span-5 flex flex-col justify-between p-6 md:p-8 rounded-3xl text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-15 pointer-events-none geo-pattern-athar" aria-hidden="true" />

          <div className="relative">
            <div className="mb-8">
              <BrandLogo size={54} variant="light" to={null} />
            </div>

            <h2 className="font-naskh text-3xl md:text-4xl font-bold leading-snug mb-4">
              {copy.brandHeading}
            </h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              {copy.brandDesc}
            </p>

            {planPath ? (
              <div className="rounded-2xl border border-[var(--wn-gold)]/30 bg-white/5 p-6 backdrop-blur-sm mt-8 space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wn-gold)]/20 px-3 py-1 text-xs font-semibold text-[var(--wn-sand)]">
                  <Sparkles size={12} aria-hidden="true" />
                  {copy.selectedPlanBadge}
                </span>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-white/70">{copy.learningPathLabel}</p>
                    <p className="text-base font-bold text-[var(--wn-sand)]">
                      {pathNames[planPath] || planPath}
                      {isIndonesian && (
                        <span className="text-xs font-normal text-white/80 ms-2">
                          ({planMode === 'group' ? copy.groupClass : copy.privateClass})
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-xs text-white/70">{copy.currentLevelLabel}</p>
                      <p className="text-sm font-semibold">{levelNames[planLevel] || planLevel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/70">{copy.sessionsMonthlyLabel}</p>
                      <p className="text-sm font-semibold">{planMode === 'group' && isIndonesian ? 8 : parseInt(planFreq) * 4} {copy.sessionsUnit}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <div>
                      <p className="text-xs text-white/70">{copy.estDurationLabel}</p>
                      <p className="text-sm font-bold text-[var(--wn-teal)]">{planMode === 'group' && isIndonesian ? (isRTL ? '1.5 سنة' : '1.5 Years') : planDuration}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/70">{copy.monthlyCostLabel}</p>
                      <p className="text-sm font-bold text-[var(--wn-sand)]">
                        {isIndonesian ? (
                          planPrice.formatted
                        ) : (
                          <>{planPrice.egp} {copy.egpUnit} <span className="text-xs text-white/80">/ {planPrice.usd}$</span></>
                        )}
                      </p>
                    </div>
                  </div>

                  {isIndonesian && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/10 border border-white/15 p-2.5 text-xs text-white/90 leading-normal">
                      <Globe size={14} className="shrink-0 text-[var(--wn-teal)] mt-0.5" aria-hidden="true" />
                      <span>
                        {locale === 'id'
                          ? 'Terdeteksi IP Indonesia: Subsidi Biaya Khusus Aktif (Dukungan Guru Mesir Terjangkau).'
                          : isRTL
                          ? 'تم رصد عنوان IP من إندونيسيا: الرسوم المدعومة نشطة (معلمين مصريين بتكلفة مناسبة).'
                          : 'Indonesian IP Detected: Subsidized Pricing Active (Affordable Egyptian Scholars).'}
                      </span>
                    </div>
                  )}

                  {isIndonesian && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-white/70 font-bold mb-1.5">
                        {locale === 'id' ? 'Pilihan Pembayaran Lokal:' : isRTL ? 'خيارات الدفع المحلية:' : 'Local Payment Options:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {['QRIS', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'Bank Transfer'].map(method => (
                          <span key={method} className="text-xs font-bold text-[var(--wn-teal)] bg-white/10 border border-white/20 rounded px-1.5 py-0.5">
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-8">
                {copy.perks.map((perkTitle, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-[var(--wn-gold)] mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-white/90">{perkTitle}</span>
                  </div>
                ))}

                {isIndonesian && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 border border-white/15 p-2.5 text-xs text-white/90 leading-normal">
                    <Globe size={14} className="shrink-0 text-[var(--wn-teal)] mt-0.5" aria-hidden="true" />
                    <span>
                      {locale === 'id'
                        ? 'Terdeteksi IP Indonesia: Subsidi Biaya Khusus Aktif (Dukungan Guru Mesir Terjangkau).'
                        : isRTL
                        ? 'تم رصد عنوان IP من إندونيسيا: الرسوم المدعومة نشطة (معلمين مصريين بتكلفة مناسبة).'
                        : 'Indonesian IP Detected: Subsidized Pricing Active (Affordable Egyptian Scholars).'}
                    </span>
                  </div>
                )}

                {isIndonesian && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <p className="text-xs text-white/70 font-bold mb-1.5">
                      {locale === 'id' ? 'Pilihan Pembayaran Lokal:' : isRTL ? 'خيارات الدفع المحلية:' : 'Local Payment Options:'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['QRIS', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'Bank Transfer'].map(method => (
                        <span key={method} className="text-xs font-bold text-[var(--wn-teal)] bg-white/10 border border-white/20 rounded px-1.5 py-0.5">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="wn-register-trust">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{copy.trustNote}</span>
          </div>
        </motion.div>

        {/* Right Column: Registration Form */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? -40 : 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="wn-register-form-card lg:col-span-7 p-6 md:p-10 flex flex-col justify-between"
        >
          <div>
            {selectedSection && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-4 py-3 text-xs text-[var(--wn-heading)]">
                <span>{copy.sectionLabel}
                  <strong>{selectedSection === 'women' ? copy.sectionWomen : copy.sectionMen}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => navigate(localizedPath('/start', locale))}
                  className="min-h-[44px] px-2 font-bold underline underline-offset-4"
                >
                  {copy.changeSection}
                </button>
              </div>
            )}

            {/* Role switcher */}
            <div className="flex bg-[var(--wn-surface-sunken)] p-1 rounded-xl mb-6 border border-[var(--wn-border)] gap-1">
              <button
                type="button"
                aria-pressed={role === 'student'}
                onClick={() => setRole('student')}
                className={`min-h-[44px] flex-1 py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'student'
                    ? 'bg-[var(--wn-surface)] text-[var(--wn-heading)] shadow-sm border border-[var(--wn-border)]'
                    : 'text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)]'
                }`}
              >
                <User size={15} aria-hidden="true" />
                <span>{copy.studentTab}</span>
              </button>
              <button
                type="button"
                aria-pressed={role === 'guardian'}
                onClick={() => setRole('guardian')}
                className={`min-h-[44px] flex-1 py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  role === 'guardian'
                    ? 'bg-[var(--wn-surface)] text-[var(--wn-heading)] shadow-sm border border-[var(--wn-border)]'
                    : 'text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)]'
                }`}
              >
                <Users size={15} aria-hidden="true" />
                <span>{copy.guardianTab}</span>
              </button>
            </div>

            <GoogleSignIn context="signup" role={role} enrollmentSection={role === 'student' && selectedSection ? (selectedSection === 'women' ? 'ladies' : 'men_children') : undefined} />

            <div className="mb-6">
              <h1 className="font-naskh text-2xl md:text-3xl font-bold text-[var(--wn-heading)]">
                {role === 'guardian' ? copy.guardianTitle : copy.studentTitle}
              </h1>
              <p className="text-sm text-[var(--wn-text-secondary)] mt-1">
                {role === 'guardian' ? copy.guardianSubtitle : copy.studentSubtitle}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              onInvalidCapture={(event) => {
                if (optionalDetailsRef.current?.contains(event.target)) optionalDetailsRef.current.open = true;
              }}
              className="space-y-5"
            >
              {/* Full Name */}
              <div>
                <label htmlFor="register-name" className="block text-xs font-bold text-[var(--wn-text-primary)] mb-2">
                  {copy.fullNameLabel}
                </label>
                <div className="relative">
                  <User size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
                  <input
                    id="register-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'register-error' : undefined}
                    placeholder={copy.fullNamePlaceholder}
                    className={iconFieldClass}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="register-email" className="block text-xs font-bold text-[var(--wn-text-primary)] mb-2">
                  {copy.emailLabel}
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
                  <input
                    id="register-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'register-error' : undefined}
                    placeholder="example@email.com"
                    className={iconFieldClass}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label htmlFor="register-phone" className="block text-xs font-bold text-[var(--wn-text-primary)] mb-2">
                  {role === 'guardian' ? copy.guardianPhoneLabel : copy.studentPhoneLabel}
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
                  <input
                    id="register-phone"
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    required={role === 'guardian'}
                    placeholder="+20 123 456 7890"
                    className={iconFieldClass}
                  />
                </div>
                {role === 'guardian' ? (
                  <p className="mt-2 text-xs text-[var(--wn-text-secondary)] leading-relaxed">
                    {copy.guardianPhoneNote}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-[var(--wn-text-secondary)] leading-relaxed">
                      {copy.studentPhoneNote}
                    </p>
                    {formData.phone.trim() && (
                      <label htmlFor="register-whatsapp-same" className="min-h-[44px] inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--wn-text-primary)]">
                        <input
                          id="register-whatsapp-same"
                          type="checkbox"
                          checked={whatsappSame}
                          onChange={(event) => setWhatsappSame(event.target.checked)}
                          className="h-4 w-4 rounded accent-[var(--wn-emerald)]"
                        />
                        {copy.whatsappSameLabel}
                      </label>
                    )}
                    {formData.phone.trim() && !whatsappSame && (
                      <label htmlFor="register-whatsapp-phone" className={fieldLabelClass}>
                        {copy.whatsappNumberLabel}
                        <input id="register-whatsapp-phone" type="tel" name="whatsappPhone" autoComplete="tel" inputMode="tel" value={formData.whatsappPhone} onChange={handleChange} placeholder="+201000000000" className={fieldClass} />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="register-password" className="block text-xs font-bold text-[var(--wn-text-primary)] mb-2">
                  {copy.passwordLabel}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'register-error' : undefined}
                    placeholder="••••••••"
                    className={`${iconFieldClass} pe-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                    aria-pressed={showPassword}
                    className="absolute end-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--wn-text-tertiary)] hover:text-[var(--wn-text-primary)] transition"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {formData.password && (() => {
                  const strength = evaluatePasswordStrength(formData.password, copy);
                  return (
                    <div className="mt-2.5 space-y-1.5" aria-live="polite">
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((bar) => (
                          <span
                            key={bar}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              bar <= strength.score ? strength.color : 'bg-[var(--wn-border)]'
                            }`}
                          />
                        ))}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-semibold ${strength.textColor}`}>
                        <CheckCircle size={13} aria-hidden="true" />
                        <span>{strength.label}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="register-confirm-password" className="block text-xs font-bold text-[var(--wn-text-primary)] mb-2">
                  {copy.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--wn-text-tertiary)] pointer-events-none" aria-hidden="true" />
                  <input
                    id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(error) || (Boolean(formData.confirmPassword) && formData.password !== formData.confirmPassword)}
                    aria-describedby={error ? 'register-error' : undefined}
                    placeholder="••••••••"
                    className={`${iconFieldClass} pe-12`}
                  />
                </div>
                {formData.confirmPassword && (
                  formData.password === formData.confirmPassword ? (
                    <div className="mt-2 flex items-center gap-1.5 text-[var(--wn-link)] text-xs" aria-live="polite">
                      <CheckCircle size={14} aria-hidden="true" />
                      {copy.pwMatch}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-[var(--wn-warning)] text-xs" aria-live="polite">
                      <span className="font-bold">!</span>
                      {copy.pwMismatchYet}
                    </div>
                  )
                )}
              </div>

              {role === 'student' && (
                <details ref={optionalDetailsRef} className="wn-register-optional group rounded-2xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)]/60">
                  <summary className="min-h-[44px] flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-[var(--wn-heading)]">
                        {copy.optionalTitle}{' '}
                        <span className="font-normal text-[var(--wn-text-secondary)]">{copy.optionalBadge}</span>
                      </span>
                      <span className="text-xs text-[var(--wn-text-secondary)]">
                        {copy.optionalHint}
                      </span>
                    </span>
                    <ChevronDown size={18} className="shrink-0 text-[var(--wn-heading)] transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>

                  <div className="space-y-5 border-t border-[var(--wn-border-mint)] p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className={fieldLabelClass}>{copy.ageLabel}
                        <input className={fieldClass} type="number" min="4" max="100" inputMode="numeric" name="age" value={formData.age} onChange={handleChange} />
                      </label>
                      <label className={fieldLabelClass}>{copy.genderLabel}
                        <select className={fieldClass} name="gender" value={formData.gender} onChange={handleChange}>
                          <option value="">{copy.selectOpt}</option>
                          <option value="male">{copy.maleOpt}</option>
                          <option value="female">{copy.femaleOpt}</option>
                        </select>
                      </label>
                      <label className={fieldLabelClass}>{copy.trackLabel}
                        <select className={fieldClass} name="preferredTrack" value={formData.preferredTrack} onChange={handleChange}>
                          <option value="memorization">{copy.trackMem}</option>
                          <option value="tajweed_ijazah">{copy.trackTaj}</option>
                          <option value="kids_foundation">{copy.trackKids}</option>
                        </select>
                      </label>
                      <label className={fieldLabelClass}>{copy.levelLabel}
                        <select className={fieldClass} name="currentLevel" value={formData.currentLevel} onChange={handleChange}>
                          <option value="beginner">{copy.levelBeg}</option>
                          <option value="intermediate">{copy.levelInt}</option>
                          <option value="advanced">{copy.levelAdv}</option>
                          <option value="ijazah">{copy.levelIja}</option>
                          <option value="other">{copy.levelOth}</option>
                        </select>
                      </label>
                      {formData.currentLevel === 'other' && (
                        <label className={fieldLabelClass + ' sm:col-span-2'}>{copy.customLevelLabel}
                          <input required maxLength="120" className={fieldClass} name="customLevel" value={formData.customLevel} onChange={handleChange} />
                        </label>
                      )}
                      <label className={fieldLabelClass + ' sm:col-span-2'}>{copy.memorizedJuzLabel}
                        <input type="number" min="0" max="30" step="1" inputMode="numeric" className={fieldClass} name="memorizedJuz" value={formData.memorizedJuz} onChange={handleChange} />
                      </label>
                    </div>
                    <label className={fieldLabelClass}>{copy.memorizationDetailsLabel}
                      <textarea name="memorizationDetails" maxLength="500" rows="3" value={formData.memorizationDetails} onChange={handleChange} className={fieldClass} placeholder={copy.memorizationDetailsPlaceholder} />
                    </label>
                    <p className="text-xs text-[var(--wn-text-secondary)]">
                      {copy.estimateNote}
                    </p>

                    <div className="space-y-2 border-t border-[var(--wn-border-mint)] pt-4">
                      <span className={fieldLabelClass}>{copy.photoLabel}</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <label htmlFor="optional-student-photo" className="min-h-[44px] inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface)] px-4 py-2.5 text-xs font-bold text-[var(--wn-text-primary)] transition hover:border-[var(--wn-emerald)] hover:text-[var(--wn-heading)] focus-within:ring-2 focus-within:ring-[var(--wn-emerald)]/25">
                          <ImagePlus size={16} aria-hidden="true" />
                          {studentPhoto ? copy.changePhoto : copy.choosePhoto}
                          <input
                            ref={photoInputRef}
                            id="optional-student-photo"
                            type="file"
                            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              if (file && (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
                                setStudentPhoto(null);
                                event.target.value = '';
                                setPhotoNotice(copy.photoErr);
                              } else {
                                setStudentPhoto(file);
                                setPhotoNotice(file ? file.name : '');
                              }
                            }}
                          />
                        </label>
                        {studentPhoto && (
                          <button
                            type="button"
                            onClick={() => {
                              setStudentPhoto(null);
                              setPhotoNotice('');
                              if (photoInputRef.current) photoInputRef.current.value = '';
                            }}
                            className="min-h-[44px] px-2 text-xs font-semibold text-[var(--wn-text-secondary)] underline underline-offset-2 hover:text-[var(--wn-text-danger,var(--wn-danger))]"
                          >
                            {copy.removePhoto}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[var(--wn-text-secondary)]">{copy.photoHint}</p>
                      {photoNotice && <p role="status" className="text-xs text-[var(--wn-heading)]">{photoNotice}</p>}
                    </div>

                    <div className="space-y-3 border-t border-[var(--wn-border-mint)] pt-4">
                      <div className="flex items-start gap-2.5">
                        <ShieldCheck size={18} className="text-[var(--wn-link)] mt-0.5 shrink-0" aria-hidden="true" />
                        <div>
                          <h3 className="text-sm font-bold text-[var(--wn-heading)]">
                            {copy.guardianLinkTitle}
                          </h3>
                          <p className="text-xs text-[var(--wn-text-secondary)] mt-1 leading-relaxed">
                            {copy.guardianLinkDesc}
                          </p>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className={fieldLabelClass}>{copy.guardianLinkPhone}
                          <input type="tel" name="guardianPhone" autoComplete="off" inputMode="tel" value={formData.guardianPhone} onChange={handleChange} placeholder="+20 10 0000 0000" className={fieldClass} />
                        </label>
                        <label className={fieldLabelClass}>{copy.relationshipLabel}
                          <select name="guardianRelationship" value={formData.guardianRelationship} onChange={handleChange} className={fieldClass}>
                            <option value="father">{copy.relFather}</option>
                            <option value="mother">{copy.relMother}</option>
                            <option value="guardian">{copy.relGuardian}</option>
                            <option value="other">{copy.relOther}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                </details>
              )}

              {error && (
                <motion.div
                  id="register-error"
                  ref={errorRef}
                  tabIndex={-1}
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[var(--wn-danger-soft)] border border-[var(--wn-danger)]/40 text-[var(--wn-text-danger,var(--wn-danger))] rounded-xl p-4 text-sm flex items-start gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-danger)]/40"
                >
                  <span className="font-bold shrink-0" aria-hidden="true">!</span>
                  <div className="space-y-2">
                    <p>{error}</p>
                    {errorStatus === 409 && (
                      <button
                        type="button"
                        onClick={() => navigate(localizedPath('/login', locale))}
                        className="min-h-[44px] font-bold underline underline-offset-2"
                      >
                        {copy.goToLogin}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="btn-gold min-h-[44px] w-full justify-center text-sm py-3.5 shadow-lg mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[var(--wn-emerald-deep)]/30 border-t-[var(--wn-emerald-deep)] rounded-full animate-spin" aria-hidden="true" />
                    <span className="sr-only">{copy.creatingAccount}</span>
                  </>
                ) : (
                  <>
                    {copy.submitBtn}
                    {isRTL ? <ArrowLeft size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Login redirection */}
          <div className="mt-8 pt-6 border-t border-[var(--wn-border)] text-center">
            <p className="text-xs text-[var(--wn-text-secondary)] mb-3">
              {copy.alreadyHaveAccount}
            </p>
            <button
              type="button"
              onClick={() => navigate(localizedPath('/login', locale))}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--wn-gold)]/50 bg-[var(--wn-surface)] px-8 py-2.5 text-xs font-bold text-[var(--wn-text-gold)] hover:bg-[var(--wn-gold-soft)] transition"
            >
              {copy.signIn}
            </button>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate(localizedPath('/', locale))}
                className="min-h-[44px] px-4 text-xs text-[var(--wn-text-gold)] hover:underline"
              >
                {copy.backHome}
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
