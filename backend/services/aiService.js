const RecitationReport = require('../models/RecitationReport');

const SYSTEM_QURAN = 'You are an Islamic education assistant for Wahy Wa Namaa Academy. Answer in the user language with authentic sources. Be concise and practical.';
const ALLOWED_LOCALES = new Set(['ar', 'en', 'fr', 'de', 'tr', 'ur', 'id', 'ms', 'ku']);

function normalizeLocale(locale) {
  const clean = String(locale || 'ar').trim().toLowerCase();
  return ALLOWED_LOCALES.has(clean) ? clean : 'ar';
}

const LOCAL_FAQ = {
  ar: {
    غنة: 'الغنة: صوت يخرج من الخيشوم عند النون والميم المشدّدتين، وعند النون والميم المُدغَمتين في الإدغام بغنة. مدّها حركتين.',
    'نون ساكنة': 'أحكام النون الساكنة والتنوين أربعة: إظهار، إدغام، إقلاب، إخفاء.',
    مد: 'المد: إطالة الصوت. طبيعي (2)، متصل (4-5)، منفصل (4-5)، لازم (6)، عارض (2-4-6).',
  },
};

function getAiProviders() {
  return {
    bedrock: !!process.env.AWS_BEARER_TOKEN_BEDROCK,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    chain: ['bedrock', 'openai', 'gemini', 'local'],
  };
}

async function callBedrock(messages, { maxTokens = 800 } = {}) {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  const region = process.env.AWS_REGION || 'us-east-1';
  const model = process.env.BEDROCK_MODEL || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
  if (!token) return null;

  const system = messages.find((m) => m.role === 'system')?.content || SYSTEM_QURAN;
  const userMsgs = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');

  const res = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: userMsgs }] }],
      inferenceConfig: { maxTokens, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Bedrock: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.output?.message?.content?.[0]?.text?.trim() || '';
  return { text, provider: 'bedrock', model };
}

async function callOpenAI(messages, { maxTokens = 800 } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content?.trim() || '',
    provider: 'openai',
    model: data.model,
  };
}

async function callGemini(prompt, { locale = 'ar' } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const safeLoc = normalizeLocale(locale);
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${SYSTEM_QURAN}\nLanguage: ${safeLoc}\n\n${prompt}` }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return { text, provider: 'gemini', model };
}

function localFaqAnswer(prompt, locale = 'ar') {
  if (locale !== 'ar') return null;
  const lower = prompt.toLowerCase();
  for (const [key, answer] of Object.entries(LOCAL_FAQ.ar)) {
    if (lower.includes(key)) return answer;
  }
  return null;
}

async function chatWithChain(messages, prompt, { locale = 'ar' } = {}) {
  const providers = getAiProviders().chain.filter((p) => p !== 'local');

  for (const name of providers) {
    try {
      let result = null;
      if (name === 'bedrock') result = await callBedrock(messages);
      else if (name === 'openai') result = await callOpenAI(messages);
      else if (name === 'gemini') result = await callGemini(prompt, { locale });
      if (result?.text) return { ...result, fallback: false };
    } catch (e) {
      console.warn(`${name} failed:`, e.message);
    }
  }

  const faq = localFaqAnswer(prompt, locale);
  if (faq) return { text: faq, provider: 'local-faq', fallback: true };

  return {
    text: locale === 'ar'
      ? `بخصوص: "${prompt.slice(0, 120)}" — راجع التفسير الميسر واستمع لتلاوة مجودة. (وضع محلي — فعّل مزود AI في إعدادات الخادم)`
      : `Regarding "${prompt.slice(0, 120)}" — review tafsir and qualified reciters. (local mode — add API keys)`,
    provider: 'local',
    fallback: true,
  };
}

async function chat(prompt, { locale = 'ar', role = 'quran' } = {}) {
  const system = role === 'teacher'
    ? 'You help Quran teachers with lesson plans and student engagement.'
    : role === 'student'
      ? 'You help students plan daily Quran memorization and tajweed practice.'
      : SYSTEM_QURAN;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  return chatWithChain(messages, prompt, { locale });
}

function parseJsonFromText(text) {
  const jsonMatch = text?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function localRecitationAnalysis(filename, locale = 'ar') {
  const ar = locale === 'ar';
  const base = {
    overallScore: 72 + Math.floor(Math.random() * 18),
    tajweed: { score: 75, notes: ar ? ['تحسين الغنة في بعض المواضع'] : ['Improve ghunnah in some places'] },
    makhraj: { score: 73, notes: ar ? ['انتبه لمخرج حرف القاف'] : ['Watch Qaf articulation'] },
    waqf: { score: 78, notes: ar ? ['وقف جيد في معظم الآيات'] : ['Good stopping points'] },
    mad: { score: 74, notes: ar ? ['مد طبيعي قصير في بعض المواضع'] : ['Natural mad slightly short'] },
    ghunnah: { score: 76, notes: ar ? ['الغنة تحتاج مراجعة في النون الساكنة'] : ['Review ghunnah on noon sakinah'] },
    noonSakinah: { score: 77, notes: ar ? ['أحكام النون الساكنة جيدة جزئياً'] : ['Noon sakinah rules partially good'] },
    recommendations: ar
      ? ['تدرب على سورة الملك مع التركيز على الغنة', 'راجع مخارج الحروف المفخمة', 'سجّل تلاوة جديدة بعد 3 أيام']
      : ['Practice Surah Al-Mulk focusing on ghunnah', 'Review heavy letter makhraj', 'Record again after 3 days'],
    source: filename || 'audio-upload',
    provider: 'local-heuristic',
  };
  const scores = [base.tajweed.score, base.makhraj.score, base.waqf.score, base.mad.score, base.ghunnah.score, base.noonSakinah.score];
  base.overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return base;
}

async function transcribeAudio(file) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !file?.buffer) return null;
  try {
    const fd = new FormData();
    fd.append('file', new Blob([file.buffer], { type: file.mimetype || 'audio/mpeg' }), file.originalname || 'recitation.mp3');
    fd.append('model', 'whisper-1');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text?.trim() || null;
  } catch (e) {
    console.warn('Whisper failed:', e.message);
    return null;
  }
}

const RECITATION_JSON_PROMPT = (transcript, locale) => `Analyze this Quran recitation transcript and return JSON ONLY:
{
  "overallScore": 0-100,
  "tajweed": { "score": 0-100, "notes": ["..."] },
  "makhraj": { "score": 0-100, "notes": ["..."] },
  "waqf": { "score": 0-100, "notes": ["..."] },
  "mad": { "score": 0-100, "notes": ["..."] },
  "ghunnah": { "score": 0-100, "notes": ["..."] },
  "noonSakinah": { "score": 0-100, "notes": ["..."] },
  "recommendations": ["..."]
}
Language for notes: ${locale}.
Transcript: ${transcript || '(no transcript — estimate from filename)'}
`;

async function analyzeWithAi(prompt, locale) {
  const messages = [
    { role: 'system', content: 'You are a Tajweed expert. Return valid JSON only.' },
    { role: 'user', content: prompt },
  ];
  const result = await chatWithChain(messages, prompt, { locale });
  const parsed = parseJsonFromText(result.text);
  if (parsed) return { analysis: parsed, provider: result.provider };
  return null;
}

function sanitizeMetricSection(rawSection, fallbackSection) {
  if (!rawSection || typeof rawSection !== 'object') return fallbackSection;
  const rawScore = Number(rawSection.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : fallbackSection.score;
  const notes = Array.isArray(rawSection.notes)
    ? rawSection.notes.slice(0, 6).map((item) => String(item || '').trim().slice(0, 300)).filter(Boolean)
    : fallbackSection.notes;
  return { score, notes };
}

function sanitizeRecitationAnalysis(rawAnalysis, baseAnalysis) {
  if (!rawAnalysis || typeof rawAnalysis !== 'object') return baseAnalysis;
  const rawOverall = Number(rawAnalysis.overallScore);
  const overallScore = Number.isFinite(rawOverall)
    ? Math.max(0, Math.min(100, Math.round(rawOverall)))
    : baseAnalysis.overallScore;
  const recommendations = Array.isArray(rawAnalysis.recommendations)
    ? rawAnalysis.recommendations.slice(0, 8).map((item) => String(item || '').trim().slice(0, 300)).filter(Boolean)
    : baseAnalysis.recommendations;

  return {
    overallScore,
    tajweed: sanitizeMetricSection(rawAnalysis.tajweed, baseAnalysis.tajweed),
    makhraj: sanitizeMetricSection(rawAnalysis.makhraj, baseAnalysis.makhraj),
    waqf: sanitizeMetricSection(rawAnalysis.waqf, baseAnalysis.waqf),
    mad: sanitizeMetricSection(rawAnalysis.mad, baseAnalysis.mad),
    ghunnah: sanitizeMetricSection(rawAnalysis.ghunnah, baseAnalysis.ghunnah),
    noonSakinah: sanitizeMetricSection(rawAnalysis.noonSakinah, baseAnalysis.noonSakinah),
    recommendations,
    source: baseAnalysis.source,
  };
}

async function analyzeRecitation(userId, file, { locale = 'ar', surah = '' } = {}) {
  const safeLoc = normalizeLocale(locale);
  const safeSurah = String(surah || '').trim().slice(0, 120);
  const safeFilename = String(file?.originalname || 'audio-upload').slice(0, 120);
  const baseAnalysis = localRecitationAnalysis(safeFilename, safeLoc);
  let analysis = baseAnalysis;
  let provider = 'local-heuristic';
  let transcript = null;

  transcript = await transcribeAudio(file);

  const prompt = RECITATION_JSON_PROMPT(transcript || safeFilename, safeLoc) + (safeSurah ? `\nSurah context: ${safeSurah}` : '');
  const aiResult = await analyzeWithAi(prompt, safeLoc);
  if (aiResult) {
    analysis = sanitizeRecitationAnalysis(aiResult.analysis, baseAnalysis);
    provider = aiResult.provider;
  }

  const report = await RecitationReport.create({
    user: userId,
    filename: safeFilename,
    mimeType: file?.mimetype,
    size: file?.size,
    surah: safeSurah || undefined,
    transcript,
    overallScore: analysis.overallScore,
    tajweed: analysis.tajweed,
    makhraj: analysis.makhraj,
    waqf: analysis.waqf,
    mad: analysis.mad,
    ghunnah: analysis.ghunnah,
    noonSakinah: analysis.noonSakinah,
    recommendations: analysis.recommendations,
    provider,
  });

  return {
    reportId: report.reportId,
    overallScore: analysis.overallScore,
    tajweed: analysis.tajweed,
    makhraj: analysis.makhraj,
    waqf: analysis.waqf,
    mad: analysis.mad,
    ghunnah: analysis.ghunnah,
    noonSakinah: analysis.noonSakinah,
    recommendations: analysis.recommendations,
    transcript,
    analyzedAt: report.createdAt,
    id: report._id,
    provider,
    offline: provider === 'local-heuristic',
  };
}

async function generateHomework({ topic, level, count = 5, locale = 'ar' }) {
  const prompt = `Generate ${count} Islamic education homework assignments about "${topic || 'Tajweed'}" for ${level || 'intermediate'} level. Return JSON array: [{title, type, description}] in ${locale}.`;
  const result = await chat(prompt, { locale, role: 'teacher' });

  try {
    const match = result.text.match(/\[[\s\S]*\]/);
    if (match) {
      const items = JSON.parse(match[0]);
      return { assignments: items.map((a, i) => ({ id: i + 1, ...a })), provider: result.provider };
    }
  } catch (_) { /* fallback below */ }

  return {
    assignments: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `${topic || 'Tajweed'} — ${locale === 'ar' ? 'تمرين' : 'Exercise'} ${i + 1}`,
      level: level || 'intermediate',
      type: i % 2 === 0 ? 'recitation' : 'written',
    })),
    provider: result.provider,
  };
}

async function generateExam({ topic = 'Tajweed', questionCount = 5, locale = 'ar' }) {
  const prompt = `Generate ${questionCount} quiz questions about "${topic}". Return JSON array only:
[{ "type": "multiple-choice"|"true-false"|"short-answer", "question": { "ar": "...", "en": "..." }, "options": [{"text":{"ar":"...","en":"..."},"isCorrect":true|false}], "points": 10 }]
Language: ${locale}.`;
  const result = await chat(prompt, { locale, role: 'teacher' });
  try {
    const match = result.text.match(/\[[\s\S]*\]/);
    if (match) {
      const raw = JSON.parse(match[0]);
      const questions = raw.map((q, i) => ({
        id: i + 1,
        type: q.type === 'mcq' ? 'multiple-choice' : q.type,
        question: q.question || { ar: q.text?.ar || `س${i + 1}`, en: q.text?.en || `Q${i + 1}` },
        options: q.options || [],
        points: q.points || 10,
      }));
      return { questions, provider: result.provider };
    }
  } catch (_) { /* fallback */ }
  return {
    questions: Array.from({ length: questionCount }, (_, i) => ({
      id: i + 1,
      type: i % 2 === 0 ? 'multiple-choice' : 'true-false',
      question: { ar: `${topic} — س${i + 1}`, en: `${topic} — Q${i + 1}` },
      options: [
        { text: { ar: 'أ', en: 'A' }, isCorrect: true },
        { text: { ar: 'ب', en: 'B' }, isCorrect: false },
      ],
      points: 10,
    })),
    provider: result.provider,
  };
}

module.exports = {
  chat,
  analyzeRecitation,
  generateHomework,
  generateExam,
  localRecitationAnalysis,
  getAiProviders,
};
