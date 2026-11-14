import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PatternData, GuideBarId, RackTensionRow, PatternTableExtrasData } from '../types';
import {
  Table2,
  Download,
  Copy,
  Check,
  Layers,
  Info,
  RotateCcw,
  Undo2,
  Plus,
  MinusCircle,
  Trash2,
  Gauge,
  SlidersHorizontal,
  Sparkles,
  Lock,
  ArrowDownUp,
  Edit3,
  StickyNote,
} from 'lucide-react';
import {
  ALL_GB_IDS,
  ALL_DOUBLE_MODES,
  DEFAULT_HRD6_MODES,
  DEFAULT_DESCENDING_MODES,
  StitchLoopMode,
  SkipBehaviorMode,
  DescendingStartMode,
  ComputedStepRow,
  CustomTableStepRow,
  computeGuideBarFourStepSeries,
  extractPatternTableExtrasData,
  buildFinalFourStepRows,
  loadSavedTableSettings,
  saveTableSettings,
  loadPatternTableExtras,
  savePatternTableExtras,
  generateAutoRackTensionRows,
  computePatternDifficulty,
} from '../utils/patternTableCalc';
import { calculateGuideBarMetrics } from '../utils/fabricCalculator';

export type { StitchLoopMode, SkipBehaviorMode };

interface PatternTableTabProps {
  pattern: PatternData;
  fabricWidthCm?: number;
  onUpdateTableExtras?: (
    mayDensity: string,
    rackTensionRows: RackTensionRow[],
    isRackManualOverride: boolean,
    rackNote?: string,
    tableExtras?: PatternTableExtrasData
  ) => void;
}

const MODE_LABELS: Record<StitchLoopMode, string> = {
  double_bed: 'Çift Ray İlmek',
  front_bed: 'Ön Ray İlmek',
  back_bed: 'Arka Ray İlmek',
  inlay: 'Atkı / Sabit',
};

const MODE_SHORT_FORMULAS: Record<StitchLoopMode, string> = {
  double_bed: 'N · N+1 · N · N+1',
  front_bed: 'N · N+1 · N+1 · N+1',
  back_bed: 'N · N · N · N+1',
  inlay: 'N · N · N · N',
};

const DESC_MODE_LABELS: Record<DescendingStartMode, string> = {
  smooth_chain: 'Zincir Geçiş (±1)',
  low_first: 'Düşüş: Düşükten',
  high_first: 'Düşüş: Yüksekten',
};

const getNextDescendingMode = (mode: DescendingStartMode): DescendingStartMode => {
  if (mode === 'low_first') return 'smooth_chain';
  if (mode === 'smooth_chain') return 'high_first';
  return 'low_first';
};

export const PatternTableTab: React.FC<PatternTableTabProps> = ({
  pattern,
  fabricWidthCm = 410,
  onUpdateTableExtras,
}) => {
  const initialSettings = useMemo(() => loadSavedTableSettings(), []);
  const [barModes, setBarModes] = useState<Record<GuideBarId, StitchLoopMode>>(initialSettings.barModes);
  const [skipBehavior, setSkipBehavior] = useState<SkipBehaviorMode>(initialSettings.skipBehavior);
  const [loopWidth, setLoopWidth] = useState<number>(initialSettings.loopWidth);
  const [descendingStartModes, setDescendingStartModes] = useState<
    Record<GuideBarId, DescendingStartMode>
  >(initialSettings.descendingStartModes);
  const [selectedDescendingTarget, setSelectedDescendingTarget] = useState<'ALL' | GuideBarId>('ALL');
  const [showAllBars, setShowAllBars] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(1);
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>('1-1');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Manual Kumaş Sıklığı (May), Rack Tansiyon Tablosu, Not & Table-only 4-Step Edits
  const initialExtras = useMemo(() => loadPatternTableExtras(pattern), [pattern.id]);
  const [mayDensity, setMayDensity] = useState<string>(initialExtras.mayDensity);
  const [rackTensionRows, setRackTensionRows] = useState<RackTensionRow[]>(
    initialExtras.rackTensionRows
  );
  const [isRackManualOverride, setIsRackManualOverride] = useState<boolean>(
    initialExtras.isRackManualOverride
  );
  const [rackNote, setRackNote] = useState<string>(initialExtras.rackNote || '');
  const [isTableManualOverride, setIsTableManualOverride] = useState<boolean>(
    Boolean(initialExtras.isTableManualOverride)
  );
  const [lockedTableRows, setLockedTableRows] = useState<ComputedStepRow[]>(
    initialExtras.lockedTableRows || []
  );
  const [manualTableOverrides, setManualTableOverrides] = useState<Record<string, number>>(
    initialExtras.manualTableOverrides || {}
  );
  const [tableSkipOverrides, setTableSkipOverrides] = useState<Record<string, boolean>>(
    initialExtras.tableSkipOverrides || {}
  );
  const [deletedStepKeys, setDeletedStepKeys] = useState<string[]>(
    initialExtras.deletedStepKeys || []
  );
  const [insertedStepsAfter, setInsertedStepsAfter] = useState<Record<string, CustomTableStepRow[]>>(
    initialExtras.insertedStepsAfter || {}
  );
  const [editingCell, setEditingCell] = useState<{ key: string; text: string } | null>(null);

  type TableUndoSnapshot = {
    isTableManualOverride: boolean;
    lockedTableRows: ComputedStepRow[];
    manualTableOverrides: Record<string, number>;
    tableSkipOverrides: Record<string, boolean>;
    deletedStepKeys: string[];
    insertedStepsAfter: Record<string, CustomTableStepRow[]>;
    selectedStepKey: string | null;
    selectedCourse: number | null;
  };

  const [undoStack, setUndoStack] = useState<TableUndoSnapshot[]>([]);
  const preEditSnapshotRef = useRef<TableUndoSnapshot | null>(null);
  const lastLoadedPatternIdRef = useRef<string>(pattern.id);

  // Reload when pattern changes
  useEffect(() => {
    if (lastLoadedPatternIdRef.current !== pattern.id) {
      lastLoadedPatternIdRef.current = pattern.id;
      const next = loadPatternTableExtras(pattern);
      setMayDensity(next.mayDensity);
      setRackTensionRows(next.rackTensionRows);
      setIsRackManualOverride(next.isRackManualOverride);
      setRackNote(next.rackNote || '');
      setIsTableManualOverride(Boolean(next.isTableManualOverride));
      setLockedTableRows(next.lockedTableRows || []);
      setManualTableOverrides(next.manualTableOverrides || {});
      setTableSkipOverrides(next.tableSkipOverrides || {});
      setDeletedStepKeys(next.deletedStepKeys || []);
      setInsertedStepsAfter(next.insertedStepsAfter || {});
      setSelectedCourse(1);
      setSelectedStepKey('1-1');
      setEditingCell(null);
      preEditSnapshotRef.current = null;
      setUndoStack([]);
    }
  }, [pattern]);

  // If NOT manually overridden, automatically keep Rack Tension Table synced to pattern skips
  useEffect(() => {
    if (!isRackManualOverride) {
      const autoRows = generateAutoRackTensionRows(pattern.rows, pattern.guideBars);
      setRackTensionRows(autoRows);
    }
  }, [pattern.rows, pattern.guideBars, isRackManualOverride]);

  useEffect(() => {
    saveTableSettings({ barModes, skipBehavior, loopWidth, descendingStartModes });
  }, [barModes, skipBehavior, loopWidth, descendingStartModes]);

  const persistExtras = (patch?: {
    mayDensity?: string;
    rackTensionRows?: RackTensionRow[];
    isRackManualOverride?: boolean;
    rackNote?: string;
    isTableManualOverride?: boolean;
    lockedTableRows?: ComputedStepRow[];
    manualTableOverrides?: Record<string, number>;
    tableSkipOverrides?: Record<string, boolean>;
    deletedStepKeys?: string[];
    insertedStepsAfter?: Record<string, CustomTableStepRow[]>;
  }) => {
    const nextMay = patch?.mayDensity ?? mayDensity;
    const nextRackRows = patch?.rackTensionRows ?? rackTensionRows;
    const nextManualOverride = patch?.isRackManualOverride ?? isRackManualOverride;
    const nextRackNote = patch?.rackNote ?? rackNote;
    const nextIsTableManual = patch?.isTableManualOverride ?? isTableManualOverride;
    const nextLockedRows = patch?.lockedTableRows ?? lockedTableRows;
    const nextTableOverrides = patch?.manualTableOverrides ?? manualTableOverrides;
    const nextTableSkips = patch?.tableSkipOverrides ?? tableSkipOverrides;
    const nextDeletedKeys = patch?.deletedStepKeys ?? deletedStepKeys;
    const nextInsertedMap = patch?.insertedStepsAfter ?? insertedStepsAfter;

    const fullExtras = {
      mayDensity: nextMay,
      rackTensionRows: nextRackRows,
      isRackManualOverride: nextManualOverride,
      rackNote: nextRackNote,
      isTableManualOverride: nextIsTableManual,
      lockedTableRows: nextLockedRows,
      manualTableOverrides: nextTableOverrides,
      tableSkipOverrides: nextTableSkips,
      deletedStepKeys: nextDeletedKeys,
      insertedStepsAfter: nextInsertedMap,
    };

    savePatternTableExtras(pattern.id, fullExtras);
    onUpdateTableExtras?.(
      nextMay,
      nextRackRows,
      nextManualOverride,
      nextRackNote,
      extractPatternTableExtrasData(fullExtras)
    );
  };

  const handleMayChange = (val: string) => {
    setMayDensity(val);
    persistExtras({ mayDensity: val });
  };

  const handleRackNoteChange = (val: string) => {
    setRackNote(val);
    persistExtras({ rackNote: val });
  };

  const handleRackCourseChange = (rowIdx: number, val: string) => {
    const next = rackTensionRows.map((r, idx) =>
      idx === rowIdx ? { ...r, courseCount: val } : r
    );
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras({ rackTensionRows: next, isRackManualOverride: true });
  };

  const handleRackBarValueChange = (rowIdx: number, gbId: GuideBarId, val: string) => {
    const next = rackTensionRows.map((r, idx) =>
      idx === rowIdx
        ? {
            ...r,
            values: {
              ...r.values,
              [gbId]: val,
            },
          }
        : r
    );
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras({ rackTensionRows: next, isRackManualOverride: true });
  };

  const handleAddRackRow = () => {
    const defaultValues: Partial<Record<GuideBarId, string>> = {};
    ALL_GB_IDS.forEach((gbId) => {
      defaultValues[gbId] = '17500';
    });
    const next = [
      ...rackTensionRows,
      {
        id: `rack-row-${Date.now()}-${rackTensionRows.length}`,
        courseCount: '',
        values: defaultValues,
      },
    ];
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras({ rackTensionRows: next, isRackManualOverride: true });
  };

  const handleDeleteRackRow = (rowIdx: number) => {
    const next =
      rackTensionRows.length <= 1
        ? [
            {
              id: `rack-row-${Date.now()}-0`,
              courseCount: '',
              values: {},
            },
          ]
        : rackTensionRows.filter((_, idx) => idx !== rowIdx);
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras({ rackTensionRows: next, isRackManualOverride: true });
  };

  const handleRecalculateRackFromSkips = () => {
    const autoRows = generateAutoRackTensionRows(pattern.rows, pattern.guideBars);
    setRackTensionRows(autoRows);
    setIsRackManualOverride(false);
    persistExtras({ rackTensionRows: autoRows, isRackManualOverride: false });
  };

  const rows = pattern.rows || [];

  const activeGbIds = useMemo(
    () => ALL_GB_IDS.filter((id) => pattern.guideBars[id]?.active),
    [pattern.guideBars]
  );

  // Maksimum Tel Sayısı & Desen Zorluğu
  const maxTelCount = useMemo(() => {
    let total = 0;
    activeGbIds.forEach((id) => {
      const gb = pattern.guideBars[id];
      if (gb) {
        const calc = calculateGuideBarMetrics(
          id,
          gb,
          rows,
          pattern.machine,
          pattern.safety,
          fabricWidthCm
        );
        total += calc.requiredYarnCount;
      }
    });
    return total;
  }, [activeGbIds, pattern.guideBars, rows, pattern.machine, pattern.safety, fabricWidthCm]);

  const difficultyInfo = useMemo(
    () => computePatternDifficulty(rows, activeGbIds, pattern.machine?.rpm || 600),
    [rows, activeGbIds, pattern.machine?.rpm]
  );

  const totalSkipCount = useMemo(() => {
    let cnt = 0;
    rows.forEach((r) => {
      if (r.skips) {
        ALL_GB_IDS.forEach((id) => {
          if (r.skips?.[id]) cnt++;
        });
      }
    });
    return cnt;
  }, [rows]);

  const displayBars = useMemo(() => {
    if (showAllBars) return ALL_GB_IDS;
    return activeGbIds.length > 0 ? activeGbIds : ALL_GB_IDS;
  }, [showAllBars, activeGbIds]);

  // Expand every course row into 4 machine step rows + apply table-only edits
  // When `isTableManualOverride` is active, returns locked manual rows verbatim without auto-recalculation.
  // NEVER mutates pattern.rows or pattern.guideBars!
  const finalExpandedRows = useMemo<ComputedStepRow[]>(() => {
    return buildFinalFourStepRows(
      rows,
      { barModes, loopWidth, skipBehavior, descendingStartModes },
      {
        isTableManualOverride,
        lockedTableRows,
        manualTableOverrides,
        tableSkipOverrides,
        deletedStepKeys,
        insertedStepsAfter,
      }
    );
  }, [
    rows,
    barModes,
    loopWidth,
    skipBehavior,
    descendingStartModes,
    isTableManualOverride,
    lockedTableRows,
    manualTableOverrides,
    tableSkipOverrides,
    deletedStepKeys,
    insertedStepsAfter,
  ]);

  const activeSelectedRow = useMemo(() => {
    if (finalExpandedRows.length === 0) return null;
    if (selectedStepKey) {
      const exact = finalExpandedRows.find((r) => r.rowKey === selectedStepKey);
      if (exact) return exact;
    }
    if (selectedCourse !== null) {
      const byCourse = finalExpandedRows.find((r) => r.courseIndex === selectedCourse);
      if (byCourse) return byCourse;
    }
    return finalExpandedRows[0];
  }, [finalExpandedRows, selectedStepKey, selectedCourse]);

  const insertedStepsCount = useMemo(
    () =>
      Object.values(insertedStepsAfter).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [insertedStepsAfter]
  );

  const tableEditCount =
    Object.keys(manualTableOverrides).length +
    Object.keys(tableSkipOverrides).length +
    deletedStepKeys.length +
    insertedStepsCount;

  const displayCourseCount =
    finalExpandedRows.length > 0 ? Math.ceil(finalExpandedRows.length / 4) : rows.length;

  const cloneComputedRows = (list: ComputedStepRow[]): ComputedStepRow[] =>
    list.map((r) => ({
      ...r,
      values: { ...r.values },
      sourceValues: { ...r.sourceValues },
      skippedBars: { ...(r.skippedBars || {}) },
    }));

  const captureSnapshot = (): TableUndoSnapshot => ({
    isTableManualOverride,
    lockedTableRows: cloneComputedRows(lockedTableRows),
    manualTableOverrides: { ...manualTableOverrides },
    tableSkipOverrides: { ...tableSkipOverrides },
    deletedStepKeys: [...deletedStepKeys],
    insertedStepsAfter: Object.fromEntries(
      Object.entries(insertedStepsAfter).map(([k, list]) => [
        k,
        list.map((c) => ({
          ...c,
          values: { ...c.values },
          skippedBars: { ...(c.skippedBars || {}) },
        })),
      ])
    ),
    selectedStepKey,
    selectedCourse,
  });

  const pushUndoSnapshot = (snap?: TableUndoSnapshot) => {
    const targetSnap = snap ?? captureSnapshot();
    setUndoStack((prev) => [...prev.slice(-49), targetSnap]);
  };

  const applySnapshot = (snap: TableUndoSnapshot) => {
    setIsTableManualOverride(snap.isTableManualOverride);
    setLockedTableRows(snap.lockedTableRows);
    setManualTableOverrides(snap.manualTableOverrides);
    setTableSkipOverrides(snap.tableSkipOverrides);
    setDeletedStepKeys(snap.deletedStepKeys);
    setInsertedStepsAfter(snap.insertedStepsAfter);
    setSelectedStepKey(snap.selectedStepKey);
    setSelectedCourse(snap.selectedCourse);
    setEditingCell(null);
    persistExtras({
      isTableManualOverride: snap.isTableManualOverride,
      lockedTableRows: snap.lockedTableRows,
      manualTableOverrides: snap.manualTableOverrides,
      tableSkipOverrides: snap.tableSkipOverrides,
      deletedStepKeys: snap.deletedStepKeys,
      insertedStepsAfter: snap.insertedStepsAfter,
    });
  };

  const handleUndoTableEdit = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    applySnapshot(prev);
  };

  const handleLiveTableCellChange = (rowKey: string, cellKey: string, gbId: GuideBarId, raw: string) => {
    if (!(raw === '' || raw === '-' || /^-?\d+$/.test(raw))) return;
    setEditingCell({ key: cellKey, text: raw });

    const trimmed = raw.trim();
    if (/^-?\d+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, 10);
      const baseList =
        isTableManualOverride && lockedTableRows.length > 0
          ? lockedTableRows
          : finalExpandedRows;
      const nextLockedRows = baseList.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              values: { ...row.values, [gbId]: parsed },
              sourceValues: { ...row.sourceValues },
              skippedBars: { ...(row.skippedBars || {}) },
            }
          : {
              ...row,
              values: { ...row.values },
              sourceValues: { ...row.sourceValues },
              skippedBars: { ...(row.skippedBars || {}) },
            }
      );
      const nextOverrides = {
        ...manualTableOverrides,
        [cellKey]: parsed,
      };
      setIsTableManualOverride(true);
      setLockedTableRows(nextLockedRows);
      setManualTableOverrides(nextOverrides);
      persistExtras({
        isTableManualOverride: true,
        lockedTableRows: nextLockedRows,
        manualTableOverrides: nextOverrides,
      });
    }
  };

  const handleInsertExtraCourse = () => {
    pushUndoSnapshot();
    const tStamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 5);
    const baseValues: Record<GuideBarId, number> = activeSelectedRow
      ? { ...activeSelectedRow.values }
      : finalExpandedRows.length > 0
      ? { ...finalExpandedRows[finalExpandedRows.length - 1].values }
      : { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
    const baseSkips = activeSelectedRow ? { ...activeSelectedRow.skippedBars } : {};

    if (isTableManualOverride && lockedTableRows.length > 0) {
      const currentRows = cloneComputedRows(finalExpandedRows);
      let insertAt = currentRows.length;
      if (activeSelectedRow) {
        const lastCourseRowIdx = currentRows.reduce(
          (acc, r, idx) => (r.courseIndex === activeSelectedRow.courseIndex ? idx : acc),
          -1
        );
        if (lastCourseRowIdx >= 0) insertAt = lastCourseRowIdx + 1;
      }
      const refCourse = activeSelectedRow
        ? activeSelectedRow.courseIndex + 1
        : Math.ceil(currentRows.length / 4) + 1;

      const newLockedSteps: ComputedStepRow[] = ([1, 2, 3, 4] as const).map((stepNum, sIdx) => ({
        rowKey: `ins-c${stepNum}-${tStamp}-${rand}`,
        courseIndex: refCourse,
        sourceCourseIndex: refCourse,
        stepInCourse: stepNum,
        globalStepIndex: insertAt + sIdx + 1,
        values: { ...baseValues },
        sourceValues: { ...baseValues },
        skippedBars: { ...baseSkips },
        isInserted: true,
      }));

      const nextLocked = [
        ...currentRows.slice(0, insertAt),
        ...newLockedSteps,
        ...currentRows.slice(insertAt),
      ].map((item, idx) => ({
        ...item,
        courseIndex: Math.floor(idx / 4) + 1,
        stepInCourse: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
        globalStepIndex: idx + 1,
      }));

      setLockedTableRows(nextLocked);
      setSelectedStepKey(newLockedSteps[0].rowKey);
      if (activeSelectedRow) setSelectedCourse(activeSelectedRow.courseIndex + 1);
      persistExtras({ isTableManualOverride: true, lockedTableRows: nextLocked });
      return;
    }

    let anchorKey = '__START__';
    if (activeSelectedRow) {
      const rowsInCourse = finalExpandedRows.filter(
        (r) => r.courseIndex === activeSelectedRow.courseIndex
      );
      const courseEndRow = rowsInCourse[rowsInCourse.length - 1] || activeSelectedRow;
      anchorKey = courseEndRow.rowKey;
    } else if (finalExpandedRows.length > 0) {
      anchorKey = finalExpandedRows[finalExpandedRows.length - 1].rowKey;
    }

    const courseSteps: CustomTableStepRow[] = [
      {
        id: `ins-c1-${tStamp}-${rand}`,
        values: { ...baseValues },
        skippedBars: { ...baseSkips },
      },
      {
        id: `ins-c2-${tStamp}-${rand}`,
        values: { ...baseValues },
        skippedBars: { ...baseSkips },
      },
      {
        id: `ins-c3-${tStamp}-${rand}`,
        values: { ...baseValues },
        skippedBars: { ...baseSkips },
      },
      {
        id: `ins-c4-${tStamp}-${rand}`,
        values: { ...baseValues },
        skippedBars: { ...baseSkips },
      },
    ];

    const existingList = insertedStepsAfter[anchorKey] || [];
    const nextInserted: Record<string, CustomTableStepRow[]> = {
      ...insertedStepsAfter,
      [anchorKey]: [...courseSteps, ...existingList],
    };
    setInsertedStepsAfter(nextInserted);
    setSelectedStepKey(courseSteps[0].id);
    if (activeSelectedRow) setSelectedCourse(activeSelectedRow.courseIndex + 1);
    persistExtras({ insertedStepsAfter: nextInserted });
  };

  const handleDeleteSelectedStep = () => {
    if (!activeSelectedRow) return;
    pushUndoSnapshot();
    const targetKey = activeSelectedRow.rowKey;
    const curIdx = finalExpandedRows.findIndex((r) => r.rowKey === targetKey);
    const nextNeighbor =
      curIdx >= 0
        ? finalExpandedRows[curIdx + 1] || finalExpandedRows[curIdx - 1] || null
        : null;

    if (isTableManualOverride && lockedTableRows.length > 0) {
      const nextLocked = cloneComputedRows(finalExpandedRows)
        .filter((r) => r.rowKey !== targetKey)
        .map((item, idx) => ({
          ...item,
          courseIndex: Math.floor(idx / 4) + 1,
          stepInCourse: ((idx % 4) + 1) as 1 | 2 | 3 | 4,
          globalStepIndex: idx + 1,
        }));
      const nextOverrides = { ...manualTableOverrides };
      ALL_GB_IDS.forEach((gb) => {
        delete nextOverrides[`${targetKey}-${gb}`];
      });
      setLockedTableRows(nextLocked);
      setManualTableOverrides(nextOverrides);
      if (nextNeighbor) {
        setSelectedStepKey(nextNeighbor.rowKey);
        setSelectedCourse(nextNeighbor.courseIndex);
      } else {
        setSelectedStepKey(null);
      }
      persistExtras({
        isTableManualOverride: true,
        lockedTableRows: nextLocked,
        manualTableOverrides: nextOverrides,
      });
      return;
    }

    if (activeSelectedRow.isInserted) {
      const nextInserted: Record<string, CustomTableStepRow[]> = {};
      let foundAnchor: string | null = null;
      let insertIndex = -1;

      Object.entries(insertedStepsAfter).forEach(([anchor, list]) => {
        if (!Array.isArray(list)) return;
        const idx = list.findIndex((c) => c.id === targetKey);
        if (idx !== -1) {
          foundAnchor = anchor;
          insertIndex = idx;
          const filtered = list.filter((c) => c.id !== targetKey);
          if (filtered.length > 0) nextInserted[anchor] = filtered;
        } else if (list.length > 0) {
          nextInserted[anchor] = [...list];
        }
      });

      // Re-parent any steps anchored after the removed custom step so nothing is orphaned
      const orphaned = nextInserted[targetKey];
      if (orphaned && orphaned.length > 0 && foundAnchor) {
        delete nextInserted[targetKey];
        const parentList = nextInserted[foundAnchor] || [];
        const safeIdx = Math.min(Math.max(0, insertIndex), parentList.length);
        nextInserted[foundAnchor] = [
          ...parentList.slice(0, safeIdx),
          ...orphaned,
          ...parentList.slice(safeIdx),
        ];
      }

      const nextOverrides = { ...manualTableOverrides };
      ALL_GB_IDS.forEach((gb) => {
        delete nextOverrides[`${targetKey}-${gb}`];
      });

      setInsertedStepsAfter(nextInserted);
      setManualTableOverrides(nextOverrides);
      if (nextNeighbor) {
        setSelectedStepKey(nextNeighbor.rowKey);
        setSelectedCourse(nextNeighbor.courseIndex);
      } else {
        setSelectedStepKey(null);
      }
      persistExtras({
        insertedStepsAfter: nextInserted,
        manualTableOverrides: nextOverrides,
      });
    } else {
      const nextDeleted = deletedStepKeys.includes(targetKey)
        ? deletedStepKeys
        : [...deletedStepKeys, targetKey];
      setDeletedStepKeys(nextDeleted);
      if (nextNeighbor) {
        setSelectedStepKey(nextNeighbor.rowKey);
        setSelectedCourse(nextNeighbor.courseIndex);
      } else {
        setSelectedStepKey(null);
      }
      persistExtras({ deletedStepKeys: nextDeleted });
    }
  };

  const handleToggleTableSkip = (gbId: GuideBarId) => {
    if (!activeSelectedRow) return;
    pushUndoSnapshot();

    if (isTableManualOverride && lockedTableRows.length > 0) {
      const targetCourseIdx = activeSelectedRow.courseIndex;
      const curSkip = Boolean(activeSelectedRow.skippedBars[gbId]);
      const nextSkip = !curSkip;

      // Build course-level series across all courses in finalExpandedRows so cyclic transitions apply accurately
      const courseOrder: number[] = [];
      const courseVals: number[] = [];
      const courseSkips: boolean[] = [];
      finalExpandedRows.forEach((row) => {
        if (!courseOrder.includes(row.courseIndex)) {
          courseOrder.push(row.courseIndex);
          courseVals.push(row.sourceValues?.[gbId] ?? row.values[gbId] ?? 0);
          courseSkips.push(
            row.courseIndex === targetCourseIdx ? nextSkip : Boolean(row.skippedBars?.[gbId])
          );
        }
      });

      const computedSeries = computeGuideBarFourStepSeries(
        courseVals,
        courseSkips,
        barModes[gbId],
        loopWidth,
        skipBehavior,
        descendingStartModes[gbId]
      );
      const targetSeriesIdx = courseOrder.indexOf(targetCourseIdx);
      const newSteps =
        targetSeriesIdx >= 0 && computedSeries[targetSeriesIdx]
          ? computedSeries[targetSeriesIdx]
          : ([0, 0, 0, 0] as [number, number, number, number]);

      const nextLocked = cloneComputedRows(finalExpandedRows).map((row) => {
        if (row.courseIndex !== targetCourseIdx) return row;
        return {
          ...row,
          values: {
            ...row.values,
            [gbId]: newSteps[row.stepInCourse - 1] ?? row.values[gbId],
          },
          skippedBars: {
            ...(row.skippedBars || {}),
            [gbId]: nextSkip,
          },
        };
      });

      setLockedTableRows(nextLocked);
      persistExtras({ isTableManualOverride: true, lockedTableRows: nextLocked });
      return;
    }

    if (activeSelectedRow.isInserted) {
      const targetId = activeSelectedRow.rowKey;
      const nextInserted: Record<string, CustomTableStepRow[]> = {};
      Object.entries(insertedStepsAfter).forEach(([anchor, list]) => {
        nextInserted[anchor] = list.map((c) => {
          if (c.id !== targetId) return c;
          const curSkip = Boolean(c.skippedBars?.[gbId]);
          return {
            ...c,
            skippedBars: {
              ...(c.skippedBars || {}),
              [gbId]: !curSkip,
            },
          };
        });
      });
      setInsertedStepsAfter(nextInserted);
      persistExtras({ insertedStepsAfter: nextInserted });
      return;
    }

    const sourceCourseIdx = activeSelectedRow.sourceCourseIndex ?? activeSelectedRow.courseIndex;
    const skipKey = `${sourceCourseIdx}-${gbId}`;
    const sourceRow = rows.find((r, idx) => (r.courseIndex || idx + 1) === sourceCourseIdx);
    const baseSkip = Boolean(sourceRow?.skips?.[gbId]);
    const currentEffectiveSkip =
      skipKey in tableSkipOverrides ? Boolean(tableSkipOverrides[skipKey]) : baseSkip;
    const nextVal = !currentEffectiveSkip;

    const nextSkips = { ...tableSkipOverrides };
    if (nextVal === baseSkip) {
      delete nextSkips[skipKey];
    } else {
      nextSkips[skipKey] = nextVal;
    }
    setTableSkipOverrides(nextSkips);
    persistExtras({ tableSkipOverrides: nextSkips });
  };

  const handleResetManualTableOverrides = () => {
    if (isTableManualOverride || tableEditCount > 0) pushUndoSnapshot();
    setIsTableManualOverride(false);
    setLockedTableRows([]);
    setManualTableOverrides({});
    setTableSkipOverrides({});
    setDeletedStepKeys([]);
    setInsertedStepsAfter({});
    setEditingCell(null);
    preEditSnapshotRef.current = null;
    persistExtras({
      isTableManualOverride: false,
      lockedTableRows: [],
      manualTableOverrides: {},
      tableSkipOverrides: {},
      deletedStepKeys: [],
      insertedStepsAfter: {},
    });
  };

  const handleExportCsv = () => {
    const header = ['Kurs', 'Adim', ...displayBars].join(',');
    const lines = finalExpandedRows.map((item) => {
      const courseLabel = item.stepInCourse === 1 ? String(item.courseIndex) : '';
      const stepLabel = String(item.stepInCourse);
      return [
        courseLabel,
        stepLabel,
        ...displayBars.map((gb) => String(item.values[gb])),
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([header, ...lines].join('\r\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute(
      'download',
      `${pattern.title.toLowerCase().replace(/\s+/g, '_')}_4adim_desen_tablosu.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCopyTable = async () => {
    const header = ['Kurs', ...displayBars].join('\t');
    const lines = finalExpandedRows.map((item) => {
      const courseLabel = item.stepInCourse === 1 ? String(item.courseIndex) : '';
      return [courseLabel, ...displayBars.map((gb) => String(item.values[gb]))].join('\t');
    });
    try {
      await navigator.clipboard.writeText([header, ...lines].join('\n'));
      setCopyStatus('4 adımlı tablo panoya kopyalandı (Excel’e yapıştırabilirsiniz).');
      setTimeout(() => setCopyStatus(null), 2600);
    } catch {
      setCopyStatus('Kopyalama desteklenmiyor.');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const selectedCourseSource = useMemo(() => {
    const cIdx =
      activeSelectedRow?.sourceCourseIndex ?? activeSelectedRow?.courseIndex ?? selectedCourse;
    if (cIdx === null) return null;
    return rows.find((r, idx) => (r.courseIndex || idx + 1) === cIdx) || null;
  }, [rows, selectedCourse, activeSelectedRow]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-1.5 sm:px-3 py-2 sm:py-3 space-y-2.5 sm:space-y-3 font-sans">
      {/* Header Banner */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xl">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-700/80 rounded-xl text-blue-400 shrink-0 shadow-md">
            <Table2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white flex flex-wrap items-center gap-2">
              <span>Makine 4 Adımlı Desen Tablosu</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full">
                {displayCourseCount} Kurs · {finalExpandedRows.length} Adım
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-full">
                Maks Tel: {maxTelCount.toLocaleString('tr-TR')} Tel
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-full">
                Zorluk: {difficultyInfo.shortLabel} ({difficultyInfo.score}/100)
              </span>
              {totalSkipCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 rounded-full">
                  {totalSkipCount} Atlama Aktif
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Aktif desen (<strong>{pattern.title}</strong>) değiştirilmeden 4 adımlı tablo ve atlamaya bağlı Rack tansiyon tablosu hesaplanır.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowAllBars((prev) => !prev)}
            className="px-2.5 py-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{showAllBars ? 'Tüm Taraklar (GB1-GB6)' : 'Sadece Aktif Taraklar'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyTable}
            className="px-2.5 py-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kopyala</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV İndir (4 Adım)</span>
          </button>
        </div>
      </section>

      {copyStatus && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyStatus}</span>
        </div>
      )}

      {/* Stitch Structure Configuration Strip (Without mutating pattern) */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-200">Tarak İlmek Yapısı Seçimi:</span>
            <button
              type="button"
              onClick={() => setBarModes({ ...DEFAULT_HRD6_MODES })}
              className="px-2 py-1 bg-blue-950/70 hover:bg-blue-900/70 text-blue-200 border border-blue-800 rounded text-[11px] font-semibold cursor-pointer transition-colors"
            >
              HRD6-EL Karma (Ön/Arka/Çift)
            </button>
            <button
              type="button"
              onClick={() => setBarModes({ ...ALL_DOUBLE_MODES })}
              className="px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Tümü Çift Ray İlmek
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded border border-slate-800">
              <span className="text-[11px] text-amber-300 font-semibold mr-1">Atlama (Skip):</span>
              {[
                { id: 'front_skip' as const, label: 'Ön Atla (a·a·a·b)', title: 'Ön iğne rayını atlar, arka rayda ilmek bağlar (0,0,0,1 / 1,1,1,0)' },
                { id: 'back_skip' as const, label: 'Arka Atla (a·b·b·b)', title: 'Ön rayda ilmek yapar, arka rayı atlar' },
                { id: 'full_skip' as const, label: 'Tam Atla (N·N·N·N)', title: 'Her iki rayda da ilmek yapmadan düz geçer' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSkipBehavior(opt.id)}
                  title={opt.title}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                    skipBehavior === opt.id
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-[#111827] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-semibold">İlmek Adımı:</span>
              {[1, 2].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setLoopWidth(w)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                    loopWidth === w
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#0B0F17] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  +{w} İğne
                </button>
              ))}

              <div className="flex flex-wrap items-center gap-1 bg-[#0B0F17] px-1.5 py-0.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Tarak:</span>
                <button
                  type="button"
                  onClick={() => setSelectedDescendingTarget('ALL')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                    selectedDescendingTarget === 'ALL'
                      ? 'bg-sky-700 text-white border-sky-500'
                      : 'bg-[#111827] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  Tümü
                </button>
                {displayBars.map((gbId) => {
                  const isSelectedTarget = selectedDescendingTarget === gbId;
                  const gbColor = pattern.guideBars[gbId]?.color || '#38bdf8';
                  return (
                    <button
                      key={gbId}
                      type="button"
                      onClick={() => setSelectedDescendingTarget(gbId)}
                      title={`Düşüş yönü değişimi için ${gbId} tarağını seç`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                        isSelectedTarget
                          ? 'bg-cyan-800 text-white border-cyan-400'
                          : 'bg-[#111827] text-slate-400 border-slate-700 hover:text-white'
                      }`}
                      style={
                        !isSelectedTarget
                          ? { borderBottomColor: gbColor, borderBottomWidth: '2px' }
                          : undefined
                      }
                    >
                      {gbId}
                    </button>
                  );
                })}

                {(() => {
                  const targetBars =
                    selectedDescendingTarget === 'ALL' ? displayBars : [selectedDescendingTarget];
                  const firstMode = descendingStartModes[targetBars[0]];
                  const allSame = targetBars.every((id) => descendingStartModes[id] === firstMode);
                  const nextMode: DescendingStartMode = allSame
                    ? getNextDescendingMode(firstMode)
                    : 'smooth_chain';
                  const targetLabel =
                    selectedDescendingTarget === 'ALL' ? 'Tümü' : selectedDescendingTarget;
                  const modeLabel = allSame ? DESC_MODE_LABELS[firstMode] : 'Düşüş: Karma';

                  const btnColors = !allSame
                    ? 'bg-amber-950/80 text-amber-200 border-amber-700 hover:bg-amber-900/80'
                    : firstMode === 'smooth_chain'
                    ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700 hover:bg-emerald-900/80'
                    : firstMode === 'low_first'
                    ? 'bg-cyan-950/80 text-cyan-200 border-cyan-700 hover:bg-cyan-900/80'
                    : 'bg-indigo-950/80 text-indigo-200 border-indigo-700 hover:bg-indigo-900/80';

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setDescendingStartModes((prev) => {
                          const updated = { ...prev };
                          if (selectedDescendingTarget === 'ALL') {
                            ALL_GB_IDS.forEach((id) => {
                              updated[id] = nextMode;
                            });
                          } else {
                            updated[selectedDescendingTarget] = nextMode;
                          }
                          return updated;
                        });
                      }}
                      title={`${targetLabel} için tüm kurslarda geçiş/düşüş yönünü değiştir (Zincir ±1 / Düşükten / Yüksekten)`}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer transition-colors flex items-center gap-1 ml-0.5 ${btnColors}`}
                    >
                      <ArrowDownUp className="w-3 h-3 shrink-0" />
                      <span>
                        {selectedDescendingTarget !== 'ALL' ? `${selectedDescendingTarget} ` : ''}
                        {modeLabel}
                      </span>
                    </button>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => {
                  setBarModes({ ...DEFAULT_HRD6_MODES });
                  setSkipBehavior('front_skip');
                  setLoopWidth(1);
                  setDescendingStartModes({ ...DEFAULT_DESCENDING_MODES });
                  setSelectedDescendingTarget('ALL');
                }}
                className="p-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded cursor-pointer"
                title="Varsayılana Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Per-Bar Mode Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {displayBars.map((gbId) => {
            const gb = pattern.guideBars[gbId];
            const gbColor = gb?.color || '#3b82f6';
            const currentMode = barModes[gbId];
            const currentDescMode = descendingStartModes[gbId];
            const isActive = gb?.active ?? true;

            return (
              <div
                key={gbId}
                className={`bg-[#0B0F17] border rounded-lg p-2 space-y-1.5 ${
                  selectedDescendingTarget === gbId
                    ? 'border-cyan-500/80 ring-1 ring-cyan-500/30'
                    : isActive
                    ? 'border-slate-700'
                    : 'border-slate-800/70 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-mono flex items-center gap-1.5" style={{ color: gbColor }}>
                    <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: gbColor }} />
                    <span>{gbId}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>

                <select
                  value={currentMode}
                  onChange={(e) =>
                    setBarModes((prev) => ({
                      ...prev,
                      [gbId]: e.target.value as StitchLoopMode,
                    }))
                  }
                  className="w-full bg-[#111827] border border-slate-700 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="double_bed">{MODE_LABELS.double_bed}</option>
                  <option value="front_bed">{MODE_LABELS.front_bed}</option>
                  <option value="back_bed">{MODE_LABELS.back_bed}</option>
                  <option value="inlay">{MODE_LABELS.inlay}</option>
                </select>

                <div className="text-[10px] font-mono text-slate-400 text-center bg-[#111827]/70 rounded py-0.5">
                  {MODE_SHORT_FORMULAS[currentMode]}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDescendingStartModes((prev) => ({
                      ...prev,
                      [gbId]: getNextDescendingMode(prev[gbId]),
                    }))
                  }
                  title={`${gbId} için tüm kurslarda geçiş/düşüş yönünü değiştir (Zincir ±1 / Düşükten / Yüksekten)`}
                  className={`w-full px-1.5 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                    currentDescMode === 'smooth_chain'
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-800 hover:bg-emerald-900/70'
                      : currentDescMode === 'low_first'
                      ? 'bg-cyan-950/70 text-cyan-200 border-cyan-800 hover:bg-cyan-900/70'
                      : 'bg-indigo-950/70 text-indigo-200 border-indigo-800 hover:bg-indigo-900/70'
                  }`}
                >
                  <ArrowDownUp className="w-2.5 h-2.5 shrink-0" />
                  <span>{DESC_MODE_LABELS[currentDescMode]}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Content Grid: Left = 4-Step Table | Right = Kumaş Sıklığı (May) + Rack Tansiyon Tablosu */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* Main 4-Step Machine Pattern Table */}
        <section className="xl:col-span-7 rounded-xl border overflow-hidden shadow-2xl bg-[#0B0F17] border-slate-800">
          {/* Table Status Bar */}
          <div className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0F172A] border-slate-800 text-slate-200">
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="text-sky-400 font-bold">
                Çalışma Düzeni: 4 Adımlı Makine Desen Zinciri
              </span>
              <span className="opacity-50">|</span>
              <span className="font-mono text-[11px]">
                {pattern.title} ({displayCourseCount} Kurs)
              </span>
              {isTableManualOverride ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 border border-amber-700 text-amber-300">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Elle Girildi (Sabit — Otomatik Değişmez)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
                  <Edit3 className="w-2.5 h-2.5 text-cyan-400" />
                  <span>Tablo düzenlemeleri ana deseni değiştirmez</span>
                </span>
              )}
              {(isTableManualOverride || tableEditCount > 0) && (
                <button
                  type="button"
                  onClick={handleResetManualTableOverrides}
                  title="Elle sabitlenen tabloyu sıfırla ve otomatik hesaplamaya dön"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 hover:bg-amber-900/90 text-amber-200 border border-amber-700 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Otomatiğe Dön</span>
                </button>
              )}
            </div>

            {selectedCourseSource && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-400 font-sans font-semibold">
                  Kurs {selectedCourseSource.courseIndex || activeSelectedRow?.sourceCourseIndex || activeSelectedRow?.courseIndex} Ham:
                </span>
                {displayBars.map((gbId) => {
                  const isBarSkipped = Boolean(selectedCourseSource.skips?.[gbId]);
                  return (
                    <span
                      key={gbId}
                      className={`px-1.5 py-0.5 rounded border font-bold ${
                        isBarSkipped
                          ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                          : 'bg-[#111827] border-slate-700 text-slate-100'
                      }`}
                    >
                      {gbId}:{selectedCourseSource[gbId] ?? 0}
                      {isBarSkipped ? ' (ATLA)' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Table-Only Step Editing Bar (Ekstra Kurs Ekle / Çıkar + Geri Al + Tablo Atlama) */}
          <div className="px-3 py-2 border-b bg-[#0B1220] border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-300 mr-0.5">
                {activeSelectedRow ? (
                  <span>
                    Seçili:{' '}
                    <strong className="text-sky-400 font-mono">
                      K{activeSelectedRow.courseIndex}·{activeSelectedRow.stepInCourse}
                    </strong>
                  </span>
                ) : (
                  <span>Tablo İşlemleri:</span>
                )}
              </span>

              <button
                type="button"
                onClick={handleInsertExtraCourse}
                title="Seçili kursun altına yeni bir kurs (4 adım) ekleyerek kurs sayısını artır (ana deseni etkilemez)"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-cyan-900/70 hover:bg-cyan-800 text-cyan-100 border border-cyan-700/80 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-300" />
                <span>Ekstra Kurs Ekle</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteSelectedStep}
                disabled={!activeSelectedRow}
                title="Seçili adımı yalnızca 4 adımlı tablodan çıkar (ana deseni etkilemez)"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-rose-950/80 hover:bg-rose-900/80 disabled:opacity-40 text-rose-200 border border-rose-800/80 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <MinusCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Adımı Çıkar</span>
              </button>

              <button
                type="button"
                onClick={handleUndoTableEdit}
                disabled={undoStack.length === 0}
                title="Tabloda yapılan son değişikliği geri al"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-slate-800/90 hover:bg-slate-700 disabled:opacity-40 text-slate-100 border border-slate-600/80 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Geri Al{undoStack.length > 0 ? ` (${undoStack.length})` : ''}</span>
              </button>
            </div>

            {activeSelectedRow && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 mr-1">
                  Tablo Atlama:
                </span>
                {displayBars.map((gbId) => {
                  const isSkipped = Boolean(activeSelectedRow.skippedBars[gbId]);
                  const srcCourseIdx =
                    activeSelectedRow.sourceCourseIndex ?? activeSelectedRow.courseIndex;
                  const skipKey = `${srcCourseIdx}-${gbId}`;
                  const hasOverride =
                    !activeSelectedRow.isInserted && skipKey in tableSkipOverrides;
                  return (
                    <button
                      key={gbId}
                      type="button"
                      onClick={() => handleToggleTableSkip(gbId)}
                      title={`${gbId} için yalnızca bu tabloda ${
                        isSkipped ? 'Atlama Yapma' : 'Atlama Yap'
                      }`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                        isSkipped
                          ? 'bg-amber-600/90 hover:bg-amber-500 text-white border-amber-400'
                          : 'bg-[#111827] hover:bg-slate-800 text-slate-300 border-slate-700'
                      } ${hasOverride ? 'ring-1 ring-cyan-400/70' : ''}`}
                    >
                      {gbId}: {isSkipped ? 'Atlama Yap' : 'Yapma'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scrollable High-Density 4-Step Table */}
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table className="w-full text-center font-mono text-xs sm:text-sm border-collapse tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#111827] text-slate-100 border-b border-slate-700">
                <tr>
                  <th className="py-2 px-2 sm:px-3 w-16 sm:w-20 border-r font-bold text-xs border-slate-800 text-slate-300">
                    Kurs
                  </th>
                  {displayBars.map((gbId) => {
                    const gb = pattern.guideBars[gbId];
                    const gbColor = gb?.color || '#3b82f6';
                    return (
                      <th
                        key={gbId}
                        className="py-2 px-2 sm:px-4 border-r font-bold border-slate-800"
                        style={{
                          color: gbColor,
                          borderBottom: `2px solid ${gbColor}`,
                        }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: gbColor }}
                          />
                          <span>{gbId}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {finalExpandedRows.map((item) => {
                  const isCourseStart = item.stepInCourse === 1;
                  const isCourseEnd = item.stepInCourse === 4;
                  const isSelectedStep = activeSelectedRow?.rowKey === item.rowKey;
                  const isSelectedCourse = activeSelectedRow?.courseIndex === item.courseIndex;
                  const isEvenStep = item.stepInCourse % 2 === 0;

                  let rowBgClass = '';
                  let rowTextClass = '';

                  if (isSelectedStep) {
                    rowBgClass = 'bg-blue-600/40';
                    rowTextClass = 'text-white font-extrabold';
                  } else if (isSelectedCourse) {
                    rowBgClass = isEvenStep ? 'bg-blue-950/35' : 'bg-blue-950/20';
                    rowTextClass = 'text-slate-100 font-semibold';
                  } else {
                    rowBgClass = isEvenStep ? 'bg-[#111827]/90' : 'bg-[#0B0F17]';
                    rowTextClass = 'text-slate-200 font-medium';
                  }

                  const borderBottomClass = isCourseEnd
                    ? 'border-b-2 border-slate-700'
                    : 'border-b border-slate-800/70';

                  const cellBorderRight = 'border-r border-slate-800/70';

                  return (
                    <tr
                      key={item.rowKey}
                      onClick={() => {
                        setSelectedStepKey(item.rowKey);
                        setSelectedCourse(item.courseIndex);
                      }}
                      className={`${rowBgClass} ${rowTextClass} ${borderBottomClass} cursor-pointer transition-colors hover:brightness-105`}
                    >
                      <td className={`py-1 px-2 sm:px-3 ${cellBorderRight}`}>
                        {isCourseStart ? (
                          <span className="inline-block font-bold text-sky-400">
                            {item.courseIndex}
                          </span>
                        ) : (
                          <span className="text-[10px] select-none text-slate-600">
                            ·{item.stepInCourse}
                          </span>
                        )}
                      </td>

                      {displayBars.map((gbId) => {
                        const val = item.values[gbId];
                        const cellKey = `${item.rowKey}-${gbId}`;
                        const legacyKey = `${item.sourceCourseIndex ?? item.courseIndex}-${item.stepInCourse}-${gbId}`;
                        const isManuallyEdited =
                          typeof manualTableOverrides[cellKey] === 'number' ||
                          (!item.isInserted && typeof manualTableOverrides[legacyKey] === 'number');
                        const isEditingThis = editingCell?.key === cellKey;
                        const isSkipped = Boolean(item.skippedBars[gbId]);
                        const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';

                        const cellStateClass = isManuallyEdited
                          ? 'bg-cyan-950/55 text-cyan-200 font-bold'
                          : isSkipped
                          ? 'bg-amber-950/45 text-amber-300 font-bold'
                          : '';

                        return (
                          <td
                            key={gbId}
                            className={`p-0.5 sm:px-2 ${cellBorderRight} ${cellStateClass}`}
                            title={`Kurs ${item.courseIndex} · Adım ${item.stepInCourse} · ${gbId}: ${val}${
                              isManuallyEdited ? ' (ELLE DÜZENLENDİ)' : isSkipped ? ' (ATLAMA AKTİF)' : ''
                            }`}
                          >
                            <div className="inline-flex items-center justify-center gap-1 w-full">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={isEditingThis ? editingCell.text : String(val)}
                                onFocus={(e) => {
                                  setSelectedStepKey(item.rowKey);
                                  setSelectedCourse(item.courseIndex);
                                  preEditSnapshotRef.current = captureSnapshot();
                                  setEditingCell({ key: cellKey, text: String(val) });
                                  e.target.select();
                                }}
                                onChange={(e) => {
                                  handleLiveTableCellChange(item.rowKey, cellKey, gbId, e.target.value);
                                }}
                                onBlur={() => {
                                  const snap = preEditSnapshotRef.current;
                                  if (snap) {
                                    const changed =
                                      snap.isTableManualOverride !== isTableManualOverride ||
                                      snap.manualTableOverrides[cellKey] !== manualTableOverrides[cellKey] ||
                                      JSON.stringify(snap.lockedTableRows) !== JSON.stringify(lockedTableRows);
                                    if (changed) {
                                      pushUndoSnapshot(snap);
                                    }
                                    preEditSnapshotRef.current = null;
                                  }
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  } else if (e.key === 'Escape') {
                                    const snap = preEditSnapshotRef.current;
                                    preEditSnapshotRef.current = null;
                                    if (snap) {
                                      applySnapshot(snap);
                                    } else {
                                      setEditingCell(null);
                                    }
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                aria-label={`Kurs ${item.courseIndex} Adım ${item.stepInCourse} ${gbId}`}
                                className={`w-12 sm:w-14 text-center font-mono text-xs sm:text-sm py-1 px-1 rounded transition-colors focus:outline-none tabular-nums ${
                                  isEditingThis
                                    ? 'bg-[#070B12] border border-cyan-400 text-white ring-1 ring-cyan-500/40'
                                    : isManuallyEdited
                                    ? 'bg-cyan-900/35 border border-cyan-600/70 text-cyan-200 hover:border-cyan-400'
                                    : 'bg-transparent border border-transparent hover:bg-[#070B12]/70 hover:border-slate-700'
                                }`}
                                style={
                                  !isEditingThis && !isManuallyEdited && !isSkipped && isCourseStart
                                    ? { color: gbColor }
                                    : undefined
                                }
                              />
                              {isSkipped && isCourseStart && (
                                <span className="text-[9px] px-1 rounded font-sans font-bold bg-amber-600/85 text-white shrink-0">
                                  ATLA
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Info Note */}
          <div className="px-3 py-2 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 bg-[#0F172A] border-slate-800 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>
                Her kurs numarası altında 4 makine adımı listelenir. Desen verisi korunur.
              </span>
            </div>
            <span className="font-mono font-semibold">
              1 Kurs = 4 Adım
            </span>
          </div>
        </section>

        {/* Right Column: Manual Kumaş Sıklığı (May) + Auto/Manual Rack Tansiyon Tablosu */}
        <div className="xl:col-span-5 space-y-3">
          {/* Kumaş Sıklığı (May) Card */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-950/80 border border-cyan-800 rounded-lg text-cyan-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-white">
                    Kumaş Sıklığı (May)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    PNG dosya adına (Örn: 6,54M) ve rapor görseline eklenir.
                  </p>
                </div>
              </div>
              {mayDensity.trim() !== '' && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold">
                  {mayDensity.replace('.', ',')} May
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="may-density-input"
                className="text-xs font-semibold text-slate-300 whitespace-nowrap"
              >
                May Değeri:
              </label>
              <input
                id="may-density-input"
                type="text"
                inputMode="decimal"
                value={mayDensity}
                onChange={(e) => handleMayChange(e.target.value)}
                placeholder="Örn: 6,54"
                className="flex-1 bg-[#0B0F17] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </section>

          {/* Rack Tansiyon Tablosu */}
          <section className="bg-[#0B0F17] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-3 py-2.5 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-extrabold text-white">
                      Rack Tansiyon Tablosu
                    </h2>
                    {isRackManualOverride ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 border border-amber-700 text-amber-300">
                        <Lock className="w-2.5 h-2.5" />
                        Elle Girildi (Sabit)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/90 border border-emerald-700 text-emerald-300">
                        <Sparkles className="w-2.5 h-2.5" />
                        Otomatik (Atlama)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Elle müdahale edilebilir; değişiklik desene yansımaz ve otomatik sıfırlanmaz.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddRackRow}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Satır Ekle</span>
                </button>
                <button
                  type="button"
                  onClick={handleRecalculateRackFromSkips}
                  title="Atlamalara göre otomatik yeniden hesapla"
                  className="px-2 py-1 bg-[#111827] hover:bg-slate-800 text-sky-300 hover:text-white border border-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Otomatik</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center font-mono text-xs border-collapse tabular-nums">
                <thead className="bg-[#111827] text-slate-100 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-2 w-12 border-r border-slate-800 font-bold text-[11px] text-slate-300">
                      Sayı
                    </th>
                    <th className="py-2 px-2 w-24 border-r border-slate-800 font-bold text-[11px] text-sky-300">
                      Kurs numarası
                    </th>
                    {displayBars.map((gbId) => {
                      const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                      return (
                        <th
                          key={gbId}
                          className="py-2 px-2 border-r border-slate-800 font-bold text-xs min-w-[78px]"
                          style={{
                            color: gbColor,
                            borderBottom: `2px solid ${gbColor}`,
                          }}
                        >
                          {gbId}
                        </th>
                      );
                    })}
                    <th className="py-2 px-1.5 w-9 text-[11px] text-slate-400">Sil</th>
                  </tr>
                </thead>
                <tbody>
                  {rackTensionRows.map((rRow, rIdx) => {
                    const isEven = rIdx % 2 === 1;
                    return (
                      <tr
                        key={rRow.id}
                        className={`${
                          isEven ? 'bg-[#111827]/90' : 'bg-[#0B0F17]'
                        } border-b border-slate-800/80`}
                      >
                        <td className="py-1.5 px-2 border-r border-slate-800/80 font-bold text-sky-400">
                          {rIdx}
                        </td>

                        <td className="p-1 border-r border-slate-800/80">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={rRow.courseCount}
                            onChange={(e) => handleRackCourseChange(rIdx, e.target.value)}
                            placeholder="29"
                            className="w-full bg-[#070B12] border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-1 text-center text-xs font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none"
                          />
                        </td>

                        {displayBars.map((gbId) => {
                          const cellVal = rRow.values[gbId] ?? '';
                          const numVal = parseFloat(cellVal);
                          const isSkipTension = !isNaN(numVal) && numVal > 0 && numVal <= 5000;
                          return (
                            <td key={gbId} className="p-1 border-r border-slate-800/80">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cellVal}
                                onChange={(e) =>
                                  handleRackBarValueChange(rIdx, gbId, e.target.value)
                                }
                                placeholder="17500"
                                className={`w-full rounded px-1.5 py-1 text-center text-xs font-mono font-bold placeholder:text-slate-600 focus:outline-none border ${
                                  isSkipTension
                                    ? 'bg-amber-950/50 border-amber-600/80 text-amber-300 focus:border-amber-400'
                                    : 'bg-[#070B12] border-slate-700/80 text-emerald-300 focus:border-emerald-500'
                                }`}
                              />
                            </td>
                          );
                        })}

                        <td className="p-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteRackRow(rIdx)}
                            title="Satırı Sil"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 bg-[#0F172A] border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Normal: <strong className="text-emerald-300">17500</strong> · Atlama:{' '}
                  <strong className="text-amber-300">3000</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Desen değiştirilmeden hesaplanır
              </span>
            </div>

            {/* Rack Tansiyon Altı Not Alanı (PNG / PDF Raporunda Görünür) */}
            <div className="p-3 bg-[#0B0F17] border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="rack-note-input"
                  className="text-xs font-bold text-amber-300 flex items-center gap-1.5"
                >
                  <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Not (PNG ve PDF Raporunda Görünür)</span>
                </label>
                {rackNote.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => handleRackNoteChange('')}
                    className="text-[10px] text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <textarea
                id="rack-note-input"
                rows={3}
                value={rackNote}
                onChange={(e) => handleRackNoteChange(e.target.value)}
                placeholder="Makine operatörü, iplik gerginliği, kalite veya numune notu ekleyin (PNG ve PDF çıktılarına otomatik eklenir)..."
                className="w-full bg-[#070B12] border border-slate-700 focus:border-amber-500 rounded-lg px-2.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none resize-y"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
