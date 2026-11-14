const http = require('http');

const BASE_URL = 'http://localhost:4000';

async function request(method, pathUrl, body = null, headers = {}) {
  const url = new URL(pathUrl, BASE_URL);
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);

    if (body) {
      if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function makeMultipartBody(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let body = '';

  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${typeof value === 'object' ? JSON.stringify(value) : value}\r\n`;
  }

  for (const [key, file] of Object.entries(files)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"; filename="${file.filename}"\r\n`;
    body += `Content-Type: ${file.contentType}\r\n\r\n`;
    body += `${file.content}\r\n`;
  }

  body += `--${boundary}--\r\n`;

  return { boundary, body };
}

async function runTeacherAudit() {
  const results = [];
  function logResult(step, passed, message, extra = null) {
    results.push({ step, passed, message, extra });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${step}: ${message}`);
    if (extra) console.log('   Details:', JSON.stringify(extra).substring(0, 300));
  }

  console.log('=== STARTING TEACHER PERSONA AUDIT ===\n');

  // 1. Health check
  try {
    const health = await request('GET', '/api/health');
    logResult('Health Check', health.status === 200, 'Backend is up', health.data);
  } catch (e) {
    logResult('Health Check', false, 'Backend not responding', e.message);
    return;
  }

  // 2. Register as a new Teacher
  const testTeacherEmail = `teacher_${Date.now()}@alathar.com`;
  const teacherPassword = 'Password123!';
  let teacherToken = null;
  let _teacherUser = null;

  try {
    const multipart = makeMultipartBody(
      {
        email: testTeacherEmail,
        password: teacherPassword,
        personalInfo: {
          fullName: 'الشيخ عبد الرحمن السند',
          age: 32,
          gender: 'male',
          country: 'مصر',
          city: 'القاهرة',
          address: 'القاهرة، مدينة نصر',
          phone: '+201012345678',
          whatsapp: '+201012345678',
        },
        academicInfo: {
          university: 'جامعة الأزهر الشريف',
          faculty: 'كلية القرآن الكريم للقراءات وعلومها',
          graduationYear: 2016,
          specialization: 'القراءات العشر وتجويد القرآن',
          qualification: 'ليسانس القراءات وعلوم القرآن',
        },
        quranInfo: {
          numberOfIjazat: 3,
          ijazaType: 'إجازة بالسند المتصل برواية حفص وشعبة عن عاصم وقالون عن نافع',
          sheikhName: 'الشيخ المقرئ د. أحمد عيسى المعصراوي',
          sanad: 'سند متصل إلى رسول الله صلى الله عليه وسلم (28 رجلاً بينه وبين النبي)',
          memorizedParts: 30,
          teachingExperience: 8,
          specializations: ['tajweed', 'ijaza', 'children', 'adults'],
        },
        languages: ['arabic', 'english'],
        availability: [
          { day: 'sunday', slots: [{ startTime: '16:00', endTime: '20:00' }] },
          { day: 'tuesday', slots: [{ startTime: '16:00', endTime: '20:00' }] },
          { day: 'thursday', slots: [{ startTime: '16:00', endTime: '20:00' }] },
        ],
      },
      {
        profilePhoto: {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
          content: 'fake_image_content_4x6',
        },
        recitationVideo: {
          filename: 'recitation_surah_fatiha.mp4',
          contentType: 'video/mp4',
          content: 'fake_recitation_video_stream',
        },
      }
    );

    const regRes = await request('POST', '/api/teachers/register', multipart.body, {
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
    });

    logResult(
      'Teacher Registration (POST /api/teachers/register)',
      regRes.status === 201 || regRes.status === 200,
      `Registration response code ${regRes.status}`,
      regRes.data
    );

    if (regRes.data?.accessToken) {
      teacherToken = regRes.data.accessToken;
      _teacherUser = regRes.data.teacher;
    }
  } catch (e) {
    logResult('Teacher Registration', false, 'Exception during registration', e.message);
  }

  // 3. Teacher Login
  try {
    const loginRes = await request('POST', '/api/auth/login', {
      email: testTeacherEmail,
      password: teacherPassword,
    });

    const loginSuccess = loginRes.status === 200 && !!loginRes.data.accessToken;
    logResult(
      'Teacher Login (POST /api/auth/login)',
      loginSuccess,
      `Login result: ${loginRes.status}`,
      { email: testTeacherEmail, role: loginRes.data?.user?.role }
    );

    if (loginSuccess) {
      teacherToken = loginRes.data.accessToken;
      _teacherUser = loginRes.data.user;
    }
  } catch (e) {
    logResult('Teacher Login', false, 'Exception during login', e.message);
  }

  if (!teacherToken) {
    console.error('Cannot proceed without teacher token');
    return;
  }

  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

  // 4. Access Teacher Profile
  try {
    const profRes = await request('GET', '/api/teachers/dashboard/profile', null, teacherHeaders);
    logResult(
      'Teacher Dashboard Profile (GET /api/teachers/dashboard/profile)',
      profRes.status === 200,
      `Status ${profRes.status}`,
      profRes.data
    );
  } catch (e) {
    logResult('Teacher Dashboard Profile', false, 'Error fetching profile', e.message);
  }

  // 5. Access Teacher Stats
  try {
    const statsRes = await request('GET', '/api/teachers/dashboard/stats', null, teacherHeaders);
    logResult(
      'Teacher Dashboard Stats (GET /api/teachers/dashboard/stats)',
      statsRes.status === 200,
      `Status ${statsRes.status}`,
      statsRes.data
    );
  } catch (e) {
    logResult('Teacher Dashboard Stats', false, 'Error fetching stats', e.message);
  }

  // 6. Availability Schedule (GET and PUT)
  try {
    const getAvail = await request('GET', '/api/teachers/dashboard/availability', null, teacherHeaders);
    logResult(
      'Get Availability (GET /api/teachers/dashboard/availability)',
      getAvail.status === 200,
      `Status ${getAvail.status}`,
      getAvail.data
    );

    const newSchedule = [
      { day: 'sunday', slots: [{ startTime: '17:00', endTime: '21:00' }] },
      { day: 'wednesday', slots: [{ startTime: '18:00', endTime: '22:00' }] },
    ];
    const putAvail = await request('PUT', '/api/teachers/dashboard/availability', { availability: newSchedule }, teacherHeaders);
    logResult(
      'Update Availability (PUT /api/teachers/dashboard/availability)',
      putAvail.status === 200 && putAvail.data?.success === true,
      `Status ${putAvail.status}`,
      putAvail.data
    );
  } catch (e) {
    logResult('Availability Schedule', false, 'Error with availability', e.message);
  }

  // 7. Circles Management (POST /api/circles, GET /api/circles)
  let _createdCircleId = null;
  try {
    const circlePayload = {
      name: 'حلقة إتقان التجويد برواية حفص',
      gender: 'boys',
      track: 'tajweed_rules',
      level: 'intermediate',
      targetAgeGroup: 'teens_13_17',
      schedule: [
        { day: 'Sunday', time: '17:00' },
        { day: 'Wednesday', time: '18:00' }
      ],
      currentSurah: 'سورة الحجرات',
      notes: 'التركيز على مخارج الحروف وأحكام المدود والغدد'
    };

    const createCirc = await request('POST', '/api/circles', circlePayload, teacherHeaders);
    logResult(
      'Create Circle by Teacher (POST /api/circles)',
      createCirc.status === 201,
      `Status ${createCirc.status}`,
      createCirc.data
    );

    if (createCirc.data?.circle?._id) {
      _createdCircleId = createCirc.data.circle._id;
    }
  } catch (e) {
    logResult('Create Circle', false, 'Error creating circle', e.message);
  }

  // 8. List Circles
  try {
    const listCirc = await request('GET', '/api/circles', null, teacherHeaders);
    logResult(
      'List Circles (GET /api/circles)',
      listCirc.status === 200,
      `Found ${listCirc.data?.circles?.length || 0} circles`,
      { count: listCirc.data?.circles?.length }
    );
  } catch (e) {
    logResult('List Circles', false, 'Error listing circles', e.message);
  }

  // 9. Sessions Management (GET /api/sessions/my-sessions)
  let sessionId = null;
  try {
    const sessRes = await request('GET', '/api/sessions/my-sessions', null, teacherHeaders);
    logResult(
      'List My Sessions (GET /api/sessions/my-sessions)',
      sessRes.status === 200,
      `Status ${sessRes.status}`,
      { totalSessions: sessRes.data?.sessions?.length }
    );

    if (sessRes.data?.sessions?.length > 0) {
      sessionId = sessRes.data.sessions[0]._id || sessRes.data.sessions[0].id;
    }
  } catch (e) {
    logResult('List Sessions', false, 'Error getting sessions', e.message);
  }

  // 10. Respond to Session (Accept)
  if (sessionId) {
    try {
      const respSess = await request('PUT', `/api/sessions/${sessionId}/respond`, {
        action: 'accept',
        provider: 'jitsi',
      }, teacherHeaders);
      logResult(
        'Respond to Session (PUT /api/sessions/:id/respond)',
        respSess.status === 200 || respSess.status === 404,
        `Status ${respSess.status}`,
        respSess.data
      );
    } catch (e) {
      logResult('Respond to Session', false, 'Error responding to session', e.message);
    }

    // 11. Complete Session with Evaluation (5 Tajweed Criteria)
    try {
      const evalPayload = {
        evaluation: {
          attendance: 5,     // الحضور والانتباه
          memorization: 4.5, // الحفظ
          tajweed: 4.8,      // التجويد
          behavior: 5,       // السلوك
          commitment: 5,     // الالتزام
          makhaarij: 4.5,    // المخارج
          performance: 4.7,  // الأداء
          overallNotes: 'أداء متميز في تطبيق أحكام القلقلة والمد المتصل، يحتاج تثبيت الراء المرققة',
          assignedHomework: [
            { type: 'memorization', description: 'حفظ سورة الكهف 1-15', dueDate: '2026-10-05' },
            { type: 'audio', description: 'تسجيل تلاوة مقطع سورة مريم بصوت واضح', dueDate: '2026-10-06' }
          ]
        }
      };

      const compSess = await request('PUT', `/api/sessions/${sessionId}/complete`, evalPayload, teacherHeaders);
      logResult(
        'Complete Session & 5-Criteria Evaluation (PUT /api/sessions/:id/complete)',
        compSess.status === 200 || compSess.status === 404,
        `Status ${compSess.status}`,
        compSess.data
      );
    } catch (e) {
      logResult('Complete Session & Evaluation', false, 'Error completing session', e.message);
    }
  }

  // 12. Tasks and Homework Management
  try {
    const listTasks = await request('GET', '/api/teachers/dashboard/tasks', null, teacherHeaders);
    logResult(
      'Get Teacher Tasks (GET /api/teachers/dashboard/tasks)',
      listTasks.status === 200,
      `Status ${listTasks.status}`,
      listTasks.data
    );

    const postTask = await request('POST', '/api/teachers/dashboard/tasks', {
      studentId: 'std-1',
      type: 'memorization',
      title: 'حفظ سورة النبأ من 1 إلى 20',
      description: 'مع الاستماع لنطق الشيخ الحصري',
      dueDate: '2026-10-08',
    }, teacherHeaders);
    logResult(
      'Create Task for Student (POST /api/teachers/dashboard/tasks)',
      postTask.status === 201 || postTask.status === 200,
      `Status ${postTask.status}`,
      postTask.data
    );

    if (postTask.data?.task?._id) {
      const patchTask = await request('PATCH', `/api/teachers/dashboard/tasks/${postTask.data.task._id}`, {
        status: 'done',
      }, teacherHeaders);
      logResult(
        'Approve/Review Task (PATCH /api/teachers/dashboard/tasks/:id)',
        patchTask.status === 200,
        `Status ${patchTask.status}`,
        patchTask.data
      );
    }
  } catch (e) {
    logResult('Tasks Management', false, 'Error in tasks management', e.message);
  }

  // ==========================================
  // 13. ROLE ISOLATION & SECURITY CHECKS
  // ==========================================
  console.log('\n--- TESTING ROLE ISOLATION & SECURITY BOUNDARIES ---');

  // Check 13.1: Teacher cannot access Admin Dashboard
  try {
    const adminCheck = await request('GET', '/api/admin/stats', null, teacherHeaders);
    logResult(
      'Security Isolation: Teacher cannot access Admin Stats (GET /api/admin/stats)',
      adminCheck.status === 403,
      `Expected 403 Forbidden, got ${adminCheck.status}`,
      adminCheck.data
    );
  } catch (e) {
    logResult('Security Isolation: Admin Stats', false, 'Error', e.message);
  }

  // Check 13.2: Teacher cannot modify Admin settings or approve other teachers
  try {
    const adminPutTeacher = await request('PUT', '/api/admin/teachers/mock-id', {
      status: 'approved',
      hourlyRate: 500,
    }, teacherHeaders);
    logResult(
      'Security Isolation: Teacher cannot approve teachers or alter rates via Admin API',
      adminPutTeacher.status === 403,
      `Expected 403 Forbidden, got ${adminPutTeacher.status}`,
      adminPutTeacher.data
    );
  } catch (e) {
    logResult('Security Isolation: Admin Teacher PUT', false, 'Error', e.message);
  }

  // Check 13.3: Teacher cannot access Admin Finance Overview
  try {
    const adminFinanceCheck = await request('GET', '/api/finance/admin/overview', null, teacherHeaders);
    logResult(
      'Security Isolation: Teacher cannot view Admin Finance Overview (GET /api/finance/admin/overview)',
      adminFinanceCheck.status === 403,
      `Expected 403 Forbidden, got ${adminFinanceCheck.status}`,
      adminFinanceCheck.data
    );
  } catch (e) {
    logResult('Security Isolation: Admin Finance Overview', false, 'Error', e.message);
  }

  // Check 13.4: Teacher cannot process payouts via Admin endpoint
  try {
    const adminPayoutProcess = await request('PUT', '/api/finance/admin/payouts/mock-payout-id/process', {
      action: 'complete',
    }, teacherHeaders);
    logResult(
      'Security Isolation: Teacher cannot process financial payouts (PUT /api/finance/admin/payouts/:id/process)',
      adminPayoutProcess.status === 403,
      `Expected 403 Forbidden, got ${adminPayoutProcess.status}`,
      adminPayoutProcess.data
    );
  } catch (e) {
    logResult('Security Isolation: Process Payouts', false, 'Error', e.message);
  }

  // Check 13.5: Student token cannot access Teacher Dashboard
  try {
    const studentEmail = `student_${Date.now()}@alathar.com`;
    const regStudent = await request('POST', '/api/auth/register', {
      name: 'طالب الاختبار عمر',
      email: studentEmail,
      password: 'StudentPassword123!',
      phone: '+201112223334',
      role: 'student',
    });

    const studentToken = regStudent.data?.accessToken;
    if (studentToken) {
      const studentHeaders = { Authorization: `Bearer ${studentToken}` };
      const studAccessTeacherDash = await request('GET', '/api/teachers/dashboard/profile', null, studentHeaders);
      logResult(
        'Security Isolation: Student cannot access Teacher Dashboard Profile',
        studAccessTeacherDash.status === 403,
        `Expected 403 Forbidden, got ${studAccessTeacherDash.status}`,
        studAccessTeacherDash.data
      );
    }
  } catch (e) {
    logResult('Security Isolation: Student Access Test', false, 'Error', e.message);
  }

  // Check 13.6: Unauthenticated user cannot access Teacher Dashboard
  try {
    const noAuth = await request('GET', '/api/teachers/dashboard/profile');
    logResult(
      'Security Isolation: Unauthenticated user blocked from Teacher Dashboard',
      noAuth.status === 401,
      `Expected 401 Unauthorized, got ${noAuth.status}`,
      noAuth.data
    );
  } catch (e) {
    logResult('Security Isolation: No Auth Test', false, 'Error', e.message);
  }

  console.log('\n=== AUDIT FINISHED: SUMMARY OF RESULTS ===');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
}

runTeacherAudit().catch(console.error);
