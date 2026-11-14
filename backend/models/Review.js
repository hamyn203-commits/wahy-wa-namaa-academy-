const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 1000
  },
  categories: {
    teaching: { type: Number, min: 1, max: 5 },
    patience: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 }
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

ReviewSchema.index({ teacher: 1, createdAt: -1 });
ReviewSchema.index({ student: 1 });
ReviewSchema.index(
  { student: 1, session: 1 },
  { unique: true, partialFilterExpression: { session: { $exists: true, $type: 'objectId' } } }
);

ReviewSchema.statics.updateTeacherRating = async function(teacherId) {
  const teacherObjectId = mongoose.Types.ObjectId.isValid(String(teacherId))
    ? new mongoose.Types.ObjectId(String(teacherId))
    : teacherId;
  const stats = await this.aggregate([
    { $match: { teacher: teacherObjectId, isApproved: true } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  
  const Teacher = mongoose.model('Teacher');
  const result = stats[0] || { average: 0, count: 0 };
  
  await Teacher.findByIdAndUpdate(teacherId, {
    'rating.average': Math.round((result.average || 0) * 10) / 10,
    'rating.count': result.count || 0
  });
};

module.exports = mongoose.model('Review', ReviewSchema);