import React, { useEffect, useRef } from 'react';
import { GuideBarId, PatternRow, SafetyConfig } from '../types';
import { LoopType, analyzeCellLoop, computeNeedleValueForLoop } from '../utils/loopEngine';
import { LoopGlyph } from './LoopGlyph';
import { X, ArrowLeft, ArrowRight, ShieldAlert, Check } from 'lucide-react';

interface QuickLoopPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
  rowIndex: number;
  row: PatternRow;
  prevRow: PatternRow | null;
  nextRow: PatternRow | null;
  gbId: GuideBarId;
  safety: SafetyConfig;
  needleCols: number;
  onApplyLoopChange: (
    rowIndex: number,
    gbId: GuideBarId,
    newNeedleVal: number,
    loopType: LoopType
  ) => void;
  onAutoFix: (rowIndex: number, gbId: GuideBarId) => void;
}

export const QuickLoopPickerPopover: React.FC<QuickLoopPickerPopoverProps> = ({
  isOpen,
  onClose,
  position,
  rowIndex,
  row,
  prevRow,
  nextRow,
  gbId,
  safety,
  needleCols,
  onApplyLoopChange,
  onAutoFix,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  const info = analyzeCellLoop(row, prevRow, nextRow, gbId, safety, needleCols);
  const currentVal = row[gbId] ?? 0;
  const prevVal = prevRow ? (prevRow[gbId] ?? currentVal) : currentVal;
  const maxJump = safety?.maxSafeShoggingJump || 4;

  const handleSelectType = (targetType: LoopType) => {
    let spanDelta = info.underlapSpan === 0 ? 1 : info.underlapSpan;
    if (info.direction === 'left') spanDelta = -spanDelta;

    const newNeedle = computeNeedleValueForLoop(
      prevVal,
      targetType,
      spanDelta,
      needleCols,
      maxJump
    );

    onApplyLoopChange(rowIndex, gbId, newNeedle, targetType);
  };

  const handleAdjustSpan = (stepDelta: number) => {
    const dir = info.direction === 'left' ? -1 : 1;
    let newSpan = info.underlapSpan + stepDelta;
    newSpan = Math.max(0, Math.min(maxJump, newSpan));

    const newNeedle = computeNeedleValueForLoop(
      prevVal,
      info.type,
      newSpan * dir,
      needleCols,
      maxJump
    );

    onApplyLoopChange(rowIndex, gbId, newNeedle, info.type);
  };

  // Adjust popover coordinates so it doesn't overflow screen bounds
  const screenW = window.innerWidth || 1200;
  const screenH = window.innerHeight || 800;
  const left = Math.min(position.x, screenW - 320);
  const top = Math.min(position.y, screenH - 360);

  return (
    <div
      ref={popoverRef}
      style={{ top: `${Math.max(10, top)}px`, left: `${Math.max(10, left)}px` }}
      className="fixed z-50 w-72 bg-slate-900 border-2 border-blue-500/80 rounded-2xl shadow-2xl p-3 text-slate-100 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold text-white font-mono">
            K{row.courseIndex} · {gbId} İlmek Düzenleyici
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Warning Alert if Invalid Loop */}
      {!info.isValid && (
        <div className="mt-2 bg-rose-950/80 border border-rose-800/80 rounded-xl p-2 text-xs text-rose-300 space-y-1">
          <div className="flex items-center space-x-1 font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Geçersiz İlmek Hareketi!</span>
          </div>
          <p className="text-[11px] text-rose-200">{info.invalidReason}</p>
          <button
            onClick={() => {
              onAutoFix(rowIndex, gbId);
              onClose();
            }}
            className="w-full mt-1 px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[11px] transition shadow"
          >
            Otomatik Düzelt (Auto-Fix)
          </button>
        </div>
      )}

      {/* 1. Loop Type Picker Grid */}
      <div className="mt-2.5 space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          1. İlmek Türü Seçimi:
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleSelectType('open')}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
              info.type === 'open'
                ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-500/50'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <LoopGlyph type="open" size="sm" showBadgeText={false} />
            <div className="text-left leading-tight">
              <span className="block font-bold">Açık [O]</span>
              <span className="text-[9px] text-slate-400 block font-normal">Open Loop</span>
            </div>
          </button>

          <button
            onClick={() => handleSelectType('closed')}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
              info.type === 'closed'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/50'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <LoopGlyph type="closed" size="sm" showBadgeText={false} />
            <div className="text-left leading-tight">
              <span className="block font-bold">Kapalı [C]</span>
              <span className="text-[9px] text-slate-400 block font-normal">Closed Loop</span>
            </div>
          </button>

          <button
            onClick={() => handleSelectType('miss')}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
              info.type === 'miss'
                ? 'bg-slate-700 text-white border-slate-500 shadow-md ring-2 ring-slate-400/50'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <LoopGlyph type="miss" size="sm" showBadgeText={false} />
            <div className="text-left leading-tight">
              <span className="block font-bold">Atlama [M]</span>
              <span className="text-[9px] text-slate-400 block font-normal">Miss / Float</span>
            </div>
          </button>

          <button
            onClick={() => handleSelectType('tuck')}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-2 transition ${
              info.type === 'tuck'
                ? 'bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-500/50'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
            }`}
          >
            <LoopGlyph type="tuck" size="sm" showBadgeText={false} />
            <div className="text-left leading-tight">
              <span className="block font-bold">Yükleme [T]</span>
              <span className="text-[9px] text-slate-400 block font-normal">Tuck Mesh</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Underlap Span Stepper Controls */}
      <div className="mt-3 pt-2 border-t border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>2. Sıçrama Mesafesi (Span):</span>
          <span className="text-blue-400 font-mono">{info.underlapSpan} İğne</span>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => handleAdjustSpan(-2)}
            className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-bold transition"
            title="-2 İğne Daralt"
          >
            -2
          </button>
          <button
            onClick={() => handleAdjustSpan(-1)}
            className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-bold transition"
            title="-1 İğne Daralt"
          >
            -1
          </button>
          <button
            onClick={() => handleAdjustSpan(1)}
            className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-bold transition"
            title="+1 İğne Genişlet"
          >
            +1
          </button>
          <button
            onClick={() => handleAdjustSpan(2)}
            className="py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-lg text-xs font-bold transition"
            title="+2 İğne Genişlet"
          >
            +2
          </button>
        </div>
      </div>

      {/* Live Value Footer */}
      <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-1 font-mono text-slate-300">
          <span>İğne:</span>
          <span className="font-bold text-emerald-400">İ{currentVal}</span>
          <span className="text-slate-500 text-[10px]">({prevVal} → {currentVal})</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Tamam</span>
        </button>
      </div>
    </div>
  );
};
