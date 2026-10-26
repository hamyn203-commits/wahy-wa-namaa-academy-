const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireContains(rel, label, pattern) {
  const text = read(rel);
  if (!pattern.test(text)) failures.push(`${rel}: ${label}`);
}

function requireAbsent(rel, label, pattern) {
  const text = read(rel);
  if (pattern.test(text)) failures.push(`${rel}: ${label}`);
}

// P0: public users cannot self-register privileged roles.
requireContains(
  'backend/routes/auth.js',
  'public registration must restrict roles to student/guardian',
  /allowedRoles\s*=\s*\[['"]student['"],\s*['"]guardian['"]\]/
);
requireContains(
  'backend/routes/auth.js',
  'privileged self-registration must be rejected',
  /This role cannot be self-registered/
);

// P0: bootstrap and demo routes must be closed in production.
requireContains(
  'backend/routes/setup.js',
  'admin bootstrap must be production-gated',
  /ALLOW_ADMIN_BOOTSTRAP/
);
requireContains(
  'backend/routes/live.js',
  'demo room must be disabled in production',
  /NODE_ENV\s*===\s*['"]production['"][\s\S]{0,180}Route not found/
);
requireContains(
  'backend/routes/system.js',
  'demo bootstrap must be disabled in production',
  /router\.post\(['"]\/bootstrap['"][\s\S]{0,220}NODE_ENV\s*===\s*['"]production['"]/
);

// LiveKit: host/publish permissions are server-derived.
requireContains(
  'backend/routes/live.js',
  'live token must resolve server-side room access',
  /getRoomAccess\(liveSession, req\.user\)/
);
requireAbsent(
  'backend/routes/live.js',
  'live token must not trust client isHost',
  /req\.body\.isHost|\{[^}]*isHost[^}]*\}\s*=\s*req\.body/
);
requireAbsent(
  'backend/routes/live.js',
  'ordinary participant tokens must not grant room admin/record/create',
  /roomRecord\s*:\s*true|roomCreate\s*:\s*true|roomAdmin\s*:\s*true/
);

// Auth: refresh token lives in HttpOnly cookie; access token must not persist in browser storage.
requireContains(
  'backend/routes/auth.js',
  'refresh cookie must be HttpOnly',
  /HttpOnly/
);
requireContains(
  'backend/routes/auth.js',
  'logout must revoke refresh token version',
  /refreshTokenVersion[\s\S]{0,120}\+\s*1|\$inc:\s*\{\s*refreshTokenVersion:\s*1/
);
requireAbsent(
  'src/lib/fileUpload.js',
  'upload helper must not read access tokens from localStorage',
  /localStorage\.(?:getItem|setItem)\(['"](?:accessToken|token|refreshToken)['"]/
);

// Runtime: production mock mode must fail closed and support either Mongo env name.
requireContains(
  'backend/config/runtime.js',
  'runtime must recognize MongoDB integration variables',
  /MONGODB_URI\s*\|\|\s*process\.env\.MONGODB_URL/
);
requireContains(
  'backend/config/runtime.js',
  'mock mode must be disabled in production',
  /isMockMode\s*=\s*!isProduction\s*&&\s*!hasDatabaseConfig/
);
requireAbsent(
  'backend/routes/finance.js',
  'finance must not implement its own Mongo-only mock switch',
  /isMockMode\s*=\s*!process\.env\.MONGODB_URI/
);

// Storage: teacher IDs and certificates must stay behind private storage.
requireContains(
  'backend/routes/teachers.js',
  'teacher private documents must use authorized object-storage reads',
  /getPrivateObject\(stored/
);

requireContains(
  'backend/routes/teachers.js',
  'teacher streaming playback route must require admin authentication',
  /router\.get\('\/admin\/:id\/media-playback\/:kind\{\/:index\}',\s*protect,\s*authorize\('admin'\)/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher proposed media playback must require admin authentication',
  /router\.get\('\/admin\/:id\/profile-change\/media-playback\/:kind',\s*protect,\s*authorize\('admin'\)/
);
requireContains(
  'backend/services/objectStorage.js',
  'private Blob playback must use short-lived scoped signed token',
  /issueSignedToken\(\{ pathname, operations: \['get'\], validUntil \}\)/
);
requireContains(
  'backend/services/objectStorage.js',
  'private Blob media URL must only allow the GET operation',
  /presignUrl\(token, \{ pathname, operation: 'get', validUntil \}\)/
);
requireContains(
  'backend/routes/teachers.js',
  'a private video must have a short-lived teacher- and asset-scoped JWT',
  /purpose: TEACHER_MEDIA_TICKET_PURPOSE[\s\S]*?referenceDigest/
);
requireContains(
  'backend/routes/teachers.js',
  'range ticket is independently verified before reading teacher media',
  /router\.get\('\/admin-media-range[\s\S]*?jwt\.verify\(ticket/
);
requireContains(
  'backend/routes/teachers.js',
  'range endpoint must verify media digest to prevent replay after replacement',
  /const matchesTicket = \(candidate\)[\s\S]*?digest\('hex'\) === payload\.referenceDigest/
);
requireContains(
  'backend/app.js',
  'never log bearer tickets from media Range URLs',
  /req\.originalUrl[\s\S]*?startsWith\('\/api\/teachers\/admin-media-range\/'\)/
);
requireContains(
  'backend/routes/teachers.js',
  'range endpoint sends bounded partial content',
  /res\.setHeader\('Content-Range'/
);
requireContains(
  'backend/services/objectStorage.js',
  'private Vercel Blob Range reads must use store pathname rather than full URL',
  /const pathname = extractPathname\(stored\)[\s\S]*?return get\(pathname,/
);
requireContains(
  'backend/services/objectStorage.js',
  'Blob media reads must pass requested Range header',
  /\.\.\.\(options\.headers \? \{ headers: options\.headers \} : \{\}\)/
);

requireContains(
  'backend/routes/uploads.js',
  'Blob uploads must be private by default',
  /privateByDefault/
);

// Removed public mock confirmation route.
const routeFiles = fs.readdirSync(path.join(root, 'backend', 'routes')).filter((f) => f.endsWith('.js'));
for (const file of routeFiles) {
  const content = read(`backend/routes/${file}`);
  if (/confirm-mock/.test(content)) failures.push(`backend/routes/${file}: public mock confirmation endpoint exists`);
}

// T02: production JWT secrets must reject placeholders/reuse.
requireContains(
  'backend/middleware/auth.js',
  'production JWT secrets must reject weak placeholders',
  /isWeakProductionSecret/
);
requireContains(
  'backend/middleware/auth.js',
  'access and refresh JWT secrets must be distinct',
  /JWT_SECRET\s*===\s*JWT_REFRESH_SECRET/
);

// T02: browser credential origins fail closed in production.
requireContains(
  'backend/app.js',
  'CORS must use centralized trusted-origin policy',
  /isTrustedOrigin\(origin\)/
);
requireContains(
  'backend/app.js',
  'refresh endpoint must require trusted Origin',
  /app\.use\(['"]\/api\/auth\/refresh['"],\s*requireTrustedOrigin\)/
);
requireContains(
  'backend/app.js',
  'logout endpoint must require trusted Origin',
  /app\.use\(['"]\/api\/auth\/logout['"],\s*requireTrustedOrigin\)/
);
requireContains(
  'backend/config/origins.js',
  'Vercel preview origins must be explicit opt-in',
  /ALLOW_VERCEL_PREVIEW_ORIGINS\s*===\s*['"]true['"]/
);

// T02: teacher registration must verify the submitted email through a real delivery provider.
requireContains(
  'backend/routes/verification.js',
  'teacher OTP must be delivered through email',
  /sendEmail\(\{/
);
requireContains(
  'backend/routes/verification.js',
  'teacher verification proof must be bound to the verified email',
  /purpose:\s*['"]teacher-email-verification['"]/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher registration must match the verification email to the account email',
  /verification\.email\s*!==\s*normalizedEmail/
);
requireContains(
  'backend/services/notificationDispatcher.js',
  'production email delivery must fail closed without a provider',
  /NODE_ENV\s*===\s*['"]production['"][\s\S]{0,220}sent:\s*false/
);

// T02: privileged frontend routes must have a centralized role guard.
requireContains(
  'src/App.jsx',
  'admin route must be guarded centrally',
  /path=["']admin["'][\s\S]{0,160}ProtectedRoute\s+roles=\{\[['"]admin['"]\]\}/
);
requireContains(
  'src/App.jsx',
  'student dashboard must be guarded centrally',
  /path=["']student\/dashboard["'][\s\S]{0,180}ProtectedRoute\s+roles=\{\[['"]student['"]\]\}/
);
requireContains(
  'src/App.jsx',
  'teacher dashboard must be guarded centrally',
  /path=["']teacher\/dashboard["'][\s\S]{0,180}ProtectedRoute\s+roles=\{\[['"]teacher['"]\]\}/
);
requireContains(
  'src/App.jsx',
  'guardian dashboard must be guarded centrally',
  /path=["']guardian\/dashboard["'][\s\S]{0,180}ProtectedRoute\s+roles=\{\[['"]guardian['"]\]\}/
);
requireContains(
  'src/App.jsx',
  'legacy admin dashboard path must remain admin-only',
  /path=["']admin\/dashboard["'][\s\S]{0,180}ProtectedRoute\s+roles=\{\[['"]admin['"]\]\}/
);
requireContains(
  'src/components/dashboard/DashboardLayout.jsx',
  'dashboard role navigation must use the centralized route helper',
  /dashboardPathForRole\(user\?\.role,\s*locale\)/
);
requireAbsent(
  'src/components/dashboard/DashboardLayout.jsx',
  'dashboard layout must not hard-code a stale admin dashboard path',
  /['"]\/admin\/dashboard['"]/
);
requireContains(
  'src/pages/GuardianDashboard/index.jsx',
  'guardian UI must not be shared with admin role',
  /useRequireAuth\(\[['"]guardian['"]\]\)/
);

// T02: public circles must not expose member/contact PII and guardian joins need ownership.
requireContains(
  'backend/routes/circles.js',
  'public circle responses must use a sanitizer',
  /sanitizePublicCircle/
);
requireAbsent(
  'backend/routes/circles.js',
  'public circle route must not populate student PII',
  /\.populate\(['"]students['"]/
);
requireContains(
  'backend/routes/circles.js',
  'guardian circle joins must verify linked child ownership',
  /Guardian\.exists\([\s\S]{0,180}['"]children\.student['"]/
);
requireContains(
  'backend/routes/circles.js',
  'circle joins must restrict actor roles',
  /router\.post\(['"]\/:id\/join['"],\s*protect,\s*authorize\(['"]student['"],\s*['"]guardian['"],\s*['"]admin['"]\)/
);

// T02: assignment reads must enforce enrollment/instructor ownership.
requireContains(
  'backend/routes/assignments.js',
  'assignment list must have explicit role authorization',
  /router\.get\(['"]\/['"],\s*protect,\s*attachTeacherProfile,\s*authorize\(['"]student['"],\s*['"]teacher['"],\s*['"]admin['"]\)/
);
requireContains(
  'backend/routes/assignments.js',
  'student assignment reads must use enrollment ownership',
  /enrollmentFilter\s*=\s*\{[\s\S]{0,220}student:\s*req\.user\.id[\s\S]{0,260}Enrollment\.find\(enrollmentFilter\)/
);

// T02: paid LMS content/enrollment must fail closed.
requireContains(
  'backend/routes/lms.js',
  'paid course enrollment must require a payment flow',
  /PAYMENT_REQUIRED/
);
requireContains(
  'backend/routes/lms.js',
  'LMS course content must require an active or completed enrollment',
  /ENROLLMENT_REQUIRED/
);
requireContains(
  'backend/routes/lms.js',
  'lesson payload must hide quiz answer keys',
  /select:\s*['"]-questions\.correctAnswer -questions\.options\.isCorrect['"]/
);

// Dynamic contract: production without DB config must never enable mock mode.
const runtimeProbe = spawnSync(
  process.execPath,
  ['-e', "process.env.NODE_ENV='production'; delete process.env.MONGODB_URI; delete process.env.MONGODB_URL; const r=require('./config/runtime'); if(r.isMockMode) process.exit(7);"],
  { cwd: path.join(root, 'backend'), encoding: 'utf8' }
);
if (runtimeProbe.status !== 0) {
  failures.push('backend/config/runtime.js: production runtime can enable mock mode');
}

const weakSecretProbe = spawnSync(
  process.execPath,
  ['-e', "process.env.NODE_ENV='production'; process.env.JWT_SECRET='change-me-in-production-min-32-chars'; process.env.JWT_REFRESH_SECRET='abcdefghijklmnopqrstuvwxyz0123456789-refresh'; require('./middleware/auth');"],
  { cwd: path.join(root, 'backend'), encoding: 'utf8' }
);
if (weakSecretProbe.status === 0) {
  failures.push('backend/middleware/auth.js: production accepted a placeholder JWT secret');
}

const originProbe = spawnSync(
  process.execPath,
  ['-e', "process.env.NODE_ENV='production'; process.env.ALLOWED_ORIGINS='https://wahy-wa-namaa-academy.vercel.app'; const o=require('./config/origins'); if(!o.isTrustedOrigin('https://wahy-wa-namaa-academy.vercel.app')) process.exit(2); if(o.isTrustedOrigin('http://localhost:5173')) process.exit(3); if(o.isTrustedOrigin('https://wahy-wa-namaa-academy-random.vercel.app')) process.exit(4);"],
  { cwd: path.join(root, 'backend'), encoding: 'utf8' }
);
if (originProbe.status !== 0) {
  failures.push('backend/config/origins.js: production trusted-origin policy is not fail-closed');
}

// T10: teacher workflow and finance integrity.
requireContains(
  'backend/routes/sessions.js',
  'teacher must not complete a session before its scheduled start',
  /SESSION_NOT_STARTED/
);
requireContains(
  'backend/routes/sessions.js',
  'session completion must use the idempotent canonical teacher ledger',
  /ensureSessionEarning\(/
);
requireAbsent(
  'backend/routes/sessions.js',
  'new session completion must not credit legacy pendingEarnings directly',
  /router\.put\(['"]\/:id\/complete['"][\s\S]{0,3200}['"]earnings\.pendingEarnings['"]\s*:\s*SESSION_RATE/
);
requireContains(
  'backend/models/TeacherLedger.js',
  'teacher ledger entries must support unique sparse idempotency keys',
  /idempotencyKey:[\s\S]{0,160}unique:\s*true[\s\S]{0,80}sparse:\s*true/
);
requireContains(
  'backend/routes/teacherDashboard.js',
  'teacher homework revision must use owned storage lifecycle cleanup',
  /request-revision[\s\S]{0,1000}deleteStoredReference\([\s\S]{0,260}owner:\s*task\.student/
);
requireContains(
  'backend/routes/teacherDashboard.js',
  'teacher availability must reject overlapping slots',
  /OVERLAPPING_AVAILABILITY_SLOTS/
);

// T10.6: teacher video updates must stay private and audience-scoped.
requireContains(
  'backend/config/uploadPolicy.js',
  'teacher update videos must use a teacher-only private upload purpose',
  /['"]teacher-update-video['"]:\s*\{[\s\S]{0,220}roles:\s*\[['"]teacher['"]\][\s\S]{0,220}video\/mp4/
);
requireAbsent(
  'backend/routes/uploads.js',
  'teacher update videos must never be exposed by the public media proxy',
  /publicPurpose[\s\S]{0,320}teacher-update-video/
);
requireContains(
  'backend/routes/teacherUpdates.js',
  'teacher update uploads must verify object ownership before persistence',
  /referenceMatches\(reference,\s*VIDEO_PURPOSE,\s*req\.user\.id\)/
);
requireContains(
  'backend/routes/teacherUpdates.js',
  'student teacher-update listing must require recipient membership',
  /['"]audience\.students['"]:\s*req\.user\.id/
);
requireContains(
  'backend/routes/teacherUpdates.js',
  'student media access must verify the teacher-student relationship',
  /canStudentAccessUpdate[\s\S]{0,900}teacherHasStudent/
);
requireContains(
  'backend/routes/teacherUpdates.js',
  'video playback tokens must be short-lived and purpose scoped',
  /purpose:\s*VIDEO_PURPOSE[\s\S]{0,260}expiresIn:\s*ACCESS_TOKEN_TTL/
);
requireContains(
  'backend/routes/teacherUpdates.js',
  'student update payload must redact recipient identities',
  /includeAudienceStudents:\s*false/
);

// T10.5: booking must obey real teacher availability and conflict checks.
requireContains(
  'backend/routes/sessions.js',
  'trial and regular booking must validate teacher availability',
  /validateBookingSlot\(/
);
requireContains(
  'backend/routes/sessions.js',
  'teacher booking must expose conflict protection',
  /TEACHER_SLOT_CONFLICT/
);
requireContains(
  'backend/routes/sessions.js',
  'student booking must use a canonical availability-slots endpoint',
  /available-slots\/:teacherId/
);
requireContains(
  'backend/services/sessionScheduling.js',
  'timezone-safe scheduling must use IANA timezone conversion',
  /localDateTimeToUtc/
);

// T03: direct uploads must keep metadata validation and single-MIME token scope.
requireContains(
  'backend/routes/uploads.js',
  'direct uploads must validate filename, MIME, size and role through the shared policy',
  /validateUploadMetadata\s*\(/
);
requireContains(
  'backend/routes/uploads.js',
  'Vercel direct-upload token must be restricted to the validated MIME type',
  /allowedContentTypes\s*:\s*\[metadata\.contentType\]/
);
requireContains(
  'src/lib/fileUpload.js',
  'client upload payload must include filename, content type and size for server validation',
  /filename\s*:\s*file\.name[\s\S]{0,180}contentType\s*:\s*file\.type[\s\S]{0,180}size\s*:\s*file\.size/
);
requireContains(
  'backend/services/objectStorage.js',
  'object storage references must reject unsafe paths before ownership checks',
  /if\s*\(!isSafeObjectPath\(pathname\)\)\s*return\s*false/
);

// T03: safeguarding permissions must be enforced on guardian/minor data flows.
requireContains(
  'backend/routes/guardian.js',
  'guardian grade/report access must require the linked child viewGrades permission',
  /hasChildPermission\(guardian,\s*studentId,\s*['"]viewGrades['"]\)/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian child overview must redact attendance by permission',
  /attendance:\s*permissions\.viewAttendance\s*\?/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian child overview must redact grades by permission',
  /latestEvaluation:\s*permissions\.viewGrades\s*\?/
);

requireContains(
  'backend/routes/guardian.js',
  'guardian family overview must be guardian-only and multi-child aware',
  /router\.get\(['"]\/family-overview['"],\s*protect,\s*authorize\(['"]guardian['"]\)/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian family overview must snapshot each child independently',
  /entries\.map\(\(entry\)\s*=>[\s\S]{0,2000}pendingHomework[\s\S]{0,1600}attentionCount/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian child homework must require viewProgress permission',
  /router\.get\(['"]\/homework\/:studentId['"][\s\S]{0,700}hasChildPermission\(guardian,\s*studentId,\s*['"]viewProgress['"]\)/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian child-specific upcoming sessions must verify linked membership',
  /requestedStudentId[\s\S]{0,700}childIds\.some[\s\S]{0,300}هذا الطالب غير مرتبط/
);
requireContains(
  'backend/routes/guardian.js',
  'shared circle sessions must expand per linked child rather than selecting the first sibling',
  /upcoming\.flatMap\(\(sess\)[\s\S]{0,500}affectedChildren\.map/
);
requireAbsent(
  'backend/routes/guardian.js',
  'legacy single guardian pointer must not block another valid guardian link',
  /هذا الطالب مرتبط بالفعل بولي أمر آخر/
);
requireContains(
  'backend/routes/guardians.js',
  'unlinking one guardian must preserve an alternate guardian relationship',
  /alternateGuardian[\s\S]{0,800}guardian:\s*alternateGuardian\.user/
);

// T12: no-OTP guardian invitations must remain consent-based and scoped.
requireContains(
  'backend/routes/auth.js',
  'guardian self-registration must require a usable phone identity',
  /assignedRole\s*===\s*['"]guardian['"][\s\S]{0,260}!normalizedPhone/
);
requireContains(
  'backend/routes/auth.js',
  'student registration may create a pending guardian invitation without auto-linking',
  /user\.role\s*===\s*['"]student['"]\s*&&\s*guardianPhone[\s\S]{0,500}createGuardianInvitation/
);
requireAbsent(
  'backend/routes/auth.js',
  'registration must never directly assign a guardian relationship from a submitted phone',
  /guardianPhone[\s\S]{0,500}(?:student\.guardian\s*=|\$addToSet:\s*\{\s*children)/
);
requireContains(
  'backend/models/GuardianInvitation.js',
  'guardian invitations must have explicit pending/accepted/rejected/cancelled/expired lifecycle',
  /enum:\s*\[['"]pending['"],\s*['"]accepted['"],\s*['"]rejected['"],\s*['"]cancelled['"],\s*['"]expired['"]\]/
);
requireContains(
  'backend/services/guardianInvitations.js',
  'guardian invitation codes must be unique across invitations and legacy student codes',
  /GuardianInvitation\.exists\(\{\s*linkCode:\s*code\s*\}\)[\s\S]{0,220}User\.exists\(\{\s*guardianLinkCode:\s*code\s*\}\)/
);
requireContains(
  'backend/routes/guardian.js',
  'phone-matched guardian invitations must require explicit guardian response',
  /router\.post\(['"]\/invitations\/:id\/respond['"][\s\S]{0,1200}action[\s\S]{0,1200}linkGuardianToStudent/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian invitation acceptance must verify the logged-in guardian phone',
  /invitation\.guardianPhoneNormalized\s*!==\s*normalizedPhone/
);
requireContains(
  'backend/routes/guardian.js',
  'ambiguous duplicate guardian phone identities must fall back to link code',
  /duplicateCount\s*>\s*1[\s\S]{0,260}requiresCode:\s*true/
);
requireContains(
  'backend/routes/guardian.js',
  'guardian link code fallback must accept pending invitation codes',
  /GuardianInvitation\.findOne\([\s\S]{0,500}linkCode:\s*normalizedCode[\s\S]{0,1000}linkGuardianToStudent/
);
requireContains(
  'backend/routes/studentDashboard.js',
  'students must be able to cancel only their own pending guardian invitations',
  /GuardianInvitation\.findOne\([\s\S]{0,300}student:\s*req\.user\.id[\s\S]{0,180}status:\s*['"]pending['"]/
);

requireAbsent(
  'backend/routes/guardian.js',
  'guardian session payload must not expose teacher phone numbers now that communication is moving in-platform',
  /teacherPhone|teacher:\s*\{[\s\S]{0,160}phone:/
);
requireContains(
  'backend/routes/guardians.js',
  'stored guardian reports must be filtered using current permissions',
  /filterReportForPermissions\(report,\s*access\.permissions\)/
);
requireContains(
  'backend/routes/guardians.js',
  'guardian permission updates must be whitelisted and boolean-only',
  /allowedPermissionKeys[\s\S]{0,500}typeof value !== ['"]boolean['"]/
);
requireContains(
  'backend/routes/trials.js',
  'minor trial requests must require guardian identity',
  /parsedAge\s*<\s*18[\s\S]{0,160}cleanGuardianName\.length\s*<\s*2/
);

// T05: submission deletion must remain business-record and owner scoped.
requireContains(
  'backend/services/objectStorage.js',
  'external object deletion must verify purpose and owner first',
  /deleteOwnedObject\([\s\S]{0,220}isOwnedObjectReference/
);
requireContains(
  'backend/routes/homework.js',
  'homework submission deletion must pass the original student owner to lifecycle cleanup',
  /deleteStoredReference\([\s\S]{0,220}purpose:\s*['"]homework['"][\s\S]{0,160}owner:\s*submission\.student/
);
requireContains(
  'backend/routes/assignments.js',
  'assignment submission deletion must pass the original student owner to lifecycle cleanup',
  /deleteStoredReference\([\s\S]{0,220}purpose:\s*['"]assignment['"][\s\S]{0,160}owner:\s*submission\.student/
);
requireContains(
  'backend/routes/assignments.js',
  'assignments with submissions must not be deleted before submission cleanup',
  /AssignmentSubmission\.exists\([\s\S]{0,420}ASSIGNMENT_HAS_SUBMISSIONS/
);
requireContains(
  'backend/routes/homework.js',
  'task submissions must not be overwritten while an old file reference exists',
  /task\.submissionFile[\s\S]{0,220}SUBMISSION_EXISTS/
);

// T05: teacher asset cleanup must be traceable, explicit and fail closed.
requireContains(
  'backend/models/Teacher.js',
  'teacher storage owner metadata must stay hidden from normal queries',
  /storageOwner:\s*\{[\s\S]{0,120}select:\s*false/
);
requireContains(
  'backend/routes/teachers.js',
  'new teacher applications must persist the verified upload owner',
  /storageOwner:\s*externalStorage\s*&&\s*uploadOwner/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher asset purge must be admin-only',
  /router\.delete\(['"]\/admin\/:id\/assets['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher asset purge must be limited to rejected or suspended records',
  /\[['"]rejected['"],\s*['"]suspended['"]\]\.includes\(teacher\.status\)/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher asset purge must resolve ownership before deleting provider objects',
  /resolveOwnedTeacherAssets\([\s\S]{0,1200}deleteOwnedObject\(asset\.reference,\s*asset\.purpose,\s*asset\.owner\)/
);
requireContains(
  'backend/services/objectStorage.js',
  'public media proxy references must be unwrapped before provider lifecycle operations',
  /function\s+unwrapPublicProxyReference\s*\(/
);

// T05.3 cleanup: temporary production verification routes must not remain in the application.
requireAbsent(
  'backend/routes/uploads.js',
  'temporary storage lifecycle probe routes must be removed after production verification',
  /storage-e2e/
);
requireAbsent(
  'backend/routes/uploads.js',
  'temporary storage lifecycle secrets must not remain referenced by application routes',
  /STORAGE_E2E_(?:SECRET|QUERY_BRIDGE)/
);

// T06: payment truth and webhook idempotency contracts.
requireContains(
  'backend/models/Payment.js',
  'payment records must store integer minor units',
  /amountMinor:[\s\S]{0,220}Number\.isSafeInteger/
);
requireContains(
  'backend/models/PaymentWebhookEvent.js',
  'provider webhook event ids must be unique per provider',
  /PaymentWebhookEventSchema\.index\([\s\S]{0,180}provider:\s*1[\s\S]{0,80}eventId:\s*1[\s\S]{0,80}unique:\s*true/
);
requireContains(
  'backend/routes/donations.js',
  'public contribution totals must include confirmed donations only',
  /\$match:\s*\{\s*status:\s*['"]confirmed['"]\s*\}/
);
requireAbsent(
  'backend/routes/donations.js',
  'public contribution totals must not mix pledged donations with confirmed funds',
  /status:\s*\{\s*\$in:\s*\[['"]pledged['"],\s*['"]confirmed['"]\]/
);
requireContains(
  'backend/routes/courses.js',
  'paid course enrollment must remain blocked until the real payment flow settles',
  /PAYMENT_REQUIRED/
);
requireContains(
  'backend/routes/lms.js',
  'paid LMS enrollment must remain blocked until the real payment flow settles',
  /PAYMENT_REQUIRED/
);

// T06.2: Paymob checkout and webhook settlement must remain fail-closed.
requireContains(
  'backend/routes/payments.js',
  'paid course checkout must derive the amount from the server-side course price',
  /toMinorUnits\(course\.price,\s*currency\)/
);
requireAbsent(
  'backend/routes/payments.js',
  'paid checkout must never trust a client-supplied payment amount',
  /toMinorUnits\(req\.body|amountMinor:\s*req\.body|amount:\s*req\.body/
);
requireContains(
  'backend/routes/payments.js',
  'Paymob transaction HMAC must be verified before settlement processing',
  /verifyTransactionPostHmac\(obj,\s*receivedHmac\)[\s\S]{0,1800}processPaymobWebhook\(/
);
requireContains(
  'backend/services/paymentSettlement.js',
  'payment fulfillment must execute inside a Mongo transaction',
  /session\.withTransaction\(/
);
requireContains(
  'backend/services/paymentSettlement.js',
  'successful provider settlement must create course enrollment through the settlement service',
  /classification\s*===\s*['"]succeeded['"][\s\S]{0,900}createEnrollmentForSettledPayment/
);
requireAbsent(
  'backend/routes/payments.js',
  'browser redirect/query parameters must not mark a payment succeeded',
  /req\.query\.(?:success|pending|amount_cents|merchant_order_id)[\s\S]{0,300}(?:succeeded|settledAt|Enrollment)/
);
requireContains(
  'backend/services/paymob.js',
  'Paymob webhook verification must use HMAC-SHA512',
  /createHmac\(['"]sha512['"]/
);
requireContains(
  'backend/routes/lms.js',
  'direct paid LMS enrollment must remain blocked outside the settlement path',
  /PAYMENT_REQUIRED/
);


// Subscription pricing must remain server-authoritative before payment integration.
requireContains(
  'backend/routes/subscriptions.js',
  'subscription selection must derive pricing from the server-side catalog',
  /quoteSubscription\(\{\s*planKey,\s*sessionCount\s*\}\)[\s\S]{0,1800}pricePerSessionMinor:\s*quote\.pricePerSessionMinor[\s\S]{0,300}totalAmountMinor:\s*quote\.totalAmountMinor/
);
requireAbsent(
  'backend/routes/subscriptions.js',
  'subscription selection must never trust a client-supplied amount',
  /req\.body\.(?:price|amount|pricePerSessionMinor|totalAmountMinor)/
);
requireContains(
  'backend/models/GroupCircle.js',
  'group circles must allow the approved 20-student economic plan capacity',
  /capacity:[\s\S]{0,100}max:\s*20/
);
requireContains(
  'backend/routes/payments.js',
  'subscription manual payment must derive amount from the stored subscription quote',
  /kind:\s*['"]subscription['"][\s\S]{0,900}amountMinor:\s*subscription\.totalAmountMinor[\s\S]{0,120}currency:\s*subscription\.currency/
);
requireAbsent(
  'backend/routes/payments.js',
  'subscription manual payment must never trust a client supplied amount',
  /subscription\/:id\/manual[\s\S]{0,2600}(?:req\.body\.(?:amount|amountMinor|price)|amountMinor:\s*req\.body)/
);
requireContains(
  'backend/routes/payments.js',
  'subscription payment proof must remain owner scoped',
  /subscription\/:id\/manual[\s\S]{0,1600}isOwnedObjectReference\([\s\S]{0,180}['"]payment-proof['"][\s\S]{0,120}req\.user\.id/
);
requireContains(
  'backend/models/Payment.js',
  'pending subscription manual payments must be unique per student and subscription',
  /student:\s*1,\s*subscription:\s*1,\s*provider:\s*1,\s*status:\s*1[\s\S]{0,260}unique:\s*true[\s\S]{0,260}kind:\s*['"]subscription['"][\s\S]{0,160}provider:\s*['"]manual['"][\s\S]{0,160}status:\s*['"]pending['"]/
);
requireContains(
  'backend/services/manualPaymentSettlement.js',
  'new subscription payments must move to placement while early renewals queue',
  /subscription\.renewalOf[\s\S]{0,1800}subscription\.status\s*=\s*['"]renewal_queued['"][\s\S]{0,2200}subscription\.status\s*=\s*['"]awaiting_placement['"]/
);
requireContains(
  'backend/routes/subscriptions.js',
  'renewal pricing must remain server-authoritative and reuse the current plan',
  /router\.post\(['"]\/:id\/renew['"][\s\S]{0,1800}quoteSubscription\(\{\s*planKey:\s*source\.planKey,\s*sessionCount\s*\}\)[\s\S]{0,1800}preferredTeacher:\s*source\.preferredTeacher[\s\S]{0,300}circle:\s*source\.circle/
);
requireContains(
  'backend/routes/subscriptions.js',
  'normal plan selection must not overwrite a pending renewal',
  /pendingRenewal[\s\S]{0,900}RENEWAL_PAYMENT_PENDING[\s\S]{0,2600}findOneAndUpdate\([\s\S]{0,220}renewalOf:\s*null/
);
requireContains(
  'backend/routes/subscriptions.js',
  'subscription placement must remain admin-only',
  /router\.post\(['"]\/admin\/:id\/place['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/services/subscriptionPlacement.js',
  'placement must use the student preferred teacher',
  /subscription\.preferredTeacher[\s\S]{0,1000}Teacher\.findOne\([\s\S]{0,260}_id:\s*subscription\.preferredTeacher/
);
requireContains(
  'backend/services/subscriptionPlacement.js',
  'group activation must obey the selected plan minimum',
  /studentIds\.length\s*<\s*plan\.minStudents/
);
requireContains(
  'backend/services/subscriptionPlacement.js',
  'existing circle placement must match student gender age track and level',
  /gender:\s*expectedGender[\s\S]{0,180}targetAgeGroup:\s*expectedAgeGroup[\s\S]{0,180}track:\s*expectedTrack[\s\S]{0,180}level:\s*expectedLevel/
);
requireContains(
  'backend/routes/payments.js',
  'subscription payment review must notify the student about placement or retry',
  /result\?\.subscriptionId[\s\S]{0,3600}notifyUser\(result\.studentId/
);
requireContains(
  'backend/routes/subscriptions.js',
  'subscription placement must notify the learner lifecycle state',
  /subscriptionStatus\s*===\s*['"]active['"][\s\S]{0,2400}notifyUser\(result\.studentId/
);
requireContains(
  'backend/models/SubscriptionUsage.js',
  'subscription usage ledger must be unique per subscription and session',
  /subscription:\s*1,\s*session:\s*1[\s\S]{0,120}unique:\s*true/
);
requireContains(
  'backend/routes/sessions.js',
  'group circle scheduling must be teacher/admin protected and require an active circle',
  /router\.post\(['"]\/group-circle['"],\s*protect,\s*authorize\(['"]teacher['"],\s*['"]admin['"]\)[\s\S]{0,900}\[['"]active['"],\s*['"]full['"]\]\.includes\(circle\.status\)/
);
requireContains(
  'backend/routes/sessions.js',
  'group circle scheduling must snapshot the roster into attendance',
  /const attendance\s*=\s*rosterIds\.map[\s\S]{0,900}type:\s*['"]group_circle['"][\s\S]{0,500}attendance/
);
requireContains(
  'backend/routes/sessions.js',
  'group attendance updates must be teacher/admin protected and restricted to final states',
  /router\.patch\(['"]\/:id\/attendance['"],\s*protect,\s*authorize\(['"]teacher['"],\s*['"]admin['"]\)[\s\S]{0,2600}new Set\(\[['"]attended['"],\s*['"]absent['"],\s*['"]excused['"]\]\)/
);
requireContains(
  'backend/routes/sessions.js',
  'group completion must fail closed until attendance is finalized',
  /session\.type\s*===\s*['"]group_circle['"][\s\S]{0,700}ATTENDANCE_INCOMPLETE/
);
requireContains(
  'backend/routes/sessions.js',
  'group completion must settle subscription credits idempotently',
  /session\.type\s*===\s*['"]group_circle['"][\s\S]{0,160}settleSubscriptionUsageForSession\(session\)/
);
requireContains(
  'backend/services/subscriptionUsage.js',
  'eligible early excuses must preserve the package credit',
  /status\s*===\s*['"]excused['"]\s*&&\s*eligible[\s\S]{0,160}outcome:\s*['"]compensated['"]/
);
requireContains(
  'backend/services/subscriptionUsage.js',
  'a paid queued renewal must activate when the previous package reaches zero',
  /renewalOf:\s*subscription\._id[\s\S]{0,220}status:\s*['"]renewal_queued['"][\s\S]{0,500}queuedRenewal\.status\s*=\s*['"]active['"]/
);
requireContains(
  'backend/services/subscriptionUsage.js',
  'exhausted subscriptions must remove future circle attendance and direct circle access',
  /subscription\.status\s*===\s*['"]completed['"][\s\S]{0,1200}\$pull:\s*\{\s*students:\s*studentId[\s\S]{0,800}\$unset:\s*\{\s*circle:\s*1[\s\S]{0,900}\$pull:\s*\{\s*attendance:\s*\{\s*student:\s*studentId/
);
requireContains(
  'backend/services/teacherFinance.js',
  'teacher session earnings must scale by duration from the hourly rate',
  /function\s+calculateSessionEarning[\s\S]{0,500}rate\s*\*\s*duration\s*\/\s*60/
);
requireContains(
  'backend/routes/sessions.js',
  'session completion must use the duration based teacher earning calculator',
  /calculateSessionEarning\(HOURLY_RATE,\s*sessionDuration\)/
);

// T07.2d: manual transfer approval must remain private, admin-only and transactional.
requireContains(
  'backend/config/uploadPolicy.js',
  'payment proofs must be restricted to student private upload policy',
  /['"]payment-proof['"]:\s*\{[\s\S]{0,180}roles:\s*\[['"]student['"]\]/
);
requireContains(
  'backend/routes/payments.js',
  'manual payment submission must verify proof ownership',
  /isOwnedObjectReference\([\s\S]{0,220}['"]payment-proof['"][\s\S]{0,160}req\.user\.id/
);
requireContains(
  'backend/routes/payments.js',
  'manual payment review must be admin-only',
  /router\.patch\(['"]\/admin\/manual\/:id\/review['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/services/manualPaymentSettlement.js',
  'manual payment approval must execute in a Mongo transaction',
  /session\.withTransaction\(/
);
requireContains(
  'backend/services/manualPaymentSettlement.js',
  'manual payment approval must create enrollment through the settlement service',
  /normalizedAction\s*===\s*['"]approve['"][\s\S]{0,7200}createEnrollmentForSettledPayment/
);
requireAbsent(
  'backend/routes/uploads.js',
  'payment proofs must never be included in the public media proxy',
  /publicPurpose[\s\S]{0,300}payment-proof/
);


// T07.2i: teacher applicants must remain locked out until admin approval.
requireContains(
  'backend/routes/auth.js',
  'teacher login must check the application approval gate before issuing tokens',
  /user\.role\s*===\s*['"]teacher['"][\s\S]{0,900}getTeacherAccessDecision[\s\S]{0,900}generateAccessToken/
);
requireContains(
  'backend/middleware/auth.js',
  'protected teacher API access must re-check the application approval gate',
  /req\.user\.role\s*===\s*['"]teacher['"][\s\S]{0,700}getTeacherAccessDecision/
);
requireContains(
  'backend/routes/teachers.js',
  'new teacher applications must require both sides of the identity card',
  /TEACHER_ID_FRONT_REQUIRED[\s\S]{0,700}TEACHER_ID_BACK_REQUIRED/
);
requireContains(
  'backend/routes/teachers.js',
  'optional teacher documents must use explicit availability declarations',
  /TEACHER_DOCUMENT_DECLARATION_REQUIRED/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher review decisions must revoke outstanding refresh sessions',
  /refreshTokenVersion:\s*1/
);

requireContains(
  'backend/routes/teachers.js',
  'new teacher applications must require a dedicated introduction video',
  /TEACHER_INTRODUCTION_VIDEO_REQUIRED/
);
requireContains(
  'backend/routes/teachers.js',
  'new teacher applications must require a dedicated teaching-method video',
  /TEACHER_TEACHING_METHOD_VIDEO_REQUIRED/
);
requireContains(
  'src/pages/TeacherRegistration/useTeacherForm.js',
  'teacher registration must upload introduction and teaching method videos separately',
  /one\(['"]introductionVideo['"],[\s\S]{0,700}one\(['"]teachingMethodVideo['"]/
);

// T13: admin teacher approval must be review-gated, auditable and private.
requireContains(
  'backend/routes/teachers.js',
  'teacher approval must fail closed until the required review checklist is complete',
  /action\s*===\s*['"]approve['"]\s*&&\s*!gate\.approvalReady[\s\S]{0,700}TEACHER_REVIEW_GATE_INCOMPLETE/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher checklist updates must be admin-only',
  /router\.put\(['"]\/admin\/:id\/review-checklist\/:key['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher private media review must be admin-only and audited',
  /router\.get\(['"]\/admin\/:id\/media\/:kind[\s\S]{0,1000}teacher\.sensitive-media\.viewed/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher sensitive document review must write an audit event',
  /teacher\.sensitive-document\.viewed/
);
requireContains(
  'backend/routes/admin.js',
  'generic admin teacher updates must not bypass the approval gate',
  /status\s*===\s*['"]approved['"][\s\S]{0,300}USE_TEACHER_REVIEW_GATE/
);
requireContains(
  'backend/routes/admin.js',
  'admin-created teachers must enter review rather than auto-approve',
  /status:\s*['"]pending['"][\s\S]{0,120}isVerified:\s*false/
);
requireContains(
  'backend/routes/admin.js',
  'admin command center must be admin-only',
  /router\.get\(['"]\/command-center['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/routes/admin.js',
  'admin audit log must be admin-only',
  /router\.get\(['"]\/audit['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/services/adminAudit.js',
  'admin audit metadata must filter obvious secret/reference fields',
  /\['reference',\s*'url',\s*'token',\s*'password',\s*'secret'\]/
);
requireContains(
  'backend/services/teacherReview.js',
  'teacher review gate must require both sides of teacher identity',
  /id-card-front[\s\S]{0,500}id-card-back/
);
requireContains(
  'backend/services/teacherReview.js',
  'teacher review gate must require introduction, recitation and teaching-method media',
  /introduction-video[\s\S]{0,500}recitation-video[\s\S]{0,500}teaching-method-video/
);
requireContains(
  'backend/models/AdminAuditLog.js',
  'admin audit records must be append-only at the application layer',
  /Admin audit log entries are append-only/
);

// T14: admin people intelligence must remain admin-only, privacy-aware and auditable.
requireContains(
  'backend/app.js',
  'specific admin people routes must mount before the generic admin router',
  /app\.use\(['"]\/api\/admin\/people['"][\s\S]{0,220}app\.use\(['"]\/api\/admin['"]/
);
requireContains(
  'backend/routes/adminPeople.js',
  'global people search and 360 dossiers must be admin-only',
  /router\.use\(protect,\s*authorize\(['"]admin['"]\)\)/
);
requireContains(
  'backend/routes/adminPeople.js',
  'admin global search input must be bounded before regex matching',
  /req\.query\.q[\s\S]{0,100}slice\(0,\s*120\)/
);
requireContains(
  'backend/routes/adminPeople.js',
  'Student 360 access must create an admin audit event',
  /student\.360\.viewed/
);
requireContains(
  'backend/routes/adminPeople.js',
  'Family 360 access must create an admin audit event',
  /guardian\.360\.viewed/
);
requireContains(
  'backend/routes/adminPeople.js',
  'guardian invitation phone numbers must be masked in admin dossier responses',
  /phoneMasked:\s*maskPhone\(invitation\.guardianPhone\)/
);
requireContains(
  'backend/routes/adminPeople.js',
  'student homework storage references must be reduced to an availability flag',
  /submissionAvailable:\s*Boolean\(task\.submissionFile\)/
);
requireAbsent(
  'backend/routes/adminPeople.js',
  'Student 360 must not expose a raw homework submissionFile property',
  /\bsubmissionFile\s*:/
);
requireAbsent(
  'backend/routes/adminPeople.js',
  'Student 360 must not expose raw session meeting links',
  /\bmeetingLink\s*:/
);
requireAbsent(
  'backend/routes/adminPeople.js',
  'Student 360 must not expose raw recording URLs',
  /\brecordingUrl\s*:/
);
requireContains(
  'backend/routes/homework.js',
  'admin Student 360 homework audio reads must be audit logged',
  /student\.homework-audio\.viewed/
);

// T17: command-center destinations must be real, admin-only and privacy-safe.
requireContains(
  'backend/routes/admin.js',
  'guardian command action must route to the guardian-link destination',
  /guardian-links[\s\S]{0,350}tab=people&focus=guardian-links/
);
requireContains(
  'backend/routes/admin.js',
  'overdue session action must route to session control',
  /overdue-sessions[\s\S]{0,350}tab=sessions&focus=overdue/
);
requireContains(
  'backend/routes/admin.js',
  'missing report action must route to session control',
  /missing-session-reports[\s\S]{0,350}tab=sessions&focus=missing-reports/
);
requireContains(
  'backend/routes/admin.js',
  'session control endpoint must be admin-only',
  /router\.get\(['"]\/session-control['"],\s*protect,\s*authorize\(['"]admin['"]\)/
);
requireContains(
  'backend/routes/admin.js',
  'session control must reduce private meeting and recording data to availability flags',
  /meetingAvailable:\s*Boolean\(session\.meetingLink\)[\s\S]{0,120}recordingAvailable:\s*Boolean\(session\.recordingUrl\)/
);
requireAbsent(
  'backend/routes/admin.js',
  'session control response must not expose a raw meetingLink property',
  /\bmeetingLink\s*:/
);
requireAbsent(
  'backend/routes/admin.js',
  'session control response must not expose a raw recordingUrl property',
  /\brecordingUrl\s*:/
);
requireContains(
  'backend/routes/adminPeople.js',
  'admin people router must remain admin-only',
  /router\.use\(protect,\s*authorize\(['"]admin['"]\)\)/
);
requireContains(
  'backend/routes/adminPeople.js',
  'guardian-link destination must stay inside the protected admin people router',
  /router\.get\(['"]\/guardian-links['"]/
);
requireContains(
  'backend/routes/adminPeople.js',
  'guardian-link destination must mask phone identity',
  /phoneMasked:\s*maskPhone\(invitation\.guardianPhone\)/
);
requireContains(
  'backend/routes/adminPeople.js',
  'guardian-link destination access must be audit logged',
  /guardian-links\.viewed/
);
requireContains(
  'backend/routes/admin.js',
  'session-control access must be audit logged',
  /session-control\.viewed/
);



requireContains(
  'backend/config/uploadPolicy.js',
  'session chat voice notes must stay on a dedicated 10 MB private upload purpose',
  /['"]session-chat-audio['"][\s\S]{0,260}roles:\s*\[['"]student['"],\s*['"]teacher['"]\][\s\S]{0,220}10\s*\*\s*1024\s*\*\s*1024/
);
requireContains(
  'backend/routes/sessionTranslate.js',
  'session voice note reads must require session membership before private object streaming',
  /messages\/:messageId\/audio[\s\S]{0,500}canAccessSession[\s\S]{0,700}getPrivateObject/
);
requireContains(
  'backend/routes/sessionTranslate.js',
  'chat voice note references must be ownership checked before persistence',
  /isOwnedObjectReference\([\s\S]{0,220}session-chat-audio/
);
requireAbsent(
  'backend/routes/uploads.js',
  'session chat audio must never be served by the public media proxy',
  /publicPurpose[\s\S]{0,300}session-chat-audio/
);


requireContains(
  'backend/routes/teachers.js',
  'teacher application status polling token must be purpose-scoped',
  /purpose:\s*['"]teacher-application-status['"][\s\S]{0,500}expiresIn:\s*['"]7d['"]/
);
requireContains(
  'backend/routes/teachers.js',
  'teacher application status endpoint must bind the token to teacher and user identifiers',
  /router\.post\(['"]\/application-status['"][\s\S]{0,1200}_id:\s*payload\.teacherId[\s\S]{0,300}user:\s*payload\.userId/
);
requireContains(
  'src/pages/AdminDashboard/index.jsx',
  'admin pending-teacher queue must auto-refresh while visible',
  /setInterval\(refreshQueue,\s*12000\)/
);
requireContains(
  'src/pages/TeacherRegistration/useTeacherForm.js',
  'teacher waiting screen must poll approval without repeatedly attempting login',
  /teachers\/application-status[\s\S]{0,1000}setInterval[\s\S]{0,300}10000/
);


requireContains('backend/routes/subscriptions.js', 'circle start must remain admin-only', /router\.post\(['"]\/admin\/circles\/:id\/start['"],\s*protect,\s*authorize\(['"]admin['"]\)/);
requireContains('backend/services/subscriptionUsage.js', 'settlement must deduplicate by learner and session before choosing a renewed package', /const existingUsage[\s\S]{0,180}student:\s*studentId,\s*session:\s*sessionDoc\._id[\s\S]{0,650}const subscription/);
requireContains('backend/services/subscriptionUsage.js', 'concurrent renewal settlement must lock the circle inside the transaction', /withTransaction[\s\S]{0,550}\$inc:\s*\{\s*subscriptionUsageVersion:\s*1/);
requireContains('backend/routes/circles.js', 'subscription circles cannot bypass paid admin placement', /router\.post\(['"]\/:id\/join['"][\s\S]{0,1800}SUBSCRIPTION_PLACEMENT_REQUIRED/);

// Backend Wave 1 (A7, 019, 021, 026, 032, 038, 041, 045):
requireContains(
  'backend/models/User.js',
  'user model must track failedLoginAttempts and lockUntil behind select:false',
  /failedLoginAttempts:\s*\{[\s\S]{0,120}select:\s*false[\s\S]{0,160}lockUntil:\s*\{[\s\S]{0,120}select:\s*false/
);
requireContains(
  'backend/routes/auth.js',
  'login must enforce temporary account lockout on repeated failures',
  /ACCOUNT_LOCKED[\s\S]{0,1200}MAX_FAILED_LOGIN_ATTEMPTS/
);
requireContains(
  'backend/middleware/userRateLimit.js',
  'per-user rate limiter must key by authenticated actor or IP fallback',
  /userRateLimiter[\s\S]{0,600}USER_RATE_LIMIT_EXCEEDED/
);
requireContains(
  'backend/middleware/correlationId.js',
  'correlationId middleware must attach X-Request-Id header',
  /res\.setHeader\(['"]X-Request-Id['"],\s*requestId\)/
);
requireContains(
  'backend/utils/logger.js',
  'structured logger must provide recursive PII masking',
  /function\s+maskPII\s*\(/
);
requireContains(
  'backend/routes/payments.js',
  'manual payment admin review must write an append-only audit log entry',
  /payment\.manual\.approved[\s\S]{0,120}payment\.manual\.rejected/
);

// Backend Wave 2 (036, 050, 091, 092, 103, 158):
requireContains(
  'backend/app.js',
  'request sanitizer must strip inline script tags and event handlers',
  /function\s+sanitizeStringValue\s*\([\s\S]{0,600}javascript\|vbscript/
);
requireContains(
  'backend/utils/magicBytes.js',
  'upload magic-byte validator must check binary headers for PDF, PNG, JPEG, MP4, WebM, WAV, OGG, MP3',
  /function\s+validateMagicBytes\s*\([\s\S]{0,2000}application\/pdf[\s\S]{0,1600}video\/mp4/
);
requireContains(
  'backend/models/Teacher.js',
  'teacher model must define compound index for approved/verified directory sorting',
  /TeacherSchema\.index\(\{\s*status:\s*1,\s*isVerified:\s*1,\s*['"]rating\.average['"]:\s*-1\s*\}\)/
);
requireContains(
  'backend/models/Session.js',
  'session model must define compound indexes for teacher and student status scheduling',
  /SessionSchema\.index\(\{\s*teacher:\s*1,\s*status:\s*1,\s*scheduledAt:\s*1\s*\}\)/
);
requireContains(
  'backend/config/database.js',
  'database connection pool must configure minPoolSize and maxIdleTimeMS',
  /minPoolSize:[\s\S]{0,180}maxIdleTimeMS:/
);

// Backend Wave 3 (011, 027, 042, 043, 044):
requireContains(
  'backend/routes/auth.js',
  'auth router must support active session revocation across all devices (/logout-all and /sessions)',
  /router\.post\(['"]\/logout-all['"][\s\S]{0,1600}router\.get\(['"]\/sessions['"]/
);
requireContains(
  'backend/routes/auth.js',
  'auth router must support privacy data export and account deletion request (/privacy/export and /privacy/delete-request)',
  /router\.get\(['"]\/privacy\/export['"][\s\S]{0,1600}router\.post\(['"]\/privacy\/delete-request['"]/
);
requireContains(
  'backend/models/User.js',
  'user model must track privacyConsent and parentalConsentVerified',
  /privacyConsent:\s*\{[\s\S]{0,300}parentalConsentVerified:/
);
requireContains(
  '.github/dependabot.yml',
  'Dependabot configuration must monitor root and backend npm ecosystems',
  /package-ecosystem:\s*["']npm["'][\s\S]{0,400}directory:\s*["']\/backend["']/
);

if (failures.length) {
  console.error('Security contracts failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Security contracts passed.');
