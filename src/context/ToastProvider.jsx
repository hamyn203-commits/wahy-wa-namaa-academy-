import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../i18n';

const ToastContext = createContext(null);

const CLOSE_LABELS = {
  ar: 'إغلاق',
  en: 'Close',
  fr: 'Fermer',
  de: 'Schließen',
  tr: 'Kapat',
  ur: 'بند کریں',
  id: 'Tutup',
  ms: 'Tutup',
  ku: 'داخستن'
};

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const TOAST_COLORS = {
  success: {
    bg: 'var(--wn-emerald-soft)',
    border: 'var(--wn-link)',
    icon: 'var(--wn-link)',
    actionBg: 'var(--wn-emerald-soft)',
    actionText: 'var(--wn-link)'
  },
  error: {
    bg: 'color-mix(in srgb, var(--wn-danger) 12%, var(--wn-surface))',
    border: 'color-mix(in srgb, var(--wn-danger) 75%, var(--wn-text-primary))',
    icon: 'color-mix(in srgb, var(--wn-danger) 50%, var(--wn-text-primary))',
    actionBg: 'color-mix(in srgb, var(--wn-danger) 12%, var(--wn-surface))',
    actionText: 'color-mix(in srgb, var(--wn-danger) 50%, var(--wn-text-primary))'
  },
  warning: {
    bg: 'color-mix(in srgb, var(--wn-warning) 12%, var(--wn-surface))',
    border: 'color-mix(in srgb, var(--wn-warning) 75%, var(--wn-text-gold))',
    icon: 'color-mix(in srgb, var(--wn-warning) 55%, var(--wn-text-primary))',
    actionBg: 'color-mix(in srgb, var(--wn-warning) 12%, var(--wn-surface))',
    actionText: 'color-mix(in srgb, var(--wn-warning) 55%, var(--wn-text-primary))'
  },
  info: {
    bg: 'var(--wn-gold-soft)',
    border: 'var(--wn-gold)',
    icon: 'color-mix(in srgb, var(--wn-text-gold) 82%, var(--wn-text-primary))',
    actionBg: 'var(--wn-gold-soft)',
    actionText: 'color-mix(in srgb, var(--wn-text-gold) 82%, var(--wn-text-primary))'
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info',
      duration: 4000,
      position: 'bottom-right',
      ...toast
    };

    setToasts(prev => [...prev, newToast]);

    if (newToast.duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        removeToast(id);
      }, newToast.duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  const success = useCallback((message, options = {}) => {
    return addToast({ type: 'success', message, ...options });
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    return addToast({ type: 'error', message, duration: 6000, ...options });
  }, [addToast]);

  const warning = useCallback((message, options = {}) => {
    return addToast({ type: 'warning', message, ...options });
  }, [addToast]);

  const info = useCallback((message, options = {}) => {
    return addToast({ type: 'info', message, ...options });
  }, [addToast]);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clearAll
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }) {
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  if (toasts.length === 0) return null;

  const edgeInset = 'clamp(12px, 2.5vw, 20px)';
  const topOffset = 'calc(20px + env(safe-area-inset-top, 0px))';
  const bottomOffset = isMobileViewport
    ? 'calc(var(--wn-mobile-bar-h, 72px) + 16px + env(safe-area-inset-bottom, 0px))'
    : 'calc(20px + env(safe-area-inset-bottom, 0px))';

  const positions = {
    'top-right': { top: topOffset, insetInlineEnd: edgeInset },
    'top-left': { top: topOffset, insetInlineStart: edgeInset },
    'bottom-right': { bottom: bottomOffset, insetInlineEnd: edgeInset },
    'bottom-left': { bottom: bottomOffset, insetInlineStart: edgeInset },
    'top-end': { top: topOffset, insetInlineEnd: edgeInset },
    'top-start': { top: topOffset, insetInlineStart: edgeInset },
    'bottom-end': { bottom: bottomOffset, insetInlineEnd: edgeInset },
    'bottom-start': { bottom: bottomOffset, insetInlineStart: edgeInset },
    'top-center': { top: topOffset, left: '50%', transform: 'translateX(-50%)' },
    'bottom-center': { bottom: bottomOffset, left: '50%', transform: 'translateX(-50%)' }
  };

  const groupedToasts = toasts.reduce((acc, toast) => {
    const pos = positions[toast.position] ? toast.position : 'bottom-right';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(toast);
    return acc;
  }, {});

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          style={{
            position: 'fixed',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: 'min(400px, calc(100vw - 24px))',
            width: '100%',
            pointerEvents: 'none',
            ...positions[position]
          }}
        >
          <AnimatePresence>
            {positionToasts.map(toast => (
              <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </>
  );
}

function ToastItem({ toast, onClose }) {
  const { locale, t, isRTL } = useI18n();
  const closeLabel = t?.common?.close || CLOSE_LABELS[locale] || (isRTL ? CLOSE_LABELS.ar : CLOSE_LABELS.en);

  const Icon = TOAST_ICONS[toast.type] || Info;
  const color = TOAST_COLORS[toast.type] || TOAST_COLORS.info;

  const pos = toast.position || 'bottom-right';
  const isCenter = pos.includes('center');
  const isStart = pos.includes('left') || pos.includes('start');
  const exitX = isCenter ? 0 : (isStart ? (isRTL ? 80 : -80) : (isRTL ? -80 : 80));
  const exitY = isCenter ? (pos.startsWith('top') ? -24 : 24) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: exitX, y: exitY, scale: 0.96 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      style={{
        background: 'var(--wn-surface)',
        borderTop: `1px solid color-mix(in srgb, ${color.border} 45%, var(--wn-border))`,
        borderBottom: `1px solid color-mix(in srgb, ${color.border} 45%, var(--wn-border))`,
        borderInlineEnd: `1px solid color-mix(in srgb, ${color.border} 45%, var(--wn-border))`,
        borderInlineStart: `4px solid ${color.border}`,
        borderRadius: 'var(--wn-radius-md)',
        padding: '14px 16px',
        boxShadow: 'var(--wn-shadow-lg)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden'
      }}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: color.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '4px'
      }}>
        <Icon size={20} aria-hidden="true" style={{ color: color.icon }} />
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: 'start', overflowWrap: 'anywhere' }}>
        {toast.title && (
          <div style={{
            fontWeight: '700',
            fontSize: '0.95rem',
            color: 'var(--wn-text-primary)',
            marginBottom: '4px'
          }}>
            {toast.title}
          </div>
        )}
        <div style={{
          fontSize: '0.88rem',
          color: 'var(--wn-text-secondary)',
          lineHeight: '1.5'
        }}>
          {toast.message}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            style={{
              marginTop: '8px',
              minHeight: '44px',
              padding: '8px 14px',
              background: color.actionBg,
              border: `1px solid ${color.border}`,
              borderRadius: 'var(--wn-radius-sm)',
              color: color.actionText,
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--wn-text-secondary)',
          cursor: 'pointer',
          padding: 0,
          minWidth: '44px',
          minHeight: '44px',
          width: '44px',
          height: '44px',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--wn-radius-sm)',
          transition: 'background-color var(--wn-dur-fast, 180ms) var(--wn-ease, ease), color var(--wn-dur-fast, 180ms) var(--wn-ease, ease)'
        }}
        aria-label={closeLabel}
      >
        <X size={18} aria-hidden="true" />
      </button>

      {toast.duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          style={{
            position: 'absolute',
            bottom: 0,
            insetInlineStart: 0,
            height: '3px',
            background: color.border
          }}
        />
      )}
    </motion.div>
  );
}
