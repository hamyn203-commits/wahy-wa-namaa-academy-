const mongoose = require('mongoose');

const localizedField = {
  ar: { type: String, default: '' },
  en: { type: String, default: '' },
  fr: { type: String, default: '' },
  de: { type: String, default: '' },
  tr: { type: String, default: '' },
  ur: { type: String, default: '' },
  id: { type: String, default: '' },
  ms: { type: String, default: '' },
};

const blogSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true },
  title: localizedField,
  excerpt: localizedField,
  content: localizedField,
  coverImage: String,
  category: { type: String, default: 'general' },
  tags: [String],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  readTime: { type: Number, default: 5 },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  seo: {
    metaTitle: localizedField,
    metaDescription: localizedField,
    keywords: [String],
  },
}, { timestamps: true });

blogSchema.index({ status: 1, createdAt: -1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ 'title.ar': 'text', 'title.en': 'text', tags: 'text' });

module.exports = mongoose.model('Blog', blogSchema);
