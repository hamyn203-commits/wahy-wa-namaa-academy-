'use strict';

const crypto = require('crypto');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

function isRealtimeConfigured() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

function roomNameForUser(userId) {
  return `notify_${String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function httpLiveKitUrl() {
  if (LIVEKIT_URL.startsWith('wss://')) return 'https://' + LIVEKIT_URL.slice(6);
  if (LIVEKIT_URL.startsWith('ws://')) return 'http://' + LIVEKIT_URL.slice(5);
  return LIVEKIT_URL;
}

async function createUserRealtimeToken(userId) {
  if (!isRealtimeConfigured()) return null;

  const cleanUserId = String(userId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanUserId) return null;
  const roomName = roomNameForUser(cleanUserId);
  const identity = `notify:${cleanUserId}`;
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: 'notifications',
    ttl: '15m',
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
  });

  return {
    token: await token.toJwt(),
    url: LIVEKIT_URL,
    roomName,
  };
}

async function publishRealtimeNotification(userId, payload) {
  if (!isRealtimeConfigured() || !userId) return false;

  try {
    const client = new RoomServiceClient(httpLiveKitUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const roomName = roomNameForUser(userId);
    const data = Buffer.from(JSON.stringify(payload || {}), 'utf8');

    // 0 = RELIABLE in LiveKit DataPacket.Kind.
    await client.sendData(roomName, data, 0, { topic: 'notifications' });
    return true;
  } catch (error) {
    // A user can be offline, in which case the LiveKit room may not exist.
    // The persisted Mongo notification remains the source of truth.
    if (!/room.*not found/i.test(String(error?.message || ''))) {
      console.warn('Realtime notification delivery failed:', error.message);
    }
    return false;
  }
}

module.exports = {
  isRealtimeConfigured,
  roomNameForUser,
  createUserRealtimeToken,
  publishRealtimeNotification,
};
