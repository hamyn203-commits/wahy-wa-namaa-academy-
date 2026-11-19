import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, PauseCircle, PlayCircle, RotateCcw, Send, Square, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useI18n } from '../../i18n';
import { resolveIntlLocale } from '../../lib/locale';
import Modal from '../shared/Modal';
import Skeleton from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 120;

function formatSeconds(total = 0) {
  const value = Math.max(0, Math.floor(total));
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = (value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function SecureVoiceNote({ url, duration, isMe, labels }) {
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
      setError(err.message || labels.loadAudioError);
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
        className="w-full min-w-[180px] max-w-[320px]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={loadAudio}
      className={`min-h-[44px] inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
        isMe
          ? 'bg-[var(--wn-emerald-dark)] text-[var(--wn-white)]'
          : 'bg-[var(--wn-surface)] text-[var(--wn-text-accent)] border border-[var(--wn-border)]'
      }`}
    >
      {loading ? <PauseCircle size={17} className="animate-pulse" aria-hidden="true" /> : <PlayCircle size={17} aria-hidden="true" />}
      <span>{error || (loading ? labels.loadingAudio : `${labels.voiceNote} ${duration ? formatSeconds(duration) : ''}`.trim())}</span>
    </button>
  );
}

export default function SessionChatModal({ session, onClose, locale: propLocale, viewerRole = 'student' }) {
  const { locale: ctxLocale, dir, t } = useI18n();
  const locale = propLocale || ctxLocale || 'ar';
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
      if (!silent) setError(err.message || t.live.chatModal.loadError);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId, locale, t]);

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
          setError(t.live.chatModal.audioTooLarge);
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
      setError(t.live.chatModal.micPermissionError);
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
        setMessages((current) => (current.some((message) => String(message._id) === String(created._id))
          ? current
          : [...current, created]));
      }
      await loadMessages({ silent: true });
    } catch (err) {
      setError(err.message || t.live.chatModal.sendError);
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
      setError(err.message || t.live.chatModal.voiceSendError);
    } finally {
      setSending(false);
    }
  };

  const peerName = viewerRole === 'teacher'
    ? (session?.student?.name || t.live.chatModal.studentFallback)
    : (session?.teacher?.user?.name || session?.teacher?.personalInfo?.fullName || session?.teacher?.name || t.live.chatModal.tutorFallback);

  return (
    <Modal
      isOpen={Boolean(session)}
      onClose={onClose}
      title={t.live.chatModal.title}
      maxWidth="672px"
      ariaLabel={t.live.chatModal.title}
    >
      <div className="flex flex-col h-[min(620px,76vh)]" dir={dir}>
        <p className="text-xs text-[var(--wn-text-secondary)] pb-2 border-b border-[var(--wn-border)]">
          {peerName}
          {session?.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleString(resolveIntlLocale(locale))}` : ''}
        </p>

        <div className="flex-1 overflow-y-auto py-3 px-1 space-y-3">
          {loading ? (
            <div className="space-y-3 py-4" role="status" aria-busy="true" aria-label={t.live.chatModal.loadingChat}>
              <Skeleton className="h-12 w-3/4 rounded-2xl" />
              <Skeleton className="h-12 w-2/3 ms-auto rounded-2xl" />
              <Skeleton className="h-12 w-3/5 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={MessageSquare}
                title={t.live.chatModal.emptyTitle}
                description={t.live.chatModal.emptyDesc}
              />
            </div>
          ) : messages.map((message) => (
            <div key={message._id} className={`flex ${message.isMe ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[84%] rounded-2xl px-3 py-2 ${
                message.isMe
                  ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] rounded-ss-sm'
                  : 'bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] rounded-se-sm'
              }`}>
                <p className={`text-[10px] mb-1 ${message.isMe ? 'text-emerald-100' : 'text-[var(--wn-text-tertiary)]'}`}>
                  {message.userName || (message.isMe ? t.live.chatModal.you : '')}
                </p>

                {message.kind === 'audio' && message.audioUrl ? (
                  <SecureVoiceNote
                    url={message.audioUrl}
                    duration={message.audioDurationSeconds}
                    isMe={message.isMe}
                    labels={t.live.chatModal}
                  />
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-6">{message.translation || message.text}</p>
                    {message.translation && message.text && message.translation !== message.text && (
                      <details className="mt-1">
                        <summary className={`cursor-pointer text-[10px] ${message.isMe ? 'text-emerald-100' : 'text-[var(--wn-text-secondary)]'}`}>
                          {t.live.chatModal.originalText}
                        </summary>
                        <p className="text-xs mt-1 opacity-80">{message.text}</p>
                      </details>
                    )}
                  </>
                )}

                <p className={`mt-1 text-[9px] ${message.isMe ? 'text-emerald-100/80' : 'text-[var(--wn-text-tertiary)]'}`}>
                  {new Date(message.createdAt).toLocaleTimeString(resolveIntlLocale(locale), { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div role="alert" className="px-3 py-2 text-xs bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-t border-[var(--wn-border)] rounded-lg mb-2">
            {error}
          </div>
        )}

        <footer className="border-t border-[var(--wn-border)] pt-3 space-y-3">
          {recording || audioBlob ? (
            <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${recording ? 'bg-[var(--wn-danger)] animate-pulse' : 'bg-[var(--wn-emerald)]'}`} />
                  <strong className="font-mono text-sm text-[var(--wn-text-primary)]">{formatSeconds(recordSeconds)}</strong>
                  <span className="text-xs text-[var(--wn-text-secondary)]">
                    {recording ? t.live.chatModal.recording : t.live.chatModal.readyToSend}
                  </span>
                </div>

                <div className="flex gap-2">
                  {recording ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      aria-label={t.live.chatModal.stop}
                      title={t.live.chatModal.stop}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--wn-emerald-deep)] text-[var(--wn-white)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                    >
                      <Square size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={resetRecording}
                        aria-label={t.live.chatModal.reset}
                        title={t.live.chatModal.reset}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={sendVoice}
                        disabled={sending}
                        aria-label={t.live.chatModal.send}
                        title={t.live.chatModal.send}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-white)] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                      >
                        <Send size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {previewUrl && !recording && (
                <audio src={previewUrl} controls className="w-full mt-3" />
              )}
              <p className="text-[10px] text-[var(--wn-text-tertiary)] mt-2">{t.live.chatModal.maxDurationHint}</p>
            </div>
          ) : null}

          <form onSubmit={sendText} className="flex items-end gap-2">
            <button
              type="button"
              onClick={startRecording}
              disabled={recording || sending}
              aria-label={t.live.chatModal.voiceNote}
              title={t.live.chatModal.voiceNote}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-accent)] hover:bg-[var(--wn-emerald-soft)] disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Mic size={19} aria-hidden="true" />
            </button>
            <textarea
              aria-label={t.live.chatModal.writeMessageAria}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={1}
              maxLength={4000}
              placeholder={t.live.chatModal.inputPlaceholder}
              className="flex-1 min-h-[46px] max-h-28 resize-y rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] px-3 py-2.5 text-sm outline-none focus:border-[var(--wn-focus)] focus:ring-2 focus:ring-[var(--wn-focus)]"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label={t.live.chatModal.send}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[var(--wn-emerald)] text-[var(--wn-white)] hover:bg-[var(--wn-emerald-hover)] disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Send size={19} aria-hidden="true" />
            </button>
          </form>
        </footer>
      </div>
    </Modal>
  );
}
