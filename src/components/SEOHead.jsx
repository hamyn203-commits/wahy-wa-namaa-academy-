import { useEffect, useMemo } from 'react';
import { useSEO } from '../hooks/useSEO';
import { hreflangLinks } from '../seo/brand';

export default function SEOHead({ page = {} }) {
  const { generateMetaTags, organizationSchema, websiteSchema } = useSEO();
  const meta = generateMetaTags(page);
  const path = page.url || '/';
  const includeAlternates = !page.noindex && page.alternates !== false;
  const alternates = useMemo(
    () => (includeAlternates ? hreflangLinks(path) : []),
    [includeAlternates, path]
  );

  useEffect(() => {
    document.title = meta.title;

    if (page.canonical === false || page.noindex) {
      document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
    }

    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove());

    meta.meta.forEach((tag) => {
      let element;
      if (tag.rel) {
        element = document.querySelector(`link[rel="${tag.rel}"]${tag.hreflang ? `[hreflang="${tag.hreflang}"]` : ''}`);
        if (!element) {
          element = document.createElement('link');
          element.setAttribute('rel', tag.rel);
          if (tag.hreflang) element.setAttribute('hreflang', tag.hreflang);
          document.head.appendChild(element);
        }
        element.setAttribute('href', tag.href);
      } else if (tag.property === 'og:locale:alternate') {
        element = document.createElement('meta');
        element.setAttribute('property', tag.property);
        element.setAttribute('content', tag.content);
        document.head.appendChild(element);
      } else if (tag.property) {
        element = document.querySelector(`meta[property="${tag.property}"]`);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute('property', tag.property);
          document.head.appendChild(element);
        }
        element.setAttribute('content', tag.content);
      } else if (tag.name) {
        element = document.querySelector(`meta[name="${tag.name}"]`);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute('name', tag.name);
          document.head.appendChild(element);
        }
        element.setAttribute('content', tag.content);
      }
    });

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    alternates.forEach((link) => {
      const el = document.createElement('link');
      el.setAttribute('rel', link.rel);
      el.setAttribute('hreflang', link.hreflang);
      el.setAttribute('href', link.href);
      el.setAttribute('data-seo-hreflang', '1');
      document.head.appendChild(el);
    });

    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());

    const appendJsonLd = (id, schemaObj) => {
      if (!schemaObj) return;
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-schema', id);
      script.textContent = JSON.stringify(schemaObj);
      document.head.appendChild(script);
    };

    appendJsonLd('org', organizationSchema);
    appendJsonLd('web', websiteSchema);

    if (Array.isArray(page.schema)) {
      page.schema.forEach((item, index) => appendJsonLd(`page-${index}`, item));
    } else if (page.schema) {
      appendJsonLd('page', page.schema);
    }
  }, [meta, organizationSchema, websiteSchema, page.schema, page.canonical, page.noindex, path, alternates]);

  return null;
}
