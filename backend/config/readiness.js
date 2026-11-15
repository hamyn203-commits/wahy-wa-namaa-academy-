const objectStorage = require('../services/objectStorage');
const { isWeakProductionSecret } = require('../middleware/auth');

function hasValue(name) {
  return Boolean(String(process.env[name] || '').trim());
}

function hasStrongSecret(name) {
  const val = String(process.env[name] || '').trim();
  if (!val) return false;
  if (process.env.NODE_ENV === 'production') {
    return !isWeakProductionSecret(val);
  }
  return true;
}

function hasAny(names) {
  return names.some(hasValue);
}

function isValidHttpUrl(name) {
  if (!hasValue(name)) return false;
  try {
    const url = new URL(process.env[name]);
    if (process.env.NODE_ENV === 'production') {
      return url.protocol === 'https:';
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getConfigurationReadiness() {
  const databaseConfigured = hasAny(['MONGODB_URI', 'MONGODB_URL']);
  const distinctJwtSecrets = String(process.env.JWT_SECRET || '').trim() !== String(process.env.JWT_REFRESH_SECRET || '').trim();
  const authConfigured = hasStrongSecret('JWT_SECRET') && hasStrongSecret('JWT_REFRESH_SECRET') && distinctJwtSecrets;
  const runtimeConfigured = process.env.NODE_ENV === 'production';
  const urlsConfigured = ['FRONTEND_URL', 'SITE_URL', 'API_PUBLIC_URL'].every(isValidHttpUrl);
  const corsConfigured = hasValue('ALLOWED_ORIGINS');

  const storageDriver = objectStorage.getDriver();
  const externalStorageRequired = process.env.FILE_STORAGE_DRIVER === 'external';
  const storageConfigured = externalStorageRequired
    ? ['vercel-blob', 's3'].includes(storageDriver)
    : objectStorage.isConfigured();

  const externalSchedulerRequired = Boolean(process.env.VERCEL)
    || process.env.ENABLE_IN_PROCESS_SCHEDULER === 'false';
  const schedulerConfigured = !externalSchedulerRequired || hasStrongSecret('CRON_SECRET');

  const missingConfiguration = [];
  if (!runtimeConfigured) missingConfiguration.push('NODE_ENV=production');
  if (!databaseConfigured) missingConfiguration.push('MONGODB_URI|MONGODB_URL');
  if (!authConfigured) missingConfiguration.push('JWT_SECRET+JWT_REFRESH_SECRET');
  if (!urlsConfigured) missingConfiguration.push('FRONTEND_URL+SITE_URL+API_PUBLIC_URL');
  if (!corsConfigured) missingConfiguration.push('ALLOWED_ORIGINS');
  if (!storageConfigured) {
    missingConfiguration.push(
      externalStorageRequired
        ? 'external object storage (BLOB_READ_WRITE_TOKEN or S3 credentials)'
        : 'FILE_STORAGE_DRIVER'
    );
  }
  if (!schedulerConfigured) missingConfiguration.push('CRON_SECRET');

  return {
    configurationReady: missingConfiguration.length === 0,
    databaseConfigured,
    authConfigured,
    runtimeConfigured,
    urlsConfigured,
    corsConfigured,
    schedulerConfigured,
    storageConfigured,
    storageDriver,
    missingConfiguration,
  };
}

module.exports = { getConfigurationReadiness };
