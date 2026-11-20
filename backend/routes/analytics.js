const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const SiteVisit = require('../models/SiteVisit');
const TeacherFunnelSession = require('../models/TeacherFunnelSession');
const { protect, authorize } = require('../middleware/auth');
const { resolveClientIp } = require('../middleware/userRateLimit');
const { safeErrorMessage } = require('../utils/safeError');

const SUPPORTED_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);
const VALID_PLATFORMS = new Set(['web', 'pwa', 'android', 'ios']);
const VALID_DEVICES = new Set(['mobile', 'tablet', 'desktop', 'unknown']);
const VALID_FUNNEL_STATUSES = new Set(['visited', 'in_progress', 'submitted']);
const ACADEMY_TIMEZONE = process.env.ANALYTICS_TIMEZONE || 'Africa/Cairo';

function cleanString(value, maxLen = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
}

function hashClientIp(req) {
  const ip = resolveClientIp(req) || '';
  if (!ip) return '';
  const salt = process.env.ANALYTICS_IP_SALT || process.env.JWT_SECRET || 'wn-analytics-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

function detectDeviceFromUA(ua = '') {
  const lower = String(ua || '').toLowerCase();
  if (!lower) return 'unknown';
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(lower)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(lower)) return 'mobile';
  return 'desktop';
}

function resolvePlatform(body, req) {
  const headerPlatform = cleanString(req.get('x-app-platform') || '', 20).toLowerCase();
  const bodyPlatform = cleanString(body?.platform || '', 20).toLowerCase();
  if (VALID_PLATFORMS.has(bodyPlatform)) return bodyPlatform;
  if (VALID_PLATFORMS.has(headerPlatform)) return headerPlatform;
  return 'web';
}

function resolveDevice(body, req, platform) {
  const raw = cleanString(body?.deviceType || '', 20).toLowerCase();
  if (VALID_DEVICES.has(raw)) return raw;
  if (platform === 'android' || platform === 'ios') return 'mobile';
  return detectDeviceFromUA(req.get('user-agent'));
}

function normalizeRoutePath(raw = '/') {
  let clean = cleanString(raw, 200);
  if (!clean) return { path: '/', rawPath: '/', detectedLocale: '' };
  clean = clean.split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) clean = `/${clean}`;
  clean = clean.replace(/\/{2,}/g, '/');
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);

  const segments = clean.split('/').filter(Boolean);
  let detectedLocale = '';
  let normalized = clean;
  if (segments.length > 0 && SUPPORTED_LOCALES.has(segments[0].toLowerCase())) {
    detectedLocale = segments[0].toLowerCase();
    normalized = segments.length > 1 ? `/${segments.slice(1).join('/')}` : '/';
  }

  return {
    path: normalized.slice(0, 180) || '/',
    rawPath: clean.slice(0, 200),
    detectedLocale,
  };
}

function normalizeSource(sourceRaw, referrerRaw) {
  const explicit = cleanString(sourceRaw, 80).toLowerCase();
  if (explicit) return explicit;
  const ref = cleanString(referrerRaw, 300);
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./i, '').toLowerCase();
    if (!host || host.includes('wahywanamaa.com') || host === 'localhost') return 'direct';
    if (host.includes('facebook') || host.includes('fb.com') || host === 'l.facebook.com' || host === 'm.facebook.com') return 'facebook';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp';
    if (host.includes('t.me') || host.includes('telegram')) return 'telegram';
    if (host.includes('google.')) return 'google';
    if (host.includes('youtube') || host === 'youtu.be') return 'youtube';
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('twitter') || host === 't.co' || host === 'x.com') return 'x';
    return host.slice(0, 60);
  } catch {
    return 'direct';
  }
}

function getLocalTimeParts(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: ACADEMY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    for (const part of parts) map[part.type] = part.value;
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hourNum = Number(map.hour);
    return {
      dateKey: `${map.year}-${map.month}-${map.day}`,
      hourLocal: Number.isFinite(hourNum) ? (hourNum === 24 ? 0 : hourNum) : date.getUTCHours(),
      dayOfWeek: weekdayMap[map.weekday] ?? date.getUTCDay(),
    };
  } catch {
    return {
      dateKey: date.toISOString().slice(0, 10),
      hourLocal: date.getUTCHours(),
      dayOfWeek: date.getUTCDay(),
    };
  }
}

function parseDaysWindow(raw, fallback = 30) {
  const num = Number(raw);
  if ([1, 7, 14, 30, 60, 90, 180].includes(num)) return num;
  if (Number.isFinite(num) && num >= 1 && num <= 180) return Math.round(num);
  return fallback;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Public ingestion endpoints (Web, PWA, Android & iOS mobile app compatible)
// ---------------------------------------------------------------------------

router.post('/visit', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { path, rawPath, detectedLocale } = normalizeRoutePath(body.path || body.screen || '/');

    // Never record internal admin console views in public academy traffic metrics.
    if (path === '/admin' || path.startsWith('/admin/')) {
      return res.status(202).json({ ok: true, ignored: true });
    }

    const platform = resolvePlatform(body, req);
    const deviceType = resolveDevice(body, req, platform);
    const ipHash = hashClientIp(req);
    const visitorId = cleanString(body.visitorId, 80) || (ipHash ? `anon-${ipHash.slice(0, 16)}` : crypto.randomUUID());
    const sessionId = cleanString(body.sessionId, 80) || visitorId;
    const rawLocale = cleanString(body.locale || detectedLocale || 'ar', 12).toLowerCase();
    const locale = SUPPORTED_LOCALES.has(rawLocale) ? rawLocale : 'ar';
    const appVersion = cleanString(body.appVersion || req.get('x-app-version') || '', 32);
    const source = normalizeSource(body.source, body.referrer);
    const medium = cleanString(body.medium, 60).toLowerCase();
    const campaign = cleanString(body.campaign, 80);

    const now = new Date();
    const { dateKey, hourLocal, dayOfWeek } = getLocalTimeParts(now);

    await SiteVisit.create({
      visitorId,
      sessionId,
      path,
      rawPath,
      locale,
      platform,
      appVersion,
      deviceType,
      source,
      medium,
      campaign,
      hourLocal,
      dayOfWeek,
      dateKey,
      ipHash,
      createdAt: now,
    });

    return res.status(202).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to record visit') });
  }
});

router.post('/teacher-funnel', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const sessionId = cleanString(body.sessionId, 80);
    if (!sessionId || sessionId.length < 6) {
      return res.status(400).json({ error: 'Valid sessionId is required' });
    }

    const platform = resolvePlatform(body, req);
    const deviceType = resolveDevice(body, req, platform);
    const ipHash = hashClientIp(req);
    const visitorId = cleanString(body.visitorId, 80) || sessionId;
    const rawLocale = cleanString(body.locale || 'ar', 12).toLowerCase();
    const locale = SUPPORTED_LOCALES.has(rawLocale) ? rawLocale : 'ar';
    const appVersion = cleanString(body.appVersion || req.get('x-app-version') || '', 32);
    const source = normalizeSource(body.source, body.referrer);
    const campaign = cleanString(body.campaign, 80);
    const entryPath = normalizeRoutePath(body.entryPath || '/register/teacher').path;
    const event = cleanString(body.event || 'progress', 60);
    const lastError = cleanString(body.lastError || '', 160);

    const parsedStep = Math.min(5, Math.max(1, Number(body.step) || 1));
    const touchedFieldsCount = Math.min(50, Math.max(0, Number(body.touchedFieldsCount) || 0));
    const filesSelectedCount = Math.min(20, Math.max(0, Number(body.filesSelectedCount) || 0));
    const emailVerified = Boolean(body.emailVerified);

    // Strictly whitelist non-sensitive lead contact fields (NEVER passwords or OTP codes).
    const fullName = cleanString(body.fullName, 120);
    const email = cleanString(body.email, 160).toLowerCase();
    const phone = cleanString(body.phone, 40);
    const whatsapp = cleanString(body.whatsapp, 40);
    const country = cleanString(body.country, 60);
    const genderRaw = cleanString(body.gender, 12).toLowerCase();
    const gender = ['male', 'female'].includes(genderRaw) ? genderRaw : '';

    const now = new Date();
    const existing = await TeacherFunnelSession.findOne({ sessionId });

    const prevMaxStep = existing?.maxStep || 1;
    const nextMaxStep = Math.max(prevMaxStep, parsedStep);
    const prevTouched = existing?.touchedFieldsCount || 0;
    const nextTouched = Math.max(prevTouched, touchedFieldsCount);
    const prevFiles = existing?.filesSelectedCount || 0;
    const nextFiles = Math.max(prevFiles, filesSelectedCount);
    const nextEmailVerified = Boolean(existing?.emailVerified || emailVerified);

    const hasLeadActivity = Boolean(
      nextMaxStep > 1
      || nextTouched > 0
      || nextFiles > 0
      || nextEmailVerified
      || fullName || existing?.fullName
      || email || existing?.email
      || phone || existing?.phone
      || whatsapp || existing?.whatsapp
    );

    let nextStatus = 'visited';
    if (existing?.status === 'submitted' || event === 'submitted') {
      nextStatus = 'submitted';
    } else if (hasLeadActivity) {
      nextStatus = 'in_progress';
    }

    const reachedSet = new Set([...(existing?.reachedSteps || [1]), parsedStep]);
    if (nextStatus === 'submitted') reachedSet.add(5);
    const reachedSteps = Array.from(reachedSet).sort((a, b) => a - b);

    const setFields = {
      visitorId: existing?.visitorId || visitorId,
      status: nextStatus,
      currentStep: nextStatus === 'submitted' ? 5 : parsedStep,
      maxStep: nextStatus === 'submitted' ? 5 : nextMaxStep,
      reachedSteps,
      touchedFieldsCount: nextTouched,
      filesSelectedCount: nextFiles,
      emailVerified: nextEmailVerified,
      platform: existing?.platform || platform,
      appVersion: appVersion || existing?.appVersion || '',
      deviceType: existing?.deviceType && existing.deviceType !== 'unknown' ? existing.deviceType : deviceType,
      locale,
      lastEvent: event,
      lastError,
      lastActiveAt: now,
    };

    if (fullName) setFields.fullName = fullName;
    if (email) setFields.email = email;
    if (phone) setFields.phone = phone;
    if (whatsapp) setFields.whatsapp = whatsapp;
    if (country) setFields.country = country;
    if (gender) setFields.gender = gender;
    if (!existing?.source || existing.source === 'direct') {
      setFields.source = source;
    }
    if (campaign && !existing?.campaign) setFields.campaign = campaign;
    if (nextStatus === 'submitted' && !existing?.submittedAt) {
      setFields.submittedAt = now;
    }

    const updated = await TeacherFunnelSession.findOneAndUpdate(
      { sessionId },
      {
        $set: setFields,
        $setOnInsert: {
          sessionId,
          entryPath,
          ipHash,
          startedAt: now,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(202).json({
      ok: true,
      status: updated.status,
      maxStep: updated.maxStep,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to record teacher funnel event') });
  }
});

// ---------------------------------------------------------------------------
// Admin-only analytics dashboard endpoints
// ---------------------------------------------------------------------------

router.get('/admin/overview', protect, authorize('admin'), async (req, res) => {
  try {
    const days = parseDaysWindow(req.query.days, 30);
    const platformFilter = cleanString(String(req.query.platform || 'all'), 20).toLowerCase();

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayKey = getLocalTimeParts(now).dateKey;

    const visitMatch = { createdAt: { $gte: since } };
    const funnelMatch = { startedAt: { $gte: since } };
    if (VALID_PLATFORMS.has(platformFilter)) {
      visitMatch.platform = platformFilter;
      funnelMatch.platform = platformFilter;
    }

    const [
      totalsAgg,
      todayAgg,
      last24hCount,
      hourlyAgg,
      dailyAgg,
      weekdayAgg,
      platformAgg,
      deviceAgg,
      topPagesAgg,
      topSourcesAgg,
      funnelStatusAgg,
    ] = await Promise.all([
      SiteVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: null,
            totalVisits: { $sum: 1 },
            uniqueVisitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            totalVisits: 1,
            uniqueVisitors: { $size: '$uniqueVisitors' },
          },
        },
      ]),
      SiteVisit.aggregate([
        {
          $match: {
            ...(VALID_PLATFORMS.has(platformFilter) ? { platform: platformFilter } : {}),
            dateKey: todayKey,
          },
        },
        {
          $group: {
            _id: null,
            todayVisits: { $sum: 1 },
            todayUniqueVisitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            todayVisits: 1,
            todayUniqueVisitors: { $size: '$todayUniqueVisitors' },
          },
        },
      ]),
      SiteVisit.countDocuments({
        ...(VALID_PLATFORMS.has(platformFilter) ? { platform: platformFilter } : {}),
        createdAt: { $gte: last24h },
      }),
      SiteVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: '$hourLocal',
            visits: { $sum: 1 },
            visitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            hour: '$_id',
            visits: 1,
            uniqueVisitors: { $size: '$visitors' },
          },
        },
        { $sort: { hour: 1 } },
      ]),
      SiteVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: '$dateKey',
            visits: { $sum: 1 },
            visitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            visits: 1,
            uniqueVisitors: { $size: '$visitors' },
          },
        },
        { $sort: { date: 1 } },
      ]),
      SiteVisit.aggregate([
        { $match: visitMatch },
        { $group: { _id: '$dayOfWeek', visits: { $sum: 1 } } },
        { $project: { _id: 0, dayOfWeek: '$_id', visits: 1 } },
        { $sort: { dayOfWeek: 1 } },
      ]),
      SiteVisit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$platform',
            visits: { $sum: 1 },
            visitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            platform: '$_id',
            visits: 1,
            uniqueVisitors: { $size: '$visitors' },
          },
        },
      ]),
      SiteVisit.aggregate([
        { $match: visitMatch },
        { $group: { _id: '$deviceType', visits: { $sum: 1 } } },
        { $project: { _id: 0, deviceType: '$_id', visits: 1 } },
        { $sort: { visits: -1 } },
      ]),
      SiteVisit.aggregate([
        { $match: visitMatch },
        {
          $group: {
            _id: '$path',
            visits: { $sum: 1 },
            visitors: { $addToSet: '$visitorId' },
          },
        },
        {
          $project: {
            _id: 0,
            path: '$_id',
            visits: 1,
            uniqueVisitors: { $size: '$visitors' },
          },
        },
        { $sort: { visits: -1 } },
        { $limit: 10 },
      ]),
      SiteVisit.aggregate([
        { $match: visitMatch },
        { $group: { _id: '$source', visits: { $sum: 1 } } },
        { $project: { _id: 0, source: '$_id', visits: 1 } },
        { $sort: { visits: -1 } },
        { $limit: 8 },
      ]),
      TeacherFunnelSession.aggregate([
        { $match: funnelMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const totals = totalsAgg[0] || { totalVisits: 0, uniqueVisitors: 0 };
    const today = todayAgg[0] || { todayVisits: 0, todayUniqueVisitors: 0 };

    // Build complete 0..23 hour series
    const hourMap = new Map(hourlyAgg.map((item) => [item.hour, item]));
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const row = hourMap.get(hour);
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        visits: row?.visits || 0,
        uniqueVisitors: row?.uniqueVisitors || 0,
      };
    });

    const peakHour = hourlyDistribution.reduce(
      (best, cur) => (cur.visits > best.visits ? cur : best),
      { hour: 0, label: '00:00', visits: 0, uniqueVisitors: 0 }
    );

    // Build complete 0..6 weekday series
    const weekdayMap = new Map(weekdayAgg.map((item) => [item.dayOfWeek, item.visits]));
    const weekdayDistribution = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      visits: weekdayMap.get(dayOfWeek) || 0,
    }));
    const peakDay = weekdayDistribution.reduce(
      (best, cur) => (cur.visits > best.visits ? cur : best),
      { dayOfWeek: 0, visits: 0 }
    );

    // Complete platform map including future native mobile apps (web, pwa, android, ios)
    const platformMap = new Map(platformAgg.map((p) => [p.platform, p]));
    const byPlatform = ['web', 'pwa', 'android', 'ios'].map((platform) => ({
      platform,
      visits: platformMap.get(platform)?.visits || 0,
      uniqueVisitors: platformMap.get(platform)?.uniqueVisitors || 0,
    }));

    const funnelCounts = { visited: 0, in_progress: 0, submitted: 0 };
    for (const row of funnelStatusAgg) {
      if (row._id in funnelCounts) funnelCounts[row._id] = row.count;
    }
    const funnelTotal = funnelCounts.visited + funnelCounts.in_progress + funnelCounts.submitted;

    return res.json({
      days,
      timezone: ACADEMY_TIMEZONE,
      platformFilter: VALID_PLATFORMS.has(platformFilter) ? platformFilter : 'all',
      summary: {
        totalVisits: totals.totalVisits,
        uniqueVisitors: totals.uniqueVisitors,
        todayVisits: today.todayVisits,
        todayUniqueVisitors: today.todayUniqueVisitors,
        visitsLast24h: last24hCount,
        avgDailyVisits: days > 0 ? Math.round((totals.totalVisits / days) * 10) / 10 : 0,
        peakHour,
        peakDay,
      },
      hourlyDistribution,
      dailyTrend: dailyAgg,
      weekdayDistribution,
      byPlatform,
      byDevice: deviceAgg,
      topPages: topPagesAgg,
      topSources: topSourcesAgg,
      teacherFunnelSummary: {
        total: funnelTotal,
        visitedOnly: funnelCounts.visited,
        inProgress: funnelCounts.in_progress,
        submitted: funnelCounts.submitted,
        completionRate: funnelTotal > 0 ? Math.round((funnelCounts.submitted / funnelTotal) * 1000) / 10 : 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to load analytics overview') });
  }
});

router.get('/admin/teacher-funnel', protect, authorize('admin'), async (req, res) => {
  try {
    const days = parseDaysWindow(req.query.days, 30);
    const statusFilter = cleanString(String(req.query.status || 'all'), 20).toLowerCase();
    const platformFilter = cleanString(String(req.query.platform || 'all'), 20).toLowerCase();
    const search = cleanString(String(req.query.search || ''), 80);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 25));

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const baseMatch = { startedAt: { $gte: since } };
    if (VALID_PLATFORMS.has(platformFilter)) {
      baseMatch.platform = platformFilter;
    }

    const listMatch = { ...baseMatch };
    if (VALID_FUNNEL_STATUSES.has(statusFilter)) {
      listMatch.status = statusFilter;
    }
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      listMatch.$or = [
        { fullName: rx },
        { email: rx },
        { phone: rx },
        { whatsapp: rx },
        { country: rx },
        { source: rx },
      ];
    }

    const [
      statusAgg,
      stepAgg,
      sourceAgg,
      totalFiltered,
      sessions,
    ] = await Promise.all([
      TeacherFunnelSession.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgStep: { $avg: '$maxStep' },
          },
        },
      ]),
      TeacherFunnelSession.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            step1: { $sum: { $cond: [{ $gte: ['$maxStep', 1] }, 1, 0] } },
            step2: { $sum: { $cond: [{ $gte: ['$maxStep', 2] }, 1, 0] } },
            step3: { $sum: { $cond: [{ $gte: ['$maxStep', 3] }, 1, 0] } },
            step4: { $sum: { $cond: [{ $gte: ['$maxStep', 4] }, 1, 0] } },
            step5: { $sum: { $cond: [{ $gte: ['$maxStep', 5] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            stoppedAt1Empty: {
              $sum: { $cond: [{ $eq: ['$status', 'visited'] }, 1, 0] },
            },
            stoppedAt1Started: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'in_progress'] }, { $eq: ['$maxStep', 1] }] },
                  1,
                  0,
                ],
              },
            },
            stoppedAt2: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'in_progress'] }, { $eq: ['$maxStep', 2] }] },
                  1,
                  0,
                ],
              },
            },
            stoppedAt3: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'in_progress'] }, { $eq: ['$maxStep', 3] }] },
                  1,
                  0,
                ],
              },
            },
            stoppedAt4: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'in_progress'] }, { $eq: ['$maxStep', 4] }] },
                  1,
                  0,
                ],
              },
            },
            stoppedAt5: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'in_progress'] }, { $eq: ['$maxStep', 5] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      TeacherFunnelSession.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: '$source',
            total: { $sum: 1 },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          },
        },
        { $project: { _id: 0, source: '$_id', total: 1, submitted: 1 } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),
      TeacherFunnelSession.countDocuments(listMatch),
      TeacherFunnelSession.find(listMatch)
        .select('-ipHash')
        .sort({ lastActiveAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const counts = { visited: 0, in_progress: 0, submitted: 0 };
    for (const row of statusAgg) {
      if (row._id in counts) counts[row._id] = row.count;
    }
    const total = counts.visited + counts.in_progress + counts.submitted;
    const stepStats = stepAgg[0] || {
      total: 0,
      step1: 0,
      step2: 0,
      step3: 0,
      step4: 0,
      step5: 0,
      submitted: 0,
      stoppedAt1Empty: 0,
      stoppedAt1Started: 0,
      stoppedAt2: 0,
      stoppedAt3: 0,
      stoppedAt4: 0,
      stoppedAt5: 0,
    };

    const stepBreakdown = [
      { step: 1, key: 'step1', reached: stepStats.step1, stoppedHere: stepStats.stoppedAt1Empty + stepStats.stoppedAt1Started },
      { step: 2, key: 'step2', reached: stepStats.step2, stoppedHere: stepStats.stoppedAt2 },
      { step: 3, key: 'step3', reached: stepStats.step3, stoppedHere: stepStats.stoppedAt3 },
      { step: 4, key: 'step4', reached: stepStats.step4, stoppedHere: stepStats.stoppedAt4 },
      { step: 5, key: 'step5', reached: stepStats.step5, stoppedHere: stepStats.stoppedAt5 },
      { step: 6, key: 'submitted', reached: stepStats.submitted, stoppedHere: 0 },
    ];

    return res.json({
      days,
      summary: {
        total,
        visitedOnly: counts.visited,
        inProgress: counts.in_progress,
        submitted: counts.submitted,
        completionRate: total > 0 ? Math.round((counts.submitted / total) * 1000) / 10 : 0,
        bounceRate: total > 0 ? Math.round((counts.visited / total) * 1000) / 10 : 0,
        dropOffRate: total > 0 ? Math.round((counts.in_progress / total) * 1000) / 10 : 0,
      },
      stepBreakdown,
      bySource: sourceAgg,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / limit)),
      },
      sessions,
    });
  } catch (error) {
    return res.status(500).json({ error: safeErrorMessage(error, 'Failed to load teacher funnel analytics') });
  }
});

module.exports = router;
