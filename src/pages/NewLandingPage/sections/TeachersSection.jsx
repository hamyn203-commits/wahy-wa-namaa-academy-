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
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { teacherPublicImage, teacherImageFallback } from '../../../lib/teacherMedia';

const specialtyLabels = {
  children: { ar: 'الأطفال', en: 'Children' },
  adults: { ar: 'الكبار', en: 'Adults' },
  women: { ar: 'السيدات', en: 'Women' },
  tajweed: { ar: 'التجويد', en: 'Tajweed' },
  ijaza: { ar: 'الإجازة', en: 'Ijazah' },
  'arabic-language': { ar: 'العربية', en: 'Arabic' },
};

const TeacherCard = memo(function TeacherCard({ teacher, locale, isAr }) {
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const id = teacher?._id || teacher?.id;
  const name = teacher?.user?.name || teacher?.personalInfo?.fullName || (isAr ? 'معلم قرآن' : 'Quran Teacher');
  const photo = teacher?.media?.profilePhoto;
  const rating = Number(teacher?.rating?.average || 0);
  const experience = teacher?.quranInfo?.teachingExperience;
  const specialties = (teacher?.quranInfo?.specializations || []).slice(0, 3);

  return (
    <article className="wn-faculty-card">
      <div className="wn-faculty-card__media">
        {photo ? (
          <img
            src={teacherPublicImage(photo)}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={teacherImageFallback}
          />
        ) : (
          <div className="wn-faculty-card__placeholder" aria-hidden="true">
            <GraduationCap size={40} strokeWidth={1.35} />
          </div>
        )}
        <span className="wn-badge wn-badge--gold wn-faculty-card__badge">
          <UserRoundCheck size={13} />
          {isAr ? 'ملف معتمد' : 'Approved profile'}
        </span>
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
          <LocalizedLink to={'/teachers/' + id} locale={locale} className="wn-faculty-card__link">
            <span>{isAr ? 'عرض الملف التعليمي' : 'View teaching profile'}</span>
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

  useEffect(() => {
    let active = true;

    async function loadTeachers() {
      try {
        const response = await fetch('/api/teachers?limit=3&sortBy=rating&sortOrder=desc');
        if (!response.ok) throw new Error('teachers-unavailable');
        const payload = await response.json();
        if (!active) return;
        setTeachers(Array.isArray(payload?.teachers) ? payload.teachers.slice(0, 3) : []);
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

  const selectionPrinciples = useMemo(() => ([
    {
      icon: BookOpenCheck,
      title: isAr ? 'إتقان علمي' : 'Scholarly mastery',
      text: isAr ? 'نراجع الخلفية العلمية والتخصص قبل إتاحة الملف للطلاب.' : 'Academic background and teaching specialization are reviewed before a profile is listed.',
    },
    {
      icon: HeartHandshake,
      title: isAr ? 'رفق وتربية' : 'Care and pedagogy',
      text: isAr ? 'نبحث عن المعلم الذي يجمع بين الإتقان وحسن التعامل مع المتعلم.' : 'We value patient, respectful teaching alongside technical Quran expertise.',
    },
    {
      icon: GraduationCap,
      title: isAr ? 'تخصص يناسب الطالب' : 'The right fit',
      text: isAr ? 'اختيار المعلم يكون حسب العمر والهدف والمستوى واللغة المتاحة.' : 'Teacher matching considers age, goal, current level, and available language.',
    },
  ]), [isAr]);

  return (
    <section className="wn-home-section wn-home-section--white" id="faculty">
      <div className="page-container">
        <div className="wn-section-split-heading">
          <div>
            <span className="wn-approved-eyebrow">{isAr ? 'معلمونا' : 'OUR TEACHERS'}</span>
            <h2 className="wn-home-title">
              {isAr ? 'تعليم يقوم على الإتقان والرفق وحسن التوجيه' : 'Teaching built on mastery, care, and clear guidance'}
            </h2>
            <p className="wn-home-lead">
              {isAr
                ? 'نعرض هنا الملفات المعتمدة فعليًا عند توفرها، بدون أسماء أو تقييمات تسويقية مصطنعة.'
                : 'Only actual approved teacher profiles are shown here when available — no invented names or marketing ratings.'}
            </p>
          </div>

          <LocalizedLink to="/teachers" locale={locale} className="wn-btn wn-btn--secondary">
            <span>{isAr ? 'استعرض جميع المعلمين' : 'Browse all teachers'}</span>
            <ArrowIcon size={16} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>

        {status === 'loading' ? (
          <div className="wn-faculty-loading" aria-label={isAr ? 'جاري تحميل المعلمين' : 'Loading teachers'}>
            {[0, 1, 2].map((item) => <span key={item} />)}
          </div>
        ) : teachers.length > 0 ? (
          <div className="wn-faculty-grid">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher._id || teacher.id} teacher={teacher} locale={locale} isAr={isAr} />
            ))}
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
            <strong>{isAr ? 'خصوصية واحترام احتياجات المتعلم' : 'Privacy and learner fit come first'}</strong>
            <span>{isAr ? 'يمكن اختيار معلم أو معلمة حسب تفضيل الأسرة وتوفر التخصص.' : 'Families can choose a male or female teacher based on preference and available specialization.'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
