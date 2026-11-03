import React from 'react';
import { PatternData, PatternRow, GuideBarId, SafetyConfig, LoopWarning } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Info,
  Sparkles,
  Layers,
  HelpCircle,
  Eye,
  Sliders,
  X
} from 'lucide-react';
import { validatePatternLoops, classifyStitchLoop } from '../utils/loopUtils';

interface LoopInspectorPanelProps {
  pattern: PatternData;
  onChangeSafety?: (updated: SafetyConfig) => void;
  onChangeRows?: (rows: PatternRow[]) => void;
  onOpenQuickFill?: () => void;
  onClose?: () => void;
}

export const LoopInspectorPanel: React.FC<LoopInspectorPanelProps> = ({
  pattern,
  onChangeSafety,
  onChangeRows,
  onOpenQuickFill,
  onClose,
}) => {
  const safety = pattern.safety;
  const rows = pattern.rows;
  const guideBars = pattern.guideBars;
  const activeBars = (Object.keys(guideBars) as GuideBarId[]).filter((id) => guideBars[id]?.active);

  // Validate all loops across the pattern
  const loopWarnings: LoopWarning[] = validatePatternLoops(rows, guideBars, safety);
  const errorCount = loopWarnings.filter((w) => w.severity === 'error').length;
  const warningCount = loopWarnings.filter((w) => w.severity === 'warning').length;

  const toggleLoopFormation = () => {
    onChangeSafety?.({
      ...safety,
      loopFormationRequired: !safety.loopFormationRequired,
    });
  };

  // Auto fix faulty loops
  const handleAutoFixWrongLoops = () => {
    if (!onChangeRows) return;
    const updated = rows.map((r, rIdx) => {
      if (rIdx === 0) return r;
      const prev = rows[rIdx - 1];
      const newRow = { ...r };

      activeBars.forEach((gbId) => {
        const gb = guideBars[gbId];
        let val = newRow[gbId] ?? 0;
        const prevVal = prev[gbId] ?? val;
        const diff = val - prevVal;

        // 1. Clamp excessive jumps
        if (Math.abs(diff) > safety.maxSafeShoggingJump) {
          const clamped = diff > 0 ? safety.maxSafeShoggingJump : -safety.maxSafeShoggingJump;
          val = prevVal + clamped;
        }

        // 2. Ensure within bounds
        val = Math.max(0, Math.min(safety.maxAllowedNeedleNumber, val));

        // 3. If empty needle, nudge to nearest threaded needle if threadingArray exists
        if (safety.warnOnEmptyNeedleKnitting && gb.threadingArray && !gb.threadingArray[val]) {
          for (let offset = 1; offset < 8; offset++) {
            if (val + offset <= safety.maxAllowedNeedleNumber && gb.threadingArray[val + offset]) {
              val = val + offset;
              break;
            }
            if (val - offset >= 0 && gb.threadingArray[val - offset]) {
              val = val - offset;
              break;
            }
          }
        }

        // 4. If loop formation required and delta is 0, add 1-needle overlap
        if (safety.loopFormationRequired && val === prevVal) {
          val = Math.min(safety.maxAllowedNeedleNumber, val + 1);
        }

        newRow[gbId] = val;
      });

      return newRow;
    });

    onChangeRows(updated);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3.5 shadow-xl">
      {/* Header with Title and Mode Question */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center space-x-2">
              <span>İlmek Analiz & Ayrı İlmek Görünümü</span>
              {loopWarnings.length === 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-semibold">
                  ✓ Tüm İlmekler Kusursuz
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold animate-pulse">
                  ⚠️ {loopWarnings.length} İlmek Uyarısı
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              İlmek başı kilitlenmesi, açık/kapalı ilmek türleri ve düşen ilmek denetimi.
            </p>
          </div>
        </div>

        {/* Question: Makinede İlmek Attırma Zorunlu mu? */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start sm:self-auto">
          <span className="text-[11px] text-slate-400 font-medium pl-1">Makinede İlmek Attırma:</span>
          <button
            onClick={toggleLoopFormation}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
              safety.loopFormationRequired
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
            title="Makinede her kursta overlap (ilmek atma) hareketinin zorunlu olup olmadığını belirler"
          >
            {safety.loopFormationRequired ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zorunlu (Aktif)</span>
              </>
            ) : (
              <span>İsteğe Bağlı / Serme</span>
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-white ml-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* WRONG LOOP WARNINGS BANNER */}
      {loopWarnings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 to-rose-950/40 border border-amber-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Yanlış / Riskli İlmek Algılandı ({errorCount} Hata, {warningCount} Uyarı)</span>
            </div>
            <button
              onClick={handleAutoFixWrongLoops}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Hataları Düzelt</span>
            </button>
          </div>

          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
            {loopWarnings.map((w) => (
              <div
                key={w.id}
                className={`text-[11px] px-2.5 py-1 rounded-lg flex items-center justify-between font-mono ${
                  w.severity === 'error'
                    ? 'bg-rose-950/60 text-rose-300 border border-rose-900/60'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-900/60'
                }`}
              >
                <span>{w.message}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-sans uppercase">
                  {w.type.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUICK ACTIONS & PRESETS SHORTCUT */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">Hızlı Doldurma:</span>
          {onOpenQuickFill && (
            <button
              onClick={onOpenQuickFill}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1 shadow"
            >
              <Sparkles className="w-3 h-3" />
              <span>Örnek Notasyon Doldur (K1: 9-10-9-10...)</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Açık İlmek</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Kapalı İlmek</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span>Düşen / Boş</span>
          </span>
        </div>
      </div>

      {/* INDIVIDUAL LOOP TILES MATRIX (Ayrı Olarak İlmekleri Gör) */}
      <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-800 bg-[#070b14] p-2.5 scrollbar-thin">
        <div className="min-w-[480px] space-y-2">
          {rows.map((row, rIdx) => {
            const prevRow = rIdx > 0 ? rows[rIdx - 1] : rows[rows.length - 1];

            return (
              <div
                key={row.id || rIdx}
                className="flex items-center space-x-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 hover:border-slate-700 transition"
              >
                {/* Course Header */}
                <div className="w-14 shrink-0 font-mono font-bold text-xs text-slate-300">
                  <span>K{row.courseIndex}</span>
                  {row.notation && (
                    <span className="text-[10px] text-slate-500 block truncate" title={row.notation}>
                      {row.notation}
                    </span>
                  )}
                </div>

                {/* Guide Bar Loop Badges */}
                <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                  {activeBars.map((gbId) => {
                    const gb = guideBars[gbId];
                    const val = row[gbId] ?? 0;
                    const prevVal = prevRow ? prevRow[gbId] ?? val : val;
                    const isThreaded = gb?.threadingArray ? gb.threadingArray[val] === true : true;
                    const loopInfo = classifyStitchLoop(val, prevVal, isThreaded, safety.loopFormationRequired);

                    // Check if this specific cell has a warning
                    const hasError = loopWarnings.some(
                      (w) => w.courseIndex === row.courseIndex && w.gbId === gbId
                    );

                    return (
                      <div
                        key={gbId}
                        className={`px-2 py-1 rounded-lg border flex items-center space-x-1.5 shrink-0 transition text-xs font-mono ${
                          hasError
                            ? 'bg-rose-950/50 border-rose-600 text-rose-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                        title={`${gbId} İğne ${val}: ${loopInfo.label}`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: gb?.color || '#3b82f6' }}
                        />
                        <span className="font-bold">{gbId}:</span>
                        <span>İ{val}</span>
                        <span
                          className="text-[9px] px-1 py-0.2 rounded font-sans font-bold"
                          style={{
                            backgroundColor: `${loopInfo.badgeColor}22`,
                            color: loopInfo.badgeColor,
                            border: `1px solid ${loopInfo.badgeColor}44`,
                          }}
                        >
                          {loopInfo.type === 'open'
                            ? 'Açık'
                            : loopInfo.type === 'closed'
                            ? 'Kapalı'
                            : loopInfo.type === 'dropped'
                            ? 'Düşen!'
                            : 'Serme'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
