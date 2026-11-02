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
  CopyPlus
} from 'lucide-react';

interface InteractiveEditorTabProps {
  pattern: PatternData;
  onChangeRows: (rows: PatternRow[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenSafetySettings: () => void;
}

export const InteractiveEditorTab: React.FC<InteractiveEditorTabProps> = ({
  pattern,
  onChangeRows,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenSafetySettings,
}) => {
  const [activeGbId, setActiveGbId] = useState<GuideBarId>('GB3');
  const [zoom, setZoom] = useState<number>(1);
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(true);
  const [quickInputText, setQuickInputText] = useState('');
  const [selectedGbForQuick, setSelectedGbForQuick] = useState<GuideBarId>('GB3');
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    drawEditorCanvas();
    drawPreviewCanvas();
  }, [drawEditorCanvas, drawPreviewCanvas]);

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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden relative">
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

          {/* Zoom */}
          <div className="flex items-center space-x-1 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 shrink-0">
            <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))} className="text-slate-400 hover:text-white p-0.5">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-300 min-w-[28px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))} className="text-slate-400 hover:text-white p-0.5">
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="p-2 overflow-auto max-h-[420px] bg-[#070b14] flex justify-center cursor-crosshair select-none">
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

        {/* Floating Mini Preview Widget */}
        {isLivePreviewOpen && (
          <div className="hidden md:block absolute bottom-2 right-2 w-44 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl shadow-xl p-1.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-white border-b border-slate-800 pb-0.5">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Önizleme</span>
              </span>
              <button onClick={() => setIsLivePreviewOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <canvas ref={previewCanvasRef} width={160} height={90} className="rounded-lg border border-slate-800 bg-[#0a0f1e]" />
          </div>
        )}
      </div>

      {/* Pattern Code Table & Chain Grid - DISTINCTLY COLOR CODED COLUMNS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 space-y-2.5 shadow-lg">
        {/* Table Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-white">Desen Kod Tablosu ({rows.length} Kurs)</h3>
          </div>

          <div className="flex flex-wrap items-center gap-1">
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

        {/* COLOR CODED TABLE VIEWPORT */}
        <div className="overflow-x-auto max-h-[380px] rounded-xl border border-slate-800 bg-[#070b14] scrollbar-thin">
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
                    return (
                      <td
                        key={gbId}
                        className="py-1.5 px-1.5 text-center border-r border-slate-800/50"
                        style={{ backgroundColor: softBg }}
                      >
                        <input
                          type="number"
                          min={0}
                          max={needleCols - 1}
                          value={val}
                          onChange={(e) => handleCellChange(rIdx, gbId, parseInt(e.target.value, 10))}
                          className="w-13 sm:w-16 h-8 bg-slate-950 rounded-lg text-center font-bold font-mono focus:outline-none transition shadow-inner"
                          style={{
                            color: gbColor,
                            borderColor: getSoftColorBg(gbColor, 0.5),
                            borderWidth: '1.5px',
                          }}
                        />
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
    </div>
  );
};
