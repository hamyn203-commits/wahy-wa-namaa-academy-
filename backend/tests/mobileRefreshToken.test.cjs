const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.MOCK_MODE = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret-for-mobile-refresh-only-32ch';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-mobile-refresh-only-32ch';

const app = require('../app');
const { addMockUser } = require('../mockStore');

function postJson(port, urlPath, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body || {}), 'utf8');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          Origin: 'http://localhost:5173',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          ...extraHeaders,
        },
      },
      (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => {
          const text = Buffer.concat(parts).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* ignore */ }
          resolve({ status: res.statusCode, headers: res.headers, json, text });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

test('Native mobile login issues rolling refresh token, rotates on /refresh, rejects replay, and isolates web browsers', async () => {
  const email = `mobile-persist-${Date.now()}@test.local`;
  const password = 'StrongPassword#2026';
  addMockUser({
    _id: `mock-mobile-${Date.now()}`,
    email,
    password,
    name: 'طالب تجريبي',
    role: 'student',
    isActive: true,
    refreshTokenVersion: 0,
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    // 1. Web login MUST set httpOnly cookie and MUST NOT return refreshToken in JSON
    const webLogin = await postJson(port, '/api/auth/login', { email, password });
    assert.equal(webLogin.status, 200);
    assert.ok(webLogin.json?.accessToken, 'web login should return accessToken');
    assert.equal(webLogin.json?.refreshToken, undefined, 'web login must never leak refreshToken in JSON');
    assert.ok(
      String(webLogin.headers['set-cookie'] || '').includes('wn_refresh='),
      'web login must set httpOnly refresh cookie'
    );

    // 2. Browser spoofing X-Client-Platform with Sec-Fetch-Mode MUST NOT receive JSON refreshToken
    const spoofedBrowserLogin = await postJson(
      port,
      '/api/auth/login',
      { email, password },
      { 'X-Client-Platform': 'android', 'Sec-Fetch-Mode': 'cors' }
    );
    assert.equal(spoofedBrowserLogin.status, 200);
    assert.equal(
      spoofedBrowserLogin.json?.refreshToken,
      undefined,
      'browser requests with Sec-Fetch-* must never receive JSON refreshToken'
    );

    // 3. Native mobile login returns both accessToken & long-lived refreshToken (no cookie pollution)
    const mobileLogin = await postJson(
      port,
      '/api/auth/login',
      { email, password },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(mobileLogin.status, 200);
    assert.ok(mobileLogin.json?.accessToken, 'mobile login should return accessToken');
    assert.ok(mobileLogin.json?.refreshToken, 'mobile login should return refreshToken');
    assert.equal(mobileLogin.headers['set-cookie'], undefined, 'mobile login should not pollute OS cookie jar');

    const decodedMobileAccess = jwt.verify(mobileLogin.json.accessToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    const decodedWebAccess = jwt.verify(webLogin.json.accessToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    assert.ok(
      decodedMobileAccess.exp - decodedMobileAccess.iat >= 3600,
      'mobile access token TTL should be >= 1h to avoid mid-lesson classroom drops'
    );
    assert.equal(
      decodedWebAccess.exp - decodedWebAccess.iat,
      900,
      'web access token TTL must remain 15m (900s)'
    );

    const decodedFirst = jwt.verify(mobileLogin.json.refreshToken, process.env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    });
    const ttlDays = (decodedFirst.exp - decodedFirst.iat) / 86400;
    assert.ok(ttlDays >= 30, `mobile refresh token TTL should be >= 30 days (got ${ttlDays.toFixed(1)}d)`);

    // 4. Browser request with Sec-Fetch-Mode cannot use body refreshToken
    const spoofedRefresh = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: mobileLogin.json.refreshToken },
      { 'X-Client-Platform': 'android', 'Sec-Fetch-Mode': 'cors' }
    );
    assert.equal(spoofedRefresh.status, 401);

    // 5. Native mobile refresh rotates both tokens cleanly
    const refreshed = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: mobileLogin.json.refreshToken },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(refreshed.status, 200, `Expected 200 on mobile refresh, got ${refreshed.status}: ${refreshed.text}`);
    assert.ok(refreshed.json?.accessToken);
    assert.ok(refreshed.json?.refreshToken);
    assert.notEqual(refreshed.json.refreshToken, mobileLogin.json.refreshToken, 'refreshToken must rotate');

    // 6. Replaying the already-consumed refresh token fails closed with 401 + REFRESH_TOKEN_REUSED
    const replayed = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: mobileLogin.json.refreshToken },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(replayed.status, 401);
    assert.equal(replayed.json?.code, 'REFRESH_TOKEN_REUSED');

    // 7. After replay revocation, the rotated token is also revoked (refreshTokenVersion bumped)
    const afterRevocation = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: refreshed.json.refreshToken },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(afterRevocation.status, 401);

    // 8. Fresh login + explicit mobile logout revokes refresh token cleanly
    const mobileLogin2 = await postJson(
      port,
      '/api/auth/login',
      { email, password },
      { 'X-Client-Platform': 'ios', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(mobileLogin2.status, 200);
    assert.ok(mobileLogin2.json?.refreshToken);

    const logoutRes = await postJson(
      port,
      '/api/auth/logout',
      { refreshToken: mobileLogin2.json.refreshToken },
      { 'X-Client-Platform': 'ios', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(logoutRes.status, 200);

    const refreshAfterLogout = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: mobileLogin2.json.refreshToken },
      { 'X-Client-Platform': 'ios', 'X-App-Audience': 'student_guardian' }
    );
    assert.equal(refreshAfterLogout.status, 401);

    // 9. Multi-device isolation: logging out on Website MUST NOT log out concurrent Mobile App session!
    const concurrentMobileLogin = await postJson(
      port,
      '/api/auth/login',
      { email, password },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'teacher' }
    );
    assert.equal(concurrentMobileLogin.status, 200);

    const concurrentWebLogin = await postJson(port, '/api/auth/login', { email, password });
    assert.equal(concurrentWebLogin.status, 200);
    const webCookie = String(concurrentWebLogin.headers['set-cookie'] || '').split(';')[0];
    assert.match(webCookie, /^wn_refresh=/);

    // User logs out on Website
    const webLogout = await postJson(
      port,
      '/api/auth/logout',
      {},
      {
        Cookie: webCookie,
        Authorization: `Bearer ${concurrentWebLogin.json.accessToken}`,
      }
    );
    assert.equal(webLogout.status, 200);

    // Web refresh cookie is now revoked
    const webRefreshAfterLogout = await postJson(
      port,
      '/api/auth/refresh',
      {},
      { Cookie: webCookie }
    );
    assert.equal(webRefreshAfterLogout.status, 401);

    // Meanwhile, Mobile App refresh session MUST STILL WORK cleanly!
    const mobileStillAlive = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: concurrentMobileLogin.json.refreshToken },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'teacher' }
    );
    assert.equal(
      mobileStillAlive.status,
      200,
      'Mobile app session must survive single-device logout on web browser'
    );
    assert.ok(mobileStillAlive.json?.accessToken);
    assert.ok(mobileStillAlive.json?.refreshToken);

    // 10. Explicit /api/auth/logout-all revokes ALL devices including mobile
    const logoutAllRes = await postJson(
      port,
      '/api/auth/logout-all',
      {},
      { Authorization: `Bearer ${mobileStillAlive.json.accessToken}` }
    );
    assert.equal(logoutAllRes.status, 200);

    const mobileAfterLogoutAll = await postJson(
      port,
      '/api/auth/refresh',
      { refreshToken: mobileStillAlive.json.refreshToken },
      { 'X-Client-Platform': 'android', 'X-App-Audience': 'teacher' }
    );
    assert.equal(mobileAfterLogoutAll.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
