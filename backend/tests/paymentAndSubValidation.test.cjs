'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = 'c4-payment-sub-validation-access-secret-1234567890';
process.env.JWT_REFRESH_SECRET = 'c4-payment-sub-validation-refresh-secret-1234567890';

const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const StudentSubscription = require('../models/StudentSubscription');
const { generateAccessToken } = require('../middleware/auth');
const app = require('../app');

const oid = () => new mongoose.Types.ObjectId().toString();

function chainableQuery(value) {
  const q = {
    select() { return q; },
    populate() { return q; },
    sort() { return q; },
    skip() { return q; },
    limit() { return q; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return q;
}

const origReadyState = mongoose.connection.readyState;
const origUserFindById = User.findById;
const origPaymentFindById = Payment.findById;
const origPaymentFindOne = Payment.findOne;
const origSubFindById = StudentSubscription.findById;

let server;
let baseUrl = '';
let paymentQueryCalls = 0;
let subQueryCalls = 0;

const ids = {
  admin: oid(),
  student: oid(),
  otherStudent: oid(),
  validPayment: oid(),
  validSub: oid(),
};

const users = new Map([
  [ids.admin, { _id: ids.admin, id: ids.admin, name: 'Admin', email: 'admin@test.local', role: 'admin', isActive: true, emailVerified: true, refreshTokenVersion: 0 }],
  [ids.student, { _id: ids.student, id: ids.student, name: 'Student', email: 'student@test.local', role: 'student', isActive: true, emailVerified: true, refreshTokenVersion: 0 }],
  [ids.otherStudent, { _id: ids.otherStudent, id: ids.otherStudent, name: 'Other', email: 'other@test.local', role: 'student', isActive: true, emailVerified: true, refreshTokenVersion: 0 }],
]);

before(async () => {
  mongoose.connection.readyState = 1;

  User.findById = (id) => chainableQuery(users.get(String(id)) || null);
  Payment.findById = (id) => {
    paymentQueryCalls += 1;
    if (String(id) === ids.validPayment) {
      return chainableQuery({
        _id: ids.validPayment,
        kind: 'course_enrollment',
        provider: 'manual',
        student: ids.student,
        amountMinor: 25000,
        currency: 'EGP',
        status: 'pending',
        manual: { method: 'instapay', submittedBy: ids.student },
      });
    }
    return chainableQuery(null);
  };
  Payment.findOne = (filter) => {
    paymentQueryCalls += 1;
    if (String(filter?._id) === ids.validPayment) {
      return chainableQuery(null);
    }
    return chainableQuery(null);
  };
  StudentSubscription.findById = (id) => {
    subQueryCalls += 1;
    if (String(id) === ids.validSub) {
      return chainableQuery({
        _id: ids.validSub,
        student: ids.student,
        planKey: 'group',
        section: 'men_children',
        sessionCount: 8,
        sessionsUsed: 0,
        sessionsRemaining: 8,
        pricePerSessionMinor: 5000,
        totalAmountMinor: 40000,
        currency: 'EGP',
        status: 'pending_payment',
      });
    }
    return chainableQuery(null);
  };

  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
    server.once('error', reject);
  });
});

after(async () => {
  mongoose.connection.readyState = origReadyState;
  User.findById = origUserFindById;
  Payment.findById = origPaymentFindById;
  Payment.findOne = origPaymentFindOne;
  StudentSubscription.findById = origSubFindById;
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

async function apiFetch(path, user) {
  const token = user ? generateAccessToken({ id: user._id, role: user.role, refreshTokenVersion: 0 }) : '';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.json();
  return { status: response.status, body };
}

test('GET /api/payments/:id/status rejects invalid ObjectId with 400 before DB query and serves valid owner', async () => {
  const student = users.get(ids.student);
  const other = users.get(ids.otherStudent);

  const beforeCalls = paymentQueryCalls;
  const bad = await apiFetch('/api/payments/not-an-object-id/status', student);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'Invalid payment ID');
  assert.equal(paymentQueryCalls, beforeCalls);

  const missing = await apiFetch(`/api/payments/${oid()}/status`, student);
  assert.equal(missing.status, 404);

  const forbidden = await apiFetch(`/api/payments/${ids.validPayment}/status`, other);
  assert.equal(forbidden.status, 403);

  const ok = await apiFetch(`/api/payments/${ids.validPayment}/status`, student);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.payment.id, ids.validPayment);
});

test('GET /api/payments/admin/manual/:id/proof rejects invalid ObjectId with 400 and enforces admin role', async () => {
  const admin = users.get(ids.admin);
  const student = users.get(ids.student);

  const nonAdmin = await apiFetch('/api/payments/admin/manual/bad-id/proof', student);
  assert.equal(nonAdmin.status, 403);

  const beforeCalls = paymentQueryCalls;
  const bad = await apiFetch('/api/payments/admin/manual/bad-id/proof', admin);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'Invalid payment ID');
  assert.equal(paymentQueryCalls, beforeCalls);

  const missing = await apiFetch(`/api/payments/admin/manual/${ids.validPayment}/proof`, admin);
  assert.equal(missing.status, 404);
});

test('GET /api/subscriptions/:id rejects invalid ObjectId with 400 before DB query and enforces ownership', async () => {
  const student = users.get(ids.student);
  const other = users.get(ids.otherStudent);

  const beforeCalls = subQueryCalls;
  const bad = await apiFetch('/api/subscriptions/invalid-sub-id', student);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'INVALID_SUBSCRIPTION_ID');
  assert.equal(subQueryCalls, beforeCalls);

  const missing = await apiFetch(`/api/subscriptions/${oid()}`, student);
  assert.equal(missing.status, 404);

  const forbidden = await apiFetch(`/api/subscriptions/${ids.validSub}`, other);
  assert.equal(forbidden.status, 403);

  const ok = await apiFetch(`/api/subscriptions/${ids.validSub}`, student);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.success, true);
  assert.equal(String(ok.body.subscription._id), ids.validSub);
});
