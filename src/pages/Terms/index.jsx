import { FileText, Sparkles } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import '../../styles/public-experience.css';

const TERMS_COPY = {
  ar: {
    seoTitle: 'الشروط والأحكام',
    seoDescription: 'الشروط العامة لاستخدام أكاديمية وحي ونماء.',
    eyebrow: 'الاستخدام والخدمة',
    title: 'الشروط والأحكام',
    lead: 'شروط عامة لتنظيم استخدام الحسابات والخدمات التعليمية داخل أكاديمية وحي ونماء.',
    sections: [
      {
        heading: 'استخدام المنصة',
        body: 'تُستخدم المنصة لأغراض التعلم والتواصل المرتبط بالخدمات المتاحة، مع الالتزام بعدم إساءة الاستخدام أو تعطيل الخدمة أو التعدي على حسابات الآخرين.',
      },
      {
        heading: 'الحسابات',
        body: 'المستخدم مسؤول عن الحفاظ على سرية بيانات الدخول وعدم مشاركة كلمة المرور. يجب تقديم بيانات صحيحة بالقدر اللازم لتقديم الخدمة.',
      },
      {
        heading: 'المحتوى التعليمي',
        body: 'إتاحة دورة أو درس أو شهادة أو ميزة معينة تعتمد على حالة الحساب والبرنامج والبيانات الفعلية المسجلة في النظام.',
      },
      {
        heading: 'الحجوزات والمدفوعات',
        body: 'أي سعر أو سياسة إلغاء أو استرداد تكون هي المعلومات المعروضة للمستخدم في مسار الحجز أو الدفع المعني وقت تنفيذ العملية. لا تفترض هذه الصفحة مدة استرداد ثابتة.',
      },
      {
        heading: 'التحديثات',
        body: 'قد تتغير وظائف المنصة وهذه الشروط مع تطور الخدمة. النسخة المنشورة على الموقع هي المرجع المتاح للمستخدم وقت الزيارة.',
      },
    ],
  },
  en: {
    seoTitle: 'Terms & Conditions',
    seoDescription: 'General terms governing the use of Wahy Wa Namaa Academy services.',
    eyebrow: 'Usage & Service',
    title: 'Terms & Conditions',
    lead: 'General terms regulating accounts, bookings, and educational services at Wahy Wa Namaa Academy.',
    sections: [
      {
        heading: 'Platform Usage',
        body: 'The platform is intended for learning and communication related to available educational services. Users must not misuse, disrupt the service, or interfere with other accounts.',
      },
      {
        heading: 'Accounts',
        body: 'You are responsible for safeguarding your login credentials and never sharing your password. Accurate information must be provided to the extent required to deliver the service.',
      },
      {
        heading: 'Educational Content',
        body: 'Availability of any course, lesson, certificate, or feature depends on account standing, program enrollment, and verified system records.',
      },
      {
        heading: 'Bookings & Payments',
        body: 'Displayed pricing, cancellation rules, and refund terms are those presented in the relevant booking or checkout flow at the time of the transaction.',
      },
      {
        heading: 'Updates',
        body: 'Platform features and these terms may evolve as services grow. The version published on the site at the time of your visit serves as the active reference.',
      },
    ],
  },
  fr: {
    seoTitle: 'Conditions générales',
    seoDescription: 'Conditions générales d’utilisation de l’Académie Wahy Wa Namaa.',
    eyebrow: 'Utilisation et service',
    title: 'Conditions générales',
    lead: 'Conditions générales régissant l’utilisation des comptes et des services éducatifs de l’Académie Wahy Wa Namaa.',
    sections: [
      {
        heading: 'Utilisation de la plateforme',
        body: 'La plateforme est destinée à l’apprentissage et aux échanges liés aux services proposés, sans abus ni perturbation du service ou atteinte aux comptes d’autrui.',
      },
      {
        heading: 'Comptes',
        body: 'L’utilisateur est responsable de la confidentialité de ses identifiants et doit fournir des informations exactes dans la mesure nécessaire au service.',
      },
      {
        heading: 'Contenu pédagogique',
        body: 'L’accès à un cours, une leçon, un certificat ou une fonctionnalité dépend de l’état du compte, du programme et des données enregistrées.',
      },
      {
        heading: 'Réservations et paiements',
        body: 'Les tarifs ainsi que les conditions d’annulation ou de remboursement applicables sont ceux affichés lors de la réservation ou du paiement.',
      },
      {
        heading: 'Mises à jour',
        body: 'Les fonctionnalités et ces conditions peuvent évoluer avec le service. La version publiée sur le site fait foi lors de la visite.',
      },
    ],
  },
  de: {
    seoTitle: 'Nutzungsbedingungen',
    seoDescription: 'Allgemeine Nutzungsbedingungen der Wahy Wa Namaa Akademie.',
    eyebrow: 'Nutzung & Service',
    title: 'Nutzungsbedingungen',
    lead: 'Allgemeine Bedingungen für die Nutzung von Konten und Bildungsangeboten der Wahy Wa Namaa Akademie.',
    sections: [
      {
        heading: 'Nutzung der Plattform',
        body: 'Die Plattform dient dem Lernen und der Kommunikation rund um die angebotenen Dienste. Missbrauch, Störungen oder Eingriffe in fremde Konten sind untersagt.',
      },
      {
        heading: 'Konten',
        body: 'Nutzer sind für die Geheimhaltung ihrer Zugangsdaten verantwortlich und müssen die für den Dienst erforderlichen Angaben wahrheitsgemäß machen.',
      },
      {
        heading: 'Lerninhalte',
        body: 'Die Verfügbarkeit eines Kurses, einer Lektion, eines Zertifikats oder einer Funktion richtet sich nach Kontostatus, Programm und Systemdaten.',
      },
      {
        heading: 'Buchungen & Zahlungen',
        body: 'Preise sowie Stornierungs- und Erstattungsbedingungen entsprechen den Angaben im jeweiligen Buchungs- oder Zahlungsablauf zum Zeitpunkt der Transaktion.',
      },
      {
        heading: 'Aktualisierungen',
        body: 'Funktionen und diese Bedingungen können sich im Zuge der Weiterentwicklung ändern. Maßgeblich ist die zum Besuchszeitpunkt veröffentlichte Fassung.',
      },
    ],
  },
  tr: {
    seoTitle: 'Kullanım Şartları',
    seoDescription: 'Wahy Wa Namaa Akademisi hizmetlerinin genel kullanım şartları.',
    eyebrow: 'Kullanım ve Hizmet',
    title: 'Kullanım Şartları',
    lead: 'Wahy Wa Namaa Akademisi bünyesindeki hesapların ve eğitim hizmetlerinin kullanımını düzenleyen genel şartlar.',
    sections: [
      {
        heading: 'Platform Kullanımı',
        body: 'Platform, sunulan eğitim hizmetleriyle bağlantılı öğrenim ve iletişim amaçlıdır; kötüye kullanım, hizmeti aksatma veya başkalarının hesaplarına müdahale yasaktır.',
      },
      {
        heading: 'Hesaplar',
        body: 'Kullanıcı giriş bilgilerinin gizliliğini korumaktan ve hizmeti sunmak için gereken ölçüde doğru bilgi vermekten sorumludur.',
      },
      {
        heading: 'Eğitim İçeriği',
        body: 'Herhangi bir kurs, ders, sertifika veya özelliğin erişilebilirliği hesap durumuna, programa ve sistemdeki gerçek kayıtlara bağlıdır.',
      },
      {
        heading: 'Rezervasyonlar ve Ödemeler',
        body: 'Ücret, iptal veya iade koşulları işlem anında ilgili rezervasyon ya da ödeme akışında kullanıcıya gösterilen bilgilere tabidir.',
      },
      {
        heading: 'Güncellemeler',
        body: 'Hizmet geliştikçe platform özellikleri ve bu şartlar güncellenebilir. Ziyaret anında sitede yayımlanan sürüm geçerlidir.',
      },
    ],
  },
  ur: {
    seoTitle: 'شرائط و ضوابط',
    seoDescription: 'وحی و نما اکیڈمی کے استعمال کی عمومی شرائط و ضوابط۔',
    eyebrow: 'استعمال اور سروس',
    title: 'شرائط و ضوابط',
    lead: 'وحی و نما اکیڈمی میں اکاؤنٹس اور تعلیمی خدمات کے استعمال کو منظم کرنے والی عمومی شرائط۔',
    sections: [
      {
        heading: 'پلیٹ فارم کا استعمال',
        body: 'یہ پلیٹ فارم دستیاب تعلیمی خدمات سے متعلق سیکھنے اور رابطے کے لیے استعمال ہوتا ہے؛ غلط استعمال، سروس میں خلل ڈالنے یا دوسروں کے اکاؤنٹس میں مداخلت کی اجازت نہیں ہے۔',
      },
      {
        heading: 'اکاؤنٹس',
        body: 'صارف اپنے لاگ ان ڈیٹا کو خفیہ رکھنے کا ذمہ دار ہے اور سروس کی فراہمی کے لیے ضروری درست معلومات فراہم کرنا ضروری ہے۔',
      },
      {
        heading: 'تعلیمی مواد',
        body: 'کسی کورس، سبق، سرٹیفکیٹ یا فیچر کی دستیابی اکاؤنٹ کی حیثیت، پروگرام اور نظام میں درج حقیقی ریکارڈ پر منحصر ہے۔',
      },
      {
        heading: 'بکنگ اور ادائیگیاں',
        body: 'کوئی بھی قیمت، منسوخی یا واپسی کی پالیسی وہی ہوگی جو لین دین کے وقت متعلقہ بکنگ یا ادائیگی کے مرحلے میں صارف کو دکھائی جائے۔',
      },
      {
        heading: 'اپ ڈیٹس',
        body: 'سروس کی ترقی کے ساتھ پلیٹ فارم کی خصوصیات اور یہ شرائط تبدیل ہو سکتی ہیں۔ وزٹ کے وقت ویب سائٹ پر شائع شدہ ورژن ہی معتبر ہوگا۔',
      },
    ],
  },
  id: {
    seoTitle: 'Syarat & Ketentuan',
    seoDescription: 'Ketentuan umum penggunaan layanan Akademi Wahy Wa Namaa.',
    eyebrow: 'Penggunaan & Layanan',
    title: 'Syarat & Ketentuan',
    lead: 'Ketentuan umum yang mengatur penggunaan akun dan layanan pembelajaran di Akademi Wahy Wa Namaa.',
    sections: [
      {
        heading: 'Penggunaan Platform',
        body: 'Platform digunakan untuk tujuan pembelajaran dan komunikasi terkait layanan yang tersedia, tanpa penyalahgunaan, gangguan layanan, atau pelanggaran terhadap akun lain.',
      },
      {
        heading: 'Akun',
        body: 'Pengguna bertanggung jawab menjaga kerahasiaan data masuk dan tidak membagikan kata sandi, serta memberikan data yang benar sesuai kebutuhan layanan.',
      },
      {
        heading: 'Konten Pembelajaran',
        body: 'Ketersediaan kursus, pelajaran, sertifikat, atau fitur bergantung pada status akun, program, dan data resmi yang tercatat di sistem.',
      },
      {
        heading: 'Pemesanan & Pembayaran',
        body: 'Harga, kebijakan pembatalan, dan pengembalian dana mengikuti informasi yang ditampilkan kepada pengguna pada alur pemesanan atau pembayaran terkait saat transaksi dilakukan.',
      },
      {
        heading: 'Pembaruan',
        body: 'Fitur platform dan ketentuan ini dapat berubah seiring pengembangan layanan. Versi yang dipublikasikan saat kunjungan menjadi acuan yang berlaku.',
      },
    ],
  },
  ms: {
    seoTitle: 'Terma & Syarat',
    seoDescription: 'Terma umum penggunaan perkhidmatan Akademi Wahy Wa Namaa.',
    eyebrow: 'Penggunaan & Perkhidmatan',
    title: 'Terma & Syarat',
    lead: 'Terma umum yang mengawal penggunaan akaun dan perkhidmatan pendidikan di Akademi Wahy Wa Namaa.',
    sections: [
      {
        heading: 'Penggunaan Platform',
        body: 'Platform ini digunakan untuk tujuan pembelajaran dan komunikasi berkaitan perkhidmatan yang tersedia, dengan mematuhi larangan penyalahgunaan atau gangguan terhadap akaun lain.',
      },
      {
        heading: 'Akaun',
        body: 'Pengguna bertanggungjawab menjaga kerahsiaan maklumat log masuk serta memberikan butiran yang tepat setakat yang diperlukan untuk perkhidmatan.',
      },
      {
        heading: 'Kandungan Pendidikan',
        body: 'Ketersediaan kursus, pelajaran, sijil atau ciri tertentu bergantung kepada status akaun, program dan rekod sebenar dalam sistem.',
      },
      {
        heading: 'Tempahan & Pembayaran',
        body: 'Sebarang harga, polisi pembatalan atau bayaran balik adalah mengikut maklumat yang dipaparkan kepada pengguna dalam aliran tempahan atau pembayaran semasa transaksi dibuat.',
      },
      {
        heading: 'Kemas Kini',
        body: 'Fungsi platform dan terma ini boleh berubah selaras dengan perkembangan perkhidmatan. Versi yang diterbitkan di laman web semasa lawatan merupakan rujukan rasmi.',
      },
    ],
  },
  ku: {
    seoTitle: 'مەرج و ڕێساکان',
    seoDescription: 'مەرجە گشتییەکانی بەکارهێنانی خزمەتگوزارییەکانی ئەکادیمیای وەحی و نەما.',
    eyebrow: 'بەکارهێنان و خزمەتگوزاری',
    title: 'مەرج و ڕێساکان',
    lead: 'مەرجە گشتییەکان بۆ ڕێکخستنی بەکارهێنانی هەژمار و خزمەتگوزارییە فێرکارییەکان لە ئەکادیمیای وەحی و نەما.',
    sections: [
      {
        heading: 'بەکارهێنانی پلاتفۆرم',
        body: 'پلاتفۆرمەکە بۆ مەبەستی فێربوون و پەیوەندیکردن بە خزمەتگوزارییە بەردەستەکان بەکاردێت، بە پابەندبوون بە بەکارنەهێنانی خراپ یان پەکخستنی خزمەتگوزاری.',
      },
      {
        heading: 'هەژمارەکان',
        body: 'بەکارهێنەر بەرپرسیارە لە پاراستنی نهێنی زانیارییەکانی چوونەژوورەوە و پێویستە زانیاری دروست پێشکەش بکات بەپێی پێویستی خزمەتگوزارییەکە.',
      },
      {
        heading: 'ناوەڕۆکی فێرکاری',
        body: 'بەردەستبوونی هەر خول، وانە، بڕوانامە یان تایبەتمەندییەک پشت دەبەستێت بە دۆخی هەژمار، بەرنامە و تۆمارە فەرمییەکانی ناو سیستەم.',
      },
      {
        heading: 'نۆرەگرتن و پارەدان',
        body: 'هەر نرخێک یان سیاسەتی هەڵوەشاندنەوە و گەڕاندنەوەی پارە ئەو زانیاریانەن کە لە کاتی ئەنجامدانی کردارەکەدا لە ڕێڕەوی نۆرەگرتن یان پارەداندا پیشان دەدرێن.',
      },
      {
        heading: 'نوێکارییەکان',
        body: 'تایبەتمەندییەکانی پلاتفۆرم و ئەم مەرجانە لەگەڵ پەرەسەندنی خزمەتگوزاری دەگۆڕێن. ئەو وەشانەی لە کاتی سەرداندا بڵاوکراوەتەوە سەرچاوەی فەرمییە.',
      },
    ],
  },
};

export default function Terms() {
  const { locale, dir, isRTL } = useI18n();
  const copy = TERMS_COPY[locale] || (isRTL ? TERMS_COPY.ar : TERMS_COPY.en);

  return (
    <>
      <SEOHead page={{ title: copy.seoTitle, description: copy.seoDescription, url: '/terms' }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} /> {copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.lead}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core"><FileText size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <section className="wn-editorial-wrap">
          <div className="wn-editorial-card">
            {copy.sections.map((sec, idx) => (
              <div key={idx}>
                <h2>{sec.heading}</h2>
                <p>{sec.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
