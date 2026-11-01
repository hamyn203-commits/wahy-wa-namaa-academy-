const mongoose = require('mongoose');

const TeacherUpdateVideoSchema = new mongoose.Schema({
  reference: { type: String, required: true, trim: true },
  name: { type: String, default: '', trim: true },
  size: { type: Number, default: 0, min: 0 },
  contentType: { type: String, default: 'video/mp4', trim: true },
}, { _id: false });

const TeacherUpdateSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    index: true,
  },
  teacherUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140,
  },
  message: {
    type: String,
    default: '',
    trim: true,
    maxlength: 2000,
  },
  videos: {
    type: [TeacherUpdateVideoSchema],
    validate: {
      validator: (items) => !items || (Array.isArray(items) && items.length <= 5),
      message: 'Teacher update can contain up to 5 videos',
    },
  },
  audience: {
    mode: {
      type: String,
      enum: ['all-active', 'selected'],
      default: 'all-active',
    },
    students: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  isPublished: { type: Boolean, default: true, index: true },
  publishedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

TeacherUpdateSchema.index({ teacher: 1, publishedAt: -1 });
TeacherUpdateSchema.index({ 'audience.students': 1, isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('TeacherUpdate', TeacherUpdateSchema);
