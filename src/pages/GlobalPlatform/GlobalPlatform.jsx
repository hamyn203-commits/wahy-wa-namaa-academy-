import { Link } from 'react-router-dom';
import { Globe2, Bot, GraduationCap, Users, BookOpenCheck, BellRing, LibraryBig, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import '../../styles/public-experience.css';

const PLATFORM_COPY = {
  ar: {
    seoTitle: 'منظومة وحي ونماء الرقمية',
    seoDesc: 'استكشف وحدات منصة وحي ونماء التعليمية.',
    eyebrow: 'منظومة واحدة للتعلم',
    title: 'كل رحلة القرآن داخل تجربة واحدة',
    subtitle: 'بدل التنقل بين أدوات متفرقة، تجمع وحي ونماء البرامج والمعلمين والجلسات والمكتبة والمتابعة في منصة واحدة.',
    ctaPrimary: 'ابدأ كطالب',
    ctaSecondary: 'استكشف البرامج',
    openModule: 'فتح الوحدة',
    modules: [
      { icon: GraduationCap, title: 'مسارات وبرامج', text: 'الدورات والمسارات المتدرجة من التأسيس إلى الحفظ والإتقان.', to: '/tracks' },
      { icon: Users, title: 'معلمون وجلسات مباشرة', text: 'ملفات معلمين، حجز جلسات، وفصل مباشر داخل نفس الحساب.', to: '/teachers' },
      { icon: Bot, title: 'أدوات الذكاء الاصطناعي', text: 'مساعد قرآني وتحليل تلاوة وأدوات مساندة للطالب والمعلم.', to: '/ai' },
      { icon: LibraryBig, title: 'المكتبة التعليمية', text: 'مواد وكتب وفيديوهات تعليمية متاحة داخل المنصة.', to: '/library' },
      { icon: BellRing, title: 'المتابعة والإشعارات', text: 'تنبيهات الجلسات وتفضيلات التواصل والمتابعة من الحساب.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'الشهادات والتقدم', text: 'متابعة تقدم الدورات والتحقق من الشهادات الصادرة فعليًا.', to: '/courses' },
    ],
  },
  en: {
    seoTitle: 'Wahy Wa Namaa Digital Platform',
    seoDesc: 'Explore the Wahy Wa Namaa learning platform.',
    eyebrow: 'ONE LEARNING ECOSYSTEM',
    title: 'Your Quran journey in one connected experience',
    subtitle: 'Instead of juggling separate tools, Wahy Wa Namaa brings programs, teachers, live sessions, library resources, and follow-up into one connected platform.',
    ctaPrimary: 'Start as a learner',
    ctaSecondary: 'Explore programs',
    openModule: 'Open module',
    modules: [
      { icon: GraduationCap, title: 'Programs and paths', text: 'Structured courses and paths from foundations to memorization and mastery.', to: '/tracks' },
      { icon: Users, title: 'Teachers and live sessions', text: 'Teacher profiles, booking, and live learning inside one account.', to: '/teachers' },
      { icon: Bot, title: 'AI learning tools', text: 'Quran assistant, recitation analysis, and tools for learners and teachers.', to: '/ai' },
      { icon: LibraryBig, title: 'Learning library', text: 'Learning materials, books, and recorded lessons inside the platform.', to: '/library' },
      { icon: BellRing, title: 'Follow-up and notifications', text: 'Session alerts, communication preferences, and account follow-up.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Certificates and progress', text: 'Track course progress and verify certificates that are actually issued.', to: '/courses' },
    ],
  },
  fr: {
    seoTitle: 'Plateforme numérique Wahy Wa Namaa',
    seoDesc: 'Découvrez l’écosystème éducatif Wahy Wa Namaa.',
    eyebrow: 'UN ÉCOSYSTÈME UNIFIÉ',
    title: 'Tout votre parcours coranique dans une seule expérience',
    subtitle: 'Plutôt que de disperser vos outils, Wahy Wa Namaa réunit programmes, enseignants, séances en direct, bibliothèque et suivi au même endroit.',
    ctaPrimary: 'Commencer comme élève',
    ctaSecondary: 'Explorer les programmes',
    openModule: 'Ouvrir le module',
    modules: [
      { icon: GraduationCap, title: 'Parcours et programmes', text: 'Cours structurés des bases jusqu’à la mémorisation et la maîtrise.', to: '/tracks' },
      { icon: Users, title: 'Enseignants et séances en direct', text: 'Profils d’enseignants, réservations et classe en direct depuis un seul compte.', to: '/teachers' },
      { icon: Bot, title: 'Outils d’IA pédagogique', text: 'Assistant coranique, analyse de récitation et outils pour élèves et enseignants.', to: '/ai' },
      { icon: LibraryBig, title: 'Bibliothèque éducative', text: 'Supports pédagogiques, livres et leçons enregistrées sur la plateforme.', to: '/library' },
      { icon: BellRing, title: 'Suivi et notifications', text: 'Rappels de séances, préférences de contact et suivi du compte.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Certificats et progression', text: 'Suivez votre progression et vérifiez les certificats délivrés.', to: '/courses' },
    ],
  },
  de: {
    seoTitle: 'Digitale Plattform Wahy Wa Namaa',
    seoDesc: 'Entdecken Sie die Lernplattform von Wahy Wa Namaa.',
    eyebrow: 'EIN LERNÖKOSYSTEM',
    title: 'Ihre gesamte Koran-Reise an einem Ort',
    subtitle: 'Statt getrennter Werkzeuge vereint Wahy Wa Namaa Programme, Lehrkräfte, Live-Unterricht, Bibliothek und Lernfortschritt auf einer Plattform.',
    ctaPrimary: 'Als Schüler starten',
    ctaSecondary: 'Programme entdecken',
    openModule: 'Modul öffnen',
    modules: [
      { icon: GraduationCap, title: 'Lernpfade & Programme', text: 'Strukturierte Kurse von den Grundlagen bis zum Auswendiglernen und zur Meisterschaft.', to: '/tracks' },
      { icon: Users, title: 'Lehrkräfte & Live-Unterricht', text: 'Lehrerprofile, Terminbuchung und Live-Unterricht in einem Konto.', to: '/teachers' },
      { icon: Bot, title: 'KI-Lernwerkzeuge', text: 'Koran-Assistent, Rezitationsanalyse und Werkzeuge für Lernende und Lehrkräfte.', to: '/ai' },
      { icon: LibraryBig, title: 'Lernbibliothek', text: 'Lernmaterialien, Bücher und aufgezeichnete Lektionen direkt in der Plattform.', to: '/library' },
      { icon: BellRing, title: 'Begleitung & Benachrichtigungen', text: 'Unterrichtserinnerungen, Kontaktpräferenzen und Kontoverlauf.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Zertifikate & Fortschritt', text: 'Kursfortschritt verfolgen und ausgestellte Zertifikate verifizieren.', to: '/courses' },
    ],
  },
  tr: {
    seoTitle: 'Wahy Wa Namaa Dijital Platformu',
    seoDesc: 'Wahy Wa Namaa öğrenim platformunu keşfedin.',
    eyebrow: 'TEK ÖĞRENİM EKOSİSTEMİ',
    title: 'Tüm Kur’an yolculuğunuz tek bir deneyimde',
    subtitle: 'Farklı araçlar arasında dağılmak yerine; programları, öğretmenleri, canlı dersleri, kütüphaneyi ve takibi tek bir platformda buluşturuyoruz.',
    ctaPrimary: 'Öğrenci olarak başla',
    ctaSecondary: 'Programları keşfet',
    openModule: 'Modülü aç',
    modules: [
      { icon: GraduationCap, title: 'Yol haritaları ve programlar', text: 'Temelden ezbere ve ustalığa uzanan aşamalı kurslar ve programlar.', to: '/tracks' },
      { icon: Users, title: 'Öğretmenler ve canlı dersler', text: 'Tek hesap içinde öğretmen profilleri, ders rezervasyonu ve canlı sınıf.', to: '/teachers' },
      { icon: Bot, title: 'Yapay zekâ destekli araçlar', text: 'Kur’an asistanı, tilavet analizi ve öğrenci-öğretmen yardımcı araçları.', to: '/ai' },
      { icon: LibraryBig, title: 'Eğitim kütüphanesi', text: 'Platform içinde erişilebilir kaynaklar, kitaplar ve video dersler.', to: '/library' },
      { icon: BellRing, title: 'Takip ve bildirimler', text: 'Ders hatırlatmaları, iletişim tercihleri ve hesap takibi.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Sertifikalar ve ilerleme', text: 'Kurs ilerlemenizi izleyin ve verilen sertifikaları doğrulayın.', to: '/courses' },
    ],
  },
  ur: {
    seoTitle: 'وحی و نماء ڈیجیٹل پلیٹ فارم',
    seoDesc: 'وحی و نماء تعلیمی پلیٹ فارم کے حصے دریافت کریں۔',
    eyebrow: 'تعلیم کا ایک مربوط نظام',
    title: 'قرآن کا پورا سفر ایک مربوط تجربے میں',
    subtitle: 'الگ الگ ذرائع استعمال کرنے کے بجائے، وحی و نماء پروگرامز، اساتذہ، لائیو کلاسز، لائبریری اور تعلیمی نگرانی کو ایک ہی جگہ جمع کرتا ہے۔',
    ctaPrimary: 'طالب علم کے طور پر شروع کریں',
    ctaSecondary: 'پروگرام دیکھیں',
    openModule: 'ماڈیول کھولیں',
    modules: [
      { icon: GraduationCap, title: 'تعلیمی راستے اور پروگرام', text: 'بنیاد سے لے کر حفظ اور مہارت تک منظم کورسز اور تعلیمی راستے۔', to: '/tracks' },
      { icon: Users, title: 'اساتذہ اور لائیو کلاسز', text: 'ایک ہی اکاؤنٹ میں اساتذہ کے پروفائلز، وقت کی بکنگ اور لائیو کلاس روم۔', to: '/teachers' },
      { icon: Bot, title: 'اے آئی تعلیمی آلات', text: 'قرآنی معاون، تلاوت کا تجزیہ اور طلباء و اساتذہ کے لیے جدید سہولیات۔', to: '/ai' },
      { icon: LibraryBig, title: 'تعلیمی لائبریری', text: 'پلیٹ فارم کے اندر کتب، مطالعہ کا مواد اور ریکارڈ شدہ اسباق۔', to: '/library' },
      { icon: BellRing, title: 'تعلیمی نگرانی اور اطلاعات', text: 'کلاس کے الرٹس، رابطے کی ترجیحات اور اکاؤنٹ کی مسلسل رہنمائی۔', to: '/notifications' },
      { icon: BookOpenCheck, title: 'اسناد اور تعلیمی پیش رفت', text: 'کورس کی پیش رفت دیکھیں اور جاری کردہ اسناد کی تصدیق کریں۔', to: '/courses' },
    ],
  },
  id: {
    seoTitle: 'Platform Digital Wahy Wa Namaa',
    seoDesc: 'Jelajahi ekosistem pembelajaran Wahy Wa Namaa.',
    eyebrow: 'SATU EKOSISTEM BELAJAR',
    title: 'Seluruh perjalanan Al-Quran Anda dalam satu pengalaman terpadu',
    subtitle: 'Wahy Wa Namaa menyatukan program, guru, kelas langsung, perpustakaan, dan pemantauan belajar dalam satu platform terhubung.',
    ctaPrimary: 'Mulai sebagai pelajar',
    ctaSecondary: 'Jelajahi program',
    openModule: 'Buka modul',
    modules: [
      { icon: GraduationCap, title: 'Program dan jalur belajar', text: 'Kursus terstruktur dari dasar hingga hafalan dan penguasaan.', to: '/tracks' },
      { icon: Users, title: 'Guru dan sesi langsung', text: 'Profil guru, pemesanan jadwal, dan kelas langsung dalam satu akun.', to: '/teachers' },
      { icon: Bot, title: 'Alat belajar AI', text: 'Asisten Al-Quran, analisis tilawah, dan alat bantu untuk pelajar dan guru.', to: '/ai' },
      { icon: LibraryBig, title: 'Perpustakaan belajar', text: 'Materi pembelajaran, buku, dan rekaman pelajaran di dalam platform.', to: '/library' },
      { icon: BellRing, title: 'Pemantauan dan notifikasi', text: 'Pengingat sesi, preferensi komunikasi, dan pemantauan akun.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Sertifikat dan progres', text: 'Pantau kemajuan kursus dan verifikasi sertifikat yang diterbitkan.', to: '/courses' },
    ],
  },
  ms: {
    seoTitle: 'Platform Digital Wahy Wa Namaa',
    seoDesc: 'Terokai ekosistem pembelajaran Wahy Wa Namaa.',
    eyebrow: 'SATU EKOSISTEM PEMBELAJARAN',
    title: 'Perjalanan Al-Quran anda dalam satu pengalaman bersepadu',
    subtitle: 'Wahy Wa Namaa menghimpunkan program, guru, kelas langsung, perpustakaan, dan pemantauan pembelajaran dalam satu platform berhubung.',
    ctaPrimary: 'Mulakan sebagai pelajar',
    ctaSecondary: 'Terokai program',
    openModule: 'Buka modul',
    modules: [
      { icon: GraduationCap, title: 'Program dan laluan', text: 'Kursus berstruktur daripada asas hingga hafazan dan penguasaan.', to: '/tracks' },
      { icon: Users, title: 'Guru dan sesi langsung', text: 'Profil guru, tempahan jadual, dan kelas langsung dalam satu akaun.', to: '/teachers' },
      { icon: Bot, title: 'Alat pembelajaran AI', text: 'Pembantu Al-Quran, analisis bacaan, dan alat sokongan untuk pelajar dan guru.', to: '/ai' },
      { icon: LibraryBig, title: 'Perpustakaan pembelajaran', text: 'Bahan pembelajaran, buku, dan rakaman pelajaran di dalam platform.', to: '/library' },
      { icon: BellRing, title: 'Susulan dan pemberitahuan', text: 'Peringatan sesi, pilihan komunikasi, dan susulan akaun.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'Sijil dan kemajuan', text: 'Jejak kemajuan kursus dan sahkan sijil yang dikeluarkan.', to: '/courses' },
    ],
  },
  ku: {
    seoTitle: 'پلاتفۆرمی دیجیتاڵی وەحی و نەما',
    seoDesc: 'بەشەکانی پلاتفۆرمی فێرکاری وەحی و نەما بدۆزەرەوە.',
    eyebrow: 'یەک سیستەمی فێربوون',
    title: 'هەموو گەشتی قورئانت لە یەک ئەزمووندا',
    subtitle: 'لەبری بەکارهێنانی ئامرازی جیاواز، وەحی و نەما بەرنامەکان، مامۆستایان، وانە ڕاستەوخۆکان، کتێبخانە و بەدواداچوون لە یەک پلاتفۆرمدا کۆدەکاتەوە.',
    ctaPrimary: 'وەک قوتابی دەست پێ بکە',
    ctaSecondary: 'بەرنامەکان ببینە',
    openModule: 'کردنەوەی بەش',
    modules: [
      { icon: GraduationCap, title: 'ڕێڕەو و بەرنامەکان', text: 'خول و ڕێڕەوی ڕێکخراو لە بنەڕەتەوە تا لەبەرکردن و شارەزایی.', to: '/tracks' },
      { icon: Users, title: 'مامۆستایان و وانەی ڕاستەوخۆ', text: 'پرۆفایلی مامۆستایان، دیاریکردنی کات و پۆلی ڕاستەوخۆ لە یەک هەژماردا.', to: '/teachers' },
      { icon: Bot, title: 'ئامرازەکانی زیرەکی دەستکرد', text: 'یارمەتیدەری قورئانی، شیکردنەوەی خوێندنەوە و ئامرازی یارمەتیدەر بۆ قوتابی و مامۆستا.', to: '/ai' },
      { icon: LibraryBig, title: 'کتێبخانەی فێربوون', text: 'سەرچاوە، کتێب و وانە تۆمارکراوەکانی ناو پلاتفۆرم.', to: '/library' },
      { icon: BellRing, title: 'بەدواداچوون و ئاگادارکردنەوە', text: 'ئاگادارکردنەوەی وانەکان، ڕێکخستنی پەیوەندی و بەدواداچوونی هەژمار.', to: '/notifications' },
      { icon: BookOpenCheck, title: 'بڕوانامە و پێشکەوتن', text: 'شوێنکەوتنی پێشکەوتنی خولەکان و دڵنیابوون لە بڕوانامە دەرچووەکان.', to: '/courses' },
    ],
  },
};

export default function GlobalPlatform() {
  const { locale, isRTL, dir } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = PLATFORM_COPY[locale] || PLATFORM_COPY.en;

  return (
    <>
      <SEOHead page={{
        url: '/global-platform',
        title: copy.seoTitle,
        description: copy.seoDesc,
      }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <Link to={localizedPath('/register/student', locale)} className="wn-btn wn-btn--accent min-h-[44px]">{copy.ctaPrimary} <ArrowIcon size={15} aria-hidden="true" /></Link>
                <Link to={localizedPath('/courses', locale)} className="wn-btn wn-btn--secondary min-h-[44px]">{copy.ctaSecondary}</Link>
              </div>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true"><div className="wn-public-orbit" /><div className="wn-public-orbit__core"><Globe2 size={46} strokeWidth={1.25} /></div></div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-ecosystem-grid">
            {copy.modules.map(({ icon: Icon, title, text, to }) => (
              <Link key={to} to={localizedPath(to, locale)} className="wn-ecosystem-card">
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="min-h-[44px] inline-flex items-center gap-1 mt-3 text-xs font-bold text-[var(--wn-link)]">
                  {copy.openModule} <ArrowIcon size={13} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
