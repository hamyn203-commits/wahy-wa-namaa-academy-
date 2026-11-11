import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// دالة لإنشاء sitemap ديناميكي
function generateSitemap() {
  const baseUrl = 'https://wahy-wa-namaa-academy.vercel.app';
  const currentDate = new Date().toISOString().split('T')[0];
  
  const pages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/free-trial', priority: '1.0', changefreq: 'weekly' },
    { url: '/teachers', priority: '0.9', changefreq: 'daily' },
    { url: '/courses', priority: '0.9', changefreq: 'weekly' },
    { url: '/blog', priority: '0.8', changefreq: 'daily' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
    { url: '/about', priority: '0.7', changefreq: 'monthly' },
    { url: '/start', priority: '0.9', changefreq: 'monthly' },
    { url: '/register/guardian', priority: '0.8', changefreq: 'monthly' },
    { url: '/register/student', priority: '0.8', changefreq: 'monthly' },
    { url: '/login', priority: '0.6', changefreq: 'monthly' },
    { url: '/faq', priority: '0.6', changefreq: 'monthly' },
    { url: '/privacy', priority: '0.3', changefreq: 'yearly' },
    { url: '/terms', priority: '0.3', changefreq: 'yearly' },
  ];

  const languages = ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  pages.forEach(page => {
    languages.forEach(lang => {
      sitemap += `  <url>
    <loc>${baseUrl}/${lang}${page.url === '/' ? '' : page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
`;
      
      // إضافة hreflang tags للروابط متعددة اللغات
      languages.forEach(altLang => {
        sitemap += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${baseUrl}/${altLang}${page.url === '/' ? '' : page.url}" />\n`;
      });
      sitemap += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/ar${page.url === '/' ? '' : page.url}" />\n`;
      
      sitemap += `  </url>\n`;
    });
  });

  sitemap += `</urlset>`;
  
  return sitemap;
}

// Plugin لإنشاء sitemap أثناء البناء
const sitemapPlugin = {
  name: 'sitemap-generator',
  closeBundle() {
    const sitemap = generateSitemap();
    const distPath = resolve(__dirname, 'dist');
    mkdirSync(distPath, { recursive: true });
    writeFileSync(resolve(distPath, 'sitemap.xml'), sitemap);
    console.log('✅ Sitemap generated successfully');
  }
};

export default defineConfig({
  plugins: [
    react(), 
    sitemapPlugin,
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core — أساس التطبيق
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/scheduler/')) {
              return 'vendor';
            }
            // رسوم بيانية
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) {
              return 'charts';
            }
            // حركات
            if (id.includes('framer-motion') || id.includes('popmotion') || id.includes('hey-listen')) {
              return 'animations';
            }
            // أيقونات
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // فيديو مباشر
            if (id.includes('@livekit') || id.includes('livekit-client')) {
              return 'livekit';
            }
            // PDF وتصدير
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('qrcode')) {
              return 'pdf-export';
            }
            // تحقق بيانات
            if (id.includes('zod')) {
              return 'validation';
            }
            // DOMPurify (أمان HTML)
            if (id.includes('dompurify') || id.includes('purify')) {
              return 'security';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  server: {
    port: 3500,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },

});

