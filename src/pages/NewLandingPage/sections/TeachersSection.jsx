import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  GraduationCap,
  Star,
  Award,
  BookOpenCheck,
  HeartHandshake,
  ArrowLeft,
  ArrowRight,
  UserRoundCheck,
  CirclePlay,
  Volume2,
  Users,
  RotateCcw,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import TeacherAvatar from '../../../components/shared/TeacherAvatar';
import { prefetchTeacherBundle } from '../../../lib/teacherProfileCache';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { teacherPublicVideo } from '../../../lib/teacherMedia';
import { TEACHERS_COPY, handleRovingKeyDown, pickLocale } from '../landingI18nPart2';

const PRINCIPLE_ICONS = [BookOpenCheck, HeartHandshake, GraduationCap];
const FILTER_KEYS = ['all', 'male', 'female'];

function resolveTeacherGender(teacher) {
  const raw = String(
    teacher?.personalInfo?.gender
    || teacher?.user?.gender
    || teacher?.gender
    || '',
  ).toLowerCase();
  if (raw === 'female' || raw === 'women') return 'female';
  if (raw === 'male' || raw === 'men') return 'male';
  const specs = teacher?.quranInfo?.specializations || [];
  if (Array.isArray(specs) && specs.includes('women')) return 'female';
  return 'unknown';
}

const TeacherCard = memo(function TeacherCard({ teacher, locale, isRTL, copy }) {
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const id = teacher?._id || teacher?.id;
  const name = teacher?.user?.name || teacher?.personalInfo?.fullName || copy.approvedScholar;
  const photo = teacher?.media?.profilePhoto;
  const rating = Number(teacher?.rating?.average || 0);
  const experience = teacher?.quranInfo?.teachingExperience;
  const specialties = (teacher?.quranInfo?.specializations || []).slice(0, 3);
  const hasIntroVideo = Boolean(teacherPublicVideo(teacher?.media?.introductionVideo));
  const hasAudioSample = Boolean(
    teacher?.media?.recitationAudio && teacher.media.recitationAudio !== 'not-provided',
  );

  return (
    <article
      className="wn-faculty-card"
      onMouseEnter={() => id && prefetchTeacherBundle(id)}
      onFocus={() => id && prefetchTeacherBundle(id)}
    >
      <div className="wn-faculty-card__media">
        <TeacherAvatar
          src={photo}
          name={name}
          alt={name}
          size="xl"
          className="h-full w-full"
        />
        <span className="wn-badge wn-badge--gold wn-faculty-card__badge">
          <UserRoundCheck size={13} aria-hidden="true" />
          {copy.approvedProfile}
        </span>

        {(hasIntroVideo || hasAudioSample) && (
          <div className="wn-faculty-card__media-pills">
            {hasIntroVideo && (
              <span>
                <CirclePlay size={12} aria-hidden="true" />
                {copy.introVideo}
              </span>
            )}
            {hasAudioSample && (
              <span>
                <Volume2 size={12} aria-hidden="true" />
                {copy.audioSample}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="wn-faculty-card__body">
        <h3>{name}</h3>

        <div className="wn-faculty-card__meta">
          {rating > 0 && (
            <span>
              <Star size={14} fill="currentColor" aria-hidden="true" />
              {rating.toFixed(1)}
            </span>
          )}
          {experience ? (
            <span>
              <Award size={14} aria-hidden="true" />
              {experience} {copy.yearsExp}
            </span>
          ) : null}
        </div>

        {specialties.length > 0 && (
          <div className="wn-faculty-card__tags">
            {specialties.map((specialty) => (
              <span key={specialty}>
                {copy.specialties[specialty] || specialty}
              </span>
            ))}
          </div>
        )}

        {id ? (
          <LocalizedLink
            to={'/teachers/' + id}
            locale={locale}
            onMouseEnter={() => prefetchTeacherBundle(id)}
            className="wn-faculty-card__link"
          >
            <span>{copy.viewProfile}</span>
            <ArrowIcon size={15} aria-hidden="true" />
          </LocalizedLink>
        ) : null}
      </div>
    </article>
  );
});

export default function TeachersSection() {
  const { locale, isRTL, t } = useI18n();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const copy = pickLocale(TEACHERS_COPY, locale, isRTL);
  const [teachers, setTeachers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [retryCount, setRetryCount] = useState(0);

  const reloadTeachers = useCallback(() => {
    setStatus('loading');
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadTeachers() {
      try {
        const response = await fetch('/api/teachers?limit=6&sortBy=rating&sortOrder=desc');
        if (!response.ok) throw new Error('teachers-unavailable');
        const payload = await response.json();
        if (!active) return;
        setTeachers(Array.isArray(payload?.teachers) ? payload.teachers.slice(0, 6) : []);
        setStatus('ready');
      } catch {
        if (!active) return;
        setTeachers([]);
        setStatus('error');
      }
    }

    loadTeachers();
    return () => { active = false; };
  }, [retryCount]);

  const filteredTeachers = useMemo(() => {
    if (divisionFilter === 'all') return teachers.slice(0, 3);
    return teachers
      .filter((teacher) => resolveTeacherGender(teacher) === divisionFilter)
      .slice(0, 3);
  }, [teachers, divisionFilter]);

  const selectionPrinciples = useMemo(() => (
    copy.principles.map((item, idx) => ({
      ...item,
      icon: PRINCIPLE_ICONS[idx] || BookOpenCheck,
    }))
  ), [copy]);

  const directoryLink = divisionFilter === 'female'
    ? '/teachers?gender=female'
    : divisionFilter === 'male'
      ? '/teachers?gender=male'
      : '/teachers';

  return (
    <section className="wn-home-section wn-home-section--white" id="faculty">
      <div className="page-container">
        <div className="wn-section-split-heading">
          <div>
            <span className="wn-approved-eyebrow">{copy.eyebrow}</span>
            <h2 className="wn-home-title">{copy.title}</h2>
            <p className="wn-home-lead">{copy.lead}</p>
          </div>

          <LocalizedLink
            to={directoryLink}
            locale={locale}
            onMouseEnter={() => prefetchRoute('/teachers')}
            className="wn-btn wn-btn--secondary"
          >
            <span>{copy.browseAll}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" aria-hidden="true" />
          </LocalizedLink>
        </div>

        {teachers.length > 0 && (
          <div className="wn-faculty-filters" role="group" aria-label={copy.filterAria}>
            <button
              type="button"
              aria-pressed={divisionFilter === 'all'}
              aria-controls="wn-faculty-results"
              onClick={() => setDivisionFilter('all')}
              onKeyDown={(event) => handleRovingKeyDown({
                event,
                keys: FILTER_KEYS,
                currentKey: 'all',
                onSelect: setDivisionFilter,
                isRTL,
              })}
              className={`wn-faculty-filter-btn ${divisionFilter === 'all' ? 'is-active' : ''}`}
            >
              <Users size={15} aria-hidden="true" />
              <span>{copy.filterAll}</span>
            </button>
            <button
              type="button"
              aria-pressed={divisionFilter === 'male'}
              aria-controls="wn-faculty-results"
              onClick={() => setDivisionFilter('male')}
              onKeyDown={(event) => handleRovingKeyDown({
                event,
                keys: FILTER_KEYS,
                currentKey: 'male',
                onSelect: setDivisionFilter,
                isRTL,
              })}
              className={`wn-faculty-filter-btn ${divisionFilter === 'male' ? 'is-active' : ''}`}
            >
              <GraduationCap size={15} aria-hidden="true" />
              <span>{copy.filterMale}</span>
            </button>
            <button
              type="button"
              aria-pressed={divisionFilter === 'female'}
              aria-controls="wn-faculty-results"
              onClick={() => setDivisionFilter('female')}
              onKeyDown={(event) => handleRovingKeyDown({
                event,
                keys: FILTER_KEYS,
                currentKey: 'female',
                onSelect: setDivisionFilter,
                isRTL,
              })}
              className={`wn-faculty-filter-btn wn-faculty-filter-btn--women ${divisionFilter === 'female' ? 'is-active' : ''}`}
            >
              <HeartHandshake size={15} aria-hidden="true" />
              <span>{copy.filterFemale}</span>
            </button>
          </div>
        )}

        <div id="wn-faculty-results">
          {status === 'loading' ? (
            <div className="wn-faculty-loading" role="status" aria-label={copy.loadingAria}>
              <span className="sr-only">{t.common?.loading || copy.loadingText}</span>
              {[0, 1, 2].map((item) => <span key={item} aria-hidden="true" />)}
            </div>
          ) : status === 'error' ? (
            <div className="space-y-6">
              <div className="wn-faculty-filtered-empty" role="alert">
                <p>{copy.errorText}</p>
                <button
                  type="button"
                  onClick={reloadTeachers}
                  className="wn-btn wn-btn--secondary"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  <span>{t.common?.retry || copy.retry}</span>
                </button>
              </div>
              <div className="wn-faculty-principles">
                {selectionPrinciples.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="wn-faculty-principle">
                    <span className="wn-icon-box wn-icon-box--gold" aria-hidden="true"><Icon size={21} strokeWidth={1.6} /></span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : filteredTeachers.length > 0 ? (
            <div className="wn-faculty-grid">
              {filteredTeachers.map((teacher) => (
                <TeacherCard key={teacher._id || teacher.id} teacher={teacher} locale={locale} isRTL={isRTL} copy={copy} />
              ))}
            </div>
          ) : teachers.length > 0 ? (
            <div className="wn-faculty-filtered-empty">
              <p>{copy.filteredEmpty}</p>
              <LocalizedLink to={directoryLink} locale={locale} className="wn-btn wn-btn--secondary">
                <span>{copy.openDirectory}</span>
                <ArrowIcon size={15} aria-hidden="true" />
              </LocalizedLink>
            </div>
          ) : (
            <div className="wn-faculty-principles">
              {selectionPrinciples.map(({ icon: Icon, title, text }) => (
                <article key={title} className="wn-faculty-principle">
                  <span className="wn-icon-box wn-icon-box--gold" aria-hidden="true"><Icon size={21} strokeWidth={1.6} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="wn-faculty-note">
          <UserRoundCheck size={20} aria-hidden="true" />
          <div>
            <strong>{copy.noteTitle}</strong>
            <span>{copy.noteText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
