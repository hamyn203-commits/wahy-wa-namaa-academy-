import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Gift, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import EmptyState from '../../components/shared/EmptyState';
import api from '../../lib/api';
import '../../styles/public-experience.css';

function RankRow({ rank, name, score, label, highlight }) {
  return (
    <div className={'wn-rank-row ' + (highlight ? 'is-highlight' : '')}>
      <span className="wn-rank-medal">{rank <= 3 ? <Medal size={19} aria-hidden="true" /> : ('#' + rank)}</span>
      <span className="wn-rank-name min-w-0 truncate">{name}</span>
      <span className="wn-rank-score">{score} <small>{label}</small></span>
    </div>
  );
}

function RankListSkeleton() {
  return (
    <div className="wn-rank-list mt-4" aria-hidden="true">
      {Array.from({ length: 5 }, (_, idx) => (
        <div key={idx} className="wn-rank-row">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const { locale, t, dir } = useI18n();
  const { isAuthenticated } = useAuth();
  const [timeframe, setTimeframe] = useState('all-time');
  const [points, setPoints] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const studentFallback = t.lms?.leaderboard?.studentFallback || 'Student';
  const loadErrorFallback = t.lms?.leaderboard?.loadError || 'Unable to load leaderboard';

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [p, r] = await Promise.all([
        api.get('/api/gamification/leaderboard/points/' + timeframe, { auth: Boolean(isAuthenticated) }),
        api.get('/api/referrals/leaderboard?limit=10' + (timeframe !== 'all-time' ? '&timeframe=' + timeframe : '')),
      ]);
      setPoints((p.entries || []).map((entry) => ({
        rank: entry.rank,
        name: entry.user?.name || studentFallback,
        score: entry.score || 0,
        highlight: Boolean(entry.isCurrentUser),
      })));
      setReferrals(r.leaderboard || []);
    } catch (err) {
      setPoints([]);
      setReferrals([]);
      setLoadError(err?.message || loadErrorFallback);
    } finally {
      setLoading(false);
    }
  }, [timeframe, isAuthenticated, studentFallback, loadErrorFallback]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const timeframes = [
    ['all-time', t.lms?.leaderboard?.allTime || 'All Time'],
    ['monthly', t.lms?.leaderboard?.monthly || 'This Month'],
    ['weekly', t.lms?.leaderboard?.weekly || 'This Week'],
  ];

  return (
    <>
      <SEOHead
        page={{
          url: '/leaderboard',
          title: t.lms?.leaderboard?.title || 'Leaderboard',
          description: t.lms?.leaderboard?.seoDescription || 'Points and referral ranking based on system data.',
        }}
      />
      <GlobalHeader />
      <main className="wn-public-shell" dir={dir}>
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} aria-hidden="true" />
                {t.lms?.leaderboard?.eyebrow || 'PROGRESS & PARTICIPATION'}
              </span>
              <h1>{t.lms?.leaderboard?.title || 'Leaderboard'}</h1>
              <p>
                {t.lms?.leaderboard?.subtitle || 'Displays recorded points and referral rankings when available.'}
              </p>
            </div>
            <div className="wn-public-hero__art" aria-hidden="true">
              <div className="wn-public-orbit" />
              <div className="wn-public-orbit__core">
                <Trophy size={46} strokeWidth={1.25} />
              </div>
            </div>
          </div>
        </section>

        <section className="wn-utility-wrap">
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label={t.lms?.leaderboard?.title || 'Leaderboard'}>
            {timeframes.map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={timeframe === id}
                onClick={() => {
                  if (timeframe !== id) {
                    setTimeframe(id);
                  }
                }}
                className={(timeframe === id ? 'wn-btn wn-btn--primary wn-btn--sm' : 'wn-btn wn-btn--secondary wn-btn--sm') + ' min-h-[44px]'}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid lg:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{t.lms?.leaderboard?.loading || 'Loading leaderboard…'}</span>
              <section className="wn-utility-card">
                <Skeleton className="h-6 w-32" />
                <RankListSkeleton />
              </section>
              <section className="wn-utility-card">
                <Skeleton className="h-6 w-32" />
                <RankListSkeleton />
              </section>
            </div>
          ) : loadError ? (
            <section className="wn-utility-card text-center py-8" role="alert">
              <EmptyState
                icon={AlertCircle}
                title={t.lms?.leaderboard?.loadError || 'Unable to load leaderboard'}
                description={loadError !== loadErrorFallback ? loadError : undefined}
                action={(
                  <button type="button" onClick={loadLeaderboard} className="wn-btn wn-btn--primary min-h-[44px]">
                    <RefreshCw size={15} aria-hidden="true" />
                    <span>{t.lms?.leaderboard?.retry || t.common?.retry || 'Try again'}</span>
                  </button>
                )}
              />
            </section>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="wn-utility-card">
                <h2 className="font-[var(--wn-font-display)] text-xl text-[var(--wn-heading)] flex items-center gap-2">
                  <Trophy size={20} aria-hidden="true" />
                  {t.lms?.leaderboard?.points || 'Points'}
                </h2>
                <div className="wn-rank-list mt-4">
                  {points.length ? (
                    points.map((row) => (
                      <RankRow
                        key={`${row.rank}-${row.name}`}
                        {...row}
                        label={t.lms?.leaderboard?.ptsUnit || 'pts'}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={Trophy}
                      title={t.lms?.leaderboard?.empty || 'No points recorded yet'}
                    />
                  )}
                </div>
              </section>

              <section className="wn-utility-card">
                <h2 className="font-[var(--wn-font-display)] text-xl text-[var(--wn-heading)] flex items-center gap-2">
                  <Gift size={20} aria-hidden="true" />
                  {t.lms?.leaderboard?.referrals || 'Referrals'}
                </h2>
                <div className="wn-rank-list mt-4">
                  {referrals.length ? (
                    referrals.map((r) => (
                      <RankRow
                        key={`${r.rank}-${r.name || 'ref'}`}
                        rank={r.rank}
                        name={r.name || studentFallback}
                        score={r.invites}
                        label={t.lms?.leaderboard?.invitesUnit || 'invites'}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={Gift}
                      title={t.lms?.leaderboard?.noReferrals || 'No referral data yet'}
                    />
                  )}
                </div>
                <Link
                  to={localizedPath('/student/dashboard', locale)}
                  className="wn-btn wn-btn--ghost w-full mt-4 min-h-[44px] text-xs font-bold"
                >
                  {t.lms?.leaderboard?.backDashboard || 'Back to Dashboard'}
                </Link>
              </section>
            </div>
          )}
        </section>
      </main>
      <GlobalFooter />
    </>
  );
}
