import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '../i18n';

const PWA_COPY = {
  ar: {
    title: 'ثبّت تطبيق وَحْيٌ وَنَمَاء',
    description: 'وصول سريع للحصص والشهادات من شاشة الهاتف',
    install: 'تثبيت',
    close: 'إغلاق',
  },
  en: {
    title: 'Install Wahy Wa Namaa App',
    description: 'Quick access to sessions and certificates directly from your mobile screen',
    install: 'Install',
    close: 'Close',
  },
  fr: {
    title: 'Installer l’application Wahy Wa Namaa',
    description: 'Accès rapide à vos cours et certificats depuis l’écran d’accueil',
    install: 'Installer',
    close: 'Fermer',
  },
  de: {
    title: 'Wahy Wa Namaa App installieren',
    description: 'Schneller Zugriff auf Unterrichtsstunden und Zertifikate vom Startbildschirm',
    install: 'Installieren',
    close: 'Schließen',
  },
  tr: {
    title: 'Wahy Wa Namaa Uygulamasını Yükle',
    description: 'Derslerinize ve sertifikalarınıza ana ekrandan hızlıca ulaşın',
    install: 'Yükle',
    close: 'Kapat',
  },
  ur: {
    title: 'وحی و نما ایپ انسٹال کریں',
    description: 'موبائل اسکرین سے براہ راست اسباق اور اسناد تک فوری رسائی',
    install: 'انسٹال کریں',
    close: 'بند کریں',
  },
  id: {
    title: 'Instal Aplikasi Wahy Wa Namaa',
    description: 'Akses cepat ke sesi dan sertifikat langsung dari layar ponsel Anda',
    install: 'Instal',
    close: 'Tutup',
  },
  ms: {
    title: 'Pasang Aplikasi Wahy Wa Namaa',
    description: 'Akses pantas ke sesi dan sijil terus daripada skrin telefon anda',
    install: 'Pasang',
    close: 'Tutup',
  },
  ku: {
    title: 'ئەپی وەحی و نەما دابمەزرێنە',
    description: 'گەیشتنی خێرا بە وانەکان و بڕوانامەکان لە شاشەی مۆبایلەوە',
    install: 'دامەزراندن',
    close: 'داخستن',
  },
};

export default function PwaInstallPrompt() {
  const { locale, isRTL, t } = useI18n();
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('pwa-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (!dismissed) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  const dismiss = () => {
    try {
      localStorage.setItem('pwa-dismissed', '1');
    } catch {
      // Ignore storage failures in restricted contexts
    }
    setDismissed(true);
    setVisible(false);
  };

  if (!visible) return null;

  const fallback = PWA_COPY[locale] || (isRTL ? PWA_COPY.ar : PWA_COPY.en);
  const title = t.common?.pwaTitle || fallback.title;
  const description = t.common?.pwaDescription || fallback.description;
  const installLabel = t.common?.pwaInstall || fallback.install;
  const closeLabel = t.common?.pwaDismiss || t.common?.close || fallback.close;

  return (
    <div
      role="region"
      aria-label={title}
      className="fixed bottom-[calc(var(--wn-mobile-bar-h,72px)+1rem)] lg:bottom-6 inset-x-4 md:inset-x-auto md:end-6 md:max-w-sm z-[100] bg-[var(--wn-surface)] border border-[var(--wn-border-strong)] shadow-xl rounded-2xl p-4 flex gap-3 items-start text-start"
    >
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[var(--wn-text-primary)]">{title}</p>
        <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{description}</p>
        <button
          type="button"
          onClick={install}
          className="mt-3 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-semibold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        >
          <Download size={14} aria-hidden="true" />
          <span>{installLabel}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[var(--wn-text-secondary)] hover:text-[var(--wn-text-primary)] hover:bg-[var(--wn-emerald-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        aria-label={closeLabel}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
