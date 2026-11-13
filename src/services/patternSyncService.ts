import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PatternData } from '../types';

const CACHED_PATTERNS_KEY = 'warpknitt_cached_patterns';

export function getCachedPatterns(): PatternData[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_PATTERNS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCachedPatterns(patterns: PatternData[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHED_PATTERNS_KEY, JSON.stringify(patterns));
  } catch {
    // Ignore storage quota
  }
}

export function getClientAuthorId(): string {
  if (typeof window === 'undefined') return 'author_default';
  let id = localStorage.getItem('warpknitt_client_author_id');
  if (!id) {
    id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('warpknitt_client_author_id', id);
  }
  return id;
}

/**
 * Saves a pattern to the shared Firestore cloud library.
 * Accessible and visible to ALL connected users in real-time.
 */
export async function savePatternToCloud(pattern: PatternData): Promise<void> {
  const path = `patterns/${pattern.id}`;
  try {
    const authorId = pattern.authorId || 'common_library';
    const nowIso = new Date().toISOString();
    const patternDoc = {
      id: pattern.id,
      authorId,
      title: pattern.title,
      category: pattern.category || 'Halı & Zemin',
      description: pattern.description || '',
      difficulty: pattern.difficulty || 'Orta',
      thumbnail: pattern.thumbnail || '',
      createdAt: pattern.createdAt || nowIso,
      updatedAt: nowIso,
      rows: pattern.rows,
      guideBars: pattern.guideBars,
      machine: pattern.machine,
      safety: pattern.safety,
      repeatX: pattern.repeatX || 1,
      repeatY: pattern.repeatY || 1,
      ...(pattern.mayDensity !== undefined ? { mayDensity: pattern.mayDensity } : {}),
      ...(pattern.rackTensionRows !== undefined ? { rackTensionRows: pattern.rackTensionRows } : {}),
      ...(pattern.isRackManualOverride !== undefined ? { isRackManualOverride: pattern.isRackManualOverride } : {}),
      ...(pattern.rackNote !== undefined ? { rackNote: pattern.rackNote } : {}),
      ...(pattern.tableExtras !== undefined
        ? { tableExtras: JSON.parse(JSON.stringify(pattern.tableExtras)) }
        : {}),
    };

    // Always update local cache immediately for instant offline/mobile UX
    const cached = getCachedPatterns();
    const updated = [pattern, ...cached.filter((p) => p.id !== pattern.id)];
    saveCachedPatterns(updated);

    await setDoc(doc(db, 'patterns', pattern.id), patternDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes a pattern from the shared Firestore cloud library.
 * Instantly removes it for all users globally.
 */
export async function deletePatternFromCloud(patternId: string): Promise<void> {
  const path = `patterns/${patternId}`;
  try {
    await deleteDoc(doc(db, 'patterns', patternId));
    const cached = getCachedPatterns();
    saveCachedPatterns(cached.filter((p) => p.id !== patternId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchPatternsFromCloud(): Promise<PatternData[]> {
  const path = 'patterns';
  try {
    const snap = await getDocs(collection(db, 'patterns'));
    const patterns: PatternData[] = [];
    snap.forEach((d) => {
      patterns.push(d.data() as PatternData);
    });
    return patterns;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Real-time subscription to the shared community library in Firestore.
 * Automatically notifies when anyone adds, edits, or deletes a pattern.
 */
export function subscribeToCloudPatterns(
  onUpdate: (patterns: PatternData[]) => void
): () => void {
  const path = 'patterns';
  const unsub = onSnapshot(
    collection(db, 'patterns'),
    (snap) => {
      const patterns: PatternData[] = [];
      snap.forEach((d) => {
        patterns.push(d.data() as PatternData);
      });
      // Sort newest first
      patterns.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      saveCachedPatterns(patterns);
      onUpdate(patterns);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
  return unsub;
}

/**
 * Seeds default patterns into Firestore if the cloud library is currently empty.
 */
export async function seedDefaultPatternsIfNeeded(defaultPatterns: PatternData[]): Promise<void> {
  try {
    const existing = await fetchPatternsFromCloud();
    if (existing.length === 0 && defaultPatterns.length > 0) {
      for (const pat of defaultPatterns) {
        await savePatternToCloud(pat);
      }
    }
  } catch (err) {
    console.warn('Default pattern seed skipped or already present:', err);
  }
}
