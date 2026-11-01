'use strict';

const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const { REVIEW_ITEMS } = require('../services/teacherReview');
const { findMockTeacherByUserId } = require('../mockStore');
const { isMockMode } = require('../config/runtime');

const REVIEW_LABEL_MAP = new Map(REVIEW_ITEMS.map((item) => [item.key, item.label]));

function extractReviewFeedback(teacher) {
  if (!teacher) return { reviewNote: '', requestedChanges: [] };

  const notes = Array.isArray(teacher.reviewNotes) ? teacher.reviewNotes : [];
  let reviewNote = '';
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    if (notes[i]?.note && String(notes[i].note).trim()) {
      reviewNote = String(notes[i].note).trim();
      break;
    }
  }

  const checklist = Array.isArray(teacher.reviewChecklist) ? teacher.reviewChecklist : [];
  const requestedChanges = checklist
    .filter((item) => item?.status === 'changes-requested')
    .map((item) => ({
      key: item.key,
      label: REVIEW_LABEL_MAP.get(item.key) || item.key,
      note: String(item.note || '').trim(),
    }));

  return { reviewNote, requestedChanges };
}

function decisionForTeacher(teacher) {
  if (!teacher) {
    return {
      allowed: false,
      status: 'pending',
      code: 'TEACHER_APPROVAL_PENDING',
      error: 'Teacher application is pending administration approval',
      reviewNote: '',
      requestedChanges: [],
    };
  }

  const { reviewNote, requestedChanges } = extractReviewFeedback(teacher);

  if (teacher.status === 'approved' && teacher.isVerified === true) {
    return {
      allowed: true,
      status: 'approved',
      code: null,
      error: null,
      reviewNote: '',
      requestedChanges: [],
    };
  }

  const map = {
    pending: {
      code: 'TEACHER_APPROVAL_PENDING',
      error: 'Teacher application is pending administration approval',
    },
    'under-review': {
      code: 'TEACHER_APPLICATION_UNDER_REVIEW',
      error: 'Teacher application is still under administration review',
    },
    rejected: {
      code: 'TEACHER_APPLICATION_REJECTED',
      error: 'Teacher application was not approved',
    },
    suspended: {
      code: 'TEACHER_ACCOUNT_SUSPENDED',
      error: 'Teacher account is suspended',
    },
    approved: {
      code: 'TEACHER_APPROVAL_PENDING',
      error: 'Teacher approval is not complete yet',
    },
  };

  const selected = map[teacher.status] || map.pending;
  return {
    allowed: false,
    status: teacher.status || 'pending',
    code: selected.code,
    error: selected.error,
    reviewNote,
    requestedChanges,
  };
}

async function getTeacherAccessDecision(userId) {
  if (!userId) return decisionForTeacher(null);

  if (isMockMode && mongoose.connection.readyState !== 1) {
    return decisionForTeacher(findMockTeacherByUserId(userId));
  }

  const teacher = await Teacher.findOne({ user: userId })
    .select('status isVerified reviewNotes reviewChecklist')
    .lean();

  return decisionForTeacher(teacher);
}

module.exports = {
  decisionForTeacher,
  extractReviewFeedback,
  getTeacherAccessDecision,
};
