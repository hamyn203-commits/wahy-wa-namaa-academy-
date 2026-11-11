'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plans = require('../config/subscriptionPlans');
const lifecycle = require('../services/subscriptionCircleLifecycle');

function query(value) {
  return { select() { return this; }, lean() { return this; }, session() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

function harness(count = 14) {
  const circle = { _id: 'circle', name: 'Community', teacher: 'teacher', students: Array.from({ length: count }, (_, i) => 's' + i),
    status: 'forming', subscriptionPlanKey: 'community', subscriptionSection: 'men_children', capacity: 20, async save() {} };
  const subscriptions = circle.students.map((student, index) => ({ _id: 'sub' + index, student, circle: 'circle', status: 'placed', section: 'men_children',
    preferredTeacher: 'teacher', planKey: 'community', sessionCount: index % 2 ? 8 : 4, sessionsUsed: 0, sessionsRemaining: index % 2 ? 8 : 4, async save() {} }));
  const usage = [];
  const notifications = [];
  const calls = [];
  const matches = (item, filter) => Object.entries(filter).every(([key, value]) => {
    if (value?.$in) return value.$in.map(String).includes(String(item[key]));
    if (value?.$gt !== undefined) return item[key] > value.$gt;
    if (value?.$ne !== undefined) return item[key] !== value.$ne;
    return String(item[key]) === String(value);
  });
  const mocks = {
    mongoose: { async startSession() { return { async withTransaction(fn) { return fn(); }, async endSession() {} }; } },
    '../models/GroupCircle': {
      findById() { return query(circle); }, findOne() { return query(circle); },
      async create(docs) { Object.assign(circle, docs[0]); return [circle]; },
      async updateOne(filter, update) { calls.push(update); if (update.$pull) circle.students = circle.students.filter(id => id !== update.$pull.students); if (update.$set) Object.assign(circle, update.$set); },
    },
    '../models/StudentSubscription': {
      findById(id) { return query(subscriptions.find(item => item._id === id)); },
      findOne(filter) { return query(subscriptions.find(item => matches(item, filter))); },
      find(filter) { return query(subscriptions.filter(item => matches(item, filter))); },
      exists(filter) { return query(subscriptions.some(item => matches(item, filter))); },
      async updateMany(filter, update) { subscriptions.filter(item => matches(item, filter)).forEach(item => Object.assign(item, update.$set)); },
    },
    '../models/Teacher': { findOne() { return query({ _id: 'teacher', user: 'teacherUser' }); } },
    '../models/User': { findById(id) { return query({ _id: id, name: 'Learner', age: 20, gender: 'male', async save() {} }); }, async updateOne() {} },
    '../models/Session': { async updateMany() {} },
    '../models/SubscriptionUsage': {
      findOne(filter) { calls.push({ lookup: filter }); return query(usage.find(item => matches(item, filter))); },
      async create(docs) { usage.push(...docs); return docs; },
    },
    '../utils/notify': { async notifyUser(id, message) { notifications.push({ id, message }); } },
    '../config/subscriptionPlans': plans,
    './subscriptionCircleLifecycle': lifecycle,
  };
  function service(name) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services/' + name + '.js'), 'utf8'), {
      module, exports: module.exports, require(key) { if (!(key in mocks)) throw new Error('Unexpected import: ' + key); return mocks[key]; },
      Date, Intl, Set, Map, Promise, String, Number, Boolean,
    });
    return module.exports;
  }
  return { circle, subscriptions, usage, notifications, calls, service };
}

test('15th and 20th learners form a ready circle without activation or credit debit; 21st is rejected', async () => {
  const h = harness(14);
  h.circle.capacity = 15; // Upgrade an existing unstarted economic circle.
  const service = h.service('subscriptionPlacement');
  for (let i = 14; i <= 20; i++) {
    const sub = { _id: 'sub' + i, student: 's' + i, planKey: 'community', section: 'men_children', preferredTeacher: 'teacher',
      status: 'awaiting_placement', sessionsRemaining: 12, sessionsUsed: 0, async save() {} };
    h.subscriptions.push(sub);
    if (i === 20) {
      await assert.rejects(service.placeSubscription({ subscriptionId: sub._id, existingCircleId: 'circle' }), { code: 'CIRCLE_FULL' });
    } else {
      const result = await service.placeSubscription({ subscriptionId: sub._id, existingCircleId: 'circle' });
      assert.equal(result.circleStatus, 'ready');
      assert.equal(result.capacity, 20);
      assert.equal(sub.status, 'placed');
      assert.equal(sub.startedAt, undefined);
      assert.equal(sub.sessionsRemaining, 12);
    }
  }
  assert.equal(h.circle.students.length, 20);
  assert.ok(h.subscriptions.every(sub => sub.status !== 'active'));
});

test('circle start requires paid minimum and valid plan duration, then activates mixed package sizes without debit', async () => {
  const h = harness(14);
  const { startSubscriptionCircle } = h.service('subscriptionPlacement');
  const valid = { circleId: 'circle', schedule: [{ day: 'Saturday', startTime: '18:00', endTime: '19:00' }], timezone: 'Africa/Cairo' };
  await assert.rejects(startSubscriptionCircle(valid), { code: 'CIRCLE_MINIMUM_NOT_MET' });
  h.circle.students.push('s14');
  h.subscriptions.push({ ...h.subscriptions[0], _id: 'sub14', student: 's14' });
  await assert.rejects(startSubscriptionCircle({ ...valid, schedule: [{ day: 'Saturday', startTime: '18:00', endTime: '18:30' }] }), { code: 'CIRCLE_SCHEDULE_INVALID' });
  await assert.rejects(startSubscriptionCircle({ ...valid, timezone: 'invalid/timezone' }), { code: 'CIRCLE_TIMEZONE_INVALID' });
  const result = await startSubscriptionCircle(valid);
  assert.equal(result.activatedStudentIds.length, 15);
  assert.equal(h.circle.status, 'active');
  assert.ok(h.subscriptions.every(sub => sub.status === 'active' && sub.sessionsRemaining === sub.sessionCount && sub.sessionsUsed === 0));
  assert.equal((await startSubscriptionCircle(valid)).alreadyStarted, true);
});

test('admin early start (allowUnderMinimum) activates circle and student subscriptions before minimum count', async () => {
  const h = harness(2);
  const { startSubscriptionCircle } = h.service('subscriptionPlacement');
  const valid = { circleId: 'circle', schedule: [{ day: 'Monday', startTime: '17:00', endTime: '18:00' }], timezone: 'Africa/Cairo' };
  await assert.rejects(startSubscriptionCircle(valid), { code: 'CIRCLE_MINIMUM_NOT_MET' });
  const earlyResult = await startSubscriptionCircle({ ...valid, allowUnderMinimum: true });
  assert.equal(earlyResult.activatedStudentIds.length, 2);
  assert.equal(h.circle.status, 'active');
  assert.equal(h.circle.schedule[0].day, 'Monday');
  assert.equal(h.circle.schedule[0].startTime, '17:00');
  assert.equal(h.circle.schedule[0].endTime, '18:00');
  assert.ok(h.subscriptions.every(sub => sub.status === 'active'));
});

test('settlement replay cannot debit the renewal activated by the same completed session', async () => {
  const h = harness(1);
  h.circle.status = 'active';
  const source = h.subscriptions[0];
  source.status = 'active'; source.sessionsRemaining = 1; source.sessionsUsed = 3;
  const renewal = { ...source, _id: 'renewal', renewalOf: source._id, status: 'renewal_queued', sessionsRemaining: 8, sessionsUsed: 0, sessionCount: 8 };
  h.subscriptions.push(renewal);
  const { settleSubscriptionUsageForSession } = h.service('subscriptionUsage');
  const session = { _id: 'session', circle: 'circle', status: 'completed', type: 'group_circle', attendance: [{ student: source.student, status: 'attended' }] };
  await settleSubscriptionUsageForSession(session);
  assert.equal(source.status, 'completed');
  assert.equal(renewal.status, 'active');
  const replay = await settleSubscriptionUsageForSession(session);
  assert.equal(replay.usages[0].alreadyProcessed, true);
  assert.equal(renewal.sessionsRemaining, 8);
  assert.equal(h.usage.length, 1);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.calls[0].$inc.subscriptionUsageVersion, 1);
  assert.deepEqual(Object.keys(h.calls[1].lookup).sort(), ['session', 'student']);
});

test('per-student balances, early excuses and scheduled roster survive settlement and replay', async () => {
  const h = harness(3);
  h.circle.status = 'active';
  h.subscriptions.forEach(sub => { sub.status = 'active'; });
  const { settleSubscriptionUsageForSession } = h.service('subscriptionUsage');
  const session = { _id: 'session', circle: 'circle', status: 'completed', type: 'group_circle', attendance: [
    { student: 's0', status: 'attended' }, { student: 's1', status: 'excused', eligibleForCompensation: true },
  ] };
  await settleSubscriptionUsageForSession({ ...session, status: 'accepted' });
  assert.equal(h.usage.length, 0);
  await settleSubscriptionUsageForSession(session);
  await settleSubscriptionUsageForSession(session);
  assert.equal(h.subscriptions[0].sessionsRemaining, 3);
  assert.equal(h.subscriptions[1].sessionsRemaining, 8);
  assert.equal(h.subscriptions[2].sessionsRemaining, 4); // Not on this lesson's roster.
  assert.equal(h.usage.length, 2);
  assert.equal(h.circle.status, 'active'); // Initial threshold never stops an ongoing cohort.
});

test('exhaustion removes only exhausted learners while an existing circle keeps running', async () => {
  const h = harness(2);
  h.circle.status = 'active';
  h.subscriptions.forEach(sub => { sub.status = 'active'; });
  h.subscriptions[0].sessionsRemaining = 1;
  await h.service('subscriptionUsage').settleSubscriptionUsageForSession({ _id: 'session', status: 'completed', type: 'group_circle', circle: 'circle', attendance: [{ student: 's0', status: 'attended' }] });
  assert.equal(h.circle.students.length, 1);
  assert.equal(h.circle.status, 'active');
  assert.equal(h.subscriptions[1].sessionsRemaining, 8);
});
