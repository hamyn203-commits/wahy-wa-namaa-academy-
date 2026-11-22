# تطبيق وحي ونماء — الطالب وولي الأمر (`mobile/student-app`)

تطبيق **React Native (Expo + TypeScript)** مخصص للطلاب وأولياء الأمور في أكاديمية **وحي ونماء**، ومهيأ لإخراج ملف **Android APK** مباشرة للتثبيت، والانتقال لاحقاً إلى **Google Play (AAB)** و**App Store (iOS)** من نفس الكود.

## التشغيل المحلي للتجربة
```bash
cd mobile/student-app
npm install
npx expo start
```

## إخراج ملف `.apk` مباشر للأندرويد
1. سجّل الدخول في Expo EAS (حساب مجاني):
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. أنشئ ملف الـ APK:
   ```bash
   cd mobile/student-app
   npm run build:apk
   ```
3. عند اكتمال البناء، يعطيك EAS رابط تحميل مباشر لملف `.apk` جاهز للتثبيت على أي هاتف أندرويد.

## التحديثات التلقائية بدون APK جديد (OTA — Expo Updates)
لأي تعديل في الشاشات أو النصوص أو المنطق داخل TypeScript/React Native:
```bash
cd mobile/student-app
npm run publish:ota -- "وصف التحديث"
```
سينزل التحديث تلقائياً في الخلفية عند كل الطلاب دون الحاجة لتحميل APK جديد.

## إشعار التحديث عند إصدار APK جديد (Native)
عند رفع APK جديد بإصدار أعلى (مثلاً `1.1.0`)، اضبط متغيرات البيئة في الباك إند (Vercel):
```env
MOBILE_LEARNER_LATEST_VERSION=1.1.0
MOBILE_LEARNER_MIN_VERSION=1.0.0
MOBILE_LEARNER_ANDROID_APK_URL=https://wahywanamaa.com/ar/mobile
```
- إذا كان `MIN_VERSION` أكبر من إصدار الطالب، تظهر له شاشة **تحديث إجباري** برابط تحميل الـ APK الجديد.
- وإذا كان `LATEST_VERSION` فقط أعلى، يظهر له شريط **تحديث اختياري**.

## فحص الأنواع (`TypeScript`)
```bash
cd mobile/student-app
npm run typecheck
```

## البنية (جاهزة لتطبيق المعلمين مستقبلاً)
- `mobile/student-app/` — تطبيق الطالب وولي الأمر (`com.wahywanamaa.student`)
- `mobile/teacher-app/` — (المرحلة القادمة) تطبيق المعلمين (`com.wahywanamaa.teacher`)
