import React from 'react';
import { LoopLayerConfig } from '../types';
import {
  Layers,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
  Activity,
  CircleDot,
  Grid,
  GitCommit,
  Flame,
  Info
} from 'lucide-react';

interface LoopLayerManagerProps {
  layerConfig: LoopLayerConfig;
  onChangeLayerConfig: (updated: LoopLayerConfig) => void;
  stats?: {
    totalOpen: number;
    totalClosed: number;
    totalErrors: number;
    totalOvercrowded: number;
    totalUnanchored: number;
  };
}

export const LoopLayerManager: React.FC<LoopLayerManagerProps> = ({
  layerConfig,
  onChangeLayerConfig,
  stats,
}) => {
  const toggleLayer = (key: keyof LoopLayerConfig) => {
    onChangeLayerConfig({
      ...layerConfig,
      [key]: !layerConfig[key],
    });
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
            İlmek Katman Yöneticisi (Layer Manager)
          </h3>
        </div>

        {stats && (
          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800 text-sky-300 font-bold" title="Açık İlmek (Open)">
              Ω {stats.totalOpen}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 font-bold" title="Kapalı İlmek (Closed)">
              ⋈ {stats.totalClosed}
            </span>
            {stats.totalErrors > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-800 text-rose-300 font-bold animate-pulse" title="Gerilim / Atlama Hatası">
                ! {stats.totalErrors}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 6 Layer Checkbox Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
        {/* Layer 1: İlmek Başları */}
        <label
          onClick={() => toggleLayer('showLoopHeads')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showLoopHeads
              ? 'bg-blue-950/50 border-blue-600/80 text-blue-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <CircleDot className={`w-3.5 h-3.5 ${layerConfig.showLoopHeads ? 'text-blue-400' : 'text-slate-600'}`} />
            <span className="font-semibold">İlmek Başları (Loop Heads)</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showLoopHeads}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
          />
        </label>

        {/* Layer 2: İlmek Altı Köprüleri */}
        <label
          onClick={() => toggleLayer('showUnderlapFloats')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showUnderlapFloats
              ? 'bg-emerald-950/50 border-emerald-600/80 text-emerald-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Zap className={`w-3.5 h-3.5 ${layerConfig.showUnderlapFloats ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span className="font-semibold">İlmek Altı Köprüleri</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showUnderlapFloats}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0"
          />
        </label>

        {/* Layer 3: İğne Yatağı ve Kancaları */}
        <label
          onClick={() => toggleLayer('showNeedleBedGrid')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showNeedleBedGrid
              ? 'bg-amber-950/50 border-amber-600/80 text-amber-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Grid className={`w-3.5 h-3.5 ${layerConfig.showNeedleBedGrid ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className="font-semibold">İğne Yatağı & Kancalar</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showNeedleBedGrid}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-amber-600 focus:ring-0"
          />
        </label>

        {/* Layer 4: İplik Kesişim Düğümleri */}
        <label
          onClick={() => toggleLayer('showIntersectionNodes')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showIntersectionNodes
              ? 'bg-cyan-950/50 border-cyan-600/80 text-cyan-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <GitCommit className={`w-3.5 h-3.5 ${layerConfig.showIntersectionNodes ? 'text-cyan-400' : 'text-slate-600'}`} />
            <span className="font-semibold">Kesişim Düğümleri</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showIntersectionNodes}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-0"
          />
        </label>

        {/* Layer 5: Gerilim & Hata Katmanı */}
        <label
          onClick={() => toggleLayer('showTensionHeatmap')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showTensionHeatmap
              ? 'bg-rose-950/50 border-rose-600/80 text-rose-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Flame className={`w-3.5 h-3.5 ${layerConfig.showTensionHeatmap ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="font-semibold">Gerilim & Hata Heatmap</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showTensionHeatmap}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0"
          />
        </label>

        {/* Layer 6: Açık/Kapalı İlmek Simgeleri */}
        <label
          onClick={() => toggleLayer('showLoopTypeBadges')}
          className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer select-none ${
            layerConfig.showLoopTypeBadges
              ? 'bg-purple-950/50 border-purple-600/80 text-purple-200'
              : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Activity className={`w-3.5 h-3.5 ${layerConfig.showLoopTypeBadges ? 'text-purple-400' : 'text-slate-600'}`} />
            <span className="font-semibold">Açık/Kapalı Simgeler [O/C]</span>
          </div>
          <input
            type="checkbox"
            checked={layerConfig.showLoopTypeBadges}
            onChange={() => {}}
            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
          />
        </label>
      </div>
    </div>
  );
};
