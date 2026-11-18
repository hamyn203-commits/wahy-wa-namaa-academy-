'use strict';

const mongoose = require('mongoose');
const Session = require('../models/Session');
const GroupCircle = require('../models/GroupCircle');

const isValidObjectId = (value) => Boolean(value && mongoose.Types.ObjectId.isValid(String(value)));

async function runLean(query) {
  if (!query) return [];
  if (typeof query.lean === 'function') return query.lean();
  return query;
}

/**
 * Resolve all active/historical student IDs and group circles owned by a teacher.
 * Covers 1-on-1 sessions (`student`), group_circle rosters (`attendance.student`),
 * and active/full `GroupCircle` memberships (`students`).
 */
async function getTeacherStudentScope(teacherId) {
  if (!isValidObjectId(teacherId)) {
    return {
      studentIds: new Set(),
      circles: [],
      circlesByStudent: new Map(),
    };
  }

  const [directStudents, attendanceStudents, rawCircles] = await Promise.all([
    Session.find({
      teacher: teacherId,
      status: { $in: ['accepted', 'completed'] },
      student: { $ne: null },
    }).distinct('student'),
    Session.find({
      teacher: teacherId,
      type: 'group_circle',
      status: { $in: ['accepted', 'completed'] },
      'attendance.student': { $ne: null },
    }).distinct('attendance.student'),
    runLean(
      GroupCircle.find({
        teacher: teacherId,
        status: { $in: ['active', 'full'] },
      }).select('_id name status students track level')
    ),
  ]);

  const studentIds = new Set();
  for (const id of directStudents || []) {
    if (id) studentIds.add(String(id));
  }
  for (const id of attendanceStudents || []) {
    if (id) studentIds.add(String(id));
  }

  const circles = Array.isArray(rawCircles) ? rawCircles : [];
  const circlesByStudent = new Map();

  for (const circle of circles) {
    const circleSummary = {
      _id: circle._id,
      name: circle.name,
      status: circle.status,
      track: circle.track,
      level: circle.level,
    };
    for (const sid of circle.students || []) {
      if (!sid) continue;
      const key = String(sid);
      studentIds.add(key);
      if (!circlesByStudent.has(key)) {
        circlesByStudent.set(key, []);
      }
      circlesByStudent.get(key).push(circleSummary);
    }
  }

  return {
    studentIds,
    circles,
    circlesByStudent,
  };
}

/**
 * Verify whether a teacher has an established 1-on-1, group-session roster,
 * or active/full group-circle relationship with a specific student.
 */
async function doesTeacherOwnStudent(teacherId, studentId) {
  if (!isValidObjectId(teacherId) || !isValidObjectId(studentId)) {
    return false;
  }

  const [directExists, rosterExists, circleExists] = await Promise.all([
    Session.exists({
      teacher: teacherId,
      student: studentId,
      status: { $in: ['accepted', 'completed'] },
    }),
    Session.exists({
      teacher: teacherId,
      type: 'group_circle',
      status: { $in: ['accepted', 'completed'] },
      'attendance.student': studentId,
    }),
    GroupCircle.exists({
      teacher: teacherId,
      students: studentId,
      status: { $in: ['active', 'full'] },
    }),
  ]);

  return Boolean(directExists || rosterExists || circleExists);
}

/**
 * Resolve all unique teacher profile IDs visible to a student via 1-on-1 sessions,
 * group-circle lesson rosters, or active/full group-circle membership.
 */
async function getStudentVisibleTeacherIds(studentId) {
  if (!isValidObjectId(studentId)) return [];

  const [sessionTeachers, circleTeachers] = await Promise.all([
    Session.find({
      status: { $in: ['accepted', 'completed'] },
      $or: [
        { student: studentId },
        { 'attendance.student': studentId },
      ],
    }).distinct('teacher'),
    GroupCircle.find({
      students: studentId,
      status: { $in: ['active', 'full'] },
    }).distinct('teacher'),
  ]);

  const ids = new Set();
  for (const id of [...(sessionTeachers || []), ...(circleTeachers || [])]) {
    if (id) ids.add(String(id));
  }
  return [...ids];
}

module.exports = {
  getTeacherStudentScope,
  doesTeacherOwnStudent,
  getStudentVisibleTeacherIds,
};
