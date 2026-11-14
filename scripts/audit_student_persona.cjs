const http = require('http');
const path = require('path');
const fs = require('fs');

// Set environment for test run
process.env.PORT = '4005';
process.env.NODE_ENV = 'development';
process.env.DISABLE_RATE_LIMIT = 'true';

// Start server
require('../backend/server');

function request(options, data = null, isFormData = false) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(body); } catch { json = body; }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) {
      if (isFormData) {
        req.write(data);
      } else {
        req.write(typeof data === 'string' ? data : JSON.stringify(data));
      }
    }
    req.end();
  });
}

function createMultipartBody(boundary, fields, files) {
  const crlf = "\r\n";
  let parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(`--${boundary}${crlf}`);
    parts.push(`Content-Disposition: form-data; name="${key}"${crlf}${crlf}`);
    parts.push(`${value}${crlf}`);
  }

  for (const file of files) {
    parts.push(`--${boundary}${crlf}`);
    parts.push(`Content-Disposition: form-data; name="${file.field}"; filename="${file.filename}"${crlf}`);
    parts.push(`Content-Type: ${file.contentType}${crlf}${crlf}`);
    parts.push(file.content);
    parts.push(crlf);
  }

  parts.push(`--${boundary}--${crlf}`);
  return Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p, 'utf8') : p));
}

async function runStudentAudit() {
  console.log('===============================================================');
  console.log('📖 فحص شامل وتدقيق لرحلة الطالب الجديد (New Student Persona)');
  console.log('أكاديمية وَحْيٌ وَنَمَاء — تدقيق الوظائف والعزل الأمني وتجربة الطالب');
  console.log('===============================================================\n');

  // Wait 1 second for server to initialize
  await new Promise(r => setTimeout(r, 1000));

  const PORT = 4005;
  const results = {
    journey: { passed: [], failed: [], warnings: [] },
    isolation: { passed: [], failed: [], warnings: [] },
    vulnerabilities: []
  };

  // Helper
  const logStep = (title) => console.log(`\n🔹 ${title}`);

  // --------------------------------------------------------------------------
  // المرحلة 1: حجز الحصة التجريبية مجاناً (Free Trial)
  // --------------------------------------------------------------------------
  logStep('المرحلة 1: تجربة حجز الحصة التجريبية (Free Trial Funnel)');

  // 1.1 اختبار البيلود الذي ترسله صفحة FreeTrial.jsx بالضبط
  const freeTrialPayloadFromUI = {
    referenceNumber: 'ATHAR-TR-789012',
    track: 'memorization',
    studentName: 'عبد الرحمن أحمد',
    age: 9,
    gender: 'male',
    currentLevel: 'beginner',
    guardianName: 'أحمد محمود',
    countryCode: '+966',
    whatsapp: '+966501234567',
    email: 'abdulrahman.parent@example.com',
    preferredPeriod: 'evening',
    preferredDay: 'tomorrow',
    notes: 'نرجو التركيز على تصحيح مخارج الحروف'
  };

  const trialResUI = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/trials', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, freeTrialPayloadFromUI);

  if (trialResUI.status === 201) {
    results.journey.passed.push('حجز الحصة التجريبية بالبيانات القياسية من الواجهة (201 Created)');
    console.log('  ✅ تم استقبال طلب الحصة التجريبية بنجاح 201');
  } else {
    results.journey.failed.push(`فشل حجز الحصة التجريبية عبر بيانات الواجهة: رمز ${trialResUI.status} - ${JSON.stringify(trialResUI.data)}`);
    console.log(`  ❌ فشل حجز الحصة: رمز ${trialResUI.status} - الخطأ: ${trialResUI.data?.error || JSON.stringify(trialResUI.data)}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 2: تسجيل حساب طالب جديد (Register with role: 'student')
  // --------------------------------------------------------------------------
  logStep('المرحلة 2: تسجيل حساب طالب جديد (Register Student)');

  const testEmail = `student_${Date.now()}@alathar.test`;
  const testPassword = 'SecureStudentPass2026!';
  const regPayload = {
    name: 'عبد الرحمن أحمد',
    email: testEmail,
    phone: '+966501234567',
    password: testPassword,
    role: 'student'
  };

  const regRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, regPayload);

  let studentToken = null;

  if (regRes.status === 201 && (regRes.data.accessToken || regRes.data.token)) {
    studentToken = regRes.data.accessToken || regRes.data.token;
    const studentUser = regRes.data.user;
    results.journey.passed.push('تسجيل حساب طالب جديد عبر POST /api/auth/register وحصوله على JWT Token');
    console.log(`  ✅ تم إنشاء الحساب بنجاح: Role = ${studentUser.role}, ID = ${studentUser._id || studentUser.id}`);
  } else {
    results.journey.failed.push(`فشل تسجيل حساب الطالب: ${regRes.status} - ${JSON.stringify(regRes.data)}`);
    console.log('  ❌ فشل تسجيل حساب الطالب!');
  }

  // 2.2 تسجيل الدخول Login
  logStep('المرحلة 2.2: تسجيل الدخول كطالب (Login Student)');
  const loginRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testEmail, password: testPassword });

  if (loginRes.status === 200 && (loginRes.data.accessToken || loginRes.data.token)) {
    studentToken = loginRes.data.accessToken || loginRes.data.token;
    results.journey.passed.push('تسجيل الدخول كطالب واستلام Access Token جديد بنجاح');
    console.log('  ✅ تم تسجيل الدخول بنجاح');
  } else {
    results.journey.failed.push(`فشل تسجيل دخول الطالب: ${loginRes.status}`);
    console.log('  ❌ فشل تسجيل الدخول');
  }

  const authHeaders = { 'Authorization': `Bearer ${studentToken}` };

  // --------------------------------------------------------------------------
  // المرحلة 3: لوحة تحكم الطالب (Student Dashboard Endpoints)
  // --------------------------------------------------------------------------
  logStep('المرحلة 3: فحص بوابات لوحة الطالب (Student Dashboard Data)');

  // 3.1 Profile
  const profRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students/dashboard/profile', method: 'GET',
    headers: authHeaders
  });
  if (profRes.status === 200 && (profRes.data.user || profRes.data.profile)) {
    results.journey.passed.push('جلب الملف التعريفي للطالب GET /api/students/dashboard/profile بنجاح');
    console.log('  ✅ جلب الملف الشخصي للطالب: 200 OK');
  } else {
    results.journey.failed.push(`الملف الشخصي للطالب: ${profRes.status}`);
    console.log(`  ❌ فشل جلب الملف الشخصي: ${profRes.status}`);
  }

  // 3.2 Stats
  const statsRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students/dashboard/stats', method: 'GET',
    headers: authHeaders
  });
  if (statsRes.status === 200) {
    results.journey.passed.push('جلب إحصائيات الطالب GET /api/students/dashboard/stats بنجاح');
    console.log('  ✅ إحصائيات الطالب: 200 OK');
  } else {
    results.journey.failed.push(`إحصائيات الطالب: ${statsRes.status}`);
    console.log(`  ❌ فشل إحصائيات الطالب: ${statsRes.status}`);
  }

  // 3.3 Teachers
  const teachersRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students/dashboard/teachers', method: 'GET',
    headers: authHeaders
  });
  if (teachersRes.status === 200) {
    results.journey.passed.push('جلب قائمة المعلمين المرتبطين بالطالب GET /api/students/dashboard/teachers بنجاح');
    console.log('  ✅ معلمو الطالب: 200 OK');
  } else {
    results.journey.failed.push(`معلمو الطالب: ${teachersRes.status}`);
    console.log(`  ❌ فشل جلب معلمي الطالب: ${teachersRes.status}`);
  }

  // 3.4 Sessions
  const sessionsRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/sessions/my-sessions?type=regular&limit=10', method: 'GET',
    headers: authHeaders
  });
  if (sessionsRes.status === 200) {
    results.journey.passed.push('جلب حصص الطالب GET /api/sessions/my-sessions بنجاح');
    console.log('  ✅ حصص الطالب: 200 OK');
  } else {
    results.journey.failed.push(`حصص الطالب: ${sessionsRes.status}`);
    console.log(`  ❌ فشل جلب حصص الطالب: ${sessionsRes.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 4: تصفح المنهج والدروس التفاعلية (LMS)
  // --------------------------------------------------------------------------
  logStep('المرحلة 4: نظام المناهج والدروس التفاعلية (LMS Course & Lessons)');

  const lmsCourseRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/lms/course/easy-tajweed', method: 'GET',
    headers: authHeaders
  });
  if (lmsCourseRes.status === 200 && lmsCourseRes.data.course) {
    results.journey.passed.push('استعراض الدورة والدروس التفاعلية GET /api/lms/course/:slug بنجاح');
    console.log(`  ✅ استعراض دورة: ${lmsCourseRes.data.course.title} (دروس: ${lmsCourseRes.data.lessons?.length || 0})`);
  } else {
    results.journey.failed.push(`استعراض دورة LMS: ${lmsCourseRes.status}`);
    console.log(`  ❌ فشل استعراض دورة LMS: ${lmsCourseRes.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 5: تسليم الواجب الصوتي والتسميع (Audio Homework)
  // --------------------------------------------------------------------------
  logStep('المرحلة 5: فحص الواجبات وتسليم التسميع الصوتي (Audio Homework)');

  // 5.1 قائمة الواجبات
  const hwListRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/homework/student', method: 'GET',
    headers: authHeaders
  });
  if (hwListRes.status === 200 && Array.isArray(hwListRes.data.homework)) {
    results.journey.passed.push('جلب واجبات الطالب GET /api/homework/student بنجاح');
    console.log(`  ✅ واجبات الطالب: 200 OK (عدد الواجبات: ${hwListRes.data.homework.length})`);
  } else {
    results.journey.failed.push(`جلب واجبات الطالب: ${hwListRes.status}`);
    console.log(`  ❌ فشل جلب واجبات الطالب: ${hwListRes.status}`);
  }

  // 5.2 اختبار رفع ملف صوتي بصيغة webm (تسجيل الميكروفون المباشر المتصفح)
  const boundary = '----WebKitFormBoundaryAtharTest' + Date.now();
  const dummyWebmAudio = Buffer.from('FAKE-WEBM-AUDIO-HEADER-DATA');
  const multipartBodyWebm = createMultipartBody(
    boundary,
    { notes: 'تسليم تلاوة سورة مريم بصوت الطالب عبر الميكروفون' },
    [{ field: 'submission', filename: 'recitation.webm', contentType: 'audio/webm', content: dummyWebmAudio }]
  );

  const hwSubmitWebmRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/homework/mock-hw-1/submit', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBodyWebm.length
    }
  }, multipartBodyWebm, true);

  if (hwSubmitWebmRes.status === 200 || hwSubmitWebmRes.status === 201) {
    results.journey.passed.push('تسليم الواجب الصوتي بصيغة webm عبر الميكروفون (200 OK)');
    console.log('  ✅ تسليم تلاوة بصيغة webm بنجاح');
  } else {
    results.journey.failed.push(`فشل تسليم تلاوة webm: ${hwSubmitWebmRes.status} - ${JSON.stringify(hwSubmitWebmRes.data)}`);
    console.log(`  ⚠️ تنبيه بخصوص صيغة webm: ${hwSubmitWebmRes.status} - ${hwSubmitWebmRes.data?.error || JSON.stringify(hwSubmitWebmRes.data)}`);
  }

  // 5.3 اختبار رفع ملف صوتي بصيغة mp3
  const dummyMp3Audio = Buffer.from('FAKE-MP3-AUDIO-DATA');
  const multipartBodyMp3 = createMultipartBody(
    boundary,
    { notes: 'تسليم تلاوة MP3' },
    [{ field: 'submission', filename: 'recitation.mp3', contentType: 'audio/mpeg', content: dummyMp3Audio }]
  );

  const hwSubmitMp3Res = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/homework/mock-hw-1/submit', method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBodyMp3.length
    }
  }, multipartBodyMp3, true);

  if (hwSubmitMp3Res.status === 200 || hwSubmitMp3Res.status === 201) {
    results.journey.passed.push('تسليم الواجب الصوتي بصيغة mp3 بنجاح (200 OK)');
    console.log('  ✅ تسليم تلاوة بصيغة mp3 بنجاح: 200 OK');
  } else {
    results.journey.failed.push(`فشل تسليم تلاوة mp3: ${hwSubmitMp3Res.status}`);
    console.log(`  ❌ فشل تسليم mp3: ${hwSubmitMp3Res.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 6: تقييمات المعلم ونقاط التجويد (Evaluations)
  // --------------------------------------------------------------------------
  logStep('المرحلة 6: مراجعة تقييمات المعلم ونقاط التجويد (Teacher Evaluations)');

  const evalRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students/dashboard/evaluations', method: 'GET',
    headers: authHeaders
  });
  if (evalRes.status === 200 && Array.isArray(evalRes.data.evaluations)) {
    results.journey.passed.push('جلب تقييمات المعلم مع معايير التجويد والحفظ الخمسة (200 OK)');
    const sample = evalRes.data.evaluations[0]?.teacherEvaluation;
    console.log(`  ✅ استعراض التقييمات: 200 OK (تجويد: ${sample?.tajweed || 5}/5، حفظ: ${sample?.memorization || 5}/5)`);
  } else {
    results.journey.failed.push(`جلب تقييمات المعلم: ${evalRes.status}`);
    console.log(`  ❌ فشل جلب تقييمات المعلم: ${evalRes.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 7: نظام التحفيز والشارات والمتصدرين (Gamification)
  // --------------------------------------------------------------------------
  logStep('المرحلة 7: نظام التحفيز والشارات والمتصدرين (Gamification & Badges)');

  // 7.1 Gamification Stats
  const gameStatsRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/gamification/stats', method: 'GET',
    headers: authHeaders
  });
  if (gameStatsRes.status === 200) {
    results.journey.passed.push('جلب نقاط الطالب ورتبته وسلسلة التزامه GET /api/gamification/stats بنجاح');
    console.log(`  ✅ نقاط الطالب: ${gameStatsRes.data.points?.total || 0} نقطة، المستوى ${gameStatsRes.data.points?.level || 1}`);
  } else {
    results.journey.failed.push(`جلب نقاط Gamification: ${gameStatsRes.status}`);
  }

  // 7.2 My Badges
  const myBadgesRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/gamification/my-badges', method: 'GET',
    headers: authHeaders
  });
  if (myBadgesRes.status === 200) {
    results.journey.passed.push('جلب أوسمة وشارات الطالب GET /api/gamification/my-badges بنجاح');
    console.log(`  ✅ شارات الطالب: ${myBadgesRes.data.unlocked?.length || 0} مكتسبة`);
  } else {
    results.journey.failed.push(`شارات الطالب: ${myBadgesRes.status}`);
  }

  // 7.3 Leaderboard
  const lbRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/gamification/leaderboard/points/all-time', method: 'GET',
    headers: authHeaders
  });
  if (lbRes.status === 200 && Array.isArray(lbRes.data.entries)) {
    results.journey.passed.push('لوحة المتصدرين GET /api/gamification/leaderboard/... بنجاح');
    console.log(`  ✅ لوحة المتصدرين: 200 OK (عدد المتصدرين: ${lbRes.data.entries.length})`);
  } else {
    results.journey.failed.push(`لوحة المتصدرين: ${lbRes.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 8: نظام الشهادات (Certificates)
  // --------------------------------------------------------------------------
  logStep('المرحلة 8: فحص نظام الشهادات والتحقق منها (Certificates)');

  const myCertsRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/certificates/my-certificates', method: 'GET',
    headers: authHeaders
  });
  if (myCertsRes.status === 200 && Array.isArray(myCertsRes.data)) {
    results.journey.passed.push('جلب شهادات الطالب GET /api/certificates/my-certificates بنجاح');
    console.log(`  ✅ شهادات الطالب: 200 OK (عدد الشهادات: ${myCertsRes.data.length})`);
  } else {
    results.journey.failed.push(`شهادات الطالب: ${myCertsRes.status}`);
  }

  // 8.2 فحص شهادة مفردة بالـ ID
  const certId = 'ATHAR-2026-001';
  const singleCertRes = await request({
    hostname: '127.0.0.1', port: PORT, path: `/api/certificates/${certId}`, method: 'GET'
  });
  if (singleCertRes.status === 200) {
    results.journey.passed.push(`عرض الشهادة المفردة GET /api/certificates/${certId} بنجاح`);
    console.log(`  ✅ عرض الشهادة ${certId}: 200 OK`);
  } else {
    results.journey.failed.push(`عرض الشهادة المفردة ${certId}: رمز ${singleCertRes.status} (عدم وجود fallback في mock mode)`);
    console.log(`  ⚠️ عرض الشهادة المفردة ${certId}: رمز ${singleCertRes.status}`);
  }

  // --------------------------------------------------------------------------
  // المرحلة 9: فحص العزل الأمني وعدم التداخل (Role Isolation & Security)
  // --------------------------------------------------------------------------
  logStep('المرحلة 9: فحص العزل الأمني الصارم (Role Isolation Security Tests)');

  // 9.1 محاولة الطالب الوصول للوحة المدير Admin Stats
  const secAdminStats = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/admin/stats', method: 'GET',
    headers: authHeaders
  });
  if (secAdminStats.status === 403) {
    results.isolation.passed.push('منع الطالب من الوصول لإحصائيات الإدارة /api/admin/stats (403 Forbidden)');
    console.log('  🔒 منع الطالب من لوحة الإدارة: 403 Forbidden [مؤمن]');
  } else {
    results.isolation.failed.push(`ثغرة: الطالب استطاع الوصول إلى /api/admin/stats برمز ${secAdminStats.status}`);
    console.log(`  🚨 ثغرة أمنية: الطالب وصل لإحصائيات الإدارة برمز ${secAdminStats.status}`);
  }

  // 9.2 محاولة الطالب الوصول للوحة المعلم Teacher Dashboard
  const secTeacherProfile = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/teachers/dashboard/profile', method: 'GET',
    headers: authHeaders
  });
  if (secTeacherProfile.status === 403) {
    results.isolation.passed.push('منع الطالب من الوصول لملف المعلم الداخلي /api/teachers/dashboard/profile (403 Forbidden)');
    console.log('  🔒 منع الطالب من بوابة المعلم: 403 Forbidden [مؤمن]');
  } else {
    results.isolation.failed.push(`ثغرة: الطالب استطاع الوصول إلى لوحة المعلم برمز ${secTeacherProfile.status}`);
  }

  // 9.3 محاولة الطالب الوصول لمهام المعلم Teacher Tasks
  const secTeacherTasks = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/teachers/dashboard/tasks', method: 'GET',
    headers: authHeaders
  });
  if (secTeacherTasks.status === 403) {
    results.isolation.passed.push('منع الطالب من جلب مهام المعلم /api/teachers/dashboard/tasks (403 Forbidden)');
    console.log('  🔒 منع الطالب من مهام المعلم: 403 Forbidden [مؤمن]');
  } else {
    results.isolation.failed.push(`ثغرة: الطالب استطاع الوصول لمهام المعلم برمز ${secTeacherTasks.status}`);
  }

  // 9.4 محاولة الطالب الوصول لبيانات أولياء الأمور وأبنائهم Guardian Children
  const secGuardianKids = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/guardian/children', method: 'GET',
    headers: authHeaders
  });
  if (secGuardianKids.status === 403) {
    results.isolation.passed.push('منع الطالب من الوصول لبوابة ولي الأمر /api/guardian/children (403 Forbidden)');
    console.log('  🔒 منع الطالب من بوابة أولياء الأمور: 403 Forbidden [مؤمن]');
  } else {
    results.isolation.failed.push(`ثغرة: الطالب استطاع الوصول لبوابة ولي الأمر برمز ${secGuardianKids.status}`);
  }

  // 9.5 فحص تسريب بيانات الطلاب عبر مسار GET /api/students
  const secStudentsList = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students', method: 'GET'
  });
  if (secStudentsList.status === 401 || secStudentsList.status === 403) {
    results.isolation.passed.push('مسار GET /api/students محمي بالصلاحيات ولا يسرب بيانات الطلاب');
  } else {
    results.vulnerabilities.push({
      severity: 'High',
      title: 'Information Disclosure: GET /api/students is unauthenticated',
      detail: `مسار GET /api/students متاح علناً بدون أي حماية ويعيد قائمة الطلاب (رمز ${secStudentsList.status})`
    });
    console.log(`  ⚠️ ثغرة تسريب بيانات: GET /api/students متاح علناً بدون توثيق (رمز ${secStudentsList.status})`);
  }

  // 9.6 فحص تعديل بيانات أي طالب عبر PATCH /api/students/:id (IDOR)
  const secStudentPatch = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/students/1', method: 'PATCH',
    headers: { ...authHeaders, 'Content-Type': 'application/json' }
  }, { points: 99999 });

  if (secStudentPatch.status === 403) {
    results.isolation.passed.push('منع الطالب من التعديل على بيانات طلاب آخرين عبر PATCH /api/students/:id');
  } else {
    results.vulnerabilities.push({
      severity: 'Critical',
      title: 'BOLA / IDOR on PATCH /api/students/:id',
      detail: `مسار PATCH /api/students/:id لا يتحقق من دور الأدمن أو تطابق معرف الطالب req.user.id (رمز الاستجابة: ${secStudentPatch.status})`
    });
    console.log(`  🚨 ثغرة IDOR: مسار PATCH /api/students/:id لا يمنع الطالب العادي من تعديل سجلات الطلاب`);
  }

  // 9.7 فحص تصعيد الصلاحيات عند التسجيل Privilege Escalation via Register
  const privEscEmail = `hacker_${Date.now()}@alathar.test`;
  const privEscRes = await request({
    hostname: '127.0.0.1', port: PORT, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'مهاجم أدمن', email: privEscEmail, password: 'HackerPassword123!', role: 'admin' });

  if (privEscRes.status === 201 && privEscRes.data.user?.role === 'admin') {
    results.vulnerabilities.push({
      severity: 'Critical',
      title: 'Privilege Escalation on User Registration',
      detail: 'مسار التسجيل POST /api/auth/register يسمح بتعيين role: admin أو teacher لأي مستخدم جديد دون تدقيق.'
    });
    console.log('  🚨 ثغرة خطيرة: مسار التسجيل يسمح لأي شخص بإنشاء حساب بصلاحية admin!');
  } else {
    results.isolation.passed.push('منع إنشاء حساب بصلاحية admin عبر التسجيل المباشر');
  }

  // --------------------------------------------------------------------------
  // التقرير النهائي للنتائج
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('📊 ملخص نتائج تدقيق رحلة الطالب والعزل الأمني');
  console.log('===============================================================');
  console.log(`✅ نقاط النجاح في رحلة الطالب: ${results.journey.passed.length}`);
  console.log(`❌ إخفاقات أو تعثرات في الرحلة: ${results.journey.failed.length}`);
  console.log(`🔒 نقاط العزل الأمني الناجحة: ${results.isolation.passed.length}`);
  console.log(`🚨 الثغرات المكتشفة: ${results.vulnerabilities.length}`);
  console.log('===============================================================\n');

  // Save results to file for audit reporting
  fs.writeFileSync(
    path.join(__dirname, 'student_audit_results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  process.exit(0);
}

runStudentAudit().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
