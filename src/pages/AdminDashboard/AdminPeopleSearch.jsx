import { useState } from 'react';
import { Search, UserRound, Users, GraduationCap, Calendar, CreditCard, X } from 'lucide-react';
import api from '../../lib/api';
import { useI18n } from '../../i18n';
import { formatSessionDateTime, sessionTimeZone } from '../../lib/sessionTime';
import { formatMsg } from './adminFormat';

function personIcon(role) {
  if (role === 'student') return UserRound;
  if (role === 'guardian') return Users;
  return GraduationCap;
}

export default function AdminPeopleSearch({
  onOpenStudent,
  onOpenGuardian,
  onOpenTeacher,
  onOpenPayments,
}) {
  const { locale, t } = useI18n();
  const ps = t.adminPortal.people.search;
  const dash = t.adminPortal.common.dash;
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ people: [], sessions: [], payments: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const search = async (event) => {
    event?.preventDefault();
    const value = query.trim();
    if (value.length < 2 || loading) return;

    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/admin/people/search?q=' + encodeURIComponent(value), { auth: true });
      setResult(data || { people: [], sessions: [], payments: [] });
      setSearched(true);
    } catch (searchError) {
      setError(searchError.message || ps.searchError);
      setResult({ people: [], sessions: [], payments: [] });
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const openPerson = (person) => {
    if (person.role === 'student') onOpenStudent?.(person._id);
    if (person.role === 'guardian') onOpenGuardian?.(person._id);
    if (person.role === 'teacher' && person.teacherProfileId) onOpenTeacher?.(person.teacherProfileId);
  };

  const total = (result.people?.length || 0) + (result.sessions?.length || 0) + (result.payments?.length || 0);

  return (
    <section className="wn-admin-global-search">
      <form onSubmit={search} className="wn-admin-global-search__bar">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ps.placeholder}
          aria-label={ps.aria}
        />
        {query ? (
          <button
            type="button"
            className="wn-admin-global-search__clear min-h-[44px] min-w-[44px]"
            onClick={() => {
              setQuery('');
              setSearched(false);
              setError('');
              setResult({ people: [], sessions: [], payments: [] });
            }}
            aria-label={ps.clearAria}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
        <button type="submit" disabled={loading || query.trim().length < 2} className="min-h-[44px]">
          {loading ? ps.searching : ps.submit}
        </button>
      </form>

      {searched && (
        <div className="wn-admin-global-search__results">
          <div className="wn-admin-global-search__results-head">
            <strong>{total ? formatMsg(ps.resultsCount, { count: total }) : ps.noResults}</strong>
            {error ? (
              <div role="alert" className="flex items-center gap-2">
                <span>{error}</span>
                <button type="button" onClick={() => search()} className="wn-btn wn-btn--secondary min-h-[44px]">
                  {t.adminPortal.common.retry}
                </button>
              </div>
            ) : null}
          </div>

          {(result.people || []).length > 0 && (
            <div className="wn-admin-global-search__group">
              <span>{ps.groups.people}</span>
              {(result.people || []).map((person) => {
                const Icon = personIcon(person.role);
                return (
                  <button type="button" key={person._id} onClick={() => openPerson(person)}>
                    <span><Icon size={17} aria-hidden="true" /></span>
                    <span>
                      <strong>{person.name || ps.noName}</strong>
                      <small>{ps.roles[person.role] || person.role} · {person.email || person.phone || dash}</small>
                    </span>
                    <small>{person.isActive === false ? ps.statusSuspended : ps.statusActive}</small>
                  </button>
                );
              })}
            </div>
          )}

          {(result.sessions || []).length > 0 && (
            <div className="wn-admin-global-search__group">
              <span>{ps.groups.sessions}</span>
              {(result.sessions || []).map((session) => (
                <div key={session._id} className="wn-admin-global-search__record">
                  <span><Calendar size={17} aria-hidden="true" /></span>
                  <span>
                    <strong>
                      {formatMsg(ps.sessionWith, {
                        student: session.student?.name || ps.studentFallback,
                        teacher: session.teacher?.user?.name || session.teacher?.personalInfo?.fullName || ps.teacherFallback,
                      })}
                    </strong>
                    <small>{formatSessionDateTime(session, locale, { dateStyle: 'medium', timeStyle: 'short' })} · {sessionTimeZone(session)} · {session.status}</small>
                  </span>
                  <code>{session._id}</code>
                </div>
              ))}
            </div>
          )}

          {(result.payments || []).length > 0 && (
            <div className="wn-admin-global-search__group">
              <span>{ps.groups.payments}</span>
              {(result.payments || []).map((payment) => (
                <button type="button" key={payment._id} onClick={() => onOpenPayments?.(payment)}>
                  <span><CreditCard size={17} aria-hidden="true" /></span>
                  <span>
                    <strong>{payment.student?.name || ps.paymentFallback} · {payment.status}</strong>
                    <small>{payment.currency} · {payment.provider}</small>
                  </span>
                  <code>{payment._id}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
