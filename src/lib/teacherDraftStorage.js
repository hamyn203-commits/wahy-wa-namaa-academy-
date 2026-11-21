const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_VERIFY_KEY = 'wn_teacher_verify_session_v1';
const IDB_NAME = 'wn_teacher_draft_db_v1';
const IDB_STORE = 'draft_files';
const IDB_RECORD_KEY = 'current';

function safeJsonParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadTeacherDraft(draftKey) {
  if (typeof window === 'undefined') return null;
  let parsed;
  try {
    parsed = safeJsonParse(window.localStorage.getItem(draftKey));
  } catch {
    parsed = null;
  }
  if (!parsed) {
    try {
      parsed = safeJsonParse(window.sessionStorage.getItem(draftKey));
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > DRAFT_TTL_MS) {
    clearTeacherDraft(draftKey).catch(() => {});
    return null;
  }
  return parsed;
}

export function saveTeacherDraft(draftKey, { formData, email, step }) {
  if (typeof window === 'undefined') return;
  // Never store passwords or verification tokens in localStorage.
  const payload = JSON.stringify({
    formData,
    credentials: { email: String(email || '') },
    step: Number(step) || 1,
    savedAt: Date.now(),
  });
  try {
    window.localStorage.setItem(draftKey, payload);
  } catch {
    // Ignore storage quota / private mode errors.
  }
  try {
    window.sessionStorage.setItem(draftKey, payload);
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

export function loadVerificationSession() {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = safeJsonParse(window.sessionStorage.getItem(SESSION_VERIFY_KEY));
    if (!parsed || !parsed.verificationToken || !parsed.verifiedEmail) return null;
    // Token expires on the backend (~20m-60m); keep tab mirror bounded to 45m.
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > 45 * 60 * 1000) {
      window.sessionStorage.removeItem(SESSION_VERIFY_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveVerificationSession({ emailVerified, verifiedEmail, verificationToken }) {
  if (typeof window === 'undefined') return;
  try {
    if (!emailVerified || !verifiedEmail || !verificationToken) {
      window.sessionStorage.removeItem(SESSION_VERIFY_KEY);
      return;
    }
    window.sessionStorage.setItem(
      SESSION_VERIFY_KEY,
      JSON.stringify({
        emailVerified: true,
        verifiedEmail,
        verificationToken,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Ignore private mode errors.
  }
}

function openDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (err) {
      reject(err);
    }
  });
}

function serializeFile(file) {
  if (!file || typeof Blob === 'undefined' || !(file instanceof Blob)) return null;
  return {
    blob: file,
    name: file.name || 'attachment',
    type: file.type || 'application/octet-stream',
    lastModified: Number(file.lastModified) || Date.now(),
  };
}

function deserializeFile(entry) {
  if (!entry || !entry.blob) return null;
  try {
    if (typeof File !== 'undefined') {
      return new File([entry.blob], entry.name || 'attachment', {
        type: entry.type || entry.blob.type || 'application/octet-stream',
        lastModified: Number(entry.lastModified) || Date.now(),
      });
    }
    return entry.blob;
  } catch {
    return entry.blob;
  }
}

export async function saveTeacherDraftFiles(filesMap) {
  try {
    const db = await openDraftDb();
    if (!db) return;
    const serialized = { savedAt: Date.now(), fields: {} };
    for (const [key, val] of Object.entries(filesMap || {})) {
      if (Array.isArray(val)) {
        serialized.fields[key] = val.map(serializeFile).filter(Boolean);
      } else {
        serialized.fields[key] = serializeFile(val);
      }
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(serialized, IDB_RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  } catch {
    // Graceful no-op when IndexedDB is unavailable or quota exceeded.
  }
}

export async function loadTeacherDraftFiles() {
  try {
    const db = await openDraftDb();
    if (!db) return null;
    const record = await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    db.close();
    if (!record || !record.fields) return null;
    if (record.savedAt && Date.now() - Number(record.savedAt) > DRAFT_TTL_MS) {
      return null;
    }
    const restored = {};
    for (const [key, val] of Object.entries(record.fields)) {
      if (Array.isArray(val)) {
        restored[key] = val.map(deserializeFile).filter(Boolean);
      } else {
        restored[key] = deserializeFile(val);
      }
    }
    return restored;
  } catch {
    return null;
  }
}

export async function clearTeacherDraft(draftKey) {
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(draftKey); } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(SESSION_VERIFY_KEY); } catch { /* ignore */ }
  }
  try {
    const db = await openDraftDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    db.close();
  } catch {
    // Ignore.
  }
}
