# تقرير الفحص الشامل للأدوار الأربعة وخطة العمل القادمة — أكاديمية وَحْيٌ وَنَمَاء

> **تاريخ الفحص:** 26 أكتوبر 2026  
> **نطاق الفحص:** محاكاة حية شاملة (Live API & E2E Simulation) على السيرفر الخلفي (`http://127.0.0.1:4000/api`) والواجهة الأمامية (`http://127.0.0.1:3500`) مع تدقيق الكود المصدري (`src/` و `backend/`) عبر **4 وكلاء متخصصين**:
> 1. **وكيل ولي الأمر (Guardian)**
> 2. **وكيل الطالب (Student)**
> 3. **وكيل المعلم (Teacher)**
> 4. **وكيل الإدارة (Admin)**

---

## أولاً: قمنا بعمل فحص لإيه؟ (نطاق الفحص والاختبار)

قمنا بمحاكاة الرحلة الكاملة في المنصة من لحظة دخول الزائر والتسجيل وحتى حجز وحضور وتقييم الحصة التجريبية والاشتراك المالي، وشمل الفحص المحاور التالية:

### 1. فحص رحلة ولي الأمر (Guardian Journey)
- تسجيل حساب ولي أمر جديد (`POST /api/auth/register` مع `role: 'guardian'`) والتحقق من إلزامية رقم الهاتف ومنع تكراره.
- استكمال الإعداد الأولي وتحديث الملف الشخصي (`PATCH /api/auth/onboarding` و `PATCH /api/auth/me`).
- آلية ربط الأبناء (`POST /api/guardian/link-child` عبر كود الطالب `WN-XXXXXXXX`، واستقبال وقبول دعوات الربط `GET /api/guardian/invitations` و `POST /api/guardian/invitations/:id/respond`).
- لوحة تحكم ولي الأمر (`/guardian/dashboard`): استعراض الأبناء، جدول مقارنة الأبناء (`family-overview`)، تقارير الحصص، الواجبات، ونسب الحضور.
- تأكيد حضور الأبناء للحصص أو الاعتذار المسبق (`POST /api/sessions/:id/rsvp`) وحساب قاعدة الـ 6 ساعات للحصة التعويضية.
- دخول ولي الأمر لغرفة الحصة المباشرة كمراقب صامت (`/api/live/token` و `/api/meetings/session/:id`).
- قدرة ولي الأمر على حجز حصة تجريبية لابنه وإدارة اشتراكات ومدفوعات الأبناء.

### 2. فحص رحلة الطالب (Student Journey)
- تسجيل طالب بالغ وطالب قاصر أقل من 18 سنة (`POST /api/auth/register`) والتحقق من اشتراط موافقة وبيانات ولي الأمر (`GUARDIAN_CONTACT_REQUIRED` و `parentalConsentVerified`).
- خطوات تهيئة الحساب (`/profile/setup` ← `PATCH /api/auth/onboarding`) واختيار المسار التعليمي (`/journey` ← `PATCH /api/auth/learning-track`).
- استعراض المعلمين (`GET /api/teachers`) والخطط والباقات (`GET /api/subscriptions/plans`).
- حجز الحصة التجريبية عبر المسار العام (`/free-trial` ← `POST /api/trials`) والمسار المباشر مع معلم محدد (`/book-trial/:teacherId` ← `POST /api/sessions/trial`).
- لوحة تحكم الطالب (`/student/dashboard`)، الإلهام اليومي، تتبع الحفظ، والدخول للفصل الافتراضي (`/live/:roomId` و `/meeting/:sessionId`).
- اختيار الباقة ورفع إيصال الدفع اليدوي (`/payment/manual` ← `POST /api/payments/subscription/:id/manual`).
- ميزات الأمان والخصوصية الجديدة (`/api/auth/sessions`, `/api/auth/logout-all`, `/api/auth/privacy/export`, `/api/auth/privacy/delete-request`).

### 3. فحص رحلة المعلم (Teacher Journey)
- معالج تسجيل المعلم المكون من 5 خطوات (`/register/teacher` ← `POST /api/teachers/register`).
- سياسات رفع ملفات المعلم (الصورة الشخصية، الهوية، الإجازات، وفيديوهات التلاوة/التعريف/الشرح) وفحص البصمة الثنائية (`validateMagicBytes`).
- بوابة حماية المعلم قبل موافقة الإدارة (`TeacherDashboardGate` ومنع الدخول في `verifyAccessToken` بكود `403 TEACHER_APPROVAL_PENDING`).
- لوحة تحكم المعلم بعد الاعتماد (`/teacher/dashboard`): الملف الشخصي، المحفظة، تعديل البيانات العامة (`profile-change`)، وحفظ جدول التوفر الأسبوعي (`PUT /api/teachers/dashboard/availability`).
- استلام الحصص التجريبية والعادية، فتح القاعة الافتراضية (`POST /api/live/sessions`)، وتقييم الطالب بعد الحصة التجريبية (`PUT /api/trials/:id/assess` و `POST /api/sessions/:id/report`).

### 4. فحص رحلة الإدارة وجاهزية الإطلاق (Admin & Launch Readiness)
- فحص جاهزية المنصة والإطلاق العام (`GET /api/health`, `GET /api/readiness`, `GET /api/launch-readiness`).
- حماية مسارات الإدارة (`protect` + `authorize('admin')`) ضد الزوار وضد حسابات الطلاب والمعلمين.
- تأسيس حساب المدير (`POST /api/setup/ensure-admin`) ولوحة القيادة التنفيذية (`AdminExecutiveHome` و `GET /api/admin/command-center`).
- بوابة مراجعة واعتماد المعلمين المكونة من 12 بنداً إلزامياً (`PUT /api/teachers/admin/:id/review`) وعرض الوثائق الحساسة والفيديوهات عبر توكنات موقعة قصيرة الأجل مع تسجيل `AdminAuditLog`.
- إدارة طلبات الحصص التجريبية (`GET /api/trials`) وتعيين المعلم وجدولة الموعد (`PUT /api/trials/:id/assign`).
- مراجعة إيصالات الدفع اليدوي (`PATCH /api/payments/admin/manual/:id/review`) والتسوية الذرية (`Transaction`) والتسكين في الحلقات (`AdminSubscriptions`).

---

## ثانياً: من الفحص تبيّن إيه؟ (نتائج الفحص: ما يعمل بنجاح + المشاكل المكتشفة)

### أ) ما تبيّن أنه يعمل بكفاءة عالية (نقاط القوة المؤكدة بالاختبار)
1. **الحماية الأمنية والصلاحيات (Security & RBAC):**
   - جميع مسارات الإدارة (`/api/admin/*`, `/api/teachers/admin/*`, `/api/payments/admin/*`, `/api/trials`) ترفض الوصول بدون توكن (`401`) أو بتوكن طالب/معلم (`403`).
   - قفل الحساب المؤقت بعد 5 محاولات دخول خاطئة (`423 ACCOUNT_LOCKED`)، والـ Rate Limiting لكل مستخدم، وتطهير مدخلات XSS، وميدلوير `X-Request-Id`، وإخفاء البيانات الحساسة `maskPII` تعمل جميعها بنجاح.
   - مسارات إدارة الجلسات والخصوصية الجديدة (`GET /api/auth/sessions`, `POST /api/auth/logout-all`, `GET /api/auth/privacy/export`, `POST /api/auth/privacy/delete-request`) تعمل بنجاح وتُرجع `200 OK` / `202 Accepted`.
2. **بوابة اعتماد المعلمين وحماية وثائقهم الخاصة:**
   - المعلم غير المعتمد يُمنع من تسجيل الدخول التشغيلي (`403 TEACHER_APPROVAL_PENDING`) ولا يستطيع الوصول لأي مسار في لوحة المعلم قبل اعتماد الإدارة.
   - الإدارة لا تستطيع اعتماد معلم قبل استيفاء 12 بند مراجعة (`409 TEACHER_REVIEW_GATE_INCOMPLETE`)، وجميع وثائق الهوية والشهادات محمية خلف Storage خاص مع تسجيل كل عملية عرض في `AdminAuditLog`.
3. **نظام التسوية المالية اليدوية (`manualPaymentSettlement.js`):**
   - يعمل داخل Transaction ذرية، يرفض القبول إذا كان الإثبات ناقصاً (`409 MANUAL_PAYMENT_PROOF_INCOMPLETE`)، يرفض الرفض بدون سبب (`400 MANUAL_REVIEW_REASON_REQUIRED`)، ويسجل `payment.manual.approved` / `payment.manual.rejected` في سجل التدقيق.
4. **نظام الـ RSVP لولي الأمر:**
   - تأكيد حضور الطالب أو الاعتذار المسبق (`POST /api/sessions/:id/rsvp`) يعمل بدقة ويطبق قاعدة الـ 6 ساعات لاستحقاق الحصة التعويضية (`eligibleForCompensation: true`).

---

### ب) المشاكل والفجوات التي كشفها الفحص (حسب كل دور)

#### 1. مشاكل حرجة في رحلة المعلم (Teacher Findings)
- **[خلل حرج يعطل توفر المعلم في الإنتاج] خطأ Regex في دالة `timeToMinutes` (`backend/routes/teacherDashboard.js:781`):**
  - السطر مكتوب: `if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(value || ''))) return null;`
  - وجود شرطتين مائلتين `\\d` داخل Regex literal يجعله يبحث عن الحرفين `\d` حرفياً وليس الأرقام من 0 إلى 9!
  - **النتيجة:** عندما يحاول أي معلم حفظ جدول أوقاته المتاحة (مثل `"09:00"` إلى `"12:00"`) في وضع قاعدة البيانات، يرفض السيرفر الطلب دائماً بكود `400 Bad Request` (`INVALID_AVAILABILITY_SLOT`).
- **انفصال تقييم الحصة التجريبية عن لوحة المعلم (`src/pages/TeacherDashboard/index.jsx`):**
  - الباك إند يملك مساراً مخصصاً لتقييم الحصة التجريبية (`PUT /api/trials/:id/assess`) يحدد مستوى الطالب والمسار المقترح ويلحقه بالحلقة، لكن واجهة المعلم عند إنهاء الحصة تستدعي فقط `/api/sessions/:id/complete` و `/api/sessions/:id/report` ولا تستدعي `/api/trials/:id/assess`.
  - كذلك إذا كانت الحصة التجريبية محجوزة لزائر لم ينشئ حساب `User` بعد، يظهر اسم الطالب عند المعلم كـ **"طالب"** مجهول لأن `session.student` فارغ والاسم موجود فقط في `TrialRequest.studentName`.
- **عدم ربط `validateMagicBytes` فعلياً بمسارات الرفع:**
  - دالة `validateMagicBytes` في `backend/utils/magicBytes.js` مكتوبة وتعمل، لكنها غير مستدعاة داخل `backend/routes/teachers.js` أو `backend/routes/uploads.js` لفحص الملفات المرفوعة فعلياً.
- **نقص بعض حقول الخبرة في معالج تسجيل المعلم (`src/pages/TeacherRegistration/useTeacherForm.js:382-396`):**
  - الفورم يرسل قيماً ثابتة لـ (`faculty: '—'`, `teachingExperience: 0`, `numberOfIjazat: 0`, `specializations: ['tajweed']`) لعدم وجود حقول إدخال لها في خطوات الفورم، فيضطر المعلم لطلب تعديل ملفه بعد قبوله.
- **عدم وجود مسار `GET /api/teachers/me`:**
  - المسار الفعلي هو `/api/teachers/dashboard/profile`، بينما استدعاء `/api/teachers/me` يصطدم بمسار `/:id` ويرجع `500 CastError`.

#### 2. مشاكل وفجوات في رحلة الإدارة (Admin Findings)
- **[فجوة حرجة] غياب شاشة إدارة طلبات الحصص التجريبية (`/api/trials`) في لوحة الإدارة (`src/pages/AdminDashboard/`):**
  - الباك إند يوفر مسارات كاملة (`GET /api/trials`, `PUT /api/trials/:id/assign`, `PUT /api/trials/:id/assess`)، لكن **لا يوجد أي تبويب أو جدول في لوحة الإدارة (`AdminDashboard`) يعرض هذه الطلبات للمدير** ليقوم بتعيين معلم وجدولة موعد الحصة التجريبية!
- **عدم تطابق أسماء الحقول بين فورم الحصة التجريبية `FreeTrial.jsx` والباك إند `backend/routes/trials.js`:**
  - الواجهة (`src/pages/FreeTrial/FreeTrial.jsx:120-139`) ترسل `preferredPeriod` و`customDate` و`preferredDay` و`currentLevel`، بينما الباك إند (`backend/routes/trials.js:70`) ينتظر `preferredTimeSlot` و`preferredDate`، فتضيع تفضيلات الموعد والتاريخ التي اختارها الطالب/ولي الأمر!
- **ثغرة في عداد المدفوعات المعلقة بمركز القيادة (`backend/routes/admin.js:74-78`):**
  - استعلام `pendingManualPayments` في `GET /api/admin/command-center` يفلتر بـ `kind: 'course_enrollment'` فقط، ويتجاهل مدفوعات باقات الاشتراكات (`kind: 'subscription'`)، فلا يظهر تنبيه للإدارة عند رفع إيصال اشتراك باقة!
- **غياب الإشعارات وسجل التدقيق في مسار الحصص التجريبية (`backend/routes/trials.js`):**
  - عند تقديم طلب حصة تجريبية لا يتم استدعاء `notifyAdmins(...)`، وعند تعيين معلم للحصة (`PUT /api/trials/:id/assign`) لا يتم إرسال إشعار بريد/واتساب للطالب/ولي الأمر ولا يُسجل الإجراء في `AdminAuditLog`.
- **تضارب أسماء متغيرات البيئة في `/api/health` (`backend/app.js:257-262`):**
  - يفحص `MANUAL_PAYMENT_VODAFONE_CASH` بدلاً من `MANUAL_PAYMENT_MOBILE_WALLET` المعتمد في `launchReadiness.js`، ويفحص Twilio فقط للواتساب متجاهلاً `WHATSAPP_CLOUD_TOKEN`.

#### 3. مشاكل وفجوات في رحلة الطالب (Student Findings)
- **[ثغرة حماية القُصّر] تجاوز موافقة ولي الأمر عند التسجيل بالبريد الإلكتروني (`backend/routes/auth.js:131-149` & `src/pages/Register/index.jsx:158-161`):**
  - عند تسجيل طالب عمره أقل من 18 سنة عبر `POST /api/auth/register` بدون بيانات ولي أمر، يقبل الباك إند التسجيل (`201`) ويترك `onboarding.required: false` (لأنها تُفعّل فقط في تسجيل Google)، وتوجهه صفحة التسجيل مباشرة إلى `/student/dashboard` دون المرور بصفحة `/profile/setup`!
  - كذلك في `src/pages/ProfileSetup/index.jsx:51` حقل العمر (`age`) غير إلزامي (`required` غير مضافة)، وفي `PATCH /api/auth/onboarding` لا يتم استدعاء `createGuardianInvitation` تلقائياً عند إدخال هاتف ولي الأمر.
- **انفصال مساري حجز الحصة التجريبية (`/free-trial` مقابل `/book-trial/:teacherId`):**
  - إذا حجز الطالب المسجل حصة تجريبية من `/free-trial` (`POST /api/trials`)، يُحفظ الطلب في `TrialRequest` بدون ربطه بـ `studentId`، وعندما يضغط زر "الذهاب للوحة الطالب" لا يجد الحصة التجريبية لأن لوحة الطالب تقرأ من جدول `Session` فقط!
- **[ثغرة خصوصية في القاعة الصوتية/المرئية] ظهور البريد الإلكتروني للطالب بدلاً من اسمه في LiveKit (`backend/routes/live.js:191`):**
  - عند توليد توكن غرفة LiveKit، يتجاهل السيرفر اسم الطالب ويضع `String(req.user.email || role)` كاسم عرض (`name`)، مما يكشف البريد الإلكتروني للطالب أمام المعلم وباقي الطلاب في الحلقة.
- **تعطل رفع إيصال الدفع اليدوي عند استخدام محرك تخزين غير Vercel Blob (`src/lib/fileUpload.js` & `backend/services/objectStorage.js`):**
  - دالة `uploadFileDirect` مربوطة حصرياً بـ `/api/uploads/blob`، ودالة `isOwnedObjectReference` ترجع `false` مع `filesystem`، مما يمنع رفع إيصالات الدفع اليدوي في التطوير المحلي أو مع S3.
- **غياب سجل المدفوعات وأزرار الخصوصية في لوحة الطالب (`src/pages/StudentDashboard/index.jsx`):**
  - لا يوجد قسم في لوحة الطالب يعرض حالة مراجعة إيصالات الدفع اليدوية أو سبب الرفض (`manual.reviewNote`)، ولا توجد أزرار في تبويب "حسابي" لاستدعاء مسارات الجلسات النشطة وتصدير البيانات وحذف الحساب.

#### 4. مشاكل وفجوات في رحلة ولي الأمر (Guardian Findings)
- **[فجوة جوهرية في المنتج] منع ولي الأمر من إدارة اشتراكات ومدفوعات أبنائه (`403 Forbidden`):**
  - جميع مسارات الاشتراكات (`/api/subscriptions/*`) ومسارات الدفع اليدوي (`/api/payments/*`) وصفحة `/payment/manual` مقيدة بدور `student` فقط! ولي الأمر لا يستطيع اختيار باقة لابنه أو تجديدها أو رفع إيصال الدفع من حسابه.
- **منع ولي الأمر من دخول الحصة كمراقب صامت في `/api/meetings/session/:id` (`backend/routes/meetings.js:43-54`):**
  - بينما يسمح LiveKit لولي الأمر بالدخول كمراقب صامت (`canPublish: false`)، يرفض مسار `GET /api/meetings/session/:id` دور `guardian` بكود `403 Access denied`!
  - كما أن زر *"دخول الغرفة كمراقب صامت"* في `src/pages/GuardianDashboard/index.jsx:763` مخفي ولا يظهر إلا بعد ضغط ولي الأمر على تأكيد الحضور أو الاعتذار (RSVP).
- **عدم قدرة ولي الأمر على حجز حصة تجريبية لابنه من داخل لوحة ولي الأمر:**
  - مسار `POST /api/sessions/trial` يرفض دور `guardian` بـ `403`، ولا يوجد زر في لوحة ولي الأمر لحجز حصة تجريبية للابن المرتبط.
- **عدم إنشاء وثيقة `Guardian` عند التسجيل بالإيميل (`backend/routes/auth.js:131`):**
  - التسجيل عبر Google ينشئ وثيقة `Guardian` تلقائياً، أما التسجيل بالإيميل فلا ينشئها، مما يجعل مسارات `/api/guardians/*` تُرجع `404 Guardian profile not found`.
- **مسار `/guardian-dashboard` يعطي 404 في الفرونت إند (`src/App.jsx`):**
  - المسار المعرّف هو `/guardian/dashboard` فقط، ولا توجد تحويلة (Redirect) من `/guardian-dashboard` (على عكس `/student-dashboard` و `/teacher-dashboard`).

---

## ثالثاً: محتاجين نعمل إيه؟ (خطة العمل والتطوير القادمة بالتفصيل)

بناءً على نتائج الفحص، خطة العمل المقترحة مقسمة إلى **3 موجات تنفيذية واضحة**:

### الموجة الأولى (Wave P0 — إصلاحات الربط الحرجة بين الأدوار الأربعة)
> **الهدف:** جعل الرحلة من (التسجيل ← إعداد الحساب ← حجز الحصة التجريبية ← تعيين المعلم ← دخول الحصة ← التقييم ← الاشتراك والدفع) متصلة بنسبة 100% بدون أي انقطاع بين الطالب وولي الأمر والمعلم والإدارة.

1. **إصلاح جدول توفر المعلم وفحص الملفات (`Teacher`):**
   - تصحيح الـ Regex في `backend/routes/teacherDashboard.js:781` من `/^([01]\\d|2[0-3]):[0-5]\\d$/` إلى `/^([01]\d|2[0-3]):[0-5]\d$/`.
   - إضافة مسار `GET /api/teachers/me` كـ alias لمسار `/api/teachers/dashboard/profile`، والتحقق من `ObjectId.isValid` في `GET /api/teachers/:id`.
   - استدعاء `validateMagicBytes` فعلياً عند رفع الملفات في `backend/routes/teachers.js`.
   - إصلاح متغير `normalizedEmail` وتحديث `mockStore` عند مراجعة المعلم في `backend/routes/teachers.js`.

2. **ربط دورة الحصة التجريبية الكاملة بين (`Student/Guardian` ↔ `Admin` ↔ `Teacher`):**
   - توحيد حقول `src/pages/FreeTrial/FreeTrial.jsx` مع `backend/routes/trials.js` (`preferredTimeSlot`, `preferredDate`, `currentLevel`) وربط الطلب بـ `studentId` إذا كان المستخدم مسجلاً للدخول.
   - إظهار طلبات الحصة التجريبية (`TrialRequest`) الخاصة بالطالب داخل لوحة الطالب (`/student/dashboard`) حتى يرى حالة طلبه فور حجزه.
   - إضافة قسم/تبويب **"طلبات الحصص التجريبية"** في لوحة الإدارة (`src/pages/AdminDashboard/`) لعرض الطلبات وتعيين المعلم والموعد (`PUT /api/trials/:id/assign`) مع إشعار الإدارة (`notifyAdmins`) وتسجيل `logAdminAction`.
   - تمرير اسم الطالب وربط نافذة تقييم المعلم بعد الحصة التجريبية في `src/pages/TeacherDashboard/index.jsx` بمسار `PUT /api/trials/:id/assess`.

3. **إغلاق ثغرة تسجيل الطالب القاصر (`< 18`) وتوحيد مسار التهيئة (`Student`):**
   - في `POST /api/auth/register` (`backend/routes/auth.js`): تفعيل `onboarding.required = true` للطلاب الجدد، وإلزام بيانات ولي الأمر إذا كان `age < 18` منذ لحظة التسجيل، واستدعاء `createGuardianInvitation` تلقائياً في `/register` و`/onboarding`.
   - جعل حقل العمر (`age`) إلزامياً في `src/pages/ProfileSetup/index.jsx` وتوجيه الطالب بعد التسجيل في `src/pages/Register/index.jsx` إلى `/profile/setup`.
   - إصلاح `backend/routes/live.js:191` لاستخدام اسم المستخدم (`req.user.name`) بدلاً من البريد الإلكتروني (`req.user.email`) داخل غرفة LiveKit.

4. **تمكين ولي الأمر من حضور الحصة وإدارة اشتراكات ومدفوعات الأبناء (`Guardian`):**
   - السماح لدور `guardian` المرتبط بالطالب في `backend/routes/meetings.js`، وتمرير `sess.meetingLink` في `backend/routes/guardian.js:888`، وإظهار زر *"دخول الغرفة كمراقب صامت"* في `src/pages/GuardianDashboard/index.jsx` دون اشتراط ضغط RSVP أولاً.
   - إنشاء وثيقة `Guardian` تلقائياً عند تسجيل ولي الأمر في `POST /api/auth/register` وفحص عدم تكرار رقم الهاتف عند تحديث الملف الشخصي.
   - إضافة تحويلة `<Route path="guardian-dashboard" ... />` في `src/App.jsx`.
   - السماح لولي الأمر المرتبط بالطالب باستعراض باقات أبنائه وحجز الحصة التجريبية ورفع إيصال الدفع اليدوي نيابةً عنهم.

5. **تحديث مركز قيادة الإدارة وفحص الصحة (`Admin`):**
   - شمول مدفوعات باقات الاشتراكات (`kind: 'subscription'`) وطلبات الحصص التجريبية المعلقة في `GET /api/admin/command-center` (`backend/routes/admin.js`).
   - توحيد فحص متغيرات البيئة في `/api/health` (`backend/app.js`) ليطابق `launchReadiness.js` (`MANUAL_PAYMENT_MOBILE_WALLET` و `WHATSAPP_CLOUD_TOKEN`).

---

### الموجة الثانية (Wave P1 — تحسينات تجربة المستخدم واللوحات)
1. **لوحة الطالب (`StudentDashboard`):**
   - إضافة جدول **"سجل المدفوعات وحالة التفعيل"** لعرض حالة إيصالات الدفع اليدوية وملاحظات الإدارة عند الرفض مع زر إعادة الرفع.
   - إضافة قسم **"الأمان والخصوصية"** في تبويب الحساب (عرض الجلسات النشطة، الخروج من كافة الأجهزة، تحميل نسخة البيانات JSON، وطلب حذف الحساب).
2. **معالج تسجيل المعلم (`TeacherRegistration`):**
   - إضافة حقول (الكلية، سنوات الخبرة، عدد الإجازات، التخصصات، واللغات) في خطوات الفورم بدلاً من القيم الافتراضية الثابتة.
   - دعم رفع الملفات عبر `FormData` محلياً عندما لا يكون `vercel-blob` مفعلاً.
3. **لوحة ولي الأمر (`GuardianDashboard`):**
   - توحيد مصدر حساب `آخر تقييم حفظ` بين بطاقة الابن وجدول المقارنة العائلي.
   - إضافة تبويب **"الاشتراكات والمدفوعات"** لأبناء ولي الأمر.

---

### الموجة الثالثة (Wave P2 / T07.2 & T07.3 — الإغلاق التشغيلي للخدمات الخارجية للإطلاق العام)
لتحقيق شرط الإطلاق العام (`GET /api/readiness` → `200 ready: true` و `GET /api/launch-readiness` → `200 ready: true`):
1. ربط قاعدة بيانات MongoDB الإنتاجية (`MONGODB_URI`) وضبط الدومين الرسمي (`FRONTEND_URL`, `SITE_URL`, `API_PUBLIC_URL`) ومحرك التخزين (`FILE_STORAGE_DRIVER=vercel-blob` أو `s3`).
2. تفعيل واختبار الخدمات الأربع الإلزامية في بيئة الإنتاج:
   - **البريد الإلكتروني (`Resend`)** ← ثم ضبط `EMAIL_DOMAIN_VERIFIED=true` و `EMAIL_E2E_VERIFIED=true`.
   - **الدفع اليدوي (`Manual Payment`)** ← ضبط حسابات الاستلام (InstaPay / المحفظة / البنك) وتنفيذ دورة دفع كاملة ← ثم ضبط `MANUAL_PAYMENT_E2E_VERIFIED=true`.
   - **القاعات الافتراضية (`LiveKit`)** ← ضبط مفاتيح LiveKit وتجربة غرفة صوت/فيديو حقيقية ← ثم ضبط `LIVEKIT_E2E_VERIFIED=true`.
   - **إشعارات واتساب (`WhatsApp Cloud API / Twilio`)** ← ضبط التوكن وتجربة إشعار فعلي ← ثم ضبط `WHATSAPP_E2E_VERIFIED=true`.
