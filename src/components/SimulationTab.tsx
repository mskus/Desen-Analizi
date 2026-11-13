import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PatternData, GuideBarId, GuideBarConfig, SafetyConfig, PatternRow } from '../types';
import { calculateGuideBarMetrics, GuideBarCalcBadge } from '../utils/fabricCalculator';
import {
  ALL_GB_IDS,
  buildExpandedFourStepRows,
  loadSavedTableSettings,
  loadPatternTableExtras,
  computePatternDifficulty,
  applyManualTableOverrides,
} from '../utils/patternTableCalc';
import { buildHighResPatternPdf, getTrimmedSourceBounds } from '../utils/pdfReport';
import {
  ZoomIn,
  ZoomOut,
  Download,
  Share2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Plus,
  Minus,
  Trash2,
  Hash,
  LayoutTemplate,
  Wand2,
  Eye,
  ArrowRightLeft,
  ArrowUpDown,
  MoveHorizontal,
  MoveVertical,
  Grid3X3,
  Activity,
  CircleDot,
  FileCode2,
  FileText,
  Layers,
  Grid,
  Palette,
} from 'lucide-react';
import {
  SOFT_YARN_PALETTES,
  SOFT_YARN_SWATCHES,
  hasHarshYarnColors,
} from '../utils/yarnColors';

interface SimulationTabProps {
  pattern: PatternData;
  onChangeGuideBar: (id: GuideBarId, updated: GuideBarConfig) => void;
  onChangeRows?: (rows: PatternRow[]) => void;
  onChangeSafety?: (safety: SafetyConfig) => void;
  onChangeMachine?: (machine: PatternData['machine']) => void;
  onOpenSafetySettings: () => void;
  activeTab?: any;
  setActiveTab?: (tab: any) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fabricWidthCm?: number;
  onChangeFabricWidth?: (widthCm: number) => void;
}

type SimulationDisplayMode = 'dual' | 'technical' | 'fabric';

const SIMULATION_SETTINGS_KEY = 'warpknitt_simulation_settings';

interface StoredSimSettings {
  displayMode?: SimulationDisplayMode;
  paperTheme?: 'dark' | 'white';
  repeatX?: number;
  repeatY?: number;
  showStepNumbers?: boolean;
  showPoreMesh?: boolean;
  showNeedleDots?: boolean;
  isolateActiveBar?: boolean;
  editingGbId?: GuideBarId;
  visibleBars?: Record<GuideBarId, boolean>;
  isAutoZoom?: boolean;
  zoom?: number;
}

const getInitialSimSettings = (): StoredSimSettings => {
  try {
    const saved = localStorage.getItem(SIMULATION_SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse simulation settings', e);
  }
  return {};
};

export const SimulationTab: React.FC<SimulationTabProps> = ({
  pattern,
  onChangeGuideBar,
  onChangeRows,
  onChangeSafety,
  onChangeMachine,
  onOpenSafetySettings,
  onToggleFullscreen,
  isFullscreen: externalFs,
  fabricWidthCm = 410,
  onChangeFabricWidth,
}) => {
  const simWrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Manual Quick Threading Pattern Inputs
  const [manualInCount, setManualInCount] = useState<number>(3);
  const [manualOutCount, setManualOutCount] = useState<number>(2);
  const [manualStartMode, setManualStartMode] = useState<'filled' | 'empty'>('filled');
  const [customRuleText, setCustomRuleText] = useState<string>('');

  // Mouse / Touch Drag-Select for Batch Needle Toggle
  const isMouseDownRef = useRef<boolean>(false);
  const dragTargetValRef = useRef<boolean>(true);
  const lastDragIdxRef = useRef<number | null>(null);

  const toggleSimFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    if (!simWrapperRef.current) return;
    if (!document.fullscreenElement) {
      simWrapperRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  const savedSettings = getInitialSimSettings();

  const [displayMode, setDisplayMode] = useState<SimulationDisplayMode>(
    savedSettings.displayMode || 'fabric'
  );

  const [guideBarsState, setGuideBarsState] = useState<Record<GuideBarId, GuideBarConfig>>(
    pattern.guideBars
  );

  useEffect(() => {
    setGuideBarsState(pattern.guideBars);
  }, [pattern.guideBars, pattern.rows]);

  const touchDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistRef.current !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = newDist - touchDistRef.current;
      if (Math.abs(delta) > 8) {
        const zoomFactor = delta > 0 ? 0.04 : -0.04;
        setIsAutoZoom(false);
        setZoom((prev) => Math.max(0.25, Math.min(2.5, prev + zoomFactor)));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  const [isolateActiveBar, setIsolateActiveBar] = useState<boolean>(
    savedSettings.isolateActiveBar ?? false
  );
  const [editingGbId, setEditingGbId] = useState<GuideBarId>(
    savedSettings.editingGbId || 'GB3'
  );
  const [binaryThreadingInput, setBinaryThreadingInput] = useState<string>('');
  const [paperTheme] = useState<'dark' | 'white'>(savedSettings.paperTheme || 'dark');

  const [showStepNumbers, setShowStepNumbers] = useState(savedSettings.showStepNumbers ?? true);
  const [showPoreMesh, setShowPoreMesh] = useState(savedSettings.showPoreMesh ?? true);
  const [showNeedleDots, setShowNeedleDots] = useState<boolean>(savedSettings.showNeedleDots ?? true);
  const [showBarGaps] = useState<boolean>(true);
  const [showEmptyLoopInfo] = useState<boolean>(true);

  // Horizontal & Vertical Pattern Repeat
  const [repeatX, setRepeatX] = useState<number>(savedSettings.repeatX ?? 1);
  const [repeatY, setRepeatY] = useState<number>(savedSettings.repeatY ?? 2);
  const [isAutoZoom, setIsAutoZoom] = useState<boolean>(savedSettings.isAutoZoom ?? true);
  const [zoom, setZoom] = useState<number>(savedSettings.zoom ?? 1);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showSoftColorPicker, setShowSoftColorPicker] = useState<boolean>(false);
  const [customCoursePitch] = useState<number>(36);

  const [visibleBars, setVisibleBars] = useState<Record<GuideBarId, boolean>>(
    savedSettings.visibleBars || {
      GB1: true,
      GB2: true,
      GB3: true,
      GB4: true,
      GB5: true,
      GB6: true,
    }
  );

  const technicalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const techContainerRef = useRef<HTMLDivElement | null>(null);
  const fabricContainerRef = useRef<HTMLDivElement | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(1200);

  useEffect(() => {
    let rafId = 0;
    const updateWidth = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const parent = fabricContainerRef.current || techContainerRef.current || simWrapperRef.current;
        if (parent) {
          const w = parent.clientWidth;
          if (w > 0) {
            const nextWidth = Math.max(360, w - 8);
            setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
          }
        }
      });
    };
    updateWidth();

    let ro: ResizeObserver | null = null;
    const target = simWrapperRef.current;
    if (typeof ResizeObserver !== 'undefined' && target) {
      ro = new ResizeObserver(updateWidth);
      ro.observe(target);
    }

    const t1 = setTimeout(updateWidth, 80);
    window.addEventListener('resize', updateWidth);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [displayMode]);

  // Base needle count (up to 300) and total needles with horizontal repeat (repeatX)
  const needleCols = Math.max(4, Math.min(300, (pattern.safety?.maxAllowedNeedleNumber || 18) + 1));
  const [needleInputText, setNeedleInputText] = useState<string>(String(needleCols));

  useEffect(() => {
    setNeedleInputText(String(needleCols));
  }, [needleCols]);
  const totalNeedles = needleCols * repeatX;
  const baseNeedlePitch = totalNeedles > 200 ? 6 : totalNeedles > 150 ? 8 : totalNeedles > 96 ? 12 : totalNeedles > 64 ? 18 : totalNeedles > 32 ? 24 : 34;

  const currentGuideBars = guideBarsState || pattern.guideBars;
  const activeBars = ALL_GB_IDS.filter(
    (id) => currentGuideBars[id]?.active
  );

  const rows = pattern.rows;
  const totalCourses = Math.max(1, rows.length * repeatY);

  // Guide Bar Calculation Engine: Fabric width, needle limit, threading repeat, and report repeat counts
  const guideBarCalculations = useMemo(() => {
    const map: Partial<Record<GuideBarId, ReturnType<typeof calculateGuideBarMetrics>>> = {};
    ALL_GB_IDS.forEach((id) => {
      const gb = currentGuideBars[id];
      if (gb) {
        map[id] = calculateGuideBarMetrics(
          id,
          gb,
          rows,
          pattern.machine,
          pattern.safety,
          fabricWidthCm
        );
      }
    });
    return map;
  }, [currentGuideBars, rows, pattern.machine, pattern.safety, fabricWidthCm]);

  // Balanced, tight left and right padding (36px left, 36px right)
  const padX = 36;
  const startY = 70;

  // Single repeat base needle width
  const baseReportWidth = Math.max(containerWidth, (needleCols - 1) * baseNeedlePitch + padX * 2);
  const baseNeedlePitchEffective = Math.max(baseNeedlePitch, (baseReportWidth - padX * 2) / Math.max(1, needleCols - 1));

  // When repeatX is 1x, 2x, 3x, 4x, the fabric canvas width scales proportionally
  const techCanvasWidth = Math.max(containerWidth, (totalNeedles - 1) * baseNeedlePitchEffective + padX * 2);
  const fabricCanvasWidth = Math.max(containerWidth, (totalNeedles - 1) * baseNeedlePitchEffective + padX * 2);

  // Needle pitch remains identical across 1x-4x so loops preserve exact proportion without stretching or shrinking
  const needlePitch = baseNeedlePitchEffective;

  // Maintain fixed true-to-life aspect ratio (course pitch scales proportionally with needle pitch so loop geometry never distorts)
  const coursePitch = Math.round(needlePitch * 1.35);

  const canvasHeight = Math.max(520, startY + totalCourses * coursePitch + 28);

  // Fit vertically to screen height
  const calculateSimFitZoom = useCallback(() => {
    if (!isAutoZoom) return;
    const container = fabricContainerRef.current || techContainerRef.current;
    const isFs = isFullscreen || externalFs || !!document.fullscreenElement;
    const availHeight = isFs
      ? window.innerHeight - 80
      : container && container.clientHeight > 0
      ? container.clientHeight - 16
      : 640;

    if (availHeight > 0 && canvasHeight > 0) {
      const fit = availHeight / canvasHeight;
      const clamped = Math.max(0.2, Math.min(1.5, Math.floor(fit * 100) / 100));
      setZoom(clamped);
    }
  }, [isAutoZoom, canvasHeight, isFullscreen, externalFs]);

  useEffect(() => {
    calculateSimFitZoom();
  }, [calculateSimFitZoom, needleCols, repeatX, repeatY, displayMode, isFullscreen, externalFs]);

  useEffect(() => {
    if (!isAutoZoom) return;
    const handleResize = () => calculateSimFitZoom();
    window.addEventListener('resize', handleResize);
    window.addEventListener('fullscreenchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('fullscreenchange', handleResize);
    };
  }, [isAutoZoom, calculateSimFitZoom]);

  useEffect(() => {
    const settingsToSave: StoredSimSettings = {
      displayMode,
      paperTheme,
      repeatX,
      repeatY,
      showStepNumbers,
      showPoreMesh,
      showNeedleDots,
      isolateActiveBar,
      editingGbId,
      visibleBars,
      isAutoZoom,
      zoom,
    };
    localStorage.setItem(SIMULATION_SETTINGS_KEY, JSON.stringify(settingsToSave));
  }, [
    displayMode,
    paperTheme,
    repeatX,
    repeatY,
    showStepNumbers,
    showPoreMesh,
    showNeedleDots,
    isolateActiveBar,
    editingGbId,
    visibleBars,
    isAutoZoom,
    zoom,
  ]);

  const currentGb = currentGuideBars[editingGbId] || currentGuideBars.GB3 || currentGuideBars.GB1;
  const currentThreading = Array.from({ length: needleCols }, (_, i) => {
    if (currentGb?.threadingArray && typeof currentGb.threadingArray[i] === 'boolean') {
      return currentGb.threadingArray[i];
    }
    return i % 2 === 0;
  });

  useEffect(() => {
    const binStr = currentThreading.map((b) => (b ? '1' : '0')).join('');
    setBinaryThreadingInput(binStr);
  }, [editingGbId, currentGb?.threadingArray, needleCols]);

  const scheduleRedraw = useCallback(
    (overrideBars?: Record<GuideBarId, GuideBarConfig>) => {
      requestAnimationFrame(() => {
        if (displayMode === 'technical' || displayMode === 'dual') {
          drawTechnicalDiagram(overrideBars);
        }
        if (displayMode === 'fabric' || displayMode === 'dual') {
          drawFabricSimulation(overrideBars);
        }
      });
    },
    [displayMode]
  );

  const handleSetNeedleBatch = useCallback(
    (indices: number[], targetState: boolean) => {
      const updatedArray = [...currentThreading];
      let changed = false;
      indices.forEach((idx) => {
        if (idx >= 0 && idx < needleCols && updatedArray[idx] !== targetState) {
          updatedArray[idx] = targetState;
          changed = true;
        }
      });
      if (!changed) return;

      const binStr = updatedArray.map((b) => (b ? '1' : '0')).join('');
      setBinaryThreadingInput(binStr);

      const updatedGb: GuideBarConfig = {
        ...currentGb,
        threadingArray: updatedArray,
        threading: 'Özel',
      };

      const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
        ...currentGuideBars,
        [editingGbId]: updatedGb,
      };

      setGuideBarsState(newGuideBars);
      onChangeGuideBar(editingGbId, updatedGb);
      scheduleRedraw(newGuideBars);
    },
    [currentThreading, needleCols, currentGb, currentGuideBars, editingGbId, onChangeGuideBar, scheduleRedraw]
  );

  const handleToggleNeedle = (nIdx: number) => {
    handleSetNeedleBatch([nIdx], !currentThreading[nIdx]);
  };

  useEffect(() => {
    const handlePointerEnd = () => {
      isMouseDownRef.current = false;
      lastDragIdxRef.current = null;
    };
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('mouseup', handlePointerEnd);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, []);

  const handleApplyPreset = (
    preset: 'full' | 'clear' | '5-5' | '1-1' | '1-2' | '1-3' | '2-2' | '3-3' | '4-4' | '6-2' | '12-12' | 'invert'
  ) => {
    const newArr = Array.from({ length: needleCols }, (_, i) => {
      if (preset === 'full') return true;
      if (preset === 'clear') return false;
      if (preset === '5-5') return i % 10 < 5;
      if (preset === '1-1') return i % 2 === 0;
      if (preset === '1-2') return i % 3 === 0;
      if (preset === '1-3') return i % 4 === 0;
      if (preset === '2-2') return Math.floor(i / 2) % 2 === 0;
      if (preset === '3-3') return Math.floor(i / 3) % 2 === 0;
      if (preset === '4-4') return Math.floor(i / 4) % 2 === 0;
      if (preset === '6-2') return i % 8 < 6;
      if (preset === '12-12') return Math.floor(i / 12) % 2 === 0;
      if (preset === 'invert') return !currentThreading[i];
      return true;
    });

    const labelMap: Record<string, string> = {
      full: 'Full',
      clear: 'Boş',
      '5-5': '5-5',
      '1-1': '1-1',
      '1-2': '1-2',
      '1-3': '1-3',
      '2-2': '2-2',
      '3-3': '3-3',
      '4-4': '4-4',
      '6-2': '6-2',
      '12-12': '12-12',
      invert: 'Ters',
    };

    if (preset === '1-1') { setManualInCount(1); setManualOutCount(1); }
    else if (preset === '2-2') { setManualInCount(2); setManualOutCount(2); }
    else if (preset === '3-3') { setManualInCount(3); setManualOutCount(3); }
    else if (preset === '4-4') { setManualInCount(4); setManualOutCount(4); }
    else if (preset === '6-2') { setManualInCount(6); setManualOutCount(2); }
    else if (preset === '12-12') { setManualInCount(12); setManualOutCount(12); }
    else if (preset === '5-5') { setManualInCount(5); setManualOutCount(5); }

    setBinaryThreadingInput(newArr.map((b) => (b ? '1' : '0')).join(''));

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: labelMap[preset] || 'Özel',
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);
    scheduleRedraw(newGuideBars);
  };

  const handleApplyManualInOut = () => {
    const inCnt = Math.max(0, Math.min(96, manualInCount));
    const outCnt = Math.max(0, Math.min(96, manualOutCount));
    const cycle = Math.max(1, inCnt + outCnt);

    const newArr = Array.from({ length: needleCols }, (_, i) => {
      const mod = i % cycle;
      if (manualStartMode === 'filled') {
        return mod < inCnt;
      } else {
        // Start with Empty (Boş) needles first
        return mod >= outCnt;
      }
    });

    setBinaryThreadingInput(newArr.map((b) => (b ? '1' : '0')).join(''));

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: manualStartMode === 'filled' ? `${inCnt}D/${outCnt}B` : `${outCnt}B/${inCnt}D`,
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);
    scheduleRedraw(newGuideBars);
  };

  const handleApplyCustomRuleText = () => {
    const trimmed = customRuleText.trim();
    if (!trimmed) return;

    let newArr: boolean[] = [];
    if (/^[01]+$/.test(trimmed)) {
      newArr = Array.from({ length: needleCols }, (_, i) => trimmed[i % trimmed.length] === '1');
    } else {
      const parts = trimmed
        .split(/[-.,/\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => !isNaN(n) && n >= 0);

      if (parts.length > 0) {
        const patternUnit: boolean[] = [];
        const startFilled = manualStartMode === 'filled' && !trimmed.toLowerCase().startsWith('b');
        parts.forEach((count, idx) => {
          const isFilled = startFilled ? idx % 2 === 0 : idx % 2 === 1;
          for (let k = 0; k < count; k++) {
            patternUnit.push(isFilled);
          }
        });
        const unitLen = Math.max(1, patternUnit.length);
        newArr = Array.from({ length: needleCols }, (_, i) => patternUnit[i % unitLen]);
      }
    }

    if (newArr.length === 0) return;

    setBinaryThreadingInput(newArr.map((b) => (b ? '1' : '0')).join(''));

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: `Özel (${trimmed})`,
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);
    scheduleRedraw(newGuideBars);
  };

  const handleCopyThreadingToTarget = (targetId: GuideBarId | 'ALL') => {
    const srcConfig = currentGuideBars[editingGbId];
    if (!srcConfig) return;

    const updatedMap = { ...currentGuideBars };
    const targets: GuideBarId[] =
      targetId === 'ALL'
        ? activeBars.filter((id) => id !== editingGbId)
        : [targetId];

    targets.forEach((tId) => {
      const updatedGb: GuideBarConfig = {
        ...currentGuideBars[tId],
        threading: srcConfig.threading,
        threadingArray: [...currentThreading],
      };
      updatedMap[tId] = updatedGb;
      onChangeGuideBar(tId, updatedGb);
    });

    setGuideBarsState(updatedMap);
    scheduleRedraw(updatedMap);

    setCopyFeedback(
      targetId === 'ALL'
        ? `${editingGbId} dizilimi tüm aktif taraklara kopyalandı.`
        : `${editingGbId} dizilimi ${targetId} tarağına kopyalandı.`
    );
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleBinaryInput = (val: string) => {
    const clean = val.replace(/[^01]/g, '').slice(0, needleCols);
    setBinaryThreadingInput(clean);

    const newArr = Array.from({ length: needleCols }, (_, i) => {
      if (i < clean.length) return clean[i] === '1';
      return false;
    });

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: 'Özel',
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);
    scheduleRedraw(newGuideBars);
  };

  const addRow = () => {
    if (!onChangeRows) return;
    const lastRow = rows[rows.length - 1] || {
      GB1: 0,
      GB2: 0,
      GB3: 0,
      GB4: 0,
      GB5: 0,
      GB6: 0,
    };
    const newRow: PatternRow = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      courseIndex: rows.length + 1,
      GB1: lastRow.GB1,
      GB2: lastRow.GB2,
      GB3: lastRow.GB3,
      GB4: lastRow.GB4,
      GB5: lastRow.GB5,
      GB6: lastRow.GB6,
    };
    onChangeRows([...rows, newRow]);
  };

  const deleteLastRow = () => {
    if (!onChangeRows || rows.length <= 1) return;
    onChangeRows(rows.slice(0, -1));
  };

  // Helper to draw Needle Header + Filled/Empty (Dolu/Boş) Indicator Dots on both Technical & Fabric canvases
  const drawNeedleHeaderAndThreadingDots = (
    ctx: CanvasRenderingContext2D,
    gbMap: Record<GuideBarId, GuideBarConfig>,
    barsToDisplay: GuideBarId[],
    isWhite: boolean
  ) => {
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let n = 0; n < totalNeedles; n++) {
      const nx = padX + n * needlePitch;
      const baseNeedle = n % needleCols;
      ctx.fillStyle = isWhite ? '#475569' : '#94a3b8';
      ctx.fillText(`İ${baseNeedle}`, nx, startY - 48);

      barsToDisplay.forEach((gbId, gbIdx) => {
        const gb = gbMap[gbId];
        if (!gb) return;
        const barOpacity = Math.max(0.1, Math.min(1.0, gb.opacity ?? 1.0));
        const isThreaded =
          gb.threadingArray && typeof gb.threadingArray[baseNeedle] === 'boolean'
            ? gb.threadingArray[baseNeedle]
            : baseNeedle % 2 === 0;
        const py = startY - 34 + gbIdx * 8.5;
        const isEdited = gbId === editingGbId;

        ctx.save();
        ctx.globalAlpha = barOpacity;
        ctx.fillStyle = isThreaded ? gb.color : isWhite ? '#e2e8f0' : '#1e293b';
        ctx.beginPath();
        ctx.arc(nx, py, isEdited ? (isThreaded ? 4 : 2.8) : isThreaded ? 2.8 : 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (isThreaded) {
          ctx.strokeStyle = isEdited ? '#ffffff' : isWhite ? '#0f172a' : '#ffffff';
          ctx.lineWidth = isEdited ? 1.4 : 0.7;
          ctx.stroke();
        } else if (isEdited) {
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      });
    }
  };

  const drawTechnicalDiagram = (overrideGuideBars?: Record<GuideBarId, GuideBarConfig>) => {
    if (displayMode !== 'dual' && displayMode !== 'technical') return;

    const canvas = technicalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gbMap = overrideGuideBars || guideBarsState || pattern.guideBars;
    const isWhite = paperTheme === 'white';

    ctx.fillStyle = isWhite ? '#ffffff' : '#080d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barsToDisplay = isolateActiveBar
      ? [editingGbId]
      : activeBars.filter((id) => visibleBars[id] !== false);

    // Draw needle numbers & Dolu/Boş dots
    drawNeedleHeaderAndThreadingDots(ctx, gbMap, barsToDisplay, isWhite);

    ctx.strokeStyle = isWhite ? '#e2e8f0' : '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n < totalNeedles; n++) {
      const nx = padX + n * needlePitch;
      ctx.moveTo(nx, startY - 4);
      ctx.lineTo(nx, startY + totalCourses * coursePitch + 10);
    }
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isWhite ? '#94a3b8' : '#1e3a8a';
    ctx.beginPath();
    for (let c = 0; c <= totalCourses; c += rows.length) {
      const cy = startY + c * coursePitch;
      ctx.moveTo(padX - 10, cy);
      ctx.lineTo(padX + (totalNeedles - 1) * needlePitch + 10, cy);
    }
    ctx.stroke();

    ctx.lineWidth = 0.8;
    ctx.strokeStyle = isWhite ? '#f1f5f9' : '#0f172a';
    ctx.beginPath();
    for (let c = 0; c <= totalCourses; c++) {
      if (c % rows.length === 0) continue;
      const cy = startY + c * coursePitch;
      ctx.moveTo(padX - 10, cy);
      ctx.lineTo(padX + (totalNeedles - 1) * needlePitch + 10, cy);
    }
    ctx.stroke();

    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    for (let c = 0; c < totalCourses; c++) {
      const cy = startY + c * coursePitch;
      const courseNum = c + 1;
      ctx.fillStyle =
        c % rows.length === 0 ? (isWhite ? '#0284c7' : '#38bdf8') : '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(`K${courseNum}`, padX - 12, cy + coursePitch / 2 + 4);
      ctx.textAlign = 'left';
      ctx.fillText(
        `K${courseNum}`,
        padX + (totalNeedles - 1) * needlePitch + 12,
        cy + coursePitch / 2 + 4
      );
    }

    ctx.fillStyle = isWhite ? '#94a3b8' : '#334155';
    ctx.beginPath();
    for (let c = 0; c < totalCourses; c++) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      for (let n = 0; n < totalNeedles; n++) {
        const nx = padX + n * needlePitch;
        ctx.moveTo(nx + 2.5, cy);
        ctx.arc(nx, cy, 2.5, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    if (activeBars.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lütfen en az bir tarak (GB) aktif edin.', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Sort bars according to custom zIndex layer order (1: back, 6: front)
    const sortedBarsForTech = [...barsToDisplay].sort((a, b) => {
      if (a === editingGbId) return 1;
      if (b === editingGbId) return -1;
      const zA = gbMap[a]?.zIndex ?? (parseInt(a.replace('GB', ''), 10) || 1);
      const zB = gbMap[b]?.zIndex ?? (parseInt(b.replace('GB', ''), 10) || 1);
      return zA - zB;
    });

    sortedBarsForTech.forEach((gbId, gbIdx) => {
      const gb = gbMap[gbId];
      if (!gb) return;
      const isEdited = gbId === editingGbId;
      const gbColor = gb.color;
      const barOpacity = Math.max(0.1, Math.min(1.0, gb.opacity ?? 1.0));
      const lineStyle = gb.lineStyle || 'solid';
      const offsetGbX = isolateActiveBar ? 0 : (gbIdx - (sortedBarsForTech.length - 1) / 2) * 5;

      ctx.strokeStyle = gbColor;
      ctx.fillStyle = gbColor;
      ctx.lineWidth = isEdited ? 3.0 : 1.8;

      const threadedGuides: number[] = [];
      for (let n = 0; n < totalNeedles; n++) {
        const baseN = n % needleCols;
        const isThreaded =
          gb.threadingArray && typeof gb.threadingArray[baseN] === 'boolean'
            ? gb.threadingArray[baseN]
            : baseN % 2 === 0;
        if (isThreaded) threadedGuides.push(n);
      }

      threadedGuides.forEach((g) => {
        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const targetNeedle = g + shift;

            if (targetNeedle >= 0 && targetNeedle < totalNeedles) {
              const px = padX + targetNeedle * needlePitch + offsetGbX;
              const py = startY + c * coursePitch + coursePitch / 2;

              if (c > 0) {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                const prevShift = prevRow[gbId] || 0;
                const prevNeedle = g + prevShift;
                if (prevNeedle >= 0 && prevNeedle < totalNeedles) {
                  const prevX = padX + prevNeedle * needlePitch + offsetGbX;
                  const prevY = startY + (c - 1) * coursePitch + coursePitch / 2;

                  const isSkipped = row.skips?.[gbId] ?? false;

                  ctx.save();
                  ctx.strokeStyle = gbColor;
                  ctx.lineWidth = isEdited ? (isSkipped ? 1.6 : 3.0) : (isSkipped ? 1.0 : 1.8);
                  ctx.globalAlpha = isSkipped ? 0.20 : barOpacity;
                  
                  if (isSkipped) {
                    ctx.setLineDash([5, 4]);
                  } else if (lineStyle === 'dashed') {
                    ctx.setLineDash([10, 7]);
                  } else if (lineStyle === 'long-dash') {
                    ctx.setLineDash([18, 9]);
                  } else if (lineStyle === 'dotted') {
                    ctx.setLineDash([3, 7]);
                  } else if (lineStyle === 'dash-dot') {
                    ctx.setLineDash([14, 6, 3, 6]);
                  } else if (lineStyle === 'dash-dot-dot') {
                    ctx.setLineDash([14, 5, 3, 5, 3, 5]);
                  } else {
                    ctx.setLineDash([]);
                  }

                  ctx.beginPath();
                  ctx.moveTo(prevX, prevY);
                  ctx.lineTo(px, py);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          });
        }

        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const targetNeedle = g + shift;

            if (targetNeedle >= 0 && targetNeedle < totalNeedles) {
              const px = padX + targetNeedle * needlePitch + offsetGbX;
              const py = startY + c * coursePitch + coursePitch / 2;

              ctx.save();
              ctx.globalAlpha = barOpacity;
              ctx.beginPath();
              ctx.arc(px, py, isEdited ? 4.5 : 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = isEdited ? '#ffffff' : '#0f172a';
              ctx.lineWidth = isEdited ? 1.5 : 1;
              ctx.stroke();
              ctx.restore();
            }
          });
        }
      });

      if (showStepNumbers) {
        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;

            let prevShift = shift;
            if (c > 0) {
              const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
              prevShift = prevRow[gbId] || 0;
            }
            const stepDiff = shift - prevShift;
            const stepText = stepDiff === 0 ? '0' : stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;

            if (threadedGuides.length > 0 && c > 0 && Math.abs(stepDiff) > 0) {
              const firstGuide = threadedGuides[0];
              const targetNeedle = firstGuide + shift;
              if (targetNeedle >= 0 && targetNeedle < totalNeedles) {
                const px = padX + targetNeedle * needlePitch + offsetGbX;
                const py = startY + c * coursePitch + coursePitch / 2;

                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 9px "JetBrains Mono", monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`Δ:${stepText}`, px + 6, py - 3);
              }
            }
          });
        }
      }
    });

    // Draw guide bar lateral gaps (Taraklar Arası Yanal Fark / ΔTarak) per course row
    if (showBarGaps && barsToDisplay.length >= 2) {
      for (let rep = 0; rep < repeatY; rep++) {
        rows.forEach((row, rIdx) => {
          const c = rep * rows.length + rIdx;
          const cy = startY + c * coursePitch + coursePitch / 2;

          const gb1 = barsToDisplay[0];
          const gb2 = barsToDisplay[1];
          const shift1 = row[gb1] || 0;
          const shift2 = row[gb2] || 0;
          const gap = Math.abs(shift1 - shift2);

          ctx.fillStyle = isWhite ? '#0284c7' : '#38bdf8';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`Δ${gb1}-${gb2}:${gap}i`, padX + (totalNeedles - 1) * needlePitch + 32, cy - 2);
        });
      }
    }

    // Draw empty loop count per course row if showEmptyLoopInfo is enabled
    if (showEmptyLoopInfo) {
      for (let rep = 0; rep < repeatY; rep++) {
        rows.forEach((row, rIdx) => {
          const c = rep * rows.length + rIdx;
          const cy = startY + c * coursePitch + coursePitch / 2;

          let emptyCount = 0;
          for (let n = 0; n < totalNeedles; n++) {
            let hasThread = false;
            barsToDisplay.forEach((gbId) => {
              const gb = gbMap[gbId];
              if (!gb) return;
              const shift = row[gbId] || 0;
              const baseG = (n - shift + totalNeedles * 10) % needleCols;
              const isTh =
                gb.threadingArray && typeof gb.threadingArray[baseG] === 'boolean'
                  ? gb.threadingArray[baseG]
                  : baseG % 2 === 0;
              if (isTh) hasThread = true;
            });
            if (!hasThread) emptyCount++;
          }

          if (emptyCount > 0) {
            ctx.fillStyle = isWhite ? '#e11d48' : '#fb7185';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Boş:${emptyCount}`, padX - 32, cy - 2);
          }
        });
      }
    }
  };

  const drawFabricSimulation = (overrideGuideBars?: Record<GuideBarId, GuideBarConfig>) => {
    if (displayMode !== 'dual' && displayMode !== 'fabric') return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gbMap = overrideGuideBars || guideBarsState || pattern.guideBars;

    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#0a0f1e');
    bgGradient.addColorStop(1, '#05070d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeAndVisibleBars = isolateActiveBar
      ? [editingGbId]
      : activeBars.filter((id) => visibleBars[id] !== false);

    if (activeAndVisibleBars.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Lütfen en az bir aktif tarak görünürlüğünü açın.',
        canvas.width / 2,
        canvas.height / 2
      );
      return;
    }

    // Draw needle numbers & Dolu/Boş threading indicator dots on Fabric Simulation
    drawNeedleHeaderAndThreadingDots(ctx, gbMap, activeAndVisibleBars, false);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n < totalNeedles; n++) {
      const nx = padX + n * needlePitch;
      ctx.moveTo(nx, startY + 2);
      ctx.lineTo(nx, startY + totalCourses * coursePitch + 10);
    }
    ctx.stroke();

    const yarnPresent = new Uint8Array(totalCourses * totalNeedles);
    const editingYarnPresent = new Uint8Array(totalCourses * totalNeedles);

    activeAndVisibleBars.forEach((gbId) => {
      const gb = gbMap[gbId];
      if (!gb) return;
      const tArr = gb.threadingArray;
      const isEditingBar = gbId === editingGbId;

      for (let rep = 0; rep < repeatY; rep++) {
        rows.forEach((row, rIdx) => {
          const c = rep * rows.length + rIdx;
          const shift = row[gbId] || 0;

          for (let g = 0; g < totalNeedles; g++) {
            const baseG = g % needleCols;
            const isThreaded =
              tArr && typeof tArr[baseG] === 'boolean' ? tArr[baseG] : baseG % 2 === 0;
            if (isThreaded) {
              const actualNeedle = g + shift;
              if (actualNeedle >= 0 && actualNeedle < totalNeedles) {
                const idx = c * totalNeedles + actualNeedle;
                yarnPresent[idx] = 1;
                if (isEditingBar) {
                  editingYarnPresent[idx] = 1;
                }
              }
            }
          }
        });
      }
    });

    // Mesh pores rendering (No text badge banner overlay!)
    if (showPoreMesh) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);

      ctx.beginPath();
      for (let c = 0; c < totalCourses; c++) {
        const poreCy = startY + c * coursePitch + coursePitch / 2;
        for (let n = 0; n < totalNeedles; n++) {
          const idx = c * totalNeedles + n;
          const hasYarn = isolateActiveBar ? editingYarnPresent[idx] : yarnPresent[idx];
          if (!hasYarn) {
            const poreCx = padX + n * needlePitch;
            ctx.moveTo(poreCx + needlePitch * 0.38, poreCy);
            ctx.ellipse(
              poreCx,
              poreCy,
              needlePitch * 0.38,
              coursePitch * 0.32,
              0,
              0,
              Math.PI * 2
            );
          }
        }
      }
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let c = 0; c < totalCourses; c++) {
        const poreCy = startY + c * coursePitch + coursePitch / 2;
        for (let n = 0; n < totalNeedles; n++) {
          const idx = c * totalNeedles + n;
          const hasYarn = isolateActiveBar ? editingYarnPresent[idx] : yarnPresent[idx];
          if (!hasYarn) {
            const poreCx = padX + n * needlePitch;
            ctx.moveTo(poreCx - 3.5, poreCy);
            ctx.lineTo(poreCx + 3.5, poreCy);
            ctx.moveTo(poreCx, poreCy - 3.5);
            ctx.lineTo(poreCx, poreCy + 3.5);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw background needle dots across grid if showNeedleDots is enabled
    if (showNeedleDots) {
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      for (let c = 0; c < totalCourses; c++) {
        const cy = startY + c * coursePitch + coursePitch / 2;
        for (let n = 0; n < totalNeedles; n++) {
          const nx = padX + n * needlePitch;
          ctx.moveTo(nx + 2, cy);
          ctx.arc(nx, cy, 2.0, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.restore();
    }

    const sortedBars = [...activeAndVisibleBars].sort((a, b) => {
      if (a === editingGbId) return 1;
      if (b === editingGbId) return -1;
      const zA = gbMap[a]?.zIndex ?? (parseInt(a.replace('GB', ''), 10) || 1);
      const zB = gbMap[b]?.zIndex ?? (parseInt(b.replace('GB', ''), 10) || 1);
      return zA - zB;
    });

    sortedBars.forEach((gbId) => {
      const gb = gbMap[gbId];
      if (!gb) return;
      const isEdited = gbId === editingGbId;
      const barOpacity = Math.max(0.1, Math.min(1.0, gb.opacity ?? 1.0));
      const lineStyle = gb.lineStyle || 'solid';
      const yarnRadius = Math.max(2.5, Math.min(6.0, gb.dtex / 40 + (isEdited ? 1.8 : 1.0)));
      const threadingArr =
        gb.threadingArray || Array.from({ length: needleCols }, (_, i) => i % 2 === 0);

      for (let g = 0; g < totalNeedles; g++) {
        const baseG = g % needleCols;
        if (!threadingArr[baseG]) continue;

        // 1. Draw straight yarn lines connecting course steps
        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const actualNeedle = g + shift;

            if (actualNeedle >= 0 && actualNeedle < totalNeedles) {
              const x = padX + actualNeedle * needlePitch;
              const y = startY + c * coursePitch + coursePitch / 2;

              if (c > 0) {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                const prevShift = prevRow[gbId] || 0;
                const prevNeedle = g + prevShift;

                if (prevNeedle >= 0 && prevNeedle < totalNeedles) {
                  const prevX = padX + prevNeedle * needlePitch;
                  const prevY = startY + (c - 1) * coursePitch + coursePitch / 2;

                  const isSkipped = row.skips?.[gbId] ?? false;

                  ctx.save();
                  ctx.strokeStyle = gb.color;
                  ctx.lineWidth = isSkipped ? yarnRadius * 1.3 : yarnRadius * 2.2;
                  ctx.globalAlpha = isSkipped ? 0.35 : barOpacity;
                  ctx.lineCap = 'round';

                  if (isSkipped) {
                    ctx.setLineDash([5, 4]);
                  } else if (lineStyle === 'dashed') {
                    ctx.setLineDash([10, 7]);
                  } else if (lineStyle === 'long-dash') {
                    ctx.setLineDash([18, 9]);
                  } else if (lineStyle === 'dotted') {
                    ctx.setLineDash([3, 7]);
                  } else if (lineStyle === 'dash-dot') {
                    ctx.setLineDash([14, 6, 3, 6]);
                  } else if (lineStyle === 'dash-dot-dot') {
                    ctx.setLineDash([14, 5, 3, 5, 3, 5]);
                  } else {
                    ctx.setLineDash([]);
                  }

                  ctx.beginPath();
                  ctx.moveTo(prevX, prevY);
                  ctx.lineTo(x, y);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          });
        }

        // 2. Draw circular needle node dots on every course row step for active threads (when showNeedleDots is enabled)
        if (showNeedleDots) {
          for (let rep = 0; rep < repeatY; rep++) {
            rows.forEach((row, rIdx) => {
              const c = rep * rows.length + rIdx;
              const shift = row[gbId] || 0;
              const actualNeedle = g + shift;

              if (actualNeedle >= 0 && actualNeedle < totalNeedles) {
                const x = padX + actualNeedle * needlePitch;
                const y = startY + c * coursePitch + coursePitch / 2;
                const isSkipped = row.skips?.[gbId] ?? false;
                const nodeRadius = Math.max(3.2, yarnRadius * 0.85);

                ctx.save();
                ctx.globalAlpha = isSkipped ? 0.35 : barOpacity;

                // Outer node fill
                ctx.beginPath();
                ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
                ctx.fillStyle = gb.color;
                ctx.fill();

                // Subtle soft outer border ring
                ctx.strokeStyle = isEdited ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.40)';
                ctx.lineWidth = isEdited ? 1.4 : 1.0;
                ctx.stroke();

                ctx.restore();
              }
            });
          }
        }
      }
    });

    // Balanced Course Indicators on Left and Right
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    for (let c = 0; c < totalCourses; c += 2) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      ctx.textAlign = 'right';
      ctx.fillText(`K${c + 1}`, padX - 10, cy + 3);
      ctx.textAlign = 'left';
      ctx.fillText(`K${c + 1}`, padX + (totalNeedles - 1) * needlePitch + 10, cy + 3);
    }
  };

  useEffect(() => {
    const render = () => {
      if (displayMode === 'technical' || displayMode === 'dual') {
        drawTechnicalDiagram();
      }
      if (displayMode === 'fabric' || displayMode === 'dual') {
        drawFabricSimulation();
      }
    };

    const animId = requestAnimationFrame(render);
    // Double trigger to ensure canvas renders even if DOM is resolving on tab switch
    const t1 = setTimeout(render, 40);
    const t2 = setTimeout(render, 150);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    displayMode,
    containerWidth,
    guideBarsState,
    pattern.guideBars,
    pattern.rows,
    needleCols,
    totalNeedles,
    paperTheme,
    repeatX,
    repeatY,
    showStepNumbers,
    showPoreMesh,
    showNeedleDots,
    isolateActiveBar,
    editingGbId,
    visibleBars,
    coursePitch,
  ]);

  // Format PNG/PDF Filename: "[Numune İsmi] [İğneSayısı]İ [May]M.(png|pdf)" (Örn: "Mavi Numune 54İ 6,54M.pdf")
  const getReportFileName = (suffix?: string, ext: 'png' | 'pdf' = 'png'): string => {
    const tableExtras = loadPatternTableExtras(pattern);
    const rawMay = (pattern.mayDensity ?? tableExtras.mayDensity ?? '').trim();
    const mayFormatted = rawMay.replace(/\./g, ',');
    const safeTitle = (pattern.title || 'Numune').replace(/[\\/:*?"<>|]/g, '').trim();
    const mayPart = mayFormatted ? ` ${mayFormatted}M` : '';
    const suffixPart = suffix ? ` ${suffix}` : '';
    return `${safeTitle} ${needleCols}İ${mayPart}${suffixPart}.${ext}`;
  };

  // Full-Detail High-DPI Composite PNG Export (Trimmed Margins, Balanced Compact Aspect Ratio & Crisp Typography for WhatsApp)
  const buildCompositeReportCanvas = (
    sourceCanvas: HTMLCanvasElement | null,
    options?: { forWhatsApp?: boolean }
  ): HTMLCanvasElement | null => {
    if (!sourceCanvas) return null;

    const gbMap = guideBarsState || pattern.guideBars;
    const activeGbList: GuideBarId[] =
      activeBars.length > 0 ? activeBars : ALL_GB_IDS;

    const tableSettings = loadSavedTableSettings();
    const tableExtras = loadPatternTableExtras(pattern);
    const expandedRows = applyManualTableOverrides(
      buildExpandedFourStepRows(
        rows,
        tableSettings.barModes,
        tableSettings.loopWidth,
        tableSettings.skipBehavior,
        tableSettings.descendingStartMode
      ),
      tableExtras.manualTableOverrides
    );
    const mayDensity = (pattern.mayDensity ?? tableExtras.mayDensity ?? '').trim();
    const mayDisplay = mayDensity !== '' ? `${mayDensity.replace('.', ',')} May` : 'Belirtilmedi';
    const rawRackRows =
      tableExtras.isRackManualOverride && tableExtras.rackTensionRows.length > 0
        ? tableExtras.rackTensionRows
        : pattern.isRackManualOverride && pattern.rackTensionRows && pattern.rackTensionRows.length > 0
        ? pattern.rackTensionRows
        : tableExtras.rackTensionRows;

    const displayRackRows = rawRackRows.length > 0 ? rawRackRows : [];

    // Maksimum Tel Sayısı & Desen Zorluğu
    let maxTelCount = 0;
    activeGbList.forEach((gbId) => {
      const calc = guideBarCalculations[gbId];
      if (calc) maxTelCount += calc.requiredYarnCount;
    });
    const diffInfo = computePatternDifficulty(rows, activeGbList, pattern.machine?.rpm || 600);

    // Trim unused empty margins around simulation canvas & fit into a compact, readable preview box
    const crop = getTrimmedSourceBounds(sourceCanvas);
    const cropAspect = crop.sw / Math.max(1, crop.sh);

    const padX = 12;
    const gapX = 12;

    // Decide side-by-side vs top-bottom so total report stays compact (~1380-1560 x ~980-1280) with ZERO wasted space!
    const useSideBySideMain = cropAspect <= 1.25;

    let simDrawW: number;
    let simDrawH: number;
    let unscaledWidth: number;

    if (useSideBySideMain) {
      // Fit simulation preview cleanly on left (max 520px wide, max 840px tall)
      const maxBoxW = 500;
      const maxBoxH = 840;
      if (cropAspect >= maxBoxW / maxBoxH) {
        simDrawW = Math.min(maxBoxW, Math.max(320, crop.sw));
        simDrawH = Math.round(simDrawW / cropAspect);
      } else {
        simDrawH = Math.min(maxBoxH, Math.max(460, crop.sh));
        simDrawW = Math.max(260, Math.round(simDrawH * cropAspect));
      }
      const minRightTableW = Math.max(760, activeGbList.length * 220);
      unscaledWidth = Math.max(1360, padX * 2 + simDrawW + gapX + minRightTableW);
    } else {
      unscaledWidth = 1440;
      const availW = unscaledWidth - padX * 2;
      const maxBannerSimH = 500;
      if (cropAspect >= availW / maxBannerSimH) {
        simDrawW = Math.min(availW, Math.max(760, crop.sw));
        simDrawH = Math.round(simDrawW / cropAspect);
      } else {
        simDrawH = Math.min(maxBannerSimH, crop.sh);
        simDrawW = Math.round(simDrawH * cropAspect);
      }
    }

    const availWidth = unscaledWidth - padX * 2;

    // 1. Top Header + Side-by-Side Metadata Band (Left: İğne Dizilimi + May/Tel/Zorluk | Right: Rack Tansiyon Tablosu)
    const headerBannerH = 38;
    const leftMetaW = Math.floor(availWidth * 0.52);
    const rightMetaW = availWidth - leftMetaW - gapX;

    const leftThreadingLinesH = activeGbList.length * 22;
    const leftStatCardsH = 44;
    const leftMetaContentH = 34 + leftThreadingLinesH + 2 + leftStatCardsH + 4;

    const rackTitleH = 22;
    const rackHeaderH = 23;
    const rackRowH = 20;
    const visibleRackCount = Math.max(1, displayRackRows.length);
    const rightMetaContentH = rackTitleH + rackHeaderH + visibleRackCount * rackRowH + 8;

    const metaBandH = Math.max(leftMetaContentH, rightMetaContentH) + 8;

    // 2. 4-Step Machine Pattern Table dimensions (larger, ultra-legible typography!)
    const tableAvailW = useSideBySideMain ? availWidth - simDrawW - gapX : availWidth;
    const minBlockW = Math.max(155, 36 + activeGbList.length * 56);
    const maxFitCols = Math.max(
      1,
      Math.min(useSideBySideMain ? 5 : 6, Math.floor((tableAvailW + 8) / (minBlockW + 8)))
    );
    const numBlockCols =
      rows.length === 0
        ? 1
        : rows.length <= 10
        ? 1
        : Math.min(maxFitCols, Math.max(1, Math.ceil(rows.length / 8)));

    const coursesPerCol = Math.max(1, Math.ceil(rows.length / numBlockCols));
    const blockGapX = 8;
    const blockWidth = Math.floor((tableAvailW - blockGapX * (numBlockCols - 1)) / numBlockCols);
    const tableHeaderH = 24;
    const stepRowH = 16.5;
    const tableBodyH = coursesPerCol * 4 * stepRowH;
    const tableSectionH = 24 + (rows.length > 0 ? tableHeaderH + tableBodyH : 36);

    const mainSectionTopY = headerBannerH + metaBandH + 6;
    const mainSectionH = useSideBySideMain
      ? Math.max(simDrawH, tableSectionH)
      : simDrawH + 10 + tableSectionH;

    const bottomWatermarkH = 30;
    const unscaledHeight = mainSectionTopY + mainSectionH + bottomWatermarkH;

    // Target crisp ~2048px longest side on WhatsApp so WhatsApp keeps ~100% resolution without blurry downscaling!
    const maxDim = Math.max(unscaledWidth, unscaledHeight);
    const dpr = options?.forWhatsApp
      ? Math.min(1.85, Math.max(1.35, 2048 / maxDim))
      : Math.min(2, 4096 / maxDim);

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(unscaledWidth * dpr);
    exportCanvas.height = Math.round(unscaledHeight * dpr);

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Canvas Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, unscaledWidth, unscaledHeight);

    // 1. TOP HEADER BANNER (TMK TEKSTİL)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(padX, 6, availWidth, 30);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, 6, availWidth, 30);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `TMK TEKSTİL  |  ${pattern.title.toUpperCase()}  |  ${pattern.machine.gauge}  |  ${needleCols} İĞNE  |  ${rows.length} KURS`,
      padX + 10,
      25
    );

    ctx.fillStyle = '#22D3EE';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `MAY: ${mayDisplay}  |  MAKS TEL: ${maxTelCount.toLocaleString('tr-TR')} Tel  |  ZORLUK: ${diffInfo.shortLabel.toUpperCase()} (${diffInfo.score}/100)`,
      unscaledWidth - padX - 10,
      25
    );

    // 2. METADATA BAND: LEFT = İĞNE DİZİLİMİ + ÖZET | RIGHT = RACK TANSİYON TABLOSU
    const metaY = headerBannerH + 4;

    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(padX, metaY, leftMetaW, metaBandH - 4);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX, metaY, leftMetaW, metaBandH - 4);

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('İĞNE DİZİLİMİ VE DESEN ÖZETİ', padX + 10, metaY + 15);

    let leftY = metaY + 34;
    activeGbList.forEach((gbId) => {
      const gb = gbMap[gbId];
      if (!gb) return;

      ctx.fillStyle = gb.color;
      ctx.fillRect(padX + 10, leftY - 10, 11, 11);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(padX + 10, leftY - 10, 11, 11);

      const filledCnt = Array.from({ length: needleCols }, (_, i) =>
        gb.threadingArray && typeof gb.threadingArray[i] === 'boolean'
          ? gb.threadingArray[i]
          : i % 2 === 0
      ).filter(Boolean).length;
      const emptyCnt = needleCols - filledCnt;

      const calc = guideBarCalculations[gbId];
      const yarnText = calc ? `  |  ${calc.requiredYarnCount} Tel (${calc.repeatCount} Tekrar)` : '';

      ctx.fillStyle = '#F1F5F9';
      ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `${gbId}: ${filledCnt} Dolu / ${emptyCnt} Boş (Top. ${needleCols}İ)${yarnText}`,
        padX + 27,
        leftY
      );

      leftY += 22;
    });

    // Three Summary Cards under Threading Summary
    const statY = leftY + 2;
    const statBoxGap = 8;
    const statBoxW = Math.floor((leftMetaW - 20 - statBoxGap * 2) / 3);
    const statBoxes = [
      {
        label: 'KUMAŞ SIKLIĞI (MAY)',
        value: mayDisplay,
        borderColor: '#0891B2',
        valueColor: '#22D3EE',
      },
      {
        label: 'MAKSİMUM TEL SAYISI',
        value: `${maxTelCount.toLocaleString('tr-TR')} Tel`,
        borderColor: '#059669',
        valueColor: '#34D399',
      },
      {
        label: 'DESEN ZORLUĞU',
        value: `${diffInfo.shortLabel} (${diffInfo.score}/100)`,
        borderColor: '#7C3AED',
        valueColor: '#C4B5FD',
      },
    ];

    statBoxes.forEach((sb, idx) => {
      const sx = padX + 10 + idx * (statBoxW + statBoxGap);
      ctx.fillStyle = '#111827';
      ctx.fillRect(sx, statY, statBoxW, 40);
      ctx.strokeStyle = sb.borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, statY, statBoxW, 40);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 9.5px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sb.label, sx + 8, statY + 14);

      ctx.fillStyle = sb.valueColor;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(sb.value, sx + 8, statY + 32);
    });

    // Right Box: RACK TANSİYON TABLOSU (Right Next to İğne Dizilimi)
    const rackX = padX + leftMetaW + gapX;
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(rackX, metaY, rightMetaW, metaBandH - 4);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.strokeRect(rackX, metaY, rightMetaW, metaBandH - 4);

    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RACK TANSİYON TABLOSU', rackX + 10, metaY + 15);

    ctx.fillStyle = tableExtras.isRackManualOverride ? '#FCD34D' : '#6EE7B7';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      tableExtras.isRackManualOverride ? 'Elle Düzenlendi' : 'Otomatik (Atlama)',
      rackX + rightMetaW - 10,
      metaY + 15
    );

    const rackInnerX = rackX + 8;
    const rackInnerW = rightMetaW - 16;
    const rackTableY = metaY + 21;
    const sayiColW = 46;
    const kursColW = 92;
    const rackGbColW = (rackInnerW - sayiColW - kursColW) / activeGbList.length;
    const rackTotalH = rackHeaderH + visibleRackCount * rackRowH;

    ctx.fillStyle = '#080C14';
    ctx.fillRect(rackInnerX, rackTableY, rackInnerW, rackTotalH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(rackInnerX, rackTableY, rackInnerW, rackTotalH);

    // Rack Header
    ctx.fillStyle = '#111827';
    ctx.fillRect(rackInnerX, rackTableY, rackInnerW, rackHeaderH);
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(rackInnerX, rackTableY + rackHeaderH);
    ctx.lineTo(rackInnerX + rackInnerW, rackTableY + rackHeaderH);
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Sayı', rackInnerX + sayiColW / 2, rackTableY + 15);

    ctx.fillStyle = '#38BDF8';
    ctx.fillText('Kurs no', rackInnerX + sayiColW + kursColW / 2, rackTableY + 15);

    ctx.strokeStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(rackInnerX + sayiColW, rackTableY);
    ctx.lineTo(rackInnerX + sayiColW, rackTableY + rackTotalH);
    ctx.moveTo(rackInnerX + sayiColW + kursColW, rackTableY);
    ctx.lineTo(rackInnerX + sayiColW + kursColW, rackTableY + rackTotalH);
    ctx.stroke();

    activeGbList.forEach((gbId, gbIdx) => {
      const cx = rackInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
      const gbColor = gbMap[gbId]?.color || '#34D399';
      ctx.fillStyle = gbColor;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gbId, cx + rackGbColW / 2, rackTableY + 15);

      ctx.fillStyle = gbColor;
      ctx.fillRect(cx + 1, rackTableY + rackHeaderH - 2, rackGbColW - 2, 2);

      if (gbIdx > 0) {
        ctx.strokeStyle = '#1E293B';
        ctx.beginPath();
        ctx.moveTo(cx, rackTableY);
        ctx.lineTo(cx, rackTableY + rackTotalH);
        ctx.stroke();
      }
    });

    (displayRackRows.length > 0
      ? displayRackRows
      : [{ id: 'empty', courseCount: '-', values: {} }]
    ).forEach((rRow, rIdx) => {
      const ry = rackTableY + rackHeaderH + rIdx * rackRowH;
      const isEven = rIdx % 2 === 1;
      ctx.fillStyle = isEven ? '#111827' : '#0B0F17';
      ctx.fillRect(rackInnerX + 1, ry, rackInnerW - 2, rackRowH);

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(rIdx), rackInnerX + sayiColW / 2, ry + 14);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(
        rRow.courseCount.trim() !== '' ? rRow.courseCount.trim() : '-',
        rackInnerX + sayiColW + kursColW / 2,
        ry + 14
      );

      activeGbList.forEach((gbId, gbIdx) => {
        const cx = rackInnerX + sayiColW + kursColW + gbIdx * rackGbColW;
        const val = (rRow.values[gbId] ?? '').trim();
        const numVal = parseFloat(val);
        const isSkipTension = !isNaN(numVal) && numVal > 0 && numVal <= 5000;

        if (isSkipTension) {
          ctx.fillStyle = 'rgba(217, 119, 6, 0.28)';
          ctx.fillRect(cx + 1, ry, rackGbColW - 2, rackRowH);
          ctx.fillStyle = '#FCD34D';
        } else {
          ctx.fillStyle = val !== '' ? '#34D399' : '#64748B';
        }
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(val !== '' ? val : '-', cx + rackGbColW / 2, ry + 14);
      });

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(rackInnerX, ry + rackRowH);
      ctx.lineTo(rackInnerX + rackInnerW, ry + rackRowH);
      ctx.stroke();
    });

    // 3. MAIN AREA: TRIMMED SIMULATION PREVIEW + 4-STEP MACHINE PATTERN TABLE
    const simX = useSideBySideMain ? padX : Math.floor((unscaledWidth - simDrawW) / 2);
    const simY = mainSectionTopY;
    ctx.drawImage(
      sourceCanvas,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      simX,
      simY,
      simDrawW,
      simDrawH
    );
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(simX, simY, simDrawW, simDrawH);

    const tableAreaX = useSideBySideMain ? padX + simDrawW + gapX : padX;
    const tableTitleY = useSideBySideMain ? mainSectionTopY : mainSectionTopY + simDrawH + 10;

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `4 ADIMLI MAKİNE DESEN TABLOSU (${rows.length} Kurs × 4 = ${expandedRows.length} Adım)`,
      tableAreaX,
      tableTitleY + 13
    );

    // Skip Highlight Legend on Right of Table Area
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FCD34D';
    ctx.font = 'bold 10.5px "Plus Jakarta Sans", sans-serif';
    const legendLabel = 'ATLA (Atlama Yapılan Adımlar)';
    const legendLabelW = ctx.measureText(legendLabel).width;
    ctx.fillText(legendLabel, tableAreaX + tableAvailW, tableTitleY + 13);

    ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
    ctx.fillRect(tableAreaX + tableAvailW - legendLabelW - 18, tableTitleY + 2, 13, 12);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(tableAreaX + tableAvailW - legendLabelW - 18, tableTitleY + 2, 13, 12);

    const tableTopY = tableTitleY + 21;

    if (rows.length > 0) {
      const courseColW = 36;
      const barColW = (blockWidth - courseColW) / activeGbList.length;

      for (let colIdx = 0; colIdx < numBlockCols; colIdx++) {
        const startCourse = colIdx * coursesPerCol;
        const endCourse = Math.min(rows.length, startCourse + coursesPerCol);
        if (startCourse >= rows.length) break;

        const bx = tableAreaX + colIdx * (blockWidth + blockGapX);
        const by = tableTopY;
        const sliceStepRows = expandedRows.slice(startCourse * 4, endCourse * 4);
        const colHeight = tableHeaderH + sliceStepRows.length * stepRowH;

        ctx.fillStyle = '#080C14';
        ctx.fillRect(bx, by, blockWidth, colHeight);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, blockWidth, colHeight);

        // Table Header
        ctx.fillStyle = '#111827';
        ctx.fillRect(bx, by, blockWidth, tableHeaderH);
        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(bx, by + tableHeaderH);
        ctx.lineTo(bx + blockWidth, by + tableHeaderH);
        ctx.stroke();

        ctx.fillStyle = '#E2E8F0';
        ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Kurs', bx + courseColW / 2, by + 16);

        ctx.strokeStyle = '#1E293B';
        ctx.beginPath();
        ctx.moveTo(bx + courseColW, by);
        ctx.lineTo(bx + courseColW, by + colHeight);
        ctx.stroke();

        activeGbList.forEach((gbId, gbIdx) => {
          const cx = bx + courseColW + gbIdx * barColW;
          const gbColor = gbMap[gbId]?.color || '#38BDF8';

          ctx.fillStyle = gbColor;
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(gbId, cx + barColW / 2, by + 16);

          ctx.fillStyle = gbColor;
          ctx.fillRect(cx + 1, by + tableHeaderH - 2, barColW - 2, 2);

          if (gbIdx > 0) {
            ctx.strokeStyle = '#1E293B';
            ctx.beginPath();
            ctx.moveTo(cx, by);
            ctx.lineTo(cx, by + colHeight);
            ctx.stroke();
          }
        });

        // Step Rows
        sliceStepRows.forEach((item, rOffset) => {
          const ry = by + tableHeaderH + rOffset * stepRowH;
          const isCourseStart = item.stepInCourse === 1;
          const isCourseEnd = item.stepInCourse === 4;
          const isEvenStep = item.stepInCourse % 2 === 0;

          ctx.fillStyle = isEvenStep ? '#111827' : '#0B0F17';
          ctx.fillRect(bx + 1, ry, blockWidth - 2, stepRowH);

          ctx.textAlign = 'center';
          if (isCourseStart) {
            ctx.fillStyle = '#38BDF8';
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.fillText(String(item.courseIndex), bx + courseColW / 2, ry + 12.5);
          } else {
            ctx.fillStyle = '#64748B';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillText(`·${item.stepInCourse}`, bx + courseColW / 2, ry + 12);
          }

          activeGbList.forEach((gbId, gbIdx) => {
            const cx = bx + courseColW + gbIdx * barColW;
            const val = item.values[gbId];
            const isSkipped = Boolean(item.skippedBars[gbId]);

            if (isSkipped) {
              ctx.fillStyle = 'rgba(217, 119, 6, 0.34)';
              ctx.fillRect(cx + 1, ry, barColW - 1, stepRowH);
              ctx.fillStyle = '#F59E0B';
              ctx.fillRect(cx + 1, ry, 2.5, stepRowH);

              if (isCourseStart && barColW >= 46) {
                ctx.fillStyle = '#FDE68A';
                ctx.font = 'bold 11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(String(val), cx + barColW * 0.30, ry + 12.5);

                const badgeW = 25;
                const badgeH = 11;
                const badgeX = cx + barColW - badgeW - 2;
                const badgeY = ry + 2.5;
                ctx.fillStyle = '#D97706';
                ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 7.5px "Plus Jakarta Sans", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ATLA', badgeX + badgeW / 2, badgeY + 8.5);
              } else {
                ctx.fillStyle = '#FDE68A';
                ctx.font = 'bold 11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(String(val), cx + barColW / 2, ry + 12.5);
              }
            } else {
              ctx.fillStyle = isCourseStart ? (gbMap[gbId]?.color || '#F8FAFC') : '#E2E8F0';
              ctx.font = isCourseStart
                ? 'bold 11px "JetBrains Mono", monospace'
                : 'bold 10.5px "JetBrains Mono", monospace';
              ctx.textAlign = 'center';
              ctx.fillText(String(val), cx + barColW / 2, ry + 12.5);
            }
          });

          ctx.strokeStyle = isCourseEnd ? '#475569' : '#1E293B';
          ctx.lineWidth = isCourseEnd ? 1.2 : 0.6;
          ctx.beginPath();
          ctx.moveTo(bx, ry + stepRowH);
          ctx.lineTo(bx + blockWidth, ry + stepRowH);
          ctx.stroke();
        });
      }
    }

    // 4. Watermark Metadata at Bottom Right Corner
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const watermarkText = `TARİH: ${dateStr}  |  IP: 192.168.1.100 (DESK-CAD)  |  tmktekstil.com`;

    ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const textWidth = ctx.measureText(watermarkText).width;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(unscaledWidth - textWidth - 22, unscaledHeight - 24, textWidth + 14, 19);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(unscaledWidth - textWidth - 22, unscaledHeight - 24, textWidth + 14, 19);

    ctx.fillStyle = '#38BDF8';
    ctx.fillText(watermarkText, unscaledWidth - 15, unscaledHeight - 10);

    return exportCanvas;
  };

  const downloadSimulationImage = (sourceCanvas: HTMLCanvasElement | null, fileName: string) => {
    const exportCanvas = buildCompositeReportCanvas(sourceCanvas, { forWhatsApp: false });
    if (!exportCanvas) return;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = exportCanvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const shareSimulationImage = async (sourceCanvas: HTMLCanvasElement | null, fileName: string) => {
    // Build crisp balanced-aspect canvas sized specifically to preserve sharpness on WhatsApp (~2048px max side)
    const exportCanvas = buildCompositeReportCanvas(sourceCanvas, { forWhatsApp: true });
    if (!exportCanvas) return;

    exportCanvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: fileName.replace(/\.png$/i, ''),
            text: `${pattern.title} - TMK Tekstil Desen Raporu`,
            files: [file],
          });
          return;
        } catch (err) {
          console.log('Native share cancelled or failed', err);
        }
      }

      // WhatsApp Direct Link Fallback: Trigger crisp PNG download + open WhatsApp share
      const link = document.createElement('a');
      link.download = fileName;
      link.href = exportCanvas.toDataURL('image/png', 1.0);
      link.click();

      const tableExtras = loadPatternTableExtras(pattern);
      const mayStr = (pattern.mayDensity ?? tableExtras.mayDensity ?? '').trim();
      const waText = encodeURIComponent(
        `*TMK TEKSTİL DESEN RAPORU*\nNumune: ${pattern.title}\nİğne: ${needleCols}İ${mayStr ? `\nMay: ${mayStr.replace('.', ',')}M` : ''}\nMakine: ${pattern.machine.gauge}\nWebsite: tmktekstil.com`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    }, 'image/png', 1.0);
  };

  const shareSimulationPdf = async (
    sourceCanvas: HTMLCanvasElement | null,
    fileName: string,
    reportKindLabel: string
  ) => {
    if (!sourceCanvas || isExportingPdf) return;
    setIsExportingPdf(true);

    // Yield one frame so UI button state updates immediately
    await new Promise((resolve) => setTimeout(resolve, 20));

    try {
      const pdfBlob = await buildHighResPatternPdf({
        sourceCanvas,
        fileName,
        reportKindLabel,
        pattern,
        rows,
        guideBarsState: guideBarsState || pattern.guideBars,
        activeBars,
        needleCols,
        guideBarCalculations,
      });

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            title: fileName.replace(/\.pdf$/i, ''),
            text: `${pattern.title} - TMK Tekstil Yüksek Çözünürlüklü PDF Desen Raporu`,
            files: [pdfFile],
          });
          setIsExportingPdf(false);
          return;
        } catch (err) {
          console.log('Native PDF share cancelled or failed', err);
        }
      }

      // Download high-resolution multi-page PDF + open WhatsApp fallback
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = blobUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      setCopyFeedback(
        `"${fileName}" yüksek çözünürlüklü çok sayfalı PDF olarak indirildi. WhatsApp üzerinden belge olarak sıkıştırmadan paylaşabilirsiniz.`
      );
      setTimeout(() => setCopyFeedback(null), 5000);

      const tableExtras = loadPatternTableExtras(pattern);
      const mayStr = (pattern.mayDensity ?? tableExtras.mayDensity ?? '').trim();
      const waText = encodeURIComponent(
        `*TMK TEKSTİL PDF DESEN RAPORU*\nNumune: ${pattern.title}\nİğne: ${needleCols}İ${mayStr ? `\nMay: ${mayStr.replace('.', ',')}M` : ''}\nMakine: ${pattern.machine.gauge}\nWebsite: tmktekstil.com`
      );
      window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const filledNeedlesCount = currentThreading.filter(Boolean).length;

  return (
    <div ref={simWrapperRef} className="w-full max-w-none px-1.5 sm:px-3 py-1.5 sm:py-2.5 space-y-2 sm:space-y-2.5">
      {/* Copy Notification Banner */}
      {copyFeedback && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyFeedback}</span>
        </div>
      )}

      {/* SECTION 1: COMPACT GUIDE BAR & THREADING TOOLBAR */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-2 sm:p-3 space-y-2 sm:space-y-3">
        {/* Single-Row Threading Controls: Şablon, İğne Sayısı (+/- Butonlu), Hızlı Dizim Çipleri & Kurallar, Kopyala */}
        <div className="bg-[#0B0F17] p-1.5 sm:p-2.5 rounded-lg border border-slate-800 text-xs overflow-visible">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
            {/* Şablonlar Dropdown & Entegre Şablon Butonları (1/1, 2/2, 3/3, 4/4, 6/2, 12/12) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#111827] px-2 py-1 rounded-lg border border-slate-700" title="Dizilim Şablonları">
              <div className="flex items-center gap-1">
                <LayoutTemplate className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">Şablon:</span>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyPreset(e.target.value as any);
                  }
                }}
                className="bg-[#0B0F17] border border-slate-700 text-slate-200 text-xs rounded px-1.5 sm:px-2 py-0.5 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>Şablon Seç ▾</option>
                <option value="full">Tam Dolu</option>
                <option value="1-1">1/1</option>
                <option value="2-2">2/2</option>
                <option value="3-3">3/3</option>
                <option value="4-4">4/4</option>
                <option value="6-2">6/2</option>
                <option value="12-12">12/12</option>
                <option value="5-5">5/5 (5-5)</option>
                <option value="1-2">1/2</option>
                <option value="1-3">1/3</option>
                <option value="invert">Ters Çevir</option>
                <option value="clear">Tümü Boş</option>
              </select>

              {/* Entegre Şablon Butonları */}
              <div className="flex items-center gap-1 border-l border-slate-700 pl-1.5">
                {[
                  { key: '1-1', label: '1/1' },
                  { key: '2-2', label: '2/2' },
                  { key: '3-3', label: '3/3' },
                  { key: '4-4', label: '4/4' },
                  { key: '6-2', label: '6/2' },
                  { key: '12-12', label: '12/12' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleApplyPreset(chip.key as any)}
                    className="px-1.5 py-0.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white rounded font-mono text-[11px] font-bold transition-colors cursor-pointer"
                    title={`Şablon Uygula: ${chip.label}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* İğne Sayısı (Direct Text + Stepper Buttons [-] [+]) */}
            <div
              className="flex items-center gap-1 bg-[#111827] px-1.5 py-1 rounded border border-slate-700"
              title="İğne Sayısı (4 - 300)"
            >
              <Hash className="w-4 h-4 text-blue-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(4, needleCols - 1);
                  setNeedleInputText(String(next));
                  if (onChangeSafety) {
                    onChangeSafety({
                      ...pattern.safety,
                      maxAllowedNeedleNumber: next - 1,
                    });
                  }
                }}
                className="w-5 h-5 flex items-center justify-center bg-[#0B0F17] border border-slate-700 hover:border-slate-500 rounded text-slate-300 hover:text-white cursor-pointer"
                title="İğne Eksilt (-1)"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={needleInputText}
                onChange={(e) => {
                  const valStr = e.target.value;
                  setNeedleInputText(valStr);
                  const parsed = parseInt(valStr, 10);
                  if (!isNaN(parsed) && parsed >= 4 && parsed <= 300 && onChangeSafety) {
                    onChangeSafety({
                      ...pattern.safety,
                      maxAllowedNeedleNumber: parsed - 1,
                    });
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(needleInputText, 10);
                  const clamped = isNaN(parsed) ? 18 : Math.max(4, Math.min(300, parsed));
                  setNeedleInputText(String(clamped));
                  if (onChangeSafety && clamped !== needleCols) {
                    onChangeSafety({
                      ...pattern.safety,
                      maxAllowedNeedleNumber: clamped - 1,
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-12 bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-blue-400 text-xs focus:outline-none focus:border-blue-500 tabular-nums"
                title="İğne Sayısı"
              />

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(300, needleCols + 1);
                  setNeedleInputText(String(next));
                  if (onChangeSafety) {
                    onChangeSafety({
                      ...pattern.safety,
                      maxAllowedNeedleNumber: next - 1,
                    });
                  }
                }}
                className="w-5 h-5 flex items-center justify-center bg-[#0B0F17] border border-slate-700 hover:border-slate-500 rounded text-slate-300 hover:text-white cursor-pointer"
                title="İğne Artır (+1)"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Practical Fast Fill (Hızlı Pratik Dizim) */}
            <div className="flex flex-wrap items-center gap-1.5" title="Hızlı Pratik Dizim">
              <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />

              {/* Start Mode Choice: Green dot (Dolu) / Red dot (Boş) */}
              <div className="flex items-center gap-0.5 bg-[#111827] p-0.5 rounded border border-slate-700" title="Başlangıç İğnesi">
                <button
                  type="button"
                  onClick={() => setManualStartMode('filled')}
                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer ${
                    manualStartMode === 'filled'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                  title="Dolu İğne ile Başla"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setManualStartMode('empty')}
                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-colors cursor-pointer ${
                    manualStartMode === 'empty'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-rose-400'
                  }`}
                  title="Boş İğne ile Başla"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                </button>
              </div>

              {/* Fast Stepper Inputs for Dolu & Boş */}
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={manualInCount}
                  onChange={(e) => setManualInCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-10 sm:w-11 bg-[#111827] border border-emerald-800/80 rounded px-1 py-0.5 text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 tabular-nums text-xs"
                  title="Dolu İğne Sayısı"
                />
                <span className="text-slate-500 font-bold">/</span>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={manualOutCount}
                  onChange={(e) => setManualOutCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-10 sm:w-11 bg-[#111827] border border-rose-800/80 rounded px-1 py-0.5 text-center font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-500 tabular-nums text-xs"
                  title="Boş İğne Sayısı"
                />
                <button
                  type="button"
                  onClick={handleApplyManualInOut}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors cursor-pointer text-xs"
                  title="Uygula"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Custom Rule Input */}
              <div className="flex items-center gap-1 sm:ml-1">
                <input
                  type="text"
                  value={customRuleText}
                  onChange={(e) => setCustomRuleText(e.target.value)}
                  placeholder="4-2-1"
                  className="w-14 sm:w-16 bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  title="Özel Kural"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomRuleText}
                  className="px-1.5 py-1 bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded font-semibold transition-colors whitespace-nowrap cursor-pointer text-xs"
                  title="Kuralı Uygula"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Simplified Copy Menu (Kopyala) */}
            <div className="flex items-center gap-1.5 bg-[#111827] px-2 py-1 rounded border border-slate-700 text-xs" title="Tarak Kopyala">
              <Copy className="w-4 h-4 text-blue-400 shrink-0" />
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleCopyThreadingToTarget(e.target.value as any);
                }}
                className="bg-[#0B0F17] border border-slate-700 text-slate-200 text-xs rounded px-1.5 sm:px-2 py-0.5 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  {editingGbId} → Hedef
                </option>
                {activeBars
                  .filter((id) => id !== editingGbId)
                  .map((tId) => (
                    <option key={tId} value={tId}>
                      → {tId}
                    </option>
                  ))}
                {activeBars.length > 1 && (
                  <option value="ALL">→ Tüm Taraklar</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Row: Active Guide Bar Report Badges + Needle Grid (30 Needles Per Row on Desktop, Responsive on Mobile) */}
        <div className="space-y-2">
          {/* Active Guide Bar Analysis Badges Row */}
          <div className="space-y-1 pb-1 border-b border-slate-800/80 overflow-visible">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs overflow-visible">
              {activeBars.map((gbId) => {
                const metrics = guideBarCalculations[gbId];
                if (!metrics) return null;
                const gbColor = currentGuideBars[gbId]?.color || '#6E9AC8';
                const isSelected = editingGbId === gbId;

                return (
                  <GuideBarCalcBadge
                    key={gbId}
                    metrics={metrics}
                    compact={false}
                    barColor={gbColor}
                    showRequiredYarn={true}
                    mobileLongPressInfo={true}
                    onClick={() => {
                      setEditingGbId(gbId);
                      scheduleRedraw();
                    }}
                    isSelected={isSelected}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 sm:hidden">
              Tarak seçmek için dokunun · Bilgi ekranı için basılı tutun
            </p>
          </div>

          {/* Compact 30-Needle Per Row Grid (10 cols on Mobile, 15 on Tablet, 30 on Desktop) */}
          <div className="space-y-1 p-1 sm:p-1.5 bg-[#0B0F17] rounded-lg border border-slate-800 select-none">
            {Array.from({ length: Math.ceil(needleCols / 30) }).map((_, rowIndex) => {
              const rowNeedleIndices = Array.from(
                { length: Math.min(30, needleCols - rowIndex * 30) },
                (_, k) => rowIndex * 30 + k
              );
              const rowFilled = rowNeedleIndices.filter(
                (idx) => currentThreading[idx] ?? false
              ).length;
              const rowEmpty = rowNeedleIndices.length - rowFilled;

              return (
                <div key={rowIndex} className="flex items-center gap-1 sm:gap-1.5">
                  <div
                    className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5 flex-1 min-w-0 touch-none"
                    onPointerMove={(e) => {
                      if (!isMouseDownRef.current) return;
                      const elem = document.elementFromPoint(e.clientX, e.clientY);
                      const needleBtn = elem?.closest('[data-needle-idx]');
                      if (needleBtn) {
                        const idx = parseInt(
                          needleBtn.getAttribute('data-needle-idx') || '-1',
                          10
                        );
                        if (
                          idx >= 0 &&
                          idx < needleCols &&
                          lastDragIdxRef.current !== idx
                        ) {
                          lastDragIdxRef.current = idx;
                          handleSetNeedleBatch([idx], dragTargetValRef.current);
                        }
                      }
                    }}
                  >
                    {rowNeedleIndices.map((nIdx) => {
                      const isThreaded = currentThreading[nIdx] ?? false;
                      const gbColor = currentGb?.color || '#3b82f6';
                      return (
                        <button
                          key={nIdx}
                          data-needle-idx={nIdx}
                          type="button"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            try {
                              if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
                                e.currentTarget.releasePointerCapture(e.pointerId);
                              }
                            } catch {}
                            isMouseDownRef.current = true;
                            lastDragIdxRef.current = nIdx;
                            const nextVal = !isThreaded;
                            dragTargetValRef.current = nextVal;
                            handleSetNeedleBatch([nIdx], nextVal);
                          }}
                          onPointerEnter={() => {
                            if (
                              isMouseDownRef.current &&
                              lastDragIdxRef.current !== nIdx
                            ) {
                              lastDragIdxRef.current = nIdx;
                              handleSetNeedleBatch([nIdx], dragTargetValRef.current);
                            }
                          }}
                          className={`h-8 sm:h-6.5 flex items-center justify-center rounded-xs border text-xs sm:text-[11px] font-mono font-bold transition-colors cursor-pointer select-none touch-none tabular-nums ${
                            isThreaded
                              ? 'border-transparent text-white font-black shadow-xs'
                              : 'bg-[#111827] border-slate-800/90 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                          style={{
                            backgroundColor: isThreaded ? gbColor : undefined,
                          }}
                          title={`İğne ${nIdx}: ${isThreaded ? 'Dolu' : 'Boş'}`}
                        >
                          {nIdx}
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className="h-8 sm:h-6.5 px-1.5 sm:px-2 flex items-center justify-center gap-0.5 sm:gap-1 rounded border border-slate-800 bg-[#111827] text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap shrink-0 tabular-nums shadow-xs self-start lg:self-center"
                    title={`Satır ${rowIndex + 1}: ${rowFilled} Dolu / ${rowEmpty} Boş`}
                  >
                    <span className="text-emerald-400">{rowFilled}</span>
                    <span className="text-slate-600 font-normal">/</span>
                    <span className="text-rose-400">{rowEmpty}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 2: SIMULATION VIEW & CONTROLS */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-2 sm:p-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 sm:gap-2.5">
          {/* Left: View Mode Selector with Icons */}
          <div className="flex items-center justify-between sm:justify-start gap-2" title="Görünüm Modu">
            <Eye className="w-4 h-4 text-blue-400 shrink-0 hidden sm:inline" />
            <div className="grid grid-cols-3 sm:flex items-center bg-[#0B0F17] p-1 rounded-lg border border-slate-800 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setDisplayMode('fabric')}
                className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  displayMode === 'fabric'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
                <span>Kumaş</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('technical')}
                className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  displayMode === 'technical'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5 shrink-0" />
                <span>Teknik</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('dual')}
                className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                  displayMode === 'dual'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>İkili</span>
              </button>
            </div>
          </div>

          {/* Center/Right: Active Guide Bar Badge + Repeats & Zoom Controls */}
          <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5">
            {/* Active GB Badge + Soft Color Picker Trigger */}
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1.5 bg-[#0B0F17] px-2 sm:px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-mono"
                title="Aktif Tarak Dolu/Boş Oranı"
              >
                <strong className="font-bold text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700" style={{ color: currentGb?.color || '#6E9AC8' }}>
                  {editingGbId}
                </strong>
                <span className="font-bold tabular-nums">
                  <span className="text-emerald-400">{filledNeedlesCount}</span>
                  <span className="text-slate-600 mx-0.5">/</span>
                  <span className="text-rose-400">{needleCols - filledNeedlesCount}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSoftColorPicker((prev) => !prev)}
                className={`px-2 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showSoftColorPicker
                    ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
                    : hasHarshYarnColors(currentGuideBars)
                    ? 'bg-[#0B0F17] border-amber-600/80 text-amber-200 hover:bg-slate-800'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-200 hover:bg-slate-800'
                }`}
                title="Göze daha yumuşak gelen soft ip renkleri öner ve uygula"
              >
                <Palette className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="hidden xs:inline">Soft Renk</span>
              </button>
            </div>

            {/* Horizontal Repeat (Yatay) with Icon */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#0B0F17] px-1.5 sm:px-2 py-1 rounded-lg border border-slate-800 text-xs" title="Yatay Tekrar">
              <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0 mr-0.5" />
              {[1, 2, 3, 4].map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setRepeatX(rep)}
                  className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                    repeatX === rep
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rep}x
                </button>
              ))}
            </div>

            {/* Vertical Repeat (Dikey) with Icon */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#0B0F17] px-1.5 sm:px-2 py-1 rounded-lg border border-slate-800 text-xs" title="Dikey Tekrar">
              <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0 mr-0.5" />
              {[1, 2, 3, 4].map((rep) => (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setRepeatY(rep)}
                  className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer tabular-nums ${
                    repeatY === rep
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rep}x
                </button>
              ))}
            </div>

            {/* Zoom & Fit Controls */}
            <div
              className="flex items-center gap-1 bg-[#0B0F17] p-1 rounded-lg border border-slate-800"
              title="Zoom Yakınlaştır / Uzaklaştır"
            >
              <button
                type="button"
                onClick={() => {
                  setIsAutoZoom(false);
                  setZoom((prev) => Math.max(0.25, Math.round((prev - 0.15) * 100) / 100));
                }}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-1 text-slate-200 min-w-[38px] sm:min-w-[42px] text-center tabular-nums">
                %{Math.round(zoom * 100)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAutoZoom(false);
                  setZoom((prev) => Math.min(2.5, Math.round((prev + 0.15) * 100) / 100));
                }}
                className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const container = fabricContainerRef.current || techContainerRef.current;
                  if (container) {
                    const availW = container.clientWidth - 12;
                    if (availW > 0 && fabricCanvasWidth > 0) {
                      const fitW = Math.max(0.2, Math.min(1.8, availW / fabricCanvasWidth));
                      setIsAutoZoom(false);
                      setZoom(Math.floor(fitW * 100) / 100);
                    }
                  }
                }}
                className="p-1 rounded bg-[#111827] text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                title="Yatay Sığdır"
              >
                <MoveHorizontal className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAutoZoom(true);
                  setTimeout(() => calculateSimFitZoom(), 20);
                }}
                className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                title="Dikey Sığdır"
              >
                <MoveVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Soft Yarn Color Suggestions Panel */}
        {showSoftColorPicker && (
          <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-xs">
            {/* Per-Selected-Bar Soft Swatches */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <strong style={{ color: currentGb?.color || '#6E9AC8' }}>{editingGbId}</strong>
                <span>İp Rengi:</span>
              </span>
              {SOFT_YARN_SWATCHES.map((sw) => {
                const isActive = currentGb?.color?.toLowerCase() === sw.hex.toLowerCase();
                return (
                  <button
                    key={sw.hex}
                    type="button"
                    onClick={() => {
                      const updatedGb: GuideBarConfig = { ...currentGb, color: sw.hex };
                      const nextMap = { ...currentGuideBars, [editingGbId]: updatedGb };
                      setGuideBarsState(nextMap);
                      onChangeGuideBar(editingGbId, updatedGb);
                      scheduleRedraw(nextMap);
                    }}
                    title={`${editingGbId}: ${sw.name}`}
                    className={`w-5 h-5 rounded-full border border-slate-900 cursor-pointer transition-transform ${
                      isActive ? 'ring-2 ring-white scale-110' : 'opacity-85 hover:opacity-100 hover:scale-110'
                    }`}
                    style={{ backgroundColor: sw.hex }}
                  />
                );
              })}
              <input
                type="color"
                value={currentGb?.color || '#6E9AC8'}
                onChange={(e) => {
                  const updatedGb: GuideBarConfig = { ...currentGb, color: e.target.value };
                  const nextMap = { ...currentGuideBars, [editingGbId]: updatedGb };
                  setGuideBarsState(nextMap);
                  onChangeGuideBar(editingGbId, updatedGb);
                  scheduleRedraw(nextMap);
                }}
                className="w-6 h-5 rounded border border-slate-700 bg-transparent cursor-pointer p-0"
                title="Özel Renk Seç"
              />
            </div>

            {/* Full 6-Bar Harmonious Soft Palettes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-400">Önerilen Soft Paletler:</span>
              {SOFT_YARN_PALETTES.map((pal) => (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => {
                    const nextMap = { ...currentGuideBars };
                    ALL_GB_IDS.forEach((gbId) => {
                      if (!nextMap[gbId]) return;
                      const updated = { ...nextMap[gbId], color: pal.colors[gbId] };
                      nextMap[gbId] = updated;
                      onChangeGuideBar(gbId, updated);
                    });
                    setGuideBarsState(nextMap);
                    scheduleRedraw(nextMap);
                    setCopyFeedback(`"${pal.name}" soft ip renk paleti uygulandı.`);
                    setTimeout(() => setCopyFeedback(null), 2000);
                  }}
                  title={pal.description}
                  className="px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/70 rounded-md text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span className="inline-flex items-center -space-x-1">
                    {(['GB1', 'GB2', 'GB3', 'GB4'] as GuideBarId[]).map((gId) => (
                      <span
                        key={gId}
                        className="w-2.5 h-2.5 rounded-full border border-[#0B0F17]"
                        style={{ backgroundColor: pal.colors[gId] }}
                      />
                    ))}
                  </span>
                  <span>{pal.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 3: SIMULATION CANVASES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3">
        {/* Technical Diagram */}
        {(displayMode === 'dual' || displayMode === 'technical') && (
          <div
            className={`bg-[#111827] border border-slate-800 rounded-xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <div className="px-2.5 sm:px-3.5 py-2 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-xs text-white">
                Teknik Şema ({totalCourses}K · {totalNeedles}İ)
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadSimulationImage(
                      technicalCanvasRef.current,
                      getReportFileName('Şema')
                    )
                  }
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>PNG İndir</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    shareSimulationImage(
                      technicalCanvasRef.current,
                      getReportFileName('Şema')
                    )
                  }
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                  title="WhatsApp ile Paylaş"
                >
                  <Share2 className="w-3.5 h-3.5 text-white" />
                  <span className="hidden xs:inline">WhatsApp</span>
                  <span className="xs:hidden">Paylaş</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingPdf}
                  onClick={() =>
                    shareSimulationPdf(
                      technicalCanvasRef.current,
                      getReportFileName('Şema', 'pdf'),
                      'TEKNİK ŞEMA'
                    )
                  }
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                  title="Yüksek Çözünürlüklü Çok Sayfalı PDF Paylaş"
                >
                  <FileText className="w-3.5 h-3.5 text-white" />
                  <span>{isExportingPdf ? 'Hazırlanıyor...' : 'PDF Paylaş'}</span>
                </button>
              </div>
            </div>

            <div
              ref={techContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey || e.altKey) {
                  e.preventDefault();
                  setIsAutoZoom(false);
                  const delta = e.deltaY < 0 ? 0.08 : -0.08;
                  setZoom((prev) => Math.max(0.2, Math.min(2.5, Math.round((prev + delta) * 100) / 100)));
                }
              }}
              className={`px-1 py-1 overflow-auto bg-[#070b14] flex justify-center touch-pan-x touch-pan-y ${
                isFullscreen || externalFs ? 'h-[calc(100vh-130px)] max-h-none' : 'max-h-[62vh] sm:max-h-[750px]'
              }`}
            >
              <div
                style={{
                  width: `${Math.round(techCanvasWidth * zoom)}px`,
                  height: `${Math.round(canvasHeight * zoom)}px`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.12s ease-out',
                  }}
                >
                  <canvas
                    ref={technicalCanvasRef}
                    width={techCanvasWidth}
                    height={canvasHeight}
                    className="rounded border border-slate-800/80 block"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fabric Surface Simulation */}
        {(displayMode === 'dual' || displayMode === 'fabric') && (
          <div
            className={`bg-[#111827] border border-slate-800 rounded-xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <div className="px-2.5 sm:px-3.5 py-2 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Left: Title + Checkboxes */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-semibold text-xs text-white whitespace-nowrap">
                  Kumaş Simülasyonu ({totalCourses}K · {totalNeedles}İ)
                </span>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 sm:pl-2.5 sm:border-l border-slate-700/80">
                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer text-slate-200 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={showPoreMesh}
                      onChange={(e) => setShowPoreMesh(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#0B0F17] border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span>Gözenek</span>
                  </label>

                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer text-slate-200 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={showStepNumbers}
                      onChange={(e) => setShowStepNumbers(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#0B0F17] border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span>Δ Adım</span>
                  </label>

                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer text-slate-200 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={showNeedleDots}
                      onChange={(e) => setShowNeedleDots(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#0B0F17] border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span>İğne Noktaları</span>
                  </label>
                </div>
              </div>

              {/* Right: Visibility Buttons + Download/Share Buttons */}
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {/* Guide Bar Layer Visibility Buttons */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-xs sm:pr-2.5 sm:border-r border-slate-700/80">
                  <span className="text-slate-400 font-semibold mr-0.5 hidden sm:inline">Görünürlük:</span>
                  {activeBars.map((id) => {
                    const isVis = visibleBars[id] !== false;
                    const gb = currentGuideBars[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          setVisibleBars((prev) => ({
                            ...prev,
                            [id]: !isVis,
                          }))
                        }
                        className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold transition-colors border cursor-pointer ${
                          isVis
                            ? 'text-white border-transparent'
                            : 'bg-[#0B0F17] text-slate-500 border-slate-800 line-through'
                        }`}
                        style={{ backgroundColor: isVis ? gb?.color : undefined }}
                      >
                        {id}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadSimulationImage(
                        fabricCanvasRef.current,
                        getReportFileName()
                      )
                    }
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>PNG İndir</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareSimulationImage(
                        fabricCanvasRef.current,
                        getReportFileName()
                      )
                    }
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                    title="WhatsApp ile Paylaş"
                  >
                    <Share2 className="w-3.5 h-3.5 text-white" />
                    <span>Paylaş</span>
                  </button>
                  <button
                    type="button"
                    disabled={isExportingPdf}
                    onClick={() =>
                      shareSimulationPdf(
                        fabricCanvasRef.current,
                        getReportFileName(undefined, 'pdf'),
                        'KUMAŞ SİMÜLASYONU'
                      )
                    }
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-60 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                    title="Yüksek Çözünürlüklü Çok Sayfalı PDF Paylaş"
                  >
                    <FileText className="w-3.5 h-3.5 text-white" />
                    <span>{isExportingPdf ? 'Hazırlanıyor...' : 'PDF Paylaş'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={fabricContainerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey || e.altKey) {
                  e.preventDefault();
                  setIsAutoZoom(false);
                  const delta = e.deltaY < 0 ? 0.08 : -0.08;
                  setZoom((prev) => Math.max(0.2, Math.min(2.5, Math.round((prev + delta) * 100) / 100)));
                }
              }}
              className={`px-1 py-1 overflow-auto bg-[#05070d] flex justify-center touch-pan-x touch-pan-y ${
                isFullscreen || externalFs ? 'h-[calc(100vh-130px)] max-h-none' : 'max-h-[62vh] sm:max-h-[750px]'
              }`}
            >
              <div
                style={{
                  width: `${Math.round(fabricCanvasWidth * zoom)}px`,
                  height: `${Math.round(canvasHeight * zoom)}px`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    transition: 'transform 0.12s ease-out',
                  }}
                >
                  <canvas
                    ref={fabricCanvasRef}
                    width={fabricCanvasWidth}
                    height={canvasHeight}
                    className="rounded border border-slate-800/80 bg-[#0a0f1e] block"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
