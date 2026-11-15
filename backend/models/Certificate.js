const crypto = require('crypto');
const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  enrollment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Enrollment',
    required: true
  },
  certificateId: {
    type: String,
    required: true,
    unique: true
  },
  qrCode: {
    type: String,
    required: true
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'revoked'],
    default: 'active'
  },
  revokedAt: {
    type: Date
  },
  revocationReason: {
    type: String,
    maxlength: 500
  },
  metadata: {
    completionDate: Date,
    score: Number,
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher'
    },
    duration: Number
  },
  template: {
    type: String,
    default: 'default'
  },
  language: {
    type: String,
    enum: ['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku'],
    default: 'ar'
  }
}, {
  timestamps: true
});

CertificateSchema.index({ certificateId: 1 });
CertificateSchema.index({ student: 1, course: 1 }, { unique: true });
CertificateSchema.index({ status: 1 });

CertificateSchema.statics.generateCertificateId = function() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CERT-${timestamp}-${random}`;
};

CertificateSchema.statics.generateQRCode = async function(verificationUrl) {
  const QRCode = require('qrcode');
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw error;
  }
};

CertificateSchema.methods.verify = function() {
  if (this.status !== 'active') {
    return { valid: false, reason: 'Certificate is not active' };
  }
  
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.status = 'expired';
    if (typeof this.save === 'function') {
      Promise.resolve(this.save()).catch(() => {});
    }
    return { valid: false, reason: 'Certificate has expired' };
  }
  
  return { valid: true };
};

CertificateSchema.methods.revoke = function(reason) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revocationReason = reason;
  return this.save();
};

module.exports = mongoose.model('Certificate', CertificateSchema);
