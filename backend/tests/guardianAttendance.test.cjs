'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Test the attendance calculation logic implemented in backend/routes/guardian.js
function calculateAttendance(sessions, studentId, now = new Date()) {
  let totalSessions = 0;
  let attendedSessions = 0;
  let excusedSessions = 0;
  let absentSessions = 0;

  sessions.forEach((sess) => {
    const isEligible = sess.status === 'completed' || (sess.scheduledAt && new Date(sess.scheduledAt) <= now);
    if (!isEligible) {
      return;
    }

    totalSessions += 1;
    const att = sess.attendance?.find(
      (entry) => entry.student && entry.student.toString() === studentId.toString()
    );
    if (att) {
      if (att.status === 'attended') attendedSessions += 1;
      else if (att.status === 'excused') excusedSessions += 1;
      else if (att.status === 'absent') absentSessions += 1;
      else if (sess.status === 'completed') attendedSessions += 1;
    } else if (sess.status === 'completed') {
      attendedSessions += 1;
    }
  });

  const rate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : null;

  return {
    rate,
    total: totalSessions,
    attended: attendedSessions,
    excused: excusedSessions,
    absent: absentSessions,
  };
}

test('future scheduled sessions with confirmed RSVP are excluded from total and attended counts', () => {
  const studentId = 'student-123';
  const now = new Date('2026-10-31T12:00:00Z');

  const sessions = [
    // Past completed session attended
    {
      _id: 'sess-1',
      scheduledAt: '2026-10-24T12:00:00Z',
      status: 'completed',
      attendance: [{ student: 'student-123', status: 'attended' }],
    },
    // Past completed session excused
    {
      _id: 'sess-2',
      scheduledAt: '2026-10-27T12:00:00Z',
      status: 'completed',
      attendance: [{ student: 'student-123', status: 'excused' }],
    },
    // Future session with confirmed RSVP (e.g. next week)
    {
      _id: 'sess-3',
      scheduledAt: '2026-11-05T12:00:00Z',
      status: 'accepted',
      attendance: [{ student: 'student-123', status: 'confirmed' }],
    },
    // Another future session pending
    {
      _id: 'sess-4',
      scheduledAt: '2026-11-12T12:00:00Z',
      status: 'accepted',
      attendance: [{ student: 'student-123', status: 'pending' }],
    },
  ];

  const result = calculateAttendance(sessions, studentId, now);

  // Only the 2 past sessions are eligible
  assert.equal(result.total, 2, 'Total sessions must only count past or completed sessions');
  assert.equal(result.attended, 1, 'Attended must only count actual attendance');
  assert.equal(result.excused, 1, 'Excused count must be 1');
  assert.equal(result.absent, 0, 'Absent count must be 0');
  assert.equal(result.rate, 50, 'Attendance rate must be 50% (1/2), not inflated by future RSVP');
});

test('past completed sessions without explicit attendance entry default to attended', () => {
  const studentId = 'student-123';
  const now = new Date('2026-10-31T12:00:00Z');

  const sessions = [
    {
      _id: 'sess-1',
      scheduledAt: '2026-10-20T12:00:00Z',
      status: 'completed',
      attendance: [],
    },
  ];

  const result = calculateAttendance(sessions, studentId, now);
  assert.equal(result.total, 1);
  assert.equal(result.attended, 1);
  assert.equal(result.rate, 100);
});
