import { PatternRow, GuideBarId, SafetyConfig, GuideBarConfig } from '../types';

export type LoopType = 'open' | 'closed' | 'miss' | 'tuck';

export interface LoopCellInfo {
  type: LoopType;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  direction: 'left' | 'right' | 'straight';
  underlapSpan: number;
  isValid: boolean;
  invalidReason: string | null;
  currentVal: number;
  prevVal: number;
}

export interface LoopWarningItem {
  id: string;
  courseIndex: number;
  gbId: GuideBarId;
  message: string;
  severity: 'error' | 'warning';
  needle: number;
}

export const LOOP_DEFINITIONS = [
  {
    id: 'open',
    name: 'Açık İlmek (Open Loop)',
    symbol: 'Ω',
    code: '[O]',
    color: '#38bdf8',
    bg: 'bg-sky-950/60',
    border: 'border-sky-500/50',
    description: 'Çözgü ipliği iğne kancasına zıt yönde dolanır, açık bacaklı ilmek verir.',
  },
  {
    id: 'closed',
    name: 'Kapalı İlmek (Closed Loop)',
    symbol: '⋈',
    code: '[C]',
    color: '#a855f7',
    bg: 'bg-purple-950/60',
    border: 'border-purple-500/50',
    description: 'Çözgü ipliği iğne kancasına aynı yönde dolanır, bacakları çaprazlanır.',
  },
  {
    id: 'tuck',
    name: 'Yükleme / Doku (Tuck)',
    symbol: '◠',
    code: '[T]',
    color: '#f59e0b',
    bg: 'bg-amber-950/60',
    border: 'border-amber-500/50',
    description: 'Eski ilmek dökülmeden iğne kancasına yeni iplik eklenir, hacimli yüzey oluşturur.',
  },
  {
    id: 'miss',
    name: 'Atlama / Yüzer (Miss / Float)',
    symbol: '—',
    code: '[M]',
    color: '#94a3b8',
    bg: 'bg-slate-900',
    border: 'border-slate-700/60',
    description: 'İğne hareket etmez, iplik kumaş arkasında yüzer kordon oluşturur.',
  },
];

export const QUICK_LOOP_PRESETS = [
  {
    id: 'tricot',
    name: 'Zikzak / Triko (1-0/1-2)',
    loopType: 'open',
    coursesToAdd: 2,
    sequence: [0, 1],
    description: 'Klasik 2 kurslu temel çözgülü örme ilmeği.',
  },
  {
    id: 'mesh',
    name: 'Açık Gözenek / File (2-3/1-0)',
    loopType: 'open',
    coursesToAdd: 2,
    sequence: [3, 0],
    description: 'Yüksek hava geçirgenlikli file gözenek yapısı.',
  },
  {
    id: 'velvet',
    name: 'Kadife Havlı Bukle (3-4/1-0)',
    loopType: 'closed',
    coursesToAdd: 2,
    sequence: [4, 0],
    description: 'Uzun salınımlı kadife ve halı bukle hav yapısı.',
  },
  {
    id: 'satin',
    name: 'Atlas / Saten (1-0/3-4)',
    loopType: 'closed',
    coursesToAdd: 2,
    sequence: [0, 4],
    description: 'Pürüzsüz parlak yüzeyli çözgü saten örgüsü.',
  },
];

export function analyzeCellLoop(
  row: PatternRow,
  prevRow: PatternRow | null,
  nextRow: PatternRow | null,
  gbId: GuideBarId,
  safety: SafetyConfig,
  needleCols: number
): LoopCellInfo {
  const currentVal = row[gbId] ?? 0;
  const prevVal = prevRow ? (prevRow[gbId] ?? currentVal) : currentVal;
  const nextVal = nextRow ? (nextRow[gbId] ?? currentVal) : currentVal;

  const explicitType = row.loopTypes?.[gbId];

  // Calculate underlap jump from previous course
  const jumpFromPrev = currentVal - prevVal;
  const jumpToNext = nextVal - currentVal;
  const underlapSpan = Math.abs(jumpFromPrev);

  // Check validity
  let isValid = true;
  let invalidReason: string | null = null;

  const maxJump = safety?.maxSafeShoggingJump || 4;
  if (underlapSpan > maxJump) {
    isValid = false;
    invalidReason = `Sıçrama ${underlapSpan} iğne! (Maksimum Güvenli Sınır: ${maxJump})`;
  } else if (currentVal < 0 || currentVal >= needleCols) {
    isValid = false;
    invalidReason = `İğne pozisyonu ${currentVal} yatak sınırları dışında! (0 - ${needleCols - 1})`;
  }

  // Derive loop type if not explicitly overridden
  let type: LoopType = explicitType || 'open';
  if (!explicitType) {
    if (jumpFromPrev === 0) {
      type = 'miss';
    } else if ((jumpFromPrev > 0 && jumpToNext < 0) || (jumpFromPrev < 0 && jumpToNext > 0)) {
      type = 'open';
    } else if ((jumpFromPrev > 0 && jumpToNext > 0) || (jumpFromPrev < 0 && jumpToNext < 0)) {
      type = 'closed';
    } else {
      type = 'open';
    }
  }

  let direction: 'left' | 'right' | 'straight' = 'straight';
  if (jumpFromPrev > 0) direction = 'right';
  else if (jumpFromPrev < 0) direction = 'left';

  const styleMap: Record<LoopType, { label: string; bg: string; text: string; border: string }> = {
    open: {
      label: 'Açık İlmek [O]',
      bg: 'bg-blue-950/80',
      text: 'text-blue-400',
      border: 'border-blue-500/60',
    },
    closed: {
      label: 'Kapalı İlmek [C]',
      bg: 'bg-emerald-950/80',
      text: 'text-emerald-400',
      border: 'border-emerald-500/60',
    },
    miss: {
      label: 'Atlama / Yüzer [M]',
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-700/60',
    },
    tuck: {
      label: 'Yükleme / Doku [T]',
      bg: 'bg-amber-950/80',
      text: 'text-amber-400',
      border: 'border-amber-500/60',
    },
  };

  const currentStyle = styleMap[type];

  return {
    type,
    label: currentStyle.label,
    badgeBg: currentStyle.bg,
    badgeText: currentStyle.text,
    badgeBorder: currentStyle.border,
    direction,
    underlapSpan,
    isValid,
    invalidReason,
    currentVal,
    prevVal,
  };
}

export function computeNeedleValueForLoop(
  prevVal: number,
  targetType: LoopType,
  spanDelta: number,
  needleCols: number,
  maxJump: number
): number {
  if (targetType === 'miss') {
    return prevVal; // Float at same needle
  }

  const clampedSpan = Math.max(1, Math.min(maxJump, Math.abs(spanDelta)));
  const direction = spanDelta >= 0 ? 1 : -1;

  let targetVal = prevVal + clampedSpan * direction;
  return Math.max(0, Math.min(needleCols - 1, targetVal));
}

export const PHOTO_MACHINE_PATTERN_ROWS: PatternRow[] = [
  { id: 'p1', courseIndex: 1, stepIndex: 1, GB1: 0, GB2: 0, GB3: 9, GB4: 0, GB5: 9, GB6: 0, notation: '9-10-9-10' },
  { id: 'p2', courseIndex: 2, stepIndex: 2, GB1: 0, GB2: 0, GB3: 10, GB4: 0, GB5: 10, GB6: 0, notation: '10-9-10-9' },
  { id: 'p3', courseIndex: 3, stepIndex: 3, GB1: 0, GB2: 0, GB3: 9, GB4: 0, GB5: 9, GB6: 0, notation: '9-10-9-10' },
  { id: 'p4', courseIndex: 4, stepIndex: 4, GB1: 0, GB2: 0, GB3: 10, GB4: 0, GB5: 10, GB6: 0, notation: '10-9-10-9' },
];

export function autoFixInvalidRowCell(
  row: PatternRow,
  prevRow: PatternRow | null,
  gbId: GuideBarId,
  safety: SafetyConfig,
  needleCols: number
): PatternRow {
  const currentVal = row[gbId] ?? 0;
  const prevVal = prevRow ? (prevRow[gbId] ?? currentVal) : currentVal;
  const maxJump = safety?.maxSafeShoggingJump || 4;

  const diff = currentVal - prevVal;
  const direction = diff >= 0 ? 1 : -1;
  const clampedSpan = Math.min(maxJump, Math.abs(diff));

  let fixedVal = prevVal + clampedSpan * direction;
  fixedVal = Math.max(0, Math.min(needleCols - 1, fixedVal));

  return {
    ...row,
    [gbId]: fixedVal,
    loopTypes: {
      ...(row.loopTypes || {}),
      [gbId]: 'open', // Reset to valid open loop
    },
  };
}

export function synthesizeAutoLoopsFromDraft(
  rows: PatternRow[],
  guideBars?: any,
  maxNeedles?: number,
  preferredType: LoopType = 'open'
): PatternRow[] {
  return rows.map((r) => ({
    ...r,
    loopTypes: {
      GB1: preferredType,
      GB2: preferredType,
      GB3: preferredType,
      GB4: preferredType,
      GB5: preferredType,
      GB6: preferredType,
      ...(r.loopTypes || {}),
    },
  }));
}

export function convert4StepsToDraftRows(rows: PatternRow[]): PatternRow[] {
  return rows.map((r, idx) => ({
    ...r,
    courseIndex: idx + 1,
  }));
}

export function appendLoopCoursesToRows(
  rows: PatternRow[],
  gbId: GuideBarId,
  preset: any,
  baseNeedle: number,
  maxNeedles: number,
  guideBars?: Record<GuideBarId, GuideBarConfig>
): { updatedRows: PatternRow[]; coursesAdded: number } {
  const seq = preset.sequence || [0, 1];
  const newRows = [...rows];

  seq.forEach((val: number, idx: number) => {
    const nextIdx = newRows.length + 1;
    const targetNeedle = Math.max(0, Math.min(maxNeedles - 1, baseNeedle + val));

    newRows.push({
      id: `app-loop-${Date.now()}-${idx}`,
      courseIndex: nextIdx,
      GB1: gbId === 'GB1' ? targetNeedle : newRows[newRows.length - 1]?.GB1 || 0,
      GB2: gbId === 'GB2' ? targetNeedle : newRows[newRows.length - 1]?.GB2 || 0,
      GB3: gbId === 'GB3' ? targetNeedle : newRows[newRows.length - 1]?.GB3 || 0,
      GB4: gbId === 'GB4' ? targetNeedle : newRows[newRows.length - 1]?.GB4 || 0,
      GB5: gbId === 'GB5' ? targetNeedle : newRows[newRows.length - 1]?.GB5 || 0,
      GB6: gbId === 'GB6' ? targetNeedle : newRows[newRows.length - 1]?.GB6 || 0,
      loopTypes: {
        [gbId]: preset.loopType || 'open',
      },
    });
  });

  return {
    updatedRows: newRows,
    coursesAdded: seq.length,
  };
}

export function autoFixWarningInRows(
  rows: PatternRow[],
  warning: any,
  safety: SafetyConfig,
  needleCols: number
): PatternRow[] {
  return rows.map((r, idx) => {
    if (idx + 1 === warning.courseIndex) {
      const prevRow = idx > 0 ? rows[idx - 1] : null;
      return autoFixInvalidRowCell(r, prevRow, warning.gbId as GuideBarId, safety, needleCols);
    }
    return r;
  });
}
