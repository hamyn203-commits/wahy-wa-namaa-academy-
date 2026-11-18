const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const { Assignment, AssignmentSubmission } = require('../models/Assignment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Teacher = require('../models/Teacher');
const objectStorage = require('../services/objectStorage');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const { PURPOSES, normalizeContentType } = require('../config/uploadPolicy');
const { validateMagicBytes } = require('../utils/magicBytes');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const externalStorage =
  process.env.FILE_STORAGE_DRIVER === 'external' ||
  ['vercel-blob', 's3'].includes(objectStorage.getDriver());
const ASSIGNMENT_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'assignments');

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(ASSIGNMENT_UPLOAD_ROOT)) {
      fs.mkdirSync(ASSIGNMENT_UPLOAD_ROOT, { recursive: true });
    }
    cb(null, ASSIGNMENT_UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const cleanExt = path.extname(String(file.originalname || '')).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, uniqueSuffix + cleanExt);
  }
});

const upload = multer({
  storage: externalStorage ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = new Set(['jpeg', 'jpg', 'png', 'pdf', 'mp3', 'mp4', 'wav', 'webm']);
    const ext = path.extname(String(file.originalname || '')).toLowerCase().replace('.', '');
    const normalizedMime = normalizeContentType(file.mimetype);
    if (allowedExts.has(ext) && PURPOSES.assignment.types.includes(normalizedMime)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

const ALLOWED_ASSIGNMENT_FIELDS = [
  'title',
  'description',
  'course',
  'lesson',
  'type',
  'instructions',
  'dueDate',
  'points',
  'attachments',
  'submissionTypes',
  'maxFileSize',
  'allowedFileTypes',
  'rubric',
  'status',
];

function pickAssignmentFields(source = {}) {
  const out = {};
  for (const key of ALLOWED_ASSIGNMENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  if (Array.isArray(out.attachments)) {
    out.attachments = out.attachments.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const url = String(item.url || '').trim();
      if (!url) return false;
      if (url.startsWith('/uploads/') || url.startsWith('/api/uploads/')) return true;
      return /^https:\/\/[^\s<>"'`\\]+$/i.test(url);
    });
  }
  return out;
}

function safeSubmission(doc) {
  const value = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  if (value?.content?.file?.url) {
    value.content.file.url = `/api/assignments/submissions/${value._id}/file`;
  }
  return value;
}

async function streamPrivateFile(res, req, reference) {
  if (!reference) return res.status(404).json({ error: 'File not found' });

  if (/^https?:\/\//i.test(reference)) {
    const result = await objectStorage.getPrivateObject(reference, {
      ifNoneMatch: req.headers['if-none-match'],
    });

    if (!result) return res.status(404).json({ error: 'File not found' });
    if (result.statusCode === 304) return res.status(304).end();

    const SAFE_PRIVATE_STREAM_TYPES = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'video/mp4',
      'video/webm',
    ]);
    const rawMime = String(result.blob?.contentType || '').split(';', 1)[0].trim().toLowerCase();
    res.setHeader('Content-Type', SAFE_PRIVATE_STREAM_TYPES.has(rawMime) ? rawMime : 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);

    if (result.stream?.pipe) return result.stream.pipe(res);
    const reader = result.stream?.getReader?.();
    if (!reader) return res.status(404).json({ error: 'File not found' });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  }

  const absolute = path.resolve(reference);
  const allowedRoot = path.resolve(process.cwd(), 'uploads', 'assignments');
  if (!absolute.startsWith(allowedRoot + path.sep)) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (!fs.existsSync(absolute)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absolute);
}

// @route   GET /api/assignments
// @desc    Get all assignments for a course
// @access  Private
router.get('/', protect, attachTeacherProfile, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    const { courseId, status = 'published' } = req.query;
    const allowedStatuses = ['draft', 'published', 'archived'];
    const safeStatus = allowedStatuses.includes(status) ? status : 'published';
    const filter = { status: req.user.role === 'student' ? 'published' : safeStatus };

    if (req.user.role === 'student') {
      const enrollmentFilter = {
        student: req.user.id,
        status: { $in: ['active', 'completed'] }
      };
      if (courseId) enrollmentFilter.course = courseId;

      const enrollments = await Enrollment.find(enrollmentFilter).select('course');
      const courseIds = enrollments.map((enrollment) => enrollment.course);

      if (!courseIds.length) return res.json([]);
      filter.course = { $in: courseIds };
    } else if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile) {
        return res.status(403).json({ error: 'Teacher profile is required' });
      }
      filter.instructor = req.user.teacherProfile;
      if (courseId) filter.course = courseId;
    } else if (courseId) {
      filter.course = courseId;
    }

    const assignments = await Assignment.find(filter)
      .populate('instructor', 'personalInfo.fullName user')
      .sort({ dueDate: 1 });

    res.json(assignments);
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// @route   GET /api/assignments/my-submissions
// @desc    Get all submissions for the current user
// @access  Private
router.get('/my-submissions', protect, authorize('student'), async (req, res) => {
  try {
    const submissions = await AssignmentSubmission.find({ student: req.user.id })
      .populate({
        path: 'assignment',
        populate: { path: 'course', select: 'title' }
      })
      .sort({ submittedAt: -1 });

    res.json(submissions.map(safeSubmission));
  } catch (error) {
    console.error('Get my submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// @route   GET /api/assignments/:id
// @desc    Get a single assignment
// @access  Private
router.get('/:id', protect, attachTeacherProfile, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('instructor', 'personalInfo.fullName user')
      .populate('course', 'title');

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (req.user.role === 'student') {
      if (assignment.status !== 'published') {
        return res.status(404).json({ error: 'Assignment not found' });
      }
      const enrollment = await Enrollment.exists({
        student: req.user.id,
        course: assignment.course?._id || assignment.course,
        status: { $in: ['active', 'completed'] }
      });
      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }
    }

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(assignment.instructor?._id || assignment.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized to access this assignment' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// @route   POST /api/assignments
// @desc    Create a new assignment
// @access  Private (Teacher/Admin)
router.post('/', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      if (!req.user.teacherProfile) {
        return res.status(403).json({ error: 'Teacher profile is required' });
      }
      const ownsCourse = await Course.exists({
        _id: req.body?.course,
        instructor: req.user.teacherProfile,
      });
      if (!ownsCourse) {
        return res.status(403).json({ error: 'You can only create assignments for your own courses' });
      }
    } else if (!await Course.exists({ _id: req.body?.course })) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const assignmentData = {
      ...pickAssignmentFields(req.body || {}),
      instructor: req.user.role === 'teacher' ? req.user.teacherProfile : req.body?.instructor
    };
    if (assignmentData.status === 'published') {
      assignmentData.publishedAt = new Date();
    }

    const assignment = new Assignment(assignmentData);
    await assignment.save();

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   PUT /api/assignments/:id
// @desc    Update an assignment
// @access  Private (Teacher/Admin)
router.put('/:id', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    if (externalStorage && req.file) {
      return res.status(503).json({ error: 'External file storage is not configured yet', code: 'FILE_STORAGE_NOT_READY' });
    }

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (req.user.role === 'teacher' && assignment.instructor.toString() !== String(req.user.teacherProfile || '')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = pickAssignmentFields(req.body || {});
    if (req.user.role === 'teacher') {
      if (updates.course && String(updates.course) !== String(assignment.course)) {
        const ownsTargetCourse = await Course.exists({
          _id: updates.course,
          instructor: req.user.teacherProfile,
        });
        if (!ownsTargetCourse) {
          return res.status(403).json({ error: 'You can only move assignments to your own courses' });
        }
      }
    } else if (req.body?.instructor) {
      updates.instructor = req.body.instructor;
    }

    if (updates.status === 'published' && assignment.status !== 'published') {
      updates.publishedAt = new Date();
    }

    Object.assign(assignment, updates);
    await assignment.save();

    res.json(assignment);
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

// @route   DELETE /api/assignments/:id
// @desc    Delete an assignment
// @access  Private (Teacher/Admin)
router.delete('/:id', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (req.user.role === 'teacher' && assignment.instructor.toString() !== String(req.user.teacherProfile || '')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const hasSubmissions = await AssignmentSubmission.exists({ assignment: assignment._id });
    if (hasSubmissions) {
      return res.status(409).json({
        error: 'Delete assignment submissions before deleting the assignment',
        code: 'ASSIGNMENT_HAS_SUBMISSIONS'
      });
    }

    await assignment.deleteOne();

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// @route   POST /api/assignments/:id/submit
// @desc    Submit an assignment
// @access  Private (Student)
router.post('/:id/submit', protect, authorize('student'), upload.single('file'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment || assignment.status !== 'published') {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user.id,
      course: assignment.course,
      status: 'active'
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    if (assignment.allowLateSubmission === false && assignment.dueDate && new Date() > new Date(assignment.dueDate)) {
      return res.status(400).json({
        error: 'Assignment submission deadline has passed',
        code: 'ASSIGNMENT_DEADLINE_PASSED',
      });
    }

    const existingSubmission = await AssignmentSubmission.findOne({
      assignment: req.params.id,
      student: req.user.id
    });

    if (existingSubmission) {
      return res.status(400).json({ error: 'Assignment already submitted' });
    }

    const submissionData = {
      assignment: req.params.id,
      student: req.user.id,
      enrollment: enrollment._id,
      submissionType: req.body.submissionType || 'text',
      content: {}
    };

    const directFile = req.body?.storageFile && typeof req.body.storageFile === 'object'
      ? req.body.storageFile
      : null;

    if (directFile) {
      const reference = directFile.url || directFile.pathname;
      const driver = objectStorage.getDriver();
      const validReference =
        Boolean(reference) &&
        objectStorage.referenceMatches(reference, 'assignment', req.user.id) &&
        ((driver !== 'vercel-blob' && driver !== 's3') || objectStorage.isOwnedObjectReference(reference, 'assignment', req.user.id));

      if (!validReference) {
        return res.status(400).json({ error: 'Invalid assignment upload reference' });
      }

      const magicVerify = await objectStorage.verifyUploadedObjectMagicBytes(
        reference,
        directFile.contentType,
        Number(assignment.maxFileSize) || 50 * 1024 * 1024
      );
      if (!magicVerify.ok) {
        return res.status(400).json({ error: magicVerify.error, code: magicVerify.code });
      }

      submissionData.content.file = {
        name: String(directFile.name || 'submission').slice(0, 180),
        url: reference,
        type: String(directFile.contentType || 'application/octet-stream').slice(0, 80),
        size: Number(directFile.size || 0)
      };
      submissionData.submissionType = 'file';
    } else if (req.file) {
      if (externalStorage) {
        return res.status(400).json({
          error: 'Direct object-storage upload is required',
          code: 'DIRECT_UPLOAD_REQUIRED'
        });
      }
      if (req.file.path && fs.existsSync(req.file.path)) {
        const normalizedMime = normalizeContentType(req.file.mimetype);
        const fd = fs.openSync(req.file.path, 'r');
        const header = Buffer.alloc(64);
        const bytesRead = fs.readSync(fd, header, 0, 64, 0);
        fs.closeSync(fd);
        const magicCheck = validateMagicBytes(header.subarray(0, bytesRead), normalizedMime);
        if (!magicCheck.valid) {
          try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
          return res.status(400).json({ error: 'Invalid assignment file signature', code: 'INVALID_FILE_MAGIC_BYTES' });
        }
      }
      submissionData.content.file = {
        name: req.file.originalname,
        url: req.file.path,
        type: req.file.mimetype,
        size: req.file.size
      };
      submissionData.submissionType = 'file';
    } else if (typeof req.body.text === 'string' && req.body.text.trim()) {
      submissionData.content.text = req.body.text.trim().slice(0, 20000);
      submissionData.submissionType = 'text';
    } else if (typeof req.body.url === 'string' && req.body.url.trim()) {
      try {
        const parsed = new URL(req.body.url.trim());
        if (parsed.protocol !== 'https:') throw new Error('https required');
        submissionData.content.url = parsed.toString().slice(0, 1000);
        submissionData.submissionType = 'url';
      } catch {
        return res.status(400).json({ error: 'Submission URL must be a valid HTTPS link' });
      }
    } else {
      return res.status(400).json({
        error: 'Assignment submission must include text, a file, or an HTTPS URL',
        code: 'SUBMISSION_CONTENT_REQUIRED',
      });
    }

    if (
      Array.isArray(assignment.submissionTypes)
      && assignment.submissionTypes.length > 0
      && !assignment.submissionTypes.includes(submissionData.submissionType)
    ) {
      return res.status(400).json({
        error: 'This submission format is not permitted for this assignment',
        code: 'SUBMISSION_TYPE_NOT_ALLOWED',
      });
    }

    const submission = new AssignmentSubmission(submissionData);
    await submission.save();

    assignment.stats.submissions += 1;
    await assignment.save();

    res.status(201).json(submission);
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

router.get('/submissions/:submissionId/file', protect, attachTeacherProfile, async (req, res) => {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId)
      .populate('assignment');

    if (!submission || !submission.content?.file?.url) {
      return res.status(404).json({ error: 'Submission file not found' });
    }

    const isOwner = String(submission.student) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const isTeacherOwner =
      req.user.role === 'teacher' &&
      req.user.teacherProfile &&
      String(submission.assignment?.instructor) === String(req.user.teacherProfile);

    if (!isOwner && !isAdmin && !isTeacherOwner) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }

    return streamPrivateFile(res, req, submission.content.file.url);
  } catch (error) {
    console.error('Assignment file download failed:', error.message);
    return res.status(500).json({ error: 'Failed to load file' });
  }
});

router.delete('/submissions/:submissionId', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId)
      .select('assignment student status content.file');

    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (req.user.role === 'student') {
      if (String(submission.student) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Not authorized to delete this submission' });
      }
      if (['graded', 'returned'].includes(submission.status)) {
        return res.status(400).json({ error: 'Graded submissions cannot be deleted' });
      }
    }

    const reference = submission.content?.file?.url;
    if (reference) {
      await deleteStoredReference({
        reference,
        purpose: 'assignment',
        owner: submission.student,
        localRoot: ASSIGNMENT_UPLOAD_ROOT,
      });
    }

    const assignmentId = submission.assignment;
    await submission.deleteOne();

    await Assignment.updateOne(
      { _id: assignmentId, 'stats.submissions': { $gt: 0 } },
      { $inc: { 'stats.submissions': -1 } }
    );

    return res.json({ success: true, message: 'Assignment submission deleted' });
  } catch (error) {
    console.error('Assignment submission delete failed:', error.message);
    return res.status(500).json({ error: 'Failed to delete assignment submission' });
  }
});

// @route   GET /api/assignments/:id/submissions
// @desc    Get all submissions for an assignment
// @access  Private (Teacher/Admin)
router.get('/:id/submissions', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id).select('instructor');
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(assignment.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const submissions = await AssignmentSubmission.find({ assignment: req.params.id })
      .populate('student', req.user.role === 'admin' ? 'name email avatar' : 'name avatar')
      .sort({ submittedAt: -1 });

    res.json(submissions.map(safeSubmission));
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// @route   PUT /api/assignments/submissions/:submissionId/grade
// @desc    Grade a submission
// @access  Private (Teacher/Admin)
router.put('/submissions/:submissionId/grade', protect, attachTeacherProfile, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const submission = await AssignmentSubmission.findById(req.params.submissionId)
      .populate('assignment');

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (
      req.user.role === 'teacher' &&
      (!req.user.teacherProfile || String(submission.assignment.instructor) !== String(req.user.teacherProfile))
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const maxScore = Math.max(1, Number(submission.assignment.points) || 100);
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > maxScore) {
      return res.status(400).json({ error: `Score must be between 0 and ${maxScore}` });
    }

    submission.grade = {
      score: numericScore,
      maxScore,
      percentage: Math.round((numericScore / maxScore) * 10000) / 100,
      feedback,
      gradedBy: req.user.role === 'teacher' ? req.user.teacherProfile : req.body.gradedBy,
      gradedAt: new Date()
    };
    submission.status = 'graded';
    await submission.save();

    const assignment = await Assignment.findById(submission.assignment._id);
    const allSubmissions = await AssignmentSubmission.find({ 
      assignment: assignment._id, 
      status: 'graded' 
    });
    
    const totalScore = allSubmissions.reduce((sum, sub) => sum + (sub.grade.percentage || 0), 0);
    assignment.stats.averageScore = totalScore / allSubmissions.length;
    assignment.stats.graded = allSubmissions.length;
    await assignment.save();

    res.json(submission);
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(400).json({ error: safeErrorMessage(error, 400) });
  }
});

module.exports = router;