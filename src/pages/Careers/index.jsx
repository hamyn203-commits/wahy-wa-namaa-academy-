import { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, MapPin, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const CAREERS_COPY = {
  ar: {
    seoTitle: 'الفرص المتاحة | وحي ونماء',
    seoDesc: 'الفرص المنشورة حاليًا في أكاديمية وحي ونماء.',
    eyebrow: 'العمل معنا',
    title: 'الفرص المنشورة حاليًا',
    subtitle: 'نعرض هنا الوظائف التي ينشرها فريق الأكاديمية فعليًا، ويمكن التقديم عليها مباشرة من النموذج.',
    loadingJobs: 'جاري تحميل الفرص المتاحة...',
    loadError: 'تعذر تحميل الفرص المتاحة الآن.',
    retryBtn: 'إعادة المحاولة',
    noJobs: 'لا توجد فرص منشورة الآن',
    remote: 'عن بُعد',
    formTitle: 'إرسال طلب التقديم',
    nameLabel: 'الاسم',
    emailLabel: 'البريد الإلكتروني',
    phoneLabel: 'الهاتف',
    expLabel: 'سنوات الخبرة',
    coverLabel: 'رسالة التقديم',
    submitBtn: 'إرسال الطلب',
    submitting: 'جاري الإرسال...',
    doneTitle: 'تم استلام طلبك',
    errSubmit: 'تعذر إرسال الطلب',
  },
  en: {
    seoTitle: 'Careers | Wahy Wa Namaa',
    seoDesc: 'Currently published opportunities at Wahy Wa Namaa.',
    eyebrow: 'WORK WITH US',
    title: 'Current opportunities',
    subtitle: 'We list roles published by the academy team and accept applications through the form.',
    loadingJobs: 'Loading published opportunities...',
    loadError: 'Unable to load opportunities right now.',
    retryBtn: 'Retry',
    noJobs: 'No roles are currently published',
    remote: 'Remote',
    formTitle: 'Submit application',
    nameLabel: 'Name',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    expLabel: 'Years of experience',
    coverLabel: 'Cover letter',
    submitBtn: 'Submit application',
    submitting: 'Submitting...',
    doneTitle: 'Application received',
    errSubmit: 'Unable to submit application',
  },
  fr: {
    seoTitle: 'Carrières | Wahy Wa Namaa',
    eyebrow: 'REJOIGNEZ-NOUS',
    title: 'Postes ouverts actuellement',
    loadingJobs: 'Chargement des offres...',
    loadError: 'Impossible de charger les offres.',
    retryBtn: 'Réessayer',
    noJobs: 'Aucun poste publié pour le moment',
    remote: 'À distance',
    formTitle: 'Envoyer votre candidature',
    nameLabel: 'Nom',
    emailLabel: 'E-mail',
    phoneLabel: 'Téléphone',
    expLabel: 'Années d’expérience',
    coverLabel: 'Lettre de motivation',
    submitBtn: 'Envoyer la candidature',
    submitting: 'Envoi en cours...',
    doneTitle: 'Candidature reçue',
    errSubmit: 'Impossible d’envoyer la candidature',
  },
  de: {
    seoTitle: 'Karriere | Wahy Wa Namaa',
    eyebrow: 'MITARBEITEN',
    title: 'Aktuelle Stellenangebote',
    loadingJobs: 'Stellenangebote werden geladen...',
    loadError: 'Stellenangebote konnten nicht geladen werden.',
    retryBtn: 'Erneut versuchen',
    noJobs: 'Derzeit keine offenen Stellen veröffentlicht',
    remote: 'Remote',
    formTitle: 'Bewerbung absenden',
    nameLabel: 'Name',
    emailLabel: 'E-Mail',
    phoneLabel: 'Telefon',
    expLabel: 'Jahre Erfahrung',
    coverLabel: 'Anschreiben',
    submitBtn: 'Bewerbung absenden',
    submitting: 'Wird gesendet...',
    doneTitle: 'Bewerbung eingegangen',
    errSubmit: 'Bewerbung konnte nicht gesendet werden',
  },
  tr: {
    seoTitle: 'Kariyer | Wahy Wa Namaa',
    eyebrow: 'BİZİMLE ÇALIŞIN',
    title: 'Açık Pozisyonlar',
    loadingJobs: 'Pozisyonlar yükleniyor...',
    loadError: 'Pozisyonlar şu anda yüklenemedi.',
    retryBtn: 'Tekrar Dene',
    noJobs: 'Şu anda yayımlanmış açık pozisyon yok',
    remote: 'Uzaktan',
    formTitle: 'Başvuru gönder',
    nameLabel: 'Ad Soyad',
    emailLabel: 'E-posta',
    phoneLabel: 'Telefon',
    expLabel: 'Deneyim yılı',
    coverLabel: 'Ön yazı',
    submitBtn: 'Başvuruyu gönder',
    submitting: 'Gönderiliyor...',
    doneTitle: 'Başvurunuz alındı',
    errSubmit: 'Başvuru gönderilemedi',
  },
  ur: {
    seoTitle: 'ملازمت کے مواقع | وحی و نما',
    eyebrow: 'ہمارے ساتھ کام کریں',
    title: 'موجودہ مواقع',
    loadingJobs: 'ملازمت کے مواقع لوڈ ہو رہے ہیں...',
    loadError: 'اس وقت مواقع لوڈ نہیں ہو سکے۔',
    retryBtn: 'دوبارہ کوشش کریں',
    noJobs: 'فی الحال کوئی ملازمت شائع نہیں ہے',
    remote: 'ریموٹ',
    formTitle: 'درخواست جمع کروائیں',
    nameLabel: 'نام',
    emailLabel: 'ای میل',
    phoneLabel: 'فون',
    expLabel: 'تجربہ (سال)',
    coverLabel: 'کور لیٹر',
    submitBtn: 'درخواست بھیجیں',
    submitting: 'بھیجا جا رہا ہے...',
    doneTitle: 'آپ کی درخواست موصول ہو گئی ہے',
    errSubmit: 'درخواست جمع نہیں ہو سکی',
  },
  id: {
    seoTitle: 'Karier | Wahy Wa Namaa',
    eyebrow: 'BERKARIER BERSAMA KAMI',
    title: 'Peluang saat ini',
    loadingJobs: 'Memuat lowongan...',
    loadError: 'Tidak dapat memuat lowongan saat ini.',
    retryBtn: 'Coba Lagi',
    noJobs: 'Belum ada posisi yang dipublikasikan',
    remote: 'Jarak jauh',
    formTitle: 'Kirim lamaran',
    nameLabel: 'Nama',
    emailLabel: 'Email',
    phoneLabel: 'Telepon',
    expLabel: 'Tahun pengalaman',
    coverLabel: 'Surat lamaran',
    submitBtn: 'Kirim lamaran',
    submitting: 'Mengirim...',
    doneTitle: 'Lamaran diterima',
    errSubmit: 'Tidak dapat mengirim lamaran',
  },
  ms: {
    seoTitle: 'Kerjaya | Wahy Wa Namaa',
    eyebrow: 'KERJAYA BERSAMA KAMI',
    title: 'Peluang terkini',
    loadingJobs: 'Memuatkan peluang...',
    loadError: 'Tidak dapat memuatkan peluang buat masa ini.',
    retryBtn: 'Cuba Lagi',
    noJobs: 'Tiada jawatan diterbitkan buat masa ini',
    remote: 'Jarak jauh',
    formTitle: 'Hantar permohonan',
    nameLabel: 'Nama',
    emailLabel: 'E-mel',
    phoneLabel: 'Telefon',
    expLabel: 'Tahun pengalaman',
    coverLabel: 'Surat iringan',
    submitBtn: 'Hantar permohonan',
    submitting: 'Menghantar...',
    doneTitle: 'Permohonan diterima',
    errSubmit: 'Tidak dapat menghantar permohonan',
  },
  ku: {
    seoTitle: 'دەرفەتەکانی کار | وەحی و نەما',
    eyebrow: 'کارکردن لەگەڵمان',
    title: 'دەرفەتە بەردەستەکانی ئێستا',
    loadingJobs: 'دەرفەتەکان باردەکرێن...',
    loadError: 'بارکردنی دەرفەتەکان ئێستا سەرکەوتوو نەبوو.',
    retryBtn: 'دووبارە هەوڵبدەرەوە',
    noJobs: 'ئێستا هیچ دەرفەتێکی بڵاوکراوە نییە',
    remote: 'لە دوورەوە',
    formTitle: 'ناردنی داواکاری',
    nameLabel: 'ناو',
    emailLabel: 'ئیمەیڵ',
    phoneLabel: 'تەلەفۆن',
    expLabel: 'ساڵانی ئەزموون',
    coverLabel: 'نامەی پێشکەشکردن',
    submitBtn: 'ناردنی داواکاری',
    submitting: 'دەنێردرێت...',
    doneTitle: 'داواکارییەکەت وەرگیرا',
    errSubmit: 'ناردنی داواکاری سەرکەوتوو نەبوو',
  },
};

export default function Careers() {
  const { locale, isRTL, dir } = useI18n();
  const toast = useToast();
  const baseCopy = isRTL ? CAREERS_COPY.ar : CAREERS_COPY.en;
  const copy = { ...baseCopy, ...(CAREERS_COPY[locale] || {}) };

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', coverLetter: '', experience: 0 });
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const loadJobs = useCallback(() => {
    setLoadingJobs(true);
    setJobsError('');
    api.get('/api/careers/jobs')
      .then((d) => setJobs(d.jobs || []))
      .catch((err) => {
        setJobs([]);
        setJobsError(err?.message || copy.loadError);
      })
      .finally(() => setLoadingJobs(false));
  }, [copy.loadError]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected || loading) return;
    setLoading(true);
    setSubmitError('');
    try {
      await api.post('/api/careers/apply', { ...form, position: selected, experience: Number(form.experience) });
      setDone(true);
    } catch (err) {
      const msg = err?.message || copy.errSubmit;
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead page={{ url: '/careers', title: copy.seoTitle, description: copy.seoDesc }} />
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
              <div className="wn-public-orbit__core"><BriefcaseBusiness size={46} strokeWidth={1.25} /></div>
            </div>
          </div>
        </section>

        <section className="wn-utility-wrap">
          {loadingJobs ? (
            <div className="grid gap-3" role="status" aria-live="polite">
              <span className="sr-only">{copy.loadingJobs}</span>
              {Array.from({ length: 3 }, (_, idx) => (
                <div key={idx} className="wn-career-card" aria-hidden="true">
                  <Skeleton className="h-5 w-1/2 mb-2" />
                  <Skeleton className="h-3.5 w-1/4 mb-3" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : jobsError ? (
            <div className="wn-public-empty" role="alert">
              <BriefcaseBusiness size={44} aria-hidden="true" />
              <h3>{copy.loadError}</h3>
              <p>{jobsError}</p>
              <button type="button" onClick={loadJobs} className="wn-btn wn-btn--primary mt-4 min-h-[44px]">
                <RefreshCw size={16} aria-hidden="true" />
                <span>{copy.retryBtn}</span>
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="wn-public-empty">
              <BriefcaseBusiness size={44} aria-hidden="true" />
              <h3>{copy.noJobs}</h3>
            </div>
          ) : (
            <div className="grid gap-3">
              {jobs.map((job) => {
                const isActive = selected === job.id;
                const reqs = isRTL ? job.requirements.ar : job.requirements.en;
                return (
                  <button
                    key={job.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => { setSelected(job.id); setDone(false); setSubmitError(''); }}
                    className={'wn-career-card min-h-[44px] ' + (isActive ? 'is-active' : '')}
                  >
                    <h2 className="text-base font-bold text-[var(--wn-heading)]">{isRTL ? job.title.ar : job.title.en}</h2>
                    <p className="flex items-center gap-1 mt-1 text-xs text-[var(--wn-text-secondary)]">
                      <MapPin size={13} aria-hidden="true" />
                      {job.type === 'remote' ? copy.remote : job.type}
                    </p>
                    <ul className="mt-2 text-xs text-[var(--wn-text-secondary)] space-y-1">
                      {reqs.map((req) => <li key={req}>• {req}</li>)}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}

          {selected && !done ? (
            <form onSubmit={submit} className="wn-utility-card mt-5 grid gap-3">
              <h2 className="font-[var(--wn-font-display)] text-xl text-[var(--wn-heading)]">{copy.formTitle}</h2>

              {submitError && (
                <div role="alert" className="rounded-xl border border-[var(--wn-danger)]/40 bg-[var(--wn-danger-soft)] px-4 py-3 text-sm text-[var(--wn-danger)]">
                  {submitError}
                </div>
              )}

              <div>
                <label htmlFor="career-name" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.nameLabel} *
                </label>
                <input
                  id="career-name"
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
                <label htmlFor="career-email" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.emailLabel} *
                </label>
                <input
                  id="career-email"
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
                <label htmlFor="career-phone" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.phoneLabel}
                </label>
                <input
                  id="career-phone"
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
                <label htmlFor="career-experience" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.expLabel}
                </label>
                <input
                  id="career-experience"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder={copy.expLabel}
                  className="input-field min-h-[44px]"
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="career-cover" className="block text-xs font-bold text-[var(--wn-heading)] mb-1.5">
                  {copy.coverLabel} *
                </label>
                <textarea
                  id="career-cover"
                  required
                  placeholder={copy.coverLabel}
                  className="input-field min-h-[120px]"
                  value={form.coverLetter}
                  onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="wn-btn wn-btn--primary wn-btn--block min-h-[44px]"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                    <span className="sr-only">{copy.submitting}</span>
                  </>
                ) : (
                  copy.submitBtn
                )}
              </button>
            </form>
          ) : null}

          {done ? (
            <div className="wn-utility-card mt-5 text-center" role="status">
              <CheckCircle size={48} className="mx-auto text-[var(--wn-link)]" aria-hidden="true" />
              <h2 className="mt-3 font-[var(--wn-font-display)] text-xl text-[var(--wn-heading)]">{copy.doneTitle}</h2>
            </div>
          ) : null}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
