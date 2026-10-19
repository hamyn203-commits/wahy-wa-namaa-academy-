import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  dashboardPathForRole,
  homePathForLocale,
  isSafeInternalRedirect,
  localizeInternalHref,
  loginPathForLocale,
  postAuthDestination,
} from '../src/lib/navigation.js';
import { localizedLocation } from '../src/lib/locale.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(dashboardPathForRole('student', 'en'), '/en/student/dashboard');
assert.equal(dashboardPathForRole('teacher', 'ar'), '/ar/teacher/dashboard');
assert.equal(dashboardPathForRole('guardian', 'fr'), '/fr/guardian/dashboard');
assert.equal(dashboardPathForRole('admin', 'de'), '/de/admin');
assert.equal(dashboardPathForRole('unknown', 'en'), '/en');

assert.equal(loginPathForLocale('en'), '/en/login');
assert.equal(homePathForLocale('ar'), '/ar');

assert.equal(localizeInternalHref('/courses?track=hifz#plans', 'en'), '/en/courses?track=hifz#plans');
assert.equal(localizeInternalHref('/ar/courses', 'en'), '/ar/courses');
assert.equal(localizeInternalHref('https://example.com/course', 'en'), 'https://example.com/course');
assert.equal(localizeInternalHref('//example.com/course', 'en'), '//example.com/course');

assert.equal(
  localizedLocation('/en/courses', 'fr', '?track=hifz', '#plans'),
  '/fr/courses?track=hifz#plans'
);
assert.equal(
  localizedLocation('/courses', 'de', '?page=2', ''),
  '/de/courses?page=2'
);

assert.equal(isSafeInternalRedirect('/ar/live/room-1?from=dashboard'), true);
assert.equal(isSafeInternalRedirect('/courses'), true);
assert.equal(isSafeInternalRedirect('https://evil.example'), false);
assert.equal(isSafeInternalRedirect('//evil.example/path'), false);
assert.equal(isSafeInternalRedirect('/\\evil.example'), false);

assert.equal(
  postAuthDestination({
    redirect: '/courses?track=hifz#plans',
    role: 'student',
    locale: 'en',
  }),
  '/en/courses?track=hifz#plans'
);

assert.equal(
  postAuthDestination({
    redirect: '/ar/live/room-1?from=dashboard',
    role: 'student',
    locale: 'en',
  }),
  '/ar/live/room-1?from=dashboard'
);

assert.equal(
  postAuthDestination({
    redirect: 'https://evil.example/phish',
    role: 'guardian',
    locale: 'en',
  }),
  '/en/guardian/dashboard'
);

// Signed-in users must never land in another role's dashboard after login.
assert.equal(
  postAuthDestination({ redirect: '/ar/teacher/dashboard', role: 'student', locale: 'ar' }),
  '/ar/student/dashboard'
);
assert.equal(
  postAuthDestination({ redirect: '/guardian/dashboard?tab=children', role: 'teacher', locale: 'en' }),
  '/en/teacher/dashboard'
);
assert.equal(
  postAuthDestination({ redirect: '/admin?tab=people', role: 'guardian', locale: 'ar' }),
  '/ar/guardian/dashboard'
);
assert.equal(
  postAuthDestination({ redirect: '/ar/student/dashboard?tab=homework', role: 'student', locale: 'en' }),
  '/ar/student/dashboard?tab=homework'
);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const login = read('src/pages/Login/index.jsx');
assert.match(login, /postAuthDestination\s*\(/);
assert.match(login, /searchParams\.get\(['"]redirect['"]\)/);

const register = read('src/pages/Register/index.jsx');
assert.match(register, /dashboardPathForRole\s*\(/);
assert.match(register, /localizedPath\(['"]\/login['"]/);
assert.match(register, /guardianPhone/);
assert.match(register, /guardianRelationship/);
assert.match(register, /required=\{role\s*===\s*['"]guardian['"]\}/);
const teacherRegistration = read('src/pages/TeacherRegistration/index.jsx');
const teacherRegistrationForm = read('src/pages/TeacherRegistration/useTeacherForm.js');
assert.match(teacherRegistration, /فيديو تعريفي قصير/);
assert.match(teacherRegistration, /فيديو طريقة التدريس/);
assert.match(teacherRegistrationForm, /introductionVideo/);
assert.match(teacherRegistrationForm, /teachingMethodVideo/);


const redirects = read('src/components/DashboardRedirect.jsx');
assert.match(redirects, /dashboardPathForRole/);
assert.match(redirects, /loginPathForLocale/);
assert.match(redirects, /AuthenticatedLanding/);
assert.match(redirects, /AdminLegacyRedirect/);
assert.doesNotMatch(redirects, /localizedPath\(['"]\/teacher\/register['"]/);

const requireAuth = read('src/hooks/useRequireAuth.js');
assert.match(requireAuth, /loginPathForLocale/);
assert.match(requireAuth, /dashboardPathForRole/);
assert.match(requireAuth, /location\.pathname/);

const protectedRoute = read('src/components\/auth\/ProtectedRoute.jsx'.replaceAll('\\/', '/'));
assert.match(protectedRoute, /dashboardPathForRole/);

const languageSwitcher = read('src/components/LanguageSwitcher.jsx');
assert.match(languageSwitcher, /localizedLocation\(location\.pathname,\s*langCode,\s*location\.search,\s*location\.hash\)/);

const localeLayout = read('src/components/LocaleLayout.jsx');
assert.match(localeLayout, /localizedLocation\(correctedPath,\s*DEFAULT_LOCALE,\s*location\.search,\s*location\.hash\)/);
assert.match(localeLayout, /location\.search[\s\S]{0,100}location\.hash/);

const localeSensitiveNavigationFiles = [
  'src/components/NotificationBell.jsx',
  'src/components/QuranChatWidget.jsx',
  'src/components/shared/ErrorBoundary.jsx',
  'src/pages/AIHub/index.jsx',
  'src/pages/LiveRoom/LiveRoom.jsx',
  'src/pages/LiveSessions/LiveSessions.jsx',
  'src/pages/StudentDashboard/index.jsx',
  'src/pages/TeacherRegistration/index.jsx',
];

for (const relativePath of localeSensitiveNavigationFiles) {
  const source = read(relativePath);
  assert.doesNotMatch(source, /navigate\(\s*['\"`]\//, relativePath + ' must not use a hard-coded absolute navigate() target');
  assert.doesNotMatch(source, /\bto\s*=\s*['\"]\//, relativePath + ' must not use a hard-coded absolute Link target');
  assert.doesNotMatch(source, /window\.location\.href\s*=\s*['\"]\//, relativePath + ' must not hard-code browser recovery navigation');
}

const notifications = read('src/components/NotificationBell.jsx');
assert.match(notifications, /localizeInternalHref\(notification\.data\.meetingLink,\s*locale\)/);
assert.match(notifications, /localizeInternalHref\(links\[notification\.type\]/);

const liveSessions = read('src/pages/LiveSessions/LiveSessions.jsx');
assert.match(liveSessions, /localizedPath\(\`\/live\/\$\{roomId\}\`,\s*locale\)/);

const teacherDashboard = read('src/pages/TeacherDashboard/index.jsx');
assert.match(teacherDashboard, /useState\(['"]overview['"]\)/);
assert.match(teacherDashboard, /function\s+TeacherCommandBar\s*\(/);
assert.match(teacherDashboard, /tab\s*===\s*['"]students['"]/);
assert.match(teacherDashboard, /\/api\/finance\/teacher\/balance/);
assert.match(teacherDashboard, /\/api\/live\/sessions/);
assert.match(teacherDashboard, /tab\s*===\s*['"]updates['"]/);
assert.match(teacherDashboard, /uploadTeacherFiles\(/);
assert.match(teacherDashboard, /purpose:\s*['"]teacher-update-video['"]/);
assert.match(teacherDashboard, /upload:\s*uploadFileDirect/);
assert.match(teacherDashboard, /\/api\/teacher-updates\/teacher/);
assert.doesNotMatch(teacherDashboard, /<TabBar\s/);

const bookSessionPage = read('src/pages/BookSession/index.jsx');
assert.match(bookSessionPage, /\/api\/sessions\/available-slots\//);
assert.match(bookSessionPage, /availabilityData\.configured/);

const studentDashboard = read('src/pages/StudentDashboard/index.jsx');
assert.match(studentDashboard, /localizeInternalHref\(session\.meetingLink,\s*locale\)/);
assert.match(studentDashboard, /localizedPath\(\`\/meeting\/\$\{session\._id\}\`,\s*locale\)/);
assert.match(studentDashboard, /useState\(['"]overview['"]\)/);
assert.match(studentDashboard, /\/api\/sessions\/available-slots\//);
assert.match(studentDashboard, /tab\s*===\s*['"]overview['"]/);
assert.match(studentDashboard, /\[\.\.\.upcomingSessions,\s*\.\.\.upcomingTrials\][\s\S]{0,160}sort/);
assert.match(studentDashboard, /function\s+StudentCommandBar\s*\(/);
assert.match(studentDashboard, /primaryNavItems/);
assert.match(studentDashboard, /secondaryNavItems/);
assert.match(studentDashboard, /tab\s*===\s*['"]teacher-updates['"]/);
assert.match(studentDashboard, /\/api\/teacher-updates\/student/);
assert.match(studentDashboard, /\/api\/students\/dashboard\/guardian-invitations/);
assert.match(studentDashboard, /submitGuardianInvitation/);
assert.match(studentDashboard, /copyInvitationCode/);
assert.match(studentDashboard, /trialAllowance/);
assert.match(studentDashboard, /\/api\/subscriptions\/me/);
assert.match(studentDashboard, /currentSubscription/);
assert.match(studentDashboard, /اشتراكك الحالي/);
assert.match(studentDashboard, /بانتظار مراجعة الإدارة/);
assert.match(studentDashboard, /الدفع معتمد — بانتظار التسكين/);
assert.match(studentDashboard, /تم التسكين — الجروب قيد الاكتمال/);
assert.match(studentDashboard, /sessionsRemaining/);
assert.match(studentDashboard, /\/api\/subscriptions\/'\s*\+\s*encodeURIComponent\(subscription\._id\)\s*\+\s*'\/renew/);
assert.match(studentDashboard, /تجديد الاشتراك/);
assert.match(studentDashboard, /renewal_queued/);
assert.match(studentDashboard, /group_circle/);
assert.match(studentDashboard, /حلقة جماعية/);
assert.match(studentDashboard, /اشتراك/);
assert.match(studentDashboard, /navigate\(lp\(['"]\/plans['"]\)\)/);
assert.match(studentDashboard, /تجريبيات متبقية/);
assert.match(studentDashboard, /formatSessionDateTime\([\s\S]{0,240}sessionTimeZone/);
assert.doesNotMatch(studentDashboard, /<TabBar\s/);

const sessionModel = read('backend/models/Session.js');
const sessionRoutes = read('backend/routes/sessions.js');
const studentDashboardRoutes = read('backend/routes/studentDashboard.js');
assert.match(sessionModel, /teacherEvaluation:[\s\S]{0,500}surahRecited:[\s\S]{0,220}nextHomework:/);
assert.match(sessionRoutes, /MAX_TRIAL_SESSIONS_PER_STUDENT\s*=\s*3/);
assert.match(sessionRoutes, /TRIAL_LIMIT_REACHED/);
assert.match(sessionRoutes, /router\.post\(['"]\/group-circle['"]/);
assert.match(sessionRoutes, /settleSubscriptionUsageForSession/);
assert.match(sessionRoutes, /calculateSessionEarning/);
assert.match(sessionRoutes, /['"]attendance\.student['"]:\s*req\.user\.id/);
assert.match(sessionRoutes, /router\.patch\(['"]\/:id\/attendance['"],\s*protect,\s*authorize\(['"]teacher['"],\s*['"]admin['"]\)/);
assert.match(sessionRoutes, /ATTENDANCE_INCOMPLETE/);
assert.match(sessionRoutes, /trialAllowance:[\s\S]{0,180}remaining/);
assert.match(studentDashboardRoutes, /trialAllowance:[\s\S]{0,180}remaining/);
assert.match(teacherDashboard, /الحصص المكتملة وتقاريرها/);
assert.match(teacherDashboard, /completeGroupSession/);
assert.match(teacherDashboard, /إنهاء الحصة الجماعية/);
assert.match(teacherDashboard, /updateGroupAttendance/);
assert.match(teacherDashboard, /معتذر — لا تخصم/);
assert.match(teacherDashboard, /role="radiogroup"/);
assert.match(teacherDashboard, /surahRecited:\s*evaluation\.surahRecited/);

const plansPage = read('src/pages/Plans/index.jsx');
assert.match(plansPage, /الحلقة الاقتصادية الكبرى/);
assert.match(plansPage, /من 15 إلى 20 طالب/);
assert.match(plansPage, /الحلقة الجماعية/);
assert.match(plansPage, /من 5 إلى 10 طلاب/);
assert.match(plansPage, /قسم الرجال والأطفال/);
assert.match(plansPage, /قسم السيدات/);
assert.match(plansPage, /من ساعة إلى ساعتين/);
assert.match(plansPage, /ساعة ونصف/);
assert.match(plansPage, /ساعة أو أقل/);
assert.match(plansPage, /\[4, 8, 12, 24\]/);
assert.match(plansPage, /sessionCount/);
assert.match(plansPage, /\/api\/subscriptions\/plans/);
assert.match(plansPage, /\/api\/subscriptions\/select/);
assert.match(plansPage, /renewalSource/);
assert.match(plansPage, /\/renew/);
assert.match(plansPage, /men_children/);
assert.match(plansPage, /ladies/);
assert.match(plansPage, /لم يتم الدفع بعد/);
assert.ok(fs.existsSync(path.join(root, 'public/images/plans/plan-community.svg')));
assert.ok(fs.existsSync(path.join(root, 'public/images/plans/plan-women.svg')));

const subscriptionRoutes = read('backend/routes/subscriptions.js');
const subscriptionModel = read('backend/models/StudentSubscription.js');
assert.match(subscriptionRoutes, /router\.get\(['"]\/plans['"]/);
assert.match(subscriptionRoutes, /router\.post\(['"]\/select['"],\s*protect,\s*authorize\(['"]student['"]\)/);
assert.match(subscriptionRoutes, /router\.post\(['"]\/:id\/renew['"],\s*protect,\s*authorize\(['"]student['"]\)/);
assert.match(subscriptionRoutes, /SUBSCRIPTION_NOT_RENEWABLE/);
assert.match(subscriptionRoutes, /RENEWAL_ALREADY_EXISTS/);
assert.match(subscriptionRoutes, /RENEWAL_PAYMENT_PENDING/);
assert.match(subscriptionRoutes, /renewalOf:\s*null/);
assert.match(subscriptionRoutes, /quoteSubscription\(\{\s*planKey,\s*sessionCount\s*\}\)/);
assert.match(subscriptionModel, /pending_payment/);
assert.match(subscriptionModel, /sessionCount:[\s\S]{0,100}enum:\s*\[4, 8, 12, 24\]/);

const errorBoundary = read('src/components/shared/ErrorBoundary.jsx');
assert.match(errorBoundary, /localizedPath\(['\"]\/['\"],\s*locale\)/);

const paymentReturn = read('src/pages/PaymentReturn/index.jsx');
assert.match(paymentReturn, /\/api\/payments\/'\s*\+\s*encodeURIComponent\(paymentId\)\s*\+\s*'\/status/);
assert.doesNotMatch(paymentReturn, /params\.get\(['"]success['"]\)/);

const courseDetail = read('src/pages/CourseDetail/index.jsx');
assert.match(courseDetail, /localizedPath\(['"]\/payment\/manual['"],\s*locale\)/);

const manualPayment = read('src/pages/ManualPayment/index.jsx');
assert.match(manualPayment, /uploadFileDirect\(proof,\s*['"]payment-proof['"]\)/);
assert.match(manualPayment, /\/api\/payments\/course\/'\s*\+\s*encodeURIComponent\(slug\)\s*\+\s*'\/manual/);
assert.match(manualPayment, /\/api\/payments\/subscription\/'\s*\+\s*encodeURIComponent\(subscriptionId\)\s*\+\s*'\/manual/);
assert.match(manualPayment, /عايز تدرس مع مين/);
assert.match(manualPayment, /\/api\/teachers/);
assert.match(manualPayment, /التجديد مع نفس المعلم/);
assert.match(manualPayment, /disabled=\{Boolean\(subscription\?\.renewalOf\)\}/);

// T22: Teacher public media is rendered through same-origin routes.
const teacherMedia = read('src/lib/teacherMedia.js');
const teacherProfilePage = read('src/pages/TeacherProfile/index.jsx');
const teacherDirectoryPage = read('src/pages/Teachers/index.jsx');
assert.match(teacherMedia, /teacherPublicImage/);
assert.match(teacherMedia, /teacherImageFallback/);
assert.match(teacherMedia, /api\/uploads\/public/);
assert.match(teacherProfilePage, /teacherPublicImage\(media\.profilePhoto/);
assert.match(teacherProfilePage, /teacherPublicVideo\(item\.url\)/);
assert.match(teacherProfilePage, /teacherPublicImage\(audio\)/);
assert.match(teacherProfilePage, /media\.additionalVideos/);
assert.match(teacherDirectoryPage, /teacherPublicImage\(teacher\.media\?\.profilePhoto\)/);
assert.match(read('backend/routes/uploads.js'), /uploads\/teacher-public\//);
const adminPayments = read('src/pages/AdminPayments/index.jsx');
const adminSubscriptions = read('src/pages/AdminSubscriptions/index.jsx');
assert.match(adminPayments, /\/api\/payments\/admin\/manual/);
assert.match(adminPayments, /\/review/);
assert.match(adminPayments, /المعلم المختار/);
assert.match(adminSubscriptions, /\/api\/subscriptions\/admin\/placements/);
assert.match(adminSubscriptions, /\/api\/subscriptions\/admin\/'\s*\+\s*encodeURIComponent\(item\._id\)\s*\+\s*'\/place/);
assert.match(adminSubscriptions, /جروب موجود/);
assert.match(adminSubscriptions, /جروب جديد/);
const subscriptionCircleCard = read('src/pages/AdminSubscriptions/SubscriptionCircleCard.jsx');
assert.match(subscriptionCircleCard, /\/api\/sessions\/group-circle/);
assert.match(subscriptionCircleCard, /\/start/);
assert.match(subscriptionCircleCard, /جدولة حصة الجروب/);
assert.match(subscriptionCircleCard, /durationOptionsFor/);


const adminDashboard = read('src/pages/AdminDashboard/index.jsx');
const adminDashboardShell = read('src/pages/AdminDashboard/AdminDashboardShell.jsx');
const adminExecutiveHome = read('src/pages/AdminDashboard/AdminExecutiveHome.jsx');
const adminSessionControl = read('src/pages/AdminDashboard/AdminSessionControl.jsx');
const adminGuardianLinksPanel = read('src/pages/AdminDashboard/AdminGuardianLinksPanel.jsx');
const teacherReviewQueue = read('src/pages/AdminDashboard/TeacherReviewQueue.jsx');
const teacherReviewDossier = read('src/pages/AdminDashboard/TeacherReviewDossier.jsx');
assert.match(adminDashboard, /\/api\/admin\/command-center/);
assert.match(adminDashboard, /\/api\/admin\/audit\?limit=/);
assert.match(adminDashboard, /openTeacherDossier/);
assert.match(adminDashboard, /review-checklist\/\$\{key\}/);
assert.match(adminDashboard, /TeacherReviewDossier/);
assert.match(adminDashboard, /AdminDashboardShell/);
assert.match(adminDashboard, /AdminExecutiveHome/);
assert.match(adminExecutiveHome, /EXECUTIVE OVERVIEW/);
assert.match(adminExecutiveHome, /OPERATIONS PULSE/);
assert.match(adminExecutiveHome, /ACTION CENTER/);
assert.match(adminExecutiveHome, /SYSTEM HEALTH/);
assert.match(adminExecutiveHome, /TeacherReviewQueue/);
assert.match(adminExecutiveHome, /LaunchReadinessPanel/);
assert.match(adminExecutiveHome, /ResponsiveContainer/);
assert.match(adminExecutiveHome, /\/admin\?tab=teachers/);
assert.match(adminExecutiveHome, /\/admin\?tab=sessions/);
assert.match(adminExecutiveHome, /\/admin\?tab=people&focus=guardian-links/);
assert.match(adminExecutiveHome, /\/admin\/payments/);
assert.match(adminExecutiveHome, /\/admin\?tab=system/);
assert.match(adminExecutiveHome, /onClick=\{\(\) => handleAction/);
assert.match(adminDashboard, /tab\s*===\s*['"]sessions['"]/);
assert.match(adminDashboard, /tab\s*===\s*['"]system['"]/);
assert.match(adminDashboard, /AdminGuardianLinksPanel/);
assert.match(adminSessionControl, /\/api\/admin\/session-control\?focus=/);
assert.match(adminSessionControl, /onOpenStudent/);
assert.match(adminSessionControl, /onOpenTeacher/);
assert.match(adminGuardianLinksPanel, /\/api\/admin\/people\/guardian-links\?status=pending/);
assert.match(adminGuardianLinksPanel, /فتح Student 360/);
assert.match(adminExecutiveHome, /wn-admin-exec-metrics/);
assert.match(adminDashboard, /tab\s*===\s*['"]people['"]/);
assert.doesNotMatch(adminDashboard, /<DashboardLayout/);
assert.doesNotMatch(adminDashboard, /<TabBar/);
assert.match(adminDashboardShell, /wn-admin-sidebar/);
assert.match(adminDashboardShell, /wn-admin-topbar/);
assert.match(adminDashboardShell, /مركز القيادة/);
assert.match(adminDashboardShell, /الاشتراكات والتسكين/);
assert.match(adminDashboardShell, /السحوبات والمالية/);
assert.match(adminDashboardShell, /التحليلات والنمو/);
// T19 — Illustrated first screen with navigable actions and scrolled detail.
assert.match(adminDashboardShell, /wn-admin-welcome--illustrated/);
assert.match(adminDashboardShell, /active === 'overview'/);
assert.match(adminDashboardShell, /wn-admin-page-heading/);
assert.match(adminDashboardShell, /href="#admin-executive-content"/);
assert.match(adminExecutiveHome, /id="admin-executive-content"/);
assert.ok(fs.existsSync(path.join(root, 'public/images/admin-mosque-hero.svg')));
assert.ok(
  adminExecutiveHome.indexOf('className="wn-admin-exec-quick-actions"')
    < adminExecutiveHome.indexOf('className="wn-admin-exec-hero"'),
  'Quick admin actions should appear before the detailed operational summary'
);
// T20 — Admin readability at 150% scale, scoped to admin pages only.
const adminReadableCss = read('src/styles/dashboard-experience.css');
assert.match(adminReadableCss, /T20 — Admin 150% typography/);
assert.match(adminReadableCss, /--wn-admin-type-scale:\s*1\.5/);
assert.match(adminReadableCss, /font-size:\s*1\.245rem/);
assert.match(adminReadableCss, /font-size:\s*1\.3125rem/);
assert.match(adminReadableCss, /\.wn-admin-app\s+\.wn-admin-sidebar\s*\{\s*width:\s*298px/);
assert.match(adminReadableCss, /\.wn-admin-payment-readable/);
assert.match(adminPayments, /wn-admin-payment-readable/);
assert.match(adminDashboardShell, /wn-admin-topbar__sidebar-toggle/);
assert.match(adminDashboardShell, /is-sidebar-collapsed/);
assert.match(adminDashboardShell, /wn-admin-sidebar-collapsed/);
assert.match(adminDashboardShell, /setCollapsed\(\(value\) => !value\)/);
assert.match(adminDashboardShell, /aria-controls="wn-admin-sidebar"/);
assert.match(adminDashboardShell, /إخفاء القائمة الجانبية/);
assert.match(adminDashboardShell, /إظهار القائمة الجانبية/);
assert.match(read('src/styles/dashboard-experience.css'), /\.wn-admin-app\.is-sidebar-collapsed \.wn-admin-stage\s*\{\s*margin-left:\s*0/);
assert.match(adminDashboardShell, /مركز الحصص/);
assert.match(adminDashboardShell, /onChange\?\.\(['"]system['"]\)/);
assert.match(teacherReviewQueue, /فتح ملف المراجعة الكامل/);
assert.doesNotMatch(teacherReviewQueue, /onReview\(/);
assert.match(teacherReviewDossier, /Teacher 360 Review Dossier/);
// T21 — Approved teacher management stays in admin, with distinct public preview.
assert.match(adminDashboard, /filteredApprovedTeachers\.map/);
assert.match(adminDashboard, /openTeacherDossier\(teacher\._id\)/);
assert.match(adminDashboard, /previewPublicTeacher\(teacher\._id\)/);
assert.doesNotMatch(adminDashboard, /navigate\(`\/teachers\/\$\{t\._id\}\`\)/);
assert.match(teacherReviewDossier, /!approved \? <section className="wn-admin-review-gate">/);
assert.match(teacherReviewDossier, /!approved \? <footer className="wn-admin-dossier__footer">/);
assert.match(teacherReviewDossier, /onPreviewPublic/);
assert.match(teacherReviewDossier, /approvalReady/);
assert.match(teacherReviewDossier, /onOpenDocument/);
assert.match(teacherReviewDossier, /onOpenMedia/);

// Teacher review assets must remain in the authenticated admin dossier.
// Opening a new tab after an async fetch is blocked by browsers and breaks video review.
const teacherAssetViewer = read('src/pages/AdminDashboard/TeacherAssetViewer.jsx');
const teacherReviewStyles = read('src/pages/AdminDashboard/TeacherReviewDossier.css');
assert.match(teacherReviewDossier, /REVIEW_GROUPS/);
assert.match(teacherReviewDossier, /REVIEW_GUIDES/);
assert.match(teacherReviewDossier, /canInspect/);
assert.match(teacherReviewDossier, /<TeacherAssetViewer/);
assert.match(teacherReviewDossier, /showAsset\('media'/);
assert.match(teacherReviewDossier, /showAsset\('document'/);
assert.match(teacherReviewDossier, /showAsset\('profile-change'/);
assert.match(teacherAssetViewer, /<video[\s\S]*?controls/);
assert.match(teacherAssetViewer, /<audio[^>]*controls/);
assert.match(teacherAssetViewer, /URL\.createObjectURL/);
assert.match(teacherAssetViewer, /URL\.revokeObjectURL/);
assert.match(adminDashboard, /\/media-playback\/\$\{kind\}/);
assert.match(adminDashboard, /\/profile-change\/media-playback\/\$\{kind\}/);
assert.match(adminDashboard, /MEDIA_PREVIEW_NOT_SUPPORTED/);
assert.match(teacherAssetViewer, /isBlob \? ownedObjectUrl : result\.url/);
assert.match(teacherAssetViewer, /retryKey/);
assert.match(teacherAssetViewer, /إعادة المحاولة/);
assert.match(teacherAssetViewer, /describePlaybackError/);
assert.match(teacherAssetViewer, /preview\.contentType/);
assert.match(teacherAssetViewer, /playbackErrorCode/);
// A live dashboard refresh must NOT restart the active teacher video.
// Playback should be re-requested only when selecting another asset or retrying.
assert.match(teacherAssetViewer, /useRef\(loader\)/);
assert.match(teacherAssetViewer, /latestLoader\.current = loader/);
assert.match(teacherAssetViewer, /latestLoader\.current\(teacherId, kind, index\)/);
assert.match(teacherAssetViewer, /\[teacherId, kind, index, category, retryKey\]/);
assert.doesNotMatch(teacherAssetViewer, /\[teacherId, asset, loader, retryKey\]/);

assert.match(teacherAssetViewer, /H\.264/);
const teachersRouteSource = read('backend/routes/teachers.js');
const profilePlaybackStart = teachersRouteSource.indexOf("router.get('/admin/:id/profile-change/media-playback/:kind'");
const profilePlaybackEnd = teachersRouteSource.indexOf("router.get('/admin/:id/profile-change/media/:kind'", profilePlaybackStart);
const originalPlaybackStart = teachersRouteSource.indexOf("router.get('/admin/:id/media-playback/:kind{/:index}'");
const originalPlaybackEnd = teachersRouteSource.indexOf("router.get('/admin/:id/media/:kind{/:index}'", originalPlaybackStart);
const profilePlaybackRoute = teachersRouteSource.slice(profilePlaybackStart, profilePlaybackEnd);
const originalPlaybackRoute = teachersRouteSource.slice(originalPlaybackStart, originalPlaybackEnd);
assert.match(profilePlaybackRoute, /createVerifiedTeacherPlayback\(reference,/);
assert.match(profilePlaybackRoute, /teacherId: req\.params\.id/);
assert.match(profilePlaybackRoute, /index: 0/);
assert.match(profilePlaybackRoute, /scope: 'proposed'/);
assert.match(originalPlaybackRoute, /createVerifiedTeacherPlayback\(reference,/);
assert.match(originalPlaybackRoute, /teacherId: teacher\._id/);
assert.match(originalPlaybackRoute, /index: req\.params\.index/);
assert.match(originalPlaybackRoute, /scope: 'original'/);
// Always verify a real provider range before giving the browser a link.
assert.match(teachersRouteSource, /async function createVerifiedTeacherPlayback/);
assert.match(teachersRouteSource, /objectStorage\.getPrivateObject\(reference, \{/);
assert.match(teachersRouteSource, /actualRange !==/);
assert.match(teachersRouteSource, /streamingMode: 'authenticated-range'/);
// Use the academy's origin, not the API domain or an unverifiable Blob URL.
assert.match(teachersRouteSource, /const pathname = `\/api\/teachers\/admin-media-range\//);
assert.match(adminDashboard, /preview\.url\.startsWith\('\/api\/teachers\/admin-media-range\/'\)/);
assert.match(teacherAssetViewer, /result\.url\.startsWith\('\/api\/teachers\/admin-media-range\/'\)/);



assert.match(teacherAssetViewer, /aria-modal="true"/);
assert.match(adminDashboard, /fetchTeacherReviewAsset/);
assert.doesNotMatch(
  adminDashboard.slice(adminDashboard.indexOf('const fetchTeacherReviewAsset'), adminDashboard.indexOf('const reviewTeacherProfileChange')),
  /window\.open\(/
);
assert.match(teacherReviewStyles, /wn-admin-review-group__heading/);
assert.match(teacherReviewStyles, /@media \(max-width: 560px\)/);



const adminPeopleSearch = read('src/pages/AdminDashboard/AdminPeopleSearch.jsx');
const student360Dossier = read('src/pages/AdminDashboard/Student360Dossier.jsx');
const family360Dossier = read('src/pages/AdminDashboard/Family360Dossier.jsx');
assert.match(adminDashboard, /AdminPeopleSearch/);
assert.match(adminDashboard, /openStudentDossier/);
assert.match(adminDashboard, /\/api\/admin\/people\/students\/\$\{studentId\}/);
assert.match(adminDashboard, /\/api\/admin\/people\/guardians\/\$\{guardianId\}/);
assert.match(adminDashboard, /\/api\/homework\/tasks\/\$\{taskId\}\/file\?reason=student-360-review/);
assert.match(adminPeopleSearch, /\/api\/admin\/people\/search\?q=/);
assert.match(adminPeopleSearch, /onOpenStudent/);
assert.match(adminPeopleSearch, /onOpenGuardian/);
assert.match(adminPeopleSearch, /onOpenTeacher/);
assert.match(student360Dossier, /Student 360/);
assert.match(student360Dossier, /الحصص والتقارير/);
assert.match(student360Dossier, /الواجبات والتسليمات/);
assert.match(student360Dossier, /المدفوعات/);
assert.match(family360Dossier, /Family 360/);
assert.match(family360Dossier, /الأبناء/);
assert.match(family360Dossier, /طلبات الربط/);

const app = read('src/App.jsx');
assert.match(app, /path=["']login["'][\s\S]{0,120}<AuthenticatedLanding><Login\s*\/><\/AuthenticatedLanding>/);
assert.match(
  app,
  /path=["']guardian\/dashboard["'][\s\S]{0,180}roles=\{\[['"]guardian['"]\]\}/
);
assert.match(
  app,
  /path=["']admin\/dashboard["'][\s\S]{0,180}roles=\{\[['"]admin['"]\]\}[\s\S]{0,120}<AdminLegacyRedirect\s*\/>/
);
assert.match(
  app,
  /<Route\s+index\s+element=\{<AuthenticatedLanding><LandingPage\s*\/><\/AuthenticatedLanding>\}/
);
assert.match(
  app,
  /path=["']\/:locale["'][\s\S]{0,260}path=["']\*["'][\s\S]{0,120}<NotFoundPage\s*\/>/
);
assert.match(app, /path=["']plans["'][\s\S]{0,100}<PlansPage\s*\/>/);
assert.match(
  app,
  /path=["']payment\/return["'][\s\S]{0,180}<ProtectedRoute\s+roles=\{\[['"]student['"],\s*['"]admin['"]\]\}/
);
assert.match(
  app,
  /path=["']payment\/manual["'][\s\S]{0,180}<ProtectedRoute\s+roles=\{\[['"]student['"]\]\}/
);
assert.match(
  app,
  /path=["']admin\/payments["'][\s\S]{0,180}<ProtectedRoute\s+roles=\{\[['"]admin['"]\]\}/
);
assert.match(
  app,
  /path=["']admin\/subscriptions["'][\s\S]{0,180}<ProtectedRoute\s+roles=\{\[['"]admin['"]\]\}/
);

console.log('Route navigation contracts passed.');
const dashboardLayout = read('src/components/dashboard/DashboardLayout.jsx');
assert.match(dashboardLayout, /dashboardPathForRole\(user\?\.role,\s*locale\)/);
assert.doesNotMatch(dashboardLayout, /['"]\/admin\/dashboard['"]/);

const guardianDashboard = read('src/pages/GuardianDashboard/index.jsx');
assert.match(guardianDashboard, /useRequireAuth\(\[['"]guardian['"]\]\)/);
assert.doesNotMatch(guardianDashboard, /useRequireAuth\(\[['"]guardian['"],\s*['"]admin['"]\]\)/);
assert.match(guardianDashboard, /selectedChildId[\s\S]{0,180}['"]family['"]/);
assert.match(guardianDashboard, /\/api\/guardian\/family-overview/);
assert.match(guardianDashboard, /\/api\/guardian\/homework\/\$\{selectedChildId\}/);
assert.match(guardianDashboard, /children\.length\s*>\s*1[\s\S]{0,1200}كل الأبناء/);
assert.match(guardianDashboard, /session\.instanceKey/);
assert.match(guardianDashboard, /\/api\/guardian\/invitations/);
assert.match(guardianDashboard, /respondToInvitation/);
assert.match(guardianDashboard, /طلبات ربط جديدة/);


