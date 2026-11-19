import { useState } from 'react';
import { useI18n } from '../../i18n';
import { motion } from 'framer-motion';
import {
  Send,
  CheckCircle,
  MessageCircle,
  BookOpenCheck,
  Handshake,
  Sparkles,
  Clock,
  ShieldCheck,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import { useSEO } from '../../hooks/useSEO';
import { useToast } from '../../context/ToastProvider';
import { CONTACT, SOCIAL_LINKS } from '../../config/social';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const CONTACT_COPY = {
  ar: {
    home: 'الرئيسية',
    pageTitle: 'تواصل معنا',
    pageDesc: 'تواصل مع فريق أكاديمية وحي ونماء.',
    eyebrow: 'تواصل مع الأكاديمية',
    heroTitle: 'كيف نقدر نساعدك؟',
    heroSubtitle: 'أرسل رسالتك من النموذج، وسنستخدم بيانات التواصل التي تكتبها أنت للرد عليك.',
    toastSuccess: 'تم إرسال رسالتك بنجاح! سنتواصل معك قريباً.',
    toastFail: 'تعذر إرسال الرسالة، حاول لاحقًا',
    formHeading: 'أرسل لنا رسالة',
    formSub: 'اختر موضوع رسالتك بنقرة سريعة أو اكتب التفاصيل بوضوح.',
    quickLabel: 'اختيار سريع للموضوع:',
    sentTitle: 'تم إرسال رسالتك',
    sentDesc: 'تم استلام طلبك بنجاح.',
    nameLabel: 'الاسم الكامل',
    namePlaceholder: 'اسمك الكامل',
    emailLabel: 'البريد الإلكتروني',
    phoneLabel: 'رقم الهاتف (اختياري)',
    subjectLabel: 'الموضوع',
    subjectPlaceholder: 'موضوع الرسالة',
    messageLabel: 'الرسالة',
    messagePlaceholder: 'اكتب تفاصيل استفسارك...',
    sending: 'جاري إرسال الرسالة...',
    sendBtn: 'إرسال الرسالة',
    asideEyebrow: 'قبل الإرسال',
    asideTitle: 'معلومة تساعدنا نرد بشكل أفضل',
    asideBody: 'لو سؤالك عن طالب أو حجز أو دورة، اذكر البريد المستخدم في الحساب واسم المسار إن وجد. لا ترسل كلمات مرور أو بيانات دفع.',
    asideTime: 'متوسط وقت الرد: خلال ساعات العمل الرسمية',
    asidePrivacy: 'بياناتك محمية وتُستخدم للرد على استفسارك فقط',
    quickSubjects: [
      'استفسار عن الباقات والمسارات',
      'حجز الحصة التجريبية المجانية',
      'القسم النسائي وتأسيس الأطفال',
      'الدعم الفني والحساب',
      'شراكات ومؤسسات تعليمية',
    ],
    helpCards: [
      { title: 'البرامج والمسارات', text: 'اسأل عن المسار الأنسب للمستوى والهدف.' },
      { title: 'الدعم والمساعدة', text: 'لو واجهتك مشكلة في الحساب أو تجربة المنصة، اشرحها لنا هنا.' },
      { title: 'الشراكات والتعاون', text: 'للمبادرات التعليمية والمؤسسات الراغبة في التعاون.' },
    ],
  },
  en: {
    home: 'Home',
    pageTitle: 'Contact Us',
    pageDesc: 'Contact the Wahy Wa Namaa Academy team.',
    eyebrow: 'CONTACT THE ACADEMY',
    heroTitle: 'How can we help?',
    heroSubtitle: 'Send your message through the form. We will use the contact details you provide to respond.',
    toastSuccess: 'Your message has been sent!',
    toastFail: 'Failed to send message. Please try again later.',
    formHeading: 'Send us a message',
    formSub: 'Pick a quick topic or write your inquiry in detail.',
    quickLabel: 'Quick subject selection:',
    sentTitle: 'Message sent',
    sentDesc: 'Your request was received successfully.',
    nameLabel: 'Full name',
    namePlaceholder: 'Your full name',
    emailLabel: 'Email',
    phoneLabel: 'Phone (optional)',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'Message subject',
    messageLabel: 'Message',
    messagePlaceholder: 'Tell us how we can help...',
    sending: 'Sending message...',
    sendBtn: 'Send message',
    asideEyebrow: 'BEFORE YOU SEND',
    asideTitle: 'One detail helps us respond better',
    asideBody: 'For a learner, booking, or course question, include the account email and path name if relevant. Never send passwords or payment credentials.',
    asideTime: 'Typical response: within working hours',
    asidePrivacy: 'Your contact details are kept strictly private',
    quickSubjects: [
      'Plans & Learning Tracks',
      'Free Trial Booking',
      'Women & Kids Section',
      'Account & Technical Support',
      'Educational Partnerships',
    ],
    helpCards: [
      { title: 'Programs and paths', text: 'Ask which path best fits your level and goal.' },
      { title: 'Support and help', text: 'If you have an account or platform issue, describe it here.' },
      { title: 'Partnerships', text: 'For educational initiatives and organizations interested in collaboration.' },
    ],
  },
  fr: {
    home: 'Accueil',
    pageTitle: 'Contactez-nous',
    pageDesc: 'Contactez l’équipe de l’Académie Wahy Wa Namaa.',
    eyebrow: 'CONTACTER L’ACADÉMIE',
    heroTitle: 'Comment pouvons-nous vous aider ?',
    heroSubtitle: 'Envoyez votre message via le formulaire. Nous utiliserons vos coordonnées pour vous répondre.',
    toastSuccess: 'Votre message a bien été envoyé !',
    toastFail: 'Échec de l’envoi du message. Veuillez réessayer plus tard.',
    formHeading: 'Envoyez-nous un message',
    formSub: 'Choisissez un sujet rapide ou décrivez votre demande en détail.',
    quickLabel: 'Choix rapide du sujet :',
    sentTitle: 'Message envoyé',
    sentDesc: 'Votre demande a été reçue avec succès.',
    nameLabel: 'Nom complet',
    namePlaceholder: 'Votre nom complet',
    emailLabel: 'Adresse e-mail',
    phoneLabel: 'Téléphone (facultatif)',
    subjectLabel: 'Objet',
    subjectPlaceholder: 'Objet du message',
    messageLabel: 'Message',
    messagePlaceholder: 'Expliquez-nous comment vous aider...',
    sending: 'Envoi du message...',
    sendBtn: 'Envoyer le message',
    asideEyebrow: 'AVANT D’ENVOYER',
    asideTitle: 'Un détail pour vous répondre plus vite',
    asideBody: 'Pour une question sur un élève, une séance ou un cours, indiquez l’e-mail du compte et le parcours concerné. N’envoyez jamais de mot de passe ni d’informations bancaires.',
    asideTime: 'Délai de réponse habituel : aux heures ouvrables',
    asidePrivacy: 'Vos coordonnées restent strictement confidentielles',
    quickSubjects: [
      'Formules et parcours',
      'Réservation d’essai gratuit',
      'Espace femmes et enfants',
      'Support compte et technique',
      'Partenariats éducatifs',
    ],
    helpCards: [
      { title: 'Programmes et parcours', text: 'Demandez quel parcours correspond le mieux à votre niveau et à vos objectifs.' },
      { title: 'Assistance et aide', text: 'En cas de problème avec votre compte ou la plateforme, décrivez-le ici.' },
      { title: 'Partenariats', text: 'Pour les initiatives éducatives et organismes souhaitant collaborer.' },
    ],
  },
  de: {
    home: 'Startseite',
    pageTitle: 'Kontakt',
    pageDesc: 'Kontaktieren Sie das Team der Wahy Wa Namaa Akademie.',
    eyebrow: 'AKADEMIE KONTAKTIEREN',
    heroTitle: 'Wie können wir helfen?',
    heroSubtitle: 'Senden Sie uns Ihre Nachricht über das Formular. Wir antworten an die angegebenen Kontaktdaten.',
    toastSuccess: 'Ihre Nachricht wurde gesendet!',
    toastFail: 'Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.',
    formHeading: 'Nachricht senden',
    formSub: 'Wählen Sie ein Thema oder beschreiben Sie Ihr Anliegen ausführlich.',
    quickLabel: 'Schnellauswahl Thema:',
    sentTitle: 'Nachricht gesendet',
    sentDesc: 'Ihre Anfrage ist erfolgreich eingegangen.',
    nameLabel: 'Vollständiger Name',
    namePlaceholder: 'Ihr vollständiger Name',
    emailLabel: 'E-Mail-Adresse',
    phoneLabel: 'Telefon (optional)',
    subjectLabel: 'Betreff',
    subjectPlaceholder: 'Betreff der Nachricht',
    messageLabel: 'Nachricht',
    messagePlaceholder: 'Wie können wir Ihnen helfen?',
    sending: 'Nachricht wird gesendet...',
    sendBtn: 'Nachricht senden',
    asideEyebrow: 'VOR DEM ABSENDEN',
    asideTitle: 'Ein Hinweis für schnellere Hilfe',
    asideBody: 'Bei Fragen zu einem Konto, Termin oder Kurs nennen Sie bitte die Kontomail und den Lernpfad. Senden Sie niemals Passwörter oder Zahlungsdaten.',
    asideTime: 'Übliche Antwortzeit: innerhalb der Geschäftszeiten',
    asidePrivacy: 'Ihre Kontaktdaten werden streng vertraulich behandelt',
    quickSubjects: [
      'Pakete & Lernpfade',
      'Kostenlose Probestunde',
      'Frauen- & Kinderbereich',
      'Konto- & Technik-Support',
      'Bildungspartnerschaften',
    ],
    helpCards: [
      { title: 'Programme und Pfade', text: 'Fragen Sie nach dem passenden Lernpfad für Ihr Niveau und Ziel.' },
      { title: 'Support und Hilfe', text: 'Bei Problemen mit dem Konto oder der Plattform schildern Sie diese hier.' },
      { title: 'Partnerschaften', text: 'Für Bildungsinitiativen und Institutionen mit Kooperationsinteresse.' },
    ],
  },
  tr: {
    home: 'Ana Sayfa',
    pageTitle: 'İletişim',
    pageDesc: 'Wahy Wa Namaa Akademisi ekibiyle iletişime geçin.',
    eyebrow: 'AKADEMİ İLE İLETİŞİM',
    heroTitle: 'Size nasıl yardımcı olabiliriz?',
    heroSubtitle: 'Mesajınızı form üzerinden gönderin; size paylaştığınız iletişim bilgileri üzerinden yanıt vereceğiz.',
    toastSuccess: 'Mesajınız başarıyla gönderildi!',
    toastFail: 'Mesaj gönderilemedi. Lütfen daha sonra tekrar deneyin.',
    formHeading: 'Bize mesaj gönderin',
    formSub: 'Hızlı bir konu seçin veya talebinizi ayrıntılı yazın.',
    quickLabel: 'Hızlı konu seçimi:',
    sentTitle: 'Mesaj gönderildi',
    sentDesc: 'Talebiniz başarıyla alındı.',
    nameLabel: 'Ad Soyad',
    namePlaceholder: 'Adınız ve soyadınız',
    emailLabel: 'E-posta',
    phoneLabel: 'Telefon (isteğe bağlı)',
    subjectLabel: 'Konu',
    subjectPlaceholder: 'Mesaj konusu',
    messageLabel: 'Mesaj',
    messagePlaceholder: 'Size nasıl yardımcı olabileceğimizi yazın...',
    sending: 'Mesaj gönderiliyor...',
    sendBtn: 'Mesajı gönder',
    asideEyebrow: 'GÖNDERMEDEN ÖNCE',
    asideTitle: 'Daha iyi yanıt vermemize yardımcı olacak bir detay',
    asideBody: 'Öğrenci, randevu veya kursla ilgili sorularda hesap e-postasını ve ilgili programı belirtin. Asla şifre veya ödeme bilgisi göndermeyin.',
    asideTime: 'Ortalama yanıt süresi: çalışma saatleri içinde',
    asidePrivacy: 'İletişim bilgileriniz yalnızca yanıt amacıyla ve gizlilikle kullanılır',
    quickSubjects: [
      'Paketler ve Programlar',
      'Ücretsiz Deneme Dersi',
      'Hanımlar ve Çocuk Bölümü',
      'Hesap ve Teknik Destek',
      'Eğitim İş Birlikleri',
    ],
    helpCards: [
      { title: 'Programlar ve yollar', text: 'Seviyenize ve hedefinize en uygun programı sorun.' },
      { title: 'Destek ve yardım', text: 'Hesap veya platformla ilgili bir sorununuz varsa buradan açıklayın.' },
      { title: 'İş birlikleri', text: 'İş birliği yapmak isteyen eğitim girişimleri ve kurumlar için.' },
    ],
  },
  ur: {
    home: 'ہوم',
    pageTitle: 'رابطہ کریں',
    pageDesc: 'اکیڈمی وحی و نماء کی ٹیم سے رابطہ کریں۔',
    eyebrow: 'اکیڈمی سے رابطہ',
    heroTitle: 'ہم آپ کی کیا مدد کر سکتے ہیں؟',
    heroSubtitle: 'فارم کے ذریعے اپنا پیغام بھیجیں، ہم آپ کے فراہم کردہ رابطہ ذرائع پر جواب دیں گے۔',
    toastSuccess: 'آپ کا پیغام کامیابی سے بھیج دیا گیا ہے!',
    toastFail: 'پیغام بھیجنے میں دشواری پیش آئی، براہِ کرم بعد میں کوشش کریں۔',
    formHeading: 'ہمیں پیغام بھیجیں',
    formSub: 'فوری موضوع منتخب کریں یا اپنی بات تفصیل سے لکھیں۔',
    quickLabel: 'موضوع کا فوری انتخاب:',
    sentTitle: 'پیغام موصول ہو گیا',
    sentDesc: 'آپ کی درخواست کامیابی سے موصول ہو گئی ہے۔',
    nameLabel: 'پورا نام',
    namePlaceholder: 'آپ کا پورا نام',
    emailLabel: 'ای میل',
    phoneLabel: 'فون نمبر (اختیاری)',
    subjectLabel: 'موضوع',
    subjectPlaceholder: 'پیغام کا موضوع',
    messageLabel: 'پیغام',
    messagePlaceholder: 'اپنی تفصیلات یہاں لکھیں...',
    sending: 'پیغام بھیجا جا رہا ہے...',
    sendBtn: 'پیغام بھیجیں',
    asideEyebrow: 'بھیجنے سے پہلے',
    asideTitle: 'بہتر جواب کے لیے ایک اہم بات',
    asideBody: 'اگر سوال طالب علم، بکنگ یا کورس سے متعلق ہو تو اکاؤنٹ کا ای میل اور کورس کا نام شامل کریں۔ پاس ورڈ یا ادائیگی کی معلومات ہرگز نہ بھیجیں۔',
    asideTime: 'جواب کا اوسط وقت: دفتری اوقات میں',
    asidePrivacy: 'آپ کی معلومات محفوظ ہیں اور صرف جواب دینے کے لیے استعمال ہوں گی',
    quickSubjects: [
      'پیکجز اور تعلیمی راستے',
      'مفت تجرباتی کلاس کی بکنگ',
      'خواتین اور بچوں کا شعبہ',
      'تکنیکی معاونت اور اکاؤنٹ',
      'تعلیمی شراکت داری',
    ],
    helpCards: [
      { title: 'پروگرامز اور راستے', text: 'اپنی سطح اور ہدف کے مطابق بہترین راستے کے بارے میں پوچھیں۔' },
      { title: 'معاونت اور مدد', text: 'اکاؤنٹ یا پلیٹ فارم میں کوئی مسئلہ درپیش ہو تو یہاں بیان کریں۔' },
      { title: 'شراکت اور تعاون', text: 'تعلیمی اداروں اور تعاون کے خواہش مند منصوبوں کے لیے۔' },
    ],
  },
  id: {
    home: 'Beranda',
    pageTitle: 'Hubungi Kami',
    pageDesc: 'Hubungi tim Akademi Wahy Wa Namaa.',
    eyebrow: 'HUBUNGI AKADEMI',
    heroTitle: 'Bagaimana kami dapat membantu Anda?',
    heroSubtitle: 'Kirimkan pesan Anda melalui formulir. Kami akan menggunakan detail kontak yang Anda berikan untuk membalas.',
    toastSuccess: 'Pesan Anda telah berhasil dikirim!',
    toastFail: 'Gagal mengirim pesan. Silakan coba lagi nanti.',
    formHeading: 'Kirim pesan kepada kami',
    formSub: 'Pilih topik cepat atau tulis pertanyaan Anda secara rinci.',
    quickLabel: 'Pilihan topik cepat:',
    sentTitle: 'Pesan terkirim',
    sentDesc: 'Permintaan Anda telah berhasil diterima.',
    nameLabel: 'Nama lengkap',
    namePlaceholder: 'Nama lengkap Anda',
    emailLabel: 'Email',
    phoneLabel: 'Telepon (opsional)',
    subjectLabel: 'Subjek',
    subjectPlaceholder: 'Subjek pesan',
    messageLabel: 'Pesan',
    messagePlaceholder: 'Jelaskan bagaimana kami dapat membantu...',
    sending: 'Mengirim pesan...',
    sendBtn: 'Kirim pesan',
    asideEyebrow: 'SEBELUM MENGIRIM',
    asideTitle: 'Satu detail untuk membantu kami merespons lebih baik',
    asideBody: 'Untuk pertanyaan tentang pelajar, jadwal, atau kursus, sertakan email akun dan nama jalur belajar bila relevan. Jangan pernah mengirim kata sandi atau data pembayaran.',
    asideTime: 'Waktu respons umum: pada jam kerja resmi',
    asidePrivacy: 'Detail kontak Anda dijaga kerahasiaannya',
    quickSubjects: [
      'Paket & Jalur Belajar',
      'Pemesanan Kelas Percobaan Gratis',
      'Bagian Muslimah & Anak',
      'Bantuan Akun & Teknis',
      'Kemitraan Pendidikan',
    ],
    helpCards: [
      { title: 'Program dan jalur', text: 'Tanyakan jalur yang paling sesuai dengan level dan tujuan Anda.' },
      { title: 'Dukungan dan bantuan', text: 'Jika Anda mengalami kendala akun atau platform, jelaskan di sini.' },
      { title: 'Kemitraan', text: 'Untuk inisiatif pendidikan dan lembaga yang ingin berkolaborasi.' },
    ],
  },
  ms: {
    home: 'Laman Utama',
    pageTitle: 'Hubungi Kami',
    pageDesc: 'Hubungi pasukan Akademi Wahy Wa Namaa.',
    eyebrow: 'HUBUNGI AKADEMI',
    heroTitle: 'Bagaimana kami boleh membantu anda?',
    heroSubtitle: 'Hantar mesej anda melalui borang ini. Kami akan menggunakan maklumat hubungan yang anda berikan untuk membalas.',
    toastSuccess: 'Mesej anda telah berjaya dihantar!',
    toastFail: 'Gagal menghantar mesej. Sila cuba lagi nanti.',
    formHeading: 'Hantar mesej kepada kami',
    formSub: 'Pilih topik pantas atau tulis pertanyaan anda dengan jelas.',
    quickLabel: 'Pilihan topik pantas:',
    sentTitle: 'Mesej dihantar',
    sentDesc: 'Permintaan anda telah berjaya diterima.',
    nameLabel: 'Nama penuh',
    namePlaceholder: 'Nama penuh anda',
    emailLabel: 'E-mel',
    phoneLabel: 'Telefon (pilihan)',
    subjectLabel: 'Subjek',
    subjectPlaceholder: 'Subjek mesej',
    messageLabel: 'Mesej',
    messagePlaceholder: 'Nyatakan bagaimana kami boleh membantu...',
    sending: 'Menghantar mesej...',
    sendBtn: 'Hantar mesej',
    asideEyebrow: 'SEBELUM MENGHANTAR',
    asideTitle: 'Satu maklumat membantu kami membalas dengan lebih baik',
    asideBody: 'Untuk pertanyaan mengenai pelajar, tempahan, atau kursus, sertakan e-mel akaun dan nama laluan jika berkaitan. Jangan sekali-kali hantar kata laluan atau maklumat pembayaran.',
    asideTime: 'Tempoh respons biasa: dalam waktu bekerja',
    asidePrivacy: 'Maklumat hubungan anda disimpan secara sulit',
    quickSubjects: [
      'Pelan & Laluan Pembelajaran',
      'Tempahan Kelas Percubaan Percuma',
      'Bahagian Wanita & Kanak-Kanak',
      'Sokongan Akaun & Teknikal',
      'Kerjasama Pendidikan',
    ],
    helpCards: [
      { title: 'Program dan laluan', text: 'Tanyakan laluan yang paling sesuai dengan tahap dan matlamat anda.' },
      { title: 'Sokongan dan bantuan', text: 'Jika anda menghadapi masalah akaun atau platform, jelaskannya di sini.' },
      { title: 'Kerjasama', text: 'Untuk inisiatif pendidikan dan organisasi yang berminat bekerjasama.' },
    ],
  },
  ku: {
    home: 'سەرەکی',
    pageTitle: 'پەیوەندیمان پێوە بکە',
    pageDesc: 'پەیوەندی بکە بە تیمی ئەکادیمیای وەحی و نەما.',
    eyebrow: 'پەیوەندی بە ئەکادیمیاوە',
    heroTitle: 'چۆن دەتوانین یارمەتیت بدەین؟',
    heroSubtitle: 'پەیامەکەت لە ڕێگەی فۆرمەکەوە بنێرە، ئێمە زانیاری پەیوەندییەکەت بەکاردەهێنین بۆ وەڵامدانەوەت.',
    toastSuccess: 'پەیامەکەت بە سەرکەوتوویی نێردرا! بە زوویی پەیوەندیت پێوە دەکەین.',
    toastFail: 'ناردنی پەیام سەرکەوتوو نەبوو، تکایە دواتر هەوڵبدەرەوە.',
    formHeading: 'پەیاممان بۆ بنێرە',
    formSub: 'بە خێرایی بابەتی پەیامەکەت هەڵبژێرە یان وردەکارییەکان بە ڕوونی بنووسە.',
    quickLabel: 'هەڵبژاردنی خێرای بابەت:',
    sentTitle: 'پەیامەکەت نێردرا',
    sentDesc: 'داواکارییەکەت بە سەرکەوتوویی گەیشت.',
    nameLabel: 'ناوی تەواو',
    namePlaceholder: 'ناوی تەواوت',
    emailLabel: 'ئیمەیڵ',
    phoneLabel: 'ژمارەی تەلەفۆن (ئارەزوومەندانە)',
    subjectLabel: 'بابەت',
    subjectPlaceholder: 'بابەتی پەیام',
    messageLabel: 'پەیام',
    messagePlaceholder: 'وردەکاری پرسیارەکەت بنووسە...',
    sending: 'پەیام دەنێردرێت...',
    sendBtn: 'ناردنی پەیام',
    asideEyebrow: 'پێش ناردن',
    asideTitle: 'زانیارییەک یارمەتیمان دەدات باشتر وەڵام بدەینەوە',
    asideBody: 'ئەگەر پرسیارەکەت دەربارەی قوتابی، دیاریکردنی کات یان خولێکە، ئیمەیڵی هەژمارەکە و ناوی ڕێڕەوەکە بنووسە. هەرگیز وشەی تێپەڕ یان زانیاری پارەدان مەنێرە.',
    asideTime: 'کاتی ئاسایی وەڵامدانەوە: لە کاتی دەوامی فەرمیدا',
    asidePrivacy: 'زانیارییەکانت پارێزراون و تەنها بۆ وەڵامدانەوە بەکاردێن',
    quickSubjects: [
      'پاکێج و ڕێڕەوەکانی فێربوون',
      'تۆمارکردنی وانەی تاقیکاری بەخۆڕایی',
      'بەشی خانمان و منداڵان',
      'پشتگیری تەکنیکی و هەژمار',
      'هاوبەشی و دامەزراوە فێرکارییەکان',
    ],
    helpCards: [
      { title: 'بەرنامە و ڕێڕەوەکان', text: 'پرسیار بکە کام ڕێڕەو گونجاوترینە بۆ ئاست و ئامانجت.' },
      { title: 'پشتگیری و یارمەتی', text: 'ئەگەر کێشەیەکت لە هەژمار یان پلاتفۆرم هەیە، لێرە بۆمان ڕوون بکەرەوە.' },
      { title: 'هاوبەشی و هاوکاری', text: 'بۆ دەستپێشخەری و دامەزراوە فێرکارییەکان کە دەیانەوێت هاوکاری بکەن.' },
    ],
  },
};

const HELP_ICONS = [BookOpenCheck, MessageCircle, Handshake];

const CHANNELS_COPY = {
  ar: {
    heading: 'طرق التواصل المباشر',
    whatsappTitle: 'واتساب مباشر',
    whatsappDesc: 'أسرع وسيلة للرد والاستفسار عن الباقات والحصص التجريبية.',
    whatsappCta: 'ابدأ محادثة واتساب',
    emailTitle: 'البريد الإلكتروني الرسمي',
    emailDesc: 'للاستفسارات التفصيلية، الشراكات، ومتابعة الحسابات.',
    emailCta: 'أرسل بريداً إلكترونياً',
    phoneTitle: 'اتصال هاتفي مباشر',
    phoneDesc: 'تواصل معنا هاتفياً خلال ساعات العمل الرسمية.',
    phoneCta: 'اتصل بنا الآن',
    copy: 'نسخ',
    copied: 'تم النسخ',
  },
  en: {
    heading: 'Direct Contact Channels',
    whatsappTitle: 'WhatsApp Direct',
    whatsappDesc: 'Fastest way to ask about plans, schedules, and free trials.',
    whatsappCta: 'Chat on WhatsApp',
    emailTitle: 'Official Email',
    emailDesc: 'For detailed inquiries, partnerships, and account support.',
    emailCta: 'Send an Email',
    phoneTitle: 'Direct Phone Call',
    phoneDesc: 'Reach our support team directly during working hours.',
    phoneCta: 'Call Us Now',
    copy: 'Copy',
    copied: 'Copied',
  },
  fr: {
    heading: 'Canaux de contact direct',
    whatsappTitle: 'WhatsApp Direct',
    whatsappDesc: 'Le moyen le plus rapide pour toute question sur les formules et essais.',
    whatsappCta: 'Discuter sur WhatsApp',
    emailTitle: 'E-mail officiel',
    emailDesc: 'Pour les demandes détaillées, partenariats et assistance.',
    emailCta: 'Envoyer un e-mail',
    phoneTitle: 'Appel téléphonique',
    phoneDesc: 'Contactez notre équipe directement aux heures ouvrables.',
    phoneCta: 'Appeler maintenant',
    copy: 'Copier',
    copied: 'Copié',
  },
  de: {
    heading: 'Direkte Kontaktwege',
    whatsappTitle: 'WhatsApp Direkt',
    whatsappDesc: 'Der schnellste Weg für Fragen zu Tarifen und Probestunden.',
    whatsappCta: 'Auf WhatsApp schreiben',
    emailTitle: 'Offizielle E-Mail',
    emailDesc: 'Für ausführliche Anfragen, Partnerschaften und Support.',
    emailCta: 'E-Mail senden',
    phoneTitle: 'Direkter Anruf',
    phoneDesc: 'Erreichen Sie unser Team telefonisch zu den Geschäftszeiten.',
    phoneCta: 'Jetzt anrufen',
    copy: 'Kopieren',
    copied: 'Kopiert',
  },
  tr: {
    heading: 'Doğrudan İletişim Kanalları',
    whatsappTitle: 'Doğrudan WhatsApp',
    whatsappDesc: 'Paketler ve ücretsiz deneme dersleri için en hızlı iletişim yolu.',
    whatsappCta: 'WhatsApp ile Yaz',
    emailTitle: 'Resmi E-posta',
    emailDesc: 'Detaylı sorular, iş birlikleri ve hesap desteği için.',
    emailCta: 'E-posta Gönder',
    phoneTitle: 'Doğrudan Telefon',
    phoneDesc: 'Mesai saatleri içinde ekibimize doğrudan ulaşın.',
    phoneCta: 'Hemen Ara',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
  },
  ur: {
    heading: 'براہِ راست رابطے کے ذرائع',
    whatsappTitle: 'براہِ راست واٹس ایپ',
    whatsappDesc: 'پیکجز اور مفت تجرباتی کلاس کے لیے تیز ترین رابطہ۔',
    whatsappCta: 'واٹس ایپ پر رابطہ کریں',
    emailTitle: 'آفیشل ای میل',
    emailDesc: 'تفصیلی استفسارات، شراکت داری اور اکاؤنٹ سپورٹ کے لیے۔',
    emailCta: 'ای میل بھیجیں',
    phoneTitle: 'براہِ راست فون کال',
    phoneDesc: 'دفتری اوقات میں براہِ راست ہماری ٹیم سے بات کریں۔',
    phoneCta: 'ابھی کال کریں',
    copy: 'کاپی کریں',
    copied: 'کاپی ہو گیا',
  },
  id: {
    heading: 'Saluran Kontak Langsung',
    whatsappTitle: 'WhatsApp Langsung',
    whatsappDesc: 'Cara tercepat bertanya tentang paket dan kelas percobaan gratis.',
    whatsappCta: 'Chat di WhatsApp',
    emailTitle: 'Email Resmi',
    emailDesc: 'Untuk pertanyaan detail, kemitraan, dan bantuan akun.',
    emailCta: 'Kirim Email',
    phoneTitle: 'Telepon Langsung',
    phoneDesc: 'Hubungi tim kami langsung pada jam kerja.',
    phoneCta: 'Hubungi Sekarang',
    copy: 'Salin',
    copied: 'Tersalin',
  },
  ms: {
    heading: 'Saluran Hubungan Terus',
    whatsappTitle: 'WhatsApp Terus',
    whatsappDesc: 'Cara terpantas bertanya tentang pelan dan kelas percubaan percuma.',
    whatsappCta: 'Sembang di WhatsApp',
    emailTitle: 'E-mel Rasmi',
    emailDesc: 'Untuk pertanyaan terperinci, kerjasama, dan sokongan akaun.',
    emailCta: 'Hantar E-mel',
    phoneTitle: 'Panggilan Telefon Terus',
    phoneDesc: 'Hubungi pasukan kami terus pada waktu bekerja.',
    phoneCta: 'Hubungi Sekarang',
    copy: 'Salin',
    copied: 'Disalin',
  },
  ku: {
    heading: 'ڕێگاکانی پەیوەندی ڕاستەوخۆ',
    whatsappTitle: 'واتسئەپی ڕاستەوخۆ',
    whatsappDesc: 'خێراترین ڕێگا بۆ پرسیار دەربارەی پاکێج و وانەی تاقیکاری.',
    whatsappCta: 'گفتوگۆ لە واتسئەپ',
    emailTitle: 'ئیمەیڵی فەرمی',
    emailDesc: 'بۆ پرسیارە وردەکان، هاوبەشی، و پشتگیری هەژمار.',
    emailCta: 'ئیمەیڵ بنێرە',
    phoneTitle: 'پەیوەندی تەلەفۆنی ڕاستەوخۆ',
    phoneDesc: 'لە کاتژمێرە فەرمییەکانی کاردا ڕاستەوخۆ پەیوەندیمان پێوە بکە.',
    phoneCta: 'ئێستا پەیوەندی بکە',
    copy: 'لەبەرگرتنەوە',
    copied: 'لەبەرگیرایەوە',
  },
};

export default function Contact() {
  const { locale, dir, isRTL, t } = useI18n();
  const { createWebPageSchema, createBreadcrumbSchema } = useSEO();
  const toast = useToast();
  const copy = CONTACT_COPY[locale] || CONTACT_COPY.en;
  const ch = CHANNELS_COPY[locale] || (isRTL ? CHANNELS_COPY.ar : CHANNELS_COPY.en);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const handleCopy = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard?.writeText(value);
      setCopiedKey(key);
      toast.success(ch.copied);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? '' : prev)), 2200);
    } catch {
      toast.error(copy.toastFail);
    }
  };

  const handleChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (submitError) setSubmitError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await api.post('/api/contact', formData);
      setIsSubmitted(true);
      toast.success(copy.toastSuccess);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (err) {
      const msg = err?.message || copy.toastFail;
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTitle = t.common?.contact || copy.pageTitle;
  const pageDescription = copy.pageDesc;

  return (
    <>
      <SEOHead
        page={{
          title: pageTitle,
          description: pageDescription,
          url: '/contact',
          type: 'website',
          schema: [
            createWebPageSchema({
              name: pageTitle,
              description: pageDescription,
              url: '/contact',
              type: 'ContactPage',
            }),
            createBreadcrumbSchema([
              { name: t.common?.home || copy.home, url: '/' },
              { name: pageTitle, url: '/contact' },
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
                <Sparkles size={14} aria-hidden="true" /> {copy.eyebrow}
              </span>
              <h1>{copy.heroTitle}</h1>
              <p>{copy.heroSubtitle}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core">
                <MessageCircle size={46} strokeWidth={1.25} />
              </div>
            </div>
          </div>
        </section>

        <section className="page-container wn-public-copy-section">
          {(SOCIAL_LINKS.whatsapp || CONTACT.email || CONTACT.phone) && (
            <div className="mb-8" aria-label={ch.heading}>
              <h2 className="text-lg font-bold text-[var(--wn-heading)] mb-4">{ch.heading}</h2>
              <div className="wn-public-feature-grid">
                {SOCIAL_LINKS.whatsapp && (
                  <article className="wn-public-feature-card flex flex-col justify-between gap-4">
                    <div>
                      <span><MessageCircle size={21} aria-hidden="true" /></span>
                      <h3>{ch.whatsappTitle}</h3>
                      <p>{ch.whatsappDesc}</p>
                      <p className="mt-2 font-bold text-sm text-[var(--wn-heading)]" dir="ltr">
                        {CONTACT.phone || '+20 155 789 1330'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={SOCIAL_LINKS.whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wn-btn wn-btn--primary min-h-[44px] flex-1 justify-center gap-1.5 text-sm"
                      >
                        <ExternalLink size={15} aria-hidden="true" />
                        <span>{ch.whatsappCta}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('whatsapp', (CONTACT.phone || '+201557891330').replace(/\s/g, ''))}
                        className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px] px-3 text-xs gap-1"
                        aria-label={`${ch.copy} ${ch.whatsappTitle}`}
                      >
                        {copiedKey === 'whatsapp' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                        <span>{copiedKey === 'whatsapp' ? ch.copied : ch.copy}</span>
                      </button>
                    </div>
                  </article>
                )}

                {CONTACT.email && (
                  <article className="wn-public-feature-card flex flex-col justify-between gap-4">
                    <div>
                      <span><Mail size={21} aria-hidden="true" /></span>
                      <h3>{ch.emailTitle}</h3>
                      <p>{ch.emailDesc}</p>
                      <p className="mt-2 font-bold text-sm text-[var(--wn-heading)] break-all" dir="ltr">
                        {CONTACT.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={'mailto:' + CONTACT.email}
                        className="wn-btn wn-btn--primary min-h-[44px] flex-1 justify-center gap-1.5 text-sm"
                      >
                        <Mail size={15} aria-hidden="true" />
                        <span>{ch.emailCta}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('email', CONTACT.email)}
                        className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px] px-3 text-xs gap-1"
                        aria-label={`${ch.copy} ${ch.emailTitle}`}
                      >
                        {copiedKey === 'email' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                        <span>{copiedKey === 'email' ? ch.copied : ch.copy}</span>
                      </button>
                    </div>
                  </article>
                )}

                {CONTACT.phone && (
                  <article className="wn-public-feature-card flex flex-col justify-between gap-4">
                    <div>
                      <span><Phone size={21} aria-hidden="true" /></span>
                      <h3>{ch.phoneTitle}</h3>
                      <p>{ch.phoneDesc}</p>
                      <p className="mt-2 font-bold text-sm text-[var(--wn-heading)]" dir="ltr">
                        {CONTACT.phone}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <a
                        href={'tel:' + CONTACT.phone.replace(/\s/g, '')}
                        className="wn-btn wn-btn--primary min-h-[44px] flex-1 justify-center gap-1.5 text-sm"
                      >
                        <Phone size={15} aria-hidden="true" />
                        <span>{ch.phoneCta}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy('phone', CONTACT.phone.replace(/\s/g, ''))}
                        className="wn-btn wn-btn--secondary min-h-[44px] min-w-[44px] px-3 text-xs gap-1"
                        aria-label={`${ch.copy} ${ch.phoneTitle}`}
                      >
                        {copiedKey === 'phone' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                        <span>{copiedKey === 'phone' ? ch.copied : ch.copy}</span>
                      </button>
                    </div>
                  </article>
                )}
              </div>
            </div>
          )}

          <div className="wn-public-feature-grid mb-6">
            {copy.helpCards.map(({ title, text }, idx) => {
              const Icon = HELP_ICONS[idx];
              return (
                <article key={title} className="wn-public-feature-card">
                  <span>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              );
            })}
          </div>

          <div className="wn-public-form-layout">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="wn-public-message-card"
            >
              <h2>{copy.formHeading}</h2>
              <p className="mt-1 text-sm text-[var(--wn-text-secondary)]">
                {copy.formSub}
              </p>

              {/* Quick Subject Selector Pills */}
              <div className="mt-4">
                <span className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                  {copy.quickLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {copy.quickSubjects.map((topic) => {
                    const selected = formData.subject === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFormData((prev) => ({ ...prev, subject: topic }))}
                        className={selected ? 'wn-quick-spec-pill is-active min-h-[44px]' : 'wn-quick-spec-pill min-h-[44px]'}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isSubmitted ? (
                <div role="status" className="mt-5 p-4 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] flex items-start gap-3">
                  <CheckCircle className="text-[var(--wn-link)] shrink-0" size={20} aria-hidden="true" />
                  <div>
                    <strong className="text-[var(--wn-heading)]">{copy.sentTitle}</strong>
                    <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
                      {copy.sentDesc}
                    </p>
                  </div>
                </div>
              ) : null}

              {submitError ? (
                <div id="contact-error" role="alert" className="mt-5 rounded-xl border border-[var(--wn-danger)]/40 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-text-danger,var(--wn-danger))]">
                  {submitError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="grid gap-4 mt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {copy.nameLabel} *
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      enterKeyHint="next"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder={copy.namePlaceholder}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {copy.emailLabel} *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder="example@email.com"
                      dir="auto"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-phone" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {copy.phoneLabel}
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="next"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+20..."
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                      {copy.subjectLabel} *
                    </label>
                    <input
                      id="contact-subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      aria-invalid={Boolean(submitError)}
                      aria-describedby={submitError ? 'contact-error' : undefined}
                      placeholder={copy.subjectPlaceholder}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold text-[var(--wn-heading)] mb-2">
                    {copy.messageLabel} *
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    aria-invalid={Boolean(submitError)}
                    aria-describedby={submitError ? 'contact-error' : undefined}
                    placeholder={copy.messagePlaceholder}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="wn-btn wn-btn--primary wn-btn--lg wn-btn--block min-h-[44px] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                      <span className="sr-only">{copy.sending}</span>
                    </>
                  ) : (
                    <>
                      <Send size={17} aria-hidden="true" /> {copy.sendBtn}
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            <aside className="wn-public-track-banner !mt-0 space-y-4">
              <div>
                <span className="wn-auth-visual__eyebrow">{copy.asideEyebrow}</span>
                <h2>{copy.asideTitle}</h2>
                <p>{copy.asideBody}</p>
              </div>

              <div className="grid gap-2.5 pt-3 border-t border-white/15 text-xs">
                <div className="flex items-center gap-2 text-[var(--wn-gold)]">
                  <Clock size={15} aria-hidden="true" />
                  <span>{copy.asideTime}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <ShieldCheck size={15} aria-hidden="true" />
                  <span>{copy.asidePrivacy}</span>
                </div>
              </div>

              {(CONTACT.email || CONTACT.phone || SOCIAL_LINKS.whatsapp) && (
                <div className="grid gap-2 pt-3 border-t border-white/15 text-sm">
                  {CONTACT.email && (
                    <a
                      href={'mailto:' + CONTACT.email}
                      className="min-h-[44px] inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2 text-white hover:bg-white/15 transition"
                    >
                      <Mail size={16} className="shrink-0 text-[var(--wn-gold)]" aria-hidden="true" />
                      <span dir="ltr" className="break-all">{CONTACT.email}</span>
                    </a>
                  )}
                  {SOCIAL_LINKS.whatsapp && (
                    <a
                      href={SOCIAL_LINKS.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2 text-white hover:bg-white/15 transition"
                    >
                      <MessageCircle size={16} className="shrink-0 text-[var(--wn-gold)]" aria-hidden="true" />
                      <span dir="ltr">{CONTACT.phone || '01557891330'}</span>
                    </a>
                  )}
                  {CONTACT.phone && !SOCIAL_LINKS.whatsapp && (
                    <a
                      href={'tel:' + CONTACT.phone.replace(/\s/g, '')}
                      className="min-h-[44px] inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2 text-white hover:bg-white/15 transition"
                    >
                      <Phone size={16} className="shrink-0 text-[var(--wn-gold)]" aria-hidden="true" />
                      <span dir="ltr">{CONTACT.phone}</span>
                    </a>
                  )}
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}
