import { SITE_URL, DEFAULT_OG_IMAGE, LOGO_URL, toAbsoluteUrl } from '../seo/brand';

export const generateMetaTags = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  noindex = false,
}) => {
  const defaultImage = DEFAULT_OG_IMAGE;
  const defaultUrl = SITE_URL;
  const resolvedImage = image ? toAbsoluteUrl(image) : defaultImage;
  const resolvedUrl = url ? toAbsoluteUrl(url) : defaultUrl;
  
  return {
    title: `${title} | أكاديمية وَحْيٌ وَنَمَاء`,
    meta: [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'author', content: 'أكاديمية وَحْيٌ وَنَمَاء | WAHY WA NAMAA' },
      { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow' },
      
      // Open Graph
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: resolvedImage },
      { property: 'og:url', content: resolvedUrl },
      { property: 'og:type', content: type },
      { property: 'og:locale', content: 'ar_EG' },
      { property: 'og:site_name', content: 'أكاديمية وَحْيٌ وَنَمَاء' },
      
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: resolvedImage },
      
      // Arabic specific
      { name: 'language', content: 'Arabic' },
      { name: 'revisit-after', content: '7 days' },
    ]
  };
};

export const generateStructuredData = ({
  type,
  data
}) => {
  const schemas = {
    organization: {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'أكاديمية وَحْيٌ وَنَمَاء',
      url: SITE_URL,
      logo: LOGO_URL,
      description: 'أكاديمية رقمية لتعلّم القرآن الكريم والحفظ والتجويد عبر برامج ومسارات تعليمية.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'EG'
      }
    },
    teacher: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.name,
      image: data.image ? toAbsoluteUrl(data.image) : undefined,
      jobTitle: 'معلم قرآن كريم',
      worksFor: {
        '@type': 'EducationalOrganization',
        name: 'أكاديمية وَحْيٌ وَنَمَاء'
      },
      description: data.bio,
      knowsAbout: ['القرآن الكريم', 'التجويد', 'الحفظ'],
      hasCredential: data.certificates,
      aggregateRating: data.rating ? {
        '@type': 'AggregateRating',
        ratingValue: data.rating.average,
        reviewCount: data.rating.count
      } : undefined
    },
    course: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: data.name,
      description: data.description,
      provider: {
        '@type': 'EducationalOrganization',
        name: 'أكاديمية وَحْيٌ وَنَمَاء',
        url: SITE_URL
      },
      educationalLevel: data.level,
      inLanguage: 'ar',
      courseMode: 'online',
      offers: {
        '@type': 'Offer',
        price: data.price || '50',
        priceCurrency: 'EGP'
      }
    },
    faq: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: data.questions.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer
        }
      }))
    }
  };
  
  return schemas[type] || {};
};

export const pageMeta = {
  home: {
    title: 'الرئيسية',
    description: 'أكاديمية وَحْيٌ وَنَمَاء — نتعلم القرآن، نحفظه، وننمو به. منصة رقمية للتعلم والحفظ والتجويد.',
    keywords: 'وحي ونماء, تعليم القرآن, تحفيظ القرآن, تجويد, إجازة, لغة عربية, تعليم عن بعد, معلم قرآن'
  },
  teachers: {
    title: 'المعلمون',
    description: 'استعرض ملفات المعلمين المنشورة واختر المعلم الأنسب لهدفك ومستواك في أكاديمية وَحْيٌ وَنَمَاء',
    keywords: 'معلم قرآن, معلم تجويد, معلم مجاز, سند متصل, اختيار معلم'
  },
  teacherProfile: (name) => ({
    title: `الملف الشخصي - ${name}`,
    description: `تعرف على ${name} وملفه التعليمي في أكاديمية وَحْيٌ وَنَمَاء`,
    keywords: `${name}, معلم قرآن, ملف شخصي, سيرة ذاتية`
  }),
  register: {
    title: 'تسجيل معلم جديد',
    description: 'انضم لفريق معلمي أكاديمية وَحْيٌ وَنَمَاء وشارك في رسالة تعليم كتاب الله',
    keywords: 'تسجيل معلم, انضم كمعلم, تعليم قرآن'
  },
  studentDashboard: {
    title: 'لوحة تحكم الطالب',
    description: 'إدارة حصصك وواجباتك وتقييماتك في أكاديمية وَحْيٌ وَنَمَاء',
    keywords: 'لوحة الطالب, حصصي, واجباتي, تقييماتي'
  },
  teacherDashboard: {
    title: 'لوحة تحكم المعلم',
    description: 'إدارة طلابك وحصصك وجداولك في أكاديمية وَحْيٌ وَنَمَاء',
    keywords: 'لوحة المعلم, إدارة الطلاب, الحصص'
  }
};
