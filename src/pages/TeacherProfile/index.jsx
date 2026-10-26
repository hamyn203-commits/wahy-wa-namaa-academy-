import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Award, BookOpen, CheckCircle, Clock, Sparkles, Users, Video, GraduationCap } from 'lucide-react';
import GlobalHeader from '../../components/GlobalHeader';
import GlobalFooter from '../../components/GlobalFooter';
import SEOHead from '../../components/SEOHead';
import Skeleton from '../../components/shared/Skeleton';
import { useI18n } from '../../i18n';
import { localizedPath } from '../../lib/locale';
import api from '../../lib/api';
import { teacherPublicImage, teacherPublicVideo, teacherImageFallback } from '../../lib/teacherMedia';
import { useAuth } from '../../hooks/useAuth.jsx';
import '../../styles/public-experience.css';

export default function TeacherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isAr = locale === 'ar';
  const { isAuthenticated } = useAuth();
  const [teacher, setTeacher] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    const loadTeacher = async () => {
      try {
        const data = await api.get('/api/teachers/' + id);
        setTeacher(data?._id ? data : null);
      } catch {
        setTeacher(null);
      } finally {
        setLoading(false);
      }
    };

    const loadReviews = async () => {
      try {
        const data = await api.get('/api/reviews/teacher/' + id);
        setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
      } catch {
        setReviews([]);
      }
    };

    loadTeacher();
    loadReviews();
  }, [id]);

  const handleBookTrial = () => {
    const path = '/book-trial/' + id;
    navigate(isAuthenticated ? localizedPath(path, locale) : localizedPath('/login', locale) + '?redirect=' + encodeURIComponent(path));
  };

  if (loading) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell" role="status" aria-live="polite">
          <span className="sr-only">{isAr ? 'جاري تحميل ملف المعلم...' : 'Loading teacher profile...'}</span>
          <section className="wn-detail-hero wn-teacher-profile-hero">
            <div className="page-container wn-teacher-profile-grid">
              <div className="wn-teacher-profile-photo">
                <Skeleton className="h-full w-full" />
              </div>
              <div>
                <Skeleton className="mb-3 h-4 w-28" />
                <Skeleton className="mb-4 h-10 w-2/3" />
                <div className="mb-5 flex gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="wn-teacher-stats">
                  <Skeleton className="h-16 w-28 rounded-xl" />
                  <Skeleton className="h-16 w-28 rounded-xl" />
                  <Skeleton className="h-16 w-28 rounded-xl" />
                </div>
                <Skeleton className="mt-5 h-12 w-48 rounded-xl" />
              </div>
            </div>
          </section>
          <div className="page-container wn-public-copy-section">
            <section className="wn-detail-card">
              <div className="wn-detail-card__body grid gap-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </section>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  if (!teacher) {
    return (
      <>
        <GlobalHeader />
        <main className="wn-detail-shell min-h-[70vh] grid place-items-center px-4">
          <div className="wn-public-empty max-w-xl w-full">
            <GraduationCap size={48} />
            <h3>{isAr ? 'ملف المعلم غير متاح' : 'Teacher profile is unavailable'}</h3>
          </div>
        </main>
        <GlobalFooter />
      </>
    );
  }

  const name = teacher.user?.name || teacher.personalInfo?.fullName || (isAr ? 'معلم قرآن' : 'Quran teacher');
  const ratingAverage = Number(teacher.rating?.average ?? teacher.stats?.rating?.average ?? 0);
  const ratingCount = Number(teacher.rating?.count ?? teacher.stats?.rating?.count ?? 0);
  const specializations = Array.isArray(teacher.quranInfo?.specializations) ? teacher.quranInfo.specializations : [];
  const languages = Array.isArray(teacher.languages) ? teacher.languages : [];

  const specName = (spec) => ({
    children: isAr ? 'تعليم الأطفال' : 'Children',
    adults: isAr ? 'تعليم الكبار' : 'Adults',
    women: isAr ? 'تعليم النساء' : 'Women',
    'non-arabic': isAr ? 'غير الناطقين بالعربية' : 'Non-Arabic speakers',
    tajweed: isAr ? 'التجويد' : 'Tajweed',
    ijaza: isAr ? 'الإجازة' : 'Ijazah',
    'arabic-language': isAr ? 'اللغة العربية' : 'Arabic language',
  }[spec] || spec);

  const languageName = (lang) => ({
    arabic: isAr ? 'العربية' : 'Arabic',
    english: isAr ? 'الإنجليزية' : 'English',
    french: isAr ? 'الفرنسية' : 'French',
    turkish: isAr ? 'التركية' : 'Turkish',
    urdu: isAr ? 'الأردية' : 'Urdu',
  }[lang] || lang);

  const media = teacher.media || {};
  const mediaItems = Array.from(new Map([
    { key: 'intro', title: isAr ? 'فيديو تعريفي' : 'Introduction video', url: media.introductionVideo },
    { key: 'recitation', title: isAr ? 'تلاوة' : 'Recitation', url: media.recitationVideo },
    { key: 'method', title: isAr ? 'طريقة التدريس' : 'Teaching method', url: media.teachingMethodVideo },
    ...(Array.isArray(media.additionalVideos) ? media.additionalVideos : []).filter(Boolean).map((url, index) => ({
      key: 'additional-' + index,
      title: isAr ? 'تلاوة إضافية ' + (index + 1) : 'Additional recitation ' + (index + 1),
      url,
    })),
  ]
    .map((item) => ({ ...item, url: teacherPublicVideo(item.url) }))
    .filter((item) => item.url)
    .map((item) => [item.url, item])).values());

  const audioItems = Array.from(new Set(
    (Array.isArray(media.audioRecordings) ? media.audioRecordings : [])
      .map((audio) => teacherPublicImage(audio))
      .filter(Boolean),
  ));

  return (
    <>
      <SEOHead page={{ title: name, description: teacher.user?.bio || (isAr ? 'ملف معلم في أكاديمية وحي ونماء' : 'Teacher profile at Wahy Wa Namaa Academy'), url: '/teachers/' + id, type: 'profile' }} />
      <GlobalHeader />

      <main className="wn-detail-shell">
        <section className="wn-detail-hero wn-teacher-profile-hero">
          <div className="page-container wn-teacher-profile-grid">
            <div className="wn-teacher-profile-photo">
              <img src={teacherPublicImage(media.profilePhoto || teacher.user?.avatar)} alt={name} onError={teacherImageFallback} loading="eager" decoding="async" />
            </div>

            <div>
              <span className="wn-auth-visual__eyebrow"><Sparkles size={14} /> {isAr ? 'ملف المعلم' : 'TEACHER PROFILE'}</span>
              <h1>{name}</h1>
              <div className="wn-detail-meta">
                {ratingCount > 0 && ratingAverage > 0 ? <span><Star size={14} /> {ratingAverage.toFixed(1)} ({ratingCount} {isAr ? 'تقييم' : 'reviews'})</span> : null}
                {teacher.personalInfo?.country ? <span><MapPin size={14} /> {teacher.personalInfo.country}</span> : null}
                {teacher.isFeatured ? <span><Award size={14} /> {isAr ? 'ملف مميز' : 'Featured profile'}</span> : null}
              </div>

              <div className="wn-teacher-stats">
                {teacher.quranInfo?.teachingExperience != null ? <div className="wn-teacher-stat"><Clock size={17} /><strong>{teacher.quranInfo.teachingExperience}</strong><small>{isAr ? 'سنوات خبرة' : 'Years experience'}</small></div> : null}
                {teacher.quranInfo?.memorizedParts != null ? <div className="wn-teacher-stat"><BookOpen size={17} /><strong>{teacher.quranInfo.memorizedParts}</strong><small>{isAr ? 'أجزاء محفوظة' : 'Juz memorized'}</small></div> : null}
                {teacher.quranInfo?.numberOfIjazat != null ? <div className="wn-teacher-stat"><Award size={17} /><strong>{teacher.quranInfo.numberOfIjazat}</strong><small>{isAr ? 'إجازات مسجلة' : 'Listed ijazahs'}</small></div> : null}
                {teacher.stats?.totalStudents != null ? <div className="wn-teacher-stat"><Users size={17} /><strong>{teacher.stats.totalStudents}</strong><small>{isAr ? 'طلاب' : 'Students'}</small></div> : null}
              </div>

              <button onClick={handleBookTrial} className="wn-btn wn-btn--accent wn-btn--lg mt-5">
                {isAr ? 'احجز حصة تجريبية' : 'Book a trial session'}
              </button>
            </div>
          </div>
        </section>

        <div className="page-container wn-public-copy-section">
          <section className="wn-detail-card">
            <div className="wn-teacher-tabs">
              {[
                { id: 'about', label: isAr ? 'عن المعلم' : 'About' },
                { id: 'videos', label: isAr ? 'الوسائط' : 'Media' },
                { id: 'reviews', label: (isAr ? 'التقييمات' : 'Reviews') + ' (' + reviews.length + ')' },
              ].map((tab) => (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={'wn-teacher-tab ' + (activeTab === tab.id ? 'is-active' : '')}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="wn-detail-card__body">
              {activeTab === 'about' ? (
                <div className="grid gap-7">
                  <div>
                    <h3>{isAr ? 'نبذة' : 'Biography'}</h3>
                    <p className="mt-2 text-sm leading-8 text-[var(--wn-text-secondary)]">{teacher.user?.bio || (isAr ? 'لم تُضف نبذة لهذا الملف بعد.' : 'No biography has been added yet.')}</p>
                  </div>

                  {(teacher.academicInfo?.university || teacher.academicInfo?.faculty || teacher.academicInfo?.specialization) ? (
                    <div>
                      <h3>{isAr ? 'المؤهلات الأكاديمية' : 'Academic background'}</h3>
                      <div className="mt-2 grid gap-1 text-sm text-[var(--wn-text-secondary)]">
                        {teacher.academicInfo?.university ? <p>{teacher.academicInfo.university}{teacher.academicInfo?.faculty ? ' — ' + teacher.academicInfo.faculty : ''}</p> : null}
                        {teacher.academicInfo?.specialization ? <p>{isAr ? 'التخصص: ' : 'Specialization: '}{teacher.academicInfo.specialization}</p> : null}
                        {teacher.academicInfo?.graduationYear ? <p>{isAr ? 'سنة التخرج: ' : 'Graduation year: '}{teacher.academicInfo.graduationYear}</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {specializations.length ? <div><h3>{isAr ? 'التخصصات' : 'Specializations'}</h3><div className="wn-detail-tags mt-2">{specializations.map((spec) => <span key={spec}>{specName(spec)}</span>)}</div></div> : null}
                  {languages.length ? <div><h3>{isAr ? 'اللغات' : 'Languages'}</h3><div className="wn-detail-tags mt-2">{languages.map((lang) => <span key={lang}>{languageName(lang)}</span>)}</div></div> : null}
                </div>
              ) : null}

              {activeTab === 'videos' ? (
                <div className="grid gap-5">
                  {mediaItems.length || audioItems.length ? mediaItems.map((item) => (
                    <div key={item.key}>
                      <h3 className="mb-2 flex items-center gap-2"><Video size={17} /> {item.title}</h3>
                      <div className="wn-media-block"><video controls preload="metadata"><source src={item.url} /></video></div>
                    </div>
                  )) : <div className="wn-public-empty !py-10"><Video size={40} /><h3>{isAr ? 'لا توجد وسائط منشورة' : 'No published media'}</h3></div>}

                  {audioItems.length ? (
                    <div className="grid gap-3">
                      {audioItems.map((audio) => <div key={audio} className="wn-media-block p-3"><audio controls preload="metadata"><source src={audio} /></audio></div>)}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'reviews' ? (
                <div>
                  {reviews.length ? reviews.map((review) => (
                    <article key={review._id} className="wn-review-row">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-[var(--wn-emerald-deep)]">{review.student?.name || (isAr ? 'طالب' : 'Student')}</strong>
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--wn-gold-dark)]"><Star size={13} fill="currentColor" /> {review.rating}</span>
                      </div>
                      {review.comment ? <p className="mt-2 text-sm text-[var(--wn-text-secondary)]">{review.comment}</p> : null}
                      {review.createdAt ? <p className="mt-2 text-[10px] text-[var(--wn-text-tertiary)]">{new Date(review.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en')}</p> : null}
                    </article>
                  )) : <div className="wn-public-empty !py-10"><CheckCircle size={40} /><h3>{isAr ? 'لا توجد تقييمات منشورة بعد' : 'No published reviews yet'}</h3></div>}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <GlobalFooter />
    </>
  );
}
