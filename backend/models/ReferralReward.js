const mongoose = require('mongoose');

const ReferralRewardSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referral: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral' },
  type: { type: String, enum: ['signup', 'first_session', 'milestone'], default: 'signup' },
  points: { type: Number, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

ReferralRewardSchema.index({ user: 1 });
ReferralRewardSchema.index(
  { referral: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      referral: { $type: 'objectId' },
    },
  }
);

module.exports = mongoose.model('ReferralReward', ReferralRewardSchema);
