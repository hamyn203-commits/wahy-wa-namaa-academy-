import { useI18n } from '../i18n';
import {
  SITE_URL,
  DEFAULT_OG_IMAGE,
  LOGO_URL,
  ALTERNATE_NAMES,
  OG_LOCALE,
  SEO_LOCALES,
  localePath,
  toAbsoluteUrl,
} from '../seo/brand';

function hasBrandSuffix(title, appName, appNameFull) {
  const normalized = String(title || '').toLowerCase();
  const candidates = [
    appName,
    appNameFull,
    'وَحْيٌ وَنَمَاء',
    'وحي ونماء',
    'wahy wa namaa',
    'وحی و نماء',
    'وەحی و نەما',
  ].filter(Boolean);
  return candidates.some((brand) => normalized.includes(brand.toLowerCase()));
}

export function useSEO() {
  const { locale, t } = useI18n();
  const baseUrl = SITE_URL;
  const c = t.common;
  const brandFull = c.appNameFull || c.appName;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: brandFull,
    alternateName: ALTERNATE_NAMES,
    url: baseUrl,
    logo: LOGO_URL,
    image: DEFAULT_OG_IMAGE,
    description: c.seoDescription || t.hero.subtitle,
    slogan: c.slogan,
    keywords: c.seoKeywords,
    inLanguage: SEO_LOCALES,
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brandFull,
    alternateName: ALTERNATE_NAMES,
    url: baseUrl,
    description: c.seoDescription,
    inLanguage: SEO_LOCALES,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/${locale}/teachers?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const createBreadcrumbSchema = (items = []) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: localePath(locale, item.url || '/'),
    })),
  });

  const createCourseSchema = (course) => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.name,
      description: course.description || course.name,
      url: course.url ? localePath(locale, course.url) : undefined,
      image: course.image ? toAbsoluteUrl(course.image) : undefined,
      provider: { '@type': 'EducationalOrganization', name: c.appName, sameAs: baseUrl },
      educationalLevel: course.level || undefined,
      inLanguage: locale,
    };

    if (course.price !== undefined && course.price !== null && !Number.isNaN(Number(course.price))) {
      schema.offers = {
        '@type': 'Offer',
        price: Number(course.price),
        priceCurrency: course.currency || 'USD',
        availability: 'https://schema.org/InStock',
      };
    }

    if (Number(course.ratingCount) > 0 && Number(course.ratingValue) > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: Number(course.ratingValue),
        reviewCount: Number(course.ratingCount),
      };
    }

    return schema;
  };

  const createTeacherSchema = (teacher) => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: teacher.name,
      url: teacher.url ? localePath(locale, teacher.url) : undefined,
      image: teacher.image ? toAbsoluteUrl(teacher.image) : undefined,
      jobTitle: teacher.specialty || undefined,
      worksFor: { '@type': 'EducationalOrganization', name: c.appName, url: baseUrl },
      description: teacher.bio || undefined,
    };

    if (Array.isArray(teacher.languages) && teacher.languages.length > 0) {
      schema.knowsLanguage = teacher.languages;
    }

    return schema;
  };

  const createFAQSchema = (faqs = []) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs
      .filter((faq) => faq?.question && faq?.answer)
      .map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
  });

  const createArticleSchema = (article) => {
    const url = article.url ? localePath(locale, article.url) : undefined;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.excerpt || article.title,
      image: article.image ? toAbsoluteUrl(article.image) : DEFAULT_OG_IMAGE,
      mainEntityOfPage: url ? { '@type': 'WebPage', '@id': url } : undefined,
      author: article.author ? { '@type': 'Person', name: article.author } : { '@type': 'Organization', name: c.appName },
      publisher: {
        '@type': 'Organization',
        name: c.appName,
        logo: { '@type': 'ImageObject', url: LOGO_URL },
      },
      datePublished: article.datePublished ? new Date(article.datePublished).toISOString() : undefined,
      dateModified: (article.dateModified || article.datePublished)
        ? new Date(article.dateModified || article.datePublished).toISOString()
        : undefined,
      inLanguage: locale,
    };
  };

  const createWebPageSchema = ({ name, description, url, type = 'WebPage' }) => ({
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url: url ? localePath(locale, url) : localePath(locale, '/'),
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', url: baseUrl, name: c.appNameFull || c.appName },
  });

  const createCollectionSchema = ({ name, description, url, items = [] }) => {
    const pageUrl = localePath(locale, url || '/');
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      description,
      url: pageUrl,
      inLanguage: locale,
      isPartOf: { '@type': 'WebSite', url: baseUrl, name: c.appNameFull || c.appName },
    };

    const validItems = items.filter((item) => item?.name && item?.url).slice(0, 12);
    if (validItems.length > 0) {
      schema.mainEntity = {
        '@type': 'ItemList',
        itemListElement: validItems.map((item, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: item.name,
          url: localePath(locale, item.url),
        })),
      };
    }

    return schema;
  };

  const createOfferCatalogSchema = ({ name, description, url, offers = [] }) => ({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: localePath(locale, url || '/plans'),
    inLanguage: locale,
    mainEntity: {
      '@type': 'OfferCatalog',
      name,
      itemListElement: offers
        .filter((offer) => offer?.name && offer?.price != null)
        .map((offer, idx) => ({
          '@type': 'Offer',
          position: idx + 1,
          name: offer.name,
          description: offer.description,
          price: Number(offer.price),
          priceCurrency: offer.currency || 'EGP',
          availability: 'https://schema.org/InStock',
        })),
    },
  });

  const generateMetaTags = (page = {}) => {
    const cleanSlogan = String(c.slogan || '').replace(/[.۔]+$/, '');
    const defaultTitle = `${brandFull} | ${cleanSlogan}`;
    const rawTitle = page.title ? String(page.title).trim() : '';
    const title = rawTitle
      ? (hasBrandSuffix(rawTitle, c.appName, c.appNameFull) ? rawTitle : `${rawTitle} | ${brandFull}`)
      : defaultTitle;
    const description = page.description || c.seoDescription || t.hero.subtitle;
    const pagePath = page.url || '/';
    const url = localePath(locale, pagePath);
    const image = page.image ? toAbsoluteUrl(page.image) : DEFAULT_OG_IMAGE;
    const keywords = page.keywords || c.seoKeywords;
    const robots = page.robots || (
      page.noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    );

    const meta = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'application-name', content: brandFull },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: title },
      { property: 'og:url', content: url },
      { property: 'og:type', content: page.type || 'website' },
      { property: 'og:locale', content: OG_LOCALE[locale] || locale },
      { property: 'og:site_name', content: brandFull },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: title },
      { name: 'robots', content: robots },
      { name: 'googlebot', content: robots },
      { name: 'language', content: locale },
      { name: 'author', content: c.appNameFull || c.appName },
    ];

    if (page.canonical !== false && !page.noindex) {
      meta.push({ rel: 'canonical', href: url });
    }

    SEO_LOCALES.filter((l) => l !== locale).forEach((l) => {
      meta.push({ property: 'og:locale:alternate', content: OG_LOCALE[l] || l });
    });

    return { title, meta };
  };

  return {
    organizationSchema,
    websiteSchema,
    createBreadcrumbSchema,
    createCourseSchema,
    createTeacherSchema,
    createFAQSchema,
    createArticleSchema,
    createWebPageSchema,
    createCollectionSchema,
    createOfferCatalogSchema,
    generateMetaTags,
  };
}
