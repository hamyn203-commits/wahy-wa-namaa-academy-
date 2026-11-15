import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

// Protected assets never receive a public URL. We fetch with the administrator's
// existing authorization, create a temporary blob URL, then revoke it on close.
function describePlaybackError(code, type) {
  const contentType = String(type || '').toLowerCase();
  if (contentType.includes('quicktime')) {
    return 'الملف مرفوع بصيغة MOV / QuickTime، وقد لا يعمل على Chrome في ويندوز. يُرجى من المعلم تحويله إلى MP4 بترميز H.264 للصورة وAAC للصوت ثم إعادة رفعه.';
  }
  if (code === 4) {
    return 'المتصفح لا يستطيع قراءة محتوى هذا الفيديو. قد يكون ترميز الفيديو غير مدعوم أو الملف غير مكتمل. يُرجى تجربة الملف الأصلي، ثم إعادة رفعه بصيغة MP4 (H.264 + AAC) عند الحاجة.';
  }
  if (code === 3) {
    return 'فشل المتصفح في فك ترميز الفيديو. يُفضَّل تحويل الملف إلى MP4 بترميز H.264 + AAC ثم إعادة رفعه.';
  }
  if (code === 2) {
    return 'انقطع وصول المتصفح إلى خادم الفيديو. أعد المحاولة، وإذا تكرر الخطأ راجع اتصال الشبكة.';
  }
  if (code === 1) return 'تم إيقاف تحميل الفيديو من المتصفح. اضغط إعادة المحاولة.';
  return 'تعذر تشغيل الفيديو رغم إصدار رابط المعاينة. راجع تنسيق الملف أو أعد المحاولة.';
}

export default function TeacherAssetViewer({ teacherId, asset, loader, onClose }) {
  const [preview, setPreview] = useState({ status: 'loading' });
  const [retryKey, setRetryKey] = useState(0);
  const latestLoader = useRef(loader);
  // The dashboard refreshes its queue and creates new callback identities. Do not
  // restart an actively playing video just because the parent re-rendered.
  useEffect(() => { latestLoader.current = loader; }, [loader]);
  const { kind, index, category } = asset;

  useEffect(() => {
    let active = true;
    let ownedObjectUrl = null;
    setPreview({ status: 'loading' });

    Promise.resolve()
      .then(() => latestLoader.current(teacherId, kind, index))
      .then((result) => {
        if (!active) return;
        const isBlob = result instanceof Blob;
        if (isBlob && result.size === 0) throw new Error('الملف فارغ أو غير متاح.');
        const isTrustedUrl = typeof result?.url === 'string' && (
          /^https:\/\//i.test(result.url) ||
          result.url.startsWith('/api/teachers/admin-media-range/')
        );
        if (!isBlob && !isTrustedUrl) {
          throw new Error('لم يصل رابط تشغيل صالح من الخادم.');
        }
        const safeImageMime = isBlob && ['image/jpeg', 'image/png', 'image/webp'].includes(String(result.type || '').toLowerCase());
        const format = category === 'document'
          ? (safeImageMime ? 'image' : result.type === 'application/pdf' ? 'pdf' : 'other')
          : kind === 'profilePhoto' ? (isBlob && !safeImageMime ? 'other' : 'image') : kind === 'audioRecordings' ? 'audio' : 'video';
        if (isBlob) ownedObjectUrl = URL.createObjectURL(result);
        setPreview({ status: 'ready', url: isBlob ? ownedObjectUrl : result.url, format, playbackError: false, temporary: !isBlob, streamingMode: isBlob ? 'local-blob' : result.streamingMode, contentType: isBlob ? result.type : result.contentType, sizeBytes: isBlob ? result.size : result.sizeBytes, streamingChecked: isBlob ? true : result.streamingChecked });
      })
      .catch((error) => {
        if (active) setPreview({ status: 'error', message: error?.message || 'تعذر تحميل الملف.' });
      });

    return () => {
      active = false;
      if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl);
    };
  }, [teacherId, kind, index, category, retryKey]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="wn-admin-asset-viewer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="wn-admin-asset-viewer__panel" role="dialog" aria-modal="true" aria-label={`معاينة ${asset.label}`} dir="rtl">
        <header className="wn-admin-asset-viewer__header">
          <div><h3>{asset.label}</h3><p>معاينة الملف داخل لوحة الإدارة — دون مغادرة الأكاديمية</p></div>
          <button type="button" onClick={onClose} aria-label="إغلاق المعاينة"><X size={22} /></button>
        </header>
        <div className="wn-admin-asset-viewer__content">
          {preview.status === 'loading' ? (
            <p className="wn-admin-asset-viewer__message" role="status">جاري تحميل الملف… قد يستغرق الفيديو الكبير بعض الوقت.</p>
          ) : preview.status === 'error' ? (
            <p className="wn-admin-asset-viewer__message is-error" role="alert">تعذرت معاينة الملف: {preview.message}<br />تحقق من اتصال الإنترنت ثم أعد المحاولة.</p>
          ) : (
            <>
              {preview.format === 'image' ? <img src={preview.url} alt={asset.label} /> : null}
              {preview.format === 'video' ? (
                <video
                  src={preview.url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={(event) => { const code = event.currentTarget.error?.code || 0; setPreview((current) => current.url === preview.url ? { ...current, playbackError: true, playbackErrorCode: code } : current); }}
                >
                  المتصفح لا يدعم تشغيل هذا الفيديو.
                </video>
              ) : null}
              {preview.format === 'audio' ? <audio src={preview.url} controls preload="metadata" /> : null}
              {preview.format === 'pdf' ? (
                <p className="wn-admin-asset-viewer__message">
                  ملف PDF جاهز للمراجعة الآمنة — يُرجى استخدام زر التنزيل بالأسفل لفتحه عبر عارض المستندات المعزول.
                </p>
              ) : null}
              {preview.format === 'other' ? (
                <p className="wn-admin-asset-viewer__message">هذا النوع من الملفات غير مدعوم للمعاينة المباشرة. يمكن تنزيله للمراجعة.</p>
              ) : null}
              {preview.playbackError ? (
                <p className="wn-admin-asset-viewer__message is-error" role="alert">{describePlaybackError(preview.playbackErrorCode, preview.contentType)}</p>
              ) : null}
            </>
          )}
        </div>
        {preview.status === 'ready' && preview.contentType ? (
          <p className="wn-admin-asset-viewer__metadata">
            نوع الملف: {preview.contentType}
            {preview.sizeBytes ? ` · الحجم: ${(preview.sizeBytes / 1024 / 1024).toFixed(1)} ميجابايت` : ''}
            {preview.temporary && preview.streamingChecked === false ? ' · لم يتم التأكد من الاستجابة المباشرة للتخزين' : ''}
          </p>
        ) : null}
        {preview.status === 'ready' && preview.format === 'video' && String(preview.contentType).toLowerCase().includes('quicktime') ? (
          <p className="wn-admin-asset-viewer__message is-error">تنبيه: صيغة MOV قد لا تعمل على Chrome. الأفضل رفع MP4 بترميز H.264 وAAC.</p>
        ) : null}
        <footer className="wn-admin-asset-viewer__footer">
          {preview.status === 'ready' && preview.streamingMode !== 'authenticated-range' ? (
            <a href={preview.url} download={`teacher-review-${asset.kind}`} rel="noreferrer" referrerPolicy="no-referrer"><Download size={17} /> تنزيل الملف عند الحاجة</a>
          ) : <span />}
          {preview.status === 'ready' && preview.streamingMode === 'authenticated-range' ? (
            <span className="wn-admin-asset-viewer__range-note">المعاينة تعمل بتحميل الأجزاء المطلوبة من الفيديو فقط.</span>
          ) : null}
          {preview.status === 'error' || preview.playbackError ? (
            <button type="button" className="wn-admin-asset-viewer__retry" onClick={() => setRetryKey((count) => count + 1)}>إعادة المحاولة</button>
          ) : null}
          <button type="button" onClick={onClose}>إغلاق المعاينة</button>
        </footer>
      </section>
    </div>
  );
}
