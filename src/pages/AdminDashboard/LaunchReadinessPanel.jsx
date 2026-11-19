import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, Globe2, Mail, RefreshCw, Video, Wallet, MessageCircleMore,
} from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import { apiUrl } from '../../config';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { formatMsg } from './adminFormat';

const FEATURE_META = {
  email: { key: 'email', icon: Mail },
  'manual-payment': { key: 'manualPayment', icon: Wallet },
  livekit: { key: 'livekit', icon: Video },
  whatsapp: { key: 'whatsapp', icon: MessageCircleMore },
};

function StatusPill({ ok, yes, no }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
      ok
        ? 'bg-[var(--wn-status-success-bg)] text-[var(--wn-status-success-text)]'
        : 'bg-[var(--wn-status-warn-bg)] text-[var(--wn-status-warn-text)]'
    }`}>
      {ok ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
      {ok ? yes : no}
    </span>
  );
}

export default function LaunchReadinessPanel() {
  const { locale, t } = useI18n();
  const lp = t.adminPortal.system.launchPanel;
  const intlLocale = resolveIntlLocale(locale);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/launch-readiness'), {
        credentials: 'include',
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        throw new Error(body?.error || lp.loadError);
      }
      setData(body);
      setLastCheckedAt(new Date());
    } catch (err) {
      setError(err?.message || lp.loadError);
    } finally {
      setLoading(false);
    }
  }, [lp.loadError]);

  useEffect(() => {
    load();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60000);

    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const blockersByFeature = useMemo(() => {
    const map = new Map();
    for (const blocker of data?.blockers || []) {
      const key = blocker.feature || 'platform';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(blocker.code);
    }
    return map;
  }, [data]);

  if (!data && loading) {
    return (
      <section className="wn-dashboard-surface mb-6 space-y-3" role="status" aria-label={lp.loading}>
        <Skeleton className="h-6 w-56" />
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!data && error) {
    return (
      <section className="wn-dashboard-surface mb-6 border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] flex flex-wrap items-center justify-between gap-3 p-5" role="alert">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} aria-hidden="true" />
          <span className="font-semibold text-sm">{error}</span>
        </div>
        <button type="button" onClick={load} className="wn-btn wn-btn--secondary min-h-[44px]">
          {t.adminPortal.common.retry}
        </button>
      </section>
    );
  }

  if (!data) return null;

  const platformBlockers = blockersByFeature.get('platform') || [];
  const allReady = data.ready === true;

  return (
    <section className="wn-dashboard-surface mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 size={19} className={allReady ? 'text-[var(--wn-emerald)]' : 'text-[var(--wn-warning)]'} aria-hidden="true" />
            <h3 className="font-black text-[var(--wn-heading)]">{lp.title}</h3>
            <StatusPill ok={allReady} yes={lp.statusGo} no={lp.statusNoGo} />
          </div>
          <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{lp.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-bold text-[var(--wn-heading)] hover:bg-[var(--wn-surface-soft)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          {lp.checkNow}
        </button>
      </div>

      {error ? (
        <div role="alert" className="mb-4 rounded-xl border border-[var(--wn-status-danger-border)] bg-[var(--wn-status-danger-bg)] text-[var(--wn-status-danger-text)] px-4 py-2 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={load} className="underline min-h-[44px]">{t.adminPortal.common.retry}</button>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {(data.requiredFeatures || []).map((featureName) => {
          const feature = data.features?.[featureName] || {};
          const meta = FEATURE_META[featureName] || { key: featureName, icon: CheckCircle2 };
          const Icon = meta.icon;
          const label = lp.features?.[meta.key] || featureName;
          const blockers = blockersByFeature.get(featureName) || [];
          const configured = feature.configured === true;
          const e2eVerified = feature.e2eVerified === true;
          const domainVerified = featureName === 'email' ? feature.domainVerified === true : null;

          return (
            <div key={featureName} className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={17} className="text-[var(--wn-text-secondary)]" aria-hidden="true" />
                  <strong className="text-sm text-[var(--wn-heading)]">{label}</strong>
                </div>
                <StatusPill ok={blockers.length === 0} yes={lp.ready} no={lp.notReady} />
              </div>

              <div className="space-y-1.5 text-xs text-[var(--wn-text-secondary)]">
                <div className="flex justify-between gap-2">
                  <span>{lp.setup}</span>
                  <strong className={configured ? 'text-[var(--wn-status-success-text)]' : 'text-[var(--wn-status-warn-text)]'}>
                    {configured ? lp.complete : lp.missing}
                  </strong>
                </div>

                {featureName === 'email' && (
                  <div className="flex justify-between gap-2">
                    <span>{lp.domainVerified}</span>
                    <strong className={domainVerified ? 'text-[var(--wn-status-success-text)]' : 'text-[var(--wn-status-warn-text)]'}>
                      {domainVerified ? lp.verified : lp.unverified}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  <span>{lp.e2eTest}</span>
                  <strong className={e2eVerified ? 'text-[var(--wn-status-success-text)]' : 'text-[var(--wn-status-warn-text)]'}>
                    {e2eVerified ? lp.passed : lp.required}
                  </strong>
                </div>
              </div>

              {blockers.length > 0 && (
                <div className="mt-3 border-t border-[var(--wn-border)] pt-2 space-y-1">
                  {blockers.map((code) => (
                    <p key={code} className="text-[11px] text-[var(--wn-status-warn-text)]">
                      • {lp.blockers?.[code] || code}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[var(--wn-heading)] flex items-center gap-1.5">
            <span>{lp.officialDomain}:</span>
            {data.customDomainConfigured ? (
              <span className="inline-flex items-center gap-1 text-[var(--wn-status-success-text)]">
                {lp.connected} <Check size={14} aria-hidden="true" />
              </span>
            ) : (
              <span className="text-[var(--wn-status-warn-text)]">{lp.disconnected}</span>
            )}
          </p>
          {platformBlockers.map((code) => (
            <p key={code} className="text-xs text-[var(--wn-status-warn-text)] mt-1">
              {lp.blockers?.[code] || code}
            </p>
          ))}
        </div>
        {lastCheckedAt && (
          <span className="text-[11px] text-[var(--wn-text-tertiary)]">
            {formatMsg(lp.lastChecked, { time: lastCheckedAt.toLocaleTimeString(intlLocale) })}
          </span>
        )}
      </div>
    </section>
  );
}
