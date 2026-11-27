const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const TeacherLedger = require('../models/TeacherLedger');
const WithdrawRequest = require('../models/WithdrawRequest');

const MIN_PAYOUT_EGP = 100;
const MIN_PAYOUT_USD = 10;

const inProcessTeacherLocks = new Map();

function createFinanceError(status, publicMessage, code) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  if (code) err.code = code;
  return err;
}

function toMinor(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromMinor(minor) {
  return Math.round(Number(minor) || 0) / 100;
}

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

async function runWithOptionalMongoTransaction(work) {
  if (typeof mongoose.startSession !== 'function' || mongoose.connection.readyState !== 1) {
    if (process.env.NODE_ENV === 'production') {
      throw createFinanceError(503, 'خدمة المعاملات المالية غير متاحة حالياً', 'FINANCE_TRANSACTION_UNAVAILABLE');
    }
    return work(null);
  }
  const dbSession = await mongoose.startSession();
  try {
    let output;
    await dbSession.withTransaction(async () => {
      output = await work(dbSession);
    });
    return output;
  } catch (error) {
    const msg = String(error?.message || '');
    if (
      process.env.NODE_ENV !== 'production'
      && /Transaction numbers are only allowed on a replica set|standalone/i.test(msg)
    ) {
      return work(null);
    }
    throw error;
  } finally {
    await dbSession.endSession();
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

  const minor = {
    EGP: { earned: 0, deducted: 0, pending: 0, withdrawn: 0 },
    USD: { earned: 0, deducted: 0, pending: 0, withdrawn: 0 },
  };

  const canAggregateInDb = (
    mongoose.connection.readyState === 1
    && TeacherLedger.find === mongoose.Model.find
    && typeof TeacherLedger.aggregate === 'function'
    && mongoose.Types.ObjectId.isValid(String(teacherId))
  );

  if (canAggregateInDb) {
    let agg = TeacherLedger.aggregate([
      { $match: { teacher: new mongoose.Types.ObjectId(String(teacherId)) } },
      {
        $group: {
          _id: { currency: '$currency', type: '$type', status: '$status' },
          totalMinor: { $sum: { $round: [{ $multiply: ['$amount', 100] }, 0] } },
        },
      },
    ]);
    if (session && typeof agg.session === 'function') {
      agg = agg.session(session);
    }
    const grouped = await agg;
    for (const row of grouped) {
      const currency = row._id?.currency === 'USD' ? 'USD' : 'EGP';
      const amountMinor = Number(row.totalMinor) || 0;
      const type = row._id?.type;
      const status = row._id?.status;
      if (['session_earning', 'bonus', 'adjustment'].includes(type) && status === 'completed') {
        minor[currency].earned += amountMinor;
      } else if (type === 'deduction' && status === 'completed') {
        minor[currency].deducted += amountMinor;
      } else if (type === 'payout') {
        if (status === 'pending' || status === 'processing') {
          minor[currency].pending += amountMinor;
        } else if (status === 'completed') {
          minor[currency].withdrawn += amountMinor;
        }
      }
    }
  } else {
    const ledgerEntries = await attachSession(TeacherLedger.find({ teacher: teacherId }), session);
    for (const entry of ledgerEntries) {
      const currency = entry.currency === 'USD' ? 'USD' : 'EGP';
      const amountMinor = toMinor(entry.amount);

      if (['session_earning', 'bonus', 'adjustment'].includes(entry.type) && entry.status === 'completed') {
        minor[currency].earned += amountMinor;
      } else if (entry.type === 'deduction' && entry.status === 'completed') {
        minor[currency].deducted += amountMinor;
      } else if (entry.type === 'payout') {
        if (entry.status === 'pending' || entry.status === 'processing') {
          minor[currency].pending += amountMinor;
        } else if (entry.status === 'completed') {
          minor[currency].withdrawn += amountMinor;
        }
      }
    }
  }

  // Legacy-only teachers remain readable if opening migration has not run yet.
  if (
    minor.EGP.earned === 0
    && minor.EGP.deducted === 0
    && minor.EGP.withdrawn === 0
    && minor.EGP.pending === 0
    && teacher.earnings
  ) {
    const legacyEarned = toMinor(teacher.earnings.totalEarned);
    const legacyPending = toMinor(teacher.earnings.pendingEarnings);
    const legacyWithdrawn = toMinor(teacher.earnings.withdrawnEarnings);

    if (legacyEarned > 0 || legacyPending > 0 || legacyWithdrawn > 0) {
      minor.EGP.earned = legacyEarned + legacyPending;
      minor.EGP.withdrawn = legacyWithdrawn;
    }
  }

  const balances = {
    EGP: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
    USD: { available: 0, pending: 0, withdrawn: 0, totalEarned: 0 },
  };

  for (const currency of ['EGP', 'USD']) {
    const netEarnedMinor = Math.max(0, minor[currency].earned - minor[currency].deducted);
    const availableMinor = Math.max(
      0,
      netEarnedMinor - minor[currency].withdrawn - minor[currency].pending
    );
    balances[currency] = {
      totalEarned: fromMinor(netEarnedMinor),
      withdrawn: fromMinor(minor[currency].withdrawn),
      pending: fromMinor(minor[currency].pending),
      available: fromMinor(availableMinor),
    };
  }

  return balances;
}

async function ensureLegacyOpeningEntries(teacherId) {
  const teacher = await Teacher.findById(teacherId).select('earnings');
  if (!teacher?.earnings || teacher.earnings.ledgerMigratedAt) return;

  const existingLedgerEntry = await TeacherLedger.exists({
    teacher: teacherId,
    type: { $in: ['session_earning', 'bonus', 'adjustment', 'deduction', 'payout'] },
  });
  if (existingLedgerEntry) {
    if (typeof Teacher.updateOne === 'function') {
      await Teacher.updateOne(
        { _id: teacherId, 'earnings.ledgerMigratedAt': null },
        { $set: { 'earnings.ledgerMigratedAt': new Date() } },
      ).catch(() => {});
    }
    return;
  }

  const legacyTotal = Number(teacher.earnings.totalEarned) || 0;
  const legacyPending = Number(teacher.earnings.pendingEarnings) || 0;
  const legacyWithdrawn = Number(teacher.earnings.withdrawnEarnings) || 0;
  const openingEarned = fromMinor(Math.max(0, toMinor(legacyTotal) + toMinor(legacyPending)));

  const hasRealDb = Boolean(mongoose.connection?.db);
  const canQueryLegacyWithdrawals = (
    mongoose.connection.readyState === 1
    && typeof WithdrawRequest?.find === 'function'
    && (hasRealDb || WithdrawRequest.find !== mongoose.Model.find)
  );
  const legacyRequests = canQueryLegacyWithdrawals
    ? await WithdrawRequest.find({
        teacher: teacherId,
        status: 'pending',
      }).sort({ createdAt: 1 })
    : [];

  if (openingEarned <= 0 && legacyWithdrawn <= 0 && legacyRequests.length === 0) {
    if (typeof Teacher.updateOne === 'function') {
      await Teacher.updateOne(
        { _id: teacherId },
        { $set: { 'earnings.ledgerMigratedAt': new Date() } },
      ).catch(() => {});
    }
    return;
  }

  const safeOpeningUpsert = async (filter, update) => {
    try {
      const doc = await TeacherLedger.findOneAndUpdate(
        filter,
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return Boolean(doc);
    } catch (error) {
      if (error?.code === 11000) return true;
      throw error;
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
          amount: fromMinor(toMinor(legacyWithdrawn)),
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

  // Migrate any legacy pending WithdrawRequest documents and zero legacy pendingEarnings
  // so legacy balances can never be withdrawn twice.
  for (const wr of legacyRequests) {
    const idempotencyKey = `legacy-withdraw:${wr._id}`;
    const mappedMethod = wr.method === 'bank' ? 'bank_transfer' : (wr.method || 'vodafone_cash');
    const migrated = await safeOpeningUpsert(
      { idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey,
          teacher: teacherId,
          type: 'payout',
          amount: fromMinor(toMinor(wr.amount)),
          currency: 'EGP',
          status: 'pending',
          payoutMethod: mappedMethod,
          payoutDetails: mappedMethod === 'bank_transfer'
            ? { bankName: 'Legacy Bank', bankAccountNumber: String(wr.accountInfo || '').trim() }
            : mappedMethod === 'instapay'
              ? { ipaAddress: String(wr.accountInfo || '').trim() }
              : { phone: String(wr.accountInfo || '').trim() },
          notes: 'legacy-pending-withdrawal',
          description: 'طلب سحب معلّق مرحّل من النظام القديم',
        },
      }
    );
    if (migrated) {
      wr.status = 'rejected';
      wr.adminNote = 'تم ترحيل الطلب إلى دفتر الأستاذ الموحد (TeacherLedger)';
      await wr.save().catch(() => {});
    }
  }

  if (typeof Teacher.updateOne === 'function') {
    if (legacyPending > 0) {
      await Teacher.updateOne(
        { _id: teacherId, 'earnings.pendingEarnings': { $gt: 0 } },
        {
          $inc: { 'earnings.totalEarned': legacyPending },
          $set: {
            'earnings.pendingEarnings': 0,
            'earnings.ledgerMigratedAt': new Date(),
          },
        }
      ).catch(() => {});
    } else {
      await Teacher.updateOne(
        { _id: teacherId },
        { $set: { 'earnings.ledgerMigratedAt': new Date() } },
      ).catch(() => {});
    }
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
  const normalizedAmount = fromMinor(toMinor(amount));
  if (!sessionId || !teacherId || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
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
          notes: String(notes || '').trim().slice(0, 500),
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

function validateAndNormalizePayoutInput({ amount, currency = 'EGP', payoutMethod, payoutDetails, notes }) {
  const numAmount = Number(amount);
  const curr = String(currency || 'EGP').trim().toUpperCase();

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw createFinanceError(400, 'يرجى إدخال مبلغ سحب صحيح', 'INVALID_PAYOUT_AMOUNT');
  }
  if (Math.abs(Math.round(numAmount * 100) - (numAmount * 100)) > 1e-6) {
    throw createFinanceError(400, 'المبلغ يجب ألا يتجاوز منزلتين عشريتين', 'INVALID_PAYOUT_PRECISION');
  }
  const normalizedAmount = fromMinor(toMinor(numAmount));

  if (!['EGP', 'USD'].includes(curr)) {
    throw createFinanceError(400, 'العملة يجب أن تكون EGP أو USD', 'INVALID_PAYOUT_CURRENCY');
  }

  const minAmount = curr === 'USD' ? MIN_PAYOUT_USD : MIN_PAYOUT_EGP;
  if (normalizedAmount < minAmount) {
    throw createFinanceError(
      400,
      `الحد الأدنى لطلب السحب هو ${minAmount} ${curr === 'USD' ? 'دولار' : 'جنيه'}`,
      'PAYOUT_BELOW_MINIMUM'
    );
  }

  const validMethods = ['instapay', 'vodafone_cash', 'bank_transfer', 'paypal'];
  if (!payoutMethod || !validMethods.includes(payoutMethod)) {
    throw createFinanceError(
      400,
      'يرجى اختيار وسيلة سحب صحيحة: instapay, vodafone_cash, bank_transfer, paypal',
      'INVALID_PAYOUT_METHOD'
    );
  }

  if (!payoutDetails || typeof payoutDetails !== 'object') {
    throw createFinanceError(400, 'يرجى إدخال تفاصيل وسيلة السحب', 'INVALID_PAYOUT_DETAILS');
  }

  if (payoutMethod === 'instapay') {
    if (!payoutDetails.ipaAddress && !payoutDetails.phone) {
      throw createFinanceError(400, 'يرجى إدخال عنوان انستاباي (IPA) أو رقم الهاتف المرتبط بـ InstaPay', 'INVALID_PAYOUT_DETAILS');
    }
  } else if (payoutMethod === 'vodafone_cash') {
    const cleanPhone = String(payoutDetails.phone || '').replace(/\s+/g, '');
    if (!cleanPhone || !/^(010|011|012|015)[0-9]{8}$/.test(cleanPhone)) {
      throw createFinanceError(400, 'يرجى إدخال رقم محفظة إلكترونية صحيح مكون من 11 رقماً', 'INVALID_PAYOUT_DETAILS');
    }
  } else if (payoutMethod === 'bank_transfer') {
    if (!payoutDetails.bankAccountNumber || !payoutDetails.bankName) {
      throw createFinanceError(400, 'يرجى إدخال اسم البنك ورقم الحساب البنكي / IBAN', 'INVALID_PAYOUT_DETAILS');
    }
  } else if (payoutMethod === 'paypal') {
    const paypalEmail = String(payoutDetails.paypalEmail || '').trim().toLowerCase();
    if (!paypalEmail || paypalEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(paypalEmail)) {
      throw createFinanceError(400, 'يرجى إدخال بريد إلكتروني صالح لحساب PayPal', 'INVALID_PAYOUT_DETAILS');
    }
  }

  return {
    numAmount: normalizedAmount,
    curr,
    payoutMethod,
    cleanDetails: {
      phone: payoutDetails.phone ? String(payoutDetails.phone).trim().slice(0, 40) : undefined,
      ipaAddress: payoutDetails.ipaAddress ? String(payoutDetails.ipaAddress).trim().slice(0, 120) : undefined,
      bankAccountNumber: payoutDetails.bankAccountNumber ? String(payoutDetails.bankAccountNumber).trim().slice(0, 80) : undefined,
      bankName: payoutDetails.bankName ? String(payoutDetails.bankName).trim().slice(0, 120) : undefined,
      accountHolderName: payoutDetails.accountHolderName ? String(payoutDetails.accountHolderName).trim().slice(0, 120) : undefined,
      paypalEmail: payoutDetails.paypalEmail ? String(payoutDetails.paypalEmail).trim().toLowerCase().slice(0, 254) : undefined,
    },
    cleanNotes: String(notes || '').trim().slice(0, 500),
  };
}

async function requestTeacherPayout({
  teacherId,
  amount,
  currency = 'EGP',
  payoutMethod,
  payoutDetails,
  notes = '',
}) {
  const { numAmount, curr, cleanDetails, cleanNotes } = validateAndNormalizePayoutInput({
    amount,
    currency,
    payoutMethod,
    payoutDetails,
    notes,
  });

  await ensureLegacyOpeningEntries(teacherId);

  try {
    return await withInProcessTeacherLock(teacherId, () =>
      runWithOptionalMongoTransaction(async (dbSession) => {
        if (dbSession && typeof Teacher.updateOne === 'function') {
          await Teacher.updateOne(
            { _id: teacherId },
            { $inc: { ledgerLockVersion: 1 } },
            { session: dbSession }
          );
        }

        const existingPendingQuery = TeacherLedger.findOne({
          teacher: teacherId,
          currency: curr,
          type: 'payout',
          status: { $in: ['pending', 'processing'] },
        }).select('_id');
        if (dbSession && typeof existingPendingQuery?.session === 'function') {
          existingPendingQuery.session(dbSession);
        }
        const existingPending = await existingPendingQuery;
        if (existingPending) {
          throw createFinanceError(
            409,
            'لديك طلب سحب قيد المراجعة بالفعل لهذه العملة',
            'PAYOUT_ALREADY_PENDING'
          );
        }

        const balances = await calculateTeacherBalance(teacherId, { session: dbSession });
        const available = balances?.[curr]?.available || 0;

        if (toMinor(numAmount) > toMinor(available)) {
          throw createFinanceError(
            400,
            `الرصيد المتاح للسحب غير كافٍ. رصيدك الحالي: ${available} ${curr}`,
            'INSUFFICIENT_TEACHER_BALANCE'
          );
        }

        const payoutDoc = {
          teacher: teacherId,
          type: 'payout',
          amount: numAmount,
          currency: curr,
          payoutMethod,
          payoutDetails: cleanDetails,
          status: 'pending',
          notes: cleanNotes,
          description: `طلب سحب أرباح بقيمة ${numAmount} ${curr} عبر ${payoutMethod}`,
        };

        const created = await TeacherLedger.create(
          [payoutDoc],
          dbSession ? { session: dbSession } : undefined
        );
        return Array.isArray(created) ? created[0] : created;
      })
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw createFinanceError(
        409,
        'لديك طلب سحب قيد المراجعة بالفعل لهذه العملة',
        'PAYOUT_ALREADY_PENDING'
      );
    }
    throw error;
  }
}

function validateHttpsReceiptUrl(receiptUrl) {
  if (receiptUrl === undefined || receiptUrl === null || String(receiptUrl).trim() === '') {
    return undefined;
  }
  const trimmed = String(receiptUrl).trim();
  if (trimmed.length > 2048) {
    throw createFinanceError(400, 'رابط الإيصال طويل جداً', 'INVALID_RECEIPT_URL');
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw createFinanceError(400, 'رابط الإيصال يجب أن يكون عنوان HTTPS صالحاً', 'INVALID_RECEIPT_URL');
  }
  if (parsed.protocol !== 'https:') {
    throw createFinanceError(400, 'رابط الإيصال يجب أن يبدأ بـ https:// فقط', 'INVALID_RECEIPT_URL');
  }
  return trimmed;
}

async function processTeacherPayout({
  payoutId,
  targetStatus,
  adminUserId,
  referenceNumber,
  receiptUrl,
  notes,
}) {
  if (!targetStatus || !['processing', 'completed', 'rejected'].includes(targetStatus)) {
    throw createFinanceError(
      400,
      'الحالة المستهدفة غير صحيحة. يجب أن تكون: processing, completed, rejected أو action: approve, reject, processing',
      'INVALID_PAYOUT_STATUS'
    );
  }

  const cleanReceiptUrl = validateHttpsReceiptUrl(receiptUrl);

  const existingPayout = await TeacherLedger.findById(payoutId).populate('teacher');
  if (!existingPayout) {
    throw createFinanceError(404, 'لم يتم العثور على سجل المعاملة', 'PAYOUT_NOT_FOUND');
  }

  if (existingPayout.type !== 'payout') {
    throw createFinanceError(400, 'هذه المعاملة ليست طلب سحب أرباح', 'INVALID_PAYOUT_TYPE');
  }

  if (!['pending', 'processing'].includes(existingPayout.status)) {
    throw createFinanceError(
      409,
      existingPayout.status === 'completed'
        ? 'تم تحويل وسداد هذا الطلب مسبقاً'
        : 'تمت معالجة وإغلاق هذا الطلب مسبقاً',
      'PAYOUT_ALREADY_FINALIZED'
    );
  }

  const teacherId = existingPayout.teacher?._id || existingPayout.teacher;

  return withInProcessTeacherLock(teacherId, () =>
    runWithOptionalMongoTransaction(async (dbSession) => {
      if (dbSession && teacherId && typeof Teacher.updateOne === 'function') {
        await Teacher.updateOne(
          { _id: teacherId },
          { $inc: { ledgerLockVersion: 1 } },
          { session: dbSession }
        );
      }

      const freshPayoutQuery = TeacherLedger.findById(payoutId).populate('teacher');
      if (dbSession && typeof freshPayoutQuery?.session === 'function') {
        freshPayoutQuery.session(dbSession);
      }
      const freshPayout = await freshPayoutQuery;
      if (!freshPayout || !['pending', 'processing'].includes(freshPayout.status)) {
        throw createFinanceError(
          409,
          'تمت معالجة هذا الطلب مسبقاً',
          'PAYOUT_ALREADY_FINALIZED'
        );
      }

      if (targetStatus === 'completed' && teacherId) {
        const balances = await calculateTeacherBalance(teacherId, { session: dbSession });
        const curr = existingPayout.currency === 'USD' ? 'USD' : 'EGP';
        const remainingEarnedMinor = toMinor(balances?.[curr]?.totalEarned || 0) - toMinor(balances?.[curr]?.withdrawn || 0);
        if (toMinor(existingPayout.amount) > remainingEarnedMinor) {
          throw createFinanceError(
            409,
            'رصيد المعلم المستحق لا يكفي لإتمام هذا السحب',
            'INSUFFICIENT_TEACHER_BALANCE'
          );
        }
      }

      const setFields = {
        status: targetStatus,
        processedBy: adminUserId,
        processedAt: new Date(),
      };
      if (referenceNumber !== undefined) setFields.referenceNumber = String(referenceNumber).trim().slice(0, 160);
      if (cleanReceiptUrl !== undefined) setFields.receiptUrl = cleanReceiptUrl;
      if (notes !== undefined) setFields.notes = String(notes).trim().slice(0, 500);

      const updatedQuery = TeacherLedger.findOneAndUpdate(
        {
          _id: payoutId,
          type: 'payout',
          status: { $in: ['pending', 'processing'] },
        },
        { $set: setFields },
        { new: true, ...(dbSession ? { session: dbSession } : {}) }
      ).populate('teacher');

      const updated = await updatedQuery;
      if (!updated) {
        throw createFinanceError(
          409,
          'تمت معالجة هذا الطلب بالتزامن من مشرف آخر',
          'PAYOUT_ALREADY_FINALIZED'
        );
      }

      if (targetStatus === 'completed' && teacherId && updated.currency === 'EGP') {
        await Teacher.findByIdAndUpdate(
          teacherId,
          { $inc: { 'earnings.withdrawnEarnings': updated.amount } },
          dbSession ? { session: dbSession } : undefined
        );
      }

      return updated;
    })
  );
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

  if (type && type !== 'all') filter.type = String(type).trim();
  if (currency && currency !== 'all') filter.currency = String(currency).trim().toUpperCase();
  if (status && status !== 'all') filter.status = String(status).trim();

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(String(startDate));
    if (endDate) filter.createdAt.$lte = new Date(String(endDate));
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

async function recordTeacherDeduction({
  teacherId,
  amount,
  currency = 'EGP',
  reason,
  adminUserId,
  idempotencyKey,
}) {
  const numAmount = Number(amount);
  const curr = String(currency || 'EGP').trim().toUpperCase();
  const cleanReason = String(reason || '').trim().slice(0, 500);

  if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) {
    throw createFinanceError(400, 'معرف المعلم غير صالح', 'INVALID_TEACHER_ID');
  }
  if (!Number.isFinite(numAmount) || numAmount <= 0 || Math.abs(Math.round(numAmount * 100) - (numAmount * 100)) > 1e-6) {
    throw createFinanceError(400, 'مبلغ الخصم غير صالح', 'INVALID_DEDUCTION_AMOUNT');
  }
  if (!['EGP', 'USD'].includes(curr)) {
    throw createFinanceError(400, 'العملة يجب أن تكون EGP أو USD', 'INVALID_DEDUCTION_CURRENCY');
  }
  if (!cleanReason) {
    throw createFinanceError(400, 'سبب القيد العكسي مطلوب', 'DEDUCTION_REASON_REQUIRED');
  }

  const normalizedAmount = fromMinor(toMinor(numAmount));
  const cleanKey = idempotencyKey
    ? `admin-deduction:${String(idempotencyKey).trim().slice(0, 180)}`
    : undefined;

  await ensureLegacyOpeningEntries(teacherId);

  return withInProcessTeacherLock(teacherId, () =>
    runWithOptionalMongoTransaction(async (dbSession) => {
      const teacher = await attachSession(Teacher.findById(teacherId), dbSession);
      if (!teacher) {
        throw createFinanceError(404, 'لم يتم العثور على ملف المعلم', 'TEACHER_NOT_FOUND');
      }

      if (dbSession && typeof Teacher.updateOne === 'function') {
        await Teacher.updateOne(
          { _id: teacherId },
          { $inc: { ledgerLockVersion: 1 } },
          { session: dbSession }
        );
      }

      if (cleanKey) {
        const existing = await attachSession(TeacherLedger.findOne({ idempotencyKey: cleanKey }), dbSession);
        if (existing) return existing;
      }

      const deductionDoc = {
        teacher: teacher._id,
        type: 'deduction',
        amount: normalizedAmount,
        currency: curr,
        status: 'completed',
        processedBy: adminUserId,
        processedAt: new Date(),
        notes: cleanReason,
        description: `خصم إداري: ${cleanReason.slice(0, 120)}`,
        ...(cleanKey ? { idempotencyKey: cleanKey } : {}),
      };

      try {
        const created = await TeacherLedger.create(
          [deductionDoc],
          dbSession ? { session: dbSession } : undefined
        );
        return Array.isArray(created) ? created[0] : created;
      } catch (error) {
        if (error?.code === 11000 && cleanKey) {
          return attachSession(TeacherLedger.findOne({ idempotencyKey: cleanKey }), dbSession);
        }
        throw error;
      }
    })
  );
}

async function recordTeacherBonus({
  teacherId,
  amount,
  currency = 'EGP',
  reason,
  adminUserId,
  idempotencyKey,
}) {
  const numAmount = Number(amount);
  const curr = String(currency || 'EGP').trim().toUpperCase();
  const cleanReason = String(reason || '').trim().slice(0, 500);

  if (!teacherId || !mongoose.Types.ObjectId.isValid(String(teacherId))) {
    throw createFinanceError(400, 'معرف المعلم غير صالح', 'INVALID_TEACHER_ID');
  }
  if (!Number.isFinite(numAmount) || numAmount <= 0 || Math.abs(Math.round(numAmount * 100) - (numAmount * 100)) > 1e-6) {
    throw createFinanceError(400, 'مبلغ المكافأة غير صالح', 'INVALID_BONUS_AMOUNT');
  }
  if (!['EGP', 'USD'].includes(curr)) {
    throw createFinanceError(400, 'العملة يجب أن تكون EGP أو USD', 'INVALID_BONUS_CURRENCY');
  }
  if (!cleanReason) {
    throw createFinanceError(400, 'سبب المكافأة أو التسوية مطلوب', 'BONUS_REASON_REQUIRED');
  }

  const normalizedAmount = fromMinor(toMinor(numAmount));
  const cleanKey = idempotencyKey
    ? `admin-bonus:${String(idempotencyKey).trim().slice(0, 180)}`
    : undefined;

  await ensureLegacyOpeningEntries(teacherId);

  return withInProcessTeacherLock(teacherId, () =>
    runWithOptionalMongoTransaction(async (dbSession) => {
      const teacher = await attachSession(Teacher.findById(teacherId), dbSession);
      if (!teacher) {
        throw createFinanceError(404, 'لم يتم العثور على ملف المعلم', 'TEACHER_NOT_FOUND');
      }

      if (dbSession && typeof Teacher.updateOne === 'function') {
        await Teacher.updateOne(
          { _id: teacherId },
          { $inc: { ledgerLockVersion: 1 } },
          { session: dbSession }
        );
      }

      if (cleanKey) {
        const existing = await attachSession(TeacherLedger.findOne({ idempotencyKey: cleanKey }), dbSession);
        if (existing) return existing;
      }

      const bonusDoc = {
        teacher: teacher._id,
        type: 'bonus',
        amount: normalizedAmount,
        currency: curr,
        status: 'completed',
        processedBy: adminUserId,
        processedAt: new Date(),
        notes: cleanReason,
        description: `مكافأة إدارية: ${cleanReason.slice(0, 120)}`,
        ...(cleanKey ? { idempotencyKey: cleanKey } : {}),
      };

      try {
        const created = await TeacherLedger.create(
          [bonusDoc],
          dbSession ? { session: dbSession } : undefined
        );
        return Array.isArray(created) ? created[0] : created;
      } catch (error) {
        if (error?.code === 11000 && cleanKey) {
          return attachSession(TeacherLedger.findOne({ idempotencyKey: cleanKey }), dbSession);
        }
        throw error;
      }
    })
  );
}

module.exports = {
  MIN_PAYOUT_EGP,
  MIN_PAYOUT_USD,
  toMinor,
  fromMinor,
  createFinanceError,
  validateAndNormalizePayoutInput,
  validateHttpsReceiptUrl,
  withInProcessTeacherLock,
  runWithOptionalMongoTransaction,
  calculateTeacherBalance,
  ensureLegacyOpeningEntries,
  calculateSessionEarning,
  ensureSessionEarning,
  requestTeacherPayout,
  processTeacherPayout,
  recordTeacherDeduction,
  recordTeacherBonus,
  listTeacherTransactions,
};
