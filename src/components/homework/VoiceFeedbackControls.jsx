import { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Mic, RotateCcw, Square, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { uploadFileDirect } from '../../lib/fileUpload';

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
      setError('يرجى السماح بالوصول إلى الميكروفون لتسجيل التوجيه الصوتي.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Mic size={14} className="text-emerald-700" />
          تعليق صوتي للمراجعة (اختياري · حتى 60 ثانية)
        </span>
        {recording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Square size={12} />
            إيقاف ({formatDuration(seconds)})
          </button>
        ) : !value?.blob ? (
          <button
            type="button"
            disabled={disabled}
            onClick={startRecording}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Mic size={13} />
            تسجيل توجيه صوتي
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw size={12} />
              إعادة
            </button>
            <button
              type="button"
              onClick={clearRecording}
              aria-label="حذف التسجيل الصوتي"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 size={12} />
              حذف
            </button>
          </div>
        )}
      </div>

      {value?.url ? (
        <audio src={value.url} controls preload="metadata" className="w-full h-9" />
      ) : null}
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

export function StudentVoiceFeedbackPlayer({ taskId, duration = 0, locale = 'ar' }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAr = locale === 'ar';

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
      setError(err.message || (isAr ? 'تعذر تحميل التعليق الصوتي' : 'Could not load audio feedback'));
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5">
        <span className="block text-[11px] font-bold text-emerald-900 mb-1">
          {isAr ? 'توجيه صوتي من المعلم:' : 'Tutor voice feedback:'}
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
      >
        <Headphones size={14} />
        <span>
          {loading
            ? (isAr ? 'جاري تحميل التوجيه الصوتي...' : 'Loading voice note...')
            : (isAr
                ? `استماع للتوجيه الصوتي من المعلم${duration ? ` (${formatDuration(duration)})` : ''}`
                : `Listen to tutor voice feedback${duration ? ` (${formatDuration(duration)})` : ''}`)}
        </span>
      </button>
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
