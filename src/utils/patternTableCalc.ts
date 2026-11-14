import { GuideBarId, PatternData, PatternTableExtrasData, RackTensionRow } from '../types';

export type StitchLoopMode = 'double_bed' | 'front_bed' | 'back_bed' | 'inlay';
export type SkipBehaviorMode = 'front_skip' | 'back_skip' | 'full_skip';
export type DescendingStartMode = 'low_first' | 'high_first';

export const ALL_GB_IDS: GuideBarId[] = ['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'];

export const DEFAULT_HRD6_MODES: Record<GuideBarId, StitchLoopMode> = {
  GB1: 'double_bed',
  GB2: 'front_bed',
  GB3: 'double_bed',
  GB4: 'double_bed',
  GB5: 'back_bed',
  GB6: 'double_bed',
};

export const ALL_DOUBLE_MODES: Record<GuideBarId, StitchLoopMode> = {
  GB1: 'double_bed',
  GB2: 'double_bed',
  GB3: 'double_bed',
  GB4: 'double_bed',
  GB5: 'double_bed',
  GB6: 'double_bed',
};

export const DEFAULT_DESCENDING_MODES: Record<GuideBarId, DescendingStartMode> = {
  GB1: 'low_first',
  GB2: 'low_first',
  GB3: 'low_first',
  GB4: 'low_first',
  GB5: 'low_first',
  GB6: 'low_first',
};

export interface ComputedStepRow {
  rowKey: string;
  courseIndex: number;
  sourceCourseIndex?: number;
  stepInCourse: 1 | 2 | 3 | 4;
  globalStepIndex: number;
  values: Record<GuideBarId, number>;
  sourceValues: Record<GuideBarId, number>;
  skippedBars: Partial<Record<GuideBarId, boolean>>;
  isInserted?: boolean;
  customLabel?: string;
}

export interface CustomTableStepRow {
  id: string;
  label?: string;
  values: Record<GuideBarId, number>;
  skippedBars?: Partial<Record<GuideBarId, boolean>>;
}

export interface TableCalcSettings {
  barModes: Record<GuideBarId, StitchLoopMode>;
  skipBehavior: SkipBehaviorMode;
  loopWidth: number;
  descendingStartModes: Record<GuideBarId, DescendingStartMode>;
  descendingStartMode?: DescendingStartMode;
}

const TABLE_SETTINGS_STORAGE_KEY = 'warpknitt_table_settings';

export function loadSavedTableSettings(): TableCalcSettings {
  try {
    const raw = localStorage.getItem(TABLE_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const legacyMode: DescendingStartMode =
        parsed.descendingStartMode === 'high_first' ? 'high_first' : 'low_first';
      const rawPerBar = parsed.descendingStartModes || {};
      const descendingStartModes: Record<GuideBarId, DescendingStartMode> = {
        GB1: rawPerBar.GB1 === 'high_first' || rawPerBar.GB1 === 'low_first' ? rawPerBar.GB1 : legacyMode,
        GB2: rawPerBar.GB2 === 'high_first' || rawPerBar.GB2 === 'low_first' ? rawPerBar.GB2 : legacyMode,
        GB3: rawPerBar.GB3 === 'high_first' || rawPerBar.GB3 === 'low_first' ? rawPerBar.GB3 : legacyMode,
        GB4: rawPerBar.GB4 === 'high_first' || rawPerBar.GB4 === 'low_first' ? rawPerBar.GB4 : legacyMode,
        GB5: rawPerBar.GB5 === 'high_first' || rawPerBar.GB5 === 'low_first' ? rawPerBar.GB5 : legacyMode,
        GB6: rawPerBar.GB6 === 'high_first' || rawPerBar.GB6 === 'low_first' ? rawPerBar.GB6 : legacyMode,
      };
      return {
        barModes: { ...DEFAULT_HRD6_MODES, ...(parsed.barModes || {}) },
        skipBehavior:
          parsed.skipBehavior === 'front_skip' ||
          parsed.skipBehavior === 'back_skip' ||
          parsed.skipBehavior === 'full_skip'
            ? parsed.skipBehavior
            : 'front_skip',
        loopWidth: parsed.loopWidth === 2 ? 2 : 1,
        descendingStartModes,
        descendingStartMode: legacyMode,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    barModes: { ...DEFAULT_HRD6_MODES },
    skipBehavior: 'front_skip',
    loopWidth: 1,
    descendingStartModes: { ...DEFAULT_DESCENDING_MODES },
    descendingStartMode: 'low_first',
  };
}

export function saveTableSettings(settings: TableCalcSettings): void {
  try {
    localStorage.setItem(TABLE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Computes 4 machine steps per course cyclically across ALL courses for a full guide bar series without mutating pattern data.
 * Evaluates every course relative to its preceding course in the full pattern repeat (including Course N -> Course 1):
 * - Starts from an anchor course where needle position changes (`values[k] !== prev`) so Course 1 through Course N all obey the exact same rising/descending/plateau rules.
 * - Rising (`n > prevN`): starts low (`N -> N+loopWidth`).
 * - Descending (`n < prevN`): follows `descendingStartMode` (`low_first`: `N -> N+loopWidth`, `high_first`: `N+loopWidth -> N`).
 * - Plateau (`n === prevN`): alternates strictly from `prevEnd` so consecutive courses never duplicate.
 * - When all courses share the exact same needle value, starts at `low -> high` on Course 1 and alternates cleanly across subsequent courses.
 */
export function computeGuideBarFourStepSeries(
  values: number[],
  skips: boolean[],
  mode: StitchLoopMode,
  loopWidth: number,
  skipBehavior: SkipBehaviorMode,
  descendingStartMode: DescendingStartMode = 'low_first'
): Array<[number, number, number, number]> {
  const count = values.length;
  if (count === 0) return [];

  if (mode === 'inlay') {
    return values.map((v) => {
      const n = v ?? 0;
      return [n, n, n, n];
    });
  }

  const result: Array<[number, number, number, number]> = new Array(count);

  // Find first transition anchor across the entire cyclic repeat so Course 1 also respects wrap-around from the last course
  let anchorIdx = -1;
  if (count > 1) {
    for (let i = 0; i < count; i++) {
      const cur = values[i] ?? 0;
      const prev = values[(i - 1 + count) % count] ?? 0;
      if (cur !== prev) {
        anchorIdx = i;
        break;
      }
    }
  }

  const startIdx = anchorIdx >= 0 ? anchorIdx : 0;
  let prevN = values[(startIdx - 1 + count) % count] ?? 0;
  let prevEnd = prevN;

  for (let step = 0; step < count; step++) {
    const idx = (startIdx + step) % count;
    const n = values[idx] ?? 0;
    const isSkipped = Boolean(skips[idx]);

    const low = n;
    const high = n + loopWidth;

    let a: number;
    let b: number;

    if (count === 1 || (anchorIdx === -1 && step === 0)) {
      a = low;
      b = high;
    } else if (n > prevN) {
      a = low;
      b = high;
    } else if (n < prevN) {
      if (descendingStartMode === 'high_first') {
        a = high;
        b = low;
      } else {
        a = low;
        b = high;
      }
    } else {
      if (prevEnd >= high) {
        a = high;
        b = low;
      } else {
        a = low;
        b = high;
      }
    }

    let steps: [number, number, number, number];

    if (isSkipped) {
      if (skipBehavior === 'full_skip') {
        steps = [n, n, n, n];
      } else if (skipBehavior === 'front_skip') {
        if (mode === 'front_bed') {
          steps = [a, a, a, a];
        } else {
          steps = [a, a, a, b];
        }
      } else {
        if (mode === 'back_bed') {
          steps = [a, a, a, a];
        } else {
          steps = [a, b, b, b];
        }
      }
    } else if (mode === 'front_bed') {
      steps = [a, b, b, b];
    } else if (mode === 'back_bed') {
      steps = [a, a, a, b];
    } else {
      steps = [a, b, a, b];
    }

    result[idx] = steps;
    prevN = n;
    prevEnd = steps[3];
  }

  return result;
}

export function resolveDescendingModesMap(
  input?: Record<GuideBarId, DescendingStartMode> | DescendingStartMode
): Record<GuideBarId, DescendingStartMode> {
  if (!input) return { ...DEFAULT_DESCENDING_MODES };
  if (typeof input === 'string') {
    const m: DescendingStartMode = input === 'high_first' ? 'high_first' : 'low_first';
    return { GB1: m, GB2: m, GB3: m, GB4: m, GB5: m, GB6: m };
  }
  return { ...DEFAULT_DESCENDING_MODES, ...input };
}

export function buildExpandedFourStepRows(
  rows: PatternData['rows'],
  barModes: Record<GuideBarId, StitchLoopMode>,
  loopWidth: number,
  skipBehavior: SkipBehaviorMode,
  descendingStartInput: Record<GuideBarId, DescendingStartMode> | DescendingStartMode = DEFAULT_DESCENDING_MODES
): ComputedStepRow[] {
  if (!rows || rows.length === 0) return [];

  const descModes = resolveDescendingModesMap(descendingStartInput);

  const stepsByBar: Record<GuideBarId, Array<[number, number, number, number]>> = {
    GB1: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB1 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB1)),
      barModes.GB1,
      loopWidth,
      skipBehavior,
      descModes.GB1
    ),
    GB2: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB2 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB2)),
      barModes.GB2,
      loopWidth,
      skipBehavior,
      descModes.GB2
    ),
    GB3: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB3 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB3)),
      barModes.GB3,
      loopWidth,
      skipBehavior,
      descModes.GB3
    ),
    GB4: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB4 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB4)),
      barModes.GB4,
      loopWidth,
      skipBehavior,
      descModes.GB4
    ),
    GB5: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB5 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB5)),
      barModes.GB5,
      loopWidth,
      skipBehavior,
      descModes.GB5
    ),
    GB6: computeGuideBarFourStepSeries(
      rows.map((r) => r.GB6 ?? 0),
      rows.map((r) => Boolean(r.skips?.GB6)),
      barModes.GB6,
      loopWidth,
      skipBehavior,
      descModes.GB6
    ),
  };

  const result: ComputedStepRow[] = [];

  rows.forEach((row, rIdx) => {
    const sourceValues: Record<GuideBarId, number> = {
      GB1: row.GB1 ?? 0,
      GB2: row.GB2 ?? 0,
      GB3: row.GB3 ?? 0,
      GB4: row.GB4 ?? 0,
      GB5: row.GB5 ?? 0,
      GB6: row.GB6 ?? 0,
    };

    ([0, 1, 2, 3] as const).forEach((stepIdx) => {
      const stepInCourse = (stepIdx + 1) as 1 | 2 | 3 | 4;
      const courseIndex = row.courseIndex || rIdx + 1;
      result.push({
        rowKey: `${courseIndex}-${stepInCourse}`,
        courseIndex,
        stepInCourse,
        globalStepIndex: rIdx * 4 + stepIdx + 1,
        values: {
          GB1: stepsByBar.GB1[rIdx][stepIdx],
          GB2: stepsByBar.GB2[rIdx][stepIdx],
          GB3: stepsByBar.GB3[rIdx][stepIdx],
          GB4: stepsByBar.GB4[rIdx][stepIdx],
          GB5: stepsByBar.GB5[rIdx][stepIdx],
          GB6: stepsByBar.GB6[rIdx][stepIdx],
        },
        sourceValues,
        skippedBars: row.skips || {},
      });
    });
  });

  return result;
}

export interface PatternTableExtras {
  mayDensity: string;
  rackTensionRows: RackTensionRow[];
  isRackManualOverride: boolean;
  rackNote?: string;
  isTableManualOverride?: boolean;
  lockedTableRows?: ComputedStepRow[];
  manualTableOverrides?: Record<string, number>;
  tableSkipOverrides?: Record<string, boolean>;
  deletedStepKeys?: string[];
  insertedStepsAfter?: Record<string, CustomTableStepRow[]>;
}

export function extractPatternTableExtrasData(
  extras: Partial<PatternTableExtras>
): PatternTableExtrasData {
  const cleanLockedRows = Array.isArray(extras.lockedTableRows)
    ? extras.lockedTableRows.map((item) => ({
        rowKey: item.rowKey,
        courseIndex: item.courseIndex,
        ...(item.sourceCourseIndex !== undefined
          ? { sourceCourseIndex: item.sourceCourseIndex }
          : {}),
        stepInCourse: item.stepInCourse,
        globalStepIndex: item.globalStepIndex,
        values: { ...item.values },
        sourceValues: { ...item.sourceValues },
        skippedBars: { ...(item.skippedBars || {}) },
        ...(item.isInserted ? { isInserted: true } : {}),
      }))
    : [];

  const cleanInserted: Record<string, CustomTableStepRow[]> = {};
  if (extras.insertedStepsAfter) {
    Object.entries(extras.insertedStepsAfter).forEach(([k, list]) => {
      if (Array.isArray(list) && list.length > 0) {
        cleanInserted[k] = list.map((c) => ({
          id: c.id,
          ...(c.label ? { label: c.label } : {}),
          values: { ...c.values },
          skippedBars: { ...(c.skippedBars || {}) },
        }));
      }
    });
  }

  return {
    isTableManualOverride: Boolean(extras.isTableManualOverride),
    lockedTableRows: cleanLockedRows,
    manualTableOverrides: { ...(extras.manualTableOverrides || {}) },
    tableSkipOverrides: { ...(extras.tableSkipOverrides || {}) },
    deletedStepKeys: [...(extras.deletedStepKeys || [])],
    insertedStepsAfter: cleanInserted,
  };
}

export function applyTableSkipOverridesToRows(
  rows: PatternData['rows'],
  tableSkipOverrides?: Record<string, boolean>
): PatternData['rows'] {
  if (!rows || rows.length === 0) return rows;
  if (!tableSkipOverrides || Object.keys(tableSkipOverrides).length === 0) return rows;
  return rows.map((r, rIdx) => {
    const courseIndex = r.courseIndex || rIdx + 1;
    let nextSkips: Partial<Record<GuideBarId, boolean>> | null = null;
    ALL_GB_IDS.forEach((gbId) => {
      const k = `${courseIndex}-${gbId}`;
      if (k in tableSkipOverrides) {
        if (!nextSkips) nextSkips = { ...(r.skips || {}) };
        nextSkips[gbId] = Boolean(tableSkipOverrides[k]);
      }
    });
    return nextSkips ? { ...r, skips: nextSkips } : r;
  });
}

export function applyManualTableOverrides(
  expandedRows: ComputedStepRow[],
  overrides?: Record<string, number>
): ComputedStepRow[] {
  if (!overrides || Object.keys(overrides).length === 0) return expandedRows;
  return expandedRows.map((item) => {
    let nextValues: Record<GuideBarId, number> | null = null;
    ALL_GB_IDS.forEach((gbId) => {
      const primaryKey = `${item.rowKey}-${gbId}`;
      const legacyKey = `${item.courseIndex}-${item.stepInCourse}-${gbId}`;
      const val =
        typeof overrides[primaryKey] === 'number'
          ? overrides[primaryKey]
          : !item.isInserted && typeof overrides[legacyKey] === 'number'
          ? overrides[legacyKey]
          : undefined;
      if (typeof val === 'number' && !isNaN(val)) {
        if (!nextValues) nextValues = { ...item.values };
        nextValues[gbId] = val;
      }
    });
    return nextValues ? { ...item, values: nextValues } : item;
  });
}

export function buildFinalFourStepRows(
  rows: PatternData['rows'],
  settings: Pick<TableCalcSettings, 'barModes' | 'loopWidth' | 'skipBehavior'> & {
    descendingStartModes?: Record<GuideBarId, DescendingStartMode>;
    descendingStartMode?: DescendingStartMode;
  },
  extras?: Partial<PatternTableExtras>
): ComputedStepRow[] {
  if (extras?.isTableManualOverride && Array.isArray(extras.lockedTableRows)) {
    return extras.lockedTableRows.map((item, idx) => ({
      ...item,
      sourceCourseIndex: item.sourceCourseIndex ?? item.courseIndex,
      courseIndex: Math.floor(idx / 4) + 1,
      stepInCourse: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
      globalStepIndex: idx + 1,
    }));
  }

  const effectiveRows = applyTableSkipOverridesToRows(rows, extras?.tableSkipOverrides);
  const baseExpanded = buildExpandedFourStepRows(
    effectiveRows,
    settings.barModes,
    settings.loopWidth,
    settings.skipBehavior,
    settings.descendingStartModes ?? settings.descendingStartMode ?? DEFAULT_DESCENDING_MODES
  );

  const deletedSet = new Set(extras?.deletedStepKeys || []);
  const insertedMap = extras?.insertedStepsAfter || {};
  const result: ComputedStepRow[] = [];
  const visitedAnchors = new Set<string>();

  const pushInsertedAfter = (anchorKey: string, refCourseIndex: number) => {
    if (visitedAnchors.has(anchorKey)) return;
    visitedAnchors.add(anchorKey);
    const list = insertedMap[anchorKey];
    if (!Array.isArray(list) || list.length === 0) return;

    list.forEach((custom) => {
      const vals: Record<GuideBarId, number> = {
        GB1: custom.values?.GB1 ?? 0,
        GB2: custom.values?.GB2 ?? 0,
        GB3: custom.values?.GB3 ?? 0,
        GB4: custom.values?.GB4 ?? 0,
        GB5: custom.values?.GB5 ?? 0,
        GB6: custom.values?.GB6 ?? 0,
      };
      result.push({
        rowKey: custom.id,
        courseIndex: refCourseIndex,
        sourceCourseIndex: refCourseIndex,
        stepInCourse: 1,
        globalStepIndex: result.length + 1,
        values: vals,
        sourceValues: { ...vals },
        skippedBars: { ...(custom.skippedBars || {}) },
        isInserted: true,
        customLabel: custom.label,
      });
      pushInsertedAfter(custom.id, refCourseIndex);
    });
  };

  pushInsertedAfter('__START__', 1);

  baseExpanded.forEach((item) => {
    if (!deletedSet.has(item.rowKey)) {
      result.push({
        ...item,
        sourceCourseIndex: item.courseIndex,
        globalStepIndex: result.length + 1,
      });
    }
    pushInsertedAfter(item.rowKey, item.courseIndex);
  });

  const withOverrides = applyManualTableOverrides(result, extras?.manualTableOverrides);
  return withOverrides.map((item, idx) => ({
    ...item,
    sourceCourseIndex: item.sourceCourseIndex ?? item.courseIndex,
    courseIndex: Math.floor(idx / 4) + 1,
    stepInCourse: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
    globalStepIndex: idx + 1,
  }));
}

export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (!trimmed) {
      if (lines.length > 0) lines.push('');
      return;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = '';
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        if (ctx.measureText(word).width <= maxWidth) {
          currentLine = word;
        } else {
          // Break overly long single token
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          currentLine = chunk;
        }
      }
    });
    if (currentLine) lines.push(currentLine);
  });
  return lines;
}

const TABLE_EXTRAS_STORAGE_PREFIX = 'warpknitt_table_extras_';

export function createDefaultRackTensionRows(count = 4): RackTensionRow[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `rack-row-${Date.now()}-${idx}`,
    courseCount: '',
    values: {},
  }));
}

/**
 * Generates Rack Tension Table rows automatically from consecutive course skip runs in `pattern.rows`.
 * Normal (non-skipped) courses default to `17500`; Atlama (skipped) courses default to `3000`.
 * Never mutates `pattern.rows`.
 */
export function generateAutoRackTensionRows(
  rows: PatternData['rows'],
  guideBars: PatternData['guideBars'],
  normalTension = '17500',
  skipTension = '3000'
): RackTensionRow[] {
  if (!rows || rows.length === 0) {
    return createDefaultRackTensionRows(1);
  }

  const activeBars = ALL_GB_IDS.filter((id) => guideBars?.[id]?.active);
  const trackBars = activeBars.length > 0 ? activeBars : ALL_GB_IDS;

  const segments: Array<{
    courseCount: number;
    skipsByBar: Partial<Record<GuideBarId, boolean>>;
  }> = [];

  const getSig = (row: PatternData['rows'][number]) =>
    trackBars.map((gbId) => (row.skips?.[gbId] ? '1' : '0')).join('|');

  let currentSig = getSig(rows[0]);
  let currentCount = 0;
  let currentSkips: Partial<Record<GuideBarId, boolean>> = {};
  trackBars.forEach((gbId) => {
    currentSkips[gbId] = Boolean(rows[0].skips?.[gbId]);
  });

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sig = getSig(r);
    if (sig === currentSig) {
      currentCount++;
    } else {
      segments.push({ courseCount: currentCount, skipsByBar: currentSkips });
      currentSig = sig;
      currentCount = 1;
      currentSkips = {};
      trackBars.forEach((gbId) => {
        currentSkips[gbId] = Boolean(r.skips?.[gbId]);
      });
    }
  }
  segments.push({ courseCount: currentCount, skipsByBar: currentSkips });

  return segments.map((seg, idx) => {
    const values: Partial<Record<GuideBarId, string>> = {};
    ALL_GB_IDS.forEach((gbId) => {
      values[gbId] = seg.skipsByBar[gbId] ? skipTension : normalTension;
    });
    return {
      id: `auto-rack-${idx}-${seg.courseCount}`,
      courseCount: String(seg.courseCount),
      values,
    };
  });
}

export function loadPatternTableExtras(pattern: PatternData): PatternTableExtras {
  const autoRows = generateAutoRackTensionRows(pattern.rows, pattern.guideBars);
  const patternExtras = pattern.tableExtras;

  try {
    const raw = localStorage.getItem(`${TABLE_EXTRAS_STORAGE_PREFIX}${pattern.id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const isManual = Boolean(parsed.isRackManualOverride);
      const isTableManual =
        typeof parsed.isTableManualOverride === 'boolean'
          ? parsed.isTableManualOverride
          : Boolean(patternExtras?.isTableManualOverride);
      return {
        mayDensity:
          typeof parsed.mayDensity === 'string'
            ? parsed.mayDensity
            : pattern.mayDensity ?? '',
        isRackManualOverride: isManual,
        rackTensionRows:
          isManual && Array.isArray(parsed.rackTensionRows) && parsed.rackTensionRows.length > 0
            ? parsed.rackTensionRows
            : autoRows,
        rackNote:
          typeof parsed.rackNote === 'string'
            ? parsed.rackNote
            : pattern.rackNote ?? '',
        isTableManualOverride: isTableManual,
        lockedTableRows: Array.isArray(parsed.lockedTableRows)
          ? parsed.lockedTableRows
          : Array.isArray(patternExtras?.lockedTableRows)
          ? patternExtras.lockedTableRows
          : [],
        manualTableOverrides:
          parsed.manualTableOverrides && typeof parsed.manualTableOverrides === 'object'
            ? parsed.manualTableOverrides
            : patternExtras?.manualTableOverrides || {},
        tableSkipOverrides:
          parsed.tableSkipOverrides && typeof parsed.tableSkipOverrides === 'object'
            ? parsed.tableSkipOverrides
            : patternExtras?.tableSkipOverrides || {},
        deletedStepKeys: Array.isArray(parsed.deletedStepKeys)
          ? parsed.deletedStepKeys
          : patternExtras?.deletedStepKeys || [],
        insertedStepsAfter:
          parsed.insertedStepsAfter && typeof parsed.insertedStepsAfter === 'object'
            ? parsed.insertedStepsAfter
            : patternExtras?.insertedStepsAfter || {},
      };
    }
  } catch {
    // Ignore storage read errors
  }

  const isPatternManual = Boolean(pattern.isRackManualOverride);
  return {
    mayDensity: pattern.mayDensity ?? '',
    isRackManualOverride: isPatternManual,
    rackTensionRows:
      isPatternManual && Array.isArray(pattern.rackTensionRows) && pattern.rackTensionRows.length > 0
        ? pattern.rackTensionRows
        : autoRows,
    rackNote: pattern.rackNote ?? '',
    isTableManualOverride: Boolean(patternExtras?.isTableManualOverride),
    lockedTableRows: Array.isArray(patternExtras?.lockedTableRows)
      ? patternExtras.lockedTableRows
      : [],
    manualTableOverrides: patternExtras?.manualTableOverrides || {},
    tableSkipOverrides: patternExtras?.tableSkipOverrides || {},
    deletedStepKeys: patternExtras?.deletedStepKeys || [],
    insertedStepsAfter: patternExtras?.insertedStepsAfter || {},
  };
}

export function savePatternTableExtras(patternId: string, extras: PatternTableExtras): void {
  try {
    localStorage.setItem(`${TABLE_EXTRAS_STORAGE_PREFIX}${patternId}`, JSON.stringify(extras));
  } catch {
    // Ignore storage write errors
  }
}

export interface PatternDifficultyResult {
  score: number;
  label: string;
  shortLabel: string;
  maxShogJump: number;
}

export function computePatternDifficulty(
  rows: PatternData['rows'],
  activeGbIds: GuideBarId[],
  rpm = 600
): PatternDifficultyResult {
  if (!rows || rows.length === 0 || activeGbIds.length === 0) {
    return {
      score: 0,
      label: 'Bilinmiyor',
      shortLabel: 'Bilinmiyor',
      maxShogJump: 0,
    };
  }

  let maxShogJump = 0;
  let totalShogJumps = 0;
  let jumpCount = 0;

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    const prevR = rows[rIdx === 0 ? rows.length - 1 : rIdx - 1];

    activeGbIds.forEach((id) => {
      const currentPos = r[id] || 0;
      const prevPos = prevR[id] || 0;
      const delta = Math.abs(currentPos - prevPos);
      if (delta > maxShogJump) maxShogJump = delta;
      totalShogJumps += delta;
      jumpCount++;
    });
  }

  const avgShogJump = jumpCount > 0 ? totalShogJumps / jumpCount : 0;

  let maxGbGap = 0;
  if (activeGbIds.length >= 2) {
    rows.forEach((r) => {
      for (let i = 0; i < activeGbIds.length - 1; i++) {
        const shift1 = r[activeGbIds[i]] || 0;
        const shift2 = r[activeGbIds[i + 1]] || 0;
        const gap = Math.abs(shift1 - shift2);
        if (gap > maxGbGap) maxGbGap = gap;
      }
    });
  }

  let score =
    maxShogJump * 5.5 +
    avgShogJump * 8 +
    activeGbIds.length * 4 +
    (rpm / 600) * 10 +
    maxGbGap * 2.5;

  score = Math.min(100, Math.max(10, Math.round(score)));

  if (score >= 75 || maxShogJump >= 8) {
    return {
      score,
      label: 'Aşırı Zor (Yüksek Risk)',
      shortLabel: 'Aşırı Zor',
      maxShogJump,
    };
  }
  if (score >= 50 || maxShogJump >= 5) {
    return {
      score,
      label: 'Yüksek (Hassas Ayar)',
      shortLabel: 'Yüksek',
      maxShogJump,
    };
  }
  if (score >= 30 || maxShogJump >= 3) {
    return {
      score,
      label: 'Orta Seviye',
      shortLabel: 'Orta',
      maxShogJump,
    };
  }
  return {
    score,
    label: 'Kolay (Düşük Risk)',
    shortLabel: 'Kolay',
    maxShogJump,
  };
}


