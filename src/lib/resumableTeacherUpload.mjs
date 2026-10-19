// In-memory checkpointing for teacher uploads. File bytes, identity documents,
// authentication tokens and upload metadata are never written to browser storage.
export const PART_SIZE = 8 * 1024 * 1024;

const safeSize = (file) => Number.isFinite(file?.size) ? file.size : 0;

export function isTransientUploadError(error) {
  const text = String(error?.message || '');
  return /network|failed to fetch|fetch failed|load failed|offline|timeout|timed out|429|502|503|504|rate.?limit|service.?unavailable|connection/i.test(text);
}

function aborted(signal) {
  if (signal?.aborted) throw signal.reason || new Error('Upload aborted');
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Upload aborted'));
    let timer;
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason || new Error('Upload aborted'));
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

async function reconnect(signal, onState) {
  if (typeof window === 'undefined' || navigator.onLine !== false) return;
  onState('paused');
  // A dropped connection must not leave the form hanging forever.
  await new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('online', online);
      signal?.removeEventListener('abort', cancel);
    };
    const online = () => { cleanup(); resolve(); };
    const cancel = () => { cleanup(); reject(signal.reason || new Error('Upload aborted')); };
    timer = setTimeout(() => { cleanup(); reject(new Error('Network timeout')); }, 60000);
    window.addEventListener('online', online, { once: true });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    else if (navigator.onLine !== false) online();
  });
}

export async function uploadResumableParts(file, {
  scope,
  pathname,
  sessions,
  getToken,
  client,
  abortSignal,
  onUploadProgress = () => {},
  onUploadState = () => {},
  partSize = PART_SIZE,
  concurrency = 2,
  maxAttempts = 5,
}) {
  if (!file || safeSize(file) <= 0) throw new Error('Invalid upload file');
  if (!sessions || !scope || !pathname || !getToken || !client) throw new Error('Incomplete upload options');
  const count = Math.ceil(file.size / partSize);
  let fileSessions = sessions.get(file);
  if (!fileSessions) {
    fileSessions = new Map();
    sessions.set(file, fileSessions);
  }
  let session = fileSessions.get(scope);
  const tokenFor = async () => {
    aborted(abortSignal);
    return getToken(session?.pathname || pathname, abortSignal);
  };
  if (!session) {
    const token = await tokenFor();
    const start = await client.create(pathname, {
      access: 'private',
      contentType: file.type,
      token,
      abortSignal,
    });
    session = { pathname, key: start.key, uploadId: start.uploadId, parts: new Map() };
    fileSessions.set(scope, session);
  }

  const inFlight = new Map();
  const partBytes = (number) => Math.min(partSize, file.size - (number - 1) * partSize);
  const report = (status = 'uploading', finalized = false) => {
    const completed = [...session.parts.keys()].reduce((sum, number) => sum + partBytes(number), 0);
    const transferring = [...inFlight.values()].reduce((sum, bytes) => sum + bytes, 0);
    const loaded = Math.min(file.size, completed + transferring);
    onUploadProgress({
      loaded,
      total: file.size,
      // Until complete() confirms the object, do not show 100%.
      percentage: finalized ? 100 : Math.min(99, Math.floor(loaded / file.size * 100)),
      status,
    });
  };
  report(session.parts.size ? 'resuming' : 'uploading');

  let next = 1;
  let failure = null;
  const worker = async () => {
    while (!failure) {
      const number = next++;
      if (number > count) return;
      if (session.parts.has(number)) continue;
      const chunk = file.slice((number - 1) * partSize, Math.min(file.size, number * partSize));
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          aborted(abortSignal);
          await reconnect(abortSignal, onUploadState);
          onUploadState(attempt ? 'retrying' : 'uploading');
          const token = await tokenFor();
          const part = await client.uploadPart(session.pathname, chunk, {
            access: 'private',
            contentType: file.type,
            token,
            key: session.key,
            uploadId: session.uploadId,
            partNumber: number,
            abortSignal,
            onUploadProgress: (event) => {
              inFlight.set(number, Math.min(chunk.size, Math.max(0, event.loaded || 0)));
              report('uploading');
            },
          });
          inFlight.delete(number);
          session.parts.set(number, { partNumber: number, etag: part.etag });
          report();
          break;
        } catch (error) {
          inFlight.delete(number);
          report('retrying');
          if (abortSignal?.aborted || !isTransientUploadError(error) || attempt === maxAttempts - 1) {
            failure = error;
            return;
          }
          onUploadState((typeof navigator !== 'undefined' && navigator.onLine === false) ? 'paused' : 'retrying');
          try {
            await reconnect(abortSignal, onUploadState);
            await delay(Math.min(8000, 750 * (2 ** attempt)), abortSignal);
          } catch (interruption) {
            failure = interruption;
            return;
          }
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, () => worker()));
  if (failure) throw failure;
  aborted(abortSignal);
  onUploadState('finalizing');
  const parts = Array.from(session.parts.values()).sort((a, b) => a.partNumber - b.partNumber);
  if (parts.length !== count) throw new Error('Upload parts missing');
  const blob = await client.complete(session.pathname, parts, {
    access: 'private',
    contentType: file.type,
    token: await tokenFor(),
    key: session.key,
    uploadId: session.uploadId,
    abortSignal,
  });
  // Only clear the checkpoint after the storage provider confirms completion.
  fileSessions.delete(scope);
  report('complete', true);
  return blob;
}
