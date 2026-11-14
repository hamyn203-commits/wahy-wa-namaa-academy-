/**
 * WhatsApp Notification Service — Wahy Wa Namaa Academy
 * Supports WhatsApp Cloud API (Meta Graph API) & Twilio Fallback & Safe Mock Logger
 */

/**
 * Format phone number to international E.164 digits without '+' or special characters
 * @param {string} phone 
 * @returns {string} cleaned digits
 */
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    digits = '2' + digits;
  }
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.substring(1);
  }
  return digits;
}

/**
 * Send raw text message via WhatsApp
 * Priority: 1. WhatsApp Cloud API (Meta) -> 2. Twilio WhatsApp -> 3. Safe Mock Logger
 */
async function sendRawWhatsAppMessage(toPhone, messageText) {
  const cleanPhone = cleanPhoneNumber(toPhone);
  if (!cleanPhone) {
    console.warn('⚠️ [WhatsApp] Missing or invalid phone number:', toPhone);
    return { success: false, reason: 'Invalid phone number' };
  }

  // 1. Meta WhatsApp Cloud API
  const cloudApiToken = process.env.WHATSAPP_CLOUD_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (cloudApiToken && phoneNumberId) {
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudApiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: true, body: messageText }
        })
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`✅ [WhatsApp Cloud API] Message sent to ${cleanPhone}`);
        return { success: true, provider: 'whatsapp-cloud', data };
      } else {
        console.error('❌ [WhatsApp Cloud API Error]:', data);
      }
    } catch (err) {
      console.error('❌ [WhatsApp Cloud API Exception]:', err.message);
    }
  }

  // 2. Twilio WhatsApp Fallback
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const body = new URLSearchParams({
        From: twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`,
        To: `whatsapp:+${cleanPhone}`,
        Body: messageText
      });

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });

      const data = await res.json();
      if (res.ok) {
        console.log(`✅ [Twilio WhatsApp] Message sent to +${cleanPhone}`);
        return { success: true, provider: 'twilio-whatsapp', data };
      } else {
        console.error('❌ [Twilio WhatsApp Error]:', data);
      }
    } catch (err) {
      console.error('❌ [Twilio WhatsApp Exception]:', err.message);
    }
  }

  // 3. Never simulate successful delivery in production.
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ [WhatsApp] Delivery unavailable: no configured provider succeeded');
    return {
      success: false,
      provider: 'unavailable',
      reason: 'WhatsApp provider is not configured or delivery failed'
    };
  }

  // Development-only preview logger.
  const previewLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  console.log('----------------------------------------');
  console.log(`📱 [WhatsApp Mock Logger] To: +${cleanPhone}`);
  console.log(`💬 Message:\n${messageText}`);
  console.log(`🔗 Direct WhatsApp Link: ${previewLink}`);
  console.log('----------------------------------------');

  return {
    success: true,
    provider: 'mock-logger',
    simulated: true,
    phone: cleanPhone,
    previewLink
  };
}

function resolveSiteUrl() {
  return String(
    process.env.FRONTEND_URL
    || process.env.SITE_URL
    || 'https://wahywanamaa.com'
  ).trim().replace(/\/$/, '');
}

function resolveAbsoluteRoomUrl(session, roomUrl) {
  const siteUrl = resolveSiteUrl();
  const raw = String(roomUrl || session?.meetingLink || '').trim();
  if (!raw) {
    return `${siteUrl}/ar/live/${session?._id || ''}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  if (/^\/(ar|en|fr|de|tr|ur|id|ms|ku)(\/|$)/.test(normalized)) {
    return `${siteUrl}${normalized}`;
  }
  return `${siteUrl}/ar${normalized}`;
}

/**
 * 1. تذكير قبل 24 ساعة برابط الحصة ورابط تأكيد الحضور أو الاعتذار
 * @param {Object} session - Session document or object
 * @param {Object} student - Student user object
 * @param {string} guardianPhone - Phone number of guardian or student
 */
async function send24HourReminder(session, student, guardianPhone) {
  const studentName = student?.name || 'الطالب';
  const scheduledTime = session.scheduledAt ? new Date(session.scheduledAt).toLocaleString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: session.timezone || 'Africa/Cairo'
  }) : 'الموعد المحدد';

  const siteUrl = resolveSiteUrl();
  const studentQuery = student?._id ? `?studentId=${encodeURIComponent(String(student._id))}` : '';
  const rsvpUrl = `${siteUrl}/ar/sessions/${session._id}/rsvp${studentQuery}`;
  const roomUrl = resolveAbsoluteRoomUrl(session);

  const message = `🌿 *أكاديمية وَحْيٌ وَنَمَاء* 🌿
السلام عليكم ورحمة الله وبركاته،

نود تذكيركم بموعد حلقة القرآن الكريم لـ *${studentName}*:
📅 *الموعد:* ${scheduledTime}
📍 *رابط الحلقة:* ${roomUrl}

⚠️ *تأكيد الحضور أو الاعتذار:*
يرجى الضغط على الرابط التالي لتأكيد الحضور أو تقديم اعتذار قبل الموعد بـ 6 ساعات على الأقل حتى لا يُحتسب غياباً:
👉 ${rsvpUrl}

وفقكم الله لكل خير ونفع بكم.`;

  return sendRawWhatsAppMessage(guardianPhone, message);
}

/**
 * 2. تذكير سريع برابط الدخول المباشر قبل الحصة بـ 30 دقيقة
 * @param {Object} session 
 * @param {Object} student 
 * @param {string} guardianPhone 
 * @param {string} roomUrl 
 */
async function send30MinuteReminder(session, student, guardianPhone, roomUrl) {
  const studentName = student?.name || 'الطالب';
  const link = resolveAbsoluteRoomUrl(session, roomUrl);

  const message = `⏰ *تذكير: الحصة ستبدأ بعد 30 دقيقة!*
السلام عليكم ورحمة الله وبركاته،

حلقة القرآن الكريم لـ *${studentName}* على وشك البدء في غضون نصف ساعة إن شاء الله.

🚪 *رابط الدخول المباشر للحلقة:*
👉 ${link}

نرجو التواجد والاستعداد مع تهيئة المكان والمصحف الشريف 📖.`;

  return sendRawWhatsAppMessage(guardianPhone, message);
}

/**
 * 3. رسالة إخطار فوري لولي الأمر في حال تغيب الطالب عن الحلقة للاطمئنان عليه
 * @param {Object} session 
 * @param {Object} student 
 * @param {string} guardianPhone 
 */
async function sendAbsenceAlert(session, student, guardianPhone) {
  const studentName = student?.name || 'الطالب';
  const scheduledTime = session.scheduledAt ? new Date(session.scheduledAt).toLocaleString('ar-EG', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: session.timezone || 'Africa/Cairo'
  }) : 'اليوم';

  const siteUrl = resolveSiteUrl();
  const contactUrl = `${siteUrl}/ar/contact`;

  const message = `السلام عليكم ورحمة الله وبركاته،
عناية ولي أمر الطالب *${studentName}* المحترم،

نحيطكم علماً بأن الطالب لم يحضر حلقة القرآن المقررة بتاريخ: *${scheduledTime}*.
نرجو أن يكون المانع خيراً، ونأمل الاطمئنان عليكم.

📞 في حال وجود أي استفسار أو لترتيب موعد تعويضي (إن وُجد عذر مسبق)، يرجى التواصل معنا عبر:
👉 ${contactUrl}

حفظكم الله ورعاكم.`;

  return sendRawWhatsAppMessage(guardianPhone, message);
}

/**
 * 4. بطاقة تقرير أنيقة تُرسل لولي الأمر فور انتهاء الحصة
 * @param {Object} session 
 * @param {Object} student 
 * @param {Object} report { memorizationScore, tajweedScore, surahRecited, fromAyah, toAyah, nextHomework, notes }
 * @param {string} guardianPhone 
 */
async function sendSessionReport(session, student, report, guardianPhone) {
  const studentName = student?.name || 'الطالب';
  const memScore = report.memorizationScore != null ? `${report.memorizationScore}/10` : '—';
  const tajScore = report.tajweedScore != null ? `${report.tajweedScore}/10` : '—';
  
  let surahInfo = report.surahRecited || 'لم يحدد';
  if (report.fromAyah && report.toAyah) {
    surahInfo += ` (الآيات ${report.fromAyah} - ${report.toAyah})`;
  } else if (report.fromAyah) {
    surahInfo += ` (من الآية ${report.fromAyah})`;
  }

  const homework = report.nextHomework || 'متابعة المراجعة المقررة';
  const notes = report.notes ? `📝 *ملاحظات المعلم:* ${report.notes}\n` : '';

  const message = `📊 *تقرير إنجاز الحصة القرآنية* 📊
*أكاديمية وَحْيٌ وَنَمَاء*
----------------------------------------
👤 *الطالب:* ${studentName}
📖 *السورة/المقطع المُسمَّع:* ${surahInfo}

🌟 *درجة الحفظ:* ${memScore}
✨ *درجة التجويد والإتقان:* ${tajScore}
${notes}📌 *الواجب للحصة القادمة:*
${homework}
----------------------------------------
بارك الله في جهودكم ونفع به الأمة 🤍.`;

  return sendRawWhatsAppMessage(guardianPhone, message);
}

module.exports = {
  cleanPhoneNumber,
  resolveSiteUrl,
  resolveAbsoluteRoomUrl,
  sendRawWhatsAppMessage,
  send24HourReminder,
  send30MinuteReminder,
  sendAbsenceAlert,
  sendSessionReport
};
