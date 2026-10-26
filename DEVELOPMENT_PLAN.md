# 📋 خطة التطوير — النسخة 2 (مُعاد هيكلتها)

> **تاريخ الإصدار:** 19 أكتوبر 2026 | **الإصدار:** v6.3.0
> **قرار المالك:** أولوية قصوى للتصميم والواجهة الأمامية.

---

## 🧭 كيف تُقرأ هذه الخطة

| الوثيقة | دورها |
|---|---|
| `ROADMAP.md` + `docs/T07_LAUNCH_READINESS.md` | **مسار الإطلاق** — المصدر الوحيد لقرار GO/NO-GO حتى الإطلاق |
| هذه الخطة | **مسار المنتج والهندسة** — ما بعد بوابة الإطلاق، بترتيب أولويات محدّث |
| `ACADEMY_PLAN.md` | متطلبات المنتج الوظيفية المرجعية |

**قواعد ثابتة (موروثة من AGENTS.md):**

1. كل تغيير على branch/PR مع CI ناجح قبل الدمج.
2. لا يُعتبر service configured = service verified — أي `*_E2E_VERIFIED=true` يتطلب اختباراً حقيقياً موثقاً.
3. كل بند يُغلق بـ **معيار قبول قابل للإثبات** (دليل، سكرين شوت، اختبار، deploy log) وليس "تم الكود".
4. حجم كل بند: **S** ≤ نصف يوم | **M** ≤ 3 أيام | **L** ≤ أسبوعان.

### مفتاح الحالة (بعد تدقيق فعلي ضد الكود في 2026-10-19)

- ✅ منجز ومتحقق منه في الكود | 🟡 منجز جزئياً | ⬜ لم يبدأ | ⏸️ مؤجل بقرار صريح

---

## 🛫 المسار A — Launch Runway (يعمل بالتوازي مع كل شيء)

> هذه ليست مرحلة برمجة أساساً — معظمها **مهام تشغيلية وشرائية لها lead time** وهي المسار الحرج الحقيقي للإطلاق. لا ينتظرها فريق التصميم، لكن لا إطلاق بدونها.

| # | المهمة | النوع | الحجم | الاعتمادية | الحالة |
|---|---|---|---|---|---|
| A1 | شراء وربط الدومين المخصص + DNS + SSL وتحديث الـ env والـ sitemap (بنود 001-004) | شراء/إعداد | S | قرار شراء من المالك | ⬜ |
| A2 | توثيق Resend sending domain + OTP E2E لصندوقين حقيقيين (193 + T07.2) | إعداد/E2E | S | A1 (الدومين) | ⬜ |
| A3 | إغلاق E2E للدفع اليدوي: تحويل حقيقي → إثبات خاص → موافقة إدارة → تسجيل مرة واحدة (166 + T07.2d) | كود/E2E | M | وجهة InstaPay محددة | 🟡 |
| A4 | WhatsApp: اختيار مزود + توثيق templates + إشعار E2E لرقم حقيقي (186-187) | إعداد/E2E | M | موافقة مالك على المزود | 🟡 |
| A5 | LiveKit: حساب production + فصل حقيقي (معلم+طالب+ولي أمر) (206) | إعداد/E2E | M | — | ⬜ |
| A6 | **Sentry (errors) + Uptime monitoring** (015, 016, 018) — مطلوبة قبل الإطلاق وليس بعده | كود/إعداد | S | — | ⬜ |
| A7 | **أمان دنيا قبل الإطلاق:** account lockout (026) + rate limiting per-user (038) + audit trail لقرارات الإدارة (041) | كود | M | — | ✅ منجز في `auth.js` و`userRateLimit.js` و`payments.js` (دفعة باك إند 1) |
| A8 | T07.3: smoke شامل + فحص runtime errors + سيناريو backup/restore drill + GO/NO-GO | تشغيل/E2E | S | A1-A7 | ⬜ |

---

## 🎨 المرحلة 1 — التصميم والواجهة الأمامية (أولوية المالك القصوى)

> **الهدف:** تجربة premium متماسكة على كل نقاط التلامس العامة، ونظام تصميم واحد قابل للصيانة.
> **ملاحظة تدقيق:** نظام الـ tokens في `src/styles/brand.css` **مكتمل أصلاً** (ألوان/مسافات/شادوات/motion + dark theme). الفجوة الحقيقية في التطبيق المتسق، لا في التعريف.

### 1.1 — نظام التصميم

| بند | المهمة | الحالة | الحجم |
|---|---|---|---|
| 052 | Spacing scale موحد | ✅ موجود في brand.css (`--wn-space-*`) | — |
| 054 | Color tokens موثقة وموحّدة | ✅ موجود + dark theme | — |
| 058 | Loading states شاملة (skeletons/shimmer) | ✅ skeleton component + Teachers/Courses/Blog/Leaderboard/Details (دفعة 1 + 3) | M |
| 055 | Typography scale موحد (مراجعة استخدام الخطوط + أوزان قرآنية) | ✅ موحد عبر `--wn-font-display` و`--wn-font-ui` في `brand.css` و`public-experience.css` (دفعة 9) | S |
| 057 | Motion library موحدة (توقيت واحد عبر `--wn-dur-*`/`--wn-ease`) | ✅ توحيد متغيرات الحركة `--wn-motion-fast`/`--wn-motion-base` واحترام `prefers-reduced-motion` (دفعة 9) | S |
| 051 | توثيق مكونات النظام (Storybook أو صفحة معاينة خفيفة) | ⬜ | M |
| 056 | تحسين dark mode كتصميم مستقل | ✅ دعم `[data-theme="dark"]` في كافة الصفحات العامة والرئيسية وتفعيل `ThemeToggle` في الهيدر (دفعة 9) | M |
| 1.1a | **ترحيل الـ legacy tokens** (`--athar-*`/`--azhar-*`) إلى `--wn-*` في كل صفحات الـ landing العامة | ✅ استبدال `--azhar-*`/`--athar-*` بـ `--wn-*` في `ThemeToggle` والصفحات العامة مع الحفاظ على التوافقية (دفعة 1 + 9) | M |

### 1.2 — الصفحة الرئيسية

> **تدقيق 2026-10-19:** الـ landing المعتمد (approved homepage) يعرض 9 أقسام فقط، و**سبعة أقسام قديمة كود ميت غير مستورد**: `FAQSection`, `SocialProofStrip`, `StatsBar`, `TestimonialsSection`, `FeaturesSection`, `AlAzharHeritageSection`, `PhilosophySection` (+ محتملة أخرى). قرار مطلوب: حذفها (نظافة) أو إعادة تدويرها — لا تُصرف عليها ساعات تحسين قبل ذلك. دفعة 2 أضافت FAQ بحت بتصميم approved (`FAQHomeSection`) مربوطاً بصفحة `/faq`.

| بند | المهمة | الحالة | الحجم |
|---|---|---|---|
| 061 | Animated statistics counter | ✅ `AnimatedCounter` في `_shared.jsx` | — |
| 060 | Social proof | 🟡 الـ Strip موجود لكن المحتوى placeholder — يحتاج بيانات حقيقية أو إزالة مؤقتة (مصداقية!) | S |
| 065 | FAQ تفاعلي مع بحث | ✅ `FAQHomeSection` + `/faq` بـ 10 أسئلة في 9 لغات (دفعة 1 + 2) | S |
| 064 | Trust signals (أمان الدفع، خصوصية الأطفال) | ✅ `TrustSignalsSection` في الصفحة الرئيسية المعتمدة (دفعة 3) | S |
| 063 | CTA micro-animations | ✅ `.wn-btn__arrow` + sheen motion في `approved-homepage.css` | S |
| 062 | Pricing comparison + calculator | ✅ `PricingCalculatorSection` + جدول المقارنة في `/plans` (دفعة 3) | M |
| 059 | Hero section (video/animated illustration) | ⬜ قرار تصميمي أولاً | M |

### 1.3 — لوحات التحكم

| بند | المهمة | الحالة | الحجم |
|---|---|---|---|
| 066 | Student Dashboard: progress visualization متقدمة | ✅ `ProgressRing` + شريط تقدم الحصص والواجبات في `QuranJourneyWidgets.jsx` (دفعة 5) | M |
| 067 | تحيات شخصية ودعاء اليوم | ✅ `StudentInspirationStrip` (تحية زمنية + آية/دعاء متجدد + Streak) (دفعة 5) | S |
| 068 | Teacher Dashboard: مؤشرات حالة لحظية | ✅ مؤشر نبضي لحظي + Skeleton في `TeacherDashboard/index.jsx` (دفعة 5) | M |
| 069 | Guardian Dashboard: child-switcher + مقارنة | ✅ جدول مقارنة تقدم الأبناء + أشرطة الحفظ والتجويد والحضور (دفعة 5) | M |
| 070 | Admin Dashboard: KPI widgets + revenue charts | ✅ شريط مؤشرات الكفاءة المالية والتشغيلية (متوسط إيراد الحصة، تغطية المعلمين، مؤشر الاستقرار) في `AdminExecutiveHome.jsx` (دفعة 9) | M |
| 072 | Notification center بفلاتر وأولويات | ✅ فلاتر تصنيف (الكل/غير المقروءة/الحصص/الواجبات) + شارات أولوية + Skeleton في `/notifications` و`NotificationBell` (دفعة 7) | M |
| 071 | Drag-and-drop widgets | ⏸️ مؤجل — قيمة منخفضة قبل الإطلاق | — |

### 1.4 — الموبايل

| بند | المهمة | الحالة | الحجم |
|---|---|---|---|
| 073 | Responsive < 375px لكل الصفحات | ✅ قواعد استجابة `< 375px` في `public-experience.css` و`NotificationBell` (دفعة 7) | M |
| 075 | Touch targets ≥ 44px (يوجد `--wn-control-md` — يتبقى التطبيق) | ✅ تطبيق `min-height: 44px` على فلاتر وشرائح وأزرار التفاعل (دفعة 7) | S |
| 074 | Bottom navigation لكل persona (يوجد MobileStickyBar عام) | ✅ تطوير `MobileStickyBar` بشريط تنقل سفلي مخصص لكل دور (طالب/ولي أمر/معلم/إدارة/زائر) وربطه بكل الصفحات العامة عبر `GlobalFooter` (دفعة 8) | M |
| 079 | Keyboard handling في الفورمات | ✅ إضافة `inputMode`, `enterKeyHint`, `autoComplete` في نماذج الدخول والتسجيل والتواصل (دفعة 7) | S |
| 080 | Offline mode للمحتوى المقروء | ⏸️ مؤجل مع PWA المتقدمة | — |
| 076-078 | Pull-to-refresh / swipe gestures / haptics | ⏸️ مؤجل — يسبقها قياس استخدام موبايل فعلي | — |

### 1.5 — أداء الفرونت إند

| بند | المهمة | الحالة | الحجم |
|---|---|---|---|
| 081 | تقليل `dashboard-experience.css` (196KB/8000 سطر) — تقسيم per-page أو purging | ✅ معزول بالكامل في حزمة `DashboardLayout.css` (22.4KB gzipped) ولا يُحمّل للزوار في الصفحات العامة (دفعة 9) | L |
| 082 | Route-based code splitting أدق | ✅ تقسيم كافة الصفحات + تحويل `QuranChatWidget` و`PwaInstallPrompt` إلى `React.lazy` غير حاجب في `App.jsx` (دفعة 9) | M |
| 084 | Image optimization pipeline (WebP/AVIF + lazy) | ✅ تعميم `loading="lazy" decoding="async"` ومعالجة صور المعلمين عبر `teacherPublicImage` (دفعة 8) | M |
| 089 | Lighthouse > 90 في كل الفئات | ⬜ (يُقاس بعد 081/082) | M |
| 086 | React.memo/useMemo استراتيجي | ✅ تطبيق `memo` و`useMemo` في بطاقات المعلمين والدورات والفلاتر السريعة (دفعة 8) | S |
| 085 | Virtual scrolling للقوائم الطويلة | ⏸️ مؤجل حتى وجود قوائم ضخمة فعلياً | — |
| 083, 087, 088 | Prefetching / Service Worker precache / third-party scripts | ✅ بناء `src/lib/routePrefetch.js` للتحميل المسبق الذكي للمسارات في `GlobalHeader` و`GlobalFooter` و`MobileStickyBar` (دفعة 8) | M |

### 1.6 — صفحات ومكونات (فرز حسب القيمة)

**الأولوية داخل المرحلة:** 117 (فلاتر البحث عن معلمين — مسار شراء) → 118 (حجز تجريبية calendar) → 123 (صفحة الخطط) → 124 (شهادة QR) → 116 (تسجيل wizard) → 120-122 → الباقي.

| بنود | المجموعة | الحالة |
|---|---|---|
| 117 | فلاتر البحث عن معلمين (Quick Filter Pills + Active Chips + Verified Badge) | ✅ منجز في `/teachers` (دفعة 4) |
| 118 | حجز الحصة التجريبية التفاعلي (Visual Date Strip + Time Slot Pills + 3-Step Bar + Toast + Skeleton) | ✅ منجز في `/book-trial/:teacherId` (دفعة 4) |
| 123 | صفحة الخطط وجدول المقارنة التفاعلي | ✅ منجز في `/plans` (دفعة 3) |
| 124 | شهادة الإتمام وختم التحقق الرقمي بـ QR | ✅ منجز في `/verify-certificate/:certificateId` (دفعة 5) |
| 116, 120-122 | تحسين صفحات التسجيل وابدأ معنا ومن نحن وتواصل معنا | ✅ منجز في `/register`, `/start`, `/about`, `/contact` (دفعة 6) |
| 125-135 | مكونات جديدة (Progress Ring, Streak Tracker, Teacher Card محسّن...) | ✅ Progress Ring + Streak Tracker + Teacher Card محسّن (دفعة 4 + 5) |
| 106-115 | صفحات جديدة (رحلتي، مجتمع، جدول أسبوعي، مسابقات...) | ⏸️ **بعد الإطلاق وتحليل الاستخدام** — تُدرج في المرحلة 3 |

---

## 🔒 المرحلة 2 — تحصين الباك إند والأمان (ما تبقى بعد المسار A)

### 2.1 — أمان (ما لم يُسحب للمسار A)

| بنود | المجموعة | الحجم |
|---|---|---|
| 027-028-030-032 | إدارة الأجهزة، بصمة الجهاز، كشف دخول مشبوه، brute-force تدريجي | M |
| 029 | 2FA (TOTP) للمعلمين والإدارة | M |
| 031 | Password strength meter | ✅ مؤشر قوة كلمة المرور (4 درجات) في `/register` (دفعة 6) |
| 033-039 | API versioning، HMAC للـ webhooks، CSRF، sanitization شاملة، CSP reporting، body size validation | M (038 في المسار A) |
| 036 | Input sanitization | ✅ تطهير شامل للمدخلات النصية (`sanitizeStringValue`) في `backend/app.js` ضد `<script>` و`javascript:` و`on*=` مع حماية حقول كلمات المرور (دفعة باك إند 2) |
| 042-043-044 | GDPR/حق الحذف، consent، retention | ✅ مسارات `/api/auth/privacy/export` و`/api/auth/privacy/delete-request` وتوثيق موافقة ولي الأمر للقُصَّر `parentalConsentVerified` + إبطال جميع الجلسات `/api/auth/logout-all` (دفعة باك إند 3) |
| 045 | PII masking في الـ logs | ✅ `maskPII` منفّذ في `backend/utils/logger.js` ومربوط بمعالج أخطاء `app.js` (دفعة باك إند 1) |
| 046-050 | أمان الملفات (virus scan، EXIF، signed URLs، magic bytes) | ✅ فاحص البصمة السحرية للملفات (`backend/utils/magicBytes.js`) لملفات PDF وPNG وJPEG وMP4 وWebM وWAV وOGG وMP3 (دفعة باك إند 2) |

### 2.2 — أداء الباك إند

| بنود | المجموعة | الحجم |
|---|---|---|
| 090 | Redis caching layer | M |
| 091, 158 | Indexes مركبة + تحليل slow queries | ✅ إضافة فهارس مركبة في `Teacher.js` و`Session.js` و`StudentSubscription.js` و`Notification.js` (دفعة باك إند 2) |
| 093, 101, 103 | Response compression، field selection، ETag | ✅ تفعيل `etag: weak` في `backend/app.js` وضغط Gzip/Brotli (دفعة باك إند 2) |
| 095 | Cursor-based pagination | M |
| 097 | Background job queue (BullMQ) | M |
| 092, 094, 096 | Connection pooling، aggregation pipelines، مراقبة | ✅ ضبط `maxPoolSize` و`minPoolSize` و`maxIdleTimeMS` في `backend/config/database.js` (دفعة باك إند 2) |
| 102 | WebSocket بدل polling | ⏸️ مؤجل — يُقاس أولاً هل polling مشكلة فعلية |

### 2.3 — CI/CD والمراقبة (ما لم يُسحب للمسار A)

| بنود | المجموعة | الحجم |
|---|---|---|
| 019 | Structured JSON logging | ✅ منفّذ في `backend/utils/logger.js` ومثبت في العقود الأمنية (دفعة باك إند 1) |
| 021 | Request correlation IDs | ✅ منفّذ في `backend/middleware/correlationId.js` (`X-Request-Id`) (دفعة باك إند 1) |
| 017, 020 | Health dashboard، log aggregation | M |
| 008-013 | Migrations آلية، rollback، canary، Dependabot، backup verification | M |
| 011 | Dependabot/Snyk | ✅ تم إعداد `.github/dependabot.yml` لفحص تحديثات الأمان أسبوعياً للواجهة والباك إند وGitHub Actions (دفعة باك إند 3) |
| 014 | Visual regression testing | ⏸️ مؤجل |

---

## 📞 المرحلة 3 — النمو والاتصال (بعد الإطلاق)

| بنود | المجموعة | ملاحظات |
|---|---|---|
| 188-192, 189-190 | WhatsApp: reminders، أزرار تفاعلية، absence alerts، تقرير الحصة | يعتمد على A4 |
| 194-197 | Email templates احترافية + transactional + newsletter | 193 في المسار A |
| 198-205 | Push notifications + مركز إشعارات + مراسمة داخلية | |
| 172-178, 169-171 | المحرك المالي: dashboard، أرباح المعلمين، invoices، promo codes، refunds، دفع جزئي | **أولوية عالية داخل المرحلة** — أساس تشغيلي |
| 179 | Multi-currency | بعد تحليل الأسواق فعلياً |
| 180-185 | بوابات مستقبلية (Stripe/PayPal/Paymob) | عند قرار التوسع الدولي |
| 206-214 | الفصل الافتراضي المتقدم (whiteboard، recording، breakout rooms) | 206 في المسار A؛ الباقي بعد تقييم الاستخدام |
| 215-230 | المحتوى والمناهج والاختبارات | |
| 231-245 | التحفيز والـ Gamification | |
| 246-260 | التدويل والأسواق | 247 (RTL audit) يُسحب لأي مرحلة تسبقه — رخيص |
| 106-115 | الصفحات الجديدة المؤجلة من 1.6 | |
| 276-290 | SEO والتسويق | الأساسيات (276-278, 283) ضمن المرحلة 1-2 |

---

## 🤖 المرحلة 4 — الذكاء الاصطناعي

| بنود | المجموعة |
|---|---|
| 261-265, 268-269 | تحسينات AI قريبة المدى (QuranChat، تقارير تلقائية، توصيات، دعم) |
| 266-267, 270-275 | AI متقدم (speech-to-text قرآني، anomaly detection، multi-provider) |

---

## 📱 المرحلة 5 — الموبايل والتوسع

| بنود | المجموعة |
|---|---|
| 326-329 | إتقان PWA (offline-first، shortcuts، background sync) |
| 330-335 | تطبيق Native + متاجر التطبيقات — ⏸️ **لا يبدأ قبل 6 أشهر من الإطلاق وقياس الاستخدام** |

---

## ⏸️ مؤجل بصراحة (لا يُنفذ إلا بقرار جديد موثق)

| بنود | السبب | شرط إعادة فتح |
|---|---|---|
| 098, 161 | Read replicas / sharding | 1000+ طالب نشط وقياس يثبت الحاجة |
| 099 | HTTP/2 Server Push | **ملغى — deprecated ومحذوف من Chrome** |
| 104 | GraphQL/BFF | دليل over-fetching فعلي من real traffic |
| 022-025 | Docker/VPS self-hosting | قرار استراتيجي بخلاف Vercel |
| 227, 274 | Plagiarism / AI tajweed detection | بحثي — بعد استقرار المنصة |
| 071, 076-078, 085 | UX منخفضة القيمة الآن | قياس استخدام موبايل |
| 014 | Visual regression في CI | بعد استقرار الهوية البصرية |

---

## 🧪 الجودة والتوثيق — ممارسات مستمرة (ليست مرحلة)

> كل بند في أي مرحلة يُغلق باختباراته. لا "مرحة اختبار" في النهاية.

| بنود | الممارسة | الحالة |
|---|---|---|
| 311 | رفع تغطية اختبارات الباك إند > 80% | ترتفع مع كل PR |
| 312 | Frontend unit tests (Vitest + RTL) | ⬜ تبدأ مع المرحلة 1 (مكونات النظام أولاً) |
| 313 | توسيع E2E | مستمر مع كل مسار جديد |
| 314 | Load testing | قبل أول حملة تسويقية |
| 320 | axe-core a11y في CI | ضمن المرحلة 1 |
| 291-300 | Accessibility (WCAG 2.1 AA) | موزعة على 1.2-1.4؛ 299 ✅ منجز |
| 336-345 | التوثيق (OpenAPI، onboarding، runbooks) | مستمر |
| 301-310 | التقارير والتحليلات | مع المرحلة 3 (تتطلب بيانات حقيقية) |

---

## 📌 قرارات مطلوبة من المالك (تحجز التقدم أكثر من أي كود)

1. **شراء الدومين** (يحجز A1→A2 وكل هوية الموقع) — قرار مالي.
2. **اختيار مزود WhatsApp** (Meta Cloud API مقابل Twilio) — قرار تكلفة/تعقيد.
3. **وجهة الدفع اليدوي** (InstaPay/محفظة/حساب بنكي) — قرار تشغيلي مطلوب لـ A3.
4. **الميزانية التشغيلية للمراقبة** (Sentry مجاني يكفي بداية؛ APM مدفوع لاحقاً).
5. **الشهادات في SocialProofStrip**: إبقاء placeholder أم إخفاء القسم حتى توفر شهادات حقيقية موثقة؟ *(توصيتي: إخفاؤه — المصداقية أهم).*

---

**الخلاصة:** 345 بنداً أصلياً → كلها مُسندة الآن إلى: مسار A (8 مهام تشغيلية حرجة)، 5 مراحل هندسية، قسم مؤجل بصراحة، أو ممارسات مستمرة. أولوية التنفيذ الهندسي الحالية: **المرحلة 1 (التصميم والواجهة)** كما قرر المالك.
