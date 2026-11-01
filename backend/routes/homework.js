const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Session = require('../models/Session');
const HomeworkSubmission = require('../models/HomeworkSubmission');
const TeacherTask = require('../models/TeacherTask');
const Teacher = require('../models/Teacher');
const objectStorage = require('../services/objectStorage');
const { deleteStoredReference } = require('../utils/storageLifecycle');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { isMockMode } = require('../config/runtime');
const isDBConnected = () => mongoose.connection.readyState === 1;

const externalStorage = process.env.FILE_STORAGE_DRIVER === 'external';
const HOMEWORK_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'homework');

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = HOMEWORK_UPLOAD_ROOT;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: externalStorage ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp3|wav|ogg|m4a|webm|aac|flac/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const isMimeAudio = file.mimetype && file.mimetype.startsWith('audio/');
    const isExtAudio = allowedTypes.test(ext);
    
    if (isExtAudio || isMimeAudio) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (mp3, wav, ogg, m4a, webm, aac)'));
    }
  }
});

function parseSessionHomeworkId(homeworkId) {
  const match = String(homeworkId).match(/^([a-f0-9]{24})-(\d+)$/);
  if (!match) return null;
  return { sessionId: match[1], index: Number(match[2]) };
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
  const allowedRoot = path.resolve(process.cwd(), 'uploads', 'homework');
  if (!absolute.startsWith(allowedRoot + path.sep)) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (!fs.existsSync(absolute)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absolute);
}

async function teacherProfileIdForUser(userId) {
  const teacher = await Teacher.findOne({ user: userId }).select('_id');
  return teacher?._id || null;
}

router.get('/student', protect, authorize('student'), async (req, res) => {
  try {
    const isDBConnected = () => mongoose.connection.readyState === 1;
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json({ homework: [] });
    }

    const sessions = await Session.find({
      student: req.user.id,
      status: 'completed',
      'teacherEvaluation.assignedHomework.0': { $exists: true },
    }).select('teacherEvaluation.assignedHomework');

    const sessionHomeworkIds = [];
    const homework = [];

    sessions.forEach((session) => {
      if (session.teacherEvaluation?.assignedHomework) {
        session.teacherEvaluation.assignedHomework.forEach((hw, index) => {
          const id = `${session._id}-${index}`;
          sessionHomeworkIds.push(id);
          homework.push({
            _id: id,
            sessionId: session._id,
            title: hw.type === 'memorization' ? 'حفظ' :
              hw.type === 'review-recent' ? 'مراجعة قريبة' :
              hw.type === 'review-far' ? 'مراجعة بعيدة' :
              hw.type === 'review' ? 'مراجعة' :
              hw.type === 'audio' ? 'تسجيل صوتي' : 'اختبار',
            description: hw.description,
            dueDate: hw.dueDate,
            status: hw.status || 'pending',
            type: hw.type,
          });
        });
      }
    });

    if (sessionHomeworkIds.length) {
      const subs = await HomeworkSubmission.find({
        student: req.user.id,
        homeworkId: { $in: sessionHomeworkIds },
      }).select('homeworkId status');
      const subObjMap = Object.fromEntries(subs.map((s) => [s.homeworkId, s]));
      const subMap = Object.fromEntries(subs.map((s) => [s.homeworkId, s.status]));
      homework.forEach((hw) => {
        if (subMap[hw._id]) { hw.status = subMap[hw._id] === 'submitted' ? 'submitted' : hw.status; hw.submissionId = subObjMap[hw._id]?._id; }
      });
    }

    const tasks = await TeacherTask.find({ student: req.user.id }).sort({ createdAt: -1 });
    tasks.forEach((t) => {
      homework.push({
        _id: t._id,
        sessionId: t.session,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        status: t.status,
        type: t.type,
        teacherFeedback: t.teacherFeedback || '',
        reviewedAt: t.reviewedAt,
        isTask: true,
      });
    });

    res.json({ homework });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/submissions/:id/file', protect, async (req, res) => {
  try {
    const submission = await HomeworkSubmission.findById(req.params.id).select('student sessionId filePath');
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    let allowed = req.user.role === 'admin' || String(submission.student) === String(req.user.id);

    if (!allowed && req.user.role === 'teacher') {
      const teacherId = await teacherProfileIdForUser(req.user.id);
      allowed = Boolean(teacherId && await Session.exists({ _id: submission.sessionId, teacher: teacherId }));
    }

    if (!allowed) return res.status(403).json({ error: 'Not authorized to access this file' });

    if (req.user.role === 'admin') {
      await logAdminAction({
        req,
        action: 'student.homework-submission.viewed',
        entityType: 'student',
        entityId: submission.student,
        reason: String(req.query.reason || 'student-360-review'),
        metadata: { submissionId: String(submission._id), sessionId: String(submission.sessionId || '') },
      });
    }

    return streamPrivateFile(res, req, submission.filePath);
  } catch (error) {
    console.error('Homework file download failed:', error.message);
    return res.status(500).json({ error: 'Failed to load file' });
  }
});

router.get('/tasks/:id/file', protect, async (req, res) => {
  try {
    const task = await TeacherTask.findById(req.params.id).select('student teacher submissionFile');
    if (!task || !task.submissionFile) return res.status(404).json({ error: 'Submission file not found' });

    let allowed = req.user.role === 'admin' || String(task.student) === String(req.user.id);

    if (!allowed && req.user.role === 'teacher') {
      const teacherId = await teacherProfileIdForUser(req.user.id);
      allowed = Boolean(teacherId && String(task.teacher) === String(teacherId));
    }

    if (!allowed) return res.status(403).json({ error: 'Not authorized to access this file' });

    if (req.user.role === 'admin') {
      await logAdminAction({
        req,
        action: 'student.homework-audio.viewed',
        entityType: 'student',
        entityId: task.student,
        reason: String(req.query.reason || 'student-360-review'),
        metadata: { taskId: String(task._id), teacherId: String(task.teacher || '') },
      });
    }

    return streamPrivateFile(res, req, task.submissionFile);
  } catch (error) {
    console.error('Task file download failed:', error.message);
    return res.status(500).json({ error: 'Failed to load file' });
  }
});

router.delete('/submissions/:id', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const submission = await HomeworkSubmission.findById(req.params.id)
      .select('student sessionId homeworkId filePath');

    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    if (req.user.role === 'student' && String(submission.student) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to delete this submission' });
    }

    await deleteStoredReference({
      reference: submission.filePath,
      purpose: 'homework',
      owner: submission.student,
      localRoot: HOMEWORK_UPLOAD_ROOT,
    });

    await submission.deleteOne();

    const parsed = parseSessionHomeworkId(submission.homeworkId);
    if (parsed) {
      const session = await Session.findOne({
        _id: parsed.sessionId,
        student: submission.student,
      });

      const homework = session?.teacherEvaluation?.assignedHomework?.[parsed.index];
      if (homework) {
        homework.status = 'pending';
        await session.save();
      }
    }

    return res.json({ success: true, message: 'Homework submission deleted' });
  } catch (error) {
    console.error('Homework submission delete failed:', error.message);
    return res.status(500).json({ error: 'Failed to delete homework submission' });
  }
});

router.delete('/tasks/:id/submission', protect, authorize('student', 'admin'), async (req, res) => {
  try {
    const task = await TeacherTask.findById(req.params.id).select('student submissionFile status');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.submissionFile) return res.status(404).json({ error: 'Submission file not found' });

    if (req.user.role === 'student' && String(task.student) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized to delete this submission' });
    }

    await deleteStoredReference({
      reference: task.submissionFile,
      purpose: 'homework',
      owner: task.student,
      localRoot: HOMEWORK_UPLOAD_ROOT,
    });

    task.submissionFile = '';
    task.status = 'pending';
    await task.save();

    return res.json({ success: true, message: 'Task submission deleted' });
  } catch (error) {
    console.error('Task submission delete failed:', error.message);
    return res.status(500).json({ error: 'Failed to delete task submission' });
  }
});

router.post('/:homeworkId/submit', protect, authorize('student'), upload.single('submission'), async (req, res) => {
  try {
    const { homeworkId } = req.params;
    const directFile = req.body?.storageFile && typeof req.body.storageFile === 'object'
      ? req.body.storageFile
      : null;

    if (externalStorage && req.file) {
      return res.status(400).json({
        error: 'Direct object-storage upload is required',
        code: 'DIRECT_UPLOAD_REQUIRED'
      });
    }

    if (directFile) {
      const reference = directFile.url || directFile.pathname;
      const validReference =
        Boolean(reference) &&
        objectStorage.referenceMatches(reference, 'homework', req.user.id) &&
        (objectStorage.getDriver() !== 'vercel-blob' || objectStorage.isVercelBlobReference(reference));

      if (!validReference) {
        return res.status(400).json({ error: 'Invalid homework upload reference' });
      }
    }

    const submittedFile = directFile
      ? {
          path: directFile.url || directFile.pathname,
          originalname: directFile.name || 'submission',
          size: Number(directFile.size || 0),
          mimetype: directFile.contentType || 'application/octet-stream',
        }
      : req.file;

    if (!submittedFile) {
      if (isMockMode && !isDBConnected() || String(homeworkId).startsWith('mock-')) {
        return res.json({
          success: true,
          message: 'تم تسليم الواجب بنجاح',
          submission: {
            homeworkId,
            notes: req.body?.notes || 'تم تسليم الواجب',
            audioUrl: '/uploads/homework/mock-audio.mp3',
            fileName: 'submission.mp3',
            fileSize: 1024,
            status: 'submitted',
            submittedAt: new Date()
          }
        });
      }
      return res.status(400).json({ error: 'Please upload an audio file' });
    }

    if (!isDBConnected() || !mongoose.Types.ObjectId.isValid(req.user.id) || String(homeworkId).startsWith('mock-')) {
      return res.json({
        success: true,
        message: 'تم تسليم الواجب الصوتي بنجاح',
        submission: {
          homeworkId,
          audioUrl: `/uploads/homework/${path.basename(submittedFile.path)}`,
          fileName: submittedFile.originalname,
          fileSize: submittedFile.size,
          status: 'submitted',
          submittedAt: new Date()
        }
      });
    }

    if (mongoose.Types.ObjectId.isValid(homeworkId)) {
      const task = await TeacherTask.findOne({ _id: homeworkId, student: req.user.id });
      if (task) {
        if (task.submissionFile) {
          return res.status(409).json({
            error: 'A submission already exists. Delete it before uploading a replacement.',
            code: 'SUBMISSION_EXISTS'
          });
        }

        if (!['pending', 'submitted'].includes(task.status)) {
          return res.status(400).json({ error: 'This task no longer accepts submissions' });
        }

        task.status = 'submitted';
        task.submissionFile = submittedFile.path;
        await task.save();

        return res.json({ success: true, message: 'تم تسليم الواجب', task });
      }
    }

    const parsed = parseSessionHomeworkId(homeworkId);
    if (parsed) {
      const session = await Session.findOne({ _id: parsed.sessionId, student: req.user.id });
      if (!session?.teacherEvaluation?.assignedHomework?.[parsed.index]) {
        return res.status(404).json({ error: 'Homework not found' });
      }

      const existing = await HomeworkSubmission.findOne({ homeworkId, student: req.user.id });
      if (existing) {
        return res.status(400).json({ error: 'تم تسليم هذا الواجب مسبقاً' });
      }

      const submission = await HomeworkSubmission.create({
        homeworkId,
        sessionId: parsed.sessionId,
        student: req.user.id,
        filePath: submittedFile.path,
        fileName: submittedFile.originalname,
        fileSize: submittedFile.size,
      });

      session.teacherEvaluation.assignedHomework[parsed.index].status = 'submitted';
      await session.save();

      return res.json({
        success: true,
        message: 'تم تسليم الواجب بنجاح',
        submission,
      });
    }

    const sessionId = req.body.sessionId;
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ error: 'Invalid homework reference' });
    }

    const ownedSession = await Session.findOne({ _id: sessionId, student: req.user.id }).select('_id');
    if (!ownedSession) {
      return res.status(403).json({ error: 'This session does not belong to the authenticated student' });
    }

    const submission = await HomeworkSubmission.create({
      homeworkId,
      sessionId,
      student: req.user.id,
      filePath: submittedFile.path,
      fileName: submittedFile.originalname,
      fileSize: submittedFile.size,
    });

    res.json({
      success: true,
      message: 'Homework submitted successfully',
      submission,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;