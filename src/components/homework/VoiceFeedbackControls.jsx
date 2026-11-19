import { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Mic, RotateCcw, Square, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';
import { useI18n } from '../../i18n';

const MAX_FEEDBACK_SECONDS = 60;

function formatDuration(total = 0) {
  const sec = Math.max(0, Math.floor(Number(total) || 0));
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export async function prepareTeacherFeedbackAudio(audioState) {
  if (!audioState?.blob) return null;
  const mime = audioState.blob.type || 'audio/webm';
  const ext = mime.includes('mp4')
    ? 'm4a'
    : mime.includes('ogg')
      ? 'ogg'
      : mime.includes('wav')
        ? 'wav'
        : mime.includes('mpeg')
          ? 'mp3'
          : 'webm';
  const file = new File(
    [audioState.blob],
    `teacher-feedback-${Date.now()}.${ext}`,
    { type: mime.split(';')[0] }
  );

  const statusInfo = await api.get('/api/uploads/status').catch(() => null);
  if (statusInfo?.driver === 'vercel-blob') {
    const uploaded = await uploadFileDirect(file, 'teacher-feedback-audio');
    return {
      mode: 'direct',
      feedbackAudio: {
        url: uploaded.url,
        pathname: uploaded.pathname,
        name: uploaded.name,
        size: uploaded.size,
        contentType: uploaded.contentType,
        durationSeconds: Math.min(MAX_FEEDBACK_SECONDS, Math.max(0, Math.round(audioState.durationSeconds || 0))),
      },
    };
  }

  return {
    mode: 'multipart',
    file,
    durationSeconds: Math.min(MAX_FEEDBACK_SECONDS, Math.max(0, Math.round(audioState.durationSeconds || 0))),
  };
}

export async function uploadTeacherFeedbackMultipart(taskId, prepared) {
  if (!taskId || prepared?.mode !== 'multipart' || !prepared?.file) return null;
  const formData = new FormData();
  formData.append('audio', prepared.file);
  formData.append('durationSeconds', String(prepared.durationSeconds || 0));
  return api.post(`/api/homework/tasks/${encodeURIComponent(taskId)}/feedback-audio`, formData, { auth: true });
}

export function TeacherVoiceFeedbackRecorder({ value, onChange, disabled = false }) {
  const { t } = useI18n();
  const vf = t?.student?.voiceFeedback || {};

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  const stopStream = useCallback(() => {
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
    stopStream();
  }, [stopStream]);

  useEffect(() => {
    if (recording && seconds >= MAX_FEEDBACK_SECONDS) {
      stopRecording();
    }
  }, [recording, seconds, stopRecording]);

  useEffect(() => () => {
    stopStream();
  }, [stopStream]);

  const clearRecording = () => {
    if (recording) stopRecording();
    if (value?.url) URL.revokeObjectURL(value.url);
    setSeconds(0);
    secondsRef.current = 0;
    setError('');
    onChange?.(null);
  };

  const startRecording = async () => {
    if (disabled || recording) return;
    setError('');
    try {
      if (value?.url) URL.revokeObjectURL(value.url);
      onChange?.(null);
      chunksRef.current = [];
      secondsRef.current = 0;
      setSeconds(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const actualType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualType });
        if (blob.size > 0) {
          onChange?.({
            blob,
            url: URL.createObjectURL(blob),
            durationSeconds: secondsRef.current,
          });
        }
      };

      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }, 1000);
    } catch {
      setError(vf.micError || 'Please allow microphone access to record voice feedback.');
    }
  };

  return (
    <div className="rounded-xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--wn-text-primary)]">
          <Mic size={14} className="text-[var(--wn-link)]" aria-hidden="true" />
          {vf.recorderLabel || 'Voice feedback note (optional · up to 60s)'}
        </span>
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg bg-[var(--wn-danger)] px-3.5 py-2 text-xs font-bold text-[var(--wn-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
          >
            <Square size={12} aria-hidden="true" />
            {vf.stopRecording || 'Stop'} ({formatDuration(seconds)})
          </button>
        ) : !value?.blob ? (
          <button
            type="button"
            disabled={disabled}
            onClick={startRecording}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-surface)] px-3.5 py-2 text-xs font-bold text-[var(--wn-link)] hover:bg-[var(--wn-emerald-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-50"
          >
            <Mic size={13} aria-hidden="true" />
            {vf.recordVoiceNote || 'Record voice note'}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={startRecording}
              className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-[var(--wn-border)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-semibold text-[var(--wn-text-primary)] hover:bg-[var(--wn-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <RotateCcw size={12} aria-hidden="true" />
              {vf.rerecord || 'Re-record'}
            </button>
            <button
              type="button"
              onClick={clearRecording}
              aria-label={vf.deleteAria || 'Delete voice recording'}
              className="min-h-[44px] inline-flex items-center gap-1 rounded-lg border border-[var(--wn-danger)] bg-[var(--wn-surface)] px-3 py-2 text-xs font-semibold text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Trash2 size={12} aria-hidden="true" />
              {vf.deleteRecording || 'Delete'}
            </button>
          </div>
        )}
      </div>

      {value?.url ? (
        <audio src={value.url} controls preload="metadata" className="w-full h-9" />
      ) : null}
      {error ? <p role="alert" className="text-xs font-semibold text-[var(--wn-text-danger)]">{error}</p> : null}
    </div>
  );
}

export function StudentVoiceFeedbackPlayer({ taskId, duration = 0 }) {
  const { t } = useI18n();
  const vf = t?.student?.voiceFeedback || {};

  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const loadAudio = async () => {
    if (audioUrl || loading || !taskId) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.request(
        `/api/homework/tasks/${encodeURIComponent(taskId)}/feedback-audio`,
        { auth: true, json: false, method: 'GET' }
      );
      const blob = await response.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err.message || vf.loadAudioError || 'Could not load audio feedback');
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <div className="mt-2 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-2.5">
        <span className="block text-[11px] font-bold text-[var(--wn-badge-emerald-text)] mb-1">
          {vf.tutorVoiceFeedback || 'Tutor voice feedback:'}
        </span>
        <audio src={audioUrl} controls preload="metadata" className="w-full h-9" />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={loadAudio}
        disabled={loading}
        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] px-3.5 py-2 text-xs font-bold text-[var(--wn-badge-emerald-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] disabled:opacity-60"
      >
        <Headphones size={14} aria-hidden="true" />
        <span>
          {loading
            ? (vf.loadingVoiceNote || 'Loading voice note…')
            : `${vf.listenFeedback || 'Listen to tutor voice feedback'}${duration ? ` (${formatDuration(duration)})` : ''}`}
        </span>
      </button>
      {error ? <p role="alert" className="mt-1 text-xs font-semibold text-[var(--wn-text-danger)]">{error}</p> : null}
    </div>
  );
}

