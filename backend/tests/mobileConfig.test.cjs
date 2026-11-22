'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

function getJson(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${pathname}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: JSON.parse(body || '{}') });
      });
    }).on('error', reject);
  });
}

test('GET /api/mobile/config computes soft/forced updates and enforces safe HTTPS download URLs', async (t) => {
  const prevEnv = {
    DISABLE_RATE_LIMIT: process.env.DISABLE_RATE_LIMIT,
    ALLOW_MOCK_MODE: process.env.ALLOW_MOCK_MODE,
    MOBILE_LEARNER_LATEST_VERSION: process.env.MOBILE_LEARNER_LATEST_VERSION,
    MOBILE_LEARNER_MIN_VERSION: process.env.MOBILE_LEARNER_MIN_VERSION,
    MOBILE_LEARNER_ANDROID_APK_URL: process.env.MOBILE_LEARNER_ANDROID_APK_URL,
    MOBILE_TEACHER_LATEST_VERSION: process.env.MOBILE_TEACHER_LATEST_VERSION,
    MOBILE_TEACHER_MIN_VERSION: process.env.MOBILE_TEACHER_MIN_VERSION,
    MOBILE_TEACHER_ANDROID_APK_URL: process.env.MOBILE_TEACHER_ANDROID_APK_URL,
  };

  process.env.DISABLE_RATE_LIMIT = 'true';
  process.env.ALLOW_MOCK_MODE = 'true';
  process.env.MOBILE_LEARNER_LATEST_VERSION = '1.2.0';
  process.env.MOBILE_LEARNER_MIN_VERSION = '1.1.0';
  process.env.MOBILE_LEARNER_ANDROID_APK_URL = 'https://wahywanamaa.com/downloads/student-v1.2.0.apk';
  process.env.MOBILE_TEACHER_LATEST_VERSION = '1.0.0';
  process.env.MOBILE_TEACHER_MIN_VERSION = '1.0.0';
  process.env.MOBILE_TEACHER_ANDROID_APK_URL = 'javascript:alert(1)';

  delete require.cache[require.resolve('../routes/mobile')];
  delete require.cache[require.resolve('../app')];
  const app = require('../app');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve('../routes/mobile')];
    delete require.cache[require.resolve('../app')];
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // 1) Below minVersion -> forceUpdate: true, updateAvailable: true
  const forced = await getJson(baseUrl, '/api/mobile/config?app=learner&platform=android&version=1.0.0');
  assert.equal(forced.status, 200);
  assert.equal(forced.body.updateAvailable, true);
  assert.equal(forced.body.forceUpdate, true);
  assert.equal(forced.body.latestVersion, '1.2.0');
  assert.equal(forced.body.downloadUrl, 'https://wahywanamaa.com/downloads/student-v1.2.0.apk');

  // 2) Between minVersion and latestVersion -> soft update
  const soft = await getJson(baseUrl, '/api/mobile/config?app=learner&platform=android&version=1.1.0');
  assert.equal(soft.status, 200);
  assert.equal(soft.body.updateAvailable, true);
  assert.equal(soft.body.forceUpdate, false);

  // 3) Up to date -> no update
  const current = await getJson(baseUrl, '/api/mobile/config?app=learner&platform=android&version=1.2.0');
  assert.equal(current.status, 200);
  assert.equal(current.body.updateAvailable, false);
  assert.equal(current.body.forceUpdate, false);

  // 4) Unsafe download URL is rejected and replaced with safe HTTPS fallback
  const teacher = await getJson(baseUrl, '/api/mobile/config?app=teacher&platform=android&version=1.0.0');
  assert.equal(teacher.status, 200);
  assert.equal(teacher.body.app, 'teacher');
  assert.match(teacher.body.downloadUrl, /^https:\/\//);
  assert.doesNotMatch(teacher.body.downloadUrl, /^javascript:/i);

  // 5) Branded download route redirects safely (302) to configured APK URL
  const dlRedirect = await new Promise((resolve, reject) => {
    http.get(`${baseUrl}/api/mobile/download/android?app=learner`, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location });
    }).on('error', reject);
  });
  assert.equal(dlRedirect.status, 302);
  assert.equal(dlRedirect.location, 'https://wahywanamaa.com/downloads/student-v1.2.0.apk');
});
