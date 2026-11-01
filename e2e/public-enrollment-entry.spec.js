import { test, expect } from '@playwright/test';
import { openOptionalRegistrationDetails } from './helpers.js';

test.describe('Public enrollment entry', () => {
  test('homepage CTA starts with section choice and continues as a parent', async ({ page }) => {
    await page.goto('/ar/');
    await page.getByRole('link', { name: /ابدأ رحلتك الآن/ }).first().click();
    await expect(page).toHaveURL(/\/ar\/start$/);
    await expect(page.getByRole('heading', { name: /اختر قسمك/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /قسم الرجال والأطفال/ })).toBeVisible();
    await page.getByRole('button', { name: /قسم السيدات/ }).click();
    await expect(page.getByText('القسم المختار:')).toBeVisible();
    await page.getByRole('link', { name: /التسجيل كولي أمر/ }).click();
    await expect(page).toHaveURL(/\/ar\/register\/guardian\?section=women/);
    await expect(page.getByRole('heading', { name: 'إنشاء حساب ولي أمر' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'حساب معلم' })).toHaveCount(0);
  });

  test('a learner can choose the men and children section before creating an account', async ({ page }) => {
    await page.goto('/ar/start');
    await page.getByRole('button', { name: /قسم الرجال والأطفال/ }).click();
    await page.getByRole('link', { name: /التسجيل كطالب/ }).click();
    await expect(page).toHaveURL(/\/ar\/register\/student\?section=men/);
    await expect(page.locator('select[name="gender"]')).toHaveValue('male');
    await expect(page.getByText('القسم المختار:')).toBeVisible();
  });

  test('public login and registration expose only student and guardian accounts', async ({ page }) => {
    await page.goto('/ar/login');
    await expect(page.getByRole('button', { name: 'الانضمام كمعلم' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إنشاء حساب طالب' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'إنشاء حساب ولي أمر' })).toBeVisible();
    await page.goto('/ar/register');
    await expect(page.getByRole('button', { name: 'حساب معلم' })).toHaveCount(0);
  });
});


test('women-section account stays within its saved section at subscription checkout', async ({ page }) => {
  const email = `e2e.women.section.${Date.now()}@example.test`;
  await page.goto('/ar/start');
  await page.getByRole('button', { name: /قسم السيدات/ }).click();
  await page.getByRole('link', { name: /التسجيل كطالب/ }).click();
  await page.locator('input[name="name"]').fill('E2E Division Student');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="phone"]').fill('+201000009992');
  await openOptionalRegistrationDetails(page);
  await page.locator('input[name="age"]').fill('23');
  await page.locator('input[name="password"]').fill('Playwright123!');
  await page.locator('input[name="confirmPassword"]').fill('Playwright123!');
  const registered = page.waitForResponse(response => response.url().includes('/api/auth/register') && response.request().method() === 'POST');
  await page.locator('form').getByRole('button', { name: /إنشاء|تسجيل/ }).click();
  const registration = await (await registered).json();
  expect(registration.user?.enrollmentSection).toBe('ladies');
  await expect(page).toHaveURL(/\/ar\/student\/dashboard/);

  const headers = { Authorization: 'Bearer ' + registration.accessToken };
  const wrong = await page.request.post('/api/subscriptions/select', {
    headers, data: { planKey: 'group', section: 'men_children', sessionCount: 4 },
  });
  expect(wrong.status()).toBe(409);
  expect((await wrong.json()).code).toBe('SUBSCRIPTION_SECTION_MISMATCH');

  const valid = await page.request.post('/api/subscriptions/select', {
    headers, data: { planKey: 'group', section: 'ladies', sessionCount: 4 },
  });
  expect(valid.status()).toBe(201);
  expect((await valid.json()).subscription?.section).toBe('ladies');
});
