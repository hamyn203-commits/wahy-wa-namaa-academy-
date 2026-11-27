import { test, expect } from '@playwright/test';
import { E2E_PASSWORD } from './helpers.js';

test('admin portal closed-loop gate: all 15 surfaces, course/lesson/blog edit flows, audit verification, and mobile responsiveness run with zero runtime/5xx errors', async ({ page }) => {
  test.setTimeout(120000);

  const pageErrors = [];
  const serverErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 500) {
      serverErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });

  // 1. Sign in as Admin -> Executive Command Center (Surface 1)
  await page.goto('/ar/login');
  await page.locator('#login-email').fill('e2e.admin@example.test');
  await page.locator('#login-password').fill(E2E_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ar\/admin/);
  await expect(page.locator('#admin-executive-content')).toBeVisible();
  await expect(page.getByRole('region', { name: 'نبض التشغيل الحي اليوم' })).toBeVisible();

  const nav = page.locator('#wn-admin-sidebar');

  // 2. Analytics & Funnel (Surface 2)
  await nav.getByRole('button', { name: 'الزيارات والتتبع', exact: true }).click();
  await expect(page.getByText('تحليلات زيارات الأكاديمية وتتبع رابط المعلمين')).toBeVisible();

  // 3. Teachers Management (Surface 3)
  await nav.getByRole('button', { name: 'المعلمون', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'أقسام إدارة المعلمين' })).toBeVisible();

  // 4. Students & Families 360 Directory (Surface 4)
  await nav.getByRole('button', { name: 'الطلاب والأسر', exact: true }).click();
  await expect(page.getByRole('region', { name: 'دليل الطلاب والأسر' })).toBeVisible();

  // 5. Session Control V2 (Surface 5)
  await nav.getByRole('button', { name: 'مركز الحصص', exact: true }).click();
  await expect(page.getByText('مركز عمليات الحصص والرقابة الحية')).toBeVisible();

  // 6. Teacher Withdrawals & Treasury (Surface 6)
  await nav.getByRole('button', { name: 'السحوبات والمالية', exact: true }).click();
  await expect(page.locator('#admin-section-title')).toHaveText('السحوبات والمالية');

  // 7. Support Inbox & Contact Messages (Surface 7)
  await nav.getByRole('button', { name: 'الدعم والرسائل', exact: true }).click();
  await expect(page.getByRole('region', { name: 'محادثات الطلاب' })).toBeVisible();
  await expect(page.getByText('رسائل نموذج التواصل')).toBeVisible();

  // 8. Courses & Lessons Create + Edit Loop (Surface 8)
  await nav.getByRole('button', { name: 'الدورات والمحتوى', exact: true }).click();
  const stamp = Date.now();
  const courseSlug = `e2e-course-${stamp}`;
  const initialCourseTitle = `دورة اختبار شامل ${stamp}`;
  const updatedCourseTitle = `دورة اختبار محدثة ${stamp}`;

  await page.getByLabel('عنوان الدورة (عربي)').fill(initialCourseTitle);
  await page.getByLabel('المعرّف النصي slug (مثال: quran-kids)').fill(courseSlug);
  const instructorSelect = page.getByLabel('اختر المعلم');
  await expect(instructorSelect.locator('option')).not.toHaveCount(1);
  await instructorSelect.selectOption({ index: 1 });
  await page.getByLabel('السعر لمصر (ج.م)').fill('185');
  await page.getByLabel('وصف الدورة').fill('وصف تجريبي لدورة الفحص الآلي');
  await page.getByRole('button', { name: 'إنشاء الدورة', exact: true }).click();

  await expect(page.getByText(initialCourseTitle)).toBeVisible();

  // Edit the created course
  await page.getByRole('button', { name: `تعديل ${initialCourseTitle}` }).click();
  await page.getByLabel('عنوان الدورة (عربي)').fill(updatedCourseTitle);
  await page.getByRole('button', { name: 'حفظ تعديلات الدورة', exact: true }).click();
  await expect(page.getByText(updatedCourseTitle)).toBeVisible();

  // Select the course -> Add a text lesson -> Edit the lesson
  await page.getByRole('button').filter({ hasText: updatedCourseTitle }).first().click();
  await expect(page.getByText('دروس الدورة')).toBeVisible();
  await page.getByLabel('عنوان الدرس').fill('الدرس الأول التجريبي');
  await page.getByLabel('نوع الدرس').selectOption('text');
  await page.getByLabel('محتوى الدرس النصي').fill('شرح أحكام النون الساكنة والتنوين');
  await page.getByRole('button', { name: '+ إضافة درس', exact: true }).click();
  await expect(page.getByText(/الدرس الأول التجريبي/)).toBeVisible();

  await page.getByRole('button', { name: 'تعديل الدرس الدرس الأول التجريبي' }).click();
  await page.getByLabel('عنوان الدرس').fill('الدرس الأول المحدث');
  await page.getByRole('button', { name: 'حفظ تعديل الدرس', exact: true }).click();
  await expect(page.getByText(/الدرس الأول المحدث/)).toBeVisible();

  // 9. Blog Create + Edit Loop (Surface 9)
  await nav.getByRole('button', { name: 'المدونة', exact: true }).click();
  const blogSlug = `e2e-blog-${stamp}`;
  const initialBlogTitle = `مقال تجريبي ${stamp}`;
  const updatedBlogTitle = `مقال مميز محدث ${stamp}`;

  await page.getByLabel('المعرّف النصي (slug)').fill(blogSlug);
  await page.getByLabel('العنوان').fill(initialBlogTitle);
  await page.getByLabel('مقتطف').fill('مقتطف قصير للمقال');
  await page.getByLabel('المحتوى').fill('محتوى تفصيلي للمقال التجريبي في لوحة الإدارة.');
  await page.getByRole('button', { name: 'نشر', exact: true }).first().click();
  await expect(page.getByText(initialBlogTitle)).toBeVisible();

  await page.getByRole('button', { name: `تعديل ${initialBlogTitle}` }).click();
  await page.getByLabel('العنوان').fill(updatedBlogTitle);
  await page.getByLabel('تمييز المقال في واجهة المدونة').check();
  await page.getByRole('button', { name: 'حفظ تعديلات المقال', exact: true }).click();
  await expect(page.getByText(updatedBlogTitle)).toBeVisible();
  await expect(page.getByText('مميز', { exact: true }).first()).toBeVisible();

  // 10. Growth, Donations, Careers & Video Library (Surface 10)
  await nav.getByRole('button', { name: 'التحليلات والنمو', exact: true }).click();
  await expect(page.getByRole('button', { name: 'العرض الشامل', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /طلبات التوظيف/ }).click();
  await expect(page.getByPlaceholder('بحث في طلبات التوظيف...')).toBeVisible();

  // 11. Forensic Audit Log Verification (Surface 11)
  await nav.getByRole('button', { name: 'سجل الإدارة', exact: true }).click();
  await page.getByRole('button', { name: 'الدورات والمدونة', exact: true }).click();
  await page.getByLabel('بحث في سجل التدقيق').fill('course.updated');
  await expect(page.getByText(/course\.updated/).first()).toBeVisible();

  // 12. System & Launch Readiness Gate (Surface 12)
  await nav.getByRole('button', { name: 'النظام والجاهزية', exact: true }).click();
  await expect(page.getByText('جاهزية الإطلاق العام')).toBeVisible();

  // 13–15. Standalone Operational Routes: Trials, Payments, Subscriptions
  await page.goto('/ar/admin/trials');
  await expect(page.getByPlaceholder(/بحث باسم الطالب/)).toBeVisible();

  await page.goto('/ar/admin/payments');
  await expect(page.locator('#admin-section-title')).toBeVisible();

  await page.goto('/ar/admin/subscriptions');
  await expect(page.locator('#admin-section-title')).toBeVisible();

  // Mobile Viewport Overflow Gate (390x844) across core Admin routes
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mobileRoute of ['/ar/admin', '/ar/admin/trials', '/ar/admin/payments', '/ar/admin/subscriptions']) {
    await page.goto(mobileRoute);
    await expect(page.locator('main.wn-admin-canvas')).toBeVisible();
    const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fitsViewport, `Expected zero horizontal overflow on ${mobileRoute}`).toBeTruthy();
  }

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(serverErrors, `5xx API responses: ${serverErrors.join(' | ')}`).toEqual([]);
});
