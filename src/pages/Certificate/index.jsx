import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  XCircle,
  Download,
  Share2,
  Sparkles,
  Copy,
  ShieldCheck,
  QrCode,
  Loader2,
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import { useToast } from '../../context/ToastProvider';
import { downloadCertificatePdf } from '../../lib/certificatePdf';
import { useI18n } from '../../i18n';
import { localizedPath, resolveIntlLocale } from '../../lib/locale';
import '../../styles/public-experience.css';

export default function CertificateView() {
  const { certificateId } = useParams();
  const { locale, isRTL, dir, t } = useI18n();
  const toast = useToast();
  const [certificate, setCertificate] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const loadErrorFallback = t.lms?.certificate?.loadError || 'Unable to load certificate';

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    fetch('/api/certificates/' + encodeURIComponent(certificateId))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed');
        if (!ignore) {
          setCertificate(data.certificate);
          setVerification(data.verification || null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || loadErrorFallback);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [certificateId, loadErrorFallback]);

  const handleDownload = async () => {
    if (downloading || !certificate) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf({ certificate, locale });
      toast.success(t.lms?.certificate?.pdfDownloaded || 'Certificate PDF downloaded');
    } catch {
      toast.error(t.lms?.certificate?.pdfFailed || 'PDF generation failed');
    } finally {
      setDownloading(false);
    }
  };

  const courseTitle = certificate
    ? (isRTL
        ? (certificate.course?.title?.[locale] || certificate.course?.title?.ar || certificate.course?.title?.en || '')
        : (certificate.course?.title?.[locale] || certificate.course?.title?.en || certificate.course?.title?.ar || ''))
    : '';

  const handleShare = async () => {
    const baseTitle = t.lms?.certificate?.shareTitle || 'Certificate of completion';
    const title = courseTitle ? `${baseTitle} — ${courseTitle}` : baseTitle;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url: window.location.href });
      } catch {
        // User cancelled share sheet
      }
    } else {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(window.location.href);
        toast.success(t.lms?.certificate?.linkCopied || 'Verification link copied');
      } catch {
        toast.error(t.common?.error || 'Error');
      }
    }
  };

  const copyCertificateId = async () => {
    const code = certificate?.certificateId || certificateId;
    if (!code) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(String(code));
      toast.success(t.lms?.certificate?.idCopied || 'Certificate ID copied');
    } catch {
      toast.error(t.common?.error || 'Error');
    }
  };

  if (loading) {
    return (
      <>
        <SEOHead
          page={{
            title: t.lms?.certificate?.seoTitle || t.lms?.certificate?.verifyTitle || 'Certificate verification',
            url: '/verify-certificate/' + certificateId,
            noindex: true,
            canonical: false,
          }}
        />
        <GlobalHeader />
        <main className="wn-public-shell" dir={dir} role="status" aria-live="polite">
          <span className="sr-only">{t.lms?.certificate?.loadingMsg || 'Verifying certificate…'}</span>
          <section className="wn-utility-wrap max-w-4xl space-y-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="wn-certificate">
              <div className="wn-certificate__head">
                <Skeleton className="mx-auto h-12 w-12 rounded-full bg-white/20" />
                <Skeleton className="mx-auto mt-4 h-9 w-64 bg-white/20" />
                <Skeleton className="mx-auto mt-2 h-4 w-44 bg-white/15" />
              </div>
              <div className="wn-certificate__body space-y-4">
                <Skeleton className="mx-auto h-4 w-40" />
                <Skeleton className="mx-auto h-10 w-72" />
                <Skeleton className="mx-auto h-6 w-56" />
                <div className="wn-certificate__meta">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>
            </div>
          </section>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (error || !certificate) {
    return (
      <>
        <SEOHead
          page={{
            title: t.lms?.certificate?.seoTitle || t.lms?.certificate?.verifyTitle || 'Certificate verification',
            url: '/verify-certificate/' + certificateId,
            noindex: true,
            canonical: false,
          }}
        />
        <GlobalHeader />
        <main className="wn-public-shell min-h-[70vh] grid place-items-center px-4" dir={dir}>
          <div className="max-w-xl w-full">
            <EmptyState
              icon={XCircle}
              title={t.lms?.certificate?.notFound || t.lms?.certificate?.invalidOrNotFound || 'Certificate not found or unavailable'}
              action={(
                <Link to={localizedPath('/', locale)} className="wn-btn wn-btn--primary min-h-[44px]">
                  {t.lms?.certificate?.backHome || 'Back to Home'}
                </Link>
              )}
            />
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const isValid = verification?.valid === true;
  const studentName = certificate.student?.name || '—';
  const score = certificate.metadata?.score;
  const certCode = certificate.certificateId || certificateId;
  const intlLocale = resolveIntlLocale(locale);

  return (
    <>
      <SEOHead
        page={{
          title: `${t.lms?.certificate?.seoTitle || 'Certificate verification'} — ${studentName}`,
          description: t.lms?.certificate?.seoDescription || 'Verify an official certificate issued by Wahy Wa Namaa Academy.',
          url: '/verify-certificate/' + certificateId,
          noindex: true,
          canonical: false,
        }}
      />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-utility-wrap max-w-4xl">
          <div
            className={
              'mb-5 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ' +
              (isValid
                ? 'border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] text-[var(--wn-heading)]'
                : 'border-[var(--wn-danger)]/35 bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)]')
            }
          >
            <div className="flex items-start gap-3 min-w-0">
              {isValid ? (
                <CheckCircle className="text-[var(--wn-success)] shrink-0 mt-0.5" size={22} aria-hidden="true" />
              ) : (
                <XCircle className="text-[var(--wn-text-danger)] shrink-0 mt-0.5" size={22} aria-hidden="true" />
              )}
              <div className="min-w-0">
                <strong className="block">
                  {isValid
                    ? (t.lms?.certificate?.verifiedTitle || 'Official Certificate Verified in Wahy Wa Namaa Registry')
                    : (t.lms?.certificate?.notVerifiedTitle || 'Certificate could not be verified')}
                </strong>
                {!isValid && verification?.reason ? (
                  <p className="text-xs mt-1">{verification.reason}</p>
                ) : (
                  <p className="text-xs mt-0.5 text-[var(--wn-text-secondary)]">
                    {t.lms?.certificate?.verifiedDesc || 'Digitally verified and matched with official academy records.'}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={copyCertificateId}
              aria-label={t.lms?.certificate?.copyId || 'Copy Certificate ID'}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3.5 py-2 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] transition"
            >
              <Copy size={14} aria-hidden="true" />
              <span>{certCode}</span>
            </button>
          </div>

          <article className="wn-certificate">
            <header className="wn-certificate__head">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[var(--wn-gold)] mb-2">
                <Sparkles size={14} aria-hidden="true" />
                {t.lms?.certificate?.eyebrow || 'CERTIFIED COMPLETION DOCUMENT'}
              </div>
              <Award size={52} className="mx-auto mt-2 text-[var(--wn-gold)]" aria-hidden="true" />
              <h1 className="mt-2">{t.lms?.certificate?.heading || 'Certificate of Completion'}</h1>
              <p>{t.lms?.certificate?.academySubtitle || 'Wahy Wa Namaa Academy for Quran & Islamic Studies'}</p>
            </header>

            <div className="wn-certificate__body">
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {t.lms?.certificate?.attestsThat || 'This certificate proudly attests that'}
              </p>
              <h2 className="wn-certificate__name">{studentName}</h2>
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {t.lms?.certificate?.completedProgram || 'has successfully completed the recorded program'}
              </p>
              <h3 className="wn-certificate__course mt-2">{courseTitle}</h3>

              <div className="wn-certificate__meta">
                <div>
                  <Calendar size={19} aria-hidden="true" />
                  <small>{t.lms?.certificate?.issueDateLabel || 'Issue date'}</small>
                  <strong>
                    {certificate.issuedAt
                      ? new Date(certificate.issuedAt).toLocaleDateString(intlLocale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </strong>
                </div>
                <div>
                  <BookOpen size={19} aria-hidden="true" />
                  <small>{t.lms?.certificate?.recordedScoreLabel || 'Recorded score'}</small>
                  <strong>{score != null ? score + '%' : '—'}</strong>
                </div>
                <div>
                  <User size={19} aria-hidden="true" />
                  <small>{t.lms?.certificate?.certIdLabel || 'Certificate ID'}</small>
                  <strong>{certCode}</strong>
                </div>
              </div>

              {/* QR & Verification Seal Section */}
              <div className="mt-7 inline-flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-[var(--wn-border-strong)] bg-[var(--wn-surface-soft)] p-4 text-start max-w-lg mx-auto">
                {certificate.qrCode ? (
                  <img
                    src={certificate.qrCode}
                    alt={t.lms?.certificate?.digitalSealTitle || 'QR'}
                    className="w-28 h-28 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-white)] p-1.5 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] grid place-items-center text-[var(--wn-heading)] shrink-0">
                    <QrCode size={36} aria-hidden="true" />
                  </div>
                )}
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--wn-heading)]">
                    <ShieldCheck size={15} aria-hidden="true" />
                    {t.lms?.certificate?.digitalSealTitle || 'Verified Digital Seal'}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--wn-text-secondary)]">
                    {t.lms?.certificate?.digitalSealDesc || 'Anyone can verify the authenticity of this certificate by scanning the QR code or visiting the official verification URL.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5 mt-7">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="wn-btn wn-btn--primary min-h-[44px]"
                >
                  {downloading ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Download size={16} aria-hidden="true" />
                  )}
                  <span>{t.lms?.certificate?.downloadPdfBtn || t.lms?.certificate?.downloadPdf || 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="wn-btn wn-btn--secondary min-h-[44px]"
                >
                  <Share2 size={16} aria-hidden="true" />
                  <span>{t.lms?.certificate?.shareLinkBtn || 'Share verification link'}</span>
                </button>
              </div>
            </div>
          </article>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
