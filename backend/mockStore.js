const users = [];

function addMockUser(user) {
  const existing = findMockUserByEmail(user.email);
  if (existing) return existing;
  const newUser = {
    ...user,
    _id: user._id || `mock-${Date.now()}`,
    id: user.id || user._id || `mock-${Date.now()}`,
    role: user.role || 'student',
    isActive: user.isActive !== undefined ? user.isActive : true,
  };
  users.push(newUser);
  return newUser;
}

function findMockUserByEmail(email) {
  if (!email) return null;
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
}

function findMockUserById(id) {
  if (!id) return null;
  return users.find((user) => user._id === id || user.id === id);
}

function updateMockUser(id, updates) {
  const user = findMockUserById(id);
  if (!user) return null;
  Object.assign(user, updates);
  return user;
}

function getMockUsers() {
  return users;
}

function deleteMockUser(id) {
  const idx = users.findIndex((u) => String(u._id) === String(id) || String(u.id) === String(id));
  if (idx === -1) return false;
  users.splice(idx, 1);
  return true;
}

const teachers = [];
const tasks = [];
const withdrawals = [];
const guardianChildren = new Map();
const circles = [];
const subscriptions = [];

function addMockTeacher(teacher) {
  const existingIndex = teachers.findIndex((t) => t.user === teacher.user || t.user?._id === teacher.user);
  if (existingIndex >= 0) {
    teachers[existingIndex] = { ...teachers[existingIndex], ...teacher };
    return teachers[existingIndex];
  }
  const newT = {
    _id: teacher._id || `mock-teacher-${Date.now()}`,
    id: teacher.id || teacher._id || `mock-teacher-${Date.now()}`,
    status: teacher.status || 'approved',
    isVerified: teacher.isVerified !== undefined ? teacher.isVerified : true,
    isFeatured: Boolean(teacher.isFeatured),
    rating: { average: 4.9, count: 12 },
    hourlyRate: teacher.hourlyRate ?? 50,
    wallet: { pendingEarnings: 0, totalWithdrawn: 0 },
    languages: teacher.languages || ['arabic', 'english'],
    availabilityTimezone: teacher.availabilityTimezone || 'Africa/Cairo',
    reviewChecklist: teacher.reviewChecklist || [],
    reviewNotes: teacher.reviewNotes || [],
    createdAt: teacher.createdAt || new Date(),
    ...teacher,
  };
  teachers.push(newT);
  return newT;
}

function findMockTeacherByUserId(userId) {
  if (!userId) return null;
  return teachers.find((t) => String(t.user) === String(userId) || String(t.user?._id) === String(userId) || String(t.user?.id) === String(userId));
}

function findMockTeacherById(id) {
  if (!id) return null;
  return teachers.find((t) => String(t._id) === String(id) || String(t.id) === String(id));
}

function updateMockTeacher(id, updates) {
  const teacher = findMockTeacherById(id);
  if (!teacher) return null;
  Object.assign(teacher, updates);
  return teacher;
}

function deleteMockTeacher(id) {
  const idx = teachers.findIndex((t) => String(t._id) === String(id) || String(t.id) === String(id));
  if (idx === -1) return false;
  teachers.splice(idx, 1);
  return true;
}

function getMockTeachers() {
  return teachers;
}

function getMockCircles() {
  return circles;
}

function findMockCircleById(id) {
  if (!id) return null;
  return circles.find((c) => String(c._id) === String(id) || String(c.id) === String(id));
}

function addMockCircle(circle) {
  const id = circle._id || `mock-circle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newCircle = {
    _id: id,
    id,
    code: circle.code || `CIR-${String(circles.length + 1).padStart(3, '0')}`,
    name: circle.name || 'مجموعة قرآنية',
    status: circle.status || 'forming',
    subscriptionPlanKey: circle.subscriptionPlanKey || 'group',
    subscriptionSection: circle.subscriptionSection || 'men_children',
    track: circle.track || 'memorization',
    level: circle.level || 'beginner',
    gender: circle.gender || 'men',
    targetAgeGroup: circle.targetAgeGroup || 'adults',
    capacity: circle.capacity || 8,
    teacher: circle.teacher || null,
    students: Array.isArray(circle.students) ? circle.students : [],
    schedule: Array.isArray(circle.schedule) ? circle.schedule : [],
    timezone: circle.timezone || 'Africa/Cairo',
    startedAt: circle.startedAt || null,
    createdAt: circle.createdAt || new Date(),
    ...circle,
  };
  circles.push(newCircle);
  return newCircle;
}

function updateMockCircle(id, updates) {
  const circle = findMockCircleById(id);
  if (!circle) return null;
  Object.assign(circle, updates);
  return circle;
}

function deleteMockCircle(id) {
  const idx = circles.findIndex((c) => String(c._id) === String(id) || String(c.id) === String(id));
  if (idx === -1) return false;
  circles.splice(idx, 1);
  return true;
}

function getMockSubscriptions() {
  return subscriptions;
}

function findMockSubscriptionById(id) {
  if (!id) return null;
  return subscriptions.find((s) => String(s._id) === String(id) || String(s.id) === String(id));
}

function addMockSubscription(sub) {
  const id = sub._id || `mock-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newSub = {
    _id: id,
    id,
    student: sub.student,
    planKey: sub.planKey || 'group',
    section: sub.section || 'men_children',
    sessionCount: sub.sessionCount || 8,
    sessionsUsed: sub.sessionsUsed || 0,
    sessionsRemaining: sub.sessionsRemaining ?? (sub.sessionCount || 8),
    currency: sub.currency || 'EGP',
    pricePerSessionMinor: sub.pricePerSessionMinor || 5500,
    totalAmountMinor: sub.totalAmountMinor || 44000,
    status: sub.status || 'awaiting_placement',
    preferredTeacher: sub.preferredTeacher || null,
    circle: sub.circle || null,
    paidAt: sub.paidAt || new Date(),
    placedAt: sub.placedAt || null,
    startedAt: sub.startedAt || null,
    createdAt: sub.createdAt || new Date(),
    ...sub,
  };
  subscriptions.push(newSub);
  return newSub;
}

function updateMockSubscription(id, updates) {
  const sub = findMockSubscriptionById(id);
  if (!sub) return null;
  Object.assign(sub, updates);
  return sub;
}

if (process.env.NODE_ENV !== 'production') {
  addMockUser({
    _id: 'mock-admin-1',
    id: 'mock-admin-1',
    name: 'مدير الأكاديمية',
    email: 'admin@wahy.com',
    password: 'Admin123456!',
    phone: '+201000000001',
    role: 'admin',
    isActive: true,
    emailVerified: true,
  });
  addMockUser({
    _id: 'mock-admin-2',
    id: 'mock-admin-2',
    name: 'إدارة وحي ونماء',
    email: 'admin@wahynamaa.com',
    password: 'Admin123456!',
    phone: '+201000000002',
    role: 'admin',
    isActive: true,
    emailVerified: true,
  });
  addMockUser({
    _id: 'mock-admin-e2e',
    id: 'mock-admin-e2e',
    name: 'E2E Admin',
    email: 'e2e.admin@example.test',
    password: 'Playwright123!',
    phone: '+201000003000',
    role: 'admin',
    isActive: true,
    emailVerified: true,
  });

  const demoTeacherUser = addMockUser({
    _id: 'mock-teacher-user-1',
    id: 'mock-teacher-user-1',
    name: 'الشيخ عبد الرحمن الأزهرى',
    email: 'teacher@wahy.com',
    password: 'Teacher123456!',
    phone: '+201011112222',
    whatsappPhone: '+201011112222',
    gender: 'male',
    age: 34,
    bio: 'معلم قرآن كريم وتجويد مجاز بالقراءات العشر من الأزهر الشريف.',
    role: 'teacher',
    isActive: true,
    emailVerified: true,
  });

  addMockTeacher({
    _id: 'mock-teacher-1',
    id: 'mock-teacher-1',
    user: demoTeacherUser._id,
    personalInfo: {
      fullName: demoTeacherUser.name,
      age: 34,
      gender: 'male',
      country: 'مصر',
      city: 'القاهرة',
      address: 'مدينة نصر، القاهرة',
      phone: '+201011112222',
      whatsapp: '+201011112222',
      telegram: '@sheikh_abdelrahman',
    },
    academicInfo: {
      university: 'جامعة الأزهر',
      faculty: 'كلية القرآن الكريم',
      graduationYear: 2014,
      specialization: 'القراءات وعلوم القرآن',
      qualification: 'إجازة عالية في القراءات',
    },
    quranInfo: {
      memorizedParts: 30,
      teachingExperience: 9,
      numberOfIjazat: 3,
      ijazaType: 'حفص وشعبة عن عاصم',
      sheikhName: 'الشيخ محمود خليل',
      sanad: 'سند متصل إلى النبي ﷺ',
      specializations: ['tajweed', 'ijaza', 'adults', 'children'],
    },
    status: 'approved',
    isVerified: true,
    isFeatured: true,
    hourlyRate: 60,
    languages: ['arabic', 'english'],
  });

  const demoStudent1 = addMockUser({
    _id: 'mock-student-1',
    id: 'mock-student-1',
    name: 'عمر خالد المنصوري',
    email: 'student1@wahy.com',
    password: 'Student123456!',
    phone: '+201022223333',
    whatsappPhone: '+201022223333',
    role: 'student',
    gender: 'male',
    enrollmentSection: 'men_children',
    age: 22,
    currentLevel: 'beginner',
    preferredTrack: 'memorization',
    memorizedJuz: 3,
    memorizationDetails: 'يحفظ جزء عم وتبارك وقد سمع',
    bio: 'طالب جامعي يرغب في إتقان الحفظ والتجويد',
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
  });

  const demoStudent2 = addMockUser({
    _id: 'mock-student-2',
    id: 'mock-student-2',
    name: 'يوسف أحمد الشافعي',
    email: 'student2@wahy.com',
    password: 'Student123456!',
    phone: '+201033334444',
    whatsappPhone: '+201033334444',
    role: 'student',
    gender: 'male',
    enrollmentSection: 'men_children',
    age: 19,
    currentLevel: 'intermediate',
    preferredTrack: 'tajweed_ijazah',
    memorizedJuz: 8,
    memorizationDetails: 'مراجعة وتثبيت مع أحكام التجويد',
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
  });

  const demoCircle = addMockCircle({
    _id: 'mock-circle-1',
    id: 'mock-circle-1',
    code: 'CIR-001',
    name: 'مجموعة الإمام حفص للتحفيظ والتجويد',
    status: 'forming',
    subscriptionPlanKey: 'group',
    subscriptionSection: 'men_children',
    track: 'memorization',
    level: 'beginner',
    gender: 'men',
    targetAgeGroup: 'adults',
    capacity: 8,
    teacher: 'mock-teacher-1',
    students: [demoStudent2._id],
    schedule: [
      { day: 'sunday', startTime: '19:00', endTime: '20:30' },
      { day: 'wednesday', startTime: '19:00', endTime: '20:30' },
    ],
    timezone: 'Africa/Cairo',
  });
  demoStudent2.circle = demoCircle._id;

  addMockSubscription({
    _id: 'mock-sub-1',
    student: demoStudent1._id,
    planKey: 'group',
    section: 'men_children',
    sessionCount: 8,
    sessionsUsed: 0,
    sessionsRemaining: 8,
    currency: 'EGP',
    pricePerSessionMinor: 5500,
    totalAmountMinor: 44000,
    status: 'awaiting_placement',
    preferredTeacher: 'mock-teacher-1',
    circle: null,
    paidAt: new Date(),
  });

  addMockSubscription({
    _id: 'mock-sub-2',
    student: demoStudent2._id,
    planKey: 'group',
    section: 'men_children',
    sessionCount: 8,
    sessionsUsed: 0,
    sessionsRemaining: 8,
    currency: 'EGP',
    pricePerSessionMinor: 5500,
    totalAmountMinor: 44000,
    status: 'placed',
    preferredTeacher: 'mock-teacher-1',
    circle: demoCircle._id,
    paidAt: new Date(),
    placedAt: new Date(),
  });
}

function getMockGuardianChildren(guardianUserId) {
  if (!guardianChildren.has(guardianUserId)) {
    guardianChildren.set(guardianUserId, []);
  }
  return guardianChildren.get(guardianUserId);
}

function addMockGuardianChild(guardianUserId, childData) {
  const current = getMockGuardianChildren(guardianUserId);
  const newChild = {
    studentId: childData.studentId || `mock-child-${Date.now()}`,
    name: childData.name || 'طالب جديد',
    email: childData.email || 'newchild@example.com',
    phone: childData.phone || '',
    avatar: null,
    relationship: childData.relationship || 'guardian',
    permissions: { viewProgress: true, viewGrades: true, viewAttendance: true, receiveNotifications: true },
    circle: {
      _id: 'mock-circle-2',
      name: 'حلقة الإمام عاصم (تحفيظ مكثف)',
      level: 'intermediate',
      schedule: 'الأحد والثلاثاء والخميس 06:00 م',
      capacity: 10
    },
    studentProfile: {
      plan: 'تحفيظ جزء عم',
      currentSurah: 'سورة النبأ',
      points: 100,
      streak: 1,
      level: 'مبتدئ'
    },
    attendance: { rate: 100, total: 1, attended: 1, excused: 0, absent: 0 },
    latestEvaluation: {
      memorizationScore: 10,
      tajweedScore: 9,
      surahRecited: 'النبأ',
      fromAyah: 1,
      toAyah: 10,
      nextHomework: 'حفظ الآيات 11 إلى 20',
      notes: 'بداية ممتازة ومبشرة',
      date: new Date()
    },
    coursesProgress: []
  };
  current.push(newChild);
  guardianChildren.set(guardianUserId, current);
  return newChild;
}

const sessionRsvps = new Map();

function setMockSessionRsvp(sessionId, rsvpData) {
  sessionRsvps.set(sessionId, rsvpData);
}

function getMockSessionRsvp(sessionId) {
  return sessionRsvps.get(sessionId) || null;
}

module.exports = {
  addMockUser,
  findMockUserByEmail,
  findMockUserById,
  updateMockUser,
  getMockUsers,
  deleteMockUser,
  addMockTeacher,
  findMockTeacherByUserId,
  findMockTeacherById,
  updateMockTeacher,
  deleteMockTeacher,
  getMockTeachers,
  getMockCircles,
  findMockCircleById,
  addMockCircle,
  updateMockCircle,
  deleteMockCircle,
  getMockSubscriptions,
  findMockSubscriptionById,
  addMockSubscription,
  updateMockSubscription,
  getMockGuardianChildren,
  addMockGuardianChild,
  setMockSessionRsvp,
  getMockSessionRsvp,
  tasks,
  withdrawals,
};

