import { useId, useRef } from 'react';
import { X, Users, UserRound, Bell, Calendar, ShieldCheck, History } from 'lucide-react';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import { useFocusTrapDialog } from './adminFormat';

function Info({ label, value, dash = '—' }) {
  return (
    <div className="wn-admin-360__info">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === '' ? dash : String(value)}</strong>
    </div>
  );
}

export default function Family360Dossier({ dossier, loading, onClose, onOpenStudent }) {
  const { locale, dir, t } = useI18n();
  const f360 = t.adminPortal.dossiers.family360;
  const dash = t.adminPortal.common.dash;
  const intlLocale = resolveIntlLocale(locale);
  const titleId = useId();
  const dialogRef = useRef(null);

  useFocusTrapDialog(Boolean(dossier), onClose, dialogRef);

  const guardian = dossier?.guardian;
  const summary = dossier?.summary || {};

  return (
    <div
      className="wn-admin-dossier-backdrop"
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div ref={dialogRef} tabIndex={-1} className="wn-admin-dossier wn-admin-people-dossier">
        <header className="wn-admin-dossier__header">
          <div>
            <span>{f360.eyebrow || 'Family 360'}</span>
            <h2 id={titleId}>{guardian?.name || f360.titleFallback}</h2>
            <p>{guardian?.email || dash} · {guardian?.phone || dash}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.adminPortal.dossiers.closeAria} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="wn-admin-dossier__loading space-y-3" role="status" aria-label={t.adminPortal.dossiers.loadingFamily}>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <div className="wn-admin-dossier__body">
            <section className="wn-admin-360-summary">
              <div><Users size={18} aria-hidden="true" /><span><strong>{summary.children || 0}</strong><small>{f360.summary.children}</small></span></div>
              <div><UserRound size={18} aria-hidden="true" /><span><strong>{summary.activeChildren || 0}</strong><small>{f360.summary.activeChildren}</small></span></div>
              <div><ShieldCheck size={18} aria-hidden="true" /><span><strong>{summary.pendingInvitations || 0}</strong><small>{f360.summary.pendingInvites}</small></span></div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><UserRound size={18} aria-hidden="true" /><h3>{f360.sections.account}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label={f360.fields.name} value={guardian?.name} dash={dash} />
                <Info label={f360.fields.email} value={guardian?.email} dash={dash} />
                <Info label={f360.fields.phone} value={guardian?.phone} dash={dash} />
                <Info label={f360.fields.accountStatus} value={guardian?.isActive === false ? f360.statuses.suspended : f360.statuses.active} dash={dash} />
                <Info label={f360.fields.emailVerified} value={guardian?.emailVerified ? f360.statuses.yes : f360.statuses.no} dash={dash} />
                <Info label={f360.fields.lastLogin} value={guardian?.lastLogin ? new Date(guardian.lastLogin).toLocaleString(intlLocale) : dash} dash={dash} />
                <Info label={f360.fields.language} value={dossier.profile?.settings?.language || guardian?.preferences?.language} dash={dash} />
                <Info label={f360.fields.timezone} value={dossier.profile?.settings?.timezone || guardian?.preferences?.timezone} dash={dash} />
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Users size={18} aria-hidden="true" /><h3>{f360.sections.children}</h3></div>
              {(dossier.children || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyChildren}</p>
              ) : (
                <div className="wn-admin-family-grid">
                  {(dossier.children || []).map((child) => (
                    <button type="button" key={child.student?._id} onClick={() => onOpenStudent?.(child.student?._id)}>
                      <span className="wn-admin-family-avatar">{child.student?.name?.slice(0, 1) || f360.childStats.avatarFallback}</span>
                      <span>
                        <strong>{child.student?.name || f360.childStats.studentFallback}</strong>
                        <small>{child.relationship} · {child.student?.currentLevel || dash}</small>
                      </span>
                      <div>
                        <span>{child.summary?.sessions || 0}<small>{f360.childStats.sessions}</small></span>
                        <span>{child.summary?.pendingHomework || 0}<small>{f360.childStats.pendingHw}</small></span>
                        <span>{child.summary?.submittedHomework || 0}<small>{f360.childStats.submittedHw}</small></span>
                      </div>
                      {child.summary?.nextSession ? (
                        <p><Calendar size={13} aria-hidden="true" /> {f360.childStats.nextSessionPrefix} {new Date(child.summary.nextSession.scheduledAt).toLocaleString(intlLocale)}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><ShieldCheck size={18} aria-hidden="true" /><h3>{f360.sections.invitations}</h3></div>
              {(dossier.invitations || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyInvitations}</p>
              ) : (
                <div className="wn-admin-360-table">
                  {(dossier.invitations || []).map((invitation) => (
                    <div key={invitation._id}>
                      <span><strong>{invitation.student?.name || f360.childStats.studentFallback}</strong><small>{invitation.relationship} · {invitation.phoneMasked || dash}</small></span>
                      <span><strong>{invitation.status}</strong><small>{invitation.source}</small></span>
                      <small>{new Date(invitation.createdAt).toLocaleString(intlLocale)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><Bell size={18} aria-hidden="true" /><h3>{f360.sections.monitoring}</h3></div>
              <div className="wn-admin-dossier__grid">
                <Info label={f360.fields.reportFrequency} value={dossier.profile?.settings?.reportFrequency} dash={dash} />
                <Info label={f360.fields.emailNotif} value={dossier.profile?.notificationPreferences?.email?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
                <Info label={f360.fields.pushNotif} value={dossier.profile?.notificationPreferences?.push?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
                <Info label={f360.fields.smsNotif} value={dossier.profile?.notificationPreferences?.sms?.enabled ? f360.statuses.enabled : f360.statuses.disabled} dash={dash} />
              </div>
            </section>

            <section className="wn-admin-dossier__section">
              <div className="wn-admin-dossier__section-title"><History size={18} aria-hidden="true" /><h3>{f360.sections.audit}</h3></div>
              {(dossier.audit || []).length === 0 ? (
                <p className="wn-admin-dossier__empty">{f360.emptyAudit}</p>
              ) : (
                <div className="wn-admin-audit-list">
                  {(dossier.audit || []).map((entry) => (
                    <div key={entry._id}>
                      <span><strong>{entry.actor?.name || f360.actorFallback}</strong><small>{new Date(entry.createdAt).toLocaleString(intlLocale)}</small></span>
                      <span><strong>{entry.action}</strong><small>{entry.reason || dash}</small></span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
