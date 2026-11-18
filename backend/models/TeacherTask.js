const mongoose = require('mongoose');

const TeacherTaskSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
  circle: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupCircle' },
  type: {
    type: String,
    enum: ['memorization', 'review-recent', 'review-far', 'audio', 'test'],
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: Date },
  status: { type: String, enum: ['pending', 'submitted', 'done'], default: 'pending' },
  submissionFile: { type: String, default: '' },
  teacherFeedback: { type: String, default: '', trim: true },
  teacherFeedbackAudio: { type: String, default: '', select: false },
  hasTeacherFeedbackAudio: { type: Boolean, default: false },
  teacherFeedbackDuration: { type: Number, min: 0, max: 300 },
  reviewedAt: { type: Date },
}, { timestamps: true });

TeacherTaskSchema.index({ teacher: 1, createdAt: -1 });
TeacherTaskSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('TeacherTask', TeacherTaskSchema);
