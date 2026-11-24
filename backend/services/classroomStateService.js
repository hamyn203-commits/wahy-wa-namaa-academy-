'use strict';

const crypto = require('crypto');

const ALLOWED_VEIL_MODES = new Set(['none', 'heads', 'alternating', 'full']);
const ALLOWED_MODALS = new Set(['none', 'metronome', 'makharij', 'qaida', 'ritual']);
const ALLOWED_TEMPOS = new Set(['tahqeeq', 'tadweer', 'hadr']);
const ALLOWED_RITUALS = new Set(['none', 'opening', 'closing', 'sajdah']);
const ALLOWED_GAME_STATUSES = new Set(['idle', 'active', 'revealed']);
const ALLOWED_GAME_MODES = new Set([
  'ayah_puzzle',
  'missing_word',
  'intruder_word',
  'next_ayah',
  'tajweed_hunter',
  'mutashabihat',
]);
const ALLOWED_MISTAKE_TYPES = new Set(['memorization', 'tajweed', 'tashkeel']);
const ALLOWED_WB_MODES = new Set(['ayah', 'tracing', 'miniboards']);
const ALLOWED_WB_PERMISSIONS = new Set(['teacher_only', 'delegated', 'all_miniboards']);
const ALLOWED_PEN_COLORS = new Set(['madd', 'ghunnah', 'qalqalah', 'silent', 'emerald', 'laser']);
const ALLOWED_BOARD_BADGES = new Set(['', 'star', 'retry']);
const ALLOWED_STAGE_TABS = new Set(['mushaf', 'whiteboard', 'games', 'circle', 'video']);
const ALLOWED_MIC_POLICIES = new Set(['open', 'reciter_only', 'locked']);
const ALLOWED_CHAT_MODES = new Set(['teacher_only', 'everyone', 'locked']);

function clampInt(val, min, max, fallback) {
  const parsed = Number.parseInt(val, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanStr(val, maxLen = 120, fallback = '') {
  if (val === undefined || val === null) return fallback;
  return String(val).trim().slice(0, maxLen);
}

function normalizeAnswerText(val) {
  if (Array.isArray(val)) {
    return val.map((w) => cleanStr(w, 80)).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }
  return cleanStr(val, 400).replace(/\s+/g, ' ').trim();
}

function sanitizeSvgPath(d) {
  return String(d || '').replace(/[^ML0-9 .\-]/g, '').trim().slice(0, 650);
}

function normalizeStrokes(rawList, maxItems = 60, now = Date.now()) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const s of rawList) {
    if (!s || typeof s !== 'object') continue;
    const d = sanitizeSvgPath(s.d);
    if (!d) continue;
    const expiresAt = Number(s.expiresAt) || 0;
    if (expiresAt > 0 && expiresAt < now) continue;
    out.push({
      id: cleanStr(s.id, 48, `st_${crypto.randomBytes(4).toString('hex')}`),
      colorKey: ALLOWED_PEN_COLORS.has(s.colorKey) ? s.colorKey : 'emerald',
      width: clampInt(s.width, 2, 14, 4),
      d,
      expiresAt,
      authorId: cleanStr(s.authorId, 64, ''),
    });
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeStamps(rawList, maxItems = 30) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const st of rawList) {
    if (!st || typeof st !== 'object') continue;
    const glyph = cleanStr(st.glyph, 16, '');
    if (!glyph) continue;
    out.push({
      id: cleanStr(st.id, 48, `sp_${crypto.randomBytes(4).toString('hex')}`),
      glyph,
      x: clampInt(st.x, 20, 980, 500),
      y: clampInt(st.y, 20, 580, 300),
      colorKey: ALLOWED_PEN_COLORS.has(st.colorKey) ? st.colorKey : 'madd',
      authorId: cleanStr(st.authorId, 64, ''),
    });
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeClassroomState(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const m = src.mushaf && typeof src.mushaf === 'object' ? src.mushaf : {};
  const t = src.tajweedLab && typeof src.tajweedLab === 'object' ? src.tajweedLab : {};
  const g = src.activeGame && typeof src.activeGame === 'object' ? src.activeGame : {};
  const e = src.engagement && typeof src.engagement === 'object' ? src.engagement : {};
  const wb = src.whiteboard && typeof src.whiteboard === 'object' ? src.whiteboard : {};
  const ctrl = src.controls && typeof src.controls === 'object' ? src.controls : {};
  const now = Date.now();

  const rawBoards = wb.studentBoards && typeof wb.studentBoards === 'object' ? wb.studentBoards : {};
  const studentBoards = {};
  for (const [sid, bVal] of Object.entries(rawBoards).slice(0, 15)) {
    const cleanSid = cleanStr(sid, 64, '');
    if (!cleanSid || cleanSid.startsWith('$') || cleanSid.includes('.') || !bVal || typeof bVal !== 'object') continue;
    studentBoards[cleanSid] = {
      studentId: cleanSid,
      studentName: cleanStr(bVal.studentName, 80, 'طالب'),
      strokes: normalizeStrokes(bVal.strokes, 25, now),
      stamps: normalizeStamps(bVal.stamps, 15),
      badge: ALLOWED_BOARD_BADGES.has(bVal.badge) ? bVal.badge : '',
      updatedAt: Number(bVal.updatedAt) || now,
    };
  }

  const page = clampInt(m.page, 1, 604, 1);
  const visitedRaw = Array.isArray(e.visitedPages) ? e.visitedPages : [page];
  const visitedSet = new Set();
  for (const p of visitedRaw) {
    const validP = clampInt(p, 1, 604, null);
    if (validP) visitedSet.add(validP);
    if (visitedSet.size >= 50) break;
  }
  if (!visitedSet.has(page) && visitedSet.size < 50) {
    visitedSet.add(page);
  }

  const rawStars = e.studentStars && typeof e.studentStars === 'object' ? e.studentStars : {};
  const studentStars = {};
  for (const [k, v] of Object.entries(rawStars).slice(0, 40)) {
    const cleanKey = cleanStr(k, 80);
    if (cleanKey && !cleanKey.startsWith('$') && !cleanKey.includes('.')) {
      studentStars[cleanKey] = clampInt(v, 0, 9999, 0);
    }
  }

  return {
    mushaf: {
      page,
      surahNumber: clampInt(m.surahNumber, 1, 114, 1),
      ayahKey: cleanStr(m.ayahKey, 32, ''),
      wordIndex: clampInt(m.wordIndex, -1, 250, -1),
      wordText: cleanStr(m.wordText, 100, ''),
      spotlightWord: cleanStr(m.spotlightWord, 100, ''),
      hifzVeilMode: ALLOWED_VEIL_MODES.has(m.hifzVeilMode) ? m.hifzVeilMode : 'none',
      peekWordKey: cleanStr(m.peekWordKey, 48, ''),
      peekExpiresAt: Number.isFinite(Number(m.peekExpiresAt)) ? Number(m.peekExpiresAt) : 0,
      allowIndependent: Boolean(m.allowIndependent),
      studentPointer: m.studentPointer && typeof m.studentPointer === 'object' && m.studentPointer.studentId
        ? {
            studentId: cleanStr(m.studentPointer.studentId, 64, ''),
            studentName: cleanStr(m.studentPointer.studentName, 80, 'طالب'),
            page: clampInt(m.studentPointer.page, 1, 604, page),
            ayahKey: cleanStr(m.studentPointer.ayahKey, 32, ''),
            wordIndex: clampInt(m.studentPointer.wordIndex, -1, 250, -1),
            wordText: cleanStr(m.studentPointer.wordText, 100, ''),
            timestamp: Number(m.studentPointer.timestamp) || now,
          }
        : null,
      qariAudio: m.qariAudio && typeof m.qariAudio === 'object'
        ? {
            reciter: cleanStr(m.qariAudio.reciter, 60, 'Husary_Muallim_128kbps'),
            surah: clampInt(m.qariAudio.surah, 1, 114, 1),
            ayah: clampInt(m.qariAudio.ayah, 1, 286, 1),
            repeat: clampInt(m.qariAudio.repeat, 1, 5, 1),
            playing: Boolean(m.qariAudio.playing),
            nonce: clampInt(m.qariAudio.nonce, 0, 1e9, 0),
          }
        : { reciter: 'Husary_Muallim_128kbps', surah: 1, ayah: 1, repeat: 1, playing: false, nonce: 0 },
      pinnedMistakes: Array.isArray(m.pinnedMistakes)
        ? m.pinnedMistakes.slice(0, 40).map((item) => ({
            id: cleanStr(item?.id, 48, crypto.randomBytes(6).toString('hex')),
            surahNumber: clampInt(item?.surahNumber, 1, 114, 1),
            surahName: cleanStr(item?.surahName, 80, ''),
            ayahNumber: clampInt(item?.ayahNumber, 1, 286, 1),
            wordText: cleanStr(item?.wordText, 100, ''),
            type: ALLOWED_MISTAKE_TYPES.has(item?.type) ? item.type : 'tajweed',
            studentId: cleanStr(item?.studentId, 64, ''),
            annotationId: cleanStr(item?.annotationId, 64, ''),
            timestamp: Number(item?.timestamp) || Date.now(),
          }))
        : [],
    },
    tajweedLab: {
      activeModal: ALLOWED_MODALS.has(t.activeModal) ? t.activeModal : 'none',
      metronome: {
        counts: [2, 4, 5, 6].includes(Number(t.metronome?.counts)) ? Number(t.metronome.counts) : 4,
        tempo: ALLOWED_TEMPOS.has(t.metronome?.tempo) ? t.metronome.tempo : 'tadweer',
        active: Boolean(t.metronome?.active),
        nonce: clampInt(t.metronome?.nonce, 0, 1e9, 0),
      },
      selectedLetter: cleanStr(t.selectedLetter, 8, 'ق'),
      qaidaLetter: cleanStr(t.qaidaLetter, 8, 'ب'),
      qaidaHaraka: cleanStr(t.qaidaHaraka, 20, 'fatha'),
      ritualType: ALLOWED_RITUALS.has(t.ritualType) ? t.ritualType : 'none',
    },
    activeGame: {
      roundId: cleanStr(g.roundId, 64, ''),
      status: ALLOWED_GAME_STATUSES.has(g.status) ? g.status : 'idle',
      mode: ALLOWED_GAME_MODES.has(g.mode) ? g.mode : 'missing_word',
      prompt: cleanStr(g.prompt, 500, ''),
      surahName: cleanStr(g.surahName, 80, ''),
      ayahNumber: clampInt(g.ayahNumber, 0, 286, 0),
      words: Array.isArray(g.words)
        ? g.words.slice(0, 30).map((w) => cleanStr(w, 80)).filter(Boolean)
        : [],
      options: Array.isArray(g.options)
        ? g.options.slice(0, 8).map((o) => cleanStr(o, 200)).filter(Boolean)
        : [],
      correctAnswer: normalizeAnswerText(g.correctAnswer),
      explanation: cleanStr(g.explanation, 400, ''),
      durationSec: clampInt(g.durationSec, 10, 120, 25),
      startedAt: Number(g.startedAt) || 0,
      submissions: Array.isArray(g.submissions)
        ? g.submissions.slice(0, 25).map((sub) => ({
            studentId: cleanStr(sub?.studentId, 64, ''),
            studentName: cleanStr(sub?.studentName, 80, 'طالب'),
            answer: normalizeAnswerText(sub?.answer),
            isCorrect: Boolean(sub?.isCorrect),
            timeMs: clampInt(sub?.timeMs, 0, 120000, 0),
            submittedAt: Number(sub?.submittedAt) || Date.now(),
          }))
        : [],
    },
    engagement: {
      totalStars: clampInt(e.totalStars, 0, 99999, 0),
      studentStars,
      lastReaction: e.lastReaction && typeof e.lastReaction === 'object' && e.lastReaction.id
        ? {
            id: cleanStr(e.lastReaction.id, 48, ''),
            badgeKey: cleanStr(e.lastReaction.badgeKey, 40, 'mashallah'),
            label: cleanStr(e.lastReaction.label, 120, 'ما شاء الله تبارك الله'),
            emoji: cleanStr(e.lastReaction.emoji, 16, '🌟'),
            targetName: cleanStr(e.lastReaction.targetName, 80, ''),
            timestamp: Number(e.lastReaction.timestamp) || Date.now(),
          }
        : null,
      activeListenerAlerts: Array.isArray(e.activeListenerAlerts)
        ? e.activeListenerAlerts.slice(0, 20).map((al) => ({
            id: cleanStr(al?.id, 48, ''),
            studentId: cleanStr(al?.studentId, 64, ''),
            studentName: cleanStr(al?.studentName, 80, 'طالب'),
            page: clampInt(al?.page, 1, 604, 1),
            ayahKey: cleanStr(al?.ayahKey, 32, ''),
            timestamp: Number(al?.timestamp) || Date.now(),
          }))
        : [],
      visitedPages: Array.from(visitedSet),
    },
    whiteboard: {
      mode: ALLOWED_WB_MODES.has(wb.mode) ? wb.mode : 'ayah',
      permission: ALLOWED_WB_PERMISSIONS.has(wb.permission) ? wb.permission : 'teacher_only',
      boardsFrozen: Boolean(wb.boardsFrozen),
      delegatedStudentId: cleanStr(wb.delegatedStudentId, 64, ''),
      delegatedStudentName: cleanStr(wb.delegatedStudentName, 80, ''),
      featuredStudentId: cleanStr(wb.featuredStudentId, 64, ''),
      ayahText: cleanStr(wb.ayahText, 400, ''),
      compareText: cleanStr(wb.compareText, 400, ''),
      stripTashkeel: Boolean(wb.stripTashkeel),
      syllableMode: Boolean(wb.syllableMode),
      tracingLetter: cleanStr(wb.tracingLetter, 8, 'ب'),
      strokes: normalizeStrokes(wb.strokes, 60, now),
      stamps: normalizeStamps(wb.stamps, 30),
      studentBoards,
      teleportNonce: clampInt(wb.teleportNonce, 0, 1e9, 0),
    },
    controls: {
      activeStageTab: ALLOWED_STAGE_TABS.has(ctrl.activeStageTab) ? ctrl.activeStageTab : 'mushaf',
      followTeacherTab: ctrl.followTeacherTab !== undefined ? Boolean(ctrl.followTeacherTab) : true,
      micPolicy: ALLOWED_MIC_POLICIES.has(ctrl.micPolicy) ? ctrl.micPolicy : 'open',
      activeReciterUserId: cleanStr(ctrl.activeReciterUserId, 64, ''),
      cameraAllowed: Boolean(ctrl.cameraAllowed),
      chatMode: ALLOWED_CHAT_MODES.has(ctrl.chatMode) ? ctrl.chatMode : 'teacher_only',
      allowHandRaise: ctrl.allowHandRaise !== undefined ? Boolean(ctrl.allowHandRaise) : true,
      studentPointerAllowed: Boolean(ctrl.studentPointerAllowed),
    },
    updatedAtMs: Number(src.updatedAtMs) || 0,
  };
}

function applyHostStatePatch(existingRaw = {}, patch = {}) {
  const next = normalizeClassroomState(existingRaw);
  if (!patch || typeof patch !== 'object') return next;
  const now = Date.now();

  if (patch.mushaf && typeof patch.mushaf === 'object') {
    const pm = patch.mushaf;
    if (pm.page !== undefined) {
      next.mushaf.page = clampInt(pm.page, 1, 604, next.mushaf.page);
      next.mushaf.studentPointer = null;
      if (!next.engagement.visitedPages.includes(next.mushaf.page) && next.engagement.visitedPages.length < 50) {
        next.engagement.visitedPages.push(next.mushaf.page);
      }
    }
    if (pm.surahNumber !== undefined) next.mushaf.surahNumber = clampInt(pm.surahNumber, 1, 114, next.mushaf.surahNumber);
    if (pm.ayahKey !== undefined) next.mushaf.ayahKey = cleanStr(pm.ayahKey, 32, '');
    if (pm.wordIndex !== undefined) next.mushaf.wordIndex = clampInt(pm.wordIndex, -1, 250, -1);
    if (pm.wordText !== undefined) next.mushaf.wordText = cleanStr(pm.wordText, 100, '');
    if (pm.spotlightWord !== undefined) next.mushaf.spotlightWord = cleanStr(pm.spotlightWord, 100, '');
    if (pm.hifzVeilMode !== undefined && ALLOWED_VEIL_MODES.has(pm.hifzVeilMode)) {
      next.mushaf.hifzVeilMode = pm.hifzVeilMode;
    }
    if (pm.peekWordKey !== undefined) {
      const cleanPeek = cleanStr(pm.peekWordKey, 48, '');
      next.mushaf.peekWordKey = cleanPeek;
      next.mushaf.peekExpiresAt = cleanPeek ? now + clampInt(pm.peekDurationMs, 1500, 8000, 3500) : 0;
    }
    if (pm.allowIndependent !== undefined) {
      next.mushaf.allowIndependent = Boolean(pm.allowIndependent);
    }
    if (pm.qariAudio && typeof pm.qariAudio === 'object') {
      next.mushaf.qariAudio = {
        reciter: cleanStr(pm.qariAudio.reciter, 60, next.mushaf.qariAudio.reciter),
        surah: clampInt(pm.qariAudio.surah, 1, 114, next.mushaf.surahNumber),
        ayah: clampInt(pm.qariAudio.ayah, 1, 286, 1),
        repeat: clampInt(pm.qariAudio.repeat, 1, 5, 1),
        playing: Boolean(pm.qariAudio.playing),
        nonce: (next.mushaf.qariAudio.nonce || 0) + 1,
      };
    }
  }

  if (patch.pinnedMistake && typeof patch.pinnedMistake === 'object') {
    const item = patch.pinnedMistake;
    if (ALLOWED_MISTAKE_TYPES.has(item.type)) {
      next.mushaf.pinnedMistakes = [
        {
          id: cleanStr(item.id, 48, crypto.randomBytes(6).toString('hex')),
          surahNumber: clampInt(item.surahNumber, 1, 114, next.mushaf.surahNumber),
          surahName: cleanStr(item.surahName, 80, ''),
          ayahNumber: clampInt(item.ayahNumber, 1, 286, 1),
          wordText: cleanStr(item.wordText, 100, ''),
          type: item.type,
          studentId: cleanStr(item.studentId, 64, ''),
          annotationId: cleanStr(item.annotationId, 64, ''),
          timestamp: now,
        },
        ...next.mushaf.pinnedMistakes,
      ].slice(0, 40);
    }
  }

  if (patch.removeMistakeId) {
    const targetId = cleanStr(patch.removeMistakeId, 64, '');
    next.mushaf.pinnedMistakes = next.mushaf.pinnedMistakes.filter(
      (m) => m.id !== targetId && m.annotationId !== targetId
    );
  }

  if (patch.tajweedLab && typeof patch.tajweedLab === 'object') {
    const pt = patch.tajweedLab;
    if (pt.activeModal !== undefined && ALLOWED_MODALS.has(pt.activeModal)) {
      next.tajweedLab.activeModal = pt.activeModal;
    }
    if (pt.metronome && typeof pt.metronome === 'object') {
      next.tajweedLab.metronome = {
        counts: [2, 4, 5, 6].includes(Number(pt.metronome.counts))
          ? Number(pt.metronome.counts)
          : next.tajweedLab.metronome.counts,
        tempo: ALLOWED_TEMPOS.has(pt.metronome.tempo)
          ? pt.metronome.tempo
          : next.tajweedLab.metronome.tempo,
        active: pt.metronome.active !== undefined ? Boolean(pt.metronome.active) : next.tajweedLab.metronome.active,
        nonce: (next.tajweedLab.metronome.nonce || 0) + 1,
      };
    }
    if (pt.selectedLetter !== undefined) next.tajweedLab.selectedLetter = cleanStr(pt.selectedLetter, 8, 'ق');
    if (pt.qaidaLetter !== undefined) next.tajweedLab.qaidaLetter = cleanStr(pt.qaidaLetter, 8, 'ب');
    if (pt.qaidaHaraka !== undefined) next.tajweedLab.qaidaHaraka = cleanStr(pt.qaidaHaraka, 20, 'fatha');
    if (pt.ritualType !== undefined && ALLOWED_RITUALS.has(pt.ritualType)) {
      next.tajweedLab.ritualType = pt.ritualType;
    }
  }

  if (patch.activeGame && typeof patch.activeGame === 'object') {
    const pg = patch.activeGame;
    if (pg.status === 'idle') {
      next.activeGame.status = 'idle';
      next.activeGame.roundId = '';
      next.activeGame.submissions = [];
    } else if (pg.status === 'revealed') {
      if (next.activeGame.roundId) {
        next.activeGame.status = 'revealed';
      }
    } else if (pg.status === 'active' || pg.roundId) {
      const roundId = cleanStr(pg.roundId, 64, '') || `round_${crypto.randomBytes(6).toString('hex')}`;
      const isNewRound = roundId !== next.activeGame.roundId;
      next.activeGame = {
        roundId,
        status: 'active',
        mode: ALLOWED_GAME_MODES.has(pg.mode) ? pg.mode : 'missing_word',
        prompt: cleanStr(pg.prompt, 500, ''),
        surahName: cleanStr(pg.surahName, 80, ''),
        ayahNumber: clampInt(pg.ayahNumber, 0, 286, 0),
        words: Array.isArray(pg.words)
          ? pg.words.slice(0, 30).map((w) => cleanStr(w, 80)).filter(Boolean)
          : [],
        options: Array.isArray(pg.options)
          ? pg.options.slice(0, 8).map((o) => cleanStr(o, 200)).filter(Boolean)
          : [],
        correctAnswer: normalizeAnswerText(pg.correctAnswer),
        explanation: cleanStr(pg.explanation, 400, ''),
        durationSec: clampInt(pg.durationSec, 10, 120, 25),
        startedAt: isNewRound ? now : (next.activeGame.startedAt || now),
        submissions: isNewRound ? [] : next.activeGame.submissions,
      };
    }
  }

  if (patch.reaction && typeof patch.reaction === 'object') {
    const r = patch.reaction;
    const starsDelta = clampInt(r.starsDelta, 1, 5, 1);
    next.engagement.totalStars = clampInt(next.engagement.totalStars + starsDelta, 0, 99999, 0);
    const targetStudentId = cleanStr(r.targetStudentId, 64, '');
    if (targetStudentId && !targetStudentId.startsWith('$') && !targetStudentId.includes('.')) {
      next.engagement.studentStars[targetStudentId] = clampInt(
        (next.engagement.studentStars[targetStudentId] || 0) + starsDelta,
        0,
        9999,
        0
      );
    }
    next.engagement.lastReaction = {
      id: `rx_${crypto.randomBytes(6).toString('hex')}`,
      badgeKey: cleanStr(r.badgeKey, 40, 'mashallah'),
      label: cleanStr(r.label, 120, 'ما شاء الله تبارك الله'),
      emoji: cleanStr(r.emoji, 16, '🌟'),
      targetName: cleanStr(r.targetName, 80, ''),
      timestamp: now,
    };
  }

  if (patch.rewardListenerAlertId) {
    const alertId = cleanStr(patch.rewardListenerAlertId, 48, '');
    const target = next.engagement.activeListenerAlerts.find((a) => a.id === alertId);
    if (target) {
      next.engagement.totalStars = clampInt(next.engagement.totalStars + 1, 0, 99999, 0);
      if (target.studentId && !target.studentId.startsWith('$') && !target.studentId.includes('.')) {
        next.engagement.studentStars[target.studentId] = clampInt(
          (next.engagement.studentStars[target.studentId] || 0) + 1,
          0,
          9999,
          0
        );
      }
      next.engagement.lastReaction = {
        id: `rx_${crypto.randomBytes(6).toString('hex')}`,
        badgeKey: 'active_listener',
        label: `نجمة المستمع اليقظ — ${target.studentName}`,
        emoji: '🔔',
        targetName: target.studentName,
        timestamp: now,
      };
      next.engagement.activeListenerAlerts = next.engagement.activeListenerAlerts.filter((a) => a.id !== alertId);
    }
  }

  if (patch.clearListenerAlerts) {
    next.engagement.activeListenerAlerts = [];
  }

  if (patch.whiteboard && typeof patch.whiteboard === 'object') {
    const pw = patch.whiteboard;
    if (pw.mode !== undefined && ALLOWED_WB_MODES.has(pw.mode)) next.whiteboard.mode = pw.mode;
    if (pw.permission !== undefined && ALLOWED_WB_PERMISSIONS.has(pw.permission)) {
      next.whiteboard.permission = pw.permission;
    }
    if (pw.boardsFrozen !== undefined) {
      next.whiteboard.boardsFrozen = Boolean(pw.boardsFrozen);
    }
    if (pw.delegatedStudentId !== undefined) {
      next.whiteboard.delegatedStudentId = cleanStr(pw.delegatedStudentId, 64, '');
    }
    if (pw.delegatedStudentName !== undefined) {
      next.whiteboard.delegatedStudentName = cleanStr(pw.delegatedStudentName, 80, '');
    }
    if (pw.featuredStudentId !== undefined) {
      next.whiteboard.featuredStudentId = cleanStr(pw.featuredStudentId, 64, '');
    }
    if (pw.ayahText !== undefined) {
      next.whiteboard.ayahText = cleanStr(pw.ayahText, 400, '');
      if (pw.teleport) {
        next.whiteboard.teleportNonce = (next.whiteboard.teleportNonce || 0) + 1;
      }
    }
    if (pw.compareText !== undefined) next.whiteboard.compareText = cleanStr(pw.compareText, 400, '');
    if (pw.stripTashkeel !== undefined) next.whiteboard.stripTashkeel = Boolean(pw.stripTashkeel);
    if (pw.syllableMode !== undefined) next.whiteboard.syllableMode = Boolean(pw.syllableMode);
    if (pw.tracingLetter !== undefined) next.whiteboard.tracingLetter = cleanStr(pw.tracingLetter, 8, 'ب');

    if (pw.clearMainBoard) {
      next.whiteboard.strokes = [];
      next.whiteboard.stamps = [];
    }
    if (pw.clearStudentBoards) {
      next.whiteboard.studentBoards = {};
      next.whiteboard.featuredStudentId = '';
      next.whiteboard.boardsFrozen = false;
    }
    if (pw.addStroke && typeof pw.addStroke === 'object') {
      const normalized = normalizeStrokes(
        [
          {
            ...pw.addStroke,
            expiresAt: pw.addStroke.colorKey === 'laser' ? now + 3500 : 0,
          },
        ],
        1,
        now
      );
      if (normalized.length > 0) {
        next.whiteboard.strokes = [...next.whiteboard.strokes, normalized[0]].slice(-60);
      }
    }
    if (pw.undoLastStroke) {
      next.whiteboard.strokes = next.whiteboard.strokes.slice(0, -1);
    }
    if (pw.addStamp && typeof pw.addStamp === 'object') {
      const normalized = normalizeStamps([pw.addStamp], 1);
      if (normalized.length > 0) {
        next.whiteboard.stamps = [...next.whiteboard.stamps, normalized[0]].slice(-30);
      }
    }
    if (pw.removeStampId) {
      const sid = cleanStr(pw.removeStampId, 48, '');
      next.whiteboard.stamps = next.whiteboard.stamps.filter((s) => s.id !== sid);
    }
    if (pw.reviewStudentBoard && typeof pw.reviewStudentBoard === 'object') {
      const targetSid = cleanStr(pw.reviewStudentBoard.studentId, 64, '');
      const badge = ALLOWED_BOARD_BADGES.has(pw.reviewStudentBoard.badge) ? pw.reviewStudentBoard.badge : '';
      if (targetSid && next.whiteboard.studentBoards[targetSid]) {
        const prevBadge = next.whiteboard.studentBoards[targetSid].badge;
        next.whiteboard.studentBoards[targetSid].badge = badge;
        if (badge === 'star' && prevBadge !== 'star') {
          next.engagement.totalStars = clampInt(next.engagement.totalStars + 2, 0, 99999, 0);
          next.engagement.studentStars[targetSid] = clampInt(
            (next.engagement.studentStars[targetSid] || 0) + 2,
            0,
            9999,
            0
          );
          next.engagement.lastReaction = {
            id: `rx_${crypto.randomBytes(6).toString('hex')}`,
            badgeKey: 'board_star',
            label: `إتقان رائع على اللوح — ${next.whiteboard.studentBoards[targetSid].studentName}`,
            emoji: '🎨',
            targetName: next.whiteboard.studentBoards[targetSid].studentName,
            timestamp: now,
          };
        }
      }
    }
  }

  if (patch.controls && typeof patch.controls === 'object') {
    const pc = patch.controls;
    if (pc.activeStageTab !== undefined && ALLOWED_STAGE_TABS.has(pc.activeStageTab)) {
      next.controls.activeStageTab = pc.activeStageTab;
    }
    if (pc.followTeacherTab !== undefined) {
      next.controls.followTeacherTab = Boolean(pc.followTeacherTab);
    }
    if (pc.micPolicy !== undefined && ALLOWED_MIC_POLICIES.has(pc.micPolicy)) {
      next.controls.micPolicy = pc.micPolicy;
    }
    if (pc.activeReciterUserId !== undefined) {
      const rawReciter = cleanStr(pc.activeReciterUserId, 64, '');
      next.controls.activeReciterUserId = rawReciter.startsWith('student:')
        ? rawReciter.slice('student:'.length)
        : rawReciter;
    }
    if (pc.cameraAllowed !== undefined) {
      next.controls.cameraAllowed = Boolean(pc.cameraAllowed);
    }
    if (pc.chatMode !== undefined && ALLOWED_CHAT_MODES.has(pc.chatMode)) {
      next.controls.chatMode = pc.chatMode;
    }
    if (pc.allowHandRaise !== undefined) {
      next.controls.allowHandRaise = Boolean(pc.allowHandRaise);
    }
    if (pc.studentPointerAllowed !== undefined) {
      next.controls.studentPointerAllowed = Boolean(pc.studentPointerAllowed);
      if (!next.controls.studentPointerAllowed) {
        next.mushaf.studentPointer = null;
      }
    }
  }

  next.updatedAtMs = now;
  return next;
}

function recordStudentMushafPointer(existingRaw = {}, { studentId, studentName, pointerPayload = {} }) {
  const next = normalizeClassroomState(existingRaw);
  const cleanId = cleanStr(studentId, 64, '');
  if (!cleanId) {
    return { ok: false, status: 400, message: 'Invalid student identifier' };
  }
  if (!next.controls.studentPointerAllowed) {
    return { ok: false, status: 403, message: 'مؤشر الطالب مقفل — يفتحه المعلم فقط عند السؤال' };
  }
  next.mushaf.studentPointer = {
    studentId: cleanId,
    studentName: cleanStr(studentName, 80, 'طالب'),
    page: clampInt(pointerPayload.page, 1, 604, next.mushaf.page),
    ayahKey: cleanStr(pointerPayload.ayahKey, 32, ''),
    wordIndex: clampInt(pointerPayload.wordIndex, -1, 250, -1),
    wordText: cleanStr(pointerPayload.wordText, 100, ''),
    timestamp: Date.now(),
  };
  next.updatedAtMs = Date.now();
  return { ok: true, state: next };
}

function recordStudentWhiteboardAction(existingRaw = {}, { studentId, studentName, actionPayload = {} }) {
  const next = normalizeClassroomState(existingRaw);
  const cleanId = cleanStr(studentId, 64, '');
  if (!cleanId || cleanId.startsWith('$') || cleanId.includes('.')) {
    return { ok: false, status: 400, message: 'Invalid student identifier' };
  }
  if (next.whiteboard.boardsFrozen) {
    return { ok: false, status: 423, message: 'قام المعلم بتجميد الألواح للمراجعة والتصحيح' };
  }
  const now = Date.now();
  const perm = next.whiteboard.permission;

  if (perm === 'delegated' && next.whiteboard.delegatedStudentId === cleanId) {
    if (actionPayload.addStroke) {
      const normalized = normalizeStrokes(
        [{ ...actionPayload.addStroke, authorId: cleanId, expiresAt: actionPayload.addStroke.colorKey === 'laser' ? now + 3500 : 0 }],
        1,
        now
      );
      if (normalized.length > 0) {
        next.whiteboard.strokes = [...next.whiteboard.strokes, normalized[0]].slice(-60);
      }
    }
    if (actionPayload.addStamp) {
      const normalized = normalizeStamps([{ ...actionPayload.addStamp, authorId: cleanId }], 1);
      if (normalized.length > 0) {
        next.whiteboard.stamps = [...next.whiteboard.stamps, normalized[0]].slice(-30);
      }
    }
    if (actionPayload.clearMine) {
      next.whiteboard.strokes = next.whiteboard.strokes.filter((s) => s.authorId !== cleanId);
      next.whiteboard.stamps = next.whiteboard.stamps.filter((s) => s.authorId !== cleanId);
    }
    next.updatedAtMs = now;
    return { ok: true, state: next };
  }

  if (perm === 'all_miniboards') {
    const currentBoard = next.whiteboard.studentBoards[cleanId] || {
      studentId: cleanId,
      studentName: cleanStr(studentName, 80, 'طالب'),
      strokes: [],
      stamps: [],
      badge: '',
      updatedAt: now,
    };
    currentBoard.studentName = cleanStr(studentName, 80, currentBoard.studentName);
    if (actionPayload.clearMine) {
      currentBoard.strokes = [];
      currentBoard.stamps = [];
      currentBoard.badge = '';
    }
    if (actionPayload.addStroke) {
      const normalized = normalizeStrokes([{ ...actionPayload.addStroke, authorId: cleanId }], 1, now);
      if (normalized.length > 0) {
        currentBoard.strokes = [...currentBoard.strokes, normalized[0]].slice(-25);
      }
    }
    if (actionPayload.addStamp) {
      const normalized = normalizeStamps([{ ...actionPayload.addStamp, authorId: cleanId }], 1);
      if (normalized.length > 0) {
        currentBoard.stamps = [...currentBoard.stamps, normalized[0]].slice(-15);
      }
    }
    currentBoard.updatedAt = now;
    next.whiteboard.studentBoards[cleanId] = currentBoard;
    next.updatedAtMs = now;
    return { ok: true, state: next };
  }

  return { ok: false, status: 403, message: 'الكتابة على السبورة متاحة للمعلم حالياً' };
}

function recordStudentGameAnswer(existingRaw = {}, { studentId, studentName, answer }) {
  const next = normalizeClassroomState(existingRaw);
  const cleanId = cleanStr(studentId, 64, '');
  if (!cleanId) {
    return { ok: false, status: 400, message: 'Invalid student identifier' };
  }
  if (next.activeGame.status !== 'active' || !next.activeGame.roundId) {
    return { ok: false, status: 400, message: 'لا توجد جولة تحدي نشطة حالياً' };
  }
  if (next.activeGame.submissions.some((s) => s.studentId === cleanId)) {
    return { ok: false, status: 409, message: 'تم إرسال إجابتك لهذه الجولة بالفعل' };
  }

  const normalizedSubmitted = normalizeAnswerText(answer);
  if (!normalizedSubmitted) {
    return { ok: false, status: 400, message: 'الإجابة مطلوبة' };
  }

  const now = Date.now();
  const isCorrect = normalizedSubmitted === next.activeGame.correctAnswer;
  const hadAnyCorrectBefore = next.activeGame.submissions.some((s) => s.isCorrect);
  const starsAwarded = isCorrect ? (hadAnyCorrectBefore ? 2 : 3) : 0;

  const submission = {
    studentId: cleanId,
    studentName: cleanStr(studentName, 80, 'طالب'),
    answer: normalizedSubmitted,
    isCorrect,
    timeMs: clampInt(now - (next.activeGame.startedAt || now), 0, 120000, 0),
    submittedAt: now,
  };

  next.activeGame.submissions = [...next.activeGame.submissions, submission].slice(0, 25);
  if (starsAwarded > 0) {
    next.engagement.totalStars = clampInt(next.engagement.totalStars + starsAwarded, 0, 99999, 0);
    next.engagement.studentStars[cleanId] = clampInt(
      (next.engagement.studentStars[cleanId] || 0) + starsAwarded,
      0,
      9999,
      0
    );
  }
  next.updatedAtMs = now;

  return {
    ok: true,
    state: next,
    submission: {
      isCorrect,
      starsAwarded,
      timeMs: submission.timeMs,
    },
  };
}

function recordActiveListenerBell(existingRaw = {}, { studentId, studentName, page, ayahKey }) {
  const next = normalizeClassroomState(existingRaw);
  const cleanId = cleanStr(studentId, 64, '');
  if (!cleanId) {
    return { ok: false, status: 400, message: 'Invalid student identifier' };
  }
  const now = Date.now();
  const recentFromSame = next.engagement.activeListenerAlerts.find(
    (a) => a.studentId === cleanId && now - (a.timestamp || 0) < 12000
  );
  if (recentFromSame) {
    return { ok: false, status: 429, message: 'تم إرسال تنبيهك للمعلم بالفعل، انتظر قليلاً' };
  }

  const alertEntry = {
    id: `bell_${crypto.randomBytes(5).toString('hex')}`,
    studentId: cleanId,
    studentName: cleanStr(studentName, 80, 'طالب'),
    page: clampInt(page, 1, 604, next.mushaf.page),
    ayahKey: cleanStr(ayahKey, 32, next.mushaf.ayahKey),
    timestamp: now,
  };

  next.engagement.activeListenerAlerts = [alertEntry, ...next.engagement.activeListenerAlerts].slice(0, 20);
  next.updatedAtMs = now;
  return { ok: true, state: next, alert: alertEntry };
}

function presentClassroomState(raw = {}, { isHost = false, viewerUserId = '' } = {}) {
  const state = normalizeClassroomState(raw);
  const viewerIdStr = cleanStr(viewerUserId, 64, '');

  // Redact activeListenerAlerts for non-hosts so students don't distract the reciter
  if (!isHost) {
    state.engagement.activeListenerAlerts = state.engagement.activeListenerAlerts.filter(
      (a) => a.studentId === viewerIdStr
    );
  }

  // Anti-cheat: while a game round is actively running, hide correctAnswer & others' answers from non-hosts
  if (!isHost && state.activeGame.status === 'active') {
    state.activeGame = {
      ...state.activeGame,
      correctAnswer: '',
      explanation: '',
      submissions: state.activeGame.submissions.map((sub) =>
        sub.studentId === viewerIdStr
          ? sub
          : {
              studentId: sub.studentId,
              studentName: sub.studentName,
              answer: '',
              isCorrect: false,
              timeMs: sub.timeMs,
              submittedAt: sub.submittedAt,
            }
      ),
    };
  }

  // Isolate individual student mini-boards for non-hosts (only own board + teacher-featured board)
  if (!isHost && state.whiteboard?.studentBoards) {
    const featuredId = state.whiteboard.featuredStudentId;
    const filteredBoards = {};
    if (viewerIdStr && state.whiteboard.studentBoards[viewerIdStr]) {
      filteredBoards[viewerIdStr] = state.whiteboard.studentBoards[viewerIdStr];
    }
    if (featuredId && state.whiteboard.studentBoards[featuredId]) {
      filteredBoards[featuredId] = state.whiteboard.studentBoards[featuredId];
    }
    state.whiteboard = {
      ...state.whiteboard,
      studentBoards: filteredBoards,
    };
  }

  return state;
}

module.exports = {
  normalizeClassroomState,
  applyHostStatePatch,
  recordStudentGameAnswer,
  recordActiveListenerBell,
  recordStudentWhiteboardAction,
  recordStudentMushafPointer,
  presentClassroomState,
};
