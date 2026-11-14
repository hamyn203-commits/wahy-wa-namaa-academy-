const mongoose = require('mongoose');

const VerificationCodeSchema = new mongoose.Schema({
  phone: { type: String, index: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  code: { type: String, select: false },
  codeHash: { type: String },
  method: { type: String, enum: ['email', 'whatsapp', 'telegram', 'sms'], required: true },
  expires: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('VerificationCode', VerificationCodeSchema);