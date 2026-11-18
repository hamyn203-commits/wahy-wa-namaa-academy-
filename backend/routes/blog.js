const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const { protect, authorize } = require('../middleware/auth');
const { isMockMode } = require('../config/runtime');

const isDBConnected = () => mongoose.connection.readyState === 1;

const pickLocalized = (doc, locale = 'ar') => {
  const get = (field) => field?.[locale] || field?.ar || field?.en || '';
  return {
    _id: doc._id,
    slug: doc.slug,
    title: get(doc.title),
    excerpt: get(doc.excerpt),
    content: get(doc.content),
    metaTitle: get(doc.seo?.metaTitle),
    metaDescription: get(doc.seo?.metaDescription),
    keywords: Array.isArray(doc.seo?.keywords) ? doc.seo.keywords : [],
    coverImage: doc.coverImage,
    category: doc.category,
    tags: doc.tags,
    authorName: doc.authorName,
    readTime: doc.readTime,
    featured: doc.featured,
    views: doc.views,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const ALLOWED_BLOG_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);
const escapeRegex = (s) => String(s || '').slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALLOWED_BLOG_FIELDS = [
  'slug',
  'title',
  'excerpt',
  'content',
  'seo',
  'coverImage',
  'category',
  'tags',
  'authorName',
  'readTime',
  'featured',
  'status',
];

function sanitizeBlogPayload(body = {}) {
  const out = {};
  for (const field of ALLOWED_BLOG_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      out[field] = body[field];
    }
  }
  return out;
}

router.get('/', async (req, res) => {
  try {
    const { locale: rawLocale = 'ar', category, search, page = 1, limit = 12, featured } = req.query;
    const locale = ALLOWED_BLOG_LOCALES.has(String(rawLocale)) ? String(rawLocale) : 'ar';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const filter = { status: 'published' };
    if (category) filter.category = String(category).trim().slice(0, 60);
    if (featured === 'true') filter.featured = true;
    if (search && String(search).trim()) {
      const escaped = escapeRegex(String(search).trim());
      filter.$or = [
        { [`title.${locale}`]: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
      ];
    }

    const skip = (pageNum - 1) * limitNum;
    if (isMockMode && !isDBConnected()) {
      return res.json({
        posts: [],
        pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
      });
    }
    const [posts, total] = await Promise.all([
      Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Blog.countDocuments(filter),
    ]);

    res.json({
      posts: posts.map((p) => pickLocalized(p, locale)),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const rawLocale = String(req.query.locale || 'ar');
    const locale = ALLOWED_BLOG_LOCALES.has(rawLocale) ? rawLocale : 'ar';
    if (isMockMode && !isDBConnected()) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const post = await Blog.findOneAndUpdate(
      { slug: String(req.params.slug || '').trim().slice(0, 180), status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(pickLocalized(post, locale));
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error, 500) });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const post = await Blog.create(sanitizeBlogPayload(req.body || {}));
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;
