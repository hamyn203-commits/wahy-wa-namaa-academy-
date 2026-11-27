'use strict';

const objectStorage = require('../services/objectStorage');

const PRIVATE_FIELDS = [
  'idCard',
  'idCardFront',
  'idCardBack',
  'graduationCertificate',
  'tajweedCertificates',
  'ijazat',
];

const PUBLIC_FIELDS = [
  'profilePhoto',
  'introductionVideo',
  'recitationVideo',
  'teachingMethodVideo',
  'additionalVideos',
  'audioRecordings',
];

function valuesOf(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function collectTeacherAssetReferences(teacher) {
  const assets = [];

  for (const field of PRIVATE_FIELDS) {
    for (const reference of valuesOf(teacher?.documents?.[field])) {
      assets.push({
        field: `documents.${field}`,
        purpose: 'teacher-private',
        reference: String(reference),
      });
    }
  }

  for (const field of PUBLIC_FIELDS) {
    for (const stored of valuesOf(teacher?.media?.[field])) {
      const reference = objectStorage.unwrapPublicProxyReference(stored);
      assets.push({
        field: `media.${field}`,
        purpose: 'teacher-public',
        reference,
      });
    }
  }

  const seen = new Set();
  return assets.filter((asset) => {
    const key = `${asset.purpose}|${asset.reference}`;
    if (!asset.reference || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ownerCandidates(teacher, user) {
  const storedOwners = String(teacher?.storageOwner || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const values = [
    ...storedOwners,
    user?._id,
    user?.id,
    user?.email,
  ];

  return [...new Set(values.filter(Boolean).map((value) => String(value)))];
}

function looksLikeExternalAsset(reference) {
  const value = String(reference || '');
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('uploads/')
  );
}

function resolveOwnedTeacherAssets({ teacher, user, driver = objectStorage.getDriver() }) {
  const candidates = ownerCandidates(teacher, user);
  const assets = collectTeacherAssetReferences(teacher);
  const resolved = [];
  const skipped = [];

  for (const asset of assets) {
    if (!looksLikeExternalAsset(asset.reference)) {
      skipped.push({ ...asset, reason: 'non-external-reference' });
      continue;
    }

    const owner = candidates.find((candidate) => (
      objectStorage.isOwnedObjectReference(
        asset.reference,
        asset.purpose,
        candidate,
        driver
      )
    ));

    if (!owner) {
      const error = new Error(`Unable to prove ownership for ${asset.field}`);
      error.code = 'ASSET_OWNERSHIP_UNRESOLVED';
      error.asset = asset;
      throw error;
    }

    resolved.push({ ...asset, owner });
  }

  return { resolved, skipped };
}

module.exports = {
  PRIVATE_FIELDS,
  PUBLIC_FIELDS,
  collectTeacherAssetReferences,
  ownerCandidates,
  resolveOwnedTeacherAssets,
};
