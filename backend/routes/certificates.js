const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');
const Enrollment = require('../models/Enrollment');
const { protect, authorize } = require('../middleware/auth');
const { logAdminAction } = require('../services/adminAudit');

const ALLOWED_CERT_LANGUAGES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);
const isValidObjectId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(String(id)));

// @route   POST /api/certificates/generate
// @desc    Generate a certificate for a completed course
// @access  Private
router.post('/generate', protect, async (req, res) => {
  try {
    const { enrollmentId } = req.body || {};
    if (!isValidObjectId(enrollmentId)) {
      return res.status(400).json({ error: 'Invalid enrollment ID' });
    }

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('course')
      .populate('student');

    if (!enrollment || !enrollment.course || !enrollment.student) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    if (enrollment.student._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!enrollment.course.certificate?.enabled) {
      return res.status(400).json({ error: 'Certificates are not enabled for this course' });
    }

    const completedLessonCount = Array.isArray(enrollment.progress?.completedLessons)
      ? enrollment.progress.completedLessons.length
      : 0;
    if (
      enrollment.status !== 'completed' ||
      Number(enrollment.progress?.percentage || 0) < 100 ||
      completedLessonCount === 0
    ) {
      return res.status(400).json({ error: 'Course not completed yet' });
    }

    const certificateStudentId = enrollment.student._id || enrollment.student;

    const existingCert = await Certificate.findOne({
      student: certificateStudentId,
      course: enrollment.course._id
    });

    if (existingCert) {
      return res.status(400).json({ error: 'Certificate already exists' });
    }

    const certificateId = enrollment.certificate?.certificateId || Certificate.generateCertificateId();
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://wahy-wa-namaa-academy.vercel.app'}/verify-certificate/${certificateId}`;
    
    const qrCode = await Certificate.generateQRCode(verificationUrl);
    const language = ALLOWED_CERT_LANGUAGES.has(req.body?.language) ? req.body.language : 'ar';

    const certificate = new Certificate({
      student: certificateStudentId,
      course: enrollment.course._id,
      enrollment: enrollmentId,
      certificateId,
      qrCode,
      metadata: {
        completionDate: enrollment.completedAt,
        score: enrollment.progress.percentage,
        instructor: enrollment.course.instructor,
        duration: enrollment.progress.timeSpent
      },
      language
    });

    await certificate.save();

    enrollment.certificate = {
      issued: true,
      issuedAt: new Date(),
      certificateId,
      qrCode
    };
    await enrollment.save();

    res.status(201).json(certificate);
  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// @route   GET /api/certificates/my-certificates
// @desc    Get all certificates for the current user
// @access  Private
router.get('/my-certificates', protect, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const isDBConnected = () => mongoose.connection.readyState === 1;
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    if (!isDBConnected() || !isValidObjectId(req.user.id)) {
      return res.json([]);
    }

    const certificates = await Certificate.find({ student: req.user.id })
      .populate('course', 'title slug image')
      .sort({ issuedAt: -1 });

    res.json(certificates);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// @route   GET /api/certificates/verify/:certificateId
router.get('/verify/:certificateId', async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId })
      .populate('student', 'name')
      .populate('course', 'title');

    if (!certificate) {
      return res.status(404).json({ valid: false, error: 'Certificate not found' });
    }

    const verification = certificate.verify();
    res.json({
      valid: verification.valid,
      reason: verification.reason || null,
      certificate: {
        id: certificate.certificateId,
        studentName: certificate.student?.name || '',
        courseTitle: certificate.course?.title || null,
        issuedAt: certificate.issuedAt,
        status: certificate.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify certificate' });
  }
});

// @route   GET /api/certificates/:certificateId
// @desc    Get a specific certificate by ID
// @access  Public
router.get('/:certificateId', async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certificateId })
      .populate('student', 'name')
      .populate('course', 'title slug')
      .populate('metadata.instructor', 'name');

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const verification = certificate.verify();

    res.json({
      certificate: {
        certificateId: certificate.certificateId,
        student: certificate.student ? { name: certificate.student.name } : null,
        course: certificate.course
          ? {
              title: certificate.course.title,
              slug: certificate.course.slug,
            }
          : null,
        issuedAt: certificate.issuedAt,
        status: certificate.status,
        language: certificate.language,
        metadata: {
          completionDate: certificate.metadata?.completionDate,
          score: certificate.metadata?.score,
          instructor: certificate.metadata?.instructor
            ? { name: certificate.metadata.instructor.name }
            : null,
          duration: certificate.metadata?.duration,
        },
      },
      verification
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

// @route   PUT /api/certificates/:id/revoke
// @desc    Revoke a certificate (Admin only)
// @access  Private (Admin)
router.put('/:id/revoke', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid certificate ID' });
    }
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    await certificate.revoke(reason);
    await logAdminAction({
      req,
      action: 'certificate.revoked',
      entityType: 'certificate',
      entityId: certificate._id,
      metadata: { certificateId: certificate.certificateId, reason },
    }).catch(() => {});

    res.json({ message: 'Certificate revoked successfully', certificate });
  } catch (error) {
    console.error('Revoke certificate error:', error);
    res.status(500).json({ error: 'Failed to revoke certificate' });
  }
});

// @route   DELETE /api/certificates/:id
// @desc    Delete a certificate (Admin only)
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid certificate ID' });
    }
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const certMeta = { certificateId: certificate.certificateId, student: String(certificate.student || '') };
    await certificate.deleteOne();
    await logAdminAction({
      req,
      action: 'certificate.deleted',
      entityType: 'certificate',
      entityId: req.params.id,
      metadata: certMeta,
    }).catch(() => {});

    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Delete certificate error:', error);
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

// @route   POST /api/certificates/batch-generate
// @desc    Generate certificates in batch for all completed courses
// @access  Private
router.post('/batch-generate', protect, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      student: req.user.id,
      status: 'completed',
      'certificate.issued': { $ne: true }
    }).populate('course');

    if (!enrollments.length) {
      return res.json({ message: 'No new certificates to generate', certificates: [] });
    }

    const generated = [];
    const language = ALLOWED_CERT_LANGUAGES.has(req.body?.language) ? req.body.language : 'ar';

    for (const enrollment of enrollments) {
      const completedLessonCount = Array.isArray(enrollment.progress?.completedLessons)
        ? enrollment.progress.completedLessons.length
        : 0;
      if (
        !enrollment.course ||
        !enrollment.course.certificate?.enabled ||
        Number(enrollment.progress?.percentage || 0) < 100 ||
        completedLessonCount === 0
      ) {
        continue;
      }

      const existingCert = await Certificate.findOne({
        student: req.user.id,
        course: enrollment.course._id
      });

      if (existingCert) {
        enrollment.certificate = {
          issued: true,
          issuedAt: existingCert.issuedAt || new Date(),
          certificateId: existingCert.certificateId,
          qrCode: existingCert.qrCode
        };
        await enrollment.save();
        generated.push(existingCert);
        continue;
      }

      const certificateId = enrollment.certificate?.certificateId || Certificate.generateCertificateId();
      const verificationUrl = `${process.env.FRONTEND_URL || 'https://wahy-wa-namaa-academy.vercel.app'}/verify-certificate/${certificateId}`;
      const qrCode = await Certificate.generateQRCode(verificationUrl);

      const certificate = new Certificate({
        student: req.user.id,
        course: enrollment.course._id,
        enrollment: enrollment._id,
        certificateId,
        qrCode,
        metadata: {
          completionDate: enrollment.completedAt || new Date(),
          score: enrollment.progress.percentage || 100,
          instructor: enrollment.course.instructor,
          duration: enrollment.progress.timeSpent || 0
        },
        language
      });

      await certificate.save();

      enrollment.certificate = {
        issued: true,
        issuedAt: new Date(),
        certificateId,
        qrCode
      };
      await enrollment.save();

      generated.push(certificate);
    }

    res.status(201).json({
      message: `Successfully generated ${generated.length} certificate(s)`,
      certificates: generated
    });
  } catch (error) {
    console.error('Batch generate certificates error:', error);
    res.status(500).json({ error: 'Failed to generate batch certificates' });
  }
});

module.exports = router;
