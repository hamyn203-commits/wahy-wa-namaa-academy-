'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const { addMockTeacher } = require('../mockStore');
const Teacher = require('../models/Teacher');
const TeacherLedger = require('../models/TeacherLedger');
const Session = require('../models/Session');
const Payment = require('../models/Payment');
const AdminAuditLog = require('../models/AdminAuditLog');
const subscriptionUsageService = require('../services/subscriptionUsage');

function requestJson(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, body: json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Batch 2 Financial Closure: TOCTOU payout concurrency, atomic admin payout approval, admin session settlement, and payment partial unique indexes', async () => {
  process.env.FORCE_REAL_FINANCE_IN_TEST = 'true';
  const server = app.listen(0);

  const originals = {
    teacherFindOne: Teacher.findOne,
    teacherFindById: Teacher.findById,
    teacherFindByIdAndUpdate: Teacher.findByIdAndUpdate,
    ledgerExists: TeacherLedger.exists,
    ledgerFind: TeacherLedger.find,
    ledgerFindOne: TeacherLedger.findOne,
    ledgerFindById: TeacherLedger.findById,
    ledgerFindOneAndUpdate: TeacherLedger.findOneAndUpdate,
    ledgerCreate: TeacherLedger.create,
    sessionFindById: Session.findById,
    sessionCount: Session.countDocuments,
    sessionAggregate: Session.aggregate,
    auditCreate: AdminAuditLog.create,
    settleSub: subscriptionUsageService.settleSubscriptionUsageForSession,
  };

  try {
    const teacherUserId = '507f1f77bcf86cd799439051';
    const teacherProfileId = '507f1f77bcf86cd799439052';
    const adminUserId = '507f1f77bcf86cd799439053';
    const studentId = '507f1f77bcf86cd799439054';
    const sessionId = '507f1f77bcf86cd799439055';

    addMockTeacher({
      _id: teacherProfileId,
      user: teacherUserId,
      status: 'approved',
      isVerified: true,
    });

    const teacherToken = generateAccessToken({ id: teacherUserId, email: 'tf@example.com', role: 'teacher' });
    const adminToken = generateAccessToken({ id: adminUserId, email: 'af@example.com', role: 'admin' });

    // In-memory ledger store simulating concurrent DB operations with realistic async latency
    const ledgerStore = [
      {
        _id: '507f1f77bcf86cd799439060',
        teacher: teacherProfileId,
        type: 'session_earning',
        amount: 500,
        currency: 'EGP',
        status: 'completed',
      },
    ];

    const teacherDoc = {
      _id: teacherProfileId,
      user: teacherUserId,
      hourlyRate: 80,
      earnings: { totalEarned: 0, pendingEarnings: 0, withdrawnEarnings: 0 },
    };

    Teacher.findOne = async () => teacherDoc;
    Teacher.findById = (id) => {
      const p = Promise.resolve(String(id) === teacherProfileId ? teacherDoc : null);
      p.select = async () => teacherDoc;
      p.session = () => p;
      return p;
    };
    Teacher.findByIdAndUpdate = async () => teacherDoc;
    TeacherLedger.exists = async () => true;
    AdminAuditLog.create = async () => ({});

    TeacherLedger.find = ({ teacher }) => {
      const p = new Promise((resolve) => {
        setTimeout(() => {
          resolve(ledgerStore.filter((e) => String(e.teacher) === String(teacher)).map((e) => ({ ...e })));
        }, 12);
      });
      p.session = () => p;
      return p;
    };

    TeacherLedger.findOne = (filter) => {
      const exec = async () => {
        await new Promise((r) => setTimeout(r, 8));
        return ledgerStore.find((e) => {
          if (filter.idempotencyKey) return e.idempotencyKey === filter.idempotencyKey;
          if (filter.teacher && String(e.teacher) !== String(filter.teacher)) return false;
          if (filter.currency && e.currency !== filter.currency) return false;
          if (filter.type && e.type !== filter.type) return false;
          if (filter.status?.$in && !filter.status.$in.includes(e.status)) return false;
          return true;
        }) || null;
      };
      const p = exec();
      p.select = () => {
        const sp = exec();
        sp.session = () => sp;
        return sp;
      };
      p.session = () => p;
      return p;
    };

    let seq = 1;
    TeacherLedger.create = async (docs) => {
      await new Promise((r) => setTimeout(r, 10));
      const arr = Array.isArray(docs) ? docs : [docs];
      const created = arr.map((d) => {
        const entry = { _id: `507f1f77bcf86cd79943910${seq++}`, ...d };
        ledgerStore.push(entry);
        return entry;
      });
      return Array.isArray(docs) ? created : created[0];
    };

    // 1. Fire 5 concurrent 500 EGP payout requests against a single 500 EGP balance -> ONLY 1 must succeed!
    const concurrentPayouts = await Promise.all(
      Array.from({ length: 5 }, () =>
        requestJson(server, 'POST', '/api/finance/teacher/request-payout', {
          headers: { Authorization: `Bearer ${teacherToken}` },
          body: {
            amount: 500,
            currency: 'EGP',
            payoutMethod: 'instapay',
            payoutDetails: { ipaAddress: 'sheikh@instapay' },
          },
        })
      )
    );

    const createdPayouts = concurrentPayouts.filter((r) => r.status === 201);
    const conflictPayouts = concurrentPayouts.filter((r) => r.status === 409 && r.body?.code === 'PAYOUT_ALREADY_PENDING');
    assert.equal(createdPayouts.length, 1, 'Expected strictly 1 payout creation under 5x concurrency');
    assert.equal(conflictPayouts.length, 4, 'Expected 4 concurrent duplicates to reject with 409 PAYOUT_ALREADY_PENDING');

    // 2. Fire 5 concurrent admin payout approvals on that pending payout -> ONLY 1 must complete!
    const createdPayoutId = createdPayouts[0].body.transaction._id;
    TeacherLedger.findById = (id) => ({
      populate: async () => {
        const found = ledgerStore.find((e) => e._id === id);
        return found ? { ...found, teacher: teacherDoc } : null;
      },
    });
    TeacherLedger.findOneAndUpdate = (filter, update) => {
      const exec = async () => {
        await new Promise((r) => setTimeout(r, 8));
        if (filter.idempotencyKey) {
          let existing = ledgerStore.find((e) => e.idempotencyKey === filter.idempotencyKey);
          if (!existing) {
            existing = { _id: `507f1f77bcf86cd79943920${seq++}`, ...(update.$setOnInsert || {}) };
            ledgerStore.push(existing);
          }
          return existing;
        }
        const idx = ledgerStore.findIndex(
          (e) =>
            e._id === filter._id
            && e.type === filter.type
            && filter.status.$in.includes(e.status)
        );
        if (idx === -1) return null;
        ledgerStore[idx] = { ...ledgerStore[idx], ...(update.$set || {}) };
        return { ...ledgerStore[idx], teacher: teacherDoc };
      };
      const p = exec();
      p.populate = () => p;
      return p;
    };

    const concurrentApprovals = await Promise.all(
      Array.from({ length: 5 }, () =>
        requestJson(server, 'PUT', `/api/finance/admin/payouts/${createdPayoutId}/process`, {
          headers: { Authorization: `Bearer ${adminToken}` },
          body: { action: 'approve', referenceNumber: 'INSTA-998877' },
        })
      )
    );

    const succeededApprovals = concurrentApprovals.filter((r) => r.status === 200);
    const finalizedConflicts = concurrentApprovals.filter((r) => r.status === 409 && r.body?.code === 'PAYOUT_ALREADY_FINALIZED');
    assert.equal(succeededApprovals.length, 1, 'Expected strictly 1 admin payout approval to succeed');
    assert.equal(finalizedConflicts.length, 4, 'Expected 4 concurrent approvals to reject with 409 PAYOUT_ALREADY_FINALIZED');

    // 3. Admin session-control completion settles teacher ledger earning & guards unresolved attendance + immutability
    const liveSessionDoc = {
      _id: sessionId,
      type: 'group_circle',
      status: 'accepted',
      teacher: teacherProfileId,
      scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      duration: 60,
      earnings: { amount: 0, status: 'pending' },
      attendance: [{ student: studentId, status: 'pending' }],
      save: async function save() {
        return this;
      },
    };
    Session.findById = async (id) => (id === sessionId ? liveSessionDoc : null);
    Session.countDocuments = async () => 1;
    Session.aggregate = async () => [{ _id: null, totalMinutes: 60 }];

    // 3a. Unresolved pending group attendance blocks admin completion unless resolvePendingAttendanceAs is passed
    const incompleteCloseRes = await requestJson(
      server,
      'PUT',
      `/api/admin/session-control/${sessionId}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'completed' },
      }
    );
    assert.equal(incompleteCloseRes.status, 409);
    assert.equal(incompleteCloseRes.body?.code, 'GROUP_ATTENDANCE_INCOMPLETE');

    // 3b. Resolving pending attendance completes session & records idempotent session earning (80 EGP for 60m @ 80/hr)
    const settledCloseRes = await requestJson(
      server,
      'PUT',
      `/api/admin/session-control/${sessionId}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'completed', resolvePendingAttendanceAs: 'attended' },
      }
    );
    assert.equal(settledCloseRes.status, 200);
    const sessionEarningEntry = ledgerStore.find((e) => e.idempotencyKey === `session:${sessionId}:earning`);
    assert.ok(sessionEarningEntry, 'Expected session earning ledger entry to be created');
    assert.equal(sessionEarningEntry.amount, 80);

    // 3c. Completed session cannot be flipped back to cancelled without financial reversal
    const cancelSettledRes = await requestJson(
      server,
      'PUT',
      `/api/admin/session-control/${sessionId}/status`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'cancelled', reason: 'Accidental click' },
      }
    );
    assert.equal(cancelSettledRes.status, 409);
    assert.equal(cancelSettledRes.body?.code, 'COMPLETED_SESSION_IMMUTABLE');

    // 4. Schema index verification for Payment (course_enrollment pending manual) & TeacherLedger (pending/processing payout)
    const paymentIndexes = Payment.schema.indexes();
    const hasCourseManualUnique = paymentIndexes.some(
      ([fields, opts]) =>
        opts?.unique === true
        && fields.student === 1
        && fields.course === 1
        && opts?.partialFilterExpression?.kind === 'course_enrollment'
        && opts?.partialFilterExpression?.provider === 'manual'
        && opts?.partialFilterExpression?.status === 'pending'
    );
    assert.equal(hasCourseManualUnique, true, 'Payment schema must enforce unique pending manual course_enrollment index');

    const ledgerIndexes = TeacherLedger.schema.indexes();
    const hasPayoutPendingUnique = ledgerIndexes.some(
      ([fields, opts]) =>
        opts?.unique === true
        && fields.teacher === 1
        && fields.currency === 1
        && fields.type === 1
        && opts?.partialFilterExpression?.type === 'payout'
    );
    assert.equal(hasPayoutPendingUnique, true, 'TeacherLedger schema must enforce unique pending/processing payout index');
  } finally {
    delete process.env.FORCE_REAL_FINANCE_IN_TEST;
    Teacher.findOne = originals.teacherFindOne;
    Teacher.findById = originals.teacherFindById;
    Teacher.findByIdAndUpdate = originals.teacherFindByIdAndUpdate;
    TeacherLedger.exists = originals.ledgerExists;
    TeacherLedger.find = originals.ledgerFind;
    TeacherLedger.findOne = originals.ledgerFindOne;
    TeacherLedger.findById = originals.ledgerFindById;
    TeacherLedger.findOneAndUpdate = originals.ledgerFindOneAndUpdate;
    TeacherLedger.create = originals.ledgerCreate;
    Session.findById = originals.sessionFindById;
    Session.countDocuments = originals.sessionCount;
    Session.aggregate = originals.sessionAggregate;
    AdminAuditLog.create = originals.auditCreate;
    subscriptionUsageService.settleSubscriptionUsageForSession = originals.settleSub;
    await new Promise((resolve) => server.close(resolve));
  }
});
