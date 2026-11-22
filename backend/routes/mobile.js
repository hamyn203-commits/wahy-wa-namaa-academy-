'use strict';

const express = require('express');

const router = express.Router();

const ALLOWED_APPS = new Set(['learner', 'teacher']);
const ALLOWED_PLATFORMS = new Set(['android', 'ios']);
const DEFAULT_SITE_URL = (process.env.SITE_URL || 'https://wahywanamaa.com').replace(/\/+$/, '');
const DEFAULT_LEARNER_ANDROID_APK_URL =
  'https://github.com/hamyn203-commits/wahy-wa-namaa-academy-/releases/latest/download/Wahy-Wa-Namaa-Academy.apk';

function sanitizeSemver(raw, fallback = '1.0.0') {
  const value = String(raw || '').trim();
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})/);
  if (!match) return fallback;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function compareSemver(left, right) {
  const a = sanitizeSemver(left).split('.').map(Number);
  const b = sanitizeSemver(right).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function safeHttpsUrl(raw, fallback) {
  const candidate = String(raw || '').trim();
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'https:') return parsed.toString();
  } catch {
    // Fall back to official HTTPS download page.
  }
  return fallback;
}

/**
 * GET /api/mobile/config?app=learner|teacher&platform=android|ios&version=1.0.0
 * Returns version policy, safe HTTPS download URL, and update flags (no secrets).
 */
router.get('/config', (req, res) => {
  const rawApp = String(req.query.app || 'learner').trim().toLowerCase();
  const app = ALLOWED_APPS.has(rawApp) ? rawApp : 'learner';

  const rawPlatform = String(req.query.platform || 'android').trim().toLowerCase();
  const platform = ALLOWED_PLATFORMS.has(rawPlatform) ? rawPlatform : 'android';

  const currentVersion = sanitizeSemver(req.query.version || req.headers['x-app-version'], '1.0.0');
  const prefix = app === 'teacher' ? 'MOBILE_TEACHER' : 'MOBILE_LEARNER';

  const latestVersion = sanitizeSemver(process.env[`${prefix}_LATEST_VERSION`], '1.0.0');
  const minVersion = sanitizeSemver(process.env[`${prefix}_MIN_VERSION`], '1.0.0');

  const fallbackDownloadUrl = app === 'learner' && platform === 'android'
    ? DEFAULT_LEARNER_ANDROID_APK_URL
    : `${DEFAULT_SITE_URL}/ar/mobile`;
  const envUrlKey = platform === 'ios'
    ? `${prefix}_IOS_STORE_URL`
    : `${prefix}_ANDROID_APK_URL`;
  const downloadUrl = safeHttpsUrl(process.env[envUrlKey], fallbackDownloadUrl);

  const forceUpdate = compareSemver(currentVersion, minVersion) < 0;
  const updateAvailable = forceUpdate || compareSemver(currentVersion, latestVersion) < 0;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    app,
    platform,
    currentVersion,
    latestVersion,
    minVersion,
    updateAvailable,
    forceUpdate,
    downloadUrl,
    releaseNotes: {
      ar: String(process.env[`${prefix}_RELEASE_NOTES_AR`] || '').trim().slice(0, 300),
      en: String(process.env[`${prefix}_RELEASE_NOTES_EN`] || '').trim().slice(0, 300),
    },
  });
});

/**
 * GET /api/mobile/download/:platform?app=learner|teacher
 * Branded permanent academy download link that redirects safely to the latest
 * official release file (e.g. Wahy-Wa-Namaa-Academy.apk).
 */
router.get('/download/:platform', (req, res) => {
  const rawApp = String(req.query.app || 'learner').trim().toLowerCase();
  const app = ALLOWED_APPS.has(rawApp) ? rawApp : 'learner';

  const rawPlatform = String(req.params.platform || 'android').trim().toLowerCase();
  const platform = ALLOWED_PLATFORMS.has(rawPlatform) ? rawPlatform : 'android';

  const prefix = app === 'teacher' ? 'MOBILE_TEACHER' : 'MOBILE_LEARNER';
  const fallbackDownloadUrl = app === 'learner' && platform === 'android'
    ? DEFAULT_LEARNER_ANDROID_APK_URL
    : `${DEFAULT_SITE_URL}/ar/mobile`;
  const envUrlKey = platform === 'ios'
    ? `${prefix}_IOS_STORE_URL`
    : `${prefix}_ANDROID_APK_URL`;
  const targetUrl = safeHttpsUrl(process.env[envUrlKey], fallbackDownloadUrl);

  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, targetUrl);
});

module.exports = router;
module.exports.compareSemver = compareSemver;
module.exports.sanitizeSemver = sanitizeSemver;
