import React, { useState, useMemo } from 'react';
import { MachineProfile, GuideBarConfig, GuideBarId, SafetyConfig, PatternRow } from '../types';
import { ShieldCheck, Check, Sliders, Lock } from 'lucide-react';
import { calculateGuideBarMetrics, GuideBarCalcBadge } from '../utils/fabricCalculator';

interface MachineSettingsTabProps {
  machine: MachineProfile;
  onChangeMachine: (updated: MachineProfile) => void;
  guideBars: Record<GuideBarId, GuideBarConfig>;
  onChangeGuideBar: (id: GuideBarId, updated: GuideBarConfig) => void;
  safety: SafetyConfig;
  onChangeSafety: (updated: SafetyConfig) => void;
  rows: PatternRow[];
  onChangeRows: (rows: PatternRow[]) => void;
  fabricWidthCm?: number;
  onChangeFabricWidth?: (widthCm: number) => void;
  onNavigateToLogs?: () => void;
}

export const MachineSettingsTab: React.FC<MachineSettingsTabProps> = ({
  machine,
  onChangeMachine,
  guideBars,
  onChangeGuideBar,
  safety,
  onChangeSafety,
  rows,
  onChangeRows,
  fabricWidthCm = 410,
  onChangeFabricWidth,
  onNavigateToLogs,
}) => {
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  const handleSafetyChange = (field: keyof SafetyConfig, value: any) => {
    onChangeSafety({
      ...safety,
      [field]: value,
    });
  };

  const handleGbChange = (id: GuideBarId, field: keyof GuideBarConfig, value: any) => {
    onChangeGuideBar(id, {
      ...guideBars[id],
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
    setCopySuccessMsg('Aşırı atlamalar sınırlandırıldı.');
    setTimeout(() => setCopySuccessMsg(null), 2000);
  };

  return (
    <div className="w-full px-2 py-1.5 space-y-2">
      {/* Toast Notification */}
      {copySuccessMsg && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 sticky top-12 z-40">
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{copySuccessMsg}</span>
        </div>
      )}

      {/* 1. COMPACT SINGLE-BAR SAFETY LIMITS */}
      <section className="bg-[#111827] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold text-white">Güvenlik Sınırları</h2>
            {onNavigateToLogs && (
              <button
                type="button"
                onClick={onNavigateToLogs}
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
            onClick={handleAutoClampJumps}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            title="Aşırı Atlamaları Sınıra Uyarla"
          >
            Atlamaları Sınırla ({safety.maxSafeShoggingJump}İ)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Max Shogging Jump */}
          <div className="bg-[#0B0F17] p-2 rounded border border-slate-800 flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-300 whitespace-nowrap">Maks. Atlama:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => handleSafetyChange('maxSafeShoggingJump', step)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer tabular-nums ${
                    safety.maxSafeShoggingJump === step
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#111827] text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {step}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="24"
                value={safety.maxSafeShoggingJump}
                onChange={(e) =>
                  handleSafetyChange(
                    'maxSafeShoggingJump',
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  )
                }
                className="w-11 bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-center text-blue-400 font-mono font-bold focus:outline-none focus:border-blue-500 tabular-nums"
              />
            </div>
          </div>

          {/* Maximum Allowed Needle Span */}
          <div className="bg-[#0B0F17] p-2 rounded border border-slate-800 flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-300 whitespace-nowrap">Maks. İğne İndeksi:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="7"
                max="299"
                value={safety.maxAllowedNeedleNumber}
                onChange={(e) =>
                  handleSafetyChange(
                    'maxAllowedNeedleNumber',
                    Math.max(7, Math.min(299, parseInt(e.target.value, 10) || 18))
                  )
                }
                className="w-14 bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-center text-white font-mono font-bold focus:outline-none focus:border-blue-500 tabular-nums"
              />
              <span className="text-slate-400 text-[11px] font-mono">({safety.maxAllowedNeedleNumber + 1}İ)</span>
            </div>
          </div>

          {/* Clash Detection */}
          <label className="bg-[#0B0F17] p-2 rounded border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-semibold text-slate-300">Tarak Çarpışma Uyarısı</span>
            <input
              type="checkbox"
              checked={safety.enableClashDetection}
              onChange={(e) => handleSafetyChange('enableClashDetection', e.target.checked)}
              className="w-4 h-4 rounded bg-[#111827] border-slate-700 text-blue-600 cursor-pointer"
            />
          </label>

          {/* Empty Needle Warning */}
          <label className="bg-[#0B0F17] p-2 rounded border border-slate-800 flex items-center justify-between gap-2 cursor-pointer">
            <span className="font-semibold text-slate-300">Boş İğne Uyarısı</span>
            <input
              type="checkbox"
              checked={safety.warnOnEmptyNeedleKnitting}
              onChange={(e) => handleSafetyChange('warnOnEmptyNeedleKnitting', e.target.checked)}
              className="w-4 h-4 rounded bg-[#111827] border-slate-700 text-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </section>

      {/* 2. COMPACT GUIDE BARS (GB1 - GB6) CONFIGURATION */}
      <section className="bg-[#111827] border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-800">
          <Sliders className="w-4 h-4 text-blue-400 shrink-0" />
          <h3 className="text-xs font-bold text-white">Tarak & İplik Ayarları (GB1–GB6)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
          {(Object.keys(guideBars) as GuideBarId[]).map((id) => {
            const gb = guideBars[id];
            return (
              <div
                key={id}
                className={`rounded-lg border p-2.5 transition-colors ${
                  gb.active
                    ? 'bg-[#0B0F17] border-slate-800'
                    : 'bg-[#0B0F17]/40 border-slate-900 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={gb.color}
                      onChange={(e) => handleGbChange(id, 'color', e.target.value)}
                      className="w-5 h-5 rounded border border-slate-700 bg-transparent cursor-pointer p-0"
                      title="Renk"
                    />
                    <span className="font-bold text-xs text-white font-mono">{gb.id}</span>
                  </div>

                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gb.active}
                      onChange={(e) => handleGbChange(id, 'active', e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-[#111827] border-slate-700 text-blue-600 focus:ring-0"
                    />
                    <span>{gb.active ? 'Aktif' : 'Pasif'}</span>
                  </label>
                </div>

                <div className="space-y-1.5 pt-2 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <label className="text-slate-400 text-[11px]">Tür:</label>
                    <select
                      disabled={!gb.active}
                      value={gb.yarnType}
                      onChange={(e) => handleGbChange(id, 'yarnType', e.target.value)}
                      className="bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] focus:outline-none disabled:opacity-40 cursor-pointer"
                    >
                      <option value="Polyester">Polyester</option>
                      <option value="Naylon">Naylon</option>
                      <option value="Elastan">Elastan</option>
                      <option value="Pamuk">Pamuk</option>
                      <option value="Polipropilen">PP</option>
                      <option value="Akrilik">Akrilik</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-slate-400 text-[10px] block">dtex</label>
                      <input
                        type="number"
                        disabled={!gb.active}
                        value={gb.dtex}
                        onChange={(e) =>
                          handleGbChange(id, 'dtex', parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-white text-xs font-mono tabular-nums focus:outline-none disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block">cN</label>
                      <input
                        type="number"
                        disabled={!gb.active}
                        value={gb.tension}
                        onChange={(e) =>
                          handleGbChange(id, 'tension', parseInt(e.target.value) || 0)
                        }
                        className="w-full bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-white text-xs font-mono tabular-nums focus:outline-none disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Saydamlık (Opacity) & Katman Sırası (Layer Z-Index) */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                        <span>Saydamlık</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          %{Math.round((gb.opacity ?? 1.0) * 100)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        disabled={!gb.active}
                        value={gb.opacity ?? 1.0}
                        onChange={(e) =>
                          handleGbChange(id, 'opacity', parseFloat(e.target.value))
                        }
                        className="w-full accent-blue-500 cursor-pointer h-1.5 disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-[10px] block mb-0.5">Katman (Sıra)</label>
                      <select
                        disabled={!gb.active}
                        value={gb.zIndex ?? (parseInt(id.replace('GB', ''), 10) || 1)}
                        onChange={(e) =>
                          handleGbChange(id, 'zIndex', parseInt(e.target.value, 10))
                        }
                        className="w-full bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-white text-[11px] font-mono font-bold focus:outline-none disabled:opacity-40 cursor-pointer"
                        title="Simülasyonda önde/arkada durma sırası (1: En arkada, 6: En önde)"
                      >
                        <option value={1}>1 (En Arka)</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        <option value={6}>6 (En Ön)</option>
                      </select>
                    </div>
                  </div>

                  {/* Çizgi Türü (Line Style: Düz, Kesikli, Noktalı) */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <label className="text-slate-400 text-[10px] whitespace-nowrap">Çizgi Türü:</label>
                    <select
                      disabled={!gb.active}
                      value={gb.lineStyle || 'solid'}
                      onChange={(e) =>
                        handleGbChange(id, 'lineStyle', e.target.value as any)
                      }
                      className="bg-[#111827] border border-slate-700 rounded px-1.5 py-0.5 text-white text-[11px] focus:outline-none disabled:opacity-40 cursor-pointer"
                    >
                      <option value="solid">Düz (Solid)</option>
                      <option value="dashed">Kesikli (Dashed)</option>
                      <option value="long-dash">Geniş Kesikli (Long Dash)</option>
                      <option value="dotted">Noktalı (Dotted)</option>
                      <option value="dash-dot">Çizgi-Nokta (Dash-Dot)</option>
                      <option value="dash-dot-dot">Çizgi-Çift Nokta (Dash-2Dots)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Dizilim:</span>
                  <strong className="text-blue-400 font-mono truncate max-w-[100px]">
                    {gb.threading || 'Full'}
                  </strong>
                </div>

                {gb.active && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex justify-center">
                    <GuideBarCalcBadge
                      metrics={calculateGuideBarMetrics(
                        id,
                        gb,
                        rows,
                        machine,
                        safety,
                        fabricWidthCm
                      )}
                      compact={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
