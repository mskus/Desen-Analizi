import React, { useState } from 'react';
import { GuideBarId, PatternRow, SafetyConfig } from '../types';
import { LoopType } from '../utils/loopEngine';
import { LoopGlyph } from './LoopGlyph';
import {
  PenTool,
  Wand2,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle2,
  MousePointer,
  Grid
} from 'lucide-react';

export type LoopToolMode =
  | 'select'
  | 'cycle_pen'
  | 'open_stamp'
  | 'closed_stamp'
  | 'miss_stamp'
  | 'tuck_stamp';

interface VisualLoopToolbarProps {
  activeToolMode: LoopToolMode;
  onSelectToolMode: (mode: LoopToolMode) => void;
  activeGbId: GuideBarId;
  activeBars: GuideBarId[];
  rows: PatternRow[];
  safety: SafetyConfig;
  needleCols: number;
  onApplyMassTransform: (newRows: PatternRow[], message: string) => void;
}

export const VisualLoopToolbar: React.FC<VisualLoopToolbarProps> = ({
  activeToolMode,
  onSelectToolMode,
  activeGbId,
  activeBars,
  rows,
  safety,
  needleCols,
  onApplyMassTransform,
}) => {
  const [selectedGbForMass, setSelectedGbForMass] = useState<GuideBarId>(activeGbId);
  const [targetTypeForMass, setTargetTypeForMass] = useState<LoopType>('closed');

  // Mass Transform 1: Convert all cells in column to selected loop type
  const handleMassConvertColumn = () => {
    const maxJump = safety?.maxSafeShoggingJump || 4;
    const updated = rows.map((r, idx) => {
      const prevRow = idx > 0 ? rows[idx - 1] : null;
      const prevVal = prevRow ? (prevRow[selectedGbForMass] ?? 0) : (r[selectedGbForMass] ?? 0);

      let newVal = prevVal;
      if (targetTypeForMass === 'open') {
        newVal = Math.min(needleCols - 1, prevVal + (idx % 2 === 0 ? 1 : -1));
      } else if (targetTypeForMass === 'closed') {
        newVal = Math.min(needleCols - 1, prevVal + (idx % 2 === 0 ? 2 : -1));
      } else if (targetTypeForMass === 'miss') {
        newVal = prevVal;
      } else if (targetTypeForMass === 'tuck') {
        newVal = Math.min(needleCols - 1, prevVal + (idx % 2 === 0 ? 1 : 0));
      }

      newVal = Math.max(0, Math.min(needleCols - 1, newVal));

      return {
        ...r,
        [selectedGbForMass]: newVal,
        loopTypes: {
          ...(r.loopTypes || {}),
          [selectedGbForMass]: targetTypeForMass,
        },
      };
    });

    onApplyMassTransform(
      updated,
      `${selectedGbForMass} sütunundaki tüm ilmekler [${targetTypeForMass.toUpperCase()}] olarak dönüştürüldü.`
    );
  };

  // Mass Transform 2: Invert direction for column
  const handleInvertColumnDirection = () => {
    const updated = rows.map((r) => {
      const currentVal = r[selectedGbForMass] ?? 0;
      const inverted = needleCols - 1 - currentVal;
      return {
        ...r,
        [selectedGbForMass]: Math.max(0, Math.min(needleCols - 1, inverted)),
      };
    });

    onApplyMassTransform(updated, `${selectedGbForMass} ilmek yönleri tersine çevrildi.`);
  };

  // Preset Template 1: Zikzak / Tricot (1-0/1-2)
  const handleApplyPresetTricot = () => {
    const updated = rows.map((r, idx) => ({
      ...r,
      [selectedGbForMass]: idx % 2 === 0 ? 1 : 0,
      loopTypes: {
        ...(r.loopTypes || {}),
        [selectedGbForMass]: 'open' as LoopType,
      },
    }));
    onApplyMassTransform(updated, `${selectedGbForMass} için Zikzak / Triko Şablonu uygulandı.`);
  };

  // Preset Template 2: Open Mesh / File (2-3/1-0)
  const handleApplyPresetMesh = () => {
    const updated = rows.map((r, idx) => ({
      ...r,
      [selectedGbForMass]: idx % 2 === 0 ? 3 : 0,
      loopTypes: {
        ...(r.loopTypes || {}),
        [selectedGbForMass]: 'open' as LoopType,
      },
    }));
    onApplyMassTransform(updated, `${selectedGbForMass} için File / Açık Gözenek Şablonu uygulandı.`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 space-y-2.5 shadow-lg">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <PenTool className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            İlmek Araç Çubuğu & Sihirbazı (Visual Loop Builder)
          </h3>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mod: {activeToolMode === 'select' ? 'Normal Tablo Girişi' : 'Kalem Çizim Modu'}</span>
        </div>
      </div>

      {/* Row 1: Tool Picker Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">Kalem Modu:</span>

        <button
          onClick={() => onSelectToolMode('select')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
            activeToolMode === 'select'
              ? 'bg-blue-600 text-white border-blue-400 shadow'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Normal</span>
        </button>

        <button
          onClick={() => onSelectToolMode('cycle_pen')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1.5 ${
            activeToolMode === 'cycle_pen'
              ? 'bg-amber-600 text-white border-amber-400 shadow ring-2 ring-amber-500/50'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Tıklanan hücrenin ilmek türünü sırasıyla (Açık -> Kapalı -> Miss -> Tuck) değiştirir"
        >
          <PenTool className="w-3.5 h-3.5 text-amber-300" />
          <span>Döngü Kalemi (Cycle)</span>
        </button>

        <button
          onClick={() => onSelectToolMode('open_stamp')}
          className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
            activeToolMode === 'open_stamp'
              ? 'bg-blue-600 text-white border-blue-400 shadow'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          <LoopGlyph type="open" size="sm" showBadgeText={false} />
          <span>[O] Açık Kalemi</span>
        </button>

        <button
          onClick={() => onSelectToolMode('closed_stamp')}
          className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
            activeToolMode === 'closed_stamp'
              ? 'bg-emerald-600 text-white border-emerald-400 shadow'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          <LoopGlyph type="closed" size="sm" showBadgeText={false} />
          <span>[C] Kapalı Kalemi</span>
        </button>

        <button
          onClick={() => onSelectToolMode('miss_stamp')}
          className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
            activeToolMode === 'miss_stamp'
              ? 'bg-slate-700 text-white border-slate-500 shadow'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          <LoopGlyph type="miss" size="sm" showBadgeText={false} />
          <span>[M] Miss Kalemi</span>
        </button>

        <button
          onClick={() => onSelectToolMode('tuck_stamp')}
          className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
            activeToolMode === 'tuck_stamp'
              ? 'bg-amber-600 text-white border-amber-400 shadow'
              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          <LoopGlyph type="tuck" size="sm" showBadgeText={false} />
          <span>[T] Tuck Kalemi</span>
        </button>
      </div>

      {/* Row 2: Mass Loop Transformer & Templates */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Column Transformer */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <Wand2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-bold text-slate-300 text-[11px]">Toplu Dönüştür:</span>

          <select
            value={selectedGbForMass}
            onChange={(e) => setSelectedGbForMass(e.target.value as GuideBarId)}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
          >
            {activeBars.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>

          <span className="text-slate-500">→</span>

          <select
            value={targetTypeForMass}
            onChange={(e) => setTargetTypeForMass(e.target.value as LoopType)}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs font-bold"
          >
            <option value="open">Açık İlmek [O]</option>
            <option value="closed">Kapalı İlmek [C]</option>
            <option value="miss">Atlama [Miss]</option>
            <option value="tuck">Yükleme [Tuck]</option>
          </select>

          <button
            onClick={handleMassConvertColumn}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition shadow shrink-0"
          >
            Uygula
          </button>
        </div>

        {/* Quick Action Presets */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Sihirbaz:</span>
          <button
            onClick={handleInvertColumnDirection}
            className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-medium transition"
            title="Sütundaki yönleri tersine çevirir"
          >
            Yönleri Ters Çevir
          </button>
          <button
            onClick={handleApplyPresetTricot}
            className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 rounded-lg text-xs font-semibold transition"
          >
            Zikzak (Triko)
          </button>
          <button
            onClick={handleApplyPresetMesh}
            className="px-2 py-1 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/80 rounded-lg text-xs font-semibold transition"
          >
            Açık Gözenek / File
          </button>
        </div>
      </div>
    </div>
  );
};
