const AdminAuditLog = require('../models/AdminAuditLog');

function safeMetadata(value, depth = 0, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return depth === 0 ? {} : value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toHexString === 'function') return String(value);
  if (seen.has(value)) return '[Circular]';
  if (depth >= 6) return '[MaxDepth]';

  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => safeMetadata(entry, depth + 1, seen));
  }

  const allowed = {};
  for (const [key, item] of Object.entries(value)) {
    if (['reference', 'url', 'token', 'password', 'secret'].some((term) => key.toLowerCase().includes(term))) continue;
    allowed[key] = item && typeof item === 'object' ? safeMetadata(item, depth + 1, seen) : item;
  }
  return allowed;
}

async function logAdminAction({
  req,
  action,
  entityType,
  entityId,
  reason = '',
  metadata = {},
}) {
  if (!req?.user?.id || !action || !entityType || !entityId) return null;

  return AdminAuditLog.create({
    actor: req.user.id,
    action,
    entityType,
    entityId: String(entityId),
    reason: String(reason || '').trim().slice(0, 1000),
    metadata: safeMetadata(metadata),
    request: {
      method: req.method,
      path: req.originalUrl || req.path,
      ip: req.ip,
      userAgent: String(req.get?.('user-agent') || '').slice(0, 300),
    },
  });
}

module.exports = { logAdminAction };
