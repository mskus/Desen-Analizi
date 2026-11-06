import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PatternData } from '../types';

export interface DeviceInfo {
  browser: string;
  os: string;
  isMobile: boolean;
  userAgent: string;
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
  type: 'visit' | 'share_created' | 'share_opened';
  timestamp: string;
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

  return { browser, os, isMobile, userAgent: ua };
}

let cachedLocation: LocationInfo | null = null;

export async function fetchLocationInfo(): Promise<LocationInfo> {
  if (cachedLocation) return cachedLocation;

  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
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
        return cachedLocation;
      }
    }
  } catch (e) {
    // Secondary fallback
    try {
      const res2 = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
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
      // Ignore
    }
  }

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul' : 'Europe/Istanbul';
  const city = tz.split('/')[1]?.replace('_', ' ') || 'İstanbul';
  cachedLocation = {
    ip: 'İnternet Bağlantısı',
    city,
    country: 'Türkiye',
    region: tz.split('/')[0] || 'Avrupa',
    displayLocation: `${city}, Türkiye`,
  };
  return cachedLocation;
}

// Log initial site visit (throttled to once per session)
export async function logSiteVisit(): Promise<void> {
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem('warpknitt_visit_logged')) return;
    sessionStorage.setItem('warpknitt_visit_logged', 'true');
  }

  const device = detectDeviceInfo();
  const location = await fetchLocationInfo();
  const logId = `log-visit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const path = `access_logs/${logId}`;

  const logItem: AccessLogItem = {
    id: logId,
    type: 'visit',
    timestamp: new Date().toISOString(),
    device,
    location,
  };

  try {
    await setDoc(doc(db, 'access_logs', logId), logItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Generate shared link & log creation event with origin details
export async function createSharedPatternLink(pattern: PatternData): Promise<{ url: string; stoken: string }> {
  const device = detectDeviceInfo();
  const location = await fetchLocationInfo();
  const stoken = `st-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  
  const linkMeta: SharedLinkMeta = {
    stoken,
    patternId: pattern.id,
    patternTitle: pattern.title,
    createdAt: new Date().toISOString(),
    createdLocation: location,
    createdDevice: device,
  };

  // 1. Save link metadata to shared_links collection
  try {
    await setDoc(doc(db, 'shared_links', stoken), linkMeta);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shared_links/${stoken}`);
  }

  // 2. Log share creation event
  const logId = `log-share-${stoken}`;
  const logItem: AccessLogItem = {
    id: logId,
    type: 'share_created',
    timestamp: new Date().toISOString(),
    patternId: pattern.id,
    patternTitle: pattern.title,
    shareToken: stoken,
    device,
    location,
  };

  try {
    await setDoc(doc(db, 'access_logs', logId), logItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `access_logs/${logId}`);
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const url = `${baseUrl}?patId=${encodeURIComponent(pattern.id)}&stoken=${encodeURIComponent(stoken)}`;
  return { url, stoken };
}

// Track when someone opens a shared pattern link
export async function trackSharedLinkOpened(stoken: string, patternId: string, patternTitle?: string): Promise<SharedLinkMeta | null> {
  const device = detectDeviceInfo();
  const location = await fetchLocationInfo();

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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `access_logs/${logId}`);
  }

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
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
  return unsub;
}

export async function deleteAccessLog(logId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'access_logs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `access_logs/${logId}`);
  }
}
