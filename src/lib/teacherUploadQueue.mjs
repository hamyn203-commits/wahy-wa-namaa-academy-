// Successful uploads are cached for this page only. Never persist private
// identity documents, upload tokens or storage references to localStorage.
const bytes = (file) => Number.isFinite(file?.size) && file.size > 0 ? file.size : 1;

export async function uploadTeacherFiles(jobs, {
  upload,
  cache,
  onProgress = () => {},
  idleMs = 90000,
}) {
  const result = {};
  const total = jobs.reduce((n, job) => n + job.files.length, 0);
  const totalBytes = jobs.reduce((n, job) => n + job.files.reduce((sum, file) => sum + bytes(file), 0), 0);
  let completed = 0;
  let uploadedBytes = 0;

  const progress = ({ label, filePercentage = 0, activeBytes = 0, status = 'uploading', cached = false }) => {
    onProgress({
      label,
      completed,
      total,
      percentage: filePercentage,
      overallPercentage: totalBytes ? Math.min(completed === total ? 100 : 99, Math.round((uploadedBytes + activeBytes) / totalBytes * 100)) : 100,
      loadedBytes: uploadedBytes + activeBytes,
      totalBytes,
      status,
      cached,
    });
  };

  for (const job of jobs) {
    const values = [];
    for (const file of job.files) {
      const cached = cache.get(file)?.get(job.purpose);
      if (cached) {
        values.push(cached);
        completed++;
        uploadedBytes += bytes(file);
        progress({ label: job.label, filePercentage: 100, status: 'complete', cached: true });
        continue;
      }

      const controller = new AbortController();
      let timer;
      let timedOut = false;
      let lastLoaded = -1;
      let activeBytes = 0;
      let status = 'uploading';
      const armTimer = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, idleMs);
      };
      armTimer();
      progress({ label: job.label });
      try {
        const value = await upload(file, job.purpose, {
          resumable: true,
          abortSignal: controller.signal,
          onUploadState: (next) => {
            status = next;
            // When the connection drops, the UI should show why progress
            // paused instead of appearing unresponsive.
            progress({ label: job.label, filePercentage: Math.round(activeBytes / bytes(file) * 100), activeBytes, status });
          },
          onUploadProgress: (event) => {
            if (event.loaded > lastLoaded) {
              lastLoaded = event.loaded;
              armTimer();
            }
            activeBytes = Math.min(bytes(file), Math.max(0, event.loaded || 0));
            if (event.status) status = event.status;
            progress({
              label: job.label,
              filePercentage: Math.min(100, Math.max(0, Math.round(event.percentage || 0))),
              activeBytes,
              status,
            });
          },
        });
        const entries = cache.get(file) || new Map();
        entries.set(job.purpose, value);
        cache.set(file, entries);
        values.push(value);
        completed++;
        uploadedBytes += bytes(file);
        progress({ label: job.label, filePercentage: 100, status: 'complete' });
      } catch (cause) {
        const network = /failed to fetch|network|load failed|offline|timeout/i.test(cause?.message || '');
        const reason = timedOut
          ? 'توقف تقدم الرفع لفترة طويلة. تحقق من الاتصال ثم أعد المحاولة.'
          : network
            ? 'تعذر الاتصال بخدمة رفع الملفات. تحقق من الشبكة ثم أعد المحاولة.'
            : 'تعذر رفع الملف. تحقق من صيغته وحجمه وصلاحية تأكيد البريد، أو تواصل مع الإدارة.';
        throw new Error(job.label + ': ' + reason + ' الأجزاء والملفات المكتملة ستُستخدم عند إعادة المحاولة ما دمت في نفس الصفحة.', { cause });
      } finally {
        clearTimeout(timer);
      }
    }
    result[job.key] = job.multiple ? values : values[0] || null;
  }
  return result;
}
