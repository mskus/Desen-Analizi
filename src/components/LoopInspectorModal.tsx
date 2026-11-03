import React from 'react';
import { LoopInspectorNode, PatternRow } from '../types';
import {
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';

interface LoopInspectorModalProps {
  node: LoopInspectorNode | null;
  onClose: () => void;
  onConvertLoopType: (node: LoopInspectorNode, targetType: 'open' | 'closed') => void;
}

export const LoopInspectorModal: React.FC<LoopInspectorModalProps> = ({
  node,
  onClose,
  onConvertLoopType,
}) => {
  if (!node) return null;

  const isClosed = node.loopType === 'closed';
  const isOpen = node.loopType === 'open';
  const targetType = isClosed ? 'open' : 'closed';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              İlmek Müfettişi (Loop Inspector)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Top Primary Info Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <span
                className="w-4 h-10 rounded-lg shrink-0 shadow-inner"
                style={{ backgroundColor: node.yarnColor }}
              />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white">{node.gbId}</span>
                  <span className="text-xs text-slate-400 font-mono">({node.yarnDtex} dtex)</span>
                </div>
                <div className="text-xs text-slate-300 font-semibold mt-0.5">
                  Kurs {node.courseIndex} · İğne {node.needleIndex} (İ{node.needleIndex})
                </div>
              </div>
            </div>

            {/* Loop Type Badge */}
            <div className="text-right">
              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                  isOpen
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                    : isClosed
                    ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                    : 'bg-amber-950/80 border-amber-500 text-amber-300'
                }`}
              >
                <span>{isOpen ? 'Ω' : isClosed ? '⋈' : '═'}</span>
                <span>{node.loopTypeName}</span>
              </span>
            </div>
          </div>

          {/* Details Table Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
              <span className="text-slate-500 block text-[11px]">Tarak Şog Hareketi:</span>
              <span className="text-slate-200 font-mono font-bold block">
                {(node.overlapShift ?? 0) > 0 ? `+${node.overlapShift}` : (node.overlapShift ?? 0)} iğne (Overlap)
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
              <span className="text-slate-500 block text-[11px]">Zincir Notasyonu:</span>
              <span className="text-blue-400 font-mono font-bold block">
                {node.notationString}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
              <span className="text-slate-500 block text-[11px]">İğne Üzerindeki İplik Katı:</span>
              <span
                className={`font-mono font-bold block ${
                  node.isOvercrowded ? 'text-rose-400 font-extrabold' : 'text-emerald-400'
                }`}
              >
                {node.threadCountOnNeedle} Kat İplik {node.isOvercrowded && '(! Aşırı Dolgun)'}
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-2.5 rounded-xl space-y-1">
              <span className="text-slate-500 block text-[11px]">Gerilim & Atlama Mesafesi:</span>
              <span
                className={`font-mono font-bold block ${
                  node.isOverTensioned ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {node.shoggingJump} İğne Atlama {node.isOverTensioned && '(Gerilim Sınırı Aşıldı)'}
              </span>
            </div>
          </div>

          {/* Diagnostics & Warning Alerts */}
          {node.warnings && node.warnings.length > 0 ? (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center space-x-1.5 text-rose-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Tespit Edilen Teknik Uyarılar ({node.warnings.length})</span>
              </div>
              <ul className="list-disc list-inside text-xs text-rose-200/90 space-y-1 pl-1 font-sans">
                {node.warnings.map((w: string, idx: number) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-2xl p-2.5 flex items-center space-x-2 text-xs text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Bu ilmekte herhangi bir gerilim, çakışma veya sökülme riski bulunmamaktadır.</span>
            </div>
          )}

          {/* Single Click Loop Type Converter Button */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Tek Tıkla İlmek Tipi Dönüştürücü (Single Source of Truth)</span>
            </div>

            <button
              onClick={() => {
                onConvertLoopType(node, targetType);
                onClose();
              }}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-lg active:scale-95 ${
                targetType === 'closed'
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
              }`}
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              <span>
                {targetType === 'closed'
                  ? 'Kapalı İlmeğe Çevir (Closed Lap ⋈)'
                  : 'Açık İlmeğe Çevir (Open Lap Ω)'}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Dönüştürme işlemi desen kod tablosundaki sayısal tarak kodunu bozmadan otomatik günceller.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
