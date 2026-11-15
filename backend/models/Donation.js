const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  amount: { type: Number, required: true, min: 1 },
  amountMinor: { type: Number, min: 100 },
  currency: { type: String, default: 'USD', enum: ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'] },
  category: {
    type: String,
    enum: ['student', 'teacher', 'halaqa', 'general'],
    default: 'general',
  },
  message: { type: String, maxlength: 500 },
  isAnonymous: { type: Boolean, default: false },
  status: { type: String, enum: ['pledged', 'confirmed', 'cancelled'], default: 'pledged' },
  paymentReference: { type: String, trim: true, maxlength: 120 },
  confirmedAt: { type: Date },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

DonationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Donation', DonationSchema);
