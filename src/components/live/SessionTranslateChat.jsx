import { useState, useEffect, useRef, useCallback } from 'react';
import { Languages, Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { LANG_CODES, langLabel } from '../../lib/languages';
import api from '../../lib/api';
import { translateText } from '../../lib/translateApi';
import { useI18n } from '../../i18n';
import { useToast } from '../../context/ToastProvider';
import { resolveIntlLocale } from '../../lib/locale';

export default function SessionTranslateChat({ sessionId, myLang, partnerLang, uiLocale }) {
  const { locale, dir, t } = useI18n();
  const toast = useToast();
  const activeUiLocale = uiLocale || locale || 'ar';
  const langLabelLocale = activeUiLocale === 'ar' ? 'ar' : 'en';

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const bottomRef = useRef(null);
  const sinceRef = useRef(null);
  const recRef = useRef(null);

  const poll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const q = sinceRef.current ? `?since=${sinceRef.current}&lang=${myLang}` : `?lang=${myLang}`;
      const data = await api.get(`/api/sessions/${sessionId}/translate/messages${q}`, { auth: true });
      if (data.messages?.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m._id));
          const fresh = data.messages.filter((m) => !ids.has(m._id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        sinceRef.current = data.messages[data.messages.length - 1].createdAt;
      }
    } catch { /* ignore background poll errors */ }
  }, [sessionId, myLang]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      clearInterval(id);
      try { recRef.current?.stop?.(); } catch { /* ignore */ }
    };
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, caption]);

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setErrorMsg('');
    try {
      await api.post(`/api/sessions/${sessionId}/translate/messages`, { text: text.trim(), lang: myLang }, { auth: true });
      setText('');
      await poll();
    } catch (err) {
      const msg = err?.message || t.live.translateChat.sendError;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error(t.live.translateChat.speechUnsupported);
      setErrorMsg(t.live.translateChat.speechUnsupported);
      return;
    }
    if (listening) {
      try { recRef.current?.stop?.(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = resolveIntlLocale(myLang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = async (ev) => {
      const line = Array.from(ev.results).map((r) => r[0].transcript).join(' ').trim();
      if (!line || ev.results[ev.results.length - 1].isFinal !== true) return;
      try {
        const translated = await translateText(line, myLang, partnerLang, { auth: true });
        setCaption(translated);
      } catch {
        setCaption(line);
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border-s border-[var(--wn-border)]" dir={dir}>
      <div className="p-3 border-b border-[var(--wn-border)] bg-[var(--wn-emerald-soft)] flex items-center gap-2">
        <Languages className="text-[var(--wn-emerald)] shrink-0" size={20} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-bold text-sm text-[var(--wn-heading)]">{t.live.translateChat.title}</p>
          <p className="text-xs text-[var(--wn-text-secondary)]">
            {langLabel(myLang, langLabelLocale)} → {langLabel(partnerLang, langLabelLocale)}
          </p>
        </div>
      </div>

      {caption && (
        <div className="p-3 bg-[var(--wn-gold-soft)] border-b border-[var(--wn-border)] text-sm">
          <p className="text-xs text-[var(--wn-badge-gold-text)] font-medium mb-1">{t.live.translateChat.liveCaption}</p>
          <p className="text-[var(--wn-text-primary)]">{caption}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-[var(--wn-text-secondary)] text-sm py-8">{t.live.translateChat.emptyHint}</p>
        )}
        {messages.map((m) => (
          <div key={m._id} className={`text-sm ${m.isMe ? 'text-end' : 'text-start'}`}>
            <p className="text-xs text-[var(--wn-text-secondary)] mb-0.5">{m.userName}</p>
            {m.lang !== myLang && m.text !== m.translation && (
              <p className="text-[var(--wn-text-tertiary)] text-xs mb-1 line-through opacity-70">{m.text}</p>
            )}
            <p className={`inline-block px-3 py-2 rounded-xl ${m.isMe ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)]' : 'bg-[var(--wn-surface-soft)] border border-[var(--wn-border)] text-[var(--wn-text-primary)]'}`}>
              {m.translation || m.text}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {errorMsg && (
        <div role="alert" className="px-3 py-2 text-xs bg-[var(--wn-danger-soft)] text-[var(--wn-text-danger)] border-t border-[var(--wn-border)]">
          {errorMsg}
        </div>
      )}

      <form onSubmit={send} className="p-3 border-t border-[var(--wn-border)] flex gap-2">
        <button
          type="button"
          onClick={toggleListen}
          aria-label={t.live.translateChat.voiceTranslateTitle}
          title={t.live.translateChat.voiceTranslateTitle}
          aria-pressed={listening}
          className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${
            listening
              ? 'bg-[var(--wn-danger-soft)] border-[var(--wn-danger)] text-[var(--wn-text-danger)]'
              : 'border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)]'
          }`}
        >
          {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t.live.translateChat.inputPlaceholder}
          placeholder={t.live.translateChat.inputPlaceholder}
          className="flex-1 min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label={t.common.send}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
        >
          {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}

export function LangSelect({ value, onChange, label, isAr, uiLocale }) {
  const { locale } = useI18n();
  const activeLocale = uiLocale || locale || (isAr ? 'ar' : 'en');
  const labelLocale = activeLocale === 'ar' ? 'ar' : 'en';
  return (
    <label className="text-xs flex flex-col gap-1">
      <span className="text-[var(--wn-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)]"
      >
        {LANG_CODES.map((c) => (
          <option key={c} value={c}>{langLabel(c, labelLocale)}</option>
        ))}
      </select>
    </label>
  );
}
