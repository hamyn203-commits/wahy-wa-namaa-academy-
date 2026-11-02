import { test, expect } from '@playwright/test';
import { accounts, login } from './helpers.js';

function packageFor(status = 'active', remaining = 2) {
  return {
    _id: 'package-one', status, planKey: 'community', sessionCount: 8,
    sessionsUsed: 8 - remaining, sessionsRemaining: remaining,
    pricePerSessionMinor: 1000, currency: 'EGP',
    pricingSnapshot: { nameAr: 'الحلقة الاقتصادية الكبرى', nameEn: 'Community Circle' },
    preferredTeacher: { personalInfo: { fullName: 'E2E Subscription Tutor' } },
    circle: ['active', 'placed', 'completed'].includes(status) ? {
      name: 'E2E Subscription Circle', students: Array.from({ length: 15 }, (_, i) => 's' + i), capacity: 20,
      timezone: 'Africa/Cairo', schedule: [{ day: 'Saturday', startTime: '18:00', endTime: '19:00' }],
    } : null,
  };
}
async function subscriptions(page, items) {
  await page.route('**/api/subscriptions/me', route => route.fulfill({ json: { subscriptions: items } }));
}

test('subscriber sees package, used credits and two-lesson warning after login and reload', async ({ page }) => {
  await subscriptions(page, [packageFor()]);
  await login(page, accounts.bookingStudent);
  const card = page.getByRole('region', { name: 'حالة الاشتراك' });
  await expect(card.getByText('اشتراكك الحالي')).toBeVisible();
  await expect(card.getByText('الباقة: 8 حصص · المستخدم: 6 · المتبقي: 2')).toBeVisible();
  await expect(card.getByText('المعلم: E2E Subscription Tutor')).toBeVisible();
  await expect(page.getByTestId('low-balance-alert')).toBeVisible();
  await expect(page.locator('.wn-student-welcome')).toHaveCount(0);
  await expect(page.getByText('حصص اشتراكك ومواعيد حلقتك', { exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByText('الباقة: 8 حصص · المستخدم: 6 · المتبقي: 2')).toBeVisible();
  await expect(page.locator('.wn-student-welcome')).toHaveCount(0);
  await page.goto('/ar/student/dashboard?tab=overview');
  // The overview's study workspace is now the active-subscription card.
  await expect(page.locator('.wn-student-active-subscription-card')).toBeVisible();
  await expect(page.getByText('ابدأ بخطوة واضحة: اختر المعلم المناسب واحجز حصتك التجريبية.')).toHaveCount(0);
});

test('prepaid renewal replaces low-credit payment prompt', async ({ page }) => {
  const renewal = { ...packageFor('renewal_queued', 12), _id: 'renewal', sessionCount: 12, renewalOf: 'package-one', sessionsUsed: 0 };
  await subscriptions(page, [renewal, packageFor()]);
  await login(page, accounts.bookingStudent);
  await expect(page.getByText('التجديد مدفوع وجاهز: 12 حصة تبدأ تلقائيًا بعد انتهاء الرصيد الحالي')).toBeVisible();
  await expect(page.getByTestId('low-balance-alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تجديد الاشتراك', exact: true })).toHaveCount(0);
});

for (const status of ['payment_review', 'awaiting_placement', 'placed']) {
  test(`${status} shows subscription progress instead of trial onboarding`, async ({ page }) => {
    await subscriptions(page, [packageFor(status, 8)]);
    await login(page, accounts.bookingStudent);
    await expect(page.getByRole('region', { name: 'حالة الاشتراك' })).toBeVisible();
    await expect(page.locator('.wn-student-welcome')).toHaveCount(0);
    await expect(page.getByTestId('low-balance-alert')).toHaveCount(0);
    await expect(page.getByText('لا حصص منتظمة — أكمل تجريبية ثم احجز من «حسابي»')).toHaveCount(0);
  });
}

test('subscription load failure does not falsely show new-student onboarding', async ({ page }) => {
  await page.route('**/api/subscriptions/me', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await login(page, accounts.bookingStudent);
  await expect(page.getByText('تعذر تأكيد حالة اشتراكك. أعد المحاولة لعرض باقتك.')).toBeVisible();
  await expect(page.locator('.wn-student-welcome')).toHaveCount(0);
});
