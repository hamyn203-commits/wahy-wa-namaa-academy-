import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
} from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useToast } from '../../context/ToastProvider';
import { downloadCertificatePdf } from '../../lib/certificatePdf';
import { useI18n } from '../../i18n';
import '../../styles/public-experience.css';

export default function CertificateView() {
  const { certificateId } = useParams();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const toast = useToast();
  const [certificate, setCertificate] = useState(null);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    fetch('/api/certificates/' + certificateId)
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
          setError(err.message || (isAr ? 'تعذر تحميل الشهادة' : 'Unable to load certificate'));
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [certificateId, isAr]);

  const handleDownload = async () => {
    try {
      await downloadCertificatePdf({ certificate, locale });
      toast.success(isAr ? 'تم تجهيز ملف الشهادة بصيغة PDF' : 'Certificate PDF downloaded');
    } catch {
      toast.error(isAr ? 'تعذر إنشاء ملف PDF' : 'PDF generation failed');
    }
  };

  const handleShare = async () => {
    const title = isAr
      ? 'شهادة إتمام ' + (certificate.course?.title?.ar || '')
      : 'Certificate of completion';
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url: window.location.href });
      } catch {
        // User cancelled share sheet
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(isAr ? 'تم نسخ رابط التحقق من الشهادة' : 'Verification link copied');
    }
  };

  const copyCertificateId = async () => {
    const code = certificate?.certificateId || certificateId;
    if (!code) return;
    await navigator.clipboard?.writeText(String(code));
    toast.success(isAr ? 'تم نسخ رقم الشهادة المرجعي' : 'Certificate ID copied');
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-public-shell" role="status" aria-live="polite">
          <span className="sr-only">{isAr ? 'جاري التحقق من الشهادة...' : 'Verifying certificate...'}</span>
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
        <GlobalHeader />
        <main className="wn-public-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-public-empty max-w-xl w-full">
            <XCircle size={48} />
            <h3>{isAr ? 'الشهادة غير موجودة أو غير متاحة' : 'Certificate not found or unavailable'}</h3>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const isValid = verification?.valid === true;
  const courseTitle =
    certificate.course?.title?.[locale] ||
    certificate.course?.title?.ar ||
    certificate.course?.title?.en ||
    '';
  const studentName = certificate.student?.name || '—';
  const score = certificate.metadata?.score;
  const certCode = certificate.certificateId || certificateId;

  return (
    <>
      <SEOHead
        page={{
          title: isAr ? 'التحقق من شهادة ' + studentName : 'Certificate verification',
          description: isAr
            ? 'التحقق من شهادة صادرة وموثقة من نظام أكاديمية وحي ونماء.'
            : 'Verify an official certificate issued by Wahy Wa Namaa Academy.',
          url: '/verify-certificate/' + certificateId,
        }}
      />
      <GlobalHeader />
      <main className="wn-public-shell">
        <section className="wn-utility-wrap max-w-4xl">
          <div
            className={
              'mb-5 p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ' +
              (isValid ? 'border-emerald-200 bg-emerald-50/90' : 'border-red-200 bg-red-50')
            }
          >
            <div className="flex items-start gap-3">
              {isValid ? (
                <CheckCircle className="text-emerald-700 shrink-0 mt-0.5" size={22} />
              ) : (
                <XCircle className="text-red-700 shrink-0 mt-0.5" size={22} />
              )}
              <div>
                <strong className={isValid ? 'text-emerald-950 block' : 'text-red-900 block'}>
                  {isValid
                    ? isAr
                      ? 'شهادة رسمية موثّقة في سجل أكاديمية وَحْيٌ وَنَمَاء'
                      : 'Official Certificate Verified in Wahy Wa Namaa Registry'
                    : isAr
                      ? 'تعذر التحقق من صلاحية الشهادة'
                      : 'Certificate could not be verified'}
                </strong>
                {!isValid && verification?.reason ? (
                  <p className="text-xs mt-1 text-red-700">{verification.reason}</p>
                ) : (
                  <p className="text-xs mt-0.5 text-emerald-800/80">
                    {isAr
                      ? 'تم التحقق إلكترونيًا من صحة البيانات وتطابقها مع السجل الأكاديمي.'
                      : 'Cryptographically and digitally matched with academy records.'}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={copyCertificateId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100/60 transition"
            >
              <Copy size={13} />
              <span>{certCode}</span>
            </button>
          </div>

          <article className="wn-certificate">
            <header className="wn-certificate__head">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-[#efd28e] mb-2">
                <Sparkles size={14} />
                {isAr ? 'وثيقة إتمام معتمدة' : 'CERTIFIED COMPLETION DOCUMENT'}
              </div>
              <Award size={52} className="mx-auto mt-2 text-[#efd28e]" />
              <h1 className="mt-2">{isAr ? 'شهادة إتمام وإنجاز' : 'Certificate of Completion'}</h1>
              <p>{isAr ? 'أكاديمية وَحْيٌ وَنَمَاء للقرآن الكريم والعلوم الشرعية' : 'Wahy Wa Namaa Academy for Quran & Islamic Studies'}</p>
            </header>

            <div className="wn-certificate__body">
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {isAr ? 'تشهد إدارة الأكاديمية بأن الطالب / الطالبة' : 'This certificate proudly attests that'}
              </p>
              <h2 className="wn-certificate__name">{studentName}</h2>
              <p className="text-sm text-[var(--wn-text-secondary)]">
                {isAr ? 'قد أتم بنجاح متطلبات البرنامج التعليمي المسجل باسم' : 'has successfully completed the recorded program'}
              </p>
              <h3 className="wn-certificate__course mt-2">{courseTitle}</h3>

              <div className="wn-certificate__meta">
                <div>
                  <Calendar size={19} />
                  <small>{isAr ? 'تاريخ الإصدار' : 'Issue date'}</small>
                  <strong>
                    {certificate.issuedAt
                      ? new Date(certificate.issuedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—'}
                  </strong>
                </div>
                <div>
                  <BookOpen size={19} />
                  <small>{isAr ? 'النتيجة المسجلة' : 'Recorded score'}</small>
                  <strong>{score != null ? score + '%' : '—'}</strong>
                </div>
                <div>
                  <User size={19} />
                  <small>{isAr ? 'معرّف الشهادة' : 'Certificate ID'}</small>
                  <strong>{certCode}</strong>
                </div>
              </div>

              {/* QR & Verification Seal Section */}
              <div className="mt-7 inline-flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-amber-200/70 bg-[#fffdf7] p-4 text-start max-w-lg mx-auto">
                {certificate.qrCode ? (
                  <img
                    src={certificate.qrCode}
                    alt="QR"
                    className="w-28 h-28 rounded-xl border border-amber-200/60 bg-white p-1.5 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-emerald-200 bg-emerald-50 grid place-items-center text-emerald-800 shrink-0">
                    <QrCode size={36} />
                  </div>
                )}
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800">
                    <ShieldCheck size={15} />
                    {isAr ? 'ختم التحقق الرقمي المعتمد' : 'Verified Digital Seal'}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--wn-text-secondary)]">
                    {isAr
                      ? 'يمكن لأي جهة التحقق الفوري من صحة هذه الشهادة عبر مسح رمز الاستجابة السريعة (QR) أو عبر الرابط الرسمي للشهادة.'
                      : 'Anyone can verify the authenticity of this certificate by scanning the QR code or visiting the official verification URL.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2.5 mt-7">
                <button onClick={handleDownload} className="wn-btn wn-btn--primary">
                  <Download size={16} />
                  {isAr ? 'تحميل الشهادة PDF' : 'Download PDF'}
                </button>
                <button onClick={handleShare} className="wn-btn wn-btn--secondary">
                  <Share2 size={16} />
                  {isAr ? 'مشاركة رابط التحقق' : 'Share verification link'}
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
