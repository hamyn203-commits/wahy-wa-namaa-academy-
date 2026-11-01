import { expect } from '@playwright/test';

export const E2E_PASSWORD = 'Playwright123!';

export const accounts = {
  postTrialStudent: 'e2e.posttrial@example.test',
  bookingStudent: 'e2e.booking@example.test',
  trialLimitStudent: 'e2e.limit@example.test',
  teacher: 'e2e.teacher1@example.test',
};

export async function login(page, email) {
  await page.goto('/ar/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(E2E_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ar\/(student|teacher)\/dashboard/);
}

export async function logout(page) {
  const button = page.getByRole('button', { name: 'خروج' });
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await expect(page).toHaveURL(/\/ar\/login/);
  }
}

/** Student registration keeps level/age/guardian fields in a collapsed optional section. */
export async function openOptionalRegistrationDetails(page) {
  const details = page.locator('details.wn-register-optional');
  if (!(await details.evaluate((el) => el.open))) {
    await details.locator('summary').click();
  }
  await expect(details).toHaveAttribute('open', '');
}
