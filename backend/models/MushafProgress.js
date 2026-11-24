'use strict';

const mongoose = require('mongoose');

const MushafAnnotationSchema = new mongoose.Schema(
  {
    surahNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 114,
    },
    surahName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    ayahNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 286,
    },
    wordText: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    type: {
      type: String,
      enum: ['memorization', 'tajweed', 'tashkeel'],
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 400,
      default: '',
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    teacherName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const KhatmahJuzSchema = new mongoose.Schema(
  {
    juzNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'memorized', 'mastered'],
      default: 'not_started',
    },
    certifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    certifiedByName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const MushafProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    khatmahJuz: {
      type: [KhatmahJuzSchema],
      default: [],
    },
    annotations: {
      type: [MushafAnnotationSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MushafProgress', MushafProgressSchema);
