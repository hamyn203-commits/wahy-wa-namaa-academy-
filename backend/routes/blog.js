const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect, authorize } = require('../middleware/auth');

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

router.get('/', async (req, res) => {
  try {
    const { locale = 'ar', category, search, page = 1, limit = 12, featured } = req.query;
    const filter = { status: 'published' };
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (search) {
      filter.$or = [
        { [`title.${locale}`]: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [posts, total] = await Promise.all([
      Blog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Blog.countDocuments(filter),
    ]);

    res.json({
      posts: posts.map((p) => pickLocalized(p, locale)),
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { locale = 'ar' } = req.query;
    const post = await Blog.findOneAndUpdate(
      { slug: req.params.slug, status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(pickLocalized(post, locale));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const post = await Blog.create(req.body);
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
