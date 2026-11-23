import { test, expect } from '@playwright/test';
import { E2E_PASSWORD } from './helpers.js';

test('admin places learner, starts a 15-student circle and schedules without consuming credits', async ({ page }) => {
  await page.goto('/ar/login');
  await page.locator('#login-email').fill('e2e.admin@example.test');
  await page.locator('#login-password').fill(E2E_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ar\/admin/);
  await page.goto('/ar/admin/payments');
  await page.getByRole('button', { name: 'الاشتراكات وتسكين الطلاب' }).click();
  await expect(page).toHaveURL(/\/ar\/admin\/subscriptions/);
  const learner = page.locator('article').filter({ hasText: 'E2E Circle Student 14' });
  await expect(learner).toBeVisible();
  await learner.getByRole('button', { name: 'تسكين الطالب', exact: true }).click();
  await expect(learner).toBeHidden();
  await page.getByRole('tab', { name: /الحلقات \(/ }).click();
  const circle = page.locator('article').filter({ hasText: 'E2E Economic Circle' });
  await expect(circle.getByText('15/20 طالب')).toBeVisible();
  await expect(circle.getByText('جاهزة لتحديد المواعيد والبدء')).toBeVisible();
  await expect(circle.getByRole('button', { name: 'جدولة الحصة وإرسال التنبيهات' })).toHaveCount(0);
  await circle.getByLabel('البداية', { exact: true }).fill('18:00');
  await circle.getByLabel('النهاية', { exact: true }).fill('19:00');
  await circle.getByRole('button', { name: 'اعتماد المواعيد وبدء الحلقة' }).click();
  await expect(circle.getByText('حلقة جارية', { exact: true })).toBeVisible();
  await circle.locator('summary').click();
  const row = circle.getByRole('row').filter({ hasText: 'E2E Circle Student 14' });
  await expect(row.getByRole('cell').nth(2)).toHaveText('0');
  await expect(row.getByRole('cell').nth(3)).toHaveText('4');
  const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await circle.locator('input[type="datetime-local"]').fill(tomorrow + 'T18:00');
  // Toast updates must not reload/unmount the circle and erase its draft.
  while (await page.getByRole('button', { name: 'إغلاق', exact: true }).count()) {
    await page.getByRole('button', { name: 'إغلاق', exact: true }).first().click();
  }
  await expect(circle.locator('input[type="datetime-local"]')).toHaveValue(tomorrow + 'T18:00');
  const scheduled = page.waitForResponse(response => response.url().includes('/api/sessions/group-circle') && response.request().method() === 'POST');
  await circle.getByRole('button', { name: 'جدولة الحصة وإرسال التنبيهات' }).click();
  const response = await scheduled;
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.session.attendance).toHaveLength(15);
  await page.reload();
  await page.getByRole('tab', { name: /الحلقات \(/ }).click();
  await circle.locator('summary').click();
  await expect(row.getByRole('cell').nth(2)).toHaveText('0');
  await expect(row.getByRole('cell').nth(3)).toHaveText('4');
});
