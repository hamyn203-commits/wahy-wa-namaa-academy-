import { useEffect, useId, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { formatMsg, useFocusTrapDialog } from './adminFormat';

// Protected assets never receive a public URL. We fetch with the administrator's
// existing authorization, create a temporary blob URL, then revoke it on close.
function describePlaybackError(code, type, playbackErrors) {
  const contentType = String(type || '').toLowerCase();
  if (contentType.includes('quicktime')) {
    return playbackErrors.quicktime || 'MOV / QuickTime format: ask tutor to upload MP4 (H.264 + AAC).';
  }
  if (code === 4) {
    return playbackErrors.code4 || 'Unsupported video codec. Prefer MP4 (H.264 + AAC).';
  }
  if (code === 3) {
    return playbackErrors.code3;
  }
  if (code === 2) {
    return playbackErrors.code2;
  }
  if (code === 1) return playbackErrors.code1;
  return playbackErrors.fallback;
}

export default function TeacherAssetViewer({ teacherId, asset, loader, onClose }) {
  const { dir, t } = useI18n();
  const av = t.adminPortal.dossiers.assetViewer;
  const titleId = useId();
  const panelRef = useRef(null);
  const [preview, setPreview] = useState({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const latestLoader = useRef(loader);
  const avRef = useRef(av);
  // The dashboard refreshes its queue and creates new callback identities. Do not
  // restart an actively playing video just because the parent re-rendered.
  useEffect(() => { latestLoader.current = loader; }, [loader]);
  useEffect(() => { avRef.current = av; }, [av]);
  const { kind, index, category } = asset;

  useFocusTrapDialog(Boolean(asset), onClose, panelRef);

  useEffect(() => {
    let active = true;
    let ownedObjectUrl = null;
    setPreview({ status: 'loading' });

    Promise.resolve()
      .then(() => latestLoader.current(teacherId, kind, index))
      .then((result) => {
        if (!active) return;
        const isBlob = result instanceof Blob;
        if (isBlob && result.size === 0) throw new Error(avRef.current.emptyBlobError);
        const isTrustedUrl = typeof result?.url === 'string' && (
          /^https:\/\//i.test(result.url) ||
          result.url.startsWith('/api/teachers/admin-media-range/')
        );
        if (!isBlob && !isTrustedUrl) {
          throw new Error(avRef.current.invalidUrlError);
        }
        const safeImageMime = isBlob && ['image/jpeg', 'image/png', 'image/webp'].includes(String(result.type || '').toLowerCase());
        const format = category === 'document'
          ? (safeImageMime ? 'image' : result.type === 'application/pdf' ? 'pdf' : 'other')
          : kind === 'profilePhoto' ? (isBlob && !safeImageMime ? 'other' : 'image') : kind === 'audioRecordings' ? 'audio' : 'video';
        if (isBlob) ownedObjectUrl = URL.createObjectURL(result);
        setPreview({
          status: 'ready',
          url: isBlob ? ownedObjectUrl : result.url,
          format,
          playbackError: false,
          temporary: !isBlob,
          streamingMode: isBlob ? 'local-blob' : result.streamingMode,
          contentType: isBlob ? result.type : result.contentType,
          sizeBytes: isBlob ? result.size : result.sizeBytes,
          streamingChecked: isBlob ? true : result.streamingChecked,
        });
      })
      .catch((error) => {
        if (active) setPreview({ status: 'error', message: error?.message || avRef.current.loadFailedError });
      });

    return () => {
      active = false;
      if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
    };
  }, [teacherId, kind, index, category, retryKey]);

  return (
    <div className="wn-admin-asset-viewer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={panelRef}
        tabIndex={-1}
        className="wn-admin-asset-viewer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={formatMsg(av.ariaLabel, { label: asset.label })}
        dir={dir}
      >
        <header className="wn-admin-asset-viewer__header">
          <div><h3 id={titleId}>{asset.label}</h3><p>{av.subtitle}</p></div>
          <button type="button" onClick={onClose} aria-label={av.closeAria}><X size={22} aria-hidden="true" /></button>
        </header>
        <div className="wn-admin-asset-viewer__content">
          {preview.status === 'loading' ? (
            <p className="wn-admin-asset-viewer__message" role="status">{av.loading}</p>
          ) : preview.status === 'error' ? (
            <p className="wn-admin-asset-viewer__message is-error" role="alert">
              {formatMsg(av.errorPrefix, { message: preview.message })}
              <br />
              {av.errorHint}
            </p>
          ) : (
            <>
              {preview.format === 'image' ? <img src={preview.url} alt={asset.label} /> : null}
              {preview.format === 'video' ? (
                <video
                  src={preview.url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={(event) => {
                    const code = event.currentTarget.error?.code || 0;
                    setPreview((current) => (current.url === preview.url ? { ...current, playbackError: true, playbackErrorCode: code } : current));
                  }}
                >
                  {av.videoUnsupported}
                </video>
              ) : null}
              {preview.format === 'audio' ? <audio src={preview.url} controls preload="metadata" /> : null}
              {preview.format === 'pdf' ? (
                <p className="wn-admin-asset-viewer__message">{av.pdfNote}</p>
              ) : null}
              {preview.format === 'other' ? (
                <p className="wn-admin-asset-viewer__message">{av.unsupportedNote}</p>
              ) : null}
              {preview.playbackError ? (
                <p className="wn-admin-asset-viewer__message is-error" role="alert">
                  {describePlaybackError(preview.playbackErrorCode, preview.contentType, av.playbackErrors || {})}
                </p>
              ) : null}
            </>
          )}
        </div>
        {preview.status === 'ready' && preview.contentType ? (
          <p className="wn-admin-asset-viewer__metadata">
            {formatMsg(av.metaType, { type: preview.contentType })}
            {preview.sizeBytes ? ` · ${formatMsg(av.metaSize, { size: (preview.sizeBytes / 1024 / 1024).toFixed(1) })}` : ''}
            {preview.temporary && preview.streamingChecked === false ? ` · ${av.metaUnchecked}` : ''}
          </p>
        ) : null}
        {preview.status === 'ready' && preview.format === 'video' && String(preview.contentType).toLowerCase().includes('quicktime') ? (
          <p className="wn-admin-asset-viewer__message is-error">{av.movAlert}</p>
        ) : null}
        <footer className="wn-admin-asset-viewer__footer">
          {preview.status === 'ready' && preview.streamingMode !== 'authenticated-range' ? (
            <a href={preview.url} download={`teacher-review-${asset.kind}`} rel="noreferrer" referrerPolicy="no-referrer">
              <Download size={17} aria-hidden="true" /> {av.download}
            </a>
          ) : <span />}
          {preview.status === 'ready' && preview.streamingMode === 'authenticated-range' ? (
            <span className="wn-admin-asset-viewer__range-note">{av.rangeNote}</span>
          ) : null}
          {preview.status === 'error' || preview.playbackError ? (
            <button type="button" className="wn-admin-asset-viewer__retry" onClick={() => setRetryKey((count) => count + 1)}>
              {av.retry}
            </button>
          ) : null}
          <button type="button" onClick={onClose}>{av.closeAria}</button>
        </footer>
      </section>
    </div>
  );
}
