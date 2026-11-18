import { memo, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import TeacherAvatar from '../../../components/shared/TeacherAvatar';
import { prefetchTeacherBundle } from '../../../lib/teacherProfileCache';
import { prefetchRoute } from '../../../lib/routePrefetch';
import { teacherPublicVideo } from '../../../lib/teacherMedia';

const specialtyLabels = {
  children: { ar: 'الأطفال', en: 'Children' },
  adults: { ar: 'الكبار', en: 'Adults' },
  women: { ar: 'السيدات', en: 'Women' },
  tajweed: { ar: 'التجويد', en: 'Tajweed' },
  ijaza: { ar: 'الإجازة', en: 'Ijazah' },
  ijazah: { ar: 'الإجازة', en: 'Ijazah' },
  hifz: { ar: 'الحفظ', en: 'Hifz' },
  'arabic-language': { ar: 'العربية', en: 'Arabic' },
};

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

const TeacherCard = memo(function TeacherCard({ teacher, locale, isAr }) {
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const id = teacher?._id || teacher?.id;
  const name = teacher?.user?.name || teacher?.personalInfo?.fullName || (isAr ? 'معلم قرآن معتمد' : 'Approved Quran Scholar');
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
          <UserRoundCheck size={13} />
          {isAr ? 'ملف معتمد' : 'Approved profile'}
        </span>

        {(hasIntroVideo || hasAudioSample) && (
          <div className="wn-faculty-card__media-pills">
            {hasIntroVideo && (
              <span>
                <CirclePlay size={12} />
                {isAr ? 'فيديو تعريفي' : 'Intro video'}
              </span>
            )}
            {hasAudioSample && (
              <span>
                <Volume2 size={12} />
                {isAr ? 'تلاوة صوتية' : 'Audio sample'}
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
              <Star size={14} fill="currentColor" />
              {rating.toFixed(1)}
            </span>
          )}
          {experience ? (
            <span>
              <Award size={14} />
              {experience} {isAr ? 'سنوات خبرة' : 'years experience'}
            </span>
          ) : null}
        </div>

        {specialties.length > 0 && (
          <div className="wn-faculty-card__tags">
            {specialties.map((specialty) => (
              <span key={specialty}>
                {specialtyLabels[specialty]?.[isAr ? 'ar' : 'en'] || specialty}
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
            <span>{isAr ? 'عرض الملف والحجز التجريبي' : 'View profile & book trial'}</span>
            <ArrowIcon size={15} />
          </LocalizedLink>
        ) : null}
      </div>
    </article>
  );
});

export default function TeachersSection() {
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const [teachers, setTeachers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [divisionFilter, setDivisionFilter] = useState('all');

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
        setStatus('ready');
      }
    }

    loadTeachers();
    return () => { active = false; };
  }, []);

  const filteredTeachers = useMemo(() => {
    if (divisionFilter === 'all') return teachers.slice(0, 3);
    return teachers
      .filter((teacher) => resolveTeacherGender(teacher) === divisionFilter)
      .slice(0, 3);
  }, [teachers, divisionFilter]);

  const selectionPrinciples = useMemo(() => ([
    {
      icon: BookOpenCheck,
      title: isAr ? 'إتقان علمي ومراجعة دقيقة' : 'Scholarly mastery',
      text: isAr ? 'نراجع السند والخلفية العلمية ونموذج التلاوة قبل إتاحة أي ملف للطلاب.' : 'Academic credentials and recitation mastery are verified before listing.',
    },
    {
      icon: HeartHandshake,
      title: isAr ? 'رفق وحسن تربية' : 'Care and pedagogy',
      text: isAr ? 'نبحث عن المعلم والمعلمة القادرين على التحبيب والصبر بجانب الإتقان.' : 'We select patient, encouraging educators alongside technical Quran mastery.',
    },
    {
      icon: GraduationCap,
      title: isAr ? 'تخصص يناسب الطالب' : 'Personalized matching',
      text: isAr ? 'اختيار المعلم يتم حسب السن والهدف والمستوى والقسم المناسب للأسرة.' : 'Matching aligns with learner age, goals, current level, and family preference.',
    },
  ]), [isAr]);

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
            <span className="wn-approved-eyebrow">{isAr ? 'معلمونا المعتمدون' : 'APPROVED SCHOLARS'}</span>
            <h2 className="wn-home-title">
              {isAr ? 'تعليم يقوم على الإتقان والرفق وحسن التوجيه' : 'Teaching built on mastery, care, and clear guidance'}
            </h2>
            <p className="wn-home-lead">
              {isAr
                ? 'نعرض هنا الملفات المعتمدة فعليًا عند توفرها، بدون أسماء أو تقييمات تسويقية مصطنعة.'
                : 'Only actual approved teacher profiles are shown here when available — no invented names or marketing ratings.'}
            </p>
          </div>

          <LocalizedLink
            to={directoryLink}
            locale={locale}
            onMouseEnter={() => prefetchRoute('/teachers')}
            className="wn-btn wn-btn--secondary"
          >
            <span>{isAr ? 'استعرض جميع المعلمين' : 'Browse all teachers'}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>

        {teachers.length > 0 && (
          <div className="wn-faculty-filters" role="tablist" aria-label={isAr ? 'تصفية المعلمين حسب القسم' : 'Filter scholars by section'}>
            <button
              type="button"
              role="tab"
              aria-selected={divisionFilter === 'all'}
              onClick={() => setDivisionFilter('all')}
              className={`wn-faculty-filter-btn ${divisionFilter === 'all' ? 'is-active' : ''}`}
            >
              <Users size={15} />
              <span>{isAr ? 'جميع الأقسام' : 'All Scholars'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={divisionFilter === 'male'}
              onClick={() => setDivisionFilter('male')}
              className={`wn-faculty-filter-btn ${divisionFilter === 'male' ? 'is-active' : ''}`}
            >
              <GraduationCap size={15} />
              <span>{isAr ? 'معلمو الرجال والأطفال' : 'Male Tutors'}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={divisionFilter === 'female'}
              onClick={() => setDivisionFilter('female')}
              className={`wn-faculty-filter-btn wn-faculty-filter-btn--women ${divisionFilter === 'female' ? 'is-active' : ''}`}
            >
              <HeartHandshake size={15} />
              <span>{isAr ? 'معلمات قسم السيدات' : 'Female Tutors'}</span>
            </button>
          </div>
        )}

        {status === 'loading' ? (
          <div className="wn-faculty-loading" aria-label={isAr ? 'جاري تحميل المعلمين' : 'Loading teachers'}>
            {[0, 1, 2].map((item) => <span key={item} />)}
          </div>
        ) : filteredTeachers.length > 0 ? (
          <div className="wn-faculty-grid">
            {filteredTeachers.map((teacher) => (
              <TeacherCard key={teacher._id || teacher.id} teacher={teacher} locale={locale} isAr={isAr} />
            ))}
          </div>
        ) : teachers.length > 0 ? (
          <div className="wn-faculty-filtered-empty">
            <p>
              {isAr
                ? 'يمكنك تصفح الدليل الكامل لاستعراض جميع المعلمين والمعلمات المتاحين في هذا القسم.'
                : 'Browse the full scholar directory to explore all available tutors in this division.'}
            </p>
            <LocalizedLink to={directoryLink} locale={locale} className="wn-btn wn-btn--secondary wn-btn--sm">
              <span>{isAr ? 'فتح دليل القسم' : 'Open division directory'}</span>
              <ArrowIcon size={15} />
            </LocalizedLink>
          </div>
        ) : (
          <div className="wn-faculty-principles">
            {selectionPrinciples.map(({ icon: Icon, title, text }) => (
              <article key={title} className="wn-faculty-principle">
                <span className="wn-icon-box wn-icon-box--gold"><Icon size={21} strokeWidth={1.6} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        )}

        <div className="wn-faculty-note">
          <UserRoundCheck size={20} />
          <div>
            <strong>{isAr ? 'خصوصية واحترام كامل لاحتياجات الأسرة' : 'Complete privacy and family fit'}</strong>
            <span>{isAr ? 'يضم قسم السيدات معلمات مجازات فقط، بينما يخدم قسم الرجال والأطفال البنين والرجال حسب الفئة العمرية.' : 'Our dedicated women’s section features certified female tutors exclusively, alongside age-matched circles for men and boys.'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
