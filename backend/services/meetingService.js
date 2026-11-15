const crypto = require('crypto');

function isValidConfiguredZoomBase(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getAllowedProviders() {
  return isValidConfiguredZoomBase(process.env.ZOOM_MEETING_BASE_URL)
    ? ['livekit', 'zoom']
    : ['livekit'];
}

const PROVIDERS = getAllowedProviders();

function randomRoomToken() {
  return crypto.randomBytes(16).toString('hex');
}

function generateLiveKitLink(sessionId) {
  const safeId = sessionId ? String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '') : randomRoomToken();
  const room = `session_${safeId}`;
  return {
    provider: 'livekit',
    url: `/live/${room}`,
    room,
    instructions: {
      ar: 'انضم لقاعة الأكاديمية المباشرة المؤمنة',
      en: 'Join the safeguarded academy live classroom',
    },
  };
}

function generateZoomLink(sessionId) {
  const base = process.env.ZOOM_MEETING_BASE_URL;
  if (isValidConfiguredZoomBase(base)) {
    return {
      provider: 'zoom',
      url: `${base.trim().replace(/\/$/, '')}/${randomRoomToken()}`,
      instructions: { ar: 'انضم عبر Zoom', en: 'Join via Zoom' },
    };
  }
  return generateLiveKitLink(sessionId);
}

function generateMeetingLink(sessionId, provider = 'livekit') {
  const allowed = getAllowedProviders();
  const p = allowed.includes(provider) ? provider : 'livekit';
  if (p === 'zoom') return generateZoomLink(sessionId);
  return generateLiveKitLink(sessionId);
}

function attachToSession(session, provider) {
  const meeting = generateMeetingLink(session._id, provider || process.env.DEFAULT_MEETING_PROVIDER || 'livekit');
  session.meetingLink = meeting.url;
  session.meetingProvider = meeting.provider;
  return meeting;
}

module.exports = {
  get PROVIDERS() {
    return getAllowedProviders();
  },
  generateLiveKitLink,
  generateMeetingLink,
  attachToSession,
};
