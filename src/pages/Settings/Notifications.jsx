import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BellRing, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import Skeleton from '../../components/shared/Skeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastProvider';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import { enableWebPush, isPushSupported } from '../../lib/webPush';
import '../../styles/public-experience.css';

export default function NotificationSettings() {
  const { isAuthenticated, user } = useAuth();
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  const s = t?.student?.settings || {};
  const common = t?.common || {};
  const isAdmin = user?.role === 'admin';

  const [prefs, setPrefs] = useState({ email: true, push: true, telegram: true, sms: false });
  const [telegramId, setTelegramId] = useState('');
  const [bindingToken, setBindingToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramErrors, setTelegramErrors] = useState({ chatId: '', bindingToken: '', form: '' });
  const [saved, setSaved] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.get('/api/notifications/preferences', { auth: true });
      if (data?.preferences) {
        setPrefs(data.preferences);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localizedPath('/login', locale) + '?redirect=/settings/notifications');
      return;
    }
    loadPreferences();
  }, [isAuthenticated, navigate, locale, loadPreferences]);

  const savePrefs = async () => {
    if (savingPrefs) return;
    setSavingPrefs(true);
    try {
      await api.put('/api/notifications/preferences', { preferences: prefs }, { auth: true });
      setSaved(true);
      toast.success(s.savedPrefs || 'Preferences saved');
      window.setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      toast.error(err?.message || s.saveFailed || 'Unable to save notification preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const registerTelegram = async (event) => {
    event?.preventDefault?.();
    if (savingTelegram) return;
    const cleanId = telegramId.trim();
    const cleanToken = bindingToken.trim();
    const nextErrors = { chatId: '', bindingToken: '', form: '' };

    if (!/^-?\d{5,20}$/.test(cleanId)) {
      nextErrors.chatId = s.chatIdRequired || 'Please enter a valid Telegram Chat ID.';
    }
    if (!isAdmin && !cleanToken) {
      nextErrors.bindingToken = s.bindingTokenRequired || 'Please enter the binding token issued by the official Academy Telegram bot.';
    }

    if (nextErrors.chatId || nextErrors.bindingToken) {
      setTelegramErrors(nextErrors);
      return;
    }

    setTelegramErrors({ chatId: '', bindingToken: '', form: '' });
    setSavingTelegram(true);
    try {
      await api.post(
        '/api/notifications/telegram-id',
        {
          telegramId: cleanId,
          ...(cleanToken ? { bindingToken: cleanToken } : {}),
        },
        { auth: true }
      );
      toast.success(s.connectedTelegram || 'Telegram connected successfully');
      setBindingToken('');
    } catch (err) {
      const msg = err?.message || s.telegramFailed || 'Unable to connect Telegram.';
      setTelegramErrors({ chatId: '', bindingToken: '', form: msg });
      toast.error(msg);
    } finally {
      setSavingTelegram(false);
    }
  };

  const registerPush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      await enableWebPush();
      setPushEnabled(true);
      setPrefs((p) => ({ ...p, push: true }));
      toast.success(s.enabledWebPush || 'Enabled');
    } catch (err) {
      toast.error(err?.message || s.pushFailed || 'Unable to enable web push notifications.');
    } finally {
      setPushLoading(false);
    }
  };

  const channels = [
    ['email', s.emailLabel || 'Email'],
    ['push', s.pushLabel || 'Browser push'],
    ['telegram', s.telegramLabel || 'Telegram'],
    ['sms', s.smsLabel || 'WhatsApp / SMS'],
  ];

  return (
    <div dir={dir} className="wn-public-shell min-h-screen">
      <GlobalHeader />
      <section className="wn-public-hero">
        <div className="page-container wn-public-hero__inner">
          <div>
            <span className="wn-auth-visual__eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              {s.eyebrow || 'COMMUNICATION PREFERENCES'}
            </span>
            <h1>{s.title || 'Notification Settings'}</h1>
            <p>{s.subtitle || 'Choose the notification channels you want to use when available for your account.'}</p>
          </div>
          <div className="wn-public-hero__art" aria-hidden="true">
            <div className="wn-public-orbit" />
            <div className="wn-public-orbit__core">
              <BellRing size={46} strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      <main className="wn-utility-wrap max-w-2xl">
        {loading ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">{common.loading || 'Loading…'}</span>
            <div className="wn-utility-card space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <div className="wn-utility-card space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {loadError && (
              <div
                role="alert"
                className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] p-4 text-sm text-[var(--wn-text-danger)]"
              >
                <span className="font-semibold">{s.loadError || 'Unable to load notification settings.'}</span>
                <button
                  type="button"
                  onClick={loadPreferences}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] px-4 py-2 text-xs font-bold text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {common.retry || 'Try again'}
                </button>
              </div>
            )}

            <section className="wn-utility-card">
              {channels.map(([key, label]) => (
                <label key={key} htmlFor={`pref-${key}`} className="wn-setting-row cursor-pointer">
                  <span className="text-sm font-semibold text-[var(--wn-text-primary)]">{label}</span>
                  <input
                    id={`pref-${key}`}
                    type="checkbox"
                    checked={!!prefs[key]}
                    disabled={savingPrefs}
                    onChange={(e) => setPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-5 w-5 accent-[var(--wn-emerald)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-50"
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={savePrefs}
                disabled={savingPrefs}
                className="wn-btn wn-btn--primary wn-btn--block mt-4 min-h-[44px] inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {savingPrefs && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                <span>
                  {savingPrefs
                    ? (common.saving || 'Saving…')
                    : saved
                      ? (s.savedPrefs || 'Preferences Saved')
                      : (s.savePrefs || 'Save Preferences')}
                </span>
              </button>
            </section>

            <section className="wn-utility-card mt-4">
              <h2 className="font-[var(--wn-font-display)] text-lg text-[var(--wn-heading)]">
                {s.telegramTitle || 'Connect Telegram'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--wn-text-secondary)]">
                {s.telegramHelp || 'Open the official Academy Telegram bot to get your Chat ID and binding token.'}
              </p>

              <form onSubmit={registerTelegram} className="mt-3 space-y-3" noValidate>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <label htmlFor="telegram-chat-id" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                      {s.telegramIdLabel || 'Chat ID'}
                    </label>
                    <input
                      id="telegram-chat-id"
                      type="text"
                      inputMode="numeric"
                      value={telegramId}
                      disabled={savingTelegram}
                      onChange={(e) => {
                        setTelegramId(e.target.value);
                        if (telegramErrors.chatId) setTelegramErrors((prev) => ({ ...prev, chatId: '' }));
                      }}
                      placeholder={s.telegramIdPlaceholder || 'Chat ID'}
                      aria-invalid={Boolean(telegramErrors.chatId)}
                      aria-describedby={telegramErrors.chatId ? 'telegram-chat-id-error' : undefined}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 text-sm text-[var(--wn-text-primary)] placeholder:text-[var(--wn-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55"
                    />
                    {telegramErrors.chatId && (
                      <p id="telegram-chat-id-error" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">
                        {telegramErrors.chatId}
                      </p>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <label htmlFor="telegram-binding-token" className="block text-xs font-bold text-[var(--wn-text-secondary)] mb-1">
                      {s.bindingTokenLabel || 'Binding Token'}
                    </label>
                    <input
                      id="telegram-binding-token"
                      type="text"
                      value={bindingToken}
                      disabled={savingTelegram}
                      required={!isAdmin}
                      onChange={(e) => {
                        setBindingToken(e.target.value);
                        if (telegramErrors.bindingToken) setTelegramErrors((prev) => ({ ...prev, bindingToken: '' }));
                      }}
                      placeholder={s.bindingTokenPlaceholder || 'Enter binding token from Telegram bot'}
                      aria-invalid={Boolean(telegramErrors.bindingToken)}
                      aria-describedby={telegramErrors.bindingToken ? 'telegram-binding-token-error' : undefined}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 text-sm text-[var(--wn-text-primary)] placeholder:text-[var(--wn-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55"
                    />
                    {telegramErrors.bindingToken && (
                      <p id="telegram-binding-token-error" role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">
                        {telegramErrors.bindingToken}
                      </p>
                    )}
                  </div>
                </div>

                {telegramErrors.form && (
                  <p role="alert" className="rounded-xl border border-[var(--wn-danger)] bg-[var(--wn-danger-soft)] px-3 py-2 text-xs font-semibold text-[var(--wn-text-danger)]">
                    {telegramErrors.form}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingTelegram}
                  className="wn-btn wn-btn--secondary min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {savingTelegram && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  <span>{savingTelegram ? (common.saving || 'Saving…') : (s.connectBtn || 'Connect')}</span>
                </button>
              </form>
            </section>

            <section className="wn-utility-card mt-4">
              <h2 className="font-[var(--wn-font-display)] text-lg text-[var(--wn-heading)]">
                {s.webAppTitle || 'Web app notifications'}
              </h2>
              {!isPushSupported() ? (
                <p className="text-sm text-[var(--wn-text-secondary)] mt-2">
                  {s.webAppUnsupported || 'This browser does not support web push.'}{' '}
                  <Link
                    to={localizedPath('/app', locale)}
                    className="inline-flex min-h-[44px] items-center font-bold text-[var(--wn-link)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] rounded"
                  >
                    {s.appPageLink || 'App page'}
                  </Link>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={registerPush}
                  disabled={pushLoading}
                  className="wn-btn wn-btn--primary mt-3 min-h-[44px] inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {pushLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  <span>
                    {pushLoading
                      ? (s.enablingWebPush || 'Enabling…')
                      : pushEnabled
                        ? (s.enabledWebPush || 'Enabled')
                        : (s.enableWebPush || 'Enable web push')}
                  </span>
                </button>
              )}
            </section>
          </>
        )}
      </main>
      <GlobalFooter />
    </div>
  );
}

