// Backup helpers: Web Share API (Android share sheet → Drive) + download fallback.
import { ymd } from './store.js';

export function backupPayload(state) {
  return {
    app: 'rep-workout',
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

export function backupFilename(date = ymd()) {
  return `rep-backup-${date}.json`;
}

export function backupBlob(state) {
  const json = JSON.stringify(backupPayload(state), null, 2);
  return new Blob([json], { type: 'application/json' });
}

export function canShareFiles() {
  try {
    if (typeof navigator === 'undefined' || typeof Navigator === 'undefined') return false;
    if (!navigator.share || !navigator.canShare) return false;
    const f = new File(['{}'], 't.json', { type: 'application/json' });
    return navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/** Share via Web Share API (pick Drive in the share sheet) or download. Returns 'shared' | 'downloaded' | 'aborted'. */
export async function shareOrDownloadBackup(state, { filename = backupFilename() } = {}) {
  const blob = backupBlob(state);
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: 'application/json' }) : null;
  if (file && canShareFiles()) {
    try {
      await navigator.share({
        files: [file],
        title: 'Rep backup',
        text: 'Rep workout backup — pick Drive in the share sheet to save it.',
      });
      return 'shared';
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return 'aborted';
      // fall through to download
    }
  }
  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'downloaded';
  }
  return 'downloaded';
}

/** True when we should nudge: Sunday, or 7+ days since last backup (or never). */
export function needsBackupReminder(lastBackupAt, { now = new Date(), minDays = 7 } = {}) {
  const wd = now.getDay(); // 0 = Sun
  if (!lastBackupAt) return { show: true, reason: wd === 0 ? 'sunday' : 'never' };
  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) return { show: true, reason: 'never' };
  const days = (now.getTime() - last) / 86400000;
  if (days >= minDays) return { show: true, reason: 'stale', days: Math.floor(days) };
  if (wd === 0 && days >= 1) return { show: true, reason: 'sunday', days: Math.floor(days) };
  return { show: false, days: Math.floor(days) };
}

export function formatLastBackup(lastBackupAt) {
  if (!lastBackupAt) return 'Never';
  const d = new Date(lastBackupAt);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
