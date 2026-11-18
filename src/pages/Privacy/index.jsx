import { ShieldCheck, Sparkles } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import '../../styles/public-experience.css';

const PRIVACY_COPY = {
  ar: {
    seoTitle: 'سياسة الخصوصية',
    seoDescription: 'معلومات عامة عن تعامل أكاديمية وحي ونماء مع بيانات المستخدمين.',
    eyebrow: 'الخصوصية والبيانات',
    title: 'سياسة الخصوصية',
    lead: 'توضح هذه الصفحة بصورة عامة أنواع البيانات التي قد تحتاجها المنصة لتقديم الخدمة وكيفية استخدامها.',
    collectHeading: 'البيانات التي قد نجمعها',
    collectItems: [
      'بيانات الحساب مثل الاسم والبريد الإلكتروني ورقم الهاتف عند إدخاله.',
      'بيانات الدراسة والتقدم والجلسات اللازمة لتقديم خدمات التعلم.',
      'ملفات أو تسجيلات يرفعها المستخدم عندما تتطلب ميزة تعليمية ذلك.',
    ],
    useHeading: 'استخدام البيانات',
    useBody: 'تُستخدم البيانات لتشغيل الحساب، تقديم الخدمات التعليمية، المتابعة، الدعم، وتحسين وظائف المنصة.',
    shareHeading: 'مشاركة البيانات والوصول إليها',
    shareBody: 'الوصول إلى البيانات يجب أن يكون في حدود ما تتطلبه الخدمة ودور المستخدم. لا ترسل كلمات المرور أو بيانات الدفع من خلال نماذج التواصل العامة.',
    requestsHeading: 'طلبات المستخدم',
    requestsBody: 'يمكن إرسال استفسار أو طلب متعلق بالبيانات من صفحة التواصل، وسيتم التعامل معه وفق الإمكانات والسياسات المعمول بها وقت الطلب.',
  },
  en: {
    seoTitle: 'Privacy Policy',
    seoDescription: 'Overview of how Wahy Wa Namaa Academy collects, uses, and protects user information.',
    eyebrow: 'Privacy & Data',
    title: 'Privacy Policy',
    lead: 'This page outlines the general categories of data the platform may require to deliver educational services and how it is handled.',
    collectHeading: 'Information We May Collect',
    collectItems: [
      'Account details such as your name, email address, and phone number when provided.',
      'Study, progress, and session scheduling records required to deliver learning services.',
      'Files or audio recordings uploaded by the user when an educational feature requires them.',
    ],
    useHeading: 'How We Use Information',
    useBody: 'Information is used to operate your account, deliver classes, track educational progress, provide support, and improve platform reliability.',
    shareHeading: 'Data Access & Sharing',
    shareBody: 'Access to personal information is restricted to what the service and your user role require. Never send passwords or payment credentials through public contact forms.',
    requestsHeading: 'User Data Requests',
    requestsBody: 'You may submit data inquiries or requests via the contact page, and they will be handled according to applicable academy policies.',
  },
  fr: {
    seoTitle: 'Politique de confidentialité',
    seoDescription: 'Informations sur le traitement des données des utilisateurs par l’Académie Wahy Wa Namaa.',
    eyebrow: 'Confidentialité et données',
    title: 'Politique de confidentialité',
    lead: 'Cette page décrit de manière générale les données nécessaires au fonctionnement de la plateforme et leur utilisation.',
    collectHeading: 'Données susceptibles d’être collectées',
    collectItems: [
      'Informations de compte telles que le nom, l’adresse e-mail et le numéro de téléphone.',
      'Données d’apprentissage, de progression et de séances nécessaires au suivi pédagogique.',
      'Fichiers ou enregistrements envoyés par l’utilisateur lorsqu’une fonctionnalité pédagogique l’exige.',
    ],
    useHeading: 'Utilisation des données',
    useBody: 'Les données servent à gérer le compte, dispenser les cours, assurer le suivi, répondre aux demandes d’assistance et améliorer la plateforme.',
    shareHeading: 'Accès et partage des données',
    shareBody: 'L’accès aux données reste limité aux besoins du service et au rôle de chaque utilisateur. Ne transmettez jamais de mots de passe ni de données bancaires via les formulaires publics.',
    requestsHeading: 'Demandes des utilisateurs',
    requestsBody: 'Toute demande relative à vos données peut être envoyée via la page de contact et sera traitée selon les politiques en vigueur.',
  },
  de: {
    seoTitle: 'Datenschutzerklärung',
    seoDescription: 'Allgemeine Hinweise zum Umgang der Wahy Wa Namaa Akademie mit Nutzerdaten.',
    eyebrow: 'Datenschutz & Daten',
    title: 'Datenschutzerklärung',
    lead: 'Diese Seite erläutert allgemein, welche Daten die Plattform zur Bereitstellung der Lernangebote benötigt und wie sie verarbeitet werden.',
    collectHeading: 'Daten, die wir erheben können',
    collectItems: [
      'Kontodaten wie Name, E-Mail-Adresse und Telefonnummer, sofern angegeben.',
      'Lern-, Fortschritts- und Sitzungsdaten zur Durchführung des Unterrichts.',
      'Dateien oder Aufnahmen, die Nutzer für bestimmte Lernfunktionen hochladen.',
    ],
    useHeading: 'Verwendung der Daten',
    useBody: 'Die Daten dienen dem Kontobetrieb, der Durchführung von Kursen, der Lernbegleitung, dem Support und der Verbesserung der Plattform.',
    shareHeading: 'Datenzugriff & Weitergabe',
    shareBody: 'Der Zugriff auf Daten ist auf das für den Dienst und die jeweilige Nutzerrolle Erforderliche beschränkt. Senden Sie niemals Passwörter oder Zahlungsdaten über öffentliche Kontaktformulare.',
    requestsHeading: 'Nutzeranfragen',
    requestsBody: 'Anfragen zu Ihren Daten können über die Kontaktseite eingereicht werden und werden gemäß den geltenden Richtlinien bearbeitet.',
  },
  tr: {
    seoTitle: 'Gizlilik Politikası',
    seoDescription: 'Wahy Wa Namaa Akademisi kullanıcı verilerinin işlenmesi hakkında genel bilgilendirme.',
    eyebrow: 'Gizlilik ve Veriler',
    title: 'Gizlilik Politikası',
    lead: 'Bu sayfa, eğitim hizmetlerinin sunulabilmesi için platformun ihtiyaç duyabileceği veri türlerini ve kullanım esaslarını özetler.',
    collectHeading: 'Toplanabilecek Veriler',
    collectItems: [
      'Ad, e-posta adresi ve girildiğinde telefon numarası gibi hesap bilgileri.',
      'Eğitim hizmetlerinin sunulması için gereken ders, ilerleme ve oturum kayıtları.',
      'Eğitsel bir özelliğin gerektirmesi hâlinde kullanıcı tarafından yüklenen dosya veya kayıtlar.',
    ],
    useHeading: 'Verilerin Kullanımı',
    useBody: 'Veriler; hesabı işletmek, dersleri sunmak, ilerlemeyi takip etmek, destek sağlamak ve platformu geliştirmek amacıyla kullanılır.',
    shareHeading: 'Veri Erişimi ve Paylaşımı',
    shareBody: 'Verilere erişim yalnızca hizmetin ve kullanıcı rolünün gerektirdiği ölçüde sınırlandırılır. Genel iletişim formlarından asla şifre veya ödeme bilgisi göndermeyin.',
    requestsHeading: 'Kullanıcı Talepleri',
    requestsBody: 'Verilerle ilgili soru veya taleplerinizi iletişim sayfası üzerinden iletebilirsiniz; talebiniz geçerli politikalar çerçevesinde değerlendirilir.',
  },
  ur: {
    seoTitle: 'رازداری کی پالیسی',
    seoDescription: 'وحی و نما اکیڈمی میں صارفین کے ڈیٹا کے استعمال اور تحفظ سے متعلق عمومی معلومات۔',
    eyebrow: 'رازداری اور ڈیٹا',
    title: 'رازداری کی پالیسی',
    lead: 'یہ صفحہ عمومی طور پر واضح کرتا ہے کہ تعلیمی خدمات فراہم کرنے کے لیے پلیٹ فارم کو کس قسم کے ڈیٹا کی ضرورت ہو سکتی ہے اور اسے کیسے استعمال کیا جاتا ہے۔',
    collectHeading: 'وہ معلومات جو ہم جمع کر سکتے ہیں',
    collectItems: [
      'اکاؤنٹ کی تفصیلات جیسے نام، ای میل ایڈریس، اور فراہم کردہ فون نمبر۔',
      'تعلیمی خدمات کی فراہمی کے لیے ضروری مطالعہ، پیش رفت اور سیشن کا ریکارڈ۔',
      'وہ فائلیں یا آڈیو ریکارڈنگز جو صارف کسی تعلیمی فیچر کے لیے اپ لوڈ کرے۔',
    ],
    useHeading: 'ڈیٹا کا استعمال',
    useBody: 'معلومات اکاؤنٹ چلانے، تعلیمی خدمات فراہم کرنے، نگرانی، سپورٹ اور پلیٹ فارم کی کارکردگی بہتر بنانے کے لیے استعمال کی جاتی ہیں۔',
    shareHeading: 'ڈیٹا تک رسائی اور اشتراک',
    shareBody: 'ڈیٹا تک رسائی صرف سروس اور صارف کے کردار کی ضرورت تک محدود رہتی ہے۔ عوامی رابطہ فارمز کے ذریعے کبھی پاس ورڈ یا ادائیگی کی تفصیلات نہ بھیجیں۔',
    requestsHeading: 'صارف کی درخواستیں',
    requestsBody: 'آپ رابطہ صفحہ کے ذریعے اپنے ڈیٹا سے متعلق استفسار یا درخواست بھیج سکتے ہیں جس پر مروجہ پالیسیوں کے مطابق کارروائی کی جائے گی۔',
  },
  id: {
    seoTitle: 'Kebijakan Privasi',
    seoDescription: 'Informasi umum mengenai cara Akademi Wahy Wa Namaa mengelola dan melindungi data pengguna.',
    eyebrow: 'Privasi & Data',
    title: 'Kebijakan Privasi',
    lead: 'Halaman ini menjelaskan secara umum jenis data yang mungkin diperlukan platform untuk menyediakan layanan pembelajaran dan cara penggunaannya.',
    collectHeading: 'Data yang Dapat Kami Kumpulkan',
    collectItems: [
      'Data akun seperti nama, alamat email, dan nomor telepon jika diisi.',
      'Data belajar, perkembangan, dan jadwal sesi yang diperlukan untuk layanan pembelajaran.',
      'Berkas atau rekaman yang diunggah pengguna apabila dibutuhkan oleh fitur pembelajaran.',
    ],
    useHeading: 'Penggunaan Data',
    useBody: 'Data digunakan untuk mengoperasikan akun, menyelenggarakan pembelajaran, memantau perkembangan, memberikan dukungan, dan meningkatkan layanan.',
    shareHeading: 'Akses & Berbagi Data',
    shareBody: 'Akses terhadap data dibatasi sesuai kebutuhan layanan dan peran pengguna. Jangan pernah mengirim kata sandi atau data pembayaran melalui formulir kontak umum.',
    requestsHeading: 'Permintaan Pengguna',
    requestsBody: 'Pertanyaan atau permintaan terkait data dapat dikirim melalui halaman kontak dan akan ditangani sesuai kebijakan yang berlaku.',
  },
  ms: {
    seoTitle: 'Dasar Privasi',
    seoDescription: 'Maklumat umum tentang cara Akademi Wahy Wa Namaa mengurus dan melindungi data pengguna.',
    eyebrow: 'Privasi & Data',
    title: 'Dasar Privasi',
    lead: 'Halaman ini menerangkan secara umum jenis data yang mungkin diperlukan oleh platform untuk menyediakan perkhidmatan pembelajaran dan cara penggunaannya.',
    collectHeading: 'Data yang Mungkin Kami Kumpul',
    collectItems: [
      'Maklumat akaun seperti nama, alamat e-mel, dan nombor telefon apabila dimasukkan.',
      'Rekod pembelajaran, kemajuan, dan sesi yang diperlukan untuk penyampaian pembelajaran.',
      'Fail atau rakaman yang dimuat naik pengguna apabila diperlukan oleh ciri pembelajaran.',
    ],
    useHeading: 'Penggunaan Data',
    useBody: 'Data digunakan untuk mengendalikan akaun, menyampaikan kelas, memantau kemajuan, memberi sokongan, dan menambah baik fungsi platform.',
    shareHeading: 'Akses & Perkongsian Data',
    shareBody: 'Akses kepada data dihadkan mengikut keperluan perkhidmatan dan peranan pengguna. Jangan sesekali menghantar kata laluan atau maklumat pembayaran melalui borang hubungan awam.',
    requestsHeading: 'Permintaan Pengguna',
    requestsBody: 'Sebarang pertanyaan atau permintaan berkaitan data boleh dihantar melalui halaman hubungi kami dan akan diproses mengikut dasar yang berkuat kuasa.',
  },
  ku: {
    seoTitle: 'سیاسەتی پاراستنی نهێنی',
    seoDescription: 'زانیاری گشتی دەربارەی چۆنیەتی مامەڵەکردنی ئەکادیمیای وەحی و نەما لەگەڵ داتای بەکارهێنەران.',
    eyebrow: 'نهێنی و داتا',
    title: 'سیاسەتی پاراستنی نهێنی',
    lead: 'ئەم پەڕەیە بە گشتی ئەو جۆرە داتایانە ڕوون دەکاتەوە کە پلاتفۆرمەکە لەوانەیە پێویستی پێیان بێت بۆ پێشکەشکردنی خزمەتگوزاری فێربوون و چۆنیەتی بەکارهێنانیان.',
    collectHeading: 'ئەو زانیاریانەی لەوانەیە کۆیان بکەینەوە',
    collectItems: [
      'زانیاری هەژمار وەک ناو، ئیمەیڵ، و ژمارەی تەلەفۆن کاتێک تۆمار دەکرێت.',
      'زانیاری خوێندن، پێشکەوتن و وانەکان کە پێویستن بۆ گەیاندنی خزمەتگوزاری فێربوون.',
      'ئەو فایل یان تۆمارە دەنگیانەی بەکارهێنەر باریدەکات کاتێک تایبەتمەندییەکی فێربوون پێویستی پێی بێت.',
    ],
    useHeading: 'بەکارهێنانی داتا',
    useBody: 'داتا بەکاردێت بۆ بەڕێوەبردنی هەژمار، پێشکەشکردنی وانەکان، بەدواداچوون، پشتگیری و باشترکردنی پلاتفۆرمەکە.',
    shareHeading: 'دەستگەیشتن و هاوبەشکردنی داتا',
    shareBody: 'دەستگەیشتن بە داتا تەنها لە چوارچێوەی پێویستی خزمەتگوزاری و ڕۆڵی بەکارهێنەردا سنووردار دەبێت. هەرگیز وشەی نهێنی یان زانیاری پارەدان لە ڕێگەی فۆڕمی پەیوەندی گشتییەوە مەنێرە.',
    requestsHeading: 'داواکاری بەکارهێنەر',
    requestsBody: 'دەتوانیت پرسیار یان داواکاری پەیوەندیدار بە داتا لە ڕێگەی پەڕەی پەیوەندییەوە بنێریت، و بەپێی سیاسەتە کارپێکراوەکان مامەڵەی لەگەڵ دەکرێت.',
  },
};

export default function Privacy() {
  const { locale, dir, isRTL } = useI18n();
  const copy = PRIVACY_COPY[locale] || (isRTL ? PRIVACY_COPY.ar : PRIVACY_COPY.en);

  return (
    <>
      <SEOHead page={{ title: copy.seoTitle, description: copy.seoDescription, url: '/privacy' }} />
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
              <div className="wn-public-orbit__core"><ShieldCheck size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <section className="wn-editorial-wrap">
          <div className="wn-editorial-card">
            <h2>{copy.collectHeading}</h2>
            <ul>
              {copy.collectItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <h2>{copy.useHeading}</h2>
            <p>{copy.useBody}</p>

            <h2>{copy.shareHeading}</h2>
            <p>{copy.shareBody}</p>

            <h2>{copy.requestsHeading}</h2>
            <p>{copy.requestsBody}</p>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
