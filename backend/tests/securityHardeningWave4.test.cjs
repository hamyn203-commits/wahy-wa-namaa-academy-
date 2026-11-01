'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');

function requestJson(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? (Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          ...(payload && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
          ...(payload ? { 'Content-Length': payload.length } : {}),
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
          resolve({ status: res.statusCode, headers: res.headers, body: json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Security Wave 4: AI role guards, magic-byte audio verification, leaderboard allowlist, review ID validation, and prototype pollution guard', async () => {
  const server = app.listen(0);
  try {
    const studentToken = generateAccessToken({
      id: '507f1f77bcf86cd799439011',
      email: 'student-sec@example.com',
      role: 'student',
    });
    const guardianToken = generateAccessToken({
      id: '507f1f77bcf86cd799439012',
      email: 'guardian-sec@example.com',
      role: 'guardian',
    });

    // 1. Student cannot access /api/ai/status (Admin-only) or /api/ai/teacher-assistant (Teacher/Admin-only)
    const statusRes = await requestJson(server, 'GET', '/api/ai/status', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(statusRes.status, 403);

    const teacherAiRes = await requestJson(server, 'POST', '/api/ai/teacher-assistant', {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { prompt: 'Test prompt' },
    });
    assert.equal(teacherAiRes.status, 403);

    // 2. Oversized AI prompt (> 1500 chars) is rejected with 400
    const longQuestionRes = await requestJson(server, 'POST', '/api/ai/quran-assistant', {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { question: 'أ'.repeat(1600) },
    });
    assert.equal(longQuestionRes.status, 400);

    // 3. Spoofed audio upload with non-audio magic bytes is rejected by /api/ai/recitation-analyze
    const boundary = '----WebKitFormBoundarySecTest123';
    const fakeMp3Payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="audio"; filename="spoof.mp3"\r\n' +
        'Content-Type: audio/mpeg\r\n\r\n'
      ),
      Buffer.from('MZ-FAKE-EXECUTABLE-HEADER-NOT-MP3'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const spoofAudioRes = await requestJson(server, 'POST', '/api/ai/recitation-analyze', {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: fakeMp3Payload,
    });
    assert.equal(spoofAudioRes.status, 400);
    assert.equal(spoofAudioRes.body?.code, 'INVALID_AUDIO_MAGIC_BYTES');

    // 4. Unwhitelisted leaderboard type/timeframe is rejected with 400
    const leaderboardRes = await requestJson(
      server,
      'GET',
      '/api/gamification/leaderboard/arbitrary_collection/eternal'
    );
    assert.equal(leaderboardRes.status, 400);

    // 5. Invalid teacher ObjectId on public reviews endpoint is rejected with 400
    const reviewInvalidIdRes = await requestJson(
      server,
      'GET',
      '/api/reviews/teacher/not-a-valid-object-id'
    );
    assert.equal(reviewInvalidIdRes.status, 400);

    // 6. Guardian cannot inject an arbitrary external avatar URL via PATCH /api/auth/me
    const avatarRes = await requestJson(server, 'PATCH', '/api/auth/me', {
      headers: { Authorization: `Bearer ${guardianToken}` },
      body: { avatar: 'https://evil-tracker.example.com/pixel.png' },
    });
    assert.equal(avatarRes.status, 400);
    assert.match(String(avatarRes.body?.error || ''), /Invalid avatar reference/);

    // 7. Prototype pollution keys (__proto__, constructor, prototype) in JSON body do not pollute Object.prototype
    await requestJson(server, 'POST', '/api/ai/quran-assistant', {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: '{"question":"ما فضل سورة البقرة؟","__proto__":{"pollutedKey":"yes"},"constructor":{"prototype":{"pollutedKey":"yes"}}}',
    });
    assert.equal(({}).pollutedKey, undefined);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
