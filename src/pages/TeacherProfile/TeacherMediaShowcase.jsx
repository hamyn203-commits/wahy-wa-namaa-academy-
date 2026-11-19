import { useState } from 'react';
import { Headphones, Play, Video, Volume2 } from 'lucide-react';

export default function TeacherMediaShowcase({
  mediaItems = [],
  audioItems = [],
  copy,
}) {
  const [activeKey, setActiveKey] = useState('');

  if (!mediaItems.length && !audioItems.length) {
    return (
      <section id="teacher-media-showcase" className="wn-tp-card p-5 md:p-6">
        <div className="flex items-center gap-3 text-[var(--wn-text-secondary)]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--wn-emerald-soft)] text-[var(--wn-badge-emerald-text)]">
            <Video size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-[var(--wn-heading)]">{copy.mediaTitle}</h2>
            <p className="text-sm text-[var(--wn-text-tertiary)]">{copy.noMedia}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="teacher-media-showcase" className="wn-tp-card p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--wn-heading)] flex items-center gap-2">
            <Video size={19} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            <span>{copy.mediaTitle}</span>
          </h2>
          <p className="mt-1 text-xs text-[var(--wn-text-secondary)]">{copy.mediaSubtitle}</p>
        </div>
      </div>

      {mediaItems.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {mediaItems.map((item) => {
            const isPlaying = activeKey === item.key;
            const isRecitation = item.key === 'recitation' || item.key.startsWith('additional-');
            return (
              <div key={item.key} className="overflow-hidden rounded-2xl border border-[var(--wn-border)] bg-[var(--wn-surface-soft)]">
                {isPlaying ? (
                  <div>
                    <video
                      key={item.url}
                      controls
                      autoPlay
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full bg-[var(--wn-emerald-deep)]"
                    >
                      <source src={item.url} />
                    </video>
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold text-[var(--wn-heading)]">
                      <span className="flex items-center gap-1.5">
                        {isRecitation ? <Volume2 size={14} aria-hidden="true" /> : <Video size={14} aria-hidden="true" />}
                        {item.title}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveKey(item.key)}
                    className="wn-tp-media-facade flex aspect-video w-full flex-col items-center justify-center gap-3 p-4 text-center"
                  >
                    <span className="grid h-14 w-14 place-items-center rounded-full border border-[var(--wn-gold)] bg-[var(--wn-gold)] text-[var(--wn-emerald-deep)] shadow-md">
                      <Play size={22} fill="currentColor" aria-hidden="true" />
                    </span>
                    <div>
                      <strong className="block text-sm font-extrabold text-[var(--wn-white)]">{item.title}</strong>
                      <span className="mt-0.5 inline-block text-xs text-[var(--wn-gold-soft)]">{copy.clickToPlay}</span>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {audioItems.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <h3 className="text-sm font-bold text-[var(--wn-heading)] flex items-center gap-2">
            <Headphones size={16} className="text-[var(--wn-emerald)]" aria-hidden="true" />
            <span>{copy.audioTitle}</span>
          </h3>
          <div className="grid gap-3">
            {audioItems.map((audio, index) => (
              <div
                key={audio}
                className="flex flex-col gap-2 rounded-xl border border-[var(--wn-border-mint)] bg-[var(--wn-emerald-soft)] p-3.5"
              >
                <span className="text-xs font-bold text-[var(--wn-badge-emerald-text)]">
                  {String(copy.audioClipLabel || 'Audio clip {index}').replace('{index}', String(index + 1))}
                </span>
                <audio controls preload="none" className="w-full">
                  <source src={audio} />
                </audio>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
