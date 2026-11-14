import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, PauseCircle, PlayCircle, RotateCcw, Send, Square, X } from 'lucide-react';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 120;

function formatSeconds(total = 0) {
  const value = Math.max(0, Math.floor(total));
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function SecureVoiceNote({ url, duration, isMe }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const loadAudio = async () => {
    if (audioUrl || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.request(url, { auth: true, json: false, method: 'GET' });
      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err.message || 'تعذر تحميل الرسالة الصوتية');
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <audio
        src={audioUrl}
        controls
        preload="metadata"
        className="w-full min-w-[220px] max-w-[320px]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={loadAudio}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${
        isMe ? 'bg-emerald-800 text-white' : 'bg-white text-emerald-800 border border-emerald-100'
      }`}
    >
      {loading ? <PauseCircle size={17} className="animate-pulse" /> : <PlayCircle size={17} />}
      <span>{error || (loading ? 'جاري التحميل...' : `رسالة صوتية ${duration ? formatSeconds(duration) : ''}`)}</span>
    </button>
  );
}

export default function SessionChatModal({ session, onClose, locale = 'ar', viewerRole = 'student' }) {
  const isAr = locale === 'ar';
  const sessionId = session?._id;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    if (!sessionId) return;
    if (!silent) setLoading(true);
    try {
      const result = await api.get(
        `/api/sessions/${sessionId}/translate/messages?lang=${encodeURIComponent(locale)}`,
        { auth: true }
      );
      setMessages(result.messages || []);
      setError('');
    } catch (err) {
      if (!silent) setError(err.message || (isAr ? 'تعذر تحميل المحادثة' : 'Unable to load chat'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, locale, isAr]);

  useEffect(() => {
    loadMessages();

    const onRealtimeNotification = (event) => {
      const notification = event?.detail;
      if (
        notification?.type === 'session-chat-message' &&
        String(notification?.data?.session || '') === String(sessionId || '')
      ) {
        loadMessages({ silent: true });
      }
    };

    window.addEventListener('wn:realtime-notification', onRealtimeNotification);

    // Fallback for offline/reconnect cases. Realtime is the primary path.
    const poll = window.setInterval(() => loadMessages({ silent: true }), 30000);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener('wn:realtime-notification', onRealtimeNotification);
    };
  }, [loadMessages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
    cleanupRecording();
  }, [cleanupRecording]);

  useEffect(() => {
    if (recording && recordSeconds >= MAX_AUDIO_SECONDS) {
      stopRecording();
    }
  }, [recording, recordSeconds, stopRecording]);

  useEffect(() => () => {
    cleanupRecording();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [cleanupRecording, previewUrl]);

  const startRecording = async () => {
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setAudioBlob(null);
      setRecordSeconds(0);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const mimeType = candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        if (blob.size > MAX_AUDIO_BYTES) {
          setError('الرسالة الصوتية أكبر من 10 MB. سجّل رسالة أقصر.');
          setAudioBlob(null);
          return;
        }
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((current) => current + 1);
      }, 1000);
    } catch {
      setError(isAr
        ? 'اسمح للموقع باستخدام الميكروفون لإرسال رسالة صوتية.'
        : 'Allow microphone access to send a voice note.');
    }
  };

  const resetRecording = () => {
    if (recording) stopRecording();
    setAudioBlob(null);
    setRecordSeconds(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  };

  const sendText = async (event) => {
    event?.preventDefault?.();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      const created = await api.post(
        `/api/sessions/${sessionId}/translate/messages`,
        { kind: 'text', text: clean, lang: locale },
        { auth: true }
      );
      setText('');
      if (created?._id) {
        setMessages((current) => current.some((message) => String(message._id) === String(created._id))
          ? current
          : [...current, created]);
      }
      await loadMessages({ silent: true });
    } catch (err) {
      setError(err.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const sendVoice = async () => {
    if (!audioBlob || sending) return;
    setSending(true);
    try {
      const mime = audioBlob.type || 'audio/webm';
      const ext = mime.includes('mp4')
        ? 'm4a'
        : mime.includes('ogg')
          ? 'ogg'
          : mime.includes('wav')
            ? 'wav'
            : 'webm';

      const file = new File(
        [audioBlob],
        `session-voice-${Date.now()}.${ext}`,
        { type: mime.split(';')[0] }
      );

      const storageFile = await uploadFileDirect(file, 'session-chat-audio');
      await api.post(
        `/api/sessions/${sessionId}/translate/messages`,
        {
          kind: 'audio',
          storageFile,
          durationSeconds: Math.min(recordSeconds, MAX_AUDIO_SECONDS),
          lang: locale,
        },
        { auth: true }
      );

      resetRecording();
      await loadMessages({ silent: true });
    } catch (err) {
      setError(err.message || 'فشل إرسال الرسالة الصوتية');
    } finally {
      setSending(false);
    }
  };

  const peerName = viewerRole === 'teacher'
    ? (session?.student?.name || (isAr ? 'الطالب' : 'Student'))
    : (session?.teacher?.user?.name || session?.teacher?.personalInfo?.fullName || session?.teacher?.name || (isAr ? 'المعلم' : 'Tutor'));

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 p-3 md:p-6 flex items-center justify-center" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-2xl h-[min(760px,92vh)] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <header className="border-b px-4 py-3 flex items-center justify-between gap-3 bg-slate-50">
          <div>
            <h3 className="font-black text-slate-900">{isAr ? 'محادثة الحصة' : 'Session chat'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{peerName}{session?.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleString(isAr ? 'ar-EG' : 'en')}` : ''}</p>
          </div>
          <button type="button" aria-label={isAr ? 'إغلاق المحادثة' : 'Close chat'} onClick={onClose} className="p-2 rounded-lg hover:bg-white text-slate-500">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="text-center text-sm text-slate-500 py-10">{isAr ? 'جاري تحميل المحادثة...' : 'Loading chat...'}</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-bold text-slate-700">{isAr ? 'ابدأ المحادثة' : 'Start the conversation'}</p>
              <p className="text-xs text-slate-500 mt-1">{isAr ? 'يمكنك إرسال رسالة نصية أو صوتية مرتبطة بهذه الحصة.' : 'Send a text or voice note for this session.'}</p>
            </div>
          ) : messages.map((message) => (
            <div key={message._id} className={`flex ${message.isMe ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[84%] rounded-2xl px-3 py-2 ${
                message.isMe
                  ? 'bg-emerald-700 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
              }`}>
                <p className={`text-[10px] mb-1 ${message.isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {message.userName || (message.isMe ? (isAr ? 'أنت' : 'You') : '')}
                </p>

                {message.kind === 'audio' && message.audioUrl ? (
                  <SecureVoiceNote
                    url={message.audioUrl}
                    duration={message.audioDurationSeconds}
                    isMe={message.isMe}
                  />
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-6">{message.translation || message.text}</p>
                    {message.translation && message.text && message.translation !== message.text && (
                      <details className="mt-1">
                        <summary className={`cursor-pointer text-[10px] ${message.isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {isAr ? 'عرض النص الأصلي' : 'Original text'}
                        </summary>
                        <p className="text-xs mt-1 opacity-80">{message.text}</p>
                      </details>
                    )}
                  </>
                )}

                <p className={`mt-1 text-[9px] ${message.isMe ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                  {new Date(message.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="px-4 py-2 text-xs bg-red-50 text-red-700 border-t border-red-100">{error}</div>
        )}

        <footer className="border-t bg-white p-3 space-y-3">
          {recording || audioBlob ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <strong className="font-mono text-sm">{formatSeconds(recordSeconds)}</strong>
                  <span className="text-xs text-slate-500">
                    {recording ? (isAr ? 'جاري التسجيل' : 'Recording') : (isAr ? 'جاهزة للإرسال' : 'Ready to send')}
                  </span>
                </div>

                <div className="flex gap-2">
                  {recording ? (
                    <button type="button" onClick={stopRecording} className="p-2 rounded-lg bg-slate-900 text-white" title="إيقاف">
                      <Square size={16} />
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={resetRecording} className="p-2 rounded-lg border text-slate-600" title="إعادة">
                        <RotateCcw size={16} />
                      </button>
                      <button type="button" onClick={sendVoice} disabled={sending} className="p-2 rounded-lg bg-emerald-700 text-white disabled:opacity-50" title="إرسال">
                        <Send size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {previewUrl && !recording && (
                <audio src={previewUrl} controls className="w-full mt-3" />
              )}
              <p className="text-[10px] text-slate-400 mt-2">{isAr ? 'الحد الأقصى دقيقتان و10 MB.' : 'Maximum 2 minutes and 10 MB.'}</p>
            </div>
          ) : null}

          <form onSubmit={sendText} className="flex items-end gap-2">
            <button
              type="button"
              onClick={startRecording}
              disabled={recording || sending}
              className="p-3 rounded-xl border border-slate-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              title={isAr ? 'رسالة صوتية' : 'Voice note'}
            >
              <Mic size={19} />
            </button>
            <textarea aria-label={isAr ? 'اكتب رسالة' : 'Write a message'}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={1}
              maxLength={4000}
              placeholder={isAr ? 'اكتب رسالة للشيخ/الطالب...' : 'Write a message...'}
              className="flex-1 min-h-[46px] max-h-28 resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="p-3 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <Send size={19} />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
