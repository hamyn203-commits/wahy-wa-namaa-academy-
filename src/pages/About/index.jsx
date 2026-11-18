import { Link } from 'react-router-dom';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { useSEO } from '../../hooks/useSEO';
import { localizedPath } from '../../lib/locale';
import { motion } from 'framer-motion';
import {
  Target,
  Globe,
  Heart,
  Sparkles,
  BookOpenCheck,
  Sprout,
  ShieldCheck,
  Award,
  Users,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import '../../styles/public-experience.css';

const ABOUT_COPY = {
  ar: {
    pageTitle: 'عن أكاديمية وَحْيٌ وَنَمَاء',
    pageDescription: 'تعرف على رؤية ورسالة ومنهجية أكاديمية وحي ونماء لتعليم القرآن.',
    home: 'الرئيسية',
    eyebrow: 'من نحن',
    heroTitle: 'وحيٌ نتعلّمه… ونماءٌ نعيشه',
    heroSubtitle: 'وحي ونماء أكاديمية قرآنية رقمية نبني فيها تجربة تعلم تجمع أصالة التلقي مع أدوات حديثة تخدم الطالب والمعلم والأسرة.',
    ctaStart: 'ابدأ رحلتك الآن',
    ctaTeachers: 'تصفح المعلمين',
    howEyebrow: 'كيف نتعلم معًا؟',
    howTitle: 'منهجيتنا التعليمية في ٤ خطوات واضحة',
    nameEyebrow: 'فلسفة الاسم',
    nameTitle: 'وَحْيٌ وَنَمَاء',
    nameBody: 'الوحي هو الأصل الذي نتلقى منه، والنماء هو الأثر الذي نرجو أن يظهر في العلم والسلوك والاستمرار.',
    ctaTrial: 'احجز حصتك التجريبية المجانية',
    values: [
      { title: 'رسالتنا', text: 'تقديم تعليم قرآني واضح ومتدرج يجمع بين الإتقان وحسن التوجيه.' },
      { title: 'تعلم بلا حدود مكانية', text: 'تجربة رقمية تساعد الطالب على التعلم من مكانه وبالوقت المتاح له.' },
      { title: 'الرفق والاحترام', text: 'نريد أن تكون رحلة القرآن هادئة ومحترمة ومناسبة لعمر الطالب واحتياجه.' },
      { title: 'النماء قبل الأرقام', text: 'نركز على تقدم حقيقي يمكن فهمه ومتابعته، لا على أرقام تسويقية غير موثقة.' },
    ],
    steps: [
      { num: '٠١', title: 'تقييم مجاني وتحديد المستوى', desc: 'نبدأ بحصة تجريبية تعريفية مجانية ١٠٠٪ لفهم مستوى القراءة والحفظ وتحديد المسار الأنسب بدقة.' },
      { num: '٠٢', title: 'تعيين المعلم أو المعلمة الأنسب', desc: 'نخصص معلمات مجازات بالكامل لقسم السيدات والبنات، ومعلمين مجازين لقسم الرجال والأولاد.' },
      { num: '٠٣', title: 'حلقات تفاعلية وتثبيت تراكمي', desc: 'تسميع مباشر وتصحيح لحظي لمخارج الحروف وأحكام التجويد مع خطة مراجعة تمنع التفلت.' },
      { num: '٠٤', title: 'تقارير دورية وشهادات موثقة', desc: 'متابعة مستمرة لولي الأمر والطالب بعد كل حصة، مع شهادات إتمام رسمية قابلة للتحقق عبر رمز QR.' },
    ],
  },
  en: {
    pageTitle: 'About Wahy Wa Namaa Academy',
    pageDescription: 'Learn about the vision, mission, and methodology behind Wahy Wa Namaa Academy.',
    home: 'Home',
    eyebrow: 'ABOUT US',
    heroTitle: 'Revelation we learn. Growth we live.',
    heroSubtitle: 'Wahy Wa Namaa is a digital Quran academy combining authentic learning with modern tools that support learners, teachers, and families.',
    ctaStart: 'Start your journey',
    ctaTeachers: 'Browse teachers',
    howEyebrow: 'HOW WE LEARN',
    howTitle: 'Our 4-Step Educational Methodology',
    nameEyebrow: 'THE NAME',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Wahy is the source we learn from; Namaa is the growth we hope to see in knowledge, character, and consistency.',
    ctaTrial: 'Book your free trial',
    values: [
      { title: 'Our mission', text: 'Provide clear, structured Quran learning that combines mastery with thoughtful guidance.' },
      { title: 'Learning beyond location', text: 'A digital experience that helps learners study from where they are and around their available time.' },
      { title: 'Care and respect', text: 'We want Quran learning to feel calm, respectful, and appropriate to each learner’s age and needs.' },
      { title: 'Growth before vanity metrics', text: 'We focus on understandable, trackable progress rather than unverified marketing numbers.' },
    ],
    steps: [
      { num: '01', title: '1. Free evaluation & level check', desc: 'We start with a 100% free introductory session to assess reading and memorization level accurately.' },
      { num: '02', title: '2. Dedicated tutor matching', desc: 'Dedicated certified female instructors for sisters and girls, and certified male tutors for men and boys.' },
      { num: '03', title: '3. Live interactive sessions', desc: 'Live recitation and immediate pronunciation correction paired with a structured cumulative review plan.' },
      { num: '04', title: '4. Progress reports & QR certificates', desc: 'Continuous guardian and student tracking after every lesson, culminating in QR-verifiable certificates.' },
    ],
  },
  fr: {
    pageTitle: 'À propos de l’Académie Wahy Wa Namaa',
    pageDescription: 'Découvrez la vision, la mission et la méthodologie pédagogique de l’Académie Wahy Wa Namaa.',
    home: 'Accueil',
    eyebrow: 'À PROPOS',
    heroTitle: 'Une Révélation que l’on apprend… une croissance que l’on vit.',
    heroSubtitle: 'Wahy Wa Namaa est une académie coranique numérique alliant transmission authentique et outils modernes au service de l’élève, de l’enseignant et de la famille.',
    ctaStart: 'Commencer votre parcours',
    ctaTeachers: 'Parcourir les enseignants',
    howEyebrow: 'NOTRE MÉTHODE',
    howTitle: 'Notre méthodologie en 4 étapes claires',
    nameEyebrow: 'LA SIGNIFICATION DU NOM',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Wahy désigne la Révélation à laquelle nous puisons ; Namaa désigne l’épanouissement souhaité dans le savoir, le comportement et la constance.',
    ctaTrial: 'Réserver un essai gratuit',
    values: [
      { title: 'Notre mission', text: 'Offrir un apprentissage coranique structuré et clair unissant maîtrise et accompagnement bienveillant.' },
      { title: 'Apprendre sans frontières', text: 'Une expérience numérique qui permet d’étudier de partout selon vos disponibilités.' },
      { title: 'Bienveillance et respect', text: 'Un parcours serein, respectueux et adapté à l’âge ainsi qu’aux besoins de chaque apprenant.' },
      { title: 'La progression avant les chiffres', text: 'Nous privilégions des progrès réels et mesurables plutôt que des chiffres marketing invérifiés.' },
    ],
    steps: [
      { num: '01', title: '1. Évaluation gratuite de niveau', desc: 'Une séance découverte 100 % gratuite pour évaluer précisément le niveau de lecture et de mémorisation.' },
      { num: '02', title: '2. Choix de l’enseignant adapté', desc: 'Des enseignantes certifiées dédiées aux femmes et jeunes filles, et des enseignants certifiés pour les hommes et garçons.' },
      { num: '03', title: '3. Séances interactives et révision', desc: 'Récitation en direct, correction immédiate du Tajweed et plan de révision cumulatif structuré.' },
      { num: '04', title: '4. Rapports réguliers et certificats QR', desc: 'Suivi continu pour l’élève et le parent après chaque cours, avec certificats vérifiables par QR code.' },
    ],
  },
  de: {
    pageTitle: 'Über die Wahy Wa Namaa Akademie',
    pageDescription: 'Erfahren Sie mehr über Vision, Mission und Lehrmethodik der Wahy Wa Namaa Akademie.',
    home: 'Startseite',
    eyebrow: 'ÜBER UNS',
    heroTitle: 'Offenbarung lernen. Entwicklung leben.',
    heroSubtitle: 'Wahy Wa Namaa ist eine digitale Koran-Akademie, die authentische Wissensvermittlung mit modernen Werkzeugen für Schüler, Lehrkräfte und Familien verbindet.',
    ctaStart: 'Jetzt starten',
    ctaTeachers: 'Lehrer entdecken',
    howEyebrow: 'SO LERNEN WIR',
    howTitle: 'Unsere Lehrmethodik in 4 klaren Schritten',
    nameEyebrow: 'BEDEUTUNG DES NAMENS',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Wahy steht für die Offenbarung als Quelle unseres Lernens; Namaa steht für nachhaltiges Wachstum in Wissen, Charakter und Beständigkeit.',
    ctaTrial: 'Kostenlose Probestunde buchen',
    values: [
      { title: 'Unsere Mission', text: 'Klares, stufenweises Koranlernen, das fachliche Präzision mit sorgfältiger Begleitung verbindet.' },
      { title: 'Ortsunabhängiges Lernen', text: 'Eine digitale Lernumgebung, mit der Sie flexibel von überall und zu passenden Zeiten lernen.' },
      { title: 'Sorgfalt und Respekt', text: 'Ein ruhiger, respektvoller Lernweg, abgestimmt auf das Alter und die Bedürfnisse jedes Lernenden.' },
      { title: 'Wachstum vor Marketingzahlen', text: 'Wir setzen auf nachvollziehbaren Lernfortschritt statt auf unbelegte Zahlen.' },
    ],
    steps: [
      { num: '01', title: '1. Kostenlose Einstufung', desc: 'Wir beginnen mit einer kostenlosen Probestunde, um Lese- und Auswendiglernniveau genau einzuschätzen.' },
      { num: '02', title: '2. Passende Lehrkraft', desc: 'Zertifizierte Lehrerinnen für Frauen und Mädchen sowie zertifizierte Lehrer für Männer und Jungen.' },
      { num: '03', title: '3. Interaktiver Live-Unterricht', desc: 'Direktes Rezitieren mit sofortiger Aussprache- und Tadschwid-Korrektur sowie strukturiertem Wiederholungsplan.' },
      { num: '04', title: '4. Berichte & QR-Zertifikate', desc: 'Laufende Rückmeldungen für Eltern und Schüler nach jeder Stunde sowie überprüfbare QR-Zertifikate.' },
    ],
  },
  tr: {
    pageTitle: 'Wahy Wa Namaa Akademisi Hakkında',
    pageDescription: 'Wahy Wa Namaa Akademisi’nin vizyonunu, misyonunu ve eğitim metodolojisini keşfedin.',
    home: 'Ana Sayfa',
    eyebrow: 'HAKKIMIZDA',
    heroTitle: 'Öğrenilen Vahiy… Yaşanan Gelişim.',
    heroSubtitle: 'Wahy Wa Namaa; köklü öğretim geleneğini öğrenci, öğretmen ve aileye hizmet eden modern araçlarla birleştiren dijital bir Kur’an akademisidir.',
    ctaStart: 'Yolculuğunuza başlayın',
    ctaTeachers: 'Öğretmenleri incele',
    howEyebrow: 'NASIL ÖĞRENİYORUZ?',
    howTitle: '4 Net Adımda Eğitim Metodolojimiz',
    nameEyebrow: 'İSMİN FELSEFESİ',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Vahiy, ilmimizi aldığımız kaynağı; Nema ise ilimde, ahlakta ve süreklilikte görmek istediğimiz bereketli gelişimi ifade eder.',
    ctaTrial: 'Ücretsiz deneme dersi al',
    values: [
      { title: 'Misyonumuz', text: 'Yetkinlik ve özenli rehberliği bir araya getiren açık ve aşamalı bir Kur’an eğitimi sunmak.' },
      { title: 'Mekân sınırı olmadan öğrenme', text: 'Öğrencinin bulunduğu yerden ve uygun olduğu saatlerde çalışmasına imkân tanıyan dijital deneyim.' },
      { title: 'Şefkat ve saygı', text: 'Her öğrencinin yaşına ve ihtiyacına uygun, huzurlu ve saygılı bir öğrenme yolculuğu.' },
      { title: 'Sayıların önünde gelişim', text: 'Doğrulanmamış tanıtım rakamlarına değil, anlaşılır ve takip edilebilir gerçek ilerlemeye odaklanırız.' },
    ],
    steps: [
      { num: '01', title: '1. Ücretsiz seviye tespiti', desc: 'Okuma ve ezber düzeyinizi doğru belirlemek için %100 ücretsiz bir tanışma dersiyle başlarız.' },
      { num: '02', title: '2. Uygun öğretmen eşleştirmesi', desc: 'Hanımlar ve kız öğrencilere icazetli kadın hocalar, erkekler ve erkek çocuklara icazetli erkek hocalar atarız.' },
      { num: '03', title: '3. Etkileşimli canlı dersler', desc: 'Anlık mahreç ve tecvid düzeltmeli birebir okuma ile düzenli tekrar planı uygularız.' },
      { num: '04', title: '4. Düzenli raporlar ve QR sertifikalar', desc: 'Her ders sonrası veli ve öğrenci takibi ile QR kodla doğrulanabilen resmi bitirme sertifikaları sunarız.' },
    ],
  },
  ur: {
    pageTitle: 'اکیڈمی وحی و نماء کے بارے میں',
    pageDescription: 'اکیڈمی وحی و نماء کے وژن، مشن اور قرآنی تعلیم کے طریقہ کار کے بارے میں جانیں۔',
    home: 'ہوم',
    eyebrow: 'ہمارے بارے میں',
    heroTitle: 'وحی جسے ہم سیکھتے ہیں… اور نمو جسے ہم جیتے ہیں',
    heroSubtitle: 'وحی و نماء ایک جدید ڈیجیٹل قرآنی اکیڈمی ہے جو مستند روایتِ تعلیم کو جدید سہولیات کے ساتھ جوڑ کر طالب علم، استاد اور خاندان سب کی خدمت کرتی ہے۔',
    ctaStart: 'اپنا سفر شروع کریں',
    ctaTeachers: 'اساتذہ دیکھیں',
    howEyebrow: 'ہم کیسے سکھاتے ہیں؟',
    howTitle: '4 واضح مراحل پر مبنی ہمارا تعلیمی منہج',
    nameEyebrow: 'نام کا مفہوم',
    nameTitle: 'وحی و نماء',
    nameBody: 'وحی وہ اصل سرچشمہ ہے جس سے ہم علم حاصل کرتے ہیں، اور نماء وہ مثبت اثر و نمو ہے جو ہم علم، کردار اور تسلسل میں دیکھنا چاہتے ہیں۔',
    ctaTrial: 'مفت تجرباتی کلاس بک کریں',
    values: [
      { title: 'ہمارا مشن', text: 'واضح اور بتدریج قرآنی تعلیم فراہم کرنا جو مہارت اور بہترین رہنمائی کو یکجا کرے۔' },
      { title: 'بلا قیدِ مکان تعلیم', text: 'ایک ڈیجیٹل تجربہ جو طالب علم کو اپنے مقام اور میسر وقت کے مطابق سیکھنے میں مدد دیتا ہے۔' },
      { title: 'نرمی اور احترام', text: 'ہم چاہتے ہیں کہ قرآن کا سفر پُرسکون، باوقار اور ہر طالب علم کی عمر اور ضرورت کے مطابق ہو۔' },
      { title: 'نمود کے بجائے حقیقی ترقی', text: 'ہم غیر مصدقہ دعووں کے بجائے ایسی حقیقی تعلیمی پیش رفت پر توجہ دیتے ہیں جسے سمجھا اور جانچا جا سکے۔' },
    ],
    steps: [
      { num: '01', title: '1. مفت جائزہ اور سطح کا تعین', desc: 'ہم قراءت اور حفظ کی سطح کو درست طور پر سمجھنے کے لیے 100% مفت تعارفی کلاس سے آغاز کرتے ہیں۔' },
      { num: '02', title: '2. موزوں استاد یا معلمہ کا تقرر', desc: 'خواتین اور بچیوں کے لیے مکمل طور پر مستند معلمات، اور مردوں و بچوں کے لیے مجاز اساتذہ مقرر کیے جاتے ہیں۔' },
      { num: '03', title: '3. براہِ راست کلاسز اور پختہ دہرائی', desc: 'حروف کے مخارج اور تجوید کی فوری اصلاح کے ساتھ منظم دہرائی کا منصوبہ تاکہ حفظ مضبوط رہے۔' },
      { num: '04', title: '4. باقاعدہ رپورٹس اور QR اسناد', desc: 'ہر سبق کے بعد والدین اور طالب علم کے لیے مسلسل نگرانی اور QR کوڈ سے قابلِ تصدیق تکمیل اسناد۔' },
    ],
  },
  id: {
    pageTitle: 'Tentang Akademi Wahy Wa Namaa',
    pageDescription: 'Kenali visi, misi, dan metodologi pembelajaran Al-Quran di Akademi Wahy Wa Namaa.',
    home: 'Beranda',
    eyebrow: 'TENTANG KAMI',
    heroTitle: 'Wahyu yang kita pelajari… pertumbuhan yang kita hidupi.',
    heroSubtitle: 'Wahy Wa Namaa adalah akademi Al-Quran digital yang memadukan keaslian sanad pembelajaran dengan perangkat modern bagi pelajar, guru, dan keluarga.',
    ctaStart: 'Mulai perjalanan Anda',
    ctaTeachers: 'Jelajahi guru',
    howEyebrow: 'CARA KAMI BELAJAR',
    howTitle: 'Metodologi Pendidikan Kami dalam 4 Langkah Jelas',
    nameEyebrow: 'FILOSOFI NAMA',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Wahy adalah sumber ilmu yang kita pelajari, dan Namaa adalah pertumbuhan nyata dalam ilmu, akhlak, serta keistiqamahan.',
    ctaTrial: 'Pesan kelas percobaan gratis',
    values: [
      { title: 'Misi kami', text: 'Menghadirkan pembelajaran Al-Quran yang jelas dan bertahap dengan bimbingan yang tepat.' },
      { title: 'Belajar tanpa batas jarak', text: 'Pengalaman digital yang memudahkan pelajar belajar dari mana saja sesuai waktu yang tersedia.' },
      { title: 'Kelembutan dan penghormatan', text: 'Perjalanan belajar Al-Quran yang tenang, penuh hormat, dan sesuai usia serta kebutuhan pelajar.' },
      { title: 'Pertumbuhan di atas angka semu', text: 'Kami berfokus pada kemajuan nyata yang terukur, bukan sekadar angka pemasaran.' },
    ],
    steps: [
      { num: '01', title: '1. Evaluasi gratis & cek level', desc: 'Dimulai dengan sesi perkenalan 100% gratis untuk memetakan kemampuan baca dan hafalan secara akurat.' },
      { num: '02', title: '2. Penentuan guru yang tepat', desc: 'Pengajar wanita bersertifikat khusus untuk muslimah dan anak perempuan, serta pengajar pria untuk pria dan anak laki-laki.' },
      { num: '03', title: '3. Sesi interaktif & murojaah terstruktur', desc: 'Setoran langsung dan koreksi makhraj serta tajwid seketika disertai rencana murojaah kumulatif.' },
      { num: '04', title: '4. Laporan berkala & sertifikat QR', desc: 'Pemantauan berkelanjutan bagi orang tua dan pelajar setelah setiap sesi, lengkap dengan sertifikat terverifikasi QR.' },
    ],
  },
  ms: {
    pageTitle: 'Tentang Akademi Wahy Wa Namaa',
    pageDescription: 'Ketahui visi, misi, dan metodologi pembelajaran Al-Quran di Akademi Wahy Wa Namaa.',
    home: 'Laman Utama',
    eyebrow: 'TENTANG KAMI',
    heroTitle: 'Wahyu yang dipelajari… pertumbuhan yang dihayati.',
    heroSubtitle: 'Wahy Wa Namaa ialah akademi Al-Quran digital yang menggabungkan keaslian pengajian dengan alat moden untuk pelajar, guru, dan keluarga.',
    ctaStart: 'Mulakan perjalanan anda',
    ctaTeachers: 'Layari guru',
    howEyebrow: 'BAGAIMANA KAMI BELAJAR',
    howTitle: 'Metodologi Pendidikan Kami dalam 4 Langkah Jelas',
    nameEyebrow: 'FALSAFAH NAMA',
    nameTitle: 'Wahy Wa Namaa',
    nameBody: 'Wahy ialah sumber ilmu yang kita pelajari, manakala Namaa ialah pertumbuhan yang diharapkan dalam ilmu, akhlak, dan istiqamah.',
    ctaTrial: 'Tempah kelas percubaan percuma',
    values: [
      { title: 'Misi kami', text: 'Menyediakan pembelajaran Al-Quran yang jelas dan berperingkat dengan bimbingan yang teliti.' },
      { title: 'Belajar tanpa sempadan lokasi', text: 'Pengalaman digital yang membantu pelajar belajar dari mana sahaja mengikut masa yang sesuai.' },
      { title: 'Keprihatinan dan rasa hormat', text: 'Perjalanan belajar Al-Quran yang tenang, dihormati, serta sesuai dengan usia dan keperluan pelajar.' },
      { title: 'Pertumbuhan mengatasi angka kosong', text: 'Kami menumpukan kepada kemajuan sebenar yang boleh dipantau, bukan angka pemasaran yang tidak disahkan.' },
    ],
    steps: [
      { num: '01', title: '1. Penilaian percuma & semakan tahap', desc: 'Bermula dengan sesi pengenalan 100% percuma untuk menilai tahap bacaan dan hafazan dengan tepat.' },
      { num: '02', title: '2. Padanan guru yang sesuai', desc: 'Guru wanita bertauliah khas untuk wanita dan kanak-kanak perempuan, dan guru lelaki untuk lelaki dan kanak-kanak lelaki.' },
      { num: '03', title: '3. Sesi interaktif & ulangan terancang', desc: 'Bacaan langsung dan pembetulan makhraj serta tajwid serta-merta bersama pelan ulangan berkala.' },
      { num: '04', title: '4. Laporan berkala & sijil QR', desc: 'Pemantauan berterusan untuk ibu bapa dan pelajar selepas setiap kelas bersama sijil rasmi yang boleh disahkan melalui kod QR.' },
    ],
  },
  ku: {
    pageTitle: 'دەربارەی ئەکادیمیای وەحی و نەما',
    pageDescription: 'ڕوانگە، پەیام و میتۆدی فێرکاری ئەکادیمیای وەحی و نەما بناسە.',
    home: 'سەرەکی',
    eyebrow: 'دەربارەی ئێمە',
    heroTitle: 'وەحیێک فێری دەبین… و گەشەیەک پێی دەژین',
    heroSubtitle: 'وەحی و نەما ئەکادیمیایەکی دیجیتاڵی قورئانییە کە ڕەسەنایەتی وەرگرتن لەگەڵ ئامرازە نوێیەکان کۆدەکاتەوە بۆ خزمەتی قوتابی، مامۆستا و خێزان.',
    ctaStart: 'گەشتەکەت دەست پێ بکە',
    ctaTeachers: 'مامۆستایان ببینە',
    howEyebrow: 'چۆن پێکەوە فێر دەبین؟',
    howTitle: 'میتۆدی فێرکاریمان لە ٤ هەنگاوی ڕووندا',
    nameEyebrow: 'فەلسەفەی ناوەکە',
    nameTitle: 'وەحی و نەما',
    nameBody: 'وەحی ئەو سەرچاوەیەیە کە لێوەی فێر دەبین، و نەما ئەو گەشەیەیە کە دەخوازین لە زانست، ڕەوشت و بەردەوامیدا دەربکەوێت.',
    ctaTrial: 'وانەی تاقیکاری بەخۆڕایی تۆمار بکە',
    values: [
      { title: 'پەیاممان', text: 'پێشکەشکردنی فێرکردنێکی قورئانی ڕوون و پلەبەند کە وردەکاری و ڕێنمایی باش کۆدەکاتەوە.' },
      { title: 'فێربوون بێ سنووری شوێن', text: 'ئەزموونێکی دیجیتاڵی کە یارمەتی قوتابی دەدات لە شوێنی خۆیەوە و بەپێی کاتی بەردەستی فێربێت.' },
      { title: 'نەرمی و ڕێزگرتن', text: 'دەمانەوێت گەشتی قورئان ئارام و بەڕێز بێت و گونجاو بێت لەگەڵ تەمەن و پێداویستی قوتابی.' },
      { title: 'گەشەکردن پێش ژمارەکان', text: 'سەرنجمان لەسەر پێشکەوتنی ڕاستەقینەی شوێنکەوتراوە نەک ژمارەی بازاڕگەری بێ بەڵگە.' },
    ],
    steps: [
      { num: '٠١', title: '١. هەڵسەنگاندنی بەخۆڕایی و دیاریکردنی ئاست', desc: 'بە وانەیەکی تاقیکاری ١٠٠٪ بەخۆڕایی دەست پێ دەکەین بۆ تێگەیشتن لە ئاستی خوێندنەوە و لەبەرکردن.' },
      { num: '٠٢', title: '٢. دیاریکردنی مامۆستای گونجاو', desc: 'مامۆستایانی ژنی مۆڵەتپێدراو بۆ بەشی خانمان و کچان، و مامۆستایانی پیاوی مۆڵەتپێدراو بۆ پیاوان و کوڕان.' },
      { num: '٠٣', title: '٣. وانەی کارلێکی ڕاستەوخۆ و چەسپاندن', desc: 'خوێندنەوەی ڕاستەوخۆ و ڕاستکردنەوەی دەستبەجێی مەخرەج و تەجوید لەگەڵ پلانی پێداچوونەوە.' },
      { num: '٠٤', title: '٤. ڕاپۆرتی بەردەوام و بڕوانامەی باوەڕپێکراو', desc: 'چاودێری بەردەوام بۆ بەخێوکەر و قوتابی دوای هەر وانەیەک، لەگەڵ بڕوانامەی پشتڕاستکراو بە QR.' },
    ],
  },
};

const VALUE_ICONS = [Target, Globe, Heart, Sprout];
const STEP_ICONS = [Sparkles, ShieldCheck, BookOpenCheck, Award];

export default function About() {
  const { locale, isRTL, dir, t } = useI18n();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const lp = (path) => localizedPath(path, locale);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = ABOUT_COPY[locale] || ABOUT_COPY.en;

  return (
    <>
      <SEOHead
        page={{
          title: copy.pageTitle,
          description: copy.pageDescription,
          url: '/about',
          type: 'website',
          schema: [
            createWebPageSchema({
              name: copy.pageTitle,
              description: copy.pageDescription,
              url: '/about',
              type: 'AboutPage',
            }),
            createBreadcrumbSchema([
              { name: t.common?.home || copy.home, url: '/' },
              { name: copy.pageTitle, url: '/about' },
            ]),
          ],
        }}
      />
      <GlobalHeader />

      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} aria-hidden="true" /> {t.common?.about || copy.eyebrow}
              </span>
              <h1>{copy.heroTitle}</h1>
              <p>{copy.heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={lp('/start')} className="wn-btn wn-btn--accent min-h-[44px]">
                  {copy.ctaStart}
                  <ArrowIcon size={16} aria-hidden="true" />
                </Link>
                <Link to={lp('/teachers')} className="wn-btn wn-btn--secondary min-h-[44px]">
                  <Users size={16} aria-hidden="true" />
                  {t.hero?.cta2 || copy.ctaTeachers}
                </Link>
              </div>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core">
                <BookOpenCheck size={46} strokeWidth={1.25} />
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          <div className="wn-public-feature-grid">
            {copy.values.map(({ title, text }, index) => {
              const Icon = VALUE_ICONS[index];
              return (
                <motion.article
                  key={title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="wn-public-feature-card"
                >
                  <span>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.article>
              );
            })}
          </div>

          <div className="mt-10">
            <div className="mb-5 text-center">
              <span className="wn-public-eyebrow">
                <Sparkles size={14} aria-hidden="true" /> {copy.howEyebrow}
              </span>
              <h2 className="mt-1 font-display text-2xl md:text-3xl font-bold text-[var(--wn-heading)]">
                {copy.howTitle}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {copy.steps.map(({ num, title, desc }, index) => {
                const Icon = STEP_ICONS[index];
                return (
                  <article
                    key={num}
                    className="rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface)] p-5 shadow-sm transition hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="font-display text-xl font-black text-[var(--wn-text-gold)] opacity-80">
                        {num}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[var(--wn-heading)]">{title}</h3>
                    <p className="mt-2 text-xs leading-6 text-[var(--wn-text-secondary)]">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-8 wn-public-track-banner">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{copy.nameEyebrow}</span>
                <h2>{copy.nameTitle}</h2>
                <p>{copy.nameBody}</p>
              </div>
              <Link to={lp('/free-trial')} className="wn-btn wn-btn--accent shrink-0 min-h-[44px]">
                {t.common?.freeTrial || copy.ctaTrial}
                <ArrowIcon size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
