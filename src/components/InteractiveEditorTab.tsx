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
  Table as TableIcon,
  Copy,
  ShieldCheck,
  Wand2,
  Check
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
    setTimeout(() => setActionMsg(null), 3000);
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

  // Table Row Actions (with Sticky / Floating accessibility)
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
    showMsg('Yeni kurs satırı eklendi.');
  };

  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    const updated = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, courseIndex: i + 1 }));
    onChangeRows(updated);
    showMsg('Kurs satırı silindi.');
  };

  const duplicatePattern = () => {
    const duplicated = [...rows, ...rows].map((r, idx) => ({
      ...r,
      id: 'dup-' + idx + '-' + Date.now(),
      courseIndex: idx + 1,
    }));
    onChangeRows(duplicated);
    showMsg('Desen 2x katlanarak çoğaltıldı.');
  };

  const mirrorPattern = () => {
    const reversed = [...rows].reverse().map((r, idx) => ({
      ...r,
      id: 'mir-' + idx + '-' + Date.now(),
      courseIndex: rows.length + idx + 1,
    }));
    onChangeRows([...rows, ...reversed]);
    showMsg('Desen simetrik olarak aynalandı.');
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
    showMsg('Hızlı notasyon tabloya işlendi.');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Toast Notification Banner */}
      {actionMsg && (
        <div className="bg-emerald-950/90 border border-emerald-800 text-emerald-200 px-4 py-2 rounded-xl text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Sticky Quick Action Toolbar (Never have to scroll up to add rows!) */}
      <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-3 sticky top-14 sm:top-16 z-30 shadow-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs text-slate-400 font-semibold shrink-0">Hızlı İşlemler:</span>
          <button
            onClick={addRow}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1 shrink-0 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Satır Ekle</span>
          </button>
          <button
            onClick={duplicatePattern}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition shrink-0"
          >
            Deseni Çoğalt (2x)
          </button>
          <button
            onClick={mirrorPattern}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium transition shrink-0"
          >
            Aynala
          </button>
        </div>

        <div className="flex items-center space-x-1.5 ml-auto">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:bg-slate-800 transition"
            title="Geri Al"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-30 rounded-lg hover:bg-slate-800 transition"
            title="Yinele"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSafetySettings}
            className="p-1.5 bg-amber-950/40 border border-amber-800/60 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-900/40 transition flex items-center space-x-1"
            title="Güvenli Tarak Ayarları"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Güvenlik</span>
          </button>
        </div>
      </div>

      {/* Top Section: Visual Point Paper Drag Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white">Canlı Sürükle-Bırak Tarak Editörü</span>
          </div>

          {/* Guide Bar selector */}
          <div className="flex items-center space-x-1">
            {activeBars.map((gbId) => {
              const gb = pattern.guideBars[gbId];
              const isSelected = activeGbId === gbId;
              return (
                <button
                  key={gbId}
                  onClick={() => setActiveGbId(gbId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
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
          <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))} className="text-slate-400 hover:text-white">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))} className="text-slate-400 hover:text-white">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas viewport */}
        <div ref={containerRef} className="p-4 overflow-auto max-h-[500px] bg-[#070b14] flex justify-center cursor-crosshair select-none">
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
          <div className="absolute bottom-4 right-4 w-52 bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl shadow-2xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-white border-b border-slate-800 pb-1">
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Canlı Önizleme</span>
              </span>
              <button onClick={() => setIsLivePreviewOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <canvas ref={previewCanvasRef} width={200} height={120} className="rounded-lg border border-slate-800 bg-[#0a0f1e]" />
          </div>
        )}
      </div>

      {/* Bottom Section: Unified Full Pattern Code Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Desen Kod Tablosu & Zincir Diyagramı</h3>
              <p className="text-xs text-slate-400">Toplam {rows.length} kurs, {needleCols} iğne aralığı</p>
            </div>
          </div>

          {/* Quick Notation Bar */}
          <div className="flex items-center space-x-2">
            <select
              value={selectedGbForQuick}
              onChange={(e) => setSelectedGbForQuick(e.target.value as GuideBarId)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
            >
              {activeBars.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <input
              type="text"
              value={quickInputText}
              onChange={(e) => setQuickInputText(e.target.value)}
              placeholder="Örn: 1-0, 1-2, 2-1"
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono w-44 sm:w-56"
            />
            <button
              onClick={handleQuickNotationParse}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shrink-0"
            >
              Uygula
            </button>
          </div>
        </div>

        {/* Table Viewport */}
        <div className="overflow-x-auto max-h-[420px] rounded-xl border border-slate-800 bg-[#070b14]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 sticky top-0 z-10 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Kurs</th>
                {activeBars.map((gbId) => (
                  <th key={gbId} className="py-2.5 px-3" style={{ color: pattern.guideBars[gbId].color }}>
                    {gbId} ({pattern.guideBars[gbId].name})
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row, rIdx) => (
                <tr key={row.id || rIdx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-3 font-bold text-slate-300">K{row.courseIndex}</td>
                  {activeBars.map((gbId) => {
                    const val = row[gbId] ?? 0;
                    return (
                      <td key={gbId} className="py-2 px-3">
                        <input
                          type="number"
                          min={0}
                          max={needleCols - 1}
                          value={val}
                          onChange={(e) => handleCellChange(rIdx, gbId, parseInt(e.target.value, 10))}
                          className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-white focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </td>
                    );
                  })}
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => deleteRow(rIdx)}
                      disabled={rows.length <= 1}
                      className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded transition"
                      title="Bu Satırı Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
