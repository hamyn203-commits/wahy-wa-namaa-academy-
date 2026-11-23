import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import {
  DEFAULT_LOCALE,
  RTL_LOCALES,
  getLocaleFromPath,
  isValidLocale,
  localizedPath,
} from '../../lib/locale';
import { isChunkLoadError, reloadOnceForChunkError } from '../../lib/chunkRecovery';

const ERROR_COPY = {
  ar: {
    title: 'عذراً، حدث خطأ غير متوقع',
    description: 'واجهنا مشكلة في تحميل الصفحة. يرجى المحاولة مرة أخرى أو العودة للصفحة الرئيسية.',
    devDetails: 'تفاصيل الخطأ (للمطورين)',
    retry: 'إعادة المحاولة',
    home: 'الصفحة الرئيسية',
  },
  en: {
    title: 'Sorry, an unexpected error occurred',
    description: 'We ran into a problem loading this page. Please try again or return to the home page.',
    devDetails: 'Error details (for developers)',
    retry: 'Try again',
    home: 'Home page',
  },
  fr: {
    title: 'Désolé, une erreur inattendue est survenue',
    description: 'Un problème est survenu lors du chargement de cette page. Veuillez réessayer ou revenir à l’accueil.',
    devDetails: 'Détails de l’erreur (développeurs)',
    retry: 'Réessayer',
    home: 'Page d’accueil',
  },
  de: {
    title: 'Entschuldigung, ein unerwarteter Fehler ist aufgetreten',
    description: 'Beim Laden dieser Seite ist ein Problem aufgetreten. Bitte versuchen Sie es erneut oder kehren Sie zur Startseite zurück.',
    devDetails: 'Fehlerdetails (für Entwickler)',
    retry: 'Erneut versuchen',
    home: 'Startseite',
  },
  tr: {
    title: 'Üzgünüz, beklenmeyen bir hata oluştu',
    description: 'Bu sayfa yüklenirken bir sorunla karşılaşıldı. Lütfen tekrar deneyin veya ana sayfaya dönün.',
    devDetails: 'Hata ayrıntıları (geliştiriciler için)',
    retry: 'Tekrar dene',
    home: 'Ana sayfa',
  },
  ur: {
    title: 'معذرت، ایک غیر متوقع خرابی پیش آگئی',
    description: 'اس صفحے کو لوڈ کرنے میں مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں یا مرکزی صفحے پر واپس جائیں۔',
    devDetails: 'خرابی کی تفصیلات (ڈویلپرز کے لیے)',
    retry: 'دوبارہ کوشش کریں',
    home: 'مرکزی صفحہ',
  },
  id: {
    title: 'Maaf, terjadi kesalahan tak terduga',
    description: 'Kami mengalami kendala saat memuat halaman ini. Silakan coba lagi atau kembali ke beranda.',
    devDetails: 'Detail kesalahan (untuk pengembang)',
    retry: 'Coba lagi',
    home: 'Beranda',
  },
  ms: {
    title: 'Maaf, ralat tidak dijangka telah berlaku',
    description: 'Kami menghadapi masalah memuatkan halaman ini. Sila cuba lagi atau kembali ke halaman utama.',
    devDetails: 'Butiran ralat (untuk pembangun)',
    retry: 'Cuba lagi',
    home: 'Halaman utama',
  },
  ku: {
    title: 'ببورە، هەڵەیەکی چاوەڕواننەکراو ڕوویدا',
    description: 'لە بارکردنی ئەم پەڕەیەدا کێشەیەک ڕوویدا. تکایە دووبارە هەوڵبدەرەوە یان بگەڕێوە بۆ پەڕەی سەرەکی.',
    devDetails: 'وردەکاری هەڵە (بۆ گەشەپێدەران)',
    retry: 'دووبارە هەوڵبدە',
    home: 'پەڕەی سەرەکی',
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    console.error('ErrorBoundary caught an error:', {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error?.message || 'Unknown error',
        fatal: true,
      });
    }

    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }

  resolveLocale() {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;
    const pathLocale = getLocaleFromPath(window.location.pathname);
    if (pathLocale) return pathLocale;
    try {
      const storedLocale = window.localStorage?.getItem('locale');
      if (isValidLocale(storedLocale)) return storedLocale;
    } catch {
      // ignore storage access errors
    }
    return DEFAULT_LOCALE;
  }

  handleRetry = () => {
    if (isChunkLoadError(this.state.error) && reloadOnceForChunkError({ force: true })) {
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    const locale = this.resolveLocale();
    window.location.href = localizedPath('/', locale);
  };

  render() {
    if (this.state.hasError) {
      const locale = this.resolveLocale();
      const isRTL = RTL_LOCALES.includes(locale);
      const copy = ERROR_COPY[locale] || (isRTL ? ERROR_COPY.ar : ERROR_COPY.en);

      return (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--wn-bg)',
            padding: 'var(--wn-space-4)',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        >
          <div
            className="wn-card"
            style={{
              maxWidth: '600px',
              width: '100%',
              textAlign: 'center',
              padding: 'clamp(2rem, 5vw, 3.75rem) clamp(1.25rem, 4vw, 2.5rem)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '5rem',
                height: '5rem',
                margin: '0 auto var(--wn-space-5)',
                background: 'var(--wn-danger-soft)',
                borderRadius: 'var(--wn-radius-pill)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={40} style={{ color: 'var(--wn-text-danger)' }} />
            </div>

            <h1
              style={{
                fontSize: 'var(--wn-text-2xl)',
                fontWeight: '800',
                color: 'var(--wn-heading)',
                marginBottom: 'var(--wn-space-3)',
                fontFamily: 'var(--wn-font-display)',
              }}
            >
              {copy.title}
            </h1>

            <p
              style={{
                fontSize: 'var(--wn-text-base)',
                color: 'var(--wn-text-secondary)',
                marginBottom: 'var(--wn-space-6)',
                lineHeight: '1.7',
              }}
            >
              {copy.description}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details
                style={{
                  textAlign: 'start',
                  marginBottom: 'var(--wn-space-5)',
                  padding: 'var(--wn-space-4)',
                  background: 'var(--wn-surface-sunken)',
                  borderRadius: 'var(--wn-radius-md)',
                  border: '1px solid var(--wn-border)',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: 'var(--wn-text-danger)',
                    marginBottom: 'var(--wn-space-2)',
                  }}
                >
                  {copy.devDetails}
                </summary>
                <pre
                  style={{
                    fontSize: 'var(--wn-text-xs)',
                    color: 'var(--wn-text-secondary)',
                    overflow: 'auto',
                    marginTop: 'var(--wn-space-3)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div
              style={{
                display: 'flex',
                gap: 'var(--wn-space-3)',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={this.handleRetry}
                className="wn-btn wn-btn--primary"
                style={{ minHeight: 'var(--wn-control-md)' }}
              >
                <RefreshCw size={18} aria-hidden="true" />
                {copy.retry}
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="wn-btn wn-btn--secondary"
                style={{ minHeight: 'var(--wn-control-md)' }}
              >
                <Home size={18} aria-hidden="true" />
                {copy.home}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}