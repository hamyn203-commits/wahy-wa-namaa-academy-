const crypto = require('crypto');

const PROVIDERS = ['jitsi', 'google_meet', 'zoom'];

function randomRoomToken() {
  return crypto.randomBytes(16).toString('hex');
}

function generateJitsiLink(_sessionId, roomName) {
  const room = roomName || `wahy-namaa-${randomRoomToken()}`;
  return {
    provider: 'jitsi',
    url: `https://meet.jit.si/${room}`,
    room,
    instructions: {
      ar: 'انضم للحصة عبر الرابط — لا يحتاج تسجيل',
      en: 'Join via link — no signup required',
    },
  };
}

function generateZoomLink() {
  const base = process.env.ZOOM_MEETING_BASE_URL;
  if (base) {
    return {
      provider: 'zoom',
      url: `${base.replace(/\/$/, '')}/${randomRoomToken()}`,
      instructions: { ar: 'انضم عبر Zoom', en: 'Join via Zoom' },
    };
  }
  const demoId = `${100000000 + crypto.randomInt(0, 899999999)}`;
  return {
    provider: 'zoom',
    url: `https://zoom.us/j/${demoId}`,
    instructions: {
      ar: 'رابط Zoom تجريبي — اضبط ZOOM_MEETING_BASE_URL للإنتاج',
      en: 'Demo Zoom link — set ZOOM_MEETING_BASE_URL for production',
    },
  };
}

function generateGoogleMeetLink() {
  const custom = process.env.GOOGLE_MEET_BASE_URL;
  if (custom) {
    return {
      provider: 'google_meet',
      url: custom,
      instructions: { ar: 'انضم عبر Google Meet', en: 'Join via Google Meet' },
    };
  }
  return {
    provider: 'google_meet',
    url: `https://meet.jit.si/wahy-namaa-gmeet-${randomRoomToken()}`,
    instructions: {
      ar: 'جلسة عبر Jitsi (بديل Meet) — اضبط GOOGLE_MEET_BASE_URL لرابط Meet حقيقي',
      en: 'Jitsi fallback — set GOOGLE_MEET_BASE_URL for real Meet links',
    },
  };
}

function generateMeetingLink(sessionId, provider = 'jitsi') {
  const p = PROVIDERS.includes(provider) ? provider : 'jitsi';
  if (p === 'zoom') return generateZoomLink(sessionId);
  if (p === 'google_meet') return generateGoogleMeetLink(sessionId);
  return generateJitsiLink(sessionId);
}

function attachToSession(session, provider) {
  const meeting = generateMeetingLink(session._id, provider || process.env.DEFAULT_MEETING_PROVIDER || 'jitsi');
  session.meetingLink = meeting.url;
  session.meetingProvider = meeting.provider;
  return meeting;
}

module.exports = {
  PROVIDERS,
  generateMeetingLink,
  attachToSession,
};
