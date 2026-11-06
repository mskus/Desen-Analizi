import React from 'react';
import { SafetyConfig, PatternRow, GuideBarId } from '../types';
import { ShieldCheck, X, Lock } from 'lucide-react';

interface SafetySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  safety: SafetyConfig;
  onChangeSafety: (updated: SafetyConfig) => void;
  rows: PatternRow[];
  onChangeRows: (rows: PatternRow[]) => void;
  onNavigateToLogs?: () => void;
}

export const SafetySettingsModal: React.FC<SafetySettingsModalProps> = ({
  isOpen,
  onClose,
  safety,
  onChangeSafety,
  rows,
  onChangeRows,
  onNavigateToLogs,
}) => {
  if (!isOpen) return null;

  const handleFieldChange = (field: keyof SafetyConfig, value: any) => {
    onChangeSafety({
      ...safety,
      [field]: value,
    });
  };

  const handleAutoClampJumps = () => {
    const gbIds: GuideBarId[] = ['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'];
    const updated = rows.map((r, rIdx) => {
      if (rIdx === 0) return r;
      const prev = rows[rIdx - 1];
      const newRow = { ...r };

      gbIds.forEach((gbId) => {
        const diff = newRow[gbId] - prev[gbId];
        if (Math.abs(diff) > safety.maxSafeShoggingJump) {
          const clampedDiff =
            diff > 0 ? safety.maxSafeShoggingJump : -safety.maxSafeShoggingJump;
          newRow[gbId] = Math.max(
            0,
            Math.min(safety.maxAllowedNeedleNumber, prev[gbId] + clampedDiff)
          );
        }
      });
      return newRow;
    });

    onChangeRows(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="bg-[#111827] border border-slate-700 rounded-lg w-full max-w-md p-4 shadow-2xl space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Güvenlik Sınırları</h3>
            {onNavigateToLogs && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToLogs();
                }}
                className="px-2 py-0.5 bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 text-blue-300 hover:text-white rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Erişim ve Güvenlik Loglarını Aç"
              >
                <Lock className="w-3 h-3 text-blue-400 shrink-0" />
                <span>Loglar</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded bg-[#0B0F17] border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {/* Max Shogging Jump */}
          <div className="bg-[#0B0F17] p-2.5 rounded border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-white">Maks. Güvenli Atlama:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={safety.maxSafeShoggingJump}
                  onChange={(e) =>
                    handleFieldChange(
                      'maxSafeShoggingJump',
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className="w-14 bg-[#111827] border border-slate-700 rounded px-2 py-1 text-center text-blue-400 font-mono font-bold tabular-nums focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-400 font-semibold">İğne</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleFieldChange('maxSafeShoggingJump', step)}
                  className={`py-1 px-2.5 rounded text-xs font-semibold transition-colors border cursor-pointer tabular-nums ${
                    safety.maxSafeShoggingJump === step
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#111827] text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {step}İ
                </button>
              ))}
            </div>
          </div>

          {/* Maximum Allowed Needle Span */}
          <div className="bg-[#0B0F17] p-2.5 rounded border border-slate-800 flex items-center justify-between gap-2">
            <span className="font-bold text-white">Maks. İğne İndeksi (7–127):</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="7"
                max="127"
                value={safety.maxAllowedNeedleNumber}
                onChange={(e) =>
                  handleFieldChange(
                    'maxAllowedNeedleNumber',
                    Math.max(7, Math.min(127, parseInt(e.target.value, 10) || 18))
                  )
                }
                className="w-16 bg-[#111827] border border-slate-700 rounded px-2 py-1 text-center text-white font-mono font-bold tabular-nums focus:outline-none focus:border-blue-500"
              />
              <span className="text-slate-400 font-semibold">({safety.maxAllowedNeedleNumber + 1}İ)</span>
            </div>
          </div>

          {/* Clash Detection */}
          <label className="bg-[#0B0F17] p-2.5 rounded border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-bold text-white">Tarak Çarpışma Uyarısı</span>
            <input
              type="checkbox"
              checked={safety.enableClashDetection}
              onChange={(e) => handleFieldChange('enableClashDetection', e.target.checked)}
              className="w-4 h-4 rounded bg-[#111827] border-slate-700 text-blue-600 cursor-pointer"
            />
          </label>

          {/* Empty Needle Warning */}
          <label className="bg-[#0B0F17] p-2.5 rounded border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-bold text-white">Boş İğne Uyarısı</span>
            <input
              type="checkbox"
              checked={safety.warnOnEmptyNeedleKnitting}
              onChange={(e) =>
                handleFieldChange('warnOnEmptyNeedleKnitting', e.target.checked)
              }
              className="w-4 h-4 rounded bg-[#111827] border-slate-700 text-blue-600 cursor-pointer"
            />
          </label>

          {/* Auto-Clamp Action */}
          <div className="p-2.5 bg-[#0B0F17] border border-slate-800 rounded flex items-center justify-between gap-2">
            <span className="font-bold text-white">Aşırı Atlamaları Sınırla ({safety.maxSafeShoggingJump}İ)</span>
            <button
              type="button"
              onClick={handleAutoClampJumps}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Uygula
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
