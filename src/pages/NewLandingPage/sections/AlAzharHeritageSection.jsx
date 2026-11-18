import { useI18n } from '../../../i18n';
import { useMarket } from '../../../context/MarketProvider';
import {
  Award,
  Globe,
  BookOpen,
  ScrollText,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import LocalizedLink from '../../../components/LocalizedLink';
import { prefetchRoute } from '../../../lib/routePrefetch';

export default function AlAzharHeritageSection() {
  const { locale } = useI18n();
  const { marketSlug } = useMarket();
  const isIndonesian = marketSlug === 'indonesia-malaysia' || locale === 'id' || locale === 'ms';
  const isAr = locale === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const points = [
    {
      step: 'I',
      title: locale === 'id'
        ? 'Silsilah Sanad Bersambung'
        : isAr
          ? 'سند علمي متصل بالرسول ﷺ'
          : 'Connected Sanad Transmission',
      desc: locale === 'id'
        ? 'Guru kami memegang Ijazah & Sanad hafalan Quran yang bersambung langsung hingga Rasulullah ﷺ.'
        : isAr
          ? 'نخبة من المعلمين والمعلمات المجازين بالسند المتصل في القراءات وضبط الأداء القرآني بالتلقي والمشافهة.'
          : 'Approved scholars holding verified Ijazah and unbroken Sanad chains tracing back to the Prophet ﷺ.',
      highlight: locale === 'id' ? 'Ijazah & Riwayat' : isAr ? 'إجازة ورواية موثقة' : 'Verified Ijazah',
      icon: ScrollText,
    },
    {
      step: 'II',
      title: locale === 'id'
        ? 'Pengajar Asli Mesir (Native)'
        : isAr
          ? 'لسان عربي فصيح وضبط للمخارج'
          : 'Native Egyptian Quran Scholars',
      desc: locale === 'id'
        ? 'Interaksi langsung dengan Ustadz/Ustadzah Mesir untuk melatih makhraj & lahjah Arabiyah yang fasih.'
        : isAr
          ? 'تلقٍ مباشر يعتني بدقة مخارج الحروف وصفاتها وسلامة النطق العربي الفصيح للصغار والكبار والناطقين بغيرها.'
          : 'Direct oral instruction with native Arabic-speaking scholars to perfect articulation and Tajweed.',
      highlight: locale === 'id' ? 'Makhraj Tepat' : isAr ? 'تصحيح مشافهة مباشر' : 'Precision Makharij',
      icon: Globe,
    },
    {
      step: 'III',
      title: locale === 'id'
        ? 'Standar Kurikulum Azhari'
        : isAr
          ? 'منهجية الأزهر في التدرج والرسوخ'
          : 'Structured Azhari Methodology',
      desc: locale === 'id'
        ? 'Kurikulum terstruktur yang menggabungkan tajwid teoretis, praktik bacaan, dan murajaah bertahap.'
        : isAr
          ? 'تدرج علمي يجمع بين التأسيس الصوتي، التجويد التطبيقي، والربط المنظم بين الحفظ الجديد والمراجعة.'
          : 'Gradual progression uniting foundational phonetics, applied Tajweed, and disciplined revision.',
      highlight: locale === 'id' ? 'Bertahap & Kokoh' : isAr ? 'تأسيس • ضبط • إتقان' : 'Foundation to Mastery',
      icon: BookOpen,
    },
  ];

  const credentials = [
    locale === 'id' ? 'Verifikasi profil & sertifikat guru sebelum mengajar' : isAr ? 'فحص علمي وتربوي لملف كل معلم ومعلمة قبل الاعتماد' : 'Rigorous academic & pedagogical verification before listing',
    locale === 'id' ? 'Pilihan Ustadz atau Ustadzah sesuai privasi keluarga' : isAr ? 'حلقات مستقلة للرجال والأطفال وأخرى خاصة بالسيدات' : 'Dedicated men/children and private women-only circles',
  ];

  return (
    <section className="wn-azhar-heritage wn-pattern-geo--gold" id="azhar-heritage">
      <div className="wn-azhar-heritage__glow" aria-hidden="true" />

      <div className="page-container relative z-10">
        <div className="wn-azhar-heritage__header">
          <div>
            <span className="wn-azhar-heritage__eyebrow">
              <Award size={14} />
              {locale === 'id' ? 'Keunggulan Akademik' : isAr ? 'أصالة المرجعية والسند' : 'SCHOLARLY LINEAGE & SANAD'}
            </span>
            <h2>
              {locale === 'id'
                ? 'Sanad & Pengajar Al-Azhar Mesir'
                : isAr
                  ? 'جذور أزهرية راسخة… وسند متصل يُورث الإتقان'
                  : 'Rooted in Al-Azhar Scholarship & Authentic Sanad'}
            </h2>
          </div>
          <p className="wn-azhar-heritage__lead">
            {locale === 'id'
              ? 'Belajar mengaji langsung dengan guru-guru lulusan Universitas Al-Azhar Kairo, Mesir yang memiliki Sanad periwayatan Quran yang bersambung.'
              : isAr
                ? 'نجمع في أكاديمية وَحْيٌ وَنَمَاء بين عراقة المدرسة المصرية في الإقراء والتجويد وبين أدوات المتابعة الرقمية الحديثة.'
                : 'Wahy Wa Namaa unites the precision of Cairo’s Al-Azhar recitation tradition with calm, structured modern follow-up.'}
          </p>
        </div>

        <div className="wn-azhar-heritage__grid">
          {points.map(({ step, title, desc, highlight, icon: Icon }) => (
            <article key={step} className="wn-azhar-card">
              <div className="wn-azhar-card__top">
                <span className="wn-azhar-card__icon">
                  <Icon size={22} strokeWidth={1.65} />
                </span>
                <span className="wn-azhar-card__pill">{highlight}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>

        <div className="wn-azhar-heritage__bar">
          <div className="wn-azhar-heritage__checks">
            {credentials.map((item) => (
              <span key={item}>
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </span>
            ))}
          </div>

          <LocalizedLink
            to="/teachers"
            locale={locale}
            onMouseEnter={() => prefetchRoute('/teachers')}
            className="wn-btn wn-btn--light wn-btn--sm"
          >
            <span>
              {locale === 'id'
                ? 'Lihat Profil Pengajar'
                : isAr
                  ? 'تعرّف على المعلمين المعتمدين'
                  : 'Meet Approved Scholars'}
            </span>
            <ArrowIcon size={15} className="wn-btn__arrow" />
          </LocalizedLink>
        </div>

        {isIndonesian && (
          <div className="wn-azhar-heritage__market-note">
            <Globe size={20} strokeWidth={1.7} />
            <p>
              <strong>Catatan Khusus Asia Tenggara:</strong>{' '}
              Semua kelas di Wahy Wa Namaa dibimbing oleh pengajar terverifikasi dengan standar makhraj & tajwid Al-Azhar serta jadwal fleksibel sesuai zona waktu WIB/WITA/MYT.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
