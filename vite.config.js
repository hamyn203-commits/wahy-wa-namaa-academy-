import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { emitStaticSeoAssets } from './src/seo/staticHtmlGenerator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin لإنشاء sitemaps وملفات HTML الثابتة لكل مسار ولغة أثناء البناء
const seoBuildPlugin = {
  name: 'seo-static-build-generator',
  closeBundle() {
    const distPath = resolve(__dirname, 'dist');
    const templateHtml = readFileSync(resolve(distPath, 'index.html'), 'utf8');
    const { generatedPages } = emitStaticSeoAssets(distPath, templateHtml);
    console.log(`✅ Generated sitemap index, static sitemap, and ${generatedPages} localized HTML routes`);
  },
};

export default defineConfig({
  plugins: [
    react(), 
    seoBuildPlugin,
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

