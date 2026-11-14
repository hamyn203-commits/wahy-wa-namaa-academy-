'use strict';
const crypto = require('crypto');

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let keyCache = { keys: [], expiresAt: 0 };

async function googleKeys(forceRefresh = false) {
  if (!forceRefresh && Date.now() < keyCache.expiresAt && keyCache.keys.length) return keyCache.keys;
  const response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Google verification unavailable');
  const data = await response.json();
  if (!Array.isArray(data.keys) || !data.keys.length) throw new Error('Invalid Google keys');
  const cacheHeader = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheHeader.match(/max-age=(\d+)/)?.[1] || 900);
  keyCache = { keys: data.keys, expiresAt: Date.now() + Math.min(maxAge, 3600) * 1000 };
  return keyCache.keys;
}

function decodeSegment(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function verifyGoogleCredential(credential, clientId) {
  if (!clientId || typeof credential !== 'string' || credential.length > 12000) {
    throw new Error('Google login is not configured');
  }
  const parts = credential.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google credential');
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = decodeSegment(encodedHeader);
  const payload = decodeSegment(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new Error('Invalid Google credential');
  }
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!audiences.includes(clientId) || (payload.azp && payload.azp !== clientId)
    || !Number.isFinite(payload.exp) || payload.exp <= now
    || !Number.isFinite(payload.iat) || payload.iat > now + 60
    || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Invalid or expired Google credential');
  }
  let key = (await googleKeys(false)).find((item) =>
    item.kid === header.kid && item.kty === 'RSA' && item.use === 'sig');
  if (!key) {
    key = (await googleKeys(true)).find((item) =>
      item.kid === header.kid && item.kty === 'RSA' && item.use === 'sig');
  }
  if (!key) throw new Error('Google key unavailable');
  const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(encodedHeader + '.' + encodedPayload);
  verifier.end();
  if (!verifier.verify(publicKey, Buffer.from(signature, 'base64url'))) {
    throw new Error('Invalid Google signature');
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.email.split('@')[0]).slice(0, 100),
    picture: typeof payload.picture === 'string' ? payload.picture : '',
    hostedDomain: payload.hd || '',
  };
}

module.exports = { verifyGoogleCredential };
