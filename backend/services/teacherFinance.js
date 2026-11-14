const Teacher = require('../models/Teacher');
const TeacherLedger = require('../models/TeacherLedger');

const MIN_PAYOUT_EGP = 100;
const MIN_PAYOUT_USD = 10;

const inProcessTeacherLocks = new Map();

async function withInProcessTeacherLock(teacherId, work) {
  const key = String(teacherId);
  const previous = inProcessTeacherLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current, () => current);
  inProcessTeacherLocks.set(key, chained);

  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
    if (inProcessTeacherLocks.get(key) === chained) {
      inProcessTeacherLocks.delete(key);
    }
  }
}

function attachSession(query, session) {
  if (session && query && typeof query.session === 'function') {
    return query.session(session);
  }
  return query;
}

function calculateSessionEarning(hourlyRate = 50, durationMinutes = 60) {
  const rate = Number(hourlyRate);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Invalid session earning inputs');
  }
  return Math.round((rate * duration / 60) * 100) / 100;
}

async function calculateTeacherBalance(teacherId, { session = null } = {}) {
  const teacher = await attachSession(Teacher.findById(teacherId), session);
  if (!teacher) return null;

  if (!session) {
    await ensureLegacyOpeningEntries(teacherId);
  }
  const ledgerEntries = await attachSession(TeacherLedger.find({ teacher: teacherId }), session);

  const balances = {
    EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
    USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
  };

  for (const entry of ledgerEntries) {
    const currency = entry.currency === 'USD' ? 'USD' : 'EGP';
    const amount = Number(entry.amount) || 0;

    if (['session_earning', 'bonus', 'adjustment'].includes(entry.type) && entry.status === 'completed') {
      balances[currency].totalEarned += amount;
    }

    if (entry.type === 'payout') {
      if (entry.status === 'pending' || entry.status === 'processing') {
        balances[currency].pending += amount;
      } else if (entry.status === 'completed') {
        balances[currency].withdrawn += amount;
      }
    }
  }

  // Legacy-only teachers remain readable during the migration window.
  if (balances.EGP.totalEarned === 0 && balances.EGP.withdrawn === 0 && teacher.earnings) {
    const legacyEarned = Number(teacher.earnings.totalEarned) || 0;
    const legacyPending = Number(teacher.earnings.pendingEarnings) || 0;
    const legacyWithdrawn = Number(teacher.earnings.withdrawnEarnings) || 0;

    if (legacyEarned > 0 || legacyPending > 0 || legacyWithdrawn > 0) {
      balances.EGP.totalEarned = legacyEarned + legacyPending;
      balances.EGP.withdrawn = legacyWithdrawn;
    }
  }

  for (const currency of ['EGP', 'USD']) {
    balances[currency].available = Math.max(
      0,
      balances[currency].totalEarned - balances[currency].withdrawn - balances[currency].pending,
    );
  }

  return balances;
}

async function ensureLegacyOpeningEntries(teacherId) {
  const teacher = await Teacher.findById(teacherId).select('earnings');
  if (!teacher?.earnings) return;

  const existingNonMigrationEntry = await TeacherLedger.exists({
    teacher: teacherId,
    idempotencyKey: { $exists: false },
    type: { $in: ['session_earning', 'bonus', 'adjustment', 'payout'] },
  });
  if (existingNonMigrationEntry) return;

  const legacyTotal = Number(teacher.earnings.totalEarned) || 0;
  const legacyPending = Number(teacher.earnings.pendingEarnings) || 0;
  const legacyWithdrawn = Number(teacher.earnings.withdrawnEarnings) || 0;
  const openingEarned = Math.max(0, legacyTotal + legacyPending);

  const safeOpeningUpsert = async (filter, update) => {
    try {
      await TeacherLedger.findOneAndUpdate(
        filter,
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // Another concurrent request created the same idempotency key first.
    }
  };

  if (openingEarned > 0) {
    const idempotencyKey = `legacy-opening:${teacherId}:earned`;
    await safeOpeningUpsert(
      { idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey,
          teacher: teacherId,
          type: 'adjustment',
          amount: openingEarned,
          currency: 'EGP',
          status: 'completed',
          notes: 'legacy-opening-balance',
          description: 'رصيد افتتاحي مرحّل من نظام مستحقات المعلم القديم',
        },
      },
    );
  }

  if (legacyWithdrawn > 0) {
    const idempotencyKey = `legacy-opening:${teacherId}:withdrawn`;
    await safeOpeningUpsert(
      { idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey,
          teacher: teacherId,
          type: 'payout',
          amount: legacyWithdrawn,
          currency: 'EGP',
          status: 'completed',
          payoutMethod: 'bank_transfer',
          notes: 'legacy-opening-withdrawn',
          description: 'مسحوبات تاريخية مرحّلة من النظام القديم',
          processedAt: new Date(),
        },
      },
    );
  }
}

async function ensureSessionEarning({
  sessionId,
  teacherId,
  amount,
  currency = 'EGP',
  attendeesCount = 1,
  notes = '',
}) {
  const normalizedAmount = Number(amount);
  if (!sessionId || !teacherId || !Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    throw new Error('Invalid teacher earning payload');
  }

  await ensureLegacyOpeningEntries(teacherId);

  const idempotencyKey = `session:${sessionId}:earning`;

  try {
    return await TeacherLedger.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey,
          teacher: teacherId,
          session: sessionId,
          type: 'session_earning',
          amount: normalizedAmount,
          currency: currency === 'USD' ? 'USD' : 'EGP',
          attendeesCount: Math.max(0, Number(attendeesCount) || 0),
          status: 'completed',
          notes,
          description: `مستحقات حصة تعليمية - ${normalizedAmount} ${currency === 'USD' ? 'USD' : 'EGP'}`,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    return TeacherLedger.findOne({ idempotencyKey });
  }
}

async function listTeacherTransactions(teacherId, {
  type,
  currency,
  status,
  startDate,
  endDate,
  page = 1,
  limit = 20,
} = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const filter = { teacher: teacherId };

  if (type && type !== 'all') filter.type = type;
  if (currency && currency !== 'all') filter.currency = String(currency).toUpperCase();
  if (status && status !== 'all') filter.status = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const [transactions, total] = await Promise.all([
    TeacherLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('session', 'scheduledAt duration type student')
      .lean(),
    TeacherLedger.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

module.exports = {
  MIN_PAYOUT_EGP,
  MIN_PAYOUT_USD,
  withInProcessTeacherLock,
  calculateTeacherBalance,
  ensureLegacyOpeningEntries,
  calculateSessionEarning,
  ensureSessionEarning,
  listTeacherTransactions,
};
