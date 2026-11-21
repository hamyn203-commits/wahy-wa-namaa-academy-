import { useState } from 'react';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Camera,
  Video,
  Images,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n';

function fileExtension(name = '') {
  const index = String(name).lastIndexOf('.');
  return index >= 0 ? String(name).slice(index).toLowerCase() : '';
}

function formatMb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function extensionForMime(type = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return map[String(type || '').toLowerCase()] || '';
}

function ensureFilename(file, captureKind) {
  if (!file || fileExtension(file.name)) return file;
  const extension = extensionForMime(file.type);
  if (!extension) return file;

  const prefix = captureKind === 'video' ? 'camera-video' : 'camera-photo';
  return new File(
    [file],
    `${prefix}-${Date.now()}${extension}`,
    { type: file.type, lastModified: file.lastModified || Date.now() }
  );
}

function formatMsg(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v ?? '')),
    String(template || '')
  );
}

export default function FileBox({
  id,
  label,
  hint,
  accept,
  multiple,
  file,
  files,
  onChange,
  preview,
  maxBytes,
  allowedMimeTypes,
  allowedExtensions,
  captureKind,
}) {
  const { t } = useI18n();
  const fb = t?.teacherRegistration?.fileBox || {};
  const [error, setError] = useState('');
  const count = multiple ? (files?.length || 0) : (file ? 1 : 0);

  const validate = (item) => {
    if (maxBytes && item.size > maxBytes) {
      return formatMsg(
        fb.errTooLarge || 'حجم الملف "{name}" هو {mb} MB. الحد الأقصى {maxMb} MB.',
        { name: item.name, mb: formatMb(item.size), maxMb: formatMb(maxBytes) }
      );
    }

    if (item.size <= 0) {
      return formatMsg(
        fb.errEmpty || 'الملف "{name}" فارغ أو غير صالح.',
        { name: item.name }
      );
    }

    if (allowedMimeTypes?.length && !allowedMimeTypes.includes(item.type)) {
      return formatMsg(
        fb.errUnsupportedType || 'نوع الملف "{name}" غير مدعوم.',
        { name: item.name }
      );
    }

    if (allowedExtensions?.length && !allowedExtensions.includes(fileExtension(item.name))) {
      return formatMsg(
        fb.errUnsupportedExt || 'امتداد الملف "{name}" غير مدعوم.',
        { name: item.name }
      );
    }

    return '';
  };

  const applyFiles = (rawFiles, { append = false } = {}) => {
    const selected = rawFiles.map((item) => ensureFilename(item, captureKind));
    if (!selected.length) return;

    for (const item of selected) {
      const validationError = validate(item);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError('');

    if (multiple) {
      const base = append ? (files || []) : [];
      const merged = [...base, ...selected].filter((item, index, all) => (
        all.findIndex((candidate) => (
          candidate.name === item.name
          && candidate.size === item.size
          && candidate.lastModified === item.lastModified
        )) === index
      ));
      onChange(merged);
      return;
    }

    onChange(selected[0]);
  };

  const handleLibraryChange = (event) => {
    const selected = Array.from(event.target.files || []);
    applyFiles(selected, { append: Boolean(multiple && count) });
    event.target.value = '';
  };

  const handleCaptureChange = (event) => {
    const selected = Array.from(event.target.files || []);
    applyFiles(selected, { append: Boolean(multiple) });
    event.target.value = '';
  };

  const clearSelection = () => {
    setError('');
    onChange(multiple ? [] : null);
  };

  const cameraLabel = captureKind === 'video'
    ? (fb.recordVideo || 'تسجيل فيديو بالكاميرا')
    : (fb.capturePhoto || 'التقاط بالكاميرا');

  const CameraIcon = captureKind === 'video' ? Video : Camera;
  const isVideoBox = captureKind === 'video';
  const selectedList = multiple ? (files || []) : (file ? [file] : []);

  const primaryBtnCls = 'relative inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-[var(--wn-emerald)] text-[var(--wn-text-inverse)] rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--wn-emerald-hover)] focus-within:ring-2 focus-within:ring-[var(--wn-focus)] focus-within:ring-offset-2';
  const secondaryBtnCls = 'relative inline-flex min-h-[44px] items-center gap-2 px-4 py-2 bg-[var(--wn-surface)] border border-[var(--wn-border)] text-[var(--wn-text-primary)] rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--wn-emerald-soft)] hover:border-[var(--wn-border-mint)] focus-within:ring-2 focus-within:ring-[var(--wn-focus)] focus-within:ring-offset-2';

  const libraryPicker = (
    <label htmlFor={`${id}-library`} className={isVideoBox ? primaryBtnCls : secondaryBtnCls}>
      <input
        type="file"
        id={`${id}-library`}
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={handleLibraryChange}
      />
      {captureKind ? <Images size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
      {captureKind
        ? (multiple && count ? (fb.addFromGallery || 'إضافة من الألبوم/الجهاز') : (fb.pickFromGallery || 'اختيار من الألبوم/الجهاز'))
        : (count ? formatMsg(fb.selectedChange || 'تم ({count}) — تغيير', { count }) : (fb.pickFile || 'اختر ملف'))}
    </label>
  );

  const cameraPicker = captureKind ? (
    <label htmlFor={`${id}-camera`} className={isVideoBox ? secondaryBtnCls : primaryBtnCls}>
      <input
        type="file"
        id={`${id}-camera`}
        accept={isVideoBox ? 'video/*' : 'image/*'}
        capture="user"
        className="sr-only"
        onChange={handleCaptureChange}
      />
      <CameraIcon size={16} aria-hidden="true" /> {cameraLabel}
    </label>
  ) : null;

  return (
    <div className="border-2 border-dashed border-[var(--wn-border)] rounded-xl p-5 hover:border-[var(--wn-emerald)] transition bg-[var(--wn-surface-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--wn-heading)]">{label}</p>
          {hint && <p className="text-xs text-[var(--wn-text-secondary)] mt-1">{hint}</p>}
          {maxBytes && (
            <p className="text-xs text-[var(--wn-text-secondary)] mt-1">
              {formatMsg(fb.maxSizeLabel || 'الحد الأقصى لكل ملف: {maxMb} MB', { maxMb: formatMb(maxBytes) })}
            </p>
          )}
        </div>
        {count > 0 && <CheckCircle className="text-[var(--wn-emerald)] shrink-0" size={20} aria-hidden="true" />}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--wn-danger)]/30 bg-[var(--wn-danger-soft)] px-3 py-2 text-xs text-[var(--wn-text-danger)]"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isVideoBox ? (
          <>
            {libraryPicker}
            {cameraPicker}
          </>
        ) : (
          <>
            {cameraPicker}
            {libraryPicker}
          </>
        )}

        {count > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex min-h-[44px] items-center gap-2 px-3 py-2 text-sm text-[var(--wn-text-danger)] hover:bg-[var(--wn-danger-soft)] rounded-lg"
          >
            <Trash2 size={15} aria-hidden="true" /> {fb.clearSelection || 'مسح الاختيار'}
          </button>
        )}
      </div>

      {isVideoBox && count === 0 && (
        <p className="mt-2.5 text-xs text-[var(--wn-text-secondary)]">
          {fb.mobileVideoTip || 'نصيحة للموبايل: سجّل الفيديو بكاميرا هاتفك أولاً ثم اختره من الألبوم لضمان عدم انقطاع الصفحة.'}
        </p>
      )}

      {selectedList.length > 0 && (
        <ul className="mt-3 space-y-1">
          {selectedList.map((item, idx) => (
            <li
              key={`${item.name || 'file'}-${item.size || 0}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-[var(--wn-emerald-soft)] border border-[var(--wn-border-mint)] px-3 py-1.5 text-xs text-[var(--wn-badge-emerald-text)]"
            >
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 font-semibold" dir="ltr">{formatMb(item.size)} MB</span>
            </li>
          ))}
        </ul>
      )}

      {preview && file && (
        <div className="mt-3">{preview(file)}</div>
      )}
    </div>
  );
}
