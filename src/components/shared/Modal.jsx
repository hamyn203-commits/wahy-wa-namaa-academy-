import { useEffect, useId, useRef } from 'react';
import { X, Star } from 'lucide-react';
import { useI18n } from '../../i18n';

const CLOSE_LABELS = {
  ar: 'إغلاق',
  en: 'Close',
  fr: 'Fermer',
  de: 'Schließen',
  tr: 'Kapat',
  ur: 'بند کریں',
  id: 'Tutup',
  ms: 'Tutup',
  ku: 'داخستن',
};

const DIALOG_LABELS = {
  ar: 'نافذة حوارية',
  en: 'Dialog',
  fr: 'Fenêtre de dialogue',
  de: 'Dialogfenster',
  tr: 'İletişim penceresi',
  ur: 'مکالمہ',
  id: 'Dialog',
  ms: 'Dialog',
  ku: 'دیالۆگ',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '560px',
  ariaLabel,
  ariaLabelledBy,
}) {
  const { locale, t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const rafId = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      } else if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else {
        dialog.focus();
      }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      const previous = previousFocusRef.current;
      if (previous && previous.isConnected && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const closeLabel = t?.common?.close || CLOSE_LABELS[locale] || CLOSE_LABELS.en;
  const fallbackDialogLabel = DIALOG_LABELS[locale] || DIALOG_LABELS.en;
  const hasTitle = typeof title === 'string' ? title.trim().length > 0 : Boolean(title);
  const resolvedLabelledBy = ariaLabelledBy || (hasTitle ? titleId : undefined);
  const resolvedAriaLabel = ariaLabel || (!resolvedLabelledBy ? fallbackDialogLabel : undefined);

  return (
    <div className="wn-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="wn-modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={resolvedAriaLabel}
        aria-labelledby={resolvedLabelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wn-modal__header">
          {hasTitle ? (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <h2 id={titleId} className="wn-modal__title break-words">
                {title}
              </h2>
              <div className="flex w-full items-center justify-center gap-2" aria-hidden="true">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--wn-gold)] to-transparent opacity-40" />
                <Star size={14} className="shrink-0 text-[var(--wn-gold)]" fill="currentColor" />
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--wn-gold)] to-transparent opacity-40" />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-2" aria-hidden="true">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--wn-gold)] to-transparent opacity-40" />
              <Star size={14} className="shrink-0 text-[var(--wn-gold)]" fill="currentColor" />
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--wn-gold)] to-transparent opacity-40" />
            </div>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            className="wn-modal__close min-h-[44px] min-w-[44px]"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="wn-modal__body">
          {children}
        </div>
      </div>
    </div>
  );
}
