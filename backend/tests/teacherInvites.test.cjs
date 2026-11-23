'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../app');
const objectStorage = require('../services/objectStorage');
const { updateMockTeacher } = require('../mockStore');
const { generateAccessToken, getAccessSecret } = require('../middleware/auth');
const {
  createTeacherInvite,
  consumeTeacherInviteAtomic,
  rollbackTeacherInviteReservation,
  clearMockInvites,
} = require('../services/teacherInvite');

function requestJson(server, method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined
      ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
      : null;
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

test('temporary teacher invite links: fail-closed public gate, admin RBAC, IP lock (same IP resume + other IP blocked + admin reset), and atomic concurrency', async () => {
  clearMockInvites();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  try {
    const adminId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    const adminToken = generateAccessToken({ id: adminId, role: 'admin', email: 'admin@wahywanamaa.test' });
    const studentToken = generateAccessToken({ id: studentId, role: 'student', email: 'student@wahywanamaa.test' });

    // 1. Permanent public registration without invite token is rejected with 403 INVITE_REQUIRED
    const statusMissing = await requestJson(server, 'GET', '/api/teachers/invite-status');
    assert.equal(statusMissing.status, 403);
    assert.equal(statusMissing.body?.valid, false);
    assert.equal(statusMissing.body?.code, 'INVITE_REQUIRED');

    const verificationToken = jwt.sign(
      { email: 'uninvited-teacher@example.com', purpose: 'teacher-email-verification' },
      getAccessSecret(),
      { expiresIn: '10m' }
    );
    const registerNoInvite = await requestJson(server, 'POST', '/api/teachers/register', {
      body: {
        email: 'uninvited-teacher@example.com',
        password: 'StrongPassword123!',
        verificationToken,
        personalInfo: JSON.stringify({ fullName: 'معلم بدون دعوة', phone: '+201151582113', age: 29, gender: 'male', address: 'القاهرة' }),
      },
    });
    assert.equal(registerNoInvite.status, 403);
    assert.equal(registerNoInvite.body?.code, 'INVITE_REQUIRED');

    // 2. Non-admin roles cannot list or create teacher invite links
    const studentCreate = await requestJson(server, 'POST', '/api/teachers/admin/invites', {
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { label: 'unauthorized', expiresInHours: 12, maxUses: 1 },
    });
    assert.equal(studentCreate.status, 403);

    const studentList = await requestJson(server, 'GET', '/api/teachers/admin/invites', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentList.status, 403);

    // 3. Admin creates an IP-locked temporary invite (default lockToFirstIp: true for maxUses=1)
    const created = await requestJson(server, 'POST', '/api/teachers/admin/invites', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { label: 'دعوة الشيخ أحمد', expiresInHours: 24, maxUses: 1, locale: 'ar' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body?.success, true);
    assert.ok(created.body?.inviteToken && created.body.inviteToken.length >= 32);
    assert.match(String(created.body?.invitePath || ''), /^\/ar\/teacher\/register\?invite=/);
    assert.equal(created.body?.invite?.status, 'active');
    assert.equal(created.body?.invite?.lockToFirstIp, true);
    assert.equal(created.body?.invite?.ipBound, false);
    assert.equal(created.body?.invite?.tokenHash, undefined);

    const inviteId = created.body.invite.id;
    const rawToken = created.body.inviteToken;
    const ipA = '197.45.10.22';
    const ipB = '41.234.88.9';

    // 4. First applicant opens the link from IP A -> binds IP A
    const firstOpen = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipA },
    });
    assert.equal(firstOpen.status, 200);
    assert.equal(firstOpen.body?.valid, true);
    assert.equal(firstOpen.body?.invite?.ipBound, true);

    // 5. Same applicant leaves and comes back again from the SAME IP A -> STILL VALID!
    const returnOpen = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipA },
    });
    assert.equal(returnOpen.status, 200);
    assert.equal(returnOpen.body?.valid, true);

    // Admin sees masked IP (never raw IP, hash, or ciphertext)
    const adminList = await requestJson(server, 'GET', '/api/teachers/admin/invites', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body?.invites?.[0]?.ipBound, true);
    assert.equal(adminList.body?.invites?.[0]?.boundIpMasked, '197.45.*.*');
    assert.equal(adminList.body?.invites?.[0]?.boundIpHash, undefined);
    assert.equal(adminList.body?.invites?.[0]?.tokenHash, undefined);
    assert.equal(adminList.body?.invites?.[0]?.encryptedToken, undefined);

    // 5b. Admin can click-to-reveal the full temporary link; non-admin is blocked (403)
    const studentReveal = await requestJson(server, 'GET', `/api/teachers/admin/invites/${inviteId}/link`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentReveal.status, 403);

    const adminReveal = await requestJson(server, 'GET', `/api/teachers/admin/invites/${inviteId}/link`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminReveal.status, 200);
    assert.equal(adminReveal.body?.success, true);
    assert.equal(adminReveal.body?.inviteToken, rawToken);
    assert.equal(adminReveal.body?.invitePath, `/ar/teacher/register?invite=${encodeURIComponent(rawToken)}`);
    assert.match(String(adminReveal.body?.inviteUrl || ''), new RegExp(`/ar/teacher/register\\?invite=${encodeURIComponent(rawToken)}$`));
    assert.match(String(adminReveal.headers['cache-control'] || ''), /no-store/i);

    const missingReveal = await requestJson(
      server,
      'GET',
      `/api/teachers/admin/invites/${new mongoose.Types.ObjectId().toString()}/link`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.equal(missingReveal.status, 404);

    const badIdReveal = await requestJson(
      server,
      'GET',
      '/api/teachers/admin/invites/not-an-object-id/link',
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.equal(badIdReveal.status, 400);

    // 6. Another person opens the shared link from IP B -> BLOCKED on status, OTP, AND register!
    const otherIpStatus = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipB },
    });
    assert.equal(otherIpStatus.status, 403);
    assert.equal(otherIpStatus.body?.code, 'INVITE_IP_MISMATCH');

    const otherIpOtp = await requestJson(server, 'POST', '/api/auth/send-verification', {
      headers: { 'X-Forwarded-For': ipB },
      body: { email: 'other-person@example.com', inviteToken: rawToken },
    });
    assert.equal(otherIpOtp.status, 403);
    assert.equal(otherIpOtp.body?.code, 'INVITE_IP_MISMATCH');

    const otherIpRegister = await requestJson(server, 'POST', '/api/teachers/register', {
      headers: { 'X-Forwarded-For': ipB },
      body: {
        email: 'uninvited-teacher@example.com',
        password: 'StrongPassword123!',
        verificationToken,
        inviteToken: rawToken,
        personalInfo: JSON.stringify({ fullName: 'شخص آخر', phone: '+201151582113', age: 30, gender: 'male', address: 'القاهرة' }),
      },
    });
    assert.equal(otherIpRegister.status, 403);
    assert.equal(otherIpRegister.body?.code, 'INVITE_IP_MISMATCH');

    // 7. Admin resets IP lock -> IP B can now bind it, and IP A is now rejected
    const resetRes = await requestJson(server, 'POST', `/api/teachers/admin/invites/${inviteId}/reset-ip`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {},
    });
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body?.invite?.ipBound, false);

    const ipBNowAllowed = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipB },
    });
    assert.equal(ipBNowAllowed.status, 200);
    assert.equal(ipBNowAllowed.body?.valid, true);

    const ipANowBlocked = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipA },
    });
    assert.equal(ipANowBlocked.status, 403);
    assert.equal(ipANowBlocked.body?.code, 'INVITE_IP_MISMATCH');

    // 8. Admin revokes and deletes invite
    const revoked = await requestJson(server, 'POST', `/api/teachers/admin/invites/${inviteId}/revoke`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { reason: 'No longer needed' },
    });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body?.invite?.status, 'revoked');

    const revokedCheck = await requestJson(server, 'GET', `/api/teachers/invite-status?token=${encodeURIComponent(rawToken)}`, {
      headers: { 'X-Forwarded-For': ipB },
    });
    assert.equal(revokedCheck.status, 403);
    assert.equal(revokedCheck.body?.code, 'INVITE_REVOKED');

    const deleted = await requestJson(server, 'DELETE', `/api/teachers/admin/invites/${inviteId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleted.status, 200);

    // 9. Concurrency race check: 5 parallel consumes against a maxUses=1 invite allow strictly 1
    const singleUse = await createTeacherInvite({
      createdBy: adminId,
      label: 'race-test',
      expiresInHours: 6,
      maxUses: 1,
      lockToFirstIp: true,
    });
    const attempts = await Promise.all(
      Array.from({ length: 5 }, (_, idx) =>
        consumeTeacherInviteAtomic(singleUse.inviteToken, {
          email: `teacher-${idx}@example.com`,
          name: `Teacher ${idx}`,
          clientIp: ipA,
        })
      )
    );
    const winners = attempts.filter((r) => r.ok);
    const losers = attempts.filter((r) => !r.ok);
    assert.equal(winners.length, 1, 'Expected exactly one concurrent consumer to win a single-use invite');
    assert.equal(losers.length, 4);
    assert.ok(losers.every((r) => r.code === 'INVITE_EXHAUSTED'));

    // 10. Rollback restores the slot for the bound IP when a downstream step fails
    await rollbackTeacherInviteReservation(winners[0]);
    const recheckAfterRollback = await requestJson(
      server,
      'GET',
      `/api/teachers/invite-status?token=${encodeURIComponent(singleUse.inviteToken)}`,
      { headers: { 'X-Forwarded-For': ipA } }
    );
    assert.equal(recheckAfterRollback.status, 200);
    assert.equal(recheckAfterRollback.body?.valid, true);

    // 11. Invited applicant can register directly WITHOUT email OTP verificationToken
    const noOtpEmail = `invited-no-otp-${Date.now()}@example.com`;
    const sanitizedOwner = noOtpEmail.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const origIsOwned = objectStorage.isOwnedObjectReference;
    const seenOwners = [];
    objectStorage.isOwnedObjectReference = (ref, purpose, owner) => {
      seenOwners.push(owner);
      return objectStorage.referenceMatches(ref, purpose, owner);
    };
    let directNoOtpRes;
    try {
      directNoOtpRes = await requestJson(server, 'POST', '/api/teachers/register', {
        headers: { 'X-Forwarded-For': ipA },
        body: {
          email: noOtpEmail,
          password: 'StrongPassword123!',
          inviteToken: singleUse.inviteToken,
          personalInfo: JSON.stringify({
            fullName: 'الأستاذة سارة محمود',
            phone: '+201012345678',
            age: 27,
            gender: 'female',
            country: 'مصر',
            city: 'القاهرة',
            address: 'القاهرة',
          }),
          academicInfo: JSON.stringify({
            university: 'جامعة الأزهر',
            faculty: 'الدراسات الإسلامية',
            graduationYear: 2021,
            specialization: 'تحفيظ قرآن',
            qualification: 'خريج',
          }),
          quranInfo: JSON.stringify({
            memorizedParts: 30,
            teachingExperience: 4,
            specializations: ['women', 'tajweed'],
          }),
          languages: JSON.stringify(['arabic']),
          uploadedFiles: JSON.stringify({
            profilePhoto: { pathname: `uploads/teacher-public/${sanitizedOwner}/photo.jpg` },
            recitationVideo: [{ pathname: `uploads/teacher-public/${sanitizedOwner}/recite.mp4` }],
          }),
        },
      });
    } finally {
      objectStorage.isOwnedObjectReference = origIsOwned;
    }
    assert.equal(directNoOtpRes.status, 201, `Expected 201 for invite-backed no-OTP registration, got ${directNoOtpRes.status}: ${directNoOtpRes.text}`);
    assert.equal(directNoOtpRes.body?.success, true);
    assert.ok(seenOwners.length >= 2 && seenOwners.every((owner) => owner === noOtpEmail));

    // Invite is now exhausted after the single-use registration completed
    const afterUseCheck = await requestJson(
      server,
      'GET',
      `/api/teachers/invite-status?token=${encodeURIComponent(singleUse.inviteToken)}`,
      { headers: { 'X-Forwarded-For': ipA } }
    );
    assert.equal(afterUseCheck.status, 403);
    assert.equal(afterUseCheck.body?.code, 'INVITE_EXHAUSTED');

    // 12. Phone-only registration (NO email, NO OTP) + login with local or international phone number
    const phoneOnlyInvite = await createTeacherInvite({
      createdBy: adminId,
      label: 'phone-only-teacher',
      expiresInHours: 6,
      maxUses: 1,
      lockToFirstIp: true,
    });
    const uniqueLocalPhone = `010${String(Date.now()).slice(-8)}`;
    const expectedPhoneOwner = `teacher-phone-20${uniqueLocalPhone.slice(1)}@phone.wahywanamaa.local`;
    const sanitizedPhoneOwner = expectedPhoneOwner.replace(/[^a-z0-9._-]+/g, '-');

    const origIsOwned2 = objectStorage.isOwnedObjectReference;
    objectStorage.isOwnedObjectReference = (ref, purpose, owner) => objectStorage.referenceMatches(ref, purpose, owner);
    let phoneOnlyReg;
    try {
      phoneOnlyReg = await requestJson(server, 'POST', '/api/teachers/register', {
        headers: { 'X-Forwarded-For': ipA },
        body: {
          email: '',
          phone: uniqueLocalPhone,
          password: 'PhoneOnlyPass123!',
          inviteToken: phoneOnlyInvite.inviteToken,
          personalInfo: JSON.stringify({
            fullName: 'الأستاذة فاطمة علي',
            phone: uniqueLocalPhone,
            age: 32,
            gender: 'female',
            country: 'مصر',
            city: 'الجيزة',
            address: 'الجيزة',
          }),
          academicInfo: JSON.stringify({
            university: 'جامعة الأزهر',
            faculty: 'الدراسات الإسلامية',
            graduationYear: 2017,
            specialization: 'تحفيظ قرآن',
            qualification: 'خريج',
          }),
          quranInfo: JSON.stringify({
            memorizedParts: 30,
            teachingExperience: 7,
            specializations: ['women'],
          }),
          languages: JSON.stringify(['arabic']),
          uploadedFiles: JSON.stringify({
            profilePhoto: { pathname: `uploads/teacher-public/${sanitizedPhoneOwner}/photo.jpg` },
            recitationVideo: [{ pathname: `uploads/teacher-public/${sanitizedPhoneOwner}/recite.mp4` }],
          }),
        },
      });
    } finally {
      objectStorage.isOwnedObjectReference = origIsOwned2;
    }
    assert.equal(phoneOnlyReg.status, 201, `Expected 201 for phone-only registration, got ${phoneOnlyReg.status}: ${phoneOnlyReg.text}`);
    assert.equal(phoneOnlyReg.body?.success, true);

    // Pending teacher gets 403 approval gate when logging in by phone
    const pendingPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: uniqueLocalPhone, password: 'PhoneOnlyPass123!' },
    });
    assert.equal(pendingPhoneLogin.status, 403);
    assert.equal(pendingPhoneLogin.body?.code, 'TEACHER_APPROVAL_PENDING');

    // Once admin approves, teacher logs in smoothly with local phone OR international phone
    updateMockTeacher(phoneOnlyReg.body.teacher._id, { status: 'approved', isVerified: true });

    const localPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: uniqueLocalPhone, password: 'PhoneOnlyPass123!' },
    });
    assert.equal(localPhoneLogin.status, 200);
    assert.ok(localPhoneLogin.body?.accessToken);

    const intlPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: `+20${uniqueLocalPhone.slice(1)}`, password: 'PhoneOnlyPass123!' },
    });
    assert.equal(intlPhoneLogin.status, 200);
    assert.ok(intlPhoneLogin.body?.accessToken);

    const wrongPassPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: uniqueLocalPhone, password: 'WrongPassword123!' },
    });
    assert.equal(wrongPassPhoneLogin.status, 401);

    // 13. Public student & guardian phone-only registration (email optional) + phone login
    const studentPhone = `011${String(Date.now()).slice(-8)}`;
    const studentPhoneReg = await requestJson(server, 'POST', '/api/auth/register', {
      body: {
        name: 'طالب برقم الهاتف',
        email: '',
        phone: studentPhone,
        password: 'StudentPhonePass123!',
        role: 'student',
      },
    });
    assert.equal(studentPhoneReg.status, 201, `Expected 201 for student phone-only register, got ${studentPhoneReg.status}: ${studentPhoneReg.text}`);
    assert.ok(studentPhoneReg.body?.accessToken);

    const studentPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: studentPhone, password: 'StudentPhonePass123!' },
    });
    assert.equal(studentPhoneLogin.status, 200);
    assert.ok(studentPhoneLogin.body?.accessToken);

    const guardianPhone = `012${String(Date.now()).slice(-8)}`;
    const guardianPhoneReg = await requestJson(server, 'POST', '/api/auth/register', {
      body: {
        name: 'ولي أمر برقم الهاتف',
        email: '',
        phone: guardianPhone,
        password: 'GuardianPhonePass123!',
        role: 'guardian',
      },
    });
    assert.equal(guardianPhoneReg.status, 201, `Expected 201 for guardian phone-only register, got ${guardianPhoneReg.status}: ${guardianPhoneReg.text}`);
    assert.ok(guardianPhoneReg.body?.accessToken);

    const guardianPhoneLogin = await requestJson(server, 'POST', '/api/auth/login', {
      body: { email: guardianPhone, password: 'GuardianPhonePass123!' },
    });
    assert.equal(guardianPhoneLogin.status, 200);
    assert.ok(guardianPhoneLogin.body?.accessToken);

    // 14. Admin add-teacher phone-only (email optional)
    const adminTeacherPhone = `015${String(Date.now()).slice(-8)}`;
    const adminAddTeacherRes = await requestJson(server, 'POST', '/api/admin/teachers', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'معلمة من لوحة الإدارة',
        email: '',
        phone: adminTeacherPhone,
        password: 'AdminTeacherPass123!',
      },
    });
    assert.equal(adminAddTeacherRes.status, 201, `Expected 201 for admin phone-only teacher create, got ${adminAddTeacherRes.status}: ${adminAddTeacherRes.text}`);
  } finally {
    clearMockInvites();
    await new Promise((resolve) => server.close(resolve));
  }
});
