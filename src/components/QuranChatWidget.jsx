import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, Send, X, Bot, User, Gift
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../lib/api';
import { localizedPath } from '../lib/locale';

const QUICK_QUESTION_IDS = ['pricing', 'trial', 'tracks', 'reschedule', 'guardian', 'human'];

export default function QuranChatWidget() {
  const { user } = useAuth();
  const { locale, dir, t } = useI18n();
  const navigate = useNavigate();

  const quickQuestions = useMemo(() => (
    QUICK_QUESTION_IDS.map((id) => ({
      id,
      label: t.live.quranWidget.quickQuestions[id],
    }))
  ), [t]);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      sender: 'bot',
      isWelcome: true,
      text: t.live.quranWidget.welcomeMessage,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const nextMessageIdRef = useRef(2);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleQuickQuestion = (item) => {
    const userMsg = { id: nextMessageIdRef.current++, sender: 'user', text: item.label };
    const botReply = {
      id: nextMessageIdRef.current++,
      sender: 'bot',
      text: t.live.quranWidget.presetAnswers[item.id],
      action: item.id === 'trial' ? 'trial_cta' : item.id === 'human' ? 'contact_cta' : null
    };

    setMessages((prev) => [...prev, userMsg, botReply]);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    const userMsg = { id: nextMessageIdRef.current++, sender: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.post('/api/ai/quran-assistant', {
        question: userText,
        locale: locale || 'ar'
      }, { auth: !!user });

      const replyText = res?.answer || t.live.quranWidget.fallbackReply;

      setMessages((prev) => [
        ...prev,
        { id: nextMessageIdRef.current++, sender: 'bot', text: replyText }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageIdRef.current++,
          sender: 'bot',
          text: t.live.quranWidget.errorReply,
          action: 'trial_cta'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fontClass = locale === 'ar' ? 'font-arabic' : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`wn-chat-launcher min-h-[44px] flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-3 rounded-full shadow-xl transition-all duration-300 active:scale-95 group border-2 border-emerald-300/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)] ${fontClass}`}
        aria-label={t.live.quranWidget.launcherAria}
        aria-expanded={open}
      >
        <div className="relative">
          <MessageCircle size={22} className="animate-pulse" aria-hidden="true" />
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white" />
        </div>
        <span className="text-sm font-bold hidden sm:inline">{t.live.quranWidget.launcherTitle}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t.live.quranWidget.headerTitle}
          dir={dir}
          className={`wn-chat-panel bg-[var(--wn-surface)] text-[var(--wn-text-primary)] rounded-2xl shadow-2xl border border-[var(--wn-border)] flex flex-col overflow-hidden animate-fade-in ${fontClass}`}
        >
          <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-4 flex items-center justify-between shadow-md shrink-0 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/30 border border-emerald-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Bot size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span className="truncate">{t.live.quranWidget.headerTitle}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                </h3>
                <p className="text-[11px] text-emerald-200 truncate">{t.live.quranWidget.headerSubtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.live.quranWidget.closeAria}
              className="wn-chat-close min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--wn-surface-soft)] text-sm">
            {messages.map((m) => {
              const displayText = m.isWelcome ? t.live.quranWidget.welcomeMessage : m.text;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'bot' && (
                    <div className="w-7 h-7 rounded-lg bg-[var(--wn-emerald)] text-[var(--wn-white)] flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      <Bot size={15} aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-2xl max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-sm ${
                      m.sender === 'user'
                        ? 'bg-[var(--wn-emerald)] text-[var(--wn-white)] rounded-ee-none'
                        : 'bg-[var(--wn-surface)] text-[var(--wn-text-primary)] border border-[var(--wn-border)] rounded-es-none'
                    }`}
                  >
                    <p className="text-xs sm:text-sm">{displayText}</p>

                    {m.action === 'trial_cta' && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--wn-border)] flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            navigate(localizedPath('/free-trial', locale));
                          }}
                          className="w-full min-h-[44px] py-2 px-3 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-bold rounded-lg transition shadow flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                        >
                          <Gift size={14} aria-hidden="true" />
                          <span>{t.live.quranWidget.bookFreeTrialCta}</span>
                        </button>
                      </div>
                    )}

                    {m.action === 'contact_cta' && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--wn-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            navigate(localizedPath('/contact', locale));
                          }}
                          className="w-full min-h-[44px] py-2 px-3 bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] text-[var(--wn-white)] text-xs font-bold rounded-lg transition shadow flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
                        >
                          <MessageCircle size={14} aria-hidden="true" />
                          <span>{t.live.quranWidget.contactPageCta}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-[var(--wn-surface-sunken)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] flex items-center justify-center shrink-0 mt-0.5 text-xs">
                      <User size={15} aria-hidden="true" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2 items-center text-xs text-[var(--wn-text-secondary)] bg-[var(--wn-surface)] p-2.5 rounded-xl w-fit border border-[var(--wn-border)]">
                <div className="w-4 h-4 border-2 border-[var(--wn-emerald)] border-t-transparent rounded-full animate-spin" />
                <span>{t.live.quranWidget.typing}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 bg-[var(--wn-surface)] border-t border-[var(--wn-border)] overflow-x-auto flex gap-1.5 no-scrollbar shrink-0">
            {quickQuestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleQuickQuestion(item)}
                className="whitespace-nowrap min-h-[44px] px-3 py-2 text-xs bg-[var(--wn-emerald-soft)] hover:bg-[var(--wn-mint)] text-[var(--wn-badge-emerald-text)] rounded-full border border-[var(--wn-border-mint)] transition shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
              >
                {item.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-[var(--wn-surface)] border-t border-[var(--wn-border)] flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t.live.quranWidget.inputPlaceholder}
              placeholder={t.live.quranWidget.inputPlaceholder}
              className="flex-1 min-h-[44px] border border-[var(--wn-border)] bg-[var(--wn-surface-soft)] text-[var(--wn-text-primary)] rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--wn-focus)] transition"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label={t.common.send}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center bg-[var(--wn-emerald)] hover:bg-[var(--wn-emerald-hover)] disabled:opacity-40 text-[var(--wn-white)] rounded-xl transition shrink-0 shadow-sm cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wn-focus)]"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
