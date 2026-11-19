import { useId, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import SEOHead from '../../components/SEOHead';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';

export default function SetupAdmin() {
  const navigate = useNavigate();
  const { locale, dir, t } = useI18n();
  const sa = t.setupAdmin;
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (String(form.password || '').length < 12) {
      setError(sa.passwordMinLengthError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/setup/ensure-admin', form);
      if (res?.message || res) setDone(true);
    } catch (err) {
      setError(err.message || sa.submitFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--wn-bg)] p-4 text-[var(--wn-text-primary)]" dir={dir}>
      <SEOHead page={{ title: sa.seoTitle, description: sa.seoDesc, noindex: true, canonical: false }} />
      <div className="bg-[var(--wn-surface)] border border-[var(--wn-border)] rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Logo size={60} showText={false} />
          <h1 className="text-xl font-bold mt-4 text-[var(--wn-heading)]">{sa.title}</h1>
          <p className="text-sm text-[var(--wn-text-secondary)] mt-1">{sa.subtitle}</p>
        </div>
        {done ? (
          <div className="text-center space-y-4">
            <p className="text-[var(--wn-emerald)] font-semibold inline-flex items-center justify-center gap-2">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{sa.doneTitle}</span>
            </p>
            <p className="text-sm text-[var(--wn-text-secondary)]">{sa.doneDesc}</p>
            <button
              type="button"
              onClick={() => navigate(localizedPath('/login', locale))}
              className="w-full min-h-[44px] py-2.5 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-semibold rounded-lg transition"
            >
              {sa.loginBtn}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <p id={errorId} role="alert" className="text-[var(--wn-text-danger)] text-sm bg-[var(--wn-danger-soft)] border border-[var(--wn-status-danger-border)] p-3 rounded-lg">
                {error}
              </p>
            )}
            <div>
              <label htmlFor={nameId} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                {sa.nameLabel}
              </label>
              <input
                id={nameId}
                required
                placeholder={sa.namePlaceholder}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor={emailId} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                {sa.emailLabel}
              </label>
              <input
                id={emailId}
                required
                type="email"
                placeholder={sa.emailPlaceholder}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="block text-xs font-semibold text-[var(--wn-text-secondary)] mb-1">
                {sa.passwordLabel}
              </label>
              <input
                id={passwordId}
                required
                type="password"
                minLength={12}
                placeholder={sa.passwordPlaceholder}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-text-inverse)] font-semibold rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {loading ? sa.submitting : sa.submitBtn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
