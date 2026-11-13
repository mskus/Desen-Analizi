import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PatternData, PatternRow, GuideBarId, ActiveTab } from '../types';
import {
  Plus,
  Minus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  ShieldCheck,
  Check,
  Maximize2,
  Minimize2,
  Dices,
  GripVertical,
  Eye,
  MoveHorizontal,
  MoveVertical,
  FlipVertical,
  CopyPlus,
  Hand,
} from 'lucide-react';
import { calculateGuideBarMetrics, GuideBarCalcBadge } from '../utils/fabricCalculator';
import { ALL_GB_IDS } from '../utils/patternTableCalc';

interface InteractiveEditorTabProps {
  pattern: PatternData;
  onChangeRows: (rows: PatternRow[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSafetySettings: () => void;
  activeTab?: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fabricWidthCm?: number;
  onChangeFabricWidth?: (widthCm: number) => void;
}

const EDITOR_SETTINGS_KEY = 'warpknitt_editor_settings';

interface StoredEditorSettings {
  activeGbId?: GuideBarId;
  isLivePreviewOpen?: boolean;
  showLiveFabricCard?: boolean;
  selectedGbForQuick?: GuideBarId;
  isAutoZoom?: boolean;
  zoom?: number;
  previewRepeatX?: number;
  previewRepeatY?: number;
}

const getInitialEditorSettings = (): StoredEditorSettings => {
  try {
    const saved = localStorage.getItem(EDITOR_SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse editor settings', e);
  }
  return {};
};

export const InteractiveEditorTab: React.FC<InteractiveEditorTabProps> = ({
  pattern,
  onChangeRows,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSafetySettings,
  onToggleFullscreen,
  isFullscreen,
  fabricWidthCm = 410,
  onChangeFabricWidth,
}) => {
  const savedEditorSettings = getInitialEditorSettings();

  const [activeGbId, setActiveGbId] = useState<GuideBarId>(
    savedEditorSettings.activeGbId || 'GB3'
  );

  const canvasCardRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);
  const [isNavMode, setIsNavMode] = useState(false);

  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateSlot = () => {
      const el = document.getElementById('editor-header-slot');
      if (el) setHeaderSlot(el);
    };
    updateSlot();
    const timer = setTimeout(updateSlot, 50);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = (ref: React.RefObject<HTMLDivElement | null>, isTable = false) => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    if (!ref.current) return;
    if (!document.fullscreenElement) {
      ref.current.requestFullscreen().catch((err) => console.error(err));
      if (isTable) setIsTableFullscreen(true);
      else setIsCanvasFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      if (isTable) setIsTableFullscreen(false);
      else setIsCanvasFullscreen(false);
    }
  };

  const [isAutoZoom, setIsAutoZoom] = useState<boolean>(
    savedEditorSettings.isAutoZoom ?? true
  );
  const [zoom, setZoom] = useState<number>(savedEditorSettings.zoom ?? 1);
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(
    savedEditorSettings.isLivePreviewOpen ?? true
  );
  const [showLiveFabricCard, setShowLiveFabricCard] = useState(
    savedEditorSettings.showLiveFabricCard ?? true
  );
  const [quickInputText, setQuickInputText] = useState('');
  const [selectedGbForQuick, setSelectedGbForQuick] = useState<GuideBarId>(
    savedEditorSettings.selectedGbForQuick || 'GB3'
  );
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [copiedRow, setCopiedRow] = useState<PatternRow | null>(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

  const [previewRepeatX, setPreviewRepeatX] = useState<number>(
    savedEditorSettings.previewRepeatX ?? 1
  );
  const [previewRepeatY, setPreviewRepeatY] = useState<number>(
    savedEditorSettings.previewRepeatY ?? 1
  );

  // Persisted Floating Preview Window (Position & Size saved across page/tab changes)
  const [previewWindow, setPreviewWindow] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    isDragging: boolean;
    isResizing: boolean;
    dragOffset: { x: number; y: number };
    resizeStart: { w: number; h: number; x: number; y: number };
  }>(() => {
    let savedWin: any = null;
    if (typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem('warpknitt_pref_preview_window');
        if (item) savedWin = JSON.parse(item);
      } catch (e) {
        console.error(e);
      }
    }
    const isSmallMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const initW = savedWin?.width
      ? (isSmallMobile ? Math.min(savedWin.width, Math.max(168, window.innerWidth - 28)) : savedWin.width)
      : isSmallMobile
      ? 188
      : 280;
    const initH = savedWin?.height
      ? (isSmallMobile ? Math.min(savedWin.height, 150) : savedWin.height)
      : isSmallMobile
      ? 135
      : 200;
    const defaultX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - initW - 14) : 20;
    const defaultY = typeof window !== 'undefined' ? Math.max(70, window.innerHeight - initH - 18) : 20;
    const clampedX = typeof window !== 'undefined' && savedWin?.x !== undefined
      ? Math.max(10, Math.min(window.innerWidth - initW - 10, savedWin.x))
      : defaultX;
    const clampedY = typeof window !== 'undefined' && savedWin?.y !== undefined
      ? Math.max(10, Math.min(window.innerHeight - initH - 10, savedWin.y))
      : defaultY;

    return {
      x: clampedX,
      y: clampedY,
      width: initW,
      height: initH,
      isDragging: false,
      isResizing: false,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { w: initW, h: initH, x: 0, y: 0 },
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        'warpknitt_pref_preview_window',
        JSON.stringify({
          x: previewWindow.x,
          y: previewWindow.y,
          width: previewWindow.width,
          height: previewWindow.height,
        })
      );
    } catch (e) {
      console.error(e);
    }
  }, [previewWindow.x, previewWindow.y, previewWindow.width, previewWindow.height]);

  const handleStartDragPreview = (e: React.PointerEvent) => {
    e.preventDefault();
    setPreviewWindow((prev) => ({
      ...prev,
      isDragging: true,
      dragOffset: {
        x: e.clientX - prev.x,
        y: e.clientY - prev.y,
      },
    }));
  };

  const handleStartResizePreview = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPreviewWindow((prev) => ({
      ...prev,
      isResizing: true,
      resizeStart: {
        w: prev.width,
        h: prev.height,
        x: e.clientX,
        y: e.clientY,
      },
    }));
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (previewWindow.isDragging) {
        setPreviewWindow((prev) => ({
          ...prev,
          x: Math.max(
            10,
            Math.min(window.innerWidth - prev.width - 10, e.clientX - prev.dragOffset.x)
          ),
          y: Math.max(
            10,
            Math.min(window.innerHeight - prev.height - 10, e.clientY - prev.dragOffset.y)
          ),
        }));
      } else if (previewWindow.isResizing) {
        const dw = e.clientX - previewWindow.resizeStart.x;
        const dh = e.clientY - previewWindow.resizeStart.y;
        setPreviewWindow((prev) => ({
          ...prev,
          width: Math.max(180, Math.min(640, prev.resizeStart.w + dw)),
          height: Math.max(120, Math.min(480, prev.resizeStart.h + dh)),
        }));
      }
    };

    const handlePointerUp = () => {
      if (previewWindow.isDragging || previewWindow.isResizing) {
        setPreviewWindow((prev) => ({
          ...prev,
          isDragging: false,
          isResizing: false,
        }));
      }
    };

    if (previewWindow.isDragging || previewWindow.isResizing) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    previewWindow.isDragging,
    previewWindow.isResizing,
    previewWindow.dragOffset,
    previewWindow.resizeStart,
  ]);

  const draggingRef = useRef<{
    courseIdx: number;
    gbId: GuideBarId;
    currentNeedle: number;
  } | null>(null);

  const [draggingNode, setDraggingNode] = useState<{
    courseIdx: number;
    gbId: GuideBarId;
    currentNeedle: number;
  } | null>(null);

  const [hoverInfo, setHoverInfo] = useState<{
    courseIdx: number;
    needle: number;
    x: number;
    y: number;
  } | null>(null);

  const touchDistRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveFabricCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [editorNeedles, setEditorNeedles] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('warpknitt_editor_needle_count');
      if (saved) return Math.max(8, Math.min(96, parseInt(saved, 10)));
    } catch (e) {}
    return 32;
  });

  const [editorNeedlesInputText, setEditorNeedlesInputText] = useState<string>(String(editorNeedles));

  useEffect(() => {
    setEditorNeedlesInputText(String(editorNeedles));
  }, [editorNeedles]);

  useEffect(() => {
    localStorage.setItem('warpknitt_editor_needle_count', editorNeedles.toString());
  }, [editorNeedles]);

  const rows = pattern.rows;
  // Independent Live Drag-and-Drop needle count (max 96 needles)
  const needleCols = editorNeedles;
  const needlePitch = needleCols > 64 ? 18 : needleCols > 32 ? 26 : 38;
  const coursePitch = 46;

  const activeBars = ALL_GB_IDS.filter(
    (id) => pattern.guideBars[id]?.active
  );

  // Guide Bar Calculation Engine: Fabric width, needle limit, threading repeat, and report repeat counts
  const guideBarCalculations = useMemo(() => {
    const map: Partial<Record<GuideBarId, ReturnType<typeof calculateGuideBarMetrics>>> = {};
    activeBars.forEach((id) => {
      const gb = pattern.guideBars[id];
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
  }, [activeBars, pattern.guideBars, rows, pattern.machine, pattern.safety, fabricWidthCm]);

  // Equal, tight left and right margins (36px left, 36px right)
  const startX = 36;
  const startY = 48;
  const canvasWidth = (needleCols - 1) * needlePitch + startX * 2;
  const canvasHeight = Math.max(420, startY + rows.length * coursePitch + 28);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 2200);
  };

  const calculateEditorFitZoom = useCallback(() => {
    if (!isAutoZoom) return;
    if (isFullscreen || isCanvasFullscreen) {
      // In fullscreen mode, keep 100% natural resolution or horizontal fit so it expands vertically
      const container = containerRef.current;
      if (container && container.clientWidth > 0 && canvasWidth > 0) {
        const fitW = (container.clientWidth - 16) / canvasWidth;
        const clampedW = Math.max(0.75, Math.min(1.0, Math.floor(fitW * 100) / 100));
        setZoom(clampedW);
      } else {
        setZoom(1.0);
      }
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const availHeight = container.clientHeight > 0 ? container.clientHeight - 16 : 460;
    if (availHeight > 0 && canvasHeight > 0) {
      const fit = availHeight / canvasHeight;
      const clamped = Math.max(0.35, Math.min(1.5, Math.floor(fit * 100) / 100));
      setZoom(clamped);
    }
  }, [isAutoZoom, canvasHeight, canvasWidth, isFullscreen, isCanvasFullscreen]);

  useEffect(() => {
    calculateEditorFitZoom();
  }, [calculateEditorFitZoom, needleCols]);

  useEffect(() => {
    if (!isAutoZoom) return;
    const handleResize = () => calculateEditorFitZoom();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoZoom, calculateEditorFitZoom]);

  useEffect(() => {
    const settingsToSave: StoredEditorSettings = {
      activeGbId,
      isLivePreviewOpen,
      showLiveFabricCard,
      selectedGbForQuick,
      isAutoZoom,
      zoom,
      previewRepeatX,
      previewRepeatY,
    };
    localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(settingsToSave));
  }, [
    activeGbId,
    isLivePreviewOpen,
    showLiveFabricCard,
    selectedGbForQuick,
    isAutoZoom,
    zoom,
    previewRepeatX,
    previewRepeatY,
  ]);

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
        setZoom((prev) => Math.max(0.35, Math.min(2.2, prev + zoomFactor)));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  const getNeedleFromClientX = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const xInCanvas = (clientX - rect.left) * scaleX;
      const relativeX = xInCanvas - startX;
      const nearestNeedle = Math.round(relativeX / needlePitch);
      return Math.max(0, Math.min(needleCols - 1, nearestNeedle));
    },
    [needleCols, needlePitch, startX]
  );

  const getCourseFromClientY = useCallback(
    (clientY: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const scaleY = canvas.height / rect.height;
      const yInCanvas = (clientY - rect.top) * scaleY;
      const relativeY = yInCanvas - startY;
      const nearestCourse = Math.floor(relativeY / coursePitch);
      return Math.max(0, Math.min(rows.length - 1, nearestCourse));
    },
    [coursePitch, rows.length, startY]
  );

  const getSoftColorBg = (hexColor: string, alpha = 0.12) => {
    if (hexColor && hexColor.startsWith('#')) {
      const hex = hexColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return 'transparent';
  };

  const drawEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentDrag = draggingRef.current || draggingNode;

    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    for (let n = 0; n < needleCols; n++) {
      const nx = startX + n * needlePitch;
      const isHovered =
        (currentDrag && currentDrag.currentNeedle === n) ||
        (hoverInfo && hoverInfo.needle === n);

      ctx.fillStyle = isHovered ? '#38bdf8' : '#94a3b8';
      ctx.fillText(`İ${n}`, nx, startY - 18);

      ctx.strokeStyle = isHovered ? '#0284c7' : '#1e293b';
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(nx, startY - 8);
      ctx.lineTo(nx, startY + rows.length * coursePitch + 8);
      ctx.stroke();
    }

    for (let c = 0; c <= rows.length; c++) {
      const cy = startY + c * coursePitch;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX - 10, cy);
      ctx.lineTo(startX + (needleCols - 1) * needlePitch + 10, cy);
      ctx.stroke();

      // Draw Course labels on both left and right for visual symmetry
      if (c < rows.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`K${c + 1}`, startX - 12, cy + coursePitch / 2 + 4);
        ctx.textAlign = 'left';
        ctx.fillText(
          `K${c + 1}`,
          startX + (needleCols - 1) * needlePitch + 12,
          cy + coursePitch / 2 + 4
        );
      }
    }

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    for (let c = 0; c < rows.length; c++) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      for (let n = 0; n < needleCols; n++) {
        const nx = startX + n * needlePitch;
        ctx.moveTo(nx + 2.5, cy);
        ctx.arc(nx, cy, 2.5, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      const isSelected = activeGbId === gbId;

      // 1. Yarn path across courses: connected curves, subtly transparent if skipped
      for (let rIdx = 1; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const prevRow = rows[rIdx - 1];
        let needleVal = row[gbId] || 0;
        let prevVal = prevRow[gbId] || 0;

        if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
          needleVal = currentDrag.currentNeedle;
        }
        if (currentDrag && currentDrag.courseIdx === rIdx - 1 && currentDrag.gbId === gbId) {
          prevVal = currentDrag.currentNeedle;
        }

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;
        const prevX = startX + prevVal * needlePitch;
        const prevY = startY + (rIdx - 1) * coursePitch + coursePitch / 2;
        const cpY = (prevY + py) / 2;

        const isSkipped = row.skips?.[gbId] ?? false;

        ctx.save();
        ctx.strokeStyle = gb.color;
        ctx.lineWidth = isSelected ? (isSkipped ? 2.5 : 3.5) : (isSkipped ? 1.0 : 1.5);
        ctx.globalAlpha = isSkipped ? 0.35 : isSelected ? 1.0 : 0.45;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Nodes / Circles (with clean white border & specular highlight dot)
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        const isDraggingThis = currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId;
        if (isDraggingThis) needleVal = currentDrag.currentNeedle;

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;
        const isSkipped = row.skips?.[gbId] ?? false;
        const nodeRadius = isSelected ? 7.5 : 4.5;

        ctx.save();
        ctx.globalAlpha = isSkipped ? 0.35 : 1.0;

        ctx.beginPath();
        ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = gb.color;
        ctx.fill();

        ctx.strokeStyle = isDraggingThis ? '#38bdf8' : '#ffffff';
        ctx.lineWidth = isDraggingThis ? 2.5 : 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px - nodeRadius * 0.3, py - nodeRadius * 0.3, Math.max(1, nodeRadius * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();

        ctx.restore();
      });
    });
  }, [
    rows,
    activeBars,
    activeGbId,
    draggingNode,
    needleCols,
    coursePitch,
    needlePitch,
    startX,
    startY,
    hoverInfo,
    pattern.guideBars,
  ]);

  // Mini Floating Preview Window: Simplified High-Performance Fabric Surface Simulation
  const drawPreviewCanvas = useCallback(() => {
    if (!isLivePreviewOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const prevPadX = 12;
    const prevPadY = 12;
    const totalNeedles = Math.max(1, needleCols * previewRepeatX);
    const totalCourses = Math.max(1, rows.length * previewRepeatY);
    const prevPitchX = (canvas.width - prevPadX * 2) / Math.max(1, totalNeedles - 1);
    const prevPitchY = (canvas.height - prevPadY * 2) / Math.max(1, totalCourses - 1);
    const currentDrag = draggingRef.current || draggingNode;

    // Draw subtle vertical needle wale guides
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = 0; n < totalNeedles; n += 2) {
      const nx = prevPadX + n * prevPitchX;
      ctx.moveTo(nx, prevPadY);
      ctx.lineTo(nx, canvas.height - prevPadY);
    }
    ctx.stroke();

    // Render all threaded needles for each active guide bar
    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      if (!gb) return;
      const isSelected = activeGbId === gbId;
      const threadingArr =
        gb.threadingArray || Array.from({ length: needleCols }, (_, i) => i % 2 === 0);

      for (let g = 0; g < totalNeedles; g++) {
        const baseG = g % needleCols;
        if (!threadingArr[baseG]) continue;

        for (let repY = 0; repY < previewRepeatY; repY++) {
          rows.forEach((row, rIdx) => {
            const c = repY * rows.length + rIdx;
            let shift = row[gbId] || 0;
            if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
              shift = currentDrag.currentNeedle;
            }
            const actualNeedle = g + shift;

            if (actualNeedle >= 0 && actualNeedle < totalNeedles) {
              const x = prevPadX + actualNeedle * prevPitchX;
              const y = prevPadY + c * prevPitchY;

              if (c > 0) {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                let prevShift = prevRow[gbId] || 0;
                if (
                  currentDrag &&
                  currentDrag.courseIdx === (rIdx === 0 ? rows.length - 1 : rIdx - 1) &&
                  currentDrag.gbId === gbId
                ) {
                  prevShift = currentDrag.currentNeedle;
                }
                const prevNeedle = g + prevShift;
                if (prevNeedle >= 0 && prevNeedle < totalNeedles) {
                  const prevX = prevPadX + prevNeedle * prevPitchX;
                  const prevY = prevPadY + (c - 1) * prevPitchY;

                  const isSkipped = row.skips?.[gbId] ?? false;

                  ctx.save();
                  ctx.strokeStyle = gb.color;
                  ctx.lineWidth = isSelected ? (isSkipped ? 1.2 : 2.2) : (isSkipped ? 0.8 : 1.5);
                  ctx.globalAlpha = isSkipped ? 0.20 : isSelected ? 0.95 : 0.65;
                  if (isSkipped) {
                    ctx.setLineDash([3, 3]);
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
      }
    });
  }, [
    rows,
    activeBars,
    activeGbId,
    draggingNode,
    isLivePreviewOpen,
    needleCols,
    previewRepeatX,
    previewRepeatY,
    pattern.guideBars,
  ]);

  const drawLiveFabricCanvas = useCallback(() => {
    if (!showLiveFabricCard) return;
    const canvas = liveFabricCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#0a0f1e');
    bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fabStartX = 36;
    const fabStartY = 24;
    const fabPitchX = (canvas.width - fabStartX * 2) / Math.max(1, needleCols - 1);
    const fabPitchY = Math.min(26, (canvas.height - 44) / Math.max(1, rows.length * 2));
    const currentDrag = draggingRef.current || draggingNode;

    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      if (!gb) return;

      const threadingArr =
        gb.threadingArray || Array.from({ length: needleCols }, (_, i) => i % 2 === 0);

      ctx.save();
      ctx.strokeStyle = gb.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (let g = 0; g < needleCols; g++) {
        if (!threadingArr[g]) continue;

        for (let rep = 0; rep < 2; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            let shift = row[gbId] || 0;
            if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
              shift = currentDrag.currentNeedle;
            }
            const targetNeedle = g + shift;

            if (targetNeedle >= 0 && targetNeedle < needleCols) {
              const x = fabStartX + targetNeedle * fabPitchX;
              const y = fabStartY + c * fabPitchY;

              if (c > 0) {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                let prevShift = prevRow[gbId] || 0;
                if (
                  currentDrag &&
                  currentDrag.courseIdx === (rIdx === 0 ? rows.length - 1 : rIdx - 1) &&
                  currentDrag.gbId === gbId
                ) {
                  prevShift = currentDrag.currentNeedle;
                }
                const prevNeedle = g + prevShift;
                if (prevNeedle >= 0 && prevNeedle < needleCols) {
                  const prevX = fabStartX + prevNeedle * fabPitchX;
                  const prevY = fabStartY + (c - 1) * fabPitchY;

                  ctx.moveTo(prevX, prevY);
                  ctx.quadraticCurveTo((prevX + x) / 2, (prevY + y) / 2, x, y);
                }
              }
            }
          });
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [rows, activeBars, draggingNode, showLiveFabricCard, needleCols, pattern.guideBars]);

  useEffect(() => {
    const animId = requestAnimationFrame(() => {
      drawEditorCanvas();
    });
    return () => cancelAnimationFrame(animId);
  }, [drawEditorCanvas]);

  useEffect(() => {
    const animId = requestAnimationFrame(() => {
      drawPreviewCanvas();
      drawLiveFabricCanvas();
    });
    return () => cancelAnimationFrame(animId);
  }, [drawPreviewCanvas, drawLiveFabricCanvas, previewWindow.width, previewWindow.height]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isNavMode) return;
    e.preventDefault();
    const courseIdx = getCourseFromClientY(e.clientY);
    const targetNeedle = getNeedleFromClientX(e.clientX);

    const node = { courseIdx, gbId: activeGbId, currentNeedle: targetNeedle };
    draggingRef.current = node;
    setDraggingNode(node);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const updated = rows.map((r, idx) =>
      idx === courseIdx ? { ...r, [activeGbId]: targetNeedle } : r
    );
    onChangeRows(updated);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isNavMode) return;
    const courseIdx = getCourseFromClientY(e.clientY);
    const needle = getNeedleFromClientX(e.clientX);

    setHoverInfo((prev) => {
      if (
        prev &&
        prev.courseIdx === courseIdx &&
        prev.needle === needle &&
        Math.abs(prev.x - e.clientX) < 6 &&
        Math.abs(prev.y - e.clientY) < 6
      ) {
        return prev;
      }
      return { courseIdx, needle, x: e.clientX, y: e.clientY };
    });

    if (!draggingRef.current) return;
    if (needle !== draggingRef.current.currentNeedle) {
      draggingRef.current.currentNeedle = needle;
      setDraggingNode({ ...draggingRef.current });
      const dragCourse = draggingRef.current.courseIdx;
      const dragGb = draggingRef.current.gbId;
      const updated = rows.map((r, idx) =>
        idx === dragCourse ? { ...r, [dragGb]: needle } : r
      );
      onChangeRows(updated);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isNavMode) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    const drag = draggingRef.current || draggingNode;
    if (drag) {
      const { courseIdx, gbId, currentNeedle } = drag;
      const updated = rows.map((r, idx) =>
        idx === courseIdx ? { ...r, [gbId]: currentNeedle } : r
      );
      onChangeRows(updated);
    }
    draggingRef.current = null;
    setDraggingNode(null);
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isNavMode) return;
    e.preventDefault();
    const courseIdx = getCourseFromClientY(e.clientY);
    const updated = rows.map((r, idx) => {
      if (idx === courseIdx) {
        const currentSkips = r.skips || {};
        const nextVal = !currentSkips[activeGbId];
        return {
          ...r,
          skips: {
            ...currentSkips,
            [activeGbId]: nextVal,
          },
        };
      }
      return r;
    });
    onChangeRows(updated);
  };

  const addRow = () => {
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
    if (rows.length <= 1) return;
    const lastCourseNum = rows[rows.length - 1]?.courseIndex || rows.length;
    const updated = rows
      .slice(0, rows.length - 1)
      .map((r, i) => ({ ...r, courseIndex: i + 1 }));
    onChangeRows(updated);
    showMsg(`Son kurs (K${lastCourseNum}) silindi.`);
  };

  const insertRowAfter = (rIdx: number) => {
    const prevR = rows[rIdx] || rows[0];
    const newRow: PatternRow = {
      id: 'ins-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      courseIndex: rIdx + 2,
      GB1: prevR.GB1,
      GB2: prevR.GB2,
      GB3: prevR.GB3,
      GB4: prevR.GB4,
      GB5: prevR.GB5,
      GB6: prevR.GB6,
    };
    const updated = [...rows];
    updated.splice(rIdx + 1, 0, newRow);
    const reindexed = updated.map((r, i) => ({
      ...r,
      courseIndex: i + 1,
      stepIndex: i + 1,
    }));
    onChangeRows(reindexed);
  };

  const reorderRows = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const updated = [...rows];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    const reindexed = updated.map((r, i) => ({
      ...r,
      courseIndex: i + 1,
      stepIndex: i + 1,
    }));
    onChangeRows(reindexed);
  };

  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    const updated = rows
      .filter((_, i) => i !== index)
      .map((r, i) => ({ ...r, courseIndex: i + 1 }));
    onChangeRows(updated);
    showMsg('Kurs satırı silindi.');
  };

  const copyRow = (row: PatternRow) => {
    setCopiedRow(row);
    showMsg(`K${row.courseIndex} satırı kopyalandı.`);
  };

  const pasteRow = () => {
    if (!copiedRow) return;
    const newRow: PatternRow = {
      ...copiedRow,
      id: 'paste-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      courseIndex: rows.length + 1,
    };
    onChangeRows([...rows, newRow]);
    showMsg('Kopyalanan satır eklendi.');
  };

  const duplicatePattern = () => {
    const duplicated = [...rows, ...rows].map((r, idx) => ({
      ...r,
      id: 'dup-' + idx + '-' + Date.now(),
      courseIndex: idx + 1,
    }));
    onChangeRows(duplicated);
    showMsg('Desen 2 katına çoğaltıldı.');
  };

  const mirrorPattern = () => {
    const reversed = [...rows].reverse().map((r, idx) => ({
      ...r,
      id: 'mir-' + idx + '-' + Date.now(),
      courseIndex: rows.length + idx + 1,
    }));
    onChangeRows([...rows, ...reversed]);
    showMsg('Desen simetrik aynalandı.');
  };

  const resetRowsToSingle = () => {
    const firstRow = rows[0] || {
      id: 'r1',
      courseIndex: 1,
      GB1: 0,
      GB2: 0,
      GB3: 1,
      GB4: 0,
      GB5: 2,
      GB6: 0,
    };
    onChangeRows([{ ...firstRow, courseIndex: 1 }]);
    showMsg('Tablo tek satıra sıfırlandı.');
  };

  const [copySourceGb, setCopySourceGb] = useState<GuideBarId>('GB3');
  const [copyTargetGb, setCopyTargetGb] = useState<string>('ALL');
  const [mirrorGbId, setMirrorGbId] = useState<GuideBarId>('GB3');

  const handleGenerateRandomPattern = () => {
    const totalCount = rows.length || 12;
    const maxJump = Math.max(1, pattern.safety?.maxSafeShoggingJump || 4);
    const maxNeedle = Math.max(7, needleCols - 1);

    const newRows: PatternRow[] = [];
    for (let c = 1; c <= totalCount; c++) {
      const prevRow = newRows[c - 2];
      const usedInRow = new Set<number>();
      const rowObj: PatternRow = {
        id: `rnd-${Date.now()}-${c}`,
        courseIndex: c,
        GB1: 0,
        GB2: 0,
        GB3: 0,
        GB4: 0,
        GB5: 0,
        GB6: 0,
      };

      activeBars.forEach((gbId) => {
        const prevVal = prevRow ? (prevRow[gbId] ?? 0) : Math.floor(Math.random() * (maxNeedle + 1));

        // Find candidate jumps within [-maxJump, +maxJump] that avoid needle collision with other active bars
        const candidateDeltas = Array.from({ length: maxJump * 2 + 1 }, (_, i) => i - maxJump)
          .sort(() => Math.random() - 0.5);

        let chosenVal = prevVal;
        let found = false;

        for (const delta of candidateDeltas) {
          const candidate = Math.max(0, Math.min(maxNeedle, prevVal + delta));
          if (!usedInRow.has(candidate)) {
            chosenVal = candidate;
            found = true;
            break;
          }
        }

        if (!found) {
          for (let n = 0; n <= maxNeedle; n++) {
            if (!usedInRow.has(n)) {
              chosenVal = n;
              break;
            }
          }
        }

        usedInRow.add(chosenVal);
        rowObj[gbId] = chosenVal;
      });

      newRows.push(rowObj);
    }
    onChangeRows(newRows);
    showMsg('Güvenli sınırlar içinde çakışmasız desen üretildi.');
  };

  const handleCopyGbChainCode = () => {
    const srcGb = copySourceGb;
    const tgtGb = copyTargetGb;

    const updated = rows.map((r) => {
      const srcVal = r[srcGb] ?? 0;
      if (tgtGb === 'ALL') {
        const newR = { ...r };
        activeBars.forEach((id) => {
          if (id !== srcGb) newR[id] = srcVal;
        });
        return newR;
      } else {
        return { ...r, [tgtGb as GuideBarId]: srcVal };
      }
    });
    onChangeRows(updated);
    showMsg(
      tgtGb === 'ALL'
        ? `${srcGb} zincir kodu tüm aktif taraklara kopyalandı.`
        : `${srcGb} zincir kodu ${tgtGb} tarağına kopyalandı.`
    );
  };

  const handleMirrorSingleGbChainCode = () => {
    const updated = rows.map((r, i) => {
      const sourceRow = rows[rows.length - 1 - i];
      return {
        ...r,
        [mirrorGbId]: sourceRow[mirrorGbId] ?? 0,
      };
    });
    onChangeRows(updated);
    showMsg(`${mirrorGbId} tarağı zincir kodu dikey aynalandı.`);
  };

  const toggleCellSkip = (rowIndex: number, gbId: GuideBarId) => {
    const updated = rows.map((r, idx) => {
      if (idx === rowIndex) {
        const currentSkips = r.skips || {};
        const nextVal = !currentSkips[gbId];
        return {
          ...r,
          skips: {
            ...currentSkips,
            [gbId]: nextVal,
          },
        };
      }
      return r;
    });
    onChangeRows(updated);
  };

  const handleCellChange = (rowIndex: number, gb: GuideBarId, val: number) => {
    const updated = [...rows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [gb]: isNaN(val) ? 0 : Math.max(0, Math.min(needleCols - 1, val)),
    };
    onChangeRows(updated);
  };

  const handleQuickNotationParse = () => {
    if (!quickInputText.trim()) return;
    const numbers = quickInputText
      .replace(/[-.,/]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n));

    if (numbers.length === 0) return;

    const newRows: PatternRow[] = numbers.map((val, idx) => ({
      id: 'quick-' + idx + '-' + Date.now(),
      courseIndex: idx + 1,
      GB1: selectedGbForQuick === 'GB1' ? val : rows[idx]?.GB1 || 0,
      GB2: selectedGbForQuick === 'GB2' ? val : rows[idx]?.GB2 || 0,
      GB3: selectedGbForQuick === 'GB3' ? val : rows[idx]?.GB3 || 0,
      GB4: selectedGbForQuick === 'GB4' ? val : rows[idx]?.GB4 || 0,
      GB5: selectedGbForQuick === 'GB5' ? val : rows[idx]?.GB5 || 0,
      GB6: selectedGbForQuick === 'GB6' ? val : rows[idx]?.GB6 || 0,
    }));

    onChangeRows(newRows);
    setQuickInputText('');
    showMsg(`${selectedGbForQuick} zincir kodu uygulandı.`);
  };

  const toolbarContent = (
    <div className="flex flex-wrap items-center justify-between sm:justify-center gap-1.5 sm:gap-2 text-xs">
      {/* Left: Guide Bar Selection + Independent Needle Count (Max 96) */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
        <div className="flex flex-wrap items-center gap-1 bg-[#0B0F17] p-0.5 rounded border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 px-1 hidden xs:inline">Tarak:</span>
          {activeBars.map((gbId) => {
            const gb = pattern.guideBars[gbId];
            const isSelected = activeGbId === gbId;
            return (
              <button
                key={gbId}
                type="button"
                onClick={() => setActiveGbId(gbId)}
                className={`px-1.5 sm:px-2 py-0.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                  isSelected
                    ? 'text-white border-transparent'
                    : 'bg-[#111827] text-slate-400 border-slate-800 hover:text-white'
                }`}
                style={{ backgroundColor: isSelected ? gb.color : undefined }}
              >
                {gbId}
              </button>
            );
          })}
          {guideBarCalculations[activeGbId] && (
            <div className="ml-0.5 sm:ml-1">
              <GuideBarCalcBadge metrics={guideBarCalculations[activeGbId]!} compact={true} />
            </div>
          )}
        </div>

        {/* Independent Needle Count Control (Direct Text + Steppers [-] [+]) */}
        <div
          className="flex items-center gap-1 bg-[#0B0F17] px-1.5 py-0.5 rounded border border-slate-800"
          title="Şema İğne Sayısı (8 - 96)"
        >
          <span className="font-semibold text-xs text-slate-400 whitespace-nowrap">İğne:</span>
          <button
            type="button"
            onClick={() => {
              const next = Math.max(8, editorNeedles - 1);
              setEditorNeedlesInputText(String(next));
              setEditorNeedles(next);
            }}
            className="w-4.5 h-4.5 flex items-center justify-center bg-[#111827] border border-slate-700 hover:border-slate-500 rounded text-slate-300 hover:text-white cursor-pointer"
            title="İğne Eksilt (-1)"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={editorNeedlesInputText}
            onChange={(e) => {
              const valStr = e.target.value;
              setEditorNeedlesInputText(valStr);
              const parsed = parseInt(valStr, 10);
              if (!isNaN(parsed) && parsed >= 8 && parsed <= 96) {
                setEditorNeedles(parsed);
              }
            }}
            onBlur={() => {
              const parsed = parseInt(editorNeedlesInputText, 10);
              const clamped = isNaN(parsed) ? 32 : Math.max(8, Math.min(96, parsed));
              setEditorNeedlesInputText(String(clamped));
              if (clamped !== editorNeedles) {
                setEditorNeedles(clamped);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-9 sm:w-10 bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-blue-400 focus:outline-none focus:border-blue-500 tabular-nums text-xs"
            title="Şema İğne Sayısı"
          />
          <button
            type="button"
            onClick={() => {
              const next = Math.min(96, editorNeedles + 1);
              setEditorNeedlesInputText(String(next));
              setEditorNeedles(next);
            }}
            className="w-4.5 h-4.5 flex items-center justify-center bg-[#111827] border border-slate-700 hover:border-slate-500 rounded text-slate-300 hover:text-white cursor-pointer"
            title="İğne Artır (+1)"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center: Pattern & Course Actions */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={addRow}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          title="Yeni Kurs Satırı Ekle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Kurs</span>
        </button>

        <button
          type="button"
          onClick={deleteLastRow}
          disabled={rows.length <= 1}
          className="px-2 py-1 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/80 text-rose-200 disabled:opacity-30 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          title="Son Kursu Sil"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>Sil</span>
        </button>

        {copiedRow && (
          <button
            type="button"
            onClick={pasteRow}
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            title="Kopyalanan Satırı Yapıştır"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Yapıştır</span>
          </button>
        )}

        <button
          type="button"
          onClick={duplicatePattern}
          className="px-1.5 sm:px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          title="Deseni 2x Çoğalt"
        >
          <CopyPlus className="w-3.5 h-3.5 text-blue-400" />
          <span>2x</span>
        </button>

        <button
          type="button"
          onClick={mirrorPattern}
          className="px-1.5 sm:px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          title="Simetrik Aynala"
        >
          <FlipVertical className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xs:inline">Aynala</span>
        </button>

        <button
          type="button"
          onClick={handleGenerateRandomPattern}
          className="px-1.5 sm:px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          title="Otomatik Desen Üret"
        >
          <Dices className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden xs:inline">Üret</span>
        </button>

        <button
          type="button"
          onClick={() => setIsLivePreviewOpen((prev) => !prev)}
          className={`p-1 rounded border transition-colors cursor-pointer ${
            isLivePreviewOpen
              ? 'bg-blue-600 text-white border-blue-500'
              : 'bg-[#0B0F17] text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Ufak Kumaş Önizleme"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1 bg-[#0B0F17] border border-slate-700 text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          title="Geri Al"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1 bg-[#0B0F17] border border-slate-700 text-slate-200 disabled:opacity-30 rounded hover:bg-slate-800 transition-colors cursor-pointer"
          title="İleri Al"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Mobile Navigation Toggle, Zoom, Fit */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setIsNavMode((prev) => {
              const next = !prev;
              if (next) {
                draggingRef.current = null;
                setDraggingNode(null);
                setHoverInfo(null);
              }
              return next;
            });
          }}
          className={`px-2 py-1 rounded border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
            isNavMode
              ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
              : 'bg-[#0B0F17] text-slate-200 border-slate-700 hover:bg-slate-800'
          }`}
          title="Seçiliyken desen noktalarını bozmadan parmakla kaydırma ve yakınlaştırma yapabilirsiniz"
        >
          <Hand className="w-3.5 h-3.5 shrink-0" />
          <span>{isNavMode ? 'Ölçek / Kaydır Açık' : 'Ölçek / Kaydır'}</span>
        </button>

        <div
          onWheel={(e) => {
            e.preventDefault();
            setIsAutoZoom(false);
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            setZoom((z) => Math.max(0.35, Math.min(2.2, Math.round((z + delta) * 100) / 100)));
          }}
          className="flex items-center gap-0.5 sm:gap-1 bg-[#0B0F17] p-0.5 sm:p-1 rounded-lg border border-slate-800"
          title="Zoom (Farenin orta tekerleği ile hızlı yakınlaştır/uzaklaştır)"
        >
          <button
            type="button"
            onClick={() => {
              setIsAutoZoom(false);
              setZoom((z) => Math.max(0.35, Math.round((z - 0.15) * 100) / 100));
            }}
            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Uzaklaştır"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200 min-w-[36px] sm:min-w-[40px] text-center tabular-nums">
            %{Math.round(zoom * 100)}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsAutoZoom(false);
              setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100));
            }}
            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Yakınlaştır"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (containerRef.current) {
                const availWidth = containerRef.current.clientWidth - 12;
                if (availWidth > 0 && canvasWidth > 0) {
                  const fitW = availWidth / canvasWidth;
                  const clamped = Math.max(
                    0.3,
                    Math.min(1.6, Math.floor(fitW * 100) / 100)
                  );
                  setIsAutoZoom(false);
                  setZoom(clamped);
                }
              }
            }}
            className="p-1 rounded bg-[#111827] text-slate-200 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            title="Yatay Sığdır"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsAutoZoom(true);
              setTimeout(() => calculateEditorFitZoom(), 20);
            }}
            className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
            title="Dikey Sığdır"
          >
            <MoveVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full px-1.5 sm:px-2 py-1.5 space-y-1.5">
      {/* Feedback Toast */}
      {actionMsg && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 fixed top-14 right-4 z-50 shadow-xl">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Render Operator Toolbar directly inside sticky Header slot via Portal */}
      {headerSlot ? (
        createPortal(toolbarContent, headerSlot)
      ) : (
        <div className="bg-[#0F172A] p-1.5 sm:p-2 border border-slate-800 rounded-lg shadow-xl">
          {toolbarContent}
        </div>
      )}

      {/* SECTION 1: LIVE DRAG-AND-DROP POINT PAPER CANVAS */}
      <section
        ref={canvasCardRef}
        onPointerLeave={() => {
          setHoverInfo(null);
          draggingRef.current = null;
          setDraggingNode(null);
        }}
        className="bg-[#111827] border border-slate-800 rounded-lg relative"
      >

        {isNavMode && (
          <div className="px-2.5 py-1 bg-amber-950/80 border-b border-amber-700/70 text-[11px] font-semibold text-amber-200 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Hand className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Ölçek / Kaydır modu aktif: Çizim kilitli, parmakla kaydırıp yakınlaştırabilirsiniz.</span>
            </span>
            <button
              type="button"
              onClick={() => setIsNavMode(false)}
              className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold shrink-0 cursor-pointer"
            >
              Çizime Dön
            </button>
          </div>
        )}

        {/* Canvas Viewport */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) {
              e.preventDefault();
              setIsAutoZoom(false);
              const delta = e.deltaY < 0 ? 0.08 : -0.08;
              setZoom((z) => Math.max(0.35, Math.min(2.2, Math.round((z + delta) * 100) / 100)));
            }
          }}
          className={`p-0.5 bg-[#070b14] flex justify-center select-none touch-pan-x touch-pan-y ${
            isNavMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          } ${
            isFullscreen || isCanvasFullscreen
              ? 'overflow-x-auto overflow-y-visible h-auto max-h-none'
              : 'overflow-auto max-h-[46vh] sm:max-h-[380px]'
          }`}
        >
          <div
            style={{
              width: `${Math.round(canvasWidth * zoom)}px`,
              height: `${Math.round(canvasHeight * zoom)}px`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                transition: 'transform 0.1s ease-out',
              }}
            >
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClickCanvas}
                className={`rounded border border-slate-800/80 bg-[#080d1a] block ${
                  isNavMode ? 'touch-pan-x touch-pan-y cursor-grab' : 'touch-none cursor-pointer'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Clean Coordinates Tooltip */}
        {(draggingNode || hoverInfo) && hoverInfo?.x && hoverInfo?.y && (
          <div
            style={{
              position: 'fixed',
              left: `${hoverInfo.x}px`,
              top: `${hoverInfo.y - 60}px`,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
            className="z-50 bg-[#0F172A] border border-blue-500 rounded px-2 py-0.5 text-slate-100 flex items-center gap-1.5 select-none shadow-lg"
          >
            <span className="text-xs font-bold text-white font-mono">{activeGbId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono font-bold text-blue-400 tabular-nums">
              K{(draggingNode ? draggingNode.courseIdx : hoverInfo.courseIdx) + 1}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
              İ{draggingNode ? draggingNode.currentNeedle : hoverInfo.needle}
            </span>
          </div>
        )}

        {/* Movable & Resizable Persistent Fabric Surface Preview Window */}
        {isLivePreviewOpen && (
          <div
            style={{
              position: 'fixed',
              left: `${Math.max(8, Math.min(previewWindow.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - Math.min(previewWindow.width, 300)))}px`,
              top: `${Math.max(52, previewWindow.y)}px`,
              width: `${previewWindow.width}px`,
              maxWidth: 'calc(100vw - 16px)',
              height: `${previewWindow.height}px`,
              zIndex: 60,
            }}
            className="bg-[#0F172A]/95 border border-slate-700 shadow-2xl rounded-lg p-1.5 flex flex-col justify-between overflow-hidden select-none"
          >
            <div
              onPointerDown={handleStartDragPreview}
              className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800 pb-1 cursor-move select-none shrink-0 gap-1"
              title="Taşımak için sürükleyin"
            >
              <span className="flex items-center gap-1 shrink-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Önizleme</span>
              </span>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewRepeatX((prev) => (prev === 1 ? 2 : 1));
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    previewRepeatX === 2
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#111827] text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  Y:2x
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewRepeatY((prev) => (prev === 1 ? 2 : 1));
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    previewRepeatY === 2
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#111827] text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  D:2x
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsLivePreviewOpen(false)}
                className="text-slate-400 hover:text-white px-1 rounded transition-colors shrink-0 cursor-pointer"
                title="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 w-full overflow-hidden flex items-center justify-center my-0.5 bg-[#070b14] rounded border border-slate-800">
              <canvas
                ref={previewCanvasRef}
                width={Math.max(120, previewWindow.width - 12)}
                height={Math.max(70, previewWindow.height - 32)}
                className="rounded block"
              />
            </div>

            <div
              onPointerDown={handleStartResizePreview}
              className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 cursor-se-resize flex items-center justify-center text-slate-400 hover:text-blue-400 z-10"
              title="Boyutlandır"
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 14H12V12H14V14ZM14 10H12V8H14V10ZM10 14H8V12H10V14Z" />
              </svg>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: FORMAL PATTERN CODE TABLE WITH MERGED HEADER BAR */}
      <section
        ref={tableCardRef}
        className="bg-[#111827] border border-slate-800 rounded-lg p-1.5 sm:p-2 space-y-1.5"
      >
        {/* Single-Row Merged Table Header + Quick Code + Copy + Mirror + Controls */}
        <div className="flex flex-wrap items-center justify-between sm:justify-center gap-1.5 sm:gap-2 bg-[#0B0F17] px-2 py-1.5 sm:py-1 rounded border border-slate-800 text-xs">
          <div className="flex flex-wrap items-center justify-between sm:justify-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <span className="font-bold text-white whitespace-nowrap">
              Zincir ({rows.length}K):
            </span>

            {/* Quick Notation Input */}
            <div className="flex items-center gap-1 bg-[#111827] px-1.5 py-0.5 rounded border border-slate-800 flex-1 sm:flex-initial">
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap hidden xs:inline">
                Hızlı:
              </span>
              <select
                value={selectedGbForQuick}
                onChange={(e) => setSelectedGbForQuick(e.target.value as GuideBarId)}
                className="bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 text-xs font-bold text-white cursor-pointer"
              >
                {activeBars.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={quickInputText}
                onChange={(e) => setQuickInputText(e.target.value)}
                placeholder="1 0 1 2..."
                className="bg-[#0B0F17] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white font-mono w-full sm:w-36 focus:outline-none focus:border-blue-500 min-w-[70px]"
              />
              <button
                type="button"
                onClick={handleQuickNotationParse}
                className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer shrink-0"
                title="Hızlı Kodu Uygula"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Copy Single GB Chain Code to Target */}
            <div className="flex items-center gap-1 bg-[#111827] px-1.5 py-0.5 rounded border border-slate-800" title="Zincir Kopyala">
              <Copy className="w-3 h-3 text-blue-400 shrink-0" />
              <select
                value={copySourceGb}
                onChange={(e) => setCopySourceGb(e.target.value as GuideBarId)}
                className="bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 font-bold text-white text-xs cursor-pointer"
              >
                {activeBars.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <span className="text-slate-500 font-bold">→</span>
              <select
                value={copyTargetGb}
                onChange={(e) => setCopyTargetGb(e.target.value)}
                className="bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 font-bold text-white text-xs cursor-pointer"
              >
                <option value="ALL">Tümü</option>
                {activeBars.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCopyGbChainCode}
                className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors cursor-pointer"
                title="Zincir Kodunu Kopyala"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mirror Single Guide Bar Chain Code Vertically */}
            <div className="flex items-center gap-1 bg-[#111827] px-1.5 py-0.5 rounded border border-slate-800" title="Dikey Aynala">
              <FlipVertical className="w-3 h-3 text-emerald-400 shrink-0" />
              <select
                value={mirrorGbId}
                onChange={(e) => setMirrorGbId(e.target.value as GuideBarId)}
                className="bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 font-bold text-white text-xs cursor-pointer"
              >
                {activeBars.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleMirrorSingleGbChainCode}
                className="px-1.5 py-0.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                title="Seçili Tarağı Dikey Aynala"
              >
                Aynala
              </button>
            </div>

            {/* Table Reset */}
            <button
              type="button"
              onClick={resetRowsToSingle}
              className="px-2 py-0.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/80 rounded text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
              title="Tabloyu Sıfırla"
            >
              <Trash2 className="w-3 h-3" />
              <span>Sıfırla</span>
            </button>
          </div>
        </div>

        {/* High-Density Formal Data Grid */}
        <div className="overflow-x-auto max-h-[420px] rounded border border-slate-800 bg-[#0B0F17]">
          <table className="w-full text-left text-xs font-mono border-collapse tabular-nums">
            <thead className="bg-[#0F172A] sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-1.5 sm:px-2 text-slate-300 text-center w-12 sm:w-16 border-r border-slate-800 font-semibold">
                  Kurs
                </th>
                {activeBars.map((gbId) => {
                  const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                  const softBg = getSoftColorBg(gbColor, 0.14);
                  const metrics = guideBarCalculations[gbId];

                  return (
                    <th
                      key={gbId}
                      className="py-1.5 px-1.5 sm:px-2 text-center border-r border-slate-800 font-bold"
                      style={{
                        backgroundColor: softBg,
                        color: gbColor,
                        borderBottom: `2px solid ${gbColor}`,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5">
                        <div className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: gbColor }}
                          />
                          <span>{gbId}</span>
                        </div>
                        {metrics && (
                          <GuideBarCalcBadge metrics={metrics} compact={true} />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-1.5 px-1.5 sm:px-2 text-right text-slate-300 w-20 sm:w-24 font-semibold">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {rows.map((row, rIdx) => (
                <tr
                  key={row.id || rIdx}
                  draggable
                  onDragStart={(e) => {
                    setDraggedRowIndex(rIdx);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedRowIndex === null) return;
                    reorderRows(draggedRowIndex, rIdx);
                    setDraggedRowIndex(null);
                  }}
                  className={`hover:bg-slate-900/80 transition-colors select-none ${
                    draggedRowIndex === rIdx ? 'opacity-40 bg-blue-950/50' : ''
                  }`}
                >
                  <td
                    className="py-1 px-1 sm:px-1.5 text-center font-bold text-slate-200 border-r border-slate-800 bg-[#0F172A]/60 cursor-grab active:cursor-grabbing"
                    title="Sürükle"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <GripVertical className="w-3 h-3 text-slate-500 shrink-0 hidden sm:inline" />
                      <span>K{row.courseIndex}</span>
                    </div>
                  </td>

                  {activeBars.map((gbId) => {
                    const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                    const softBg = getSoftColorBg(gbColor, 0.04);
                    const val = row[gbId] ?? 0;
                    const isSkipped = row.skips?.[gbId] ?? false;

                    return (
                      <td
                        key={gbId}
                        className="py-1 px-1 sm:px-1.5 text-center border-r border-slate-800/60"
                        style={{ backgroundColor: softBg }}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleCellChange(rIdx, gbId, Math.max(0, val - 1))}
                            className="w-5 h-6 rounded bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                            title="-1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={needleCols - 1}
                            value={val}
                            onChange={(e) =>
                              handleCellChange(rIdx, gbId, parseInt(e.target.value, 10))
                            }
                            className="w-9 sm:w-11 h-6 bg-[#0B0F17] rounded text-center font-bold font-mono focus:outline-none text-xs border border-slate-700 focus:border-blue-500 tabular-nums"
                            style={{ color: gbColor }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleCellChange(rIdx, gbId, Math.min(needleCols - 1, val + 1))
                            }
                            className="w-5 h-6 rounded bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                            title="+1"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCellSkip(rIdx, gbId)}
                            className={`px-1 sm:px-1.5 h-6 rounded text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                              isSkipped
                                ? 'bg-rose-600 text-white border-rose-500'
                                : 'bg-[#111827] text-slate-400 border-slate-700 hover:text-white'
                            }`}
                            title={`K${row.courseIndex} ${gbId} Atlama`}
                          >
                            {isSkipped ? 'ATLAMA' : 'Atla'}
                          </button>
                        </div>
                      </td>
                    );
                  })}

                  <td className="py-1 px-1 sm:px-2 text-right">
                    <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                      <button
                        type="button"
                        onClick={() => insertRowAfter(rIdx)}
                        className="p-1 text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-800/60 border border-emerald-800/70 rounded transition-colors cursor-pointer"
                        title="Altına Satır Ekle"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => copyRow(row)}
                        className="p-1 text-slate-300 hover:text-white bg-[#111827] hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer"
                        title="Satırı Kopyala"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(rIdx)}
                        disabled={rows.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-400 bg-[#111827] hover:bg-slate-800 border border-slate-700 disabled:opacity-30 rounded transition-colors cursor-pointer"
                        title="Satırı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
