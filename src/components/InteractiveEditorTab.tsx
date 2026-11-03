import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PatternData, PatternRow, GuideBarId } from '../types';
import {
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Undo2,
  Redo2,
  Sliders,
  Table as TableIcon,
  Copy,
  ClipboardPaste,
  ShieldCheck,
  Check,
  CopyPlus,
  Maximize2,
  ShieldAlert,
  Wand2
} from 'lucide-react';
import { VisualLoopToolbar, LoopToolMode } from './VisualLoopToolbar';
import { QuickLoopPickerPopover } from './QuickLoopPickerPopover';
import { LoopGlyph } from './LoopGlyph';
import { analyzeCellLoop, autoFixInvalidRowCell, computeNeedleValueForLoop, LoopType } from '../utils/loopEngine';

interface InteractiveEditorTabProps {
  pattern: PatternData;
  onChangeRows: (rows: PatternRow[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSafetySettings: () => void;
}

const EDITOR_SETTINGS_KEY = 'warpknitt_editor_settings';

interface StoredEditorSettings {
  activeGbId?: GuideBarId;
  isLivePreviewOpen?: boolean;
  showLiveFabricCard?: boolean;
  selectedGbForQuick?: GuideBarId;
  isAutoZoom?: boolean;
  zoom?: number;
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
}) => {
  const savedEditorSettings = getInitialEditorSettings();

  const [activeGbId, setActiveGbId] = useState<GuideBarId>(
    savedEditorSettings.activeGbId || 'GB3'
  );
  const [activeToolMode, setActiveToolMode] = useState<LoopToolMode>('select');
  const [popover, setPopover] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    rowIndex: number;
    gbId: GuideBarId;
  } | null>(null);

  const canvasCardRef = useRef<HTMLDivElement | null>(null);
  const tableCardRef = useRef<HTMLDivElement | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [isTableFullscreen, setIsTableFullscreen] = useState(false);

  const toggleFullscreen = (ref: React.RefObject<HTMLDivElement | null>, isTable = false) => {
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

  // Dragging state
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

  // Touch pinch-to-zoom ref
  const touchDistRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveFabricCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const rows = pattern.rows;
  const needleCols = Math.max(16, Math.min(32, (pattern.safety?.maxAllowedNeedleNumber || 18) + 1));
  const needlePitch = 40;
  const coursePitch = 48;

  const activeBars = (Object.keys(pattern.guideBars) as GuideBarId[]).filter(
    (id) => pattern.guideBars[id].active
  );

  const startX = 65;
  const startY = 65;
  const canvasWidth = needleCols * needlePitch + 160;
  const canvasHeight = Math.max(480, rows.length * coursePitch + 120);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 2000);
  };

  // Fit to screen height auto calculation (*Sığdır dikey olmalı)
  const calculateEditorFitZoom = useCallback(() => {
    if (!isAutoZoom) return;
    const container = containerRef.current;
    if (!container) return;

    const availHeight = container.clientHeight > 0 ? container.clientHeight - 20 : 500;
    if (availHeight > 0 && canvasHeight > 0) {
      const fit = availHeight / canvasHeight;
      const clamped = Math.max(0.4, Math.min(1.5, Math.floor(fit * 100) / 100));
      setZoom(clamped);
    }
  }, [isAutoZoom, canvasHeight]);

  useEffect(() => {
    calculateEditorFitZoom();
  }, [calculateEditorFitZoom, needleCols]);

  useEffect(() => {
    if (!isAutoZoom) return;
    const handleResize = () => calculateEditorFitZoom();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAutoZoom, calculateEditorFitZoom]);

  // Save settings to localStorage
  useEffect(() => {
    const settingsToSave: StoredEditorSettings = {
      activeGbId,
      isLivePreviewOpen,
      showLiveFabricCard,
      selectedGbForQuick,
      isAutoZoom,
      zoom,
    };
    localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(settingsToSave));
  }, [
    activeGbId,
    isLivePreviewOpen,
    showLiveFabricCard,
    selectedGbForQuick,
    isAutoZoom,
    zoom,
  ]);

  // Touch Pinch-to-Zoom logic
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
        setZoom((prev) => Math.max(0.4, Math.min(2.2, prev + zoomFactor)));
        touchDistRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistRef.current = null;
  };

  const getNeedleFromClientX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const xInCanvas = (clientX - rect.left) * scaleX;
    const relativeX = xInCanvas - startX;
    const nearestNeedle = Math.round(relativeX / needlePitch);
    return Math.max(0, Math.min(needleCols - 1, nearestNeedle));
  }, [canvasRef, needleCols, needlePitch, startX]);

  const getCourseFromClientY = useCallback((clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const yInCanvas = (clientY - rect.top) * scaleY;
    const relativeY = yInCanvas - startY;
    const nearestCourse = Math.floor(relativeY / coursePitch);
    return Math.max(0, Math.min(rows.length - 1, nearestCourse));
  }, [canvasRef, coursePitch, rows.length, startY]);

  // Color helper for column soft tints
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

  // Draw Point Paper Grid & Guide Bars
  const drawEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentDrag = draggingRef.current || draggingNode;

    // 1. Needles Header & Vertical Wale Lines
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';

    for (let n = 0; n < needleCols; n++) {
      const nx = startX + n * needlePitch;
      const isHovered = (currentDrag && currentDrag.currentNeedle === n) || (hoverInfo && hoverInfo.needle === n);

      ctx.fillStyle = isHovered ? '#38bdf8' : '#64748b';
      ctx.fillText(`İ${n}`, nx, startY - 20);

      ctx.strokeStyle = isHovered ? '#0284c7' : '#1e293b';
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(nx, startY - 8);
      ctx.lineTo(nx, startY + rows.length * coursePitch + 10);
      ctx.stroke();
    }

    // 2. Course Lines
    for (let c = 0; c <= rows.length; c++) {
      const cy = startY + c * coursePitch;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX - 15, cy);
      ctx.lineTo(startX + (needleCols - 1) * needlePitch + 15, cy);
      ctx.stroke();

      if (c < rows.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`K${c + 1}`, startX - 22, cy + coursePitch / 2 + 4);
      }
    }

    // 3. Trick Points
    for (let c = 0; c < rows.length; c++) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      for (let n = 0; n < needleCols; n++) {
        const nx = startX + n * needlePitch;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(nx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Guide Bar Paths
    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      const isSelected = activeGbId === gbId;

      ctx.strokeStyle = gb.color;
      ctx.lineWidth = isSelected ? 3.5 : 1.5;
      ctx.globalAlpha = isSelected ? 1 : 0.4;

      ctx.beginPath();
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
          needleVal = currentDrag.currentNeedle;
        }

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;

        if (rIdx === 0) ctx.moveTo(px, py);
        else {
          const prevRow = rows[rIdx - 1];
          let prevVal = prevRow[gbId] || 0;
          if (currentDrag && currentDrag.courseIdx === rIdx - 1 && currentDrag.gbId === gbId) {
            prevVal = currentDrag.currentNeedle;
          }
          const prevX = startX + prevVal * needlePitch;
          const prevY = startY + (rIdx - 1) * coursePitch + coursePitch / 2;
          const cpY = (prevY + py) / 2;
          ctx.bezierCurveTo(prevX, cpY, px, cpY, px, py);
        }
      });
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Nodes
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        const isDraggingThis = currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId;
        if (isDraggingThis) needleVal = currentDrag.currentNeedle;

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;

        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 8 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = gb.color;
        ctx.fill();
        ctx.strokeStyle = isDraggingThis ? '#38bdf8' : '#ffffff';
        ctx.lineWidth = isDraggingThis ? 2.5 : 1;
        ctx.stroke();
      });
    });

  }, [rows, activeBars, activeGbId, draggingNode, needleCols, coursePitch, needlePitch, startX, startY, hoverInfo]);

  // Preview Canvas
  const drawPreviewCanvas = useCallback(() => {
    if (!isLivePreviewOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const prevStartX = 15;
    const prevStartY = 20;
    const prevPitchX = Math.min(16, (canvas.width - 30) / needleCols);
    const prevPitchY = Math.min(18, (canvas.height - 30) / rows.length);
    const currentDrag = draggingRef.current || draggingNode;

    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      ctx.strokeStyle = gb.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
          needleVal = currentDrag.currentNeedle;
        }
        const px = prevStartX + needleVal * prevPitchX;
        const py = prevStartY + rIdx * prevPitchY;
        if (rIdx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });
  }, [rows, activeBars, draggingNode, isLivePreviewOpen, needleCols]);

  // Live Fabric Simulation Canvas Draw (INSTANT REAL-TIME REFLECTION WHILE DRAGGING)
  const drawLiveFabricCanvas = useCallback(() => {
    if (!showLiveFabricCard) return;
    const canvas = liveFabricCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#0a0f1e');
    bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fabStartX = 40;
    const fabStartY = 35;
    const fabPitchX = Math.min(28, (canvas.width - 80) / needleCols);
    const fabPitchY = Math.min(28, (canvas.height - 60) / Math.max(1, rows.length * 2));
    const currentDrag = draggingRef.current || draggingNode;

    // Draw active guide bar loops
    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      if (!gb) return;

      const threadingArr = gb.threadingArray || Array.from({ length: needleCols }, (_, i) => i % 2 === 0);

      for (let g = 0; g < needleCols; g++) {
        if (!threadingArr[g]) continue; // Boş ise iplik yok

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
                if (currentDrag && currentDrag.courseIdx === (rIdx === 0 ? rows.length - 1 : rIdx - 1) && currentDrag.gbId === gbId) {
                  prevShift = currentDrag.currentNeedle;
                }
                const prevNeedle = g + prevShift;
                const prevX = fabStartX + prevNeedle * fabPitchX;
                const prevY = fabStartY + (c - 1) * fabPitchY;

                ctx.save();
                ctx.strokeStyle = gb.color;
                ctx.lineWidth = 3.5;
                ctx.lineCap = 'round';
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.moveTo(prevX, prevY);
                ctx.quadraticCurveTo((prevX + x) / 2, (prevY + y) / 2, x, y);
                ctx.stroke();
                ctx.restore();
              }

              ctx.save();
              ctx.fillStyle = gb.color;
              ctx.shadowColor = gb.color;
              ctx.shadowBlur = 6;
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });
        }
      }
    });
  }, [rows, activeBars, draggingNode, showLiveFabricCard, needleCols, pattern.guideBars]);

  useEffect(() => {
    drawEditorCanvas();
    drawPreviewCanvas();
    drawLiveFabricCanvas();
  }, [drawEditorCanvas, drawPreviewCanvas, drawLiveFabricCanvas]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const courseIdx = getCourseFromClientY(e.clientY);
    const targetNeedle = getNeedleFromClientX(e.clientX);

    const node = { courseIdx, gbId: activeGbId, currentNeedle: targetNeedle };
    draggingRef.current = node;
    setDraggingNode(node);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const updated = rows.map((r, idx) => (idx === courseIdx ? { ...r, [activeGbId]: targetNeedle } : r));
    onChangeRows(updated);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const courseIdx = getCourseFromClientY(e.clientY);
    const needle = getNeedleFromClientX(e.clientX);
    setHoverInfo({ courseIdx, needle, x: e.clientX, y: e.clientY });

    if (!draggingRef.current) return;
    if (needle !== draggingRef.current.currentNeedle) {
      draggingRef.current.currentNeedle = needle;
      setDraggingNode({ ...draggingRef.current });
      const dragCourse = draggingRef.current.courseIdx;
      const dragGb = draggingRef.current.gbId;
      const updated = rows.map((r, idx) => (idx === dragCourse ? { ...r, [dragGb]: needle } : r));
      onChangeRows(updated);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}

    const drag = draggingRef.current || draggingNode;
    if (drag) {
      const { courseIdx, gbId, currentNeedle } = drag;
      const updated = rows.map((r, idx) => (idx === courseIdx ? { ...r, [gbId]: currentNeedle } : r));
      onChangeRows(updated);
    }
    draggingRef.current = null;
    setDraggingNode(null);
  };

  // Actions
  const addRow = () => {
    const lastRow = rows[rows.length - 1] || { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
    const newRow: PatternRow = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      courseIndex: rows.length + 1,
      GB1: lastRow.GB1,
      GB2: lastRow.GB2,
      GB3: lastRow.GB3,
      GB4: lastRow.GB4,
      GB5: lastRow.GB5,
      GB6: lastRow.GB6,
    };
    onChangeRows([...rows, newRow]);
    showMsg('Yeni satır eklendi.');
  };

  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    const updated = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, courseIndex: i + 1 }));
    onChangeRows(updated);
    showMsg('Satır silindi.');
  };

  const copyRow = (row: PatternRow) => {
    setCopiedRow(row);
    showMsg(`K${row.courseIndex} kopyalandı.`);
  };

  const pasteRow = () => {
    if (!copiedRow) return;
    const newRow: PatternRow = {
      ...copiedRow,
      id: 'paste-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      courseIndex: rows.length + 1,
    };
    onChangeRows([...rows, newRow]);
    showMsg('Satır yapıştırıldı.');
  };

  const duplicatePattern = () => {
    const duplicated = [...rows, ...rows].map((r, idx) => ({
      ...r,
      id: 'dup-' + idx + '-' + Date.now(),
      courseIndex: idx + 1,
    }));
    onChangeRows(duplicated);
    showMsg('Desen 2x çoğaltıldı.');
  };

  const mirrorPattern = () => {
    const reversed = [...rows].reverse().map((r, idx) => ({
      ...r,
      id: 'mir-' + idx + '-' + Date.now(),
      courseIndex: rows.length + idx + 1,
    }));
    onChangeRows([...rows, ...reversed]);
    showMsg('Desen aynalandı.');
  };

  const resetRowsToSingle = () => {
    const firstRow = rows[0] || { id: 'r1', courseIndex: 1, GB1: 0, GB2: 0, GB3: 1, GB4: 0, GB5: 2, GB6: 0 };
    onChangeRows([{ ...firstRow, courseIndex: 1 }]);
    showMsg('Tek satıra sıfırlandı.');
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
    showMsg('Notasyon uygulandı.');
  };

  // Loop Helper Handlers
  const handleApplyLoopChange = (
    rIdx: number,
    gbId: GuideBarId,
    newNeedleVal: number,
    loopType: LoopType
  ) => {
    const updated = [...rows];
    updated[rIdx] = {
      ...updated[rIdx],
      [gbId]: newNeedleVal,
      loopTypes: {
        ...(updated[rIdx].loopTypes || {}),
        [gbId]: loopType,
      },
    };
    onChangeRows(updated);
    showMsg(`K${rIdx + 1} ${gbId} ilmeği [${loopType.toUpperCase()}] olarak güncellendi.`);
  };

  const handleAutoFixCell = (rIdx: number, gbId: GuideBarId) => {
    const updated = [...rows];
    const prevRow = rIdx > 0 ? updated[rIdx - 1] : null;
    updated[rIdx] = autoFixInvalidRowCell(
      updated[rIdx],
      prevRow,
      gbId,
      pattern.safety,
      needleCols
    );
    onChangeRows(updated);
    showMsg(`K${rIdx + 1} ${gbId} ilmeği otomatik düzeltildi.`);
  };

  const handleCellClickWithTool = (rIdx: number, gbId: GuideBarId) => {
    if (activeToolMode === 'select') return;

    const prevRow = rIdx > 0 ? rows[rIdx - 1] : null;
    const nextRow = rIdx < rows.length - 1 ? rows[rIdx + 1] : null;
    const currentInfo = analyzeCellLoop(rows[rIdx], prevRow, nextRow, gbId, pattern.safety, needleCols);

    let targetType: LoopType = 'open';
    if (activeToolMode === 'cycle_pen') {
      const cycleMap: Record<LoopType, LoopType> = {
        open: 'closed',
        closed: 'miss',
        miss: 'tuck',
        tuck: 'open',
      };
      targetType = cycleMap[currentInfo.type] || 'open';
    } else if (activeToolMode === 'open_stamp') targetType = 'open';
    else if (activeToolMode === 'closed_stamp') targetType = 'closed';
    else if (activeToolMode === 'miss_stamp') targetType = 'miss';
    else if (activeToolMode === 'tuck_stamp') targetType = 'tuck';

    const prevVal = prevRow ? (prevRow[gbId] ?? (rows[rIdx][gbId] ?? 0)) : (rows[rIdx][gbId] ?? 0);
    const newNeedle = computeNeedleValueForLoop(
      prevVal,
      targetType,
      currentInfo.underlapSpan || 1,
      needleCols,
      pattern.safety?.maxAllowedNeedleNumber || 4
    );

    handleApplyLoopChange(rIdx, gbId, newNeedle, targetType);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2.5 space-y-3">
      {/* Toast Notification */}
      {actionMsg && (
        <div className="bg-emerald-950/90 border border-emerald-800 text-emerald-200 px-3.5 py-1.5 rounded-xl text-xs flex items-center space-x-2 shadow-lg sticky top-14 z-40">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Top Sticky Quick Toolbar */}
      <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-xl p-2 sticky top-13 z-30 shadow-lg flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={addRow}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shrink-0 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Satır</span>
          </button>

          {copiedRow && (
            <button
              onClick={pasteRow}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Yapıştır</span>
            </button>
          )}

          <button
            onClick={duplicatePattern}
            className="px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition shrink-0"
          >
            2x Çoğalt
          </button>

          <button
            onClick={mirrorPattern}
            className="px-2 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition shrink-0"
          >
            Aynala
          </button>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-auto">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:bg-slate-800 transition"
            title="Geri Al"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:bg-slate-800 transition"
            title="Yinele"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onOpenSafetySettings}
            className="p-1.5 bg-amber-950/40 border border-amber-800/60 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-900/40 transition flex items-center space-x-1"
            title="Güvenlik"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Point Paper Drag Canvas */}
      <div
        ref={canvasCardRef}
        onPointerLeave={() => {
          setHoverInfo(null);
          draggingRef.current = null;
          setDraggingNode(null);
        }}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden relative"
      >
        <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-1.5 shrink-0">
            <Sliders className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-bold text-white">Canlı Sürükle-Bırak</span>
          </div>

          {/* Guide Bar Selector */}
          <div className="flex items-center space-x-1 shrink-0">
            {activeBars.map((gbId) => {
              const gb = pattern.guideBars[gbId];
              const isSelected = activeGbId === gbId;
              return (
                <button
                  key={gbId}
                  onClick={() => setActiveGbId(gbId)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition shrink-0 ${
                    isSelected ? 'text-white border-transparent shadow' : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                  style={{ backgroundColor: isSelected ? gb.color : undefined }}
                >
                  {gbId}
                </button>
              );
            })}
          </div>

          {/* Right Tools: Fullscreen & Touch Zoom Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => toggleFullscreen(canvasCardRef, false)}
              className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded text-[10px] font-medium transition flex items-center space-x-1"
              title="Tam Ekran"
            >
              <Maximize2 className="w-3 h-3 text-blue-400" />
              <span>{isCanvasFullscreen ? 'Normal' : 'Tam Ekran'}</span>
            </button>

            <div className="flex items-center space-x-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => {
                  setIsAutoZoom(false);
                  setZoom((z) => Math.max(0.4, Math.round((z - 0.15) * 100) / 100));
                }}
                className="text-slate-400 hover:text-white p-1 active:scale-90"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-300 min-w-[32px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => {
                  setIsAutoZoom(false);
                  setZoom((z) => Math.min(2.2, Math.round((z + 0.15) * 100) / 100));
                }}
                className="text-slate-400 hover:text-white p-1 active:scale-90"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsAutoZoom(true);
                  setTimeout(() => calculateEditorFitZoom(), 20);
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition flex items-center space-x-1 ${
                  isAutoZoom
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title="Ekrana Tam Sığdır (*Dikey)"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Sığdır</span>
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Area with Touch Pinch-to-Zoom */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="p-2 overflow-auto max-h-[420px] bg-[#070b14] flex justify-center cursor-crosshair select-none touch-pan-x touch-pan-y"
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
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
              className="rounded-xl border border-slate-800 shadow-2xl bg-[#080d1a] touch-none cursor-pointer"
            />
          </div>
        </div>

        {/* Floating Tooltip HUD on Drag & Touch (Smaller, further away, single) */}
        {(draggingNode || hoverInfo) && hoverInfo?.x && hoverInfo?.y && (
          <div
            style={{
              position: 'fixed',
              left: `${hoverInfo.x}px`,
              top: `${hoverInfo.y - 78}px`,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
            }}
            className="z-50 bg-slate-950/90 backdrop-blur-md border border-blue-500/80 shadow-2xl rounded-lg px-2 py-0.5 text-slate-100 flex items-center space-x-1.5 animate-in fade-in zoom-in-95 duration-75 select-none"
          >
            <div className="flex items-center space-x-1 shrink-0">
              <span
                className="w-2 h-2 rounded-full animate-ping shrink-0"
                style={{ backgroundColor: pattern.guideBars[activeGbId]?.color || '#38bdf8' }}
              />
              <span className="text-[10px] font-bold text-white font-mono">
                {activeGbId}
              </span>
            </div>

            <div className="h-3 w-px bg-slate-800 shrink-0" />

            <div className="text-[10px] font-mono font-bold flex items-center space-x-1.5 shrink-0">
              <span className="text-blue-400">
                Adım {rows[draggingNode ? draggingNode.courseIdx : hoverInfo.courseIdx]?.stepIndex ?? ((draggingNode ? draggingNode.courseIdx : hoverInfo.courseIdx) + 1)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400">
                İğne İ{(draggingNode ? draggingNode.currentNeedle : hoverInfo.needle)}
              </span>
            </div>
          </div>
        )}

        {/* Floating Mini Preview Widget (Borderless, slightly larger) */}
        {isLivePreviewOpen && (
          <div className="hidden md:block absolute bottom-2 right-2 w-52 bg-slate-950/95 backdrop-blur shadow-2xl rounded-xl p-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-white border-b border-slate-800/80 pb-0.5">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Önizleme</span>
              </span>
              <button onClick={() => setIsLivePreviewOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <canvas ref={previewCanvasRef} width={205} height={120} className="rounded-lg bg-[#0a0f1e]" />
          </div>
        )}
      </div>

      {/* INSTANT LIVE FABRIC SIMULATION CARD */}
      {showLiveFabricCard && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-white">Anlık Canlı Kumaş Simülasyonu</span>
            </div>
            <button
              onClick={() => setShowLiveFabricCard(false)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Gizle
            </button>
          </div>

          <div className="p-2 overflow-auto bg-[#05070d] rounded-xl flex justify-center border border-slate-800">
            <canvas
              ref={liveFabricCanvasRef}
              width={canvasWidth - 80}
              height={220}
              className="rounded-lg bg-[#0a0f1e]"
            />
          </div>
        </div>
      )}

      {/* VISUAL LOOP TOOLBAR (İlmek Çizici & Sihirbazı Modu Toolbar) */}
      <VisualLoopToolbar
        activeToolMode={activeToolMode}
        onSelectToolMode={setActiveToolMode}
        activeGbId={activeGbId}
        activeBars={activeBars}
        rows={rows}
        safety={pattern.safety}
        needleCols={needleCols}
        onApplyMassTransform={(newRows, msg) => {
          onChangeRows(newRows);
          showMsg(msg);
        }}
      />

      {/* Pattern Code Table & Chain Grid - CELL-LEVEL LOOP GLYPHS & INLINE EDITING */}
      <div ref={tableCardRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 space-y-2.5 shadow-lg">
        {/* Table Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Desen Kod Tablosu & İlmek Yapısı ({rows.length} Kurs)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => toggleFullscreen(tableCardRef, true)}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition flex items-center space-x-1"
              title="Tam Ekran"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{isTableFullscreen ? 'Normal' : 'Tam Ekran'}</span>
            </button>
            <button
              onClick={addRow}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Satır</span>
            </button>
            <button
              onClick={duplicatePattern}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              2x
            </button>
            <button
              onClick={mirrorPattern}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Aynala
            </button>
            <button
              onClick={resetRowsToSingle}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-900/60 rounded-lg text-xs transition"
            >
              Temizle
            </button>
          </div>
        </div>

        {/* Quick Input Bar */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-medium shrink-0">Kod:</span>
          <select
            value={selectedGbForQuick}
            onChange={(e) => setSelectedGbForQuick(e.target.value as GuideBarId)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-slate-200 shrink-0"
            style={{ color: pattern.guideBars[selectedGbForQuick]?.color }}
          >
            {activeBars.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <input
            type="text"
            value={quickInputText}
            onChange={(e) => setQuickInputText(e.target.value)}
            placeholder="1-0 1-2 2-1"
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 font-mono flex-1 min-w-[100px]"
          />
          <button
            onClick={handleQuickNotationParse}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shrink-0"
          >
            Ekle
          </button>
        </div>

        {/* COLOR CODED TABLE VIEWPORT WITH CELL-LEVEL GLYPHS */}
        <div className="overflow-x-auto max-h-[420px] rounded-xl border border-slate-800 bg-[#070b14] scrollbar-thin">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5 text-slate-400 text-center w-14 border-r border-slate-800/60">
                  Kurs
                </th>
                {activeBars.map((gbId) => {
                  const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                  const softBg = getSoftColorBg(gbColor, 0.18);
                  return (
                    <th
                      key={gbId}
                      className="py-2 px-2 text-center border-r border-slate-800/60 font-bold"
                      style={{
                        backgroundColor: softBg,
                        color: gbColor,
                        borderBottom: `2.5px solid ${gbColor}`,
                      }}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: gbColor }} />
                        <span>{gbId}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="py-2 px-2.5 text-right text-slate-400 w-16">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-800/30 transition">
                  <td className="py-1.5 px-2 text-center font-bold text-slate-300 border-r border-slate-800/60 bg-slate-950/40">
                    K{row.courseIndex}
                  </td>
                  {activeBars.map((gbId) => {
                    const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                    const softBg = getSoftColorBg(gbColor, 0.05);
                    const val = row[gbId] ?? 0;
                    const prevRow = rIdx > 0 ? rows[rIdx - 1] : null;
                    const nextRow = rIdx < rows.length - 1 ? rows[rIdx + 1] : null;

                    const loopInfo = analyzeCellLoop(row, prevRow, nextRow, gbId, pattern.safety, needleCols);

                    return (
                      <td
                        key={gbId}
                        className={`py-1.5 px-1 text-center border-r border-slate-800/50 relative group transition-all cursor-pointer ${
                          !loopInfo.isValid ? 'bg-rose-950/40 ring-2 ring-rose-500/80 rounded-lg' : ''
                        }`}
                        style={{ backgroundColor: loopInfo.isValid ? softBg : undefined }}
                        onClick={() => handleCellClickWithTool(rIdx, gbId)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setPopover({
                            isOpen: true,
                            position: { x: e.clientX, y: e.clientY },
                            rowIndex: rIdx,
                            gbId,
                          });
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          setPopover({
                            isOpen: true,
                            position: { x: e.clientX, y: e.clientY },
                            rowIndex: rIdx,
                            gbId,
                          });
                        }}
                        title={
                          !loopInfo.isValid
                            ? loopInfo.invalidReason || 'Geçersiz İlmek Hareketi'
                            : `Sağ Tık / Çift Dokun: İlmek menüsü (${loopInfo.label})`
                        }
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <input
                            type="number"
                            min={0}
                            max={needleCols - 1}
                            value={val}
                            onChange={(e) => handleCellChange(rIdx, gbId, parseInt(e.target.value, 10))}
                            className={`w-11 sm:w-13 h-7 bg-slate-950 rounded-lg text-center font-bold font-mono focus:outline-none transition shadow-inner text-xs ${
                              !loopInfo.isValid ? 'border-2 border-rose-500 text-rose-300' : ''
                            }`}
                            style={{
                              color: loopInfo.isValid ? gbColor : undefined,
                              borderColor: loopInfo.isValid ? getSoftColorBg(gbColor, 0.5) : undefined,
                              borderWidth: '1.5px',
                            }}
                          />

                          {/* Mini İlmek Simgesi (Glyph) & Badgesi */}
                          <LoopGlyph type={loopInfo.type} direction={loopInfo.direction} size="sm" />

                          {/* Warning Badge & Auto-Fix Trigger if Invalid */}
                          {!loopInfo.isValid && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoFixCell(rIdx, gbId);
                              }}
                              className="p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[9px] font-bold shrink-0 shadow animate-pulse"
                              title="Tıkla: En Yakın Geçerli İlmeğe Otomatik Düzelt"
                            >
                              Fix
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => copyRow(row)}
                        className="p-1 text-slate-400 hover:text-blue-400 rounded transition"
                        title="Kopyala"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteRow(rIdx)}
                        disabled={rows.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded transition"
                        title="Sil"
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

        {/* BOTTOM QUICK ADD BAR */}
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
          <button
            onClick={addRow}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Yeni Satır Ekle (K{rows.length + 1})</span>
          </button>

          {copiedRow && (
            <button
              onClick={pasteRow}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Yapıştır</span>
            </button>
          )}

          <div className="text-xs text-slate-400 font-mono ml-auto">
            Toplam {rows.length} Kurs
          </div>
        </div>
      </div>

      {/* QUICK LOOP PICKER POPOVER */}
      {popover?.isOpen && rows[popover.rowIndex] && (
        <QuickLoopPickerPopover
          isOpen={popover.isOpen}
          onClose={() => setPopover(null)}
          position={popover.position}
          rowIndex={popover.rowIndex}
          row={rows[popover.rowIndex]}
          prevRow={popover.rowIndex > 0 ? rows[popover.rowIndex - 1] : null}
          nextRow={popover.rowIndex < rows.length - 1 ? rows[popover.rowIndex + 1] : null}
          gbId={popover.gbId}
          safety={pattern.safety}
          needleCols={needleCols}
          onApplyLoopChange={handleApplyLoopChange}
          onAutoFix={handleAutoFixCell}
        />
      )}
    </div>
  );
};
