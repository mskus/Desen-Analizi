import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GuideBarId, PatternData } from '../types';
import {
  createCarpetGuideBars,
  createThreadingArray,
  defaultMachine,
  defaultSafetyConfig,
} from '../data/patternLibrary';

const CACHED_PATTERNS_KEY = 'warpknitt_cached_patterns';
const DELETED_IDS_STORAGE_KEY = 'warpknitt_deleted_pattern_ids';
const DEFAULTS_SEEDED_KEY = 'warpknitt_defaults_seeded_v1';
export const SYSTEM_DELETED_DOC_ID = '__system_deleted_ids__';

export function parsePatternTimestamp(
  pat: Pick<PatternData, 'updatedAt' | 'createdAt'>
): number {
  const candidates = [pat.updatedAt, pat.createdAt];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const str = raw.trim();
    if (!str) continue;

    // 1. Turkish format: DD.MM.YYYY or DD.MM.YYYY HH:mm(:ss)
    const trMatch = str.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
    );
    if (trMatch) {
      const day = parseInt(trMatch[1], 10);
      const month = parseInt(trMatch[2], 10) - 1;
      const year = parseInt(trMatch[3], 10);
      const hour = trMatch[4] ? parseInt(trMatch[4], 10) : 0;
      const minute = trMatch[5] ? parseInt(trMatch[5], 10) : 0;
      const second = trMatch[6] ? parseInt(trMatch[6], 10) : 0;
      const ms = new Date(year, month, day, hour, minute, second).getTime();
      if (!Number.isNaN(ms)) return ms;
    }

    // 2. Standard ISO / RFC date string
    const parsed = Date.parse(str);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

export function sortPatternsBySaveTime(patterns: PatternData[]): PatternData[] {
  return [...patterns].sort((a, b) => parsePatternTimestamp(b) - parsePatternTimestamp(a));
}

export function getDeletedPatternIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function saveDeletedPatternIdsLocal(ids: string[]): string[] {
  const unique = Array.from(
    new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0 && id !== SYSTEM_DELETED_DOC_ID))
  );
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(unique));
    } catch {
      // Ignore storage quota
    }
  }
  return unique;
}

async function syncDeletedIdsTombstoneToCloud(
  deletedIds: string[],
  defaultsSeeded = true
): Promise<void> {
  const path = `patterns/${SYSTEM_DELETED_DOC_ID}`;
  try {
    await setDoc(doc(db, 'patterns', SYSTEM_DELETED_DOC_ID), {
      id: SYSTEM_DELETED_DOC_ID,
      authorId: 'system',
      title: SYSTEM_DELETED_DOC_ID,
      category: 'Teknik',
      deletedIds,
      defaultsSeeded,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function normalizePatternData(raw: unknown): PatternData | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<PatternData>;
  if (typeof p.id !== 'string' || !p.id.trim() || p.id === SYSTEM_DELETED_DOC_ID) return null;

  const baseGuideBars = createCarpetGuideBars();
  const rawGuideBars = (p.guideBars && typeof p.guideBars === 'object' ? p.guideBars : {}) as Partial<
    PatternData['guideBars']
  >;
  const guideBars = { ...baseGuideBars };
  (['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'] as GuideBarId[]).forEach((gbId) => {
    const merged = {
      ...baseGuideBars[gbId],
      ...(rawGuideBars[gbId] || {}),
      id: gbId,
    };
    if (!Array.isArray(merged.threadingArray) || merged.threadingArray.length === 0) {
      merged.threadingArray = createThreadingArray(merged.threading || 'Full');
    }
    guideBars[gbId] = merged;
  });

  return {
    ...(p as PatternData),
    id: p.id,
    title: typeof p.title === 'string' && p.title.trim() ? p.title : p.id,
    category: typeof p.category === 'string' && p.category.trim() ? p.category : 'Halı & Zemin',
    description: typeof p.description === 'string' ? p.description : '',
    difficulty: p.difficulty === 'Kolay' || p.difficulty === 'Orta' || p.difficulty === 'İleri' ? p.difficulty : 'Orta',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
    rows: Array.isArray(p.rows) ? p.rows : [],
    guideBars,
    machine: { ...defaultMachine, ...(p.machine && typeof p.machine === 'object' ? p.machine : {}) },
    safety: { ...defaultSafetyConfig, ...(p.safety && typeof p.safety === 'object' ? p.safety : {}) },
    repeatX: typeof p.repeatX === 'number' && p.repeatX > 0 ? p.repeatX : 1,
    repeatY: typeof p.repeatY === 'number' && p.repeatY > 0 ? p.repeatY : 1,
  };
}

export function getCachedPatterns(): PatternData[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_PATTERNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deletedSet = new Set(getDeletedPatternIds());
    const valid = parsed
      .map((item) => normalizePatternData(item))
      .filter((item): item is PatternData => item !== null && !deletedSet.has(item.id));
    return sortPatternsBySaveTime(valid);
  } catch {
    return [];
  }
}

export function saveCachedPatterns(patterns: PatternData[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHED_PATTERNS_KEY, JSON.stringify(sortPatternsBySaveTime(patterns)));
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
export async function savePatternToCloud(
  pattern: PatternData,
  options?: { preserveTimestamp?: boolean }
): Promise<void> {
  const path = `patterns/${pattern.id}`;
  try {
    const authorId = pattern.authorId || 'common_library';
    const nowIso = new Date().toISOString();
    const effectiveUpdatedAt = options?.preserveTimestamp
      ? pattern.updatedAt
      : nowIso;

    const patternToSave: PatternData = {
      ...pattern,
      authorId,
      createdAt: pattern.createdAt || nowIso,
      ...(effectiveUpdatedAt ? { updatedAt: effectiveUpdatedAt } : {}),
    };

    const patternDoc = {
      id: patternToSave.id,
      authorId,
      title: patternToSave.title,
      category: patternToSave.category || 'Halı & Zemin',
      description: patternToSave.description || '',
      difficulty: patternToSave.difficulty || 'Orta',
      thumbnail: patternToSave.thumbnail || '',
      createdAt: patternToSave.createdAt,
      ...(effectiveUpdatedAt ? { updatedAt: effectiveUpdatedAt } : {}),
      rows: patternToSave.rows,
      guideBars: patternToSave.guideBars,
      machine: patternToSave.machine,
      safety: patternToSave.safety,
      repeatX: patternToSave.repeatX || 1,
      repeatY: patternToSave.repeatY || 1,
      ...(patternToSave.mayDensity !== undefined ? { mayDensity: patternToSave.mayDensity } : {}),
      ...(patternToSave.rackTensionRows !== undefined
        ? { rackTensionRows: patternToSave.rackTensionRows }
        : {}),
      ...(patternToSave.isRackManualOverride !== undefined
        ? { isRackManualOverride: patternToSave.isRackManualOverride }
        : {}),
      ...(patternToSave.rackNote !== undefined ? { rackNote: patternToSave.rackNote } : {}),
      ...(patternToSave.tableExtras !== undefined
        ? { tableExtras: JSON.parse(JSON.stringify(patternToSave.tableExtras)) }
        : {}),
    };

    // If this pattern ID was previously marked deleted, restore it cleanly
    const currentDeleted = getDeletedPatternIds();
    if (currentDeleted.includes(patternToSave.id)) {
      const remainingDeleted = saveDeletedPatternIdsLocal(
        currentDeleted.filter((id) => id !== patternToSave.id)
      );
      syncDeletedIdsTombstoneToCloud(remainingDeleted, true).catch(() => {});
    }

    // Always update local cache immediately for instant offline/mobile UX
    const cached = getCachedPatterns();
    const updated = sortPatternsBySaveTime([
      patternToSave,
      ...cached.filter((p) => p.id !== patternToSave.id),
    ]);
    saveCachedPatterns(updated);

    await setDoc(doc(db, 'patterns', patternToSave.id), patternDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes a pattern from the shared Firestore cloud library.
 * Permanently suppresses default-pattern resurrection and removes it for all users globally.
 */
export async function deletePatternFromCloud(patternId: string): Promise<void> {
  const path = `patterns/${patternId}`;
  try {
    const mergedDeleted = saveDeletedPatternIdsLocal([...getDeletedPatternIds(), patternId]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
    }
    const cached = getCachedPatterns();
    saveCachedPatterns(cached.filter((p) => p.id !== patternId));

    await deleteDoc(doc(db, 'patterns', patternId));
    await syncDeletedIdsTombstoneToCloud(mergedDeleted, true);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchPatternsFromCloud(): Promise<{
  patterns: PatternData[];
  deletedIds: string[];
  defaultsSeeded: boolean;
}> {
  const path = 'patterns';
  try {
    const snap = await getDocs(collection(db, 'patterns'));
    const patterns: PatternData[] = [];
    let cloudDeletedIds: string[] = [];
    let defaultsSeeded = false;

    snap.forEach((d) => {
      if (d.id === SYSTEM_DELETED_DOC_ID) {
        const meta = d.data() as { deletedIds?: unknown; defaultsSeeded?: unknown };
        if (Array.isArray(meta.deletedIds)) {
          cloudDeletedIds = meta.deletedIds.filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0
          );
        }
        if (meta.defaultsSeeded === true || cloudDeletedIds.length > 0) {
          defaultsSeeded = true;
        }
        return;
      }
      const normalized = normalizePatternData(d.data());
      if (normalized) patterns.push(normalized);
    });

    const mergedDeleted = saveDeletedPatternIdsLocal([...getDeletedPatternIds(), ...cloudDeletedIds]);
    const deletedSet = new Set(mergedDeleted);
    const filtered = sortPatternsBySaveTime(patterns.filter((p) => !deletedSet.has(p.id)));

    return {
      patterns: filtered,
      deletedIds: mergedDeleted,
      defaultsSeeded,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {
      patterns: [],
      deletedIds: getDeletedPatternIds(),
      defaultsSeeded: false,
    };
  }
}

/**
 * Real-time subscription to the shared community library in Firestore.
 * Automatically notifies when anyone adds, edits, or deletes a pattern.
 */
export function subscribeToCloudPatterns(
  onUpdate: (patterns: PatternData[], deletedIds: string[]) => void
): () => void {
  const path = 'patterns';
  const unsub = onSnapshot(
    collection(db, 'patterns'),
    (snap) => {
      const patterns: PatternData[] = [];
      let cloudDeletedIds: string[] = [];

      snap.forEach((d) => {
        if (d.id === SYSTEM_DELETED_DOC_ID) {
          const meta = d.data() as { deletedIds?: unknown; defaultsSeeded?: unknown };
          if (Array.isArray(meta.deletedIds)) {
            cloudDeletedIds = meta.deletedIds.filter(
              (id): id is string => typeof id === 'string' && id.trim().length > 0
            );
          }
          if (
            (meta.defaultsSeeded === true || cloudDeletedIds.length > 0) &&
            typeof localStorage !== 'undefined'
          ) {
            localStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
          }
          return;
        }
        const normalized = normalizePatternData(d.data());
        if (normalized) patterns.push(normalized);
      });

      const mergedDeleted = saveDeletedPatternIdsLocal([
        ...getDeletedPatternIds(),
        ...cloudDeletedIds,
      ]);
      const deletedSet = new Set(mergedDeleted);
      const visiblePatterns = sortPatternsBySaveTime(
        patterns.filter((p) => !deletedSet.has(p.id))
      );

      saveCachedPatterns(visiblePatterns);
      onUpdate(visiblePatterns, mergedDeleted);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
  return unsub;
}

/**
 * Seeds default patterns into Firestore ONLY once on initial setup when library has never been seeded
 * and no patterns have been deleted yet.
 */
export async function seedDefaultPatternsIfNeeded(defaultPatterns: PatternData[]): Promise<void> {
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DEFAULTS_SEEDED_KEY) === '1'
    ) {
      return;
    }

    const { patterns: existing, deletedIds, defaultsSeeded } = await fetchPatternsFromCloud();
    if (defaultsSeeded || deletedIds.length > 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
      }
      return;
    }

    if (existing.length === 0 && defaultPatterns.length > 0) {
      const deletedSet = new Set(deletedIds);
      for (const pat of defaultPatterns) {
        if (deletedSet.has(pat.id)) continue;
        await savePatternToCloud(pat, { preserveTimestamp: true });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEFAULTS_SEEDED_KEY, '1');
      }
      await syncDeletedIdsTombstoneToCloud(deletedIds, true);
    }
  } catch (err) {
    console.warn('Default pattern seed skipped or already present:', err);
  }
}
