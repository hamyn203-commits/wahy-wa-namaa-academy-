import { useEffect, useState } from 'react';
import { HeartHandshake, CircleDollarSign, Users, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const CATEGORIES = [
  { id: 'student', icon: Users, ar: 'كفالة طالب', en: 'Sponsor a Student', fr: 'Parrainer un élève', de: 'Schüler fördern', tr: 'Öğrenciye Destek Ol', ur: 'طالب علم کی کفالت', idLabel: 'Sponsori Siswa', ms: 'Taja Pelajar', ku: 'پشتگیری فێرخوازێک' },
  { id: 'teacher', icon: BookOpen, ar: 'دعم تعليم المعلمين', en: 'Support Teachers', fr: 'Soutenir les enseignants', de: 'Lehrkräfte unterstützen', tr: 'Öğretmenleri Destekle', ur: 'اساتذہ کی معاونت', idLabel: 'Dukung Pengajar', ms: 'Sokong Guru', ku: 'پشتگیری مامۆستایان' },
  { id: 'halaqa', icon: HeartHandshake, ar: 'دعم حلقة قرآن', en: 'Support a Quran Halaqa', fr: 'Soutenir un cercle du Coran', de: 'Korankreis fördern', tr: 'Kur’an Halkasını Destekle', ur: 'حلقۂ قرآن کی سرپرستی', idLabel: 'Dukung Halaqah Qur’an', ms: 'Sokong Halaqah Al-Quran', ku: 'پشتگیری حەڵقەی قورئان' },
  { id: 'general', icon: CircleDollarSign, ar: 'مساهمة عامة', en: 'General Contribution', fr: 'Contribution générale', de: 'Allgemeiner Beitrag', tr: 'Genel Katkı', ur: 'عمومی تعاون', idLabel: 'Kontribusi Umum', ms: 'Sumbangan Umum', ku: 'بەشداری گشتی' },
];

const DONATE_COPY = {
  ar: {
    seoTitle: 'المساهمة | وحي ونماء',
    seoDesc: 'صفحة المساهمات المتاحة في أكاديمية وحي ونماء.',
    eyebrow: 'المساهمة في التعليم',
    title: 'ساهم في رحلة تعلم القرآن',
    subtitle: 'اختر نوع المساهمة وأدخل بياناتك. وسائل الدفع المباشر لا تظهر إلا عندما تكون مفعّلة فعليًا في النظام.',
    donorsCount: 'مساهمة مسجلة',
    categoriesAria: 'فئات المساهمة',
    doneTitle: 'تم تسجيل مساهمتك',
    doneDesc: 'لو كانت الخطوة التالية تحتاج تنسيقًا، سيستخدم الفريق بيانات التواصل التي أدخلتها.',
    nameLabel: 'الاسم',
    emailLabel: 'البريد الإلكتروني',
    phoneLabel: 'الهاتف (اختياري)',
    amountLabel: 'المبلغ',
    currencyLabel: 'العملة',
    messageLabel: 'رسالة (اختياري)',
    methodLabel: 'طريقة الإكمال',
    stripeLabel: 'بطاقة عبر Stripe',
    manualLabel: 'تعهّد/تحويل يتم تنسيقه مع الفريق',
    anonLabel: 'عدم إظهار الاسم في أي عرض عام للمساهمات',
    pledgeBtn: 'تسجيل التعهّد',
    payBtn: 'الانتقال للدفع',
    submitting: 'جاري التسجيل...',
    errGeneric: 'تعذر تسجيل المساهمة',
  },
  en: {
    seoTitle: 'Support | Wahy Wa Namaa',
    seoDesc: 'Contribution options available at Wahy Wa Namaa.',
    eyebrow: 'SUPPORT LEARNING',
    title: 'Support Quran learning',
    subtitle: 'Choose a contribution type and enter your details. Direct payment options only appear when they are actually enabled.',
    donorsCount: 'recorded contributors',
    categoriesAria: 'Contribution categories',
    doneTitle: 'Contribution recorded',
    doneDesc: 'If another step requires coordination, the team will use the contact details you provided.',
    nameLabel: 'Name',
    emailLabel: 'Email',
    phoneLabel: 'Phone (optional)',
    amountLabel: 'Amount',
    currencyLabel: 'Currency',
    messageLabel: 'Message (optional)',
    methodLabel: 'Completion method',
    stripeLabel: 'Card via Stripe',
    manualLabel: 'Pledge / transfer coordinated with the team',
    anonLabel: 'Do not show my name in any public contribution display',
    pledgeBtn: 'Record pledge',
    payBtn: 'Continue to payment',
    submitting: 'Recording...',
    errGeneric: 'Unable to record contribution',
  },
  fr: {
    seoTitle: 'Soutenir | Wahy Wa Namaa',
    eyebrow: 'SOUTENIR L’APPRENTISSAGE',
    title: 'Soutenez l’apprentissage du Coran',
    nameLabel: 'Nom',
    emailLabel: 'E-mail',
    phoneLabel: 'Téléphone (facultatif)',
    amountLabel: 'Montant',
    currencyLabel: 'Devise',
    messageLabel: 'Message (facultatif)',
    methodLabel: 'Mode de finalisation',
    pledgeBtn: 'Enregistrer l’engagement',
    payBtn: 'Continuer vers le paiement',
    submitting: 'Enregistrement...',
    errGeneric: 'Impossible d’enregistrer la contribution',
  },
  de: {
    seoTitle: 'Unterstützen | Wahy Wa Namaa',
    eyebrow: 'BILDUNG FÖRDERN',
    title: 'Unterstützen Sie das Koranlernen',
    nameLabel: 'Name',
    emailLabel: 'E-Mail',
    phoneLabel: 'Telefon (optional)',
    amountLabel: 'Betrag',
    currencyLabel: 'Währung',
    messageLabel: 'Nachricht (optional)',
    methodLabel: 'Abschlussmethode',
    pledgeBtn: 'Zusage erfassen',
    payBtn: 'Zur Zahlung',
    submitting: 'Wird gespeichert...',
    errGeneric: 'Beitrag konnte nicht gespeichert werden',
  },
  tr: {
    seoTitle: 'Destek Ol | Wahy Wa Namaa',
    eyebrow: 'EĞİTİMİ DESTEKLE',
    title: 'Kur’an eğitimine destek olun',
    nameLabel: 'Ad Soyad',
    emailLabel: 'E-posta',
    phoneLabel: 'Telefon (isteğe bağlı)',
    amountLabel: 'Tutar',
    currencyLabel: 'Para Birimi',
    messageLabel: 'Mesaj (isteğe bağlı)',
    methodLabel: 'Tamamlama yöntemi',
    pledgeBtn: 'Katkıyı kaydet',
    payBtn: 'Ödemeye geç',
    submitting: 'Kaydediliyor...',
    errGeneric: 'Katkı kaydedilemedi',
  },
  ur: {
    seoTitle: 'تعاون | وحی و نما',
    eyebrow: 'تعلیم میں تعاون',
    title: 'قرآن سیکھنے کے سفر میں تعاون کریں',
    nameLabel: 'نام',
    emailLabel: 'ای میل',
    phoneLabel: 'فون (اختیاری)',
    amountLabel: 'رقم',
    currencyLabel: 'کرنسی',
    messageLabel: 'پیغام (اختیاری)',
    methodLabel: 'تکمیل کا طریقہ',
    pledgeBtn: 'عہد محفوظ کریں',
    payBtn: 'ادائیگی کی طرف بڑھیں',
    submitting: 'محفوظ ہو رہا ہے...',
    errGeneric: 'تعاون محفوظ نہیں ہو سکا',
  },
  id: {
    seoTitle: 'Dukungan | Wahy Wa Namaa',
    eyebrow: 'DUKUNG PENDIDIKAN',
    title: 'Dukung pembelajaran Al-Qur’an',
    nameLabel: 'Nama',
    emailLabel: 'Email',
    phoneLabel: 'Telepon (opsional)',
    amountLabel: 'Jumlah',
    currencyLabel: 'Mata uang',
    messageLabel: 'Pesan (opsional)',
    methodLabel: 'Metode penyelesaian',
    pledgeBtn: 'Catat komitmen',
    payBtn: 'Lanjut ke pembayaran',
    submitting: 'Menyimpan...',
    errGeneric: 'Tidak dapat mencatat kontribusi',
  },
  ms: {
    seoTitle: 'Sumbangan | Wahy Wa Namaa',
    eyebrow: 'SOKONG PENDIDIKAN',
    title: 'Sokong pembelajaran Al-Quran',
    nameLabel: 'Nama',
    emailLabel: 'E-mel',
    phoneLabel: 'Telefon (pilihan)',
    amountLabel: 'Jumlah',
    currencyLabel: 'Mata wang',
    messageLabel: 'Mesej (pilihan)',
    methodLabel: 'Kaedah pengesahan',
    pledgeBtn: 'Rekod ikrar',
    payBtn: 'Teruskan ke pembayaran',
    submitting: 'Menyimpan...',
    errGeneric: 'Tidak dapat merekodkan sumbangan',
  },
  ku: {
    seoTitle: 'بەشداری | وەحی و نەما',
    eyebrow: 'پشتگیری فێربوون',
    title: 'بەشداربە لە گەشتی فێربوونی قورئاندا',
    nameLabel: 'ناو',
    emailLabel: 'ئیمەیڵ',
    phoneLabel: 'تەلەفۆن (ئارەزوومەندانە)',
    amountLabel: 'بڕ',
    currencyLabel: 'دراو',
    messageLabel: 'پەیام (ئارەزوومەندانە)',
    methodLabel: 'شێوازی تەواوکردن',
    pledgeBtn: 'تۆمارکردنی بەڵێن',
    payBtn: 'چوونە سەر پارەدان',
    submitting: 'تۆمار دەکرێت...',
    errGeneric: 'تۆمارکردنی بەشداری سەرکەوتوو نەبوو',
  },
};

export default function Donate() {
  const { locale, isRTL, dir } = useI18n();
  const toast = useToast();
  const baseCopy = isRTL ? DONATE_COPY.ar : DONATE_COPY.en;
  const copy = { ...baseCopy, ...(DONATE_COPY[locale] || {}) };

  const [stats, setStats] = useState({ totalDonors: 0, totalsByCurrency: {}, byCategory: {} });
  const [config, setConfig] = useState({ paymentEnabled: false, stripeUrl: '', paypalUrl: '' });
  const [form, setForm] = useState({ name: '', email: '', phone: '', amount: 100, currency: 'USD', category: 'general', message: '', isAnonymous: false });
  const [method, setMethod] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/api/donations/stats'), api.get('/api/donations/config')])
      .then(([s, c]) => { setStats(s || {}); setConfig(c || {}); })
      .catch(() => {});
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setSubmitError('');
    try {
      await api.post('/api/donations', form);
      const paymentUrl = method === 'stripe' ? config.stripeUrl : method === 'paypal' ? config.paypalUrl : '';
      if (method !== 'manual' && config.paymentEnabled && paymentUrl) {
        window.location.assign(paymentUrl);
        return;
      }
      setDone(true);
    } catch (err) {
      const msg = err?.message || copy.errGeneric;
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const availableMethods = [
    ...(config.paymentEnabled && config.stripeUrl ? [['stripe', copy.stripeLabel]] : []),
    ...(config.paymentEnabled && config.paypalUrl ? [['paypal', 'PayPal']] : []),
    ['manual', copy.manualLabel],
  ];

  const catLabel = (c) => c[locale === 'id' ? 'idLabel' : locale] || (isRTL ? c.ar : c.en);

  return (
    <>
      <SEOHead page={{ url: '/donate', title: copy.seoTitle, description: copy.seoDesc }} />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} aria-hidden="true" />{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.subtitle}</p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core"><HeartHandshake size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <section className="wn-utility-wrap">
          {stats.totalDonors > 0 ? (
            <div className="text-center mb-4 text-xs font-bold text-[var(--wn-link)]">
              {stats.totalDonors} {copy.donorsCount}
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-3 mb-5" role="group" aria-label={copy.categoriesAria}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = form.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm({ ...form, category: cat.id })}
                  className={'wn-career-card min-h-[44px] ' + (active ? 'is-active' : '')}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 grid place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <h2 className="text-base font-bold text-[var(--wn-heading)]">{catLabel(cat)}</h2>
                  </div>
                </button>
              );
            })}
          </div>

          {done ? (
            <div className="wn-utility-card text-center" role="status">
              <CheckCircle size={48} className="mx-auto text-[var(--wn-link)]" aria-hidden="true" />
              <h2 className="mt-3 font-[var(--wn-font-display)] text-xl text-[var(--wn-heading)]">{copy.doneTitle}</h2>
              <p className="mt-2 text-sm text-[var(--wn-text-secondary)]">{copy.doneDesc}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="wn-utility-card grid gap-4">
              {submitError && (
                <div id="donate-error" role="alert" className="rounded-xl border border-[var(--wn-danger)]/40 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-text-danger,var(--wn-danger))]">
                  {submitError}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="donate-name" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                    {copy.nameLabel} *
                  </label>
                  <input
                    id="donate-name"
                    required
                    autoComplete="name"
                    placeholder={copy.nameLabel}
                    aria-invalid={Boolean(submitError)}
                    className="input-field min-h-[44px]"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="donate-email" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                    {copy.emailLabel} *
                  </label>
                  <input
                    id="donate-email"
                    required
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={copy.emailLabel}
                    aria-invalid={Boolean(submitError)}
                    className="input-field min-h-[44px]"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="donate-phone" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                    {copy.phoneLabel}
                  </label>
                  <input
                    id="donate-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder={copy.phoneLabel}
                    className="input-field min-h-[44px]"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="donate-amount" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                    {copy.amountLabel} *
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="donate-amount"
                      required
                      type="number"
                      min="1"
                      inputMode="numeric"
                      className="input-field flex-1 min-h-[44px]"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                    <select
                      id="donate-currency"
                      aria-label={copy.currencyLabel}
                      className="input-field w-24 min-h-[44px]"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                      {['USD', 'EUR', 'SAR', 'AED', 'EGP'].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="donate-message" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.messageLabel}
                </label>
                <textarea
                  id="donate-message"
                  placeholder={copy.messageLabel}
                  className="input-field min-h-[90px]"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-[var(--wn-heading)] mb-2">{copy.methodLabel}</legend>
                <div className="grid gap-2">
                  {availableMethods.map(([id, label]) => (
                    <label
                      key={id}
                      className={'wn-setting-row min-h-[44px] px-3 rounded-xl border cursor-pointer ' + (method === id ? 'border-[var(--wn-gold)] bg-[var(--wn-gold-soft)]' : 'border-[var(--wn-border)]')}
                    >
                      <span className="text-sm text-[var(--wn-text-primary)]">{label}</span>
                      <input type="radio" name="payment" checked={method === id} onChange={() => setMethod(id)} />
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor="donate-anon" className="min-h-[44px] flex items-center gap-2.5 text-sm text-[var(--wn-text-secondary)] cursor-pointer">
                <input
                  id="donate-anon"
                  type="checkbox"
                  checked={form.isAnonymous}
                  onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
                  className="h-4 w-4 accent-[var(--wn-emerald)]"
                />
                <span>{copy.anonLabel}</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="wn-btn wn-btn--primary wn-btn--block wn-btn--lg min-h-[44px]"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                    <span className="sr-only">{copy.submitting}</span>
                  </>
                ) : (
                  method === 'manual' ? copy.pledgeBtn : copy.payBtn
                )}
              </button>
            </form>
          )}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
