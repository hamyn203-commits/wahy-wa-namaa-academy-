const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Session = require('../models/Session');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');

const isDBConnected = () => mongoose.connection.readyState === 1;
const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(id));

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isDBConnected()) {
      return res.json([]);
    }
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const students = await Student.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err, 500) });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student profile id' });
    }
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
    const studentUserId = student.user ? String(student.user) : null;
    let allowed = req.user.role === 'admin';

    if (req.user.role === 'student') {
      allowed = studentUserId === String(req.user.id);
    } else if (req.user.role === 'guardian' && studentUserId) {
      const guardian = await Guardian.findOne({
        user: req.user.id,
        isActive: { $ne: false },
        'children.student': studentUserId,
      }).select('children isActive');

      allowed = Boolean(
        guardian && guardian.hasPermission(studentUserId, 'viewProgress')
      );
    } else if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user.id }).select('_id');
      if (teacher && studentUserId) {
        allowed = Boolean(await Session.exists({
          teacher: teacher._id,
          student: studentUserId,
          status: { $in: ['accepted', 'completed'] }
        }));
      }
    }

    if (!allowed) {
      return res.status(403).json({ error: 'غير مصرح بالوصول إلى بيانات هذا الطالب' });
    }

    res.json(student);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err, 500) });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  const allowedAdminFields = ['user', 'name', 'age', 'plan', 'currentSurah', 'memorizedAyahs', 'points', 'streak', 'level', 'dailyHabits'];
  const payload = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) => allowedAdminFields.includes(key))
  );
  const student = new Student(payload);
  try {
    const newStudent = await student.save();
    logAdminAction({
      adminId: req.user.id,
      action: 'student.create',
      targetType: 'Student',
      targetId: newStudent._id,
      req,
    }).catch(() => {});
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err, 400) });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student profile id' });
    }
    const existingStudent = await Student.findById(req.params.id);
    if (!existingStudent) return res.status(404).json({ message: 'Student not found' });

    // Only admin or the owning student can update; non-admin roles may only update dailyHabits
    if (req.user.role !== 'admin' && (!existingStudent.user || existingStudent.user.toString() !== String(req.user.id))) {
      return res.status(403).json({ error: 'غير مصرح بتعديل بيانات هذا الطالب' });
    }

    let updates = { ...(req.body || {}) };
    if (req.user.role !== 'admin') {
      const allowedSelfFields = ['dailyHabits'];
      updates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedSelfFields.includes(key))
      );
    } else {
      const allowedAdminFields = ['name', 'age', 'plan', 'currentSurah', 'memorizedAyahs', 'points', 'streak', 'level', 'dailyHabits'];
      updates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedAdminFields.includes(key))
      );
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (req.user.role === 'admin') {
      logAdminAction({
        adminId: req.user.id,
        action: 'student.update',
        targetType: 'Student',
        targetId: student._id,
        metadata: { fields: Object.keys(updates) },
        req,
      }).catch(() => {});
    }
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err, 400) });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid student profile id' });
    }
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    logAdminAction({
      adminId: req.user.id,
      action: 'student.delete',
      targetType: 'Student',
      targetId: student._id,
      req,
    }).catch(() => {});
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err, 500) });
  }
});

module.exports = router;
