const crypto = require('crypto');
const mongoose = require('mongoose');
const TeacherInvite = require('../models/TeacherInvite');
const { isMockMode } = require('../config/runtime');
const { getAccessSecret } = require('../middleware/auth');

const MIN_EXPIRES_HOURS = 1;
const MAX_EXPIRES_HOURS = 720; // 30 days
const MIN_MAX_USES = 1;
const MAX_MAX_USES = 50;
const ALLOWED_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);

// Mock-mode store (only used when NODE_ENV !== production / isMockMode && DB disconnected)
const mockInvites = new Map();

function isDbReady() {
  return (
    mongoose.connection.readyState === 1
    && (Boolean(mongoose.connection?.db) || TeacherInvite.findOne !== mongoose.Model.findOne)
  );
}

function generateRawInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashInviteToken(rawToken) {
  const clean = String(rawToken || '').trim();
  if (!clean) return '';
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function deriveInviteCipherKey() {
  return crypto.createHash('sha256').update(`teacher-invite-aes:${getAccessSecret()}`).digest();
}

function encryptInviteToken(rawToken) {
  const clean = String(rawToken || '').trim();
  if (!clean) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveInviteCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptInviteToken(packed) {
  const raw = String(packed || '').trim();
  if (!raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveInviteCipherKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function sanitizeInviteToken(rawToken) {
  const clean = String(rawToken || '').trim();
  if (!clean || clean.length < 16 || clean.length > 160) return '';
  if (!/^[A-Za-z0-9_-]+$/.test(clean)) return '';
  return clean;
}

function normalizeClientIp(rawIp = '') {
  let value = String(rawIp || '').trim();
  if (!value) return '';
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (value === '::1') value = '127.0.0.1';
  return value.toLowerCase();
}

function extractClientIp(req) {
  const candidate = req?.ip || req?.socket?.remoteAddress || '';
  return normalizeClientIp(candidate);
}

function hashClientIp(normalizedIp) {
  const clean = normalizeClientIp(normalizedIp);
  if (!clean) return '';
  return crypto.createHash('sha256').update(`teacher-invite-ip:${clean}`).digest('hex');
}

function maskClientIp(normalizedIp) {
  const clean = normalizeClientIp(normalizedIp);
  if (!clean) return '';
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (clean.includes(':')) {
    const parts = clean.split(':').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}:*:*`;
  }
  return '***';
}

function timingSafeHexEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(String(a), 'hex');
  const right = Buffer.from(String(b), 'hex');
  return left.length === 32 && right.length === 32 && crypto.timingSafeEqual(left, right);
}

function computeInviteStatus(invite, nowMs = Date.now()) {
  if (!invite) return 'invalid';
  if (invite.revokedAt) return 'revoked';
  const used = Number(invite.usedCount || 0);
  const maxUses = Number(invite.maxUses || 1);
  if (used >= maxUses) return 'exhausted';
  const expMs = invite.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
  if (!expMs || expMs <= nowMs) return 'expired';
  return 'active';
}

function serializeInviteForAdmin(invite, nowMs = Date.now()) {
  const raw = invite?.toObject ? invite.toObject() : invite;
  if (!raw) return null;
  const status = computeInviteStatus(raw, nowMs);
  const maxUses = Number(raw.maxUses || 1);
  const usedCount = Number(raw.usedCount || 0);
  const lockToFirstIp = raw.lockToFirstIp !== false;
  return {
    id: String(raw._id || raw.id),
    _id: String(raw._id || raw.id),
    tokenPreview: String(raw.tokenPreview || ''),
    label: String(raw.label || ''),
    locale: ALLOWED_LOCALES.has(raw.locale) ? raw.locale : 'ar',
    maxUses,
    usedCount,
    remainingUses: Math.max(0, maxUses - usedCount),
    lockToFirstIp,
    ipBound: Boolean(raw.boundIpMasked || raw.boundAt),
    boundIpMasked: String(raw.boundIpMasked || ''),
    boundAt: raw.boundAt || null,
    status,
    expiresAt: raw.expiresAt,
    revokedAt: raw.revokedAt || null,
    createdAt: raw.createdAt || null,
    createdBy: raw.createdBy && typeof raw.createdBy === 'object'
      ? { id: String(raw.createdBy._id || raw.createdBy.id || ''), name: raw.createdBy.name || '', email: raw.createdBy.email || '' }
      : (raw.createdBy ? { id: String(raw.createdBy) } : null),
    revokedBy: raw.revokedBy && typeof raw.revokedBy === 'object'
      ? { id: String(raw.revokedBy._id || raw.revokedBy.id || ''), name: raw.revokedBy.name || '' }
      : (raw.revokedBy ? { id: String(raw.revokedBy) } : null),
    usedBy: Array.isArray(raw.usedBy)
      ? raw.usedBy.map((u) => ({
        teacherId: u.teacher ? String(u.teacher) : null,
        userId: u.user ? String(u.user) : null,
        email: u.email || '',
        name: u.name || '',
        usedAt: u.usedAt || null,
      }))
      : [],
  };
}

function buildPublicInviteUrl({ rawToken, locale = 'ar', origin = '' }) {
  const safeLocale = ALLOWED_LOCALES.has(locale) ? locale : 'ar';
  const invitePath = `/${safeLocale}/teacher/register?invite=${encodeURIComponent(rawToken)}`;
  const cleanOrigin = String(origin || process.env.FRONTEND_URL || 'https://wahywanamaa.com').replace(/\/+$/, '');
  return {
    invitePath,
    inviteUrl: `${cleanOrigin}${invitePath}`,
  };
}

async function createTeacherInvite({
  createdBy,
  label = '',
  expiresInHours = 24,
  maxUses = 1,
  lockToFirstIp,
  locale = 'ar',
  origin = '',
}) {
  const parsedHours = Number(expiresInHours);
  const boundedHours = Number.isFinite(parsedHours)
    ? Math.min(MAX_EXPIRES_HOURS, Math.max(MIN_EXPIRES_HOURS, Math.round(parsedHours)))
    : 24;

  const parsedMaxUses = Number(maxUses);
  const boundedMaxUses = Number.isFinite(parsedMaxUses)
    ? Math.min(MAX_MAX_USES, Math.max(MIN_MAX_USES, Math.round(parsedMaxUses)))
    : 1;

  // Single-use invites default to IP-locked unless explicitly disabled.
  const shouldLockToIp = typeof lockToFirstIp === 'boolean'
    ? lockToFirstIp
    : boundedMaxUses === 1;

  const cleanLabel = String(label || '').trim().slice(0, 120);
  const safeLocale = ALLOWED_LOCALES.has(String(locale || '').trim().toLowerCase())
    ? String(locale).trim().toLowerCase()
    : 'ar';

  const rawToken = generateRawInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const encryptedToken = encryptInviteToken(rawToken);
  const tokenPreview = `${rawToken.slice(0, 6)}…${rawToken.slice(-4)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + boundedHours * 60 * 60 * 1000);

  let createdDoc;
  if (isDbReady()) {
    createdDoc = await TeacherInvite.create({
      tokenHash,
      tokenPreview,
      encryptedToken,
      label: cleanLabel,
      locale: safeLocale,
      maxUses: boundedMaxUses,
      usedCount: 0,
      lockToFirstIp: shouldLockToIp,
      boundIpHash: null,
      boundIpMasked: '',
      boundAt: null,
      expiresAt,
      createdBy: new mongoose.Types.ObjectId(String(createdBy)),
      usedBy: [],
    });
  } else if (isMockMode) {
    const id = new mongoose.Types.ObjectId().toString();
    createdDoc = {
      _id: id,
      tokenHash,
      tokenPreview,
      encryptedToken,
      label: cleanLabel,
      locale: safeLocale,
      maxUses: boundedMaxUses,
      usedCount: 0,
      lockToFirstIp: shouldLockToIp,
      boundIpHash: null,
      boundIpMasked: '',
      boundAt: null,
      expiresAt,
      revokedAt: null,
      revokedBy: null,
      createdBy: String(createdBy),
      createdAt: now,
      updatedAt: now,
      usedBy: [],
    };
    mockInvites.set(id, createdDoc);
  } else {
    throw new Error('Database unavailable');
  }

  const { invitePath, inviteUrl } = buildPublicInviteUrl({ rawToken, locale: safeLocale, origin });
  return {
    invite: serializeInviteForAdmin(createdDoc),
    inviteToken: rawToken,
    invitePath,
    inviteUrl,
  };
}

async function listTeacherInvites({ limit = 100 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  if (isDbReady()) {
    const rows = await TeacherInvite.find({})
      .sort({ createdAt: -1 })
      .limit(safeLimit)
      .populate('createdBy', 'name email')
      .populate('revokedBy', 'name')
      .lean();
    return rows.map((row) => serializeInviteForAdmin(row));
  }
  if (isMockMode) {
    return Array.from(mockInvites.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, safeLimit)
      .map((row) => serializeInviteForAdmin(row));
  }
  return [];
}

async function findInviteWithIpHash(tokenHash) {
  if (isDbReady()) {
    const query = TeacherInvite.findOne({ tokenHash });
    const withSelect = typeof query?.select === 'function' ? query.select('+boundIpHash') : query;
    return typeof withSelect?.lean === 'function' ? await withSelect.lean() : await withSelect;
  }
  if (isMockMode) {
    return Array.from(mockInvites.values()).find((item) => item.tokenHash === tokenHash) || null;
  }
  return undefined; // DB unavailable sentinel
}

async function bindFirstIpAtomic(doc, clientIp) {
  const normalizedIp = normalizeClientIp(clientIp);
  const ipHash = hashClientIp(normalizedIp);
  if (!ipHash) {
    return { ok: false, code: 'INVITE_IP_UNAVAILABLE', error: 'Unable to verify your network address for this invitation link.' };
  }
  const masked = maskClientIp(normalizedIp);
  const now = new Date();

  if (isDbReady()) {
    // Atomic first-IP lock: only succeeds if boundIpHash is currently unset/null.
    const locked = await TeacherInvite.findOneAndUpdate(
      {
        _id: doc._id,
        revokedAt: null,
        expiresAt: { $gt: now },
        $or: [{ boundIpHash: null }, { boundIpHash: { $exists: false } }, { boundIpHash: '' }],
      },
      {
        $set: { boundIpHash: ipHash, boundIpMasked: masked, boundAt: now },
      },
      { new: true }
    ).select('+boundIpHash');

    if (locked) {
      return { ok: true, doc: locked.toObject ? locked.toObject() : locked };
    }

    // Another request won the first-bind race; re-read and verify whether it was the same IP.
    const fresh = await TeacherInvite.findById(doc._id).select('+boundIpHash').lean();
    if (fresh?.boundIpHash && timingSafeHexEqual(fresh.boundIpHash, ipHash)) {
      return { ok: true, doc: fresh };
    }
    return {
      ok: false,
      code: 'INVITE_IP_MISMATCH',
      error: 'This temporary invitation link is already locked to another device/network and cannot be shared.',
    };
  }

  if (isMockMode) {
    if (!doc.boundIpHash) {
      doc.boundIpHash = ipHash;
      doc.boundIpMasked = masked;
      doc.boundAt = now;
      return { ok: true, doc };
    }
    if (timingSafeHexEqual(doc.boundIpHash, ipHash)) {
      return { ok: true, doc };
    }
    return {
      ok: false,
      code: 'INVITE_IP_MISMATCH',
      error: 'This temporary invitation link is already locked to another device/network and cannot be shared.',
    };
  }

  return { ok: false, code: 'INVITE_SERVICE_UNAVAILABLE', error: 'Teacher invitation service is unavailable.' };
}

async function validateTeacherInvite(rawToken, { clientIp = '', bindIfUnbound = false } = {}) {
  const clean = sanitizeInviteToken(rawToken);
  if (!clean) {
    return {
      valid: false,
      code: 'INVITE_REQUIRED',
      error: 'A valid temporary invitation link from administration is required to register as a teacher.',
    };
  }

  const tokenHash = hashInviteToken(clean);
  const doc = await findInviteWithIpHash(tokenHash);
  if (doc === undefined) {
    return {
      valid: false,
      code: 'INVITE_SERVICE_UNAVAILABLE',
      error: 'Teacher invitation service is temporarily unavailable.',
    };
  }

  if (!doc) {
    return {
      valid: false,
      code: 'INVITE_INVALID',
      error: 'This teacher invitation link is invalid.',
    };
  }

  const status = computeInviteStatus(doc);
  if (status === 'revoked') {
    return {
      valid: false,
      code: 'INVITE_REVOKED',
      error: 'This teacher invitation link has been revoked by administration.',
    };
  }
  if (status === 'exhausted') {
    return {
      valid: false,
      code: 'INVITE_EXHAUSTED',
      error: 'This teacher invitation link has already reached its usage limit.',
    };
  }
  if (status === 'expired') {
    return {
      valid: false,
      code: 'INVITE_EXPIRED',
      error: 'This teacher invitation link has expired. Please request a new temporary link from administration.',
    };
  }

  let effectiveDoc = doc;
  if (doc.lockToFirstIp !== false) {
    const ipHash = hashClientIp(clientIp);
    if (!doc.boundIpHash) {
      if (bindIfUnbound && ipHash) {
        const bound = await bindFirstIpAtomic(doc, clientIp);
        if (!bound.ok) {
          return { valid: false, code: bound.code, error: bound.error };
        }
        effectiveDoc = bound.doc;
      }
    } else if (!ipHash || !timingSafeHexEqual(doc.boundIpHash, ipHash)) {
      return {
        valid: false,
        code: 'INVITE_IP_MISMATCH',
        error: 'This temporary invitation link is locked to another device/network and cannot be shared.',
      };
    }
  }

  return {
    valid: true,
    code: 'INVITE_VALID',
    invite: {
      id: String(effectiveDoc._id || effectiveDoc.id),
      label: String(effectiveDoc.label || ''),
      locale: effectiveDoc.locale || 'ar',
      expiresAt: effectiveDoc.expiresAt,
      maxUses: Number(effectiveDoc.maxUses || 1),
      usedCount: Number(effectiveDoc.usedCount || 0),
      remainingUses: Math.max(0, Number(effectiveDoc.maxUses || 1) - Number(effectiveDoc.usedCount || 0)),
      lockToFirstIp: effectiveDoc.lockToFirstIp !== false,
      ipBound: Boolean(effectiveDoc.boundIpHash || effectiveDoc.boundAt),
    },
  };
}

async function consumeTeacherInviteAtomic(rawToken, { email = '', name = '', clientIp = '' } = {}) {
  const clean = sanitizeInviteToken(rawToken);
  if (!clean) {
    return { ok: false, code: 'INVITE_REQUIRED', error: 'Teacher invitation link is required.' };
  }

  const tokenHash = hashInviteToken(clean);
  const normalizedIp = normalizeClientIp(clientIp);
  const ipHash = hashClientIp(normalizedIp);
  const ipMasked = maskClientIp(normalizedIp);
  const now = new Date();
  const reservationId = crypto.randomUUID();
  const usageEntry = {
    reservationId,
    email: String(email || '').trim().toLowerCase(),
    name: String(name || '').trim().slice(0, 120),
    usedAt: now,
  };

  if (isDbReady()) {
    const ipFilter = ipHash
      ? {
        $or: [
          { lockToFirstIp: false },
          { boundIpHash: null },
          { boundIpHash: { $exists: false } },
          { boundIpHash: '' },
          { boundIpHash: ipHash },
        ],
      }
      : { lockToFirstIp: false };

    const updateOps = {
      $inc: { usedCount: 1 },
      $push: { usedBy: usageEntry },
    };

    const updated = await TeacherInvite.findOneAndUpdate(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: now },
        $expr: { $lt: ['$usedCount', '$maxUses'] },
        ...ipFilter,
      },
      updateOps,
      { new: true }
    ).select('+boundIpHash');

    if (!updated) {
      const diagnosis = await validateTeacherInvite(clean, { clientIp, bindIfUnbound: false });
      return {
        ok: false,
        code: diagnosis.code || 'INVITE_INVALID',
        error: diagnosis.error || 'Teacher invitation link is no longer valid.',
      };
    }

    if (updated.lockToFirstIp !== false && !updated.boundIpHash && ipHash) {
      await TeacherInvite.updateOne(
        { _id: updated._id, $or: [{ boundIpHash: null }, { boundIpHash: { $exists: false } }, { boundIpHash: '' }] },
        { $set: { boundIpHash: ipHash, boundIpMasked: ipMasked, boundAt: now } }
      ).catch(() => {});
    }

    return {
      ok: true,
      inviteId: String(updated._id),
      reservationId,
    };
  }

  if (isMockMode) {
    const doc = Array.from(mockInvites.values()).find((item) => item.tokenHash === tokenHash);
    if (!doc) return { ok: false, code: 'INVITE_INVALID', error: 'This teacher invitation link is invalid.' };
    const status = computeInviteStatus(doc, now.getTime());
    if (status !== 'active') {
      const diagnosis = await validateTeacherInvite(clean, { clientIp, bindIfUnbound: false });
      return { ok: false, code: diagnosis.code, error: diagnosis.error };
    }
    if (doc.lockToFirstIp !== false) {
      if (!doc.boundIpHash) {
        if (!ipHash) {
          return { ok: false, code: 'INVITE_IP_UNAVAILABLE', error: 'Unable to verify network address.' };
        }
        doc.boundIpHash = ipHash;
        doc.boundIpMasked = ipMasked;
        doc.boundAt = now;
      } else if (!ipHash || !timingSafeHexEqual(doc.boundIpHash, ipHash)) {
        return {
          ok: false,
          code: 'INVITE_IP_MISMATCH',
          error: 'This temporary invitation link is locked to another device/network and cannot be shared.',
        };
      }
    }
    doc.usedCount = Number(doc.usedCount || 0) + 1;
    doc.usedBy = Array.isArray(doc.usedBy) ? [...doc.usedBy, usageEntry] : [usageEntry];
    return {
      ok: true,
      inviteId: String(doc._id),
      reservationId,
    };
  }

  return { ok: false, code: 'INVITE_SERVICE_UNAVAILABLE', error: 'Teacher invitation service is unavailable.' };
}

async function finalizeTeacherInviteUsage({ inviteId, reservationId, userId, teacherId }) {
  if (!inviteId || !reservationId) return;
  if (isDbReady() && mongoose.Types.ObjectId.isValid(String(inviteId))) {
    await TeacherInvite.updateOne(
      { _id: new mongoose.Types.ObjectId(String(inviteId)), 'usedBy.reservationId': reservationId },
      {
        $set: {
          'usedBy.$.user': userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
          'usedBy.$.teacher': teacherId ? new mongoose.Types.ObjectId(String(teacherId)) : undefined,
        },
      }
    ).catch(() => {});
    return;
  }
  if (isMockMode) {
    const doc = mockInvites.get(String(inviteId));
    if (!doc || !Array.isArray(doc.usedBy)) return;
    const entry = doc.usedBy.find((u) => u.reservationId === reservationId);
    if (entry) {
      entry.user = userId ? String(userId) : undefined;
      entry.teacher = teacherId ? String(teacherId) : undefined;
    }
  }
}

async function rollbackTeacherInviteReservation({ inviteId, reservationId }) {
  if (!inviteId || !reservationId) return;
  if (isDbReady() && mongoose.Types.ObjectId.isValid(String(inviteId))) {
    await TeacherInvite.updateOne(
      { _id: new mongoose.Types.ObjectId(String(inviteId)), 'usedBy.reservationId': reservationId, usedCount: { $gt: 0 } },
      {
        $inc: { usedCount: -1 },
        $pull: { usedBy: { reservationId } },
      }
    ).catch(() => {});
    return;
  }
  if (isMockMode) {
    const doc = mockInvites.get(String(inviteId));
    if (!doc || !Array.isArray(doc.usedBy)) return;
    const before = doc.usedBy.length;
    doc.usedBy = doc.usedBy.filter((u) => u.reservationId !== reservationId);
    if (doc.usedBy.length < before && doc.usedCount > 0) {
      doc.usedCount -= 1;
    }
  }
}

async function revealTeacherInviteLink(inviteId, { origin = '' } = {}) {
  const cleanId = String(inviteId || '');
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return { ok: false, status: 400, error: 'Invalid invite ID' };
  }

  let doc = null;
  if (isDbReady()) {
    const query = TeacherInvite.findById(new mongoose.Types.ObjectId(cleanId));
    const withSelect = typeof query?.select === 'function' ? query.select('+encryptedToken') : query;
    doc = typeof withSelect?.lean === 'function' ? await withSelect.lean() : await withSelect;
  } else if (isMockMode) {
    doc = mockInvites.get(cleanId) || null;
  } else {
    return { ok: false, status: 503, error: 'Database unavailable' };
  }

  if (!doc) {
    return { ok: false, status: 404, error: 'Invitation not found' };
  }

  const rawToken = decryptInviteToken(doc.encryptedToken);
  if (!rawToken) {
    return {
      ok: false,
      status: 409,
      code: 'INVITE_LINK_UNAVAILABLE',
      error: 'هذا الرابط أُنشئ قبل تفعيل عرض الروابط المحفوظة — يمكنك إنشاء رابط مؤقت جديد.',
    };
  }

  const { invitePath, inviteUrl } = buildPublicInviteUrl({
    rawToken,
    locale: doc.locale || 'ar',
    origin,
  });

  return {
    ok: true,
    inviteToken: rawToken,
    invitePath,
    inviteUrl,
    status: computeInviteStatus(doc),
  };
}

async function resetTeacherInviteIpLock(inviteId) {
  const cleanId = String(inviteId || '');
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return { ok: false, status: 400, error: 'Invalid invite ID' };
  }
  if (isDbReady()) {
    const updated = await TeacherInvite.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cleanId) },
      { $set: { boundIpHash: null, boundIpMasked: '', boundAt: null } },
      { new: true }
    ).populate('createdBy', 'name email').populate('revokedBy', 'name');
    if (!updated) return { ok: false, status: 404, error: 'Invitation not found' };
    return { ok: true, invite: serializeInviteForAdmin(updated) };
  }
  if (isMockMode) {
    const doc = mockInvites.get(cleanId);
    if (!doc) return { ok: false, status: 404, error: 'Invitation not found' };
    doc.boundIpHash = null;
    doc.boundIpMasked = '';
    doc.boundAt = null;
    return { ok: true, invite: serializeInviteForAdmin(doc) };
  }
  return { ok: false, status: 503, error: 'Database unavailable' };
}

async function revokeTeacherInvite(inviteId, adminUserId) {
  const cleanId = String(inviteId || '');
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return { ok: false, status: 400, error: 'Invalid invite ID' };
  }
  const now = new Date();

  if (isDbReady()) {
    const updated = await TeacherInvite.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(cleanId) },
      { $set: { revokedAt: now, revokedBy: new mongoose.Types.ObjectId(String(adminUserId)) } },
      { new: true }
    ).populate('createdBy', 'name email').populate('revokedBy', 'name');
    if (!updated) return { ok: false, status: 404, error: 'Invitation not found' };
    return { ok: true, invite: serializeInviteForAdmin(updated) };
  }

  if (isMockMode) {
    const doc = mockInvites.get(cleanId);
    if (!doc) return { ok: false, status: 404, error: 'Invitation not found' };
    doc.revokedAt = now;
    doc.revokedBy = String(adminUserId);
    return { ok: true, invite: serializeInviteForAdmin(doc) };
  }

  return { ok: false, status: 503, error: 'Database unavailable' };
}

async function deleteTeacherInvite(inviteId) {
  const cleanId = String(inviteId || '');
  if (!mongoose.Types.ObjectId.isValid(cleanId)) {
    return { ok: false, status: 400, error: 'Invalid invite ID' };
  }
  if (isDbReady()) {
    const deleted = await TeacherInvite.findByIdAndDelete(new mongoose.Types.ObjectId(cleanId));
    if (!deleted) return { ok: false, status: 404, error: 'Invitation not found' };
    return { ok: true };
  }
  if (isMockMode) {
    if (!mockInvites.has(cleanId)) return { ok: false, status: 404, error: 'Invitation not found' };
    mockInvites.delete(cleanId);
    return { ok: true };
  }
  return { ok: false, status: 503, error: 'Database unavailable' };
}

function clearMockInvites() {
  mockInvites.clear();
}

module.exports = {
  MIN_EXPIRES_HOURS,
  MAX_EXPIRES_HOURS,
  MIN_MAX_USES,
  MAX_MAX_USES,
  generateRawInviteToken,
  hashInviteToken,
  sanitizeInviteToken,
  normalizeClientIp,
  extractClientIp,
  hashClientIp,
  maskClientIp,
  computeInviteStatus,
  serializeInviteForAdmin,
  buildPublicInviteUrl,
  createTeacherInvite,
  listTeacherInvites,
  validateTeacherInvite,
  consumeTeacherInviteAtomic,
  finalizeTeacherInviteUsage,
  rollbackTeacherInviteReservation,
  revealTeacherInviteLink,
  resetTeacherInviteIpLock,
  revokeTeacherInvite,
  deleteTeacherInvite,
  clearMockInvites,
};
