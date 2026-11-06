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

export function getClientAuthorId(): string {
  if (typeof window === 'undefined') return 'author_default';
  let id = localStorage.getItem('warpknitt_client_author_id');
  if (!id) {
    id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('warpknitt_client_author_id', id);
  }
  return id;
}

export async function savePatternToCloud(pattern: PatternData): Promise<void> {
  const path = `patterns/${pattern.id}`;
  try {
    const authorId = pattern.authorId || getClientAuthorId();
    const patternDoc = {
      id: pattern.id,
      authorId,
      title: pattern.title,
      category: pattern.category,
      description: pattern.description || '',
      difficulty: pattern.difficulty || 'Orta',
      thumbnail: pattern.thumbnail || '',
      createdAt: pattern.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rows: pattern.rows,
      guideBars: pattern.guideBars,
      machine: pattern.machine,
      safety: pattern.safety,
      repeatX: pattern.repeatX || 1,
      repeatY: pattern.repeatY || 1,
    };
    await setDoc(doc(db, 'patterns', pattern.id), patternDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePatternFromCloud(patternId: string): Promise<void> {
  const path = `patterns/${patternId}`;
  try {
    await deleteDoc(doc(db, 'patterns', patternId));
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
      onUpdate(patterns);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
  return unsub;
}
