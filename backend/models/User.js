const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { normalizePhone } = require('../utils/phone');

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-]{10,}$/, 'Please provide a valid phone number']
  },
  phoneNormalized: {
    type: String,
    trim: true,
    select: false,
    index: true,
  },
  role: { 
    type: String, 
    enum: ['student', 'teacher', 'admin', 'guardian', 'supervisor'],
    default: 'student'
  },
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  guardianContact: {
    name: { type: String, trim: true, maxlength: 100, default: '' },
    phone: { type: String, trim: true, default: '' },
    relationship: { type: String, enum: ['', 'father', 'mother', 'guardian', 'other'], default: '' },
  },
  onboarding: {
    required: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    notes: { type: String, maxlength: 500, default: '' },
    teacherApplicationReady: { type: Boolean, default: false },
    trackSelected: { type: Boolean, default: false },
  },
  googleSubject: { type: String, unique: true, sparse: true, select: false },
  whatsappPhone: {
    type: String,
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female']
  },
  // The selected learning division is independent of a parent's role or children's genders.
  // Legacy students without this value may still select either division at checkout.
  enrollmentSection: {
    type: String,
    enum: ['men_children', 'ladies'],
    default: undefined,
  },
  age: {
    type: Number,
    min: 4,
    max: 100
  },
  memorizedJuz: { type: Number, min: 0, max: 30, default: 0 },
  memorizationDetails: { type: String, trim: true, maxlength: 500, default: '' },
  customLevel: { type: String, trim: true, maxlength: 120, default: '' },
  currentLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'ijazah'],
    default: 'beginner'
  },
  preferredTrack: {
    type: String,
    enum: ['memorization', 'tajweed_ijazah', 'kids_foundation'],
    default: 'memorization'
  },
  circle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupCircle'
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  refreshTokenVersion: { type: Number, default: 0, select: false },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, default: null, select: false },
  lastLogin: Date,
  pushToken: String,
  pushPlatform: String,
  telegramId: String,
  referralCode: { type: String, unique: true, sparse: true, uppercase: true },
  guardianLinkCode: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    select: false
  },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  preferences: {
    language: { type: String, default: 'ar', enum: ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'] },
    currency: { type: String, default: 'SAR', enum: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'PKR', 'IDR'] },
    timezone: { type: String, default: 'Asia/Riyadh' },
    market: { type: String, default: 'arab-world' },
    theme: { type: String, default: 'light', enum: ['light', 'dark'] },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      telegram: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  }
}, { timestamps: true });

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

UserSchema.pre('save', async function(next) {
  if (this.isModified('phone')) {
    this.phoneNormalized = normalizePhone(this.phone) || undefined;
  }

  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.generateEmailVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

UserSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.refreshTokenVersion;
  delete obj.failedLoginAttempts;
  delete obj.lockUntil;
  delete obj.guardianLinkCode;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
