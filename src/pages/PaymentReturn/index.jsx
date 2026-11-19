import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import LocalizedLink from '../../components/LocalizedLink';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import api from '../../lib/api';
import '../../styles/public-experience.css';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'refunded']);

export default function PaymentReturn() {
  const { locale, dir, t } = useI18n();
  const pr = t.payments.return;
  const [params] = useSearchParams();
  const paymentId = params.get('payment') || '';
  const courseSlug = params.get('course') || '';
  const [payment, setPayment] = useState(null);
  const [errorType, setErrorType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [polling, setPolling] = useState(Boolean(paymentId));
  const [timedOut, setTimedOut] = useState(false);
  const [retrySeq, setRetrySeq] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setErrorType('missing');
      setErrorMessage('');
      setPolling(false);
      setTimedOut(false);
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timer;

    setErrorType('');
    setErrorMessage('');
    setTimedOut(false);
    setPolling(true);

    const load = async () => {
      attempts += 1;
      try {
        const data = await api.get('/api/payments/' + encodeURIComponent(paymentId) + '/status', { auth: true });
        if (cancelled) return;

        const next = data?.payment || null;
        setPayment(next);
        setErrorType('');
        setErrorMessage('');

        if (TERMINAL.has(next?.status)) {
          setPolling(false);
          setTimedOut(false);
          return;
        }

        if (attempts >= 15) {
          setPolling(false);
          setTimedOut(true);
          return;
        }

        timer = window.setTimeout(load, 2000);
      } catch (err) {
        if (cancelled) return;
        setErrorType('read');
        setErrorMessage(err?.message || '');
        setPolling(false);
        setTimedOut(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [paymentId, retrySeq]);

  const resolvedError = errorType === 'missing'
    ? pr.missingRef
    : errorType === 'read'
      ? (errorMessage || pr.readError)
      : '';

  const status = payment?.status || (polling ? 'pending' : '');
  const view = useMemo(() => {
    if (resolvedError) {
      return {
        Icon: XCircle,
        title: pr.titles.error,
        text: resolvedError,
        tone: 'text-[var(--wn-text-danger)]',
      };
    }

    if (status === 'succeeded') {
      return {
        Icon: CheckCircle,
        title: pr.titles.succeeded,
        text: pr.messages.succeeded,
        tone: 'text-[var(--wn-emerald)]',
      };
    }

    if (status === 'failed' || status === 'cancelled') {
      return {
        Icon: XCircle,
        title: pr.titles.failed,
        text: pr.messages.failed,
        tone: 'text-[var(--wn-text-danger)]',
      };
    }

    if (status === 'refunded') {
      return {
        Icon: RefreshCw,
        title: pr.titles.refunded,
        text: pr.messages.refunded,
        tone: 'text-[var(--wn-status-warn-text)]',
      };
    }

    return {
      Icon: Clock3,
      title: pr.titles.verifying,
      text: pr.messages.verifying,
      tone: 'text-[var(--wn-emerald)]',
    };
  }, [resolvedError, status, pr]);

  const Icon = view.Icon;
  const canRetry = Boolean(paymentId) && (errorType === 'read' || (timedOut && !TERMINAL.has(status)));

  return (
    <>
      <SEOHead page={{ title: pr.seoTitle, description: pr.seoDesc, noindex: true, canonical: false }} />
      <GlobalHeader />
      <main className="wn-public-shell min-h-[70vh]" dir={dir}>
        <section className="wn-utility-wrap">
          <div className="wn-utility-card max-w-xl mx-auto text-center">
            <div role="status" aria-live="polite">
              <Icon
                size={52}
                className={'mx-auto ' + view.tone + (polling ? ' animate-pulse' : '')}
                aria-hidden="true"
              />
              <h1 className="mt-4 font-[var(--wn-font-display)] text-2xl text-[var(--wn-heading)]">
                {view.title}
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--wn-text-secondary)]">{view.text}</p>
            </div>

            <div className="mt-6 grid gap-2">
              {canRetry ? (
                <button
                  type="button"
                  disabled={polling}
                  onClick={() => setRetrySeq((n) => n + 1)}
                  className="wn-btn wn-btn--primary wn-btn--block min-h-[44px] inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {polling ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                      <span>{pr.checkingNow}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} aria-hidden="true" />
                      <span>{pr.retry}</span>
                    </>
                  )}
                </button>
              ) : null}
              {status === 'succeeded' && courseSlug ? (
                <LocalizedLink
                  to={'/courses/' + courseSlug}
                  locale={locale}
                  className="wn-btn wn-btn--primary wn-btn--block min-h-[44px] inline-flex items-center justify-center"
                >
                  {pr.actions.goToCourse}
                </LocalizedLink>
              ) : null}
              {courseSlug ? (
                <LocalizedLink
                  to={'/courses/' + courseSlug}
                  locale={locale}
                  className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px] inline-flex items-center justify-center"
                >
                  {pr.actions.backToCourse}
                </LocalizedLink>
              ) : (
                <LocalizedLink
                  to="/courses"
                  locale={locale}
                  className="wn-btn wn-btn--secondary wn-btn--block min-h-[44px] inline-flex items-center justify-center"
                >
                  {pr.actions.browseCourses}
                </LocalizedLink>
              )}
            </div>

            <p className="mt-5 text-[11px] text-[var(--wn-text-tertiary)]">{pr.callbackNote}</p>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
