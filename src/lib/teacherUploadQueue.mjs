// Keep successful uploads in memory only; never persist identity documents or tokens.
export async function uploadTeacherFiles(
  jobs,
  { upload, cache, onProgress = () => {}, idleMs = 90000, maxRetries = 0, retryDelayMs = 1200 }
) {
  const result = {};
  const total = jobs.reduce((n, job) => n + job.files.length, 0);
  let completed = 0;
  for (const job of jobs) {
    const values = [];
    for (const file of job.files) {
      const cached = cache.get(file)?.get(job.purpose);
      if (cached) {
        values.push(cached);
        onProgress({ label: job.label, completed: ++completed, total, percentage: 100 });
        continue;
      }

      let attempt = 0;
      let uploadedValue = null;
      while (attempt <= maxRetries) {
        const controller = new AbortController();
        let timer;
        let timedOut = false;
        let lastLoaded = -1;
        const armTimer = () => {
          clearTimeout(timer);
          timer = setTimeout(() => { timedOut = true; controller.abort(); }, idleMs);
        };
        armTimer();
        onProgress({ label: job.label, completed, total, percentage: 0 });
        try {
          uploadedValue = await upload(file, job.purpose, {
            abortSignal: controller.signal,
            onUploadProgress: (event) => {
              if (event.loaded > lastLoaded) {
                lastLoaded = event.loaded;
                armTimer();
              }
              onProgress({
                label: job.label,
                completed,
                total,
                percentage: Math.min(100, Math.max(0, Math.round(event.percentage || 0))),
              });
            },
          });
          break;
        } catch (cause) {
          const network = /failed to fetch|network|load failed/i.test(cause?.message || '');
          const retryable = timedOut || network;
          if (retryable && attempt < maxRetries) {
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
            continue;
          }
          const reason = timedOut
            ? 'توقف تقدم الرفع لمدة طويلة. تحقق من الاتصال ثم أعد المحاولة.'
            : network
              ? 'تعذر الاتصال بخدمة رفع الملفات. تحقق من الشبكة ثم أعد المحاولة.'
              : 'تعذر رفع الملف. تحقق من صيغته وحجمه وصلاحية تأكيد البريد، أو تواصل مع الإدارة.';
          throw new Error(job.label + ': ' + reason + ' الملفات المكتملة ستُستخدم عند إعادة المحاولة ما دمت في نفس الصفحة.', { cause });
        } finally {
          clearTimeout(timer);
        }
      }

      const entries = cache.get(file) || new Map();
      entries.set(job.purpose, uploadedValue);
      cache.set(file, entries);
      values.push(uploadedValue);
      onProgress({ label: job.label, completed: ++completed, total, percentage: 100 });
    }
    result[job.key] = job.multiple ? values : values[0] || null;
  }
  return result;
}
