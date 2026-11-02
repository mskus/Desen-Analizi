import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PatternData, PatternRow, GuideBarId } from '../types';
import {
  Move,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Layers,
  Undo2,
  Redo2,
  Sliders,
  MousePointer,
  HelpCircle,
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

  // Dragging state (both ref for instant mouse/touch sync and state for react re-renders)
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

  // Desktop hover tracking
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
  const needlePitch = 42;
  const coursePitch = 50;

  const activeBars = (Object.keys(pattern.guideBars) as GuideBarId[]).filter(
    (id) => pattern.guideBars[id].active
  );

  const startX = 75;
  const startY = 75;
  const canvasWidth = needleCols * needlePitch + 180;
  const canvasHeight = Math.max(520, rows.length * coursePitch + 130);

  // Coordinate conversion helper: Canvas X -> Nearest Needle Index
  // Uses exact bounding box ratios to work seamlessly on desktop mouse, trackpad, and mobile touch
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

  // Draw the interactive Point Paper grid & nodes
  const drawEditorCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark grid background
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const currentDrag = draggingRef.current || draggingNode;

    // 1. Draw Vertical Needle Wale Lines (İ0 to İN)
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';

    for (let n = 0; n < needleCols; n++) {
      const nx = startX + n * needlePitch;
      const isHoveredNeedle =
        (currentDrag && currentDrag.currentNeedle === n) ||
        (hoverInfo && hoverInfo.needle === n);

      // Needle header label
      ctx.fillStyle = isHoveredNeedle ? '#38bdf8' : '#64748b';
      ctx.fillText(`İ${n}`, nx, startY - 25);

      // Vertical line
      ctx.strokeStyle = isHoveredNeedle ? '#0284c7' : '#1e293b';
      ctx.lineWidth = isHoveredNeedle ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(nx, startY - 10);
      ctx.lineTo(nx, startY + rows.length * coursePitch + 10);
      ctx.stroke();
    }

    // 2. Draw Horizontal Course Lines & Labels (Kurs 1 to Kurs N)
    for (let c = 0; c <= rows.length; c++) {
      const cy = startY + c * coursePitch;
      const isHoveredCourse =
        (currentDrag && currentDrag.courseIdx === c) ||
        (hoverInfo && hoverInfo.courseIdx === c);

      ctx.strokeStyle = isHoveredCourse ? '#334155' : '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX - 20, cy);
      ctx.lineTo(startX + (needleCols - 1) * needlePitch + 20, cy);
      ctx.stroke();

      if (c < rows.length) {
        ctx.fillStyle = isHoveredCourse ? '#38bdf8' : '#94a3b8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`K${c + 1}`, startX - 25, cy + coursePitch / 2 + 4);
      }
    }

    // 3. Draw Needle Trick Points (Pins)
    for (let c = 0; c < rows.length; c++) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      for (let n = 0; n < needleCols; n++) {
        const nx = startX + n * needlePitch;
        const isHoveredPin =
          hoverInfo && hoverInfo.courseIdx === c && hoverInfo.needle === n;

        ctx.fillStyle = isHoveredPin ? '#38bdf8' : '#1e293b';
        ctx.beginPath();
        ctx.arc(nx, cy, isHoveredPin ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Draw Guide Bar Paths
    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      const isSelectedGb = activeGbId === gbId;

      ctx.strokeStyle = gb.color;
      ctx.lineWidth = isSelectedGb ? 3.5 : 1.5;
      ctx.globalAlpha = isSelectedGb ? 1 : 0.45;

      ctx.beginPath();
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        if (currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId) {
          needleVal = currentDrag.currentNeedle;
        }

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;

        if (rIdx === 0) {
          ctx.moveTo(px, py);
        } else {
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

      // 5. Draw Draggable Interactive Nodes
      rows.forEach((row, rIdx) => {
        let needleVal = row[gbId] || 0;
        const isDraggingThis =
          currentDrag && currentDrag.courseIdx === rIdx && currentDrag.gbId === gbId;

        if (isDraggingThis) {
          needleVal = currentDrag.currentNeedle;
        }

        const px = startX + needleVal * needlePitch;
        const py = startY + rIdx * coursePitch + coursePitch / 2;

        // Node Circle with outer ring
        ctx.beginPath();
        ctx.arc(px, py, isSelectedGb ? 9 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = gb.color;
        ctx.fill();
        ctx.strokeStyle = isDraggingThis ? '#38bdf8' : '#ffffff';
        ctx.lineWidth = isDraggingThis ? 3 : 1.5;
        ctx.stroke();

        // Shogging step text annotation next to selected guide bar
        if (isSelectedGb && rIdx > 0) {
          const prevRow = rows[rIdx - 1];
          let prevVal = prevRow[gbId] || 0;
          if (currentDrag && currentDrag.courseIdx === rIdx - 1 && currentDrag.gbId === gbId) {
            prevVal = currentDrag.currentNeedle;
          }
          const stepDiff = needleVal - prevVal;
          const stepText = stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`Δ:${stepText}`, px + 14, py - 6);
        }
      });
    });

    // 6. Hover guide overlay for desktop
    if (hoverInfo && !currentDrag) {
      const hx = startX + hoverInfo.needle * needlePitch;
      const hy = startY + hoverInfo.courseIdx * coursePitch + coursePitch / 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(hx, hy, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [rows, activeBars, activeGbId, draggingNode, needleCols, coursePitch, needlePitch, startX, startY, hoverInfo]);

  // Draw Real-time Live Preview Canvas
  const drawPreviewCanvas = useCallback(() => {
    if (!isLivePreviewOpen) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const prevStartX = 20;
    const prevStartY = 25;
    const prevPitchX = Math.min(18, (canvas.width - 40) / needleCols);
    const prevPitchY = Math.min(22, (canvas.height - 40) / rows.length);

    const currentDrag = draggingRef.current || draggingNode;

    // Draw live fabric loops
    activeBars.forEach((gbId) => {
      const gb = pattern.guideBars[gbId];
      ctx.strokeStyle = gb.color;
      ctx.lineWidth = 2.5;

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

        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      });
      ctx.stroke();
    });
  }, [rows, activeBars, draggingNode, isLivePreviewOpen, needleCols]);

  useEffect(() => {
    drawEditorCanvas();
    drawPreviewCanvas();
  }, [drawEditorCanvas, drawPreviewCanvas]);

  // Unified Mouse & Touch Pointer Handlers for Desktop PC & Mobile
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const courseIdx = getCourseFromClientY(e.clientY);
    const targetNeedle = getNeedleFromClientX(e.clientX);

    const node = {
      courseIdx,
      gbId: activeGbId,
      currentNeedle: targetNeedle,
    };

    draggingRef.current = node;
    setDraggingNode(node);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if pointer capture isn't supported in current context
    }

    // Direct click update: If clicked on a course row, immediately update that course!
    const updated = rows.map((r, idx) =>
      idx === courseIdx ? { ...r, [activeGbId]: targetNeedle } : r
    );
    onChangeRows(updated);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const courseIdx = getCourseFromClientY(e.clientY);
    const needle = getNeedleFromClientX(e.clientX);

    setHoverInfo({
      courseIdx,
      needle,
      x: e.clientX,
      y: e.clientY,
    });

    if (!draggingRef.current) return;

    if (needle !== draggingRef.current.currentNeedle) {
      draggingRef.current.currentNeedle = needle;
      setDraggingNode({ ...draggingRef.current });

      // Live update as mouse moves
      const dragCourse = draggingRef.current.courseIdx;
      const dragGb = draggingRef.current.gbId;
      const updated = rows.map((r, idx) =>
        idx === dragCourse ? { ...r, [dragGb]: needle } : r
      );
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
      const updated = rows.map((r, idx) =>
        idx === courseIdx ? { ...r, [gbId]: currentNeedle } : r
      );
      onChangeRows(updated);
    }

    draggingRef.current = null;
    setDraggingNode(null);
  };

  const handlePointerLeave = () => {
    setHoverInfo(null);
  };

  // Window-level safety cleanup for desktop drag release
  useEffect(() => {
    const handleGlobalUp = () => {
      if (draggingRef.current) {
        const { courseIdx, gbId, currentNeedle } = draggingRef.current;
        const updated = rows.map((r, idx) =>
          idx === courseIdx ? { ...r, [gbId]: currentNeedle } : r
        );
        onChangeRows(updated);
        draggingRef.current = null;
        setDraggingNode(null);
      }
    };

    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, [rows, onChangeRows]);

  // Add course row
  const handleAddCourse = () => {
    const newIndex = rows.length + 1;
    const lastRow = rows[rows.length - 1] || { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
    const newRow: PatternRow = {
      id: 'row-add-' + Date.now(),
      courseIndex: newIndex,
      GB1: lastRow.GB1,
      GB2: lastRow.GB2,
      GB3: lastRow.GB3,
      GB4: lastRow.GB4,
      GB5: lastRow.GB5,
      GB6: lastRow.GB6,
    };
    onChangeRows([...rows, newRow]);
  };

  // Delete last course row
  const handleDeleteCourse = () => {
    if (rows.length <= 1) return;
    onChangeRows(rows.slice(0, rows.length - 1));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-500/20">
              <Move className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">Canlı Tarak Editörü (Sürükle & Bırak)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PC & Mobil Uyumlu
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Fareyle tıklayarak veya sürükleyerek iğne koordinatlarını doğrudan grafik üzerinde değiştirin.
              </p>
            </div>
          </div>

          {/* Quick Undo / Redo & Safety */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
              title="Geri Al"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Geri Al</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
              title="Yinele"
            >
              <Redo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Yinele</span>
            </button>
            <button
              onClick={onOpenSafetySettings}
              className="px-3 py-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 rounded-xl text-xs font-semibold border border-amber-800/80 transition"
            >
              Güvenli Tarak Sınırları
            </button>
          </div>
        </div>

        {/* Active Guide Bar Selector Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 mr-1 flex items-center space-x-1">
              <MousePointer className="w-3.5 h-3.5 text-blue-400" />
              <span>Düzenlenen Tarak:</span>
            </span>
            {activeBars.map((gbId) => {
              const gb = pattern.guideBars[gbId];
              const isSelected = activeGbId === gbId;
              return (
                <button
                  key={gbId}
                  onClick={() => setActiveGbId(gbId)}
                  style={{
                    backgroundColor: isSelected ? gb.color : undefined,
                    borderColor: gb.color,
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {gbId} ({gb.name.split(' ')[1] || ''})
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddCourse}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/30"
              title="Yeni Kurs Ekle"
            >
              <Plus className="w-4 h-4" />
              <span>Kurs Ekle</span>
            </button>
            <button
              onClick={handleDeleteCourse}
              disabled={rows.length <= 1}
              className="flex items-center space-x-1 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 disabled:opacity-40 rounded-xl text-xs font-bold border border-rose-600/30 transition"
              title="Son Kursu Sil"
            >
              <Trash2 className="w-4 h-4" />
              <span>Son Kursu Sil</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Point Paper Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Sub-header with Zoom and Help */}
        <div className="bg-slate-950/90 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="font-semibold text-slate-200">
              {rows.length} Kurs &bull; {needleCols} İğne Genişliği
            </span>
            <span className="hidden md:inline text-slate-500">|</span>
            <span className="hidden md:flex items-center space-x-1 text-slate-400">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>İpucu: İğne noktasına tıklayın veya farenin sol tuşuna basılı tutarak sürükleyin.</span>
            </span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">
            <button
              onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold text-slate-200 px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.15))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1.0)}
              className="p-1 text-slate-500 hover:text-slate-300 rounded ml-1"
              title="Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Drag Canvas Viewport */}
        <div
          ref={containerRef}
          className="p-6 overflow-auto max-h-[750px] bg-[#070b14] flex justify-center cursor-crosshair select-none"
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
              onPointerLeave={handlePointerLeave}
              className="rounded-2xl border border-slate-800 shadow-2xl bg-[#080d1a] touch-none cursor-pointer"
            />
          </div>
        </div>

        {/* Floating Mini Live Preview Widget */}
        {isLivePreviewOpen && (
          <div className="absolute bottom-5 right-5 w-60 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-white border-b border-slate-800 pb-1.5">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Canlı Çıktı Önizleme</span>
              </span>
              <button
                onClick={() => setIsLivePreviewOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <canvas
              ref={previewCanvasRef}
              width={220}
              height={140}
              className="rounded-xl border border-slate-800 bg-[#0a0f1e]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
