const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { connectDB } = require('../config/database');
const { checkUpcomingSessions } = require('../services/scheduler');

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a || '')).digest();
  const right = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(left, right);
}

async function handleRemindersCron(req, res) {
  const secret = process.env.CRON_SECRET;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!secret || !supplied || !safeEqual(secret, supplied)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const connected = await connectDB();
    if (!connected) return res.status(503).json({ error: 'Database unavailable' });

    const summary = await checkUpcomingSessions();
    return res.json({ success: true, ranAt: new Date().toISOString(), summary });
  } catch (error) {
    console.error('Reminder cron failed:', error.message);
    return res.status(500).json({ error: 'Reminder job failed' });
  }
}

router.get('/reminders', handleRemindersCron);
router.post('/reminders', handleRemindersCron);
router.get('/session-reminders', handleRemindersCron);
router.post('/session-reminders', handleRemindersCron);

module.exports = router;
