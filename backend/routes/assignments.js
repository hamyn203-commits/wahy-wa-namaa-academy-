const { safeErrorMessage } = require('../utils/safeError');
const express = require('express');
const router = express.Router();
const { Assignment, AssignmentSubmission } = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const Teacher = require('../models/Teacher');
const objectStorage = require('../services/objectStorage');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const { protect, authorize, attachTeacherProfile } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const externalStorage = process.env.FILE_STORAGE_DRIVER === 'external';
const ASSIGNMENT_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'assignments');

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/assignments');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: externalStorage ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|mp3|mp4|wav|ogg|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

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

    res.setHeader('Content-Type', result.blob?.contentType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
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

  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absolute);
}

// @route   GET /api/assignments
// @desc    Get all assignments for a course
// @access  Private
router.get('/', protect, attachTeacherProfile, authorize('student', 'teacher', 'admin'), async (req, res) => {
  try {
    const { courseId, status = 'published' } = req.query;
    const filter = { status };

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
    const assignmentData = {
      ...req.body,
      instructor: req.user.role === 'teacher' ? req.user.teacherProfile : req.body.instructor
    };

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

    if (req.user.role === 'teacher' && assignment.instructor.toString() !== req.user.teacherProfile.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    Object.assign(assignment, req.body);
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

    if (req.user.role === 'teacher' && assignment.instructor.toString() !== req.user.teacherProfile.toString()) {
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

    if (!assignment) {
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
      const validReference =
        Boolean(reference) &&
        objectStorage.referenceMatches(reference, 'assignment', req.user.id) &&
        (objectStorage.getDriver() !== 'vercel-blob' || objectStorage.isVercelBlobReference(reference));

      if (!validReference) {
        return res.status(400).json({ error: 'Invalid assignment upload reference' });
      }

      submissionData.content.file = {
        name: directFile.name || 'submission',
        url: reference,
        type: directFile.contentType || 'application/octet-stream',
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
      submissionData.content.file = {
        name: req.file.originalname,
        url: req.file.path,
        type: req.file.mimetype,
        size: req.file.size
      };
      submissionData.submissionType = 'file';
    } else if (req.body.text) {
      submissionData.content.text = req.body.text;
    } else if (req.body.url) {
      submissionData.content.url = req.body.url;
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
      .select('assignment student content.file');

    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (req.user.role === 'student' && String(submission.student) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to delete this submission' });
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
      .populate('student', 'name email')
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

    submission.grade = {
      score,
      maxScore: submission.assignment.points,
      percentage: (score / submission.assignment.points) * 100,
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