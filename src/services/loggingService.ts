import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PatternData } from '../types';

export interface DeviceInfo {
  browser: string;
  os: string;
  isMobile: boolean;
  userAgent: string;
  screen?: string;
  language?: string;
}

export interface LocationInfo {
  ip: string;
  city: string;
  country: string;
  region: string;
  org?: string;
  displayLocation: string;
}

export interface AccessLogItem {
  id: string;
  type: 'visit' | 'exit' | 'share_created' | 'share_opened';
  timestamp: string;
  sessionId?: string;
  duration?: string;
  patternId?: string;
  patternTitle?: string;
  shareToken?: string;
  device: DeviceInfo;
  location: LocationInfo;
  shareOrigin?: {
    location: string;
    device: string;
    timestamp: string;
    ip: string;
  };
}

export interface SharedLinkMeta {
  stoken: string;
  patternId: string;
  patternTitle: string;
  createdAt: string;
  createdLocation: LocationInfo;
  createdDevice: DeviceInfo;
}

export interface ActiveUser {
  sessionId: string;
  lastActiveAt: string;
  device: DeviceInfo;
  location: LocationInfo;
}

const CACHED_LOGS_KEY = 'warpknitt_cached_logs';
const CACHED_LOC_KEY = 'warpknitt_cached_location';

export function getCachedAccessLogs(): AccessLogItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCachedAccessLogs(logs: AccessLogItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHED_LOGS_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch {
    // Ignore storage quota errors
  }
}

export function detectDeviceInfo(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return { browser: 'Bilinmiyor', os: 'Bilinmiyor', isMobile: false, userAgent: '' };
  }
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  let browser = 'Bilinmeyen Tarayıcı';
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('SamsungBrowser') > -1) browser = 'Samsung Internet';
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1) browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) browser = 'Edge';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';

  let os = 'Bilinmeyen İŞ';
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'macOS';
  else if (ua.indexOf('Linux') > -1 && ua.indexOf('Android') === -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';

  const screen = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : undefined;
  const language = typeof navigator !== 'undefined' ? navigator.language : undefined;

  return { browser, os, isMobile, userAgent: ua, screen, language };
}

let cachedLocation: LocationInfo | null = (() => {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(CACHED_LOC_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return null;
})();

let locationFetchPromise: Promise<LocationInfo> | null = null;

function getQuickFallbackLocation(): LocationInfo {
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' : 'Europe/Istanbul';
  const city = tz.split('/')[1]?.replace('_', ' ') || 'İstanbul';
  return {
    ip: 'İnternet İstemcisi',
    city,
    country: 'Türkiye',
    region: tz.split('/')[0] || 'Avrupa',
    displayLocation: `${city}, Türkiye`,
  };
}

export async function fetchLocationInfo(): Promise<LocationInfo> {
  if (cachedLocation) return cachedLocation;
  if (locationFetchPromise) return locationFetchPromise;

  locationFetchPromise = (async () => {
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          cachedLocation = {
            ip: data.ip || 'İP Belirtilmedi',
            city: data.city || 'Bilinmiyor',
            country: data.country_name || data.country || 'Türkiye',
            region: data.region || '',
            org: data.org || '',
            displayLocation: `${data.city || 'Konum'}, ${data.country_name || 'Türkiye'}`,
          };
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(CACHED_LOC_KEY, JSON.stringify(cachedLocation));
            } catch {}
          }
          return cachedLocation;
        }
      }
    } catch (e) {
      try {
        const res2 = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1500) });
        if (res2.ok) {
          const d2 = await res2.json();
          cachedLocation = {
            ip: d2.ip || 'İnternet İstemcisi',
            city: 'Yerel Ağ',
            country: 'Türkiye',
            region: '',
            displayLocation: `İP: ${d2.ip}`,
          };
          return cachedLocation;
        }
      } catch (e2) {
        // ignore
      }
    }

    cachedLocation = getQuickFallbackLocation();
    return cachedLocation;
  })();

  return locationFetchPromise;
}

// Pre-fetch location eagerly on browser runtime
if (typeof window !== 'undefined') {
  fetchLocationInfo().catch(() => {});
}

// Helper to get or create unique session ID for presence tracking
export function getSessionId(): string {
  if (typeof sessionStorage !== 'undefined') {
    let sid = sessionStorage.getItem('warpknitt_session_id');
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('warpknitt_session_id', sid);
    }
    return sid;
  }
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

// Track session start time in memory/sessionStorage
function getSessionStartTime(): number {
  if (typeof sessionStorage !== 'undefined') {
    let st = sessionStorage.getItem('warpknitt_session_start');
    if (!st) {
      st = Date.now().toString();
      sessionStorage.setItem('warpknitt_session_start', st);
    }
    return parseInt(st, 10) || Date.now();
  }
  return Date.now();
}

// Heartbeat presence ping for Live Active Users in Firestore
export async function sendPresencePing(): Promise<void> {
  const sessionId = getSessionId();
  const device = detectDeviceInfo();
  const location = cachedLocation || getQuickFallbackLocation();

  const activeUserDoc: ActiveUser = {
    sessionId,
    lastActiveAt: new Date().toISOString(),
    device,
    location,
  };

  try {
    await setDoc(doc(db, 'active_users', sessionId), activeUserDoc);
  } catch (err) {
    // Silent fail for presence ping
  }
}

// Start presence ping heartbeat loop (updates Firestore every 15 sec)
export function startPresencePing(): () => void {
  sendPresencePing();
  const interval = setInterval(() => {
    sendPresencePing();
  }, 15000);

  return () => clearInterval(interval);
}

// Log site entry/visit to Firestore and local cache
export async function logSiteVisit(): Promise<void> {
  getSessionStartTime();
  const sessionId = getSessionId();
  const device = detectDeviceInfo();
  const location = cachedLocation || (await fetchLocationInfo());
  const logId = `log-visit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const logItem: AccessLogItem = {
    id: logId,
    type: 'visit',
    timestamp: new Date().toISOString(),
    sessionId,
    device,
    location,
  };

  try {
    await setDoc(doc(db, 'access_logs', logId), logItem);
    // Append to cached logs immediately
    const existing = getCachedAccessLogs();
    saveCachedAccessLogs([logItem, ...existing.filter((l) => l.id !== logId)]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `access_logs/${logId}`);
  }

  sendPresencePing();
}

// Log site exit when tab is closed or navigated away
let hasLoggedExit = false;
export async function logSiteExit(): Promise<void> {
  if (hasLoggedExit) return;
  hasLoggedExit = true;

  const sessionId = getSessionId();
  const startTime = getSessionStartTime();
  const elapsedSecs = Math.max(1, Math.round((Date.now() - startTime) / 1000));
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  const duration = mins > 0 ? `${mins} dk ${secs} sn` : `${secs} sn`;

  const device = detectDeviceInfo();
  const location = cachedLocation || getQuickFallbackLocation();
  const logId = `log-exit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const logItem: AccessLogItem = {
    id: logId,
    type: 'exit',
    timestamp: new Date().toISOString(),
    sessionId,
    duration,
    device,
    location,
  };

  // Immediate delete of active user document on exit
  try {
    deleteDoc(doc(db, 'active_users', sessionId)).catch(() => {});
    await setDoc(doc(db, 'access_logs', logId), logItem);
  } catch (err) {
    // Ignore teardown errors
  }
}

/**
 * INSTANT pattern share link creation (0ms delay).
 * Generates stoken & URL synchronously and processes Firestore writes in background.
 */
export function createSharedPatternLink(pattern: PatternData): { url: string; stoken: string } {
  const stoken = `st-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const url = `${baseUrl}?patId=${encodeURIComponent(pattern.id)}&stoken=${encodeURIComponent(stoken)}`;

  // Background async operation (Fire-and-forget so UI returns instantly)
  (async () => {
    try {
      const device = detectDeviceInfo();
      const location = cachedLocation || (await fetchLocationInfo());

      const linkMeta: SharedLinkMeta = {
        stoken,
        patternId: pattern.id,
        patternTitle: pattern.title,
        createdAt: new Date().toISOString(),
        createdLocation: location,
        createdDevice: device,
      };

      await setDoc(doc(db, 'shared_links', stoken), linkMeta);

      const logId = `log-share-${stoken}`;
      const logItem: AccessLogItem = {
        id: logId,
        type: 'share_created',
        timestamp: new Date().toISOString(),
        patternId: pattern.id,
        patternTitle: pattern.title,
        shareToken: stoken,
        sessionId: getSessionId(),
        device,
        location,
      };

      await setDoc(doc(db, 'access_logs', logId), logItem);
    } catch (err) {
      console.error('Background share logging failed', err);
    }
  })();

  return { url, stoken };
}

// Track when someone opens a shared pattern link
export async function trackSharedLinkOpened(stoken: string, patternId: string, patternTitle?: string): Promise<SharedLinkMeta | null> {
  const device = detectDeviceInfo();
  const location = cachedLocation || (await fetchLocationInfo());

  let shareMeta: SharedLinkMeta | null = null;
  try {
    const snap = await getDoc(doc(db, 'shared_links', stoken));
    if (snap.exists()) {
      shareMeta = snap.data() as SharedLinkMeta;
    }
  } catch (e) {
    console.error('Failed to load shared link metadata', e);
  }

  const logId = `log-open-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const logItem: AccessLogItem = {
    id: logId,
    type: 'share_opened',
    timestamp: new Date().toISOString(),
    patternId,
    patternTitle: shareMeta?.patternTitle || patternTitle || 'Paylaşılan Desen',
    shareToken: stoken,
    sessionId: getSessionId(),
    device,
    location,
    shareOrigin: shareMeta
      ? {
          location: shareMeta.createdLocation.displayLocation,
          device: `${shareMeta.createdDevice.os} / ${shareMeta.createdDevice.browser} (${shareMeta.createdDevice.isMobile ? 'Mobil' : 'Masaüstü'})`,
          timestamp: shareMeta.createdAt,
          ip: shareMeta.createdLocation.ip,
        }
      : undefined,
  };

  try {
    await setDoc(doc(db, 'access_logs', logId), logItem);
    // Append to cached logs immediately
    const existing = getCachedAccessLogs();
    saveCachedAccessLogs([logItem, ...existing.filter((l) => l.id !== logId)]);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `access_logs/${logId}`);
  }

  sendPresencePing();
  return shareMeta;
}

// Subscribe to access logs for password protected Log Tab
export function subscribeToAccessLogs(onUpdate: (logs: AccessLogItem[]) => void): () => void {
  const path = 'access_logs';
  const unsub = onSnapshot(
    collection(db, 'access_logs'),
    (snap) => {
      const logs: AccessLogItem[] = [];
      snap.forEach((d) => {
        logs.push(d.data() as AccessLogItem);
      });
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      saveCachedAccessLogs(logs);
      onUpdate(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
  return unsub;
}

// Subscribe to Live Active Users (pinged within last 90 seconds)
export function subscribeToActiveUsers(onUpdate: (users: ActiveUser[]) => void): () => void {
  const unsub = onSnapshot(
    collection(db, 'active_users'),
    (snap) => {
      const now = Date.now();
      const activeWindowMs = 90 * 1000; // 90 seconds window for live online
      const activeUsers: ActiveUser[] = [];

      snap.forEach((docSnap) => {
        const u = docSnap.data() as ActiveUser;
        if (u && u.lastActiveAt) {
          const lastActiveTime = new Date(u.lastActiveAt).getTime();
          if (now - lastActiveTime < activeWindowMs) {
            activeUsers.push(u);
          }
        }
      });

      activeUsers.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
      onUpdate(activeUsers);
    },
    (err) => {
      console.warn('Active users snapshot error', err);
    }
  );
  return unsub;
}

export async function deleteAccessLog(logId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'access_logs', logId));
    const cached = getCachedAccessLogs();
    saveCachedAccessLogs(cached.filter((l) => l.id !== logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `access_logs/${logId}`);
  }
}
