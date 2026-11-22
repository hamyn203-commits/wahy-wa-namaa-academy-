const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-support-audio-only';

const app = require('../app');
const { generateAccessToken } = require('../middleware/auth');
const User = require('../models/User');
const SupportMessage = require('../models/SupportMessage');
const Notification = require('../models/Notification');

function makeToken(user) {
  return generateAccessToken(user);
}

function buildMultipart(fields, file) {
  const boundary = '----WwnSupportAudioTestBoundary77';
  const chunks = [];
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
      )
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    boundary,
    body: Buffer.concat(chunks),
  };
}

function postRaw(port, urlPath, token, { boundary, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: 'http://localhost:5173',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const parts = [];
        res.on('data', (c) => parts.push(c));
        res.on('end', () => {
          const text = Buffer.concat(parts).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { /* ignore */ }
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

test('Support audio upload validates magic bytes and never leaks storage path', async () => {
  const studentId = new mongoose.Types.ObjectId();
  const studentUser = { _id: studentId, role: 'student', name: 'Test Student', email: 's@test.local', isActive: true };
  const token = makeToken(studentUser);

  const origFindOne = User.findOne;
  const origFindById = User.findById;
  const origUserFind = User.find;
  const origMsgUpdate = SupportMessage.findOneAndUpdate;
  const origNoticeUpdate = Notification.findOneAndUpdate;

  const createdPaths = [];

  User.findById = () => ({
    select: () => ({
      lean: async () => studentUser,
    }),
  });
  User.findOne = () => ({
    select: async () => studentUser,
  });
  User.find = () => ({
    select: () => ({
      lean: async () => [],
    }),
  });
  SupportMessage.findOneAndUpdate = async (_filter, update) => {
    const doc = update.$setOnInsert;
    if (doc.audioPath) createdPaths.push(doc.audioPath);
    return {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      createdAt: new Date(),
      toObject() {
        return { _id: this._id, ...doc, createdAt: this.createdAt };
      },
    };
  };
  Notification.findOneAndUpdate = async () => ({ toObject: () => ({}) });

  const server = app.listen(0);
  const { port } = server.address();

  try {
    // 1. Spoofed audio file (plain text masquerading as WAV) MUST be rejected
    const badForm = buildMultipart(
      { clientId: 'test_audio_bad_0001', durationSeconds: '5' },
      { field: 'audio', filename: 'fake.wav', contentType: 'audio/wav', buffer: Buffer.from('not-a-wav-file') }
    );
    const badRes = await postRaw(port, `/api/support/${studentId}/audio`, token, badForm);
    assert.equal(badRes.status, 400, `Unexpected badRes: ${badRes.text}`);
    assert.equal(badRes.json?.code, 'INVALID_FILE_MAGIC_BYTES');

    // 2. Valid WAV magic header (RIFF....WAVE) MUST succeed and omit audioPath from response
    const validWav = Buffer.from('524946462400000057415645666d74201000000001000100401f0000401f0000010008006461746100000000', 'hex');
    const goodForm = buildMultipart(
      { clientId: 'test_audio_good_0001', durationSeconds: '7' },
      { field: 'audio', filename: 'voice.wav', contentType: 'audio/wav', buffer: validWav }
    );
    const goodRes = await postRaw(port, `/api/support/${studentId}/audio`, token, goodForm);
    assert.equal(goodRes.status, 201, `Unexpected goodRes: ${goodRes.text}`);
    assert.equal(goodRes.json?.message?.hasAudio, true);
    assert.equal(goodRes.json?.message?.audioDuration, 7);
    assert.equal(goodRes.json?.message?.audioPath, undefined);
  } finally {
    server.close();
    User.findOne = origFindOne;
    User.findById = origFindById;
    User.find = origUserFind;
    SupportMessage.findOneAndUpdate = origMsgUpdate;
    Notification.findOneAndUpdate = origNoticeUpdate;
    for (const p of createdPaths) {
      if (p && p.startsWith(path.resolve(process.cwd(), 'uploads')) && fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* ignore */ }
      }
    }
  }
});
