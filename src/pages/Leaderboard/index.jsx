import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Gift, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import api from '../../lib/api';
import '../../styles/public-experience.css';

function RankRow({ rank, name, score, label, highlight }) {
  return (
    <div className={'wn-rank-row ' + (highlight ? 'is-highlight' : '')}>
      <span className="wn-rank-medal">{rank <= 3 ? <Medal size={19} /> : ('#' + rank)}</span>
      <span className="wn-rank-name">{name}</span>
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
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const [timeframe, setTimeframe] = useState('all-time');
  const [points, setPoints] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/gamification/leaderboard/points/' + timeframe),
      api.get('/api/referrals/leaderboard?limit=10' + (timeframe !== 'all-time' ? '&timeframe=' + timeframe : '')),
    ])
      .then(([p, r]) => {
        setPoints((p.entries || []).map((entry) => ({
          rank: entry.rank,
          name: entry.user?.name || (isAr ? 'طالب' : 'Student'),
          score: entry.score || 0,
          highlight: entry.isCurrentUser,
        })));
        setReferrals(r.leaderboard || []);
      })
      .catch(() => {
        setPoints([]);
        setReferrals([]);
      })
      .finally(() => setLoading(false));
  }, [timeframe, isAr]);

  return (
    <>
      <SEOHead
        page={{
          url: '/leaderboard',
          title: isAr ? 'لوحة المتصدرين' : 'Leaderboard',
          description: isAr
            ? 'ترتيب النقاط والدعوات حسب البيانات المسجلة في النظام.'
            : 'Points and referral ranking based on system data.',
        }}
      />
      <GlobalHeader />
      <main className="wn-public-shell">
        <section className="wn-public-hero">
          <div className="page-container wn-public-hero__inner">
            <div>
              <span className="wn-auth-visual__eyebrow">
                <Sparkles size={14} />
                {isAr ? 'التقدم والمشاركة' : 'PROGRESS & PARTICIPATION'}
              </span>
              <h1>{isAr ? 'لوحة المتصدرين' : 'Leaderboard'}</h1>
              <p>
                {isAr
                  ? 'تعرض الصفحة بيانات النقاط والدعوات المسجلة فعليًا عند توفرها.'
                  : 'The page shows recorded points and referral data when available.'}
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
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              ['all-time', isAr ? 'الكل' : 'All time'],
              ['monthly', isAr ? 'هذا الشهر' : 'Monthly'],
              ['weekly', isAr ? 'هذا الأسبوع' : 'Weekly'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (timeframe !== id) {
                    setLoading(true);
                    setTimeframe(id);
                  }
                }}
                className={timeframe === id ? 'wn-btn wn-btn--primary wn-btn--sm' : 'wn-btn wn-btn--secondary wn-btn--sm'}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid lg:grid-cols-2 gap-4" role="status" aria-live="polite">
              <span className="sr-only">{isAr ? 'جاري تحميل لوحة المتصدرين...' : 'Loading leaderboard...'}</span>
              <section className="wn-utility-card">
                <Skeleton className="h-6 w-32" />
                <RankListSkeleton />
              </section>
              <section className="wn-utility-card">
                <Skeleton className="h-6 w-32" />
                <RankListSkeleton />
              </section>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="wn-utility-card">
                <h2 className="font-[var(--wn-font-display)] text-xl text-[var(--wn-emerald-deep)] flex items-center gap-2">
                  <Trophy size={20} />
                  {isAr ? 'النقاط' : 'Points'}
                </h2>
                <div className="wn-rank-list mt-4">
                  {points.length ? (
                    points.map((row) => <RankRow key={row.rank} {...row} label={isAr ? 'نقطة' : 'pts'} />)
                  ) : (
                    <p className="text-center py-8 text-sm text-[var(--wn-text-secondary)]">
                      {isAr ? 'لا توجد بيانات نقاط بعد' : 'No points data yet'}
                    </p>
                  )}
                </div>
              </section>

              <section className="wn-utility-card">
                <h2 className="font-[var(--wn-font-display)] text-xl text-[var(--wn-emerald-deep)] flex items-center gap-2">
                  <Gift size={20} />
                  {isAr ? 'الدعوات' : 'Referrals'}
                </h2>
                <div className="wn-rank-list mt-4">
                  {referrals.length ? (
                    referrals.map((r) => (
                      <RankRow key={r.rank} rank={r.rank} name={r.name} score={r.invites} label={isAr ? 'دعوة' : 'invites'} />
                    ))
                  ) : (
                    <p className="text-center py-8 text-sm text-[var(--wn-text-secondary)]">
                      {isAr ? 'لا توجد دعوات بعد' : 'No referral data yet'}
                    </p>
                  )}
                </div>
                <Link
                  to={localizedPath('/student/dashboard', locale)}
                  className="block mt-4 text-center text-xs font-bold text-[var(--wn-emerald-dark)]"
                >
                  {isAr ? 'افتح لوحة الطالب' : 'Open student dashboard'}
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
