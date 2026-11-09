import React from 'react';
import { PatternData, MachineProfile } from '../types';
import { PatternSummaryPanel } from './PatternSummaryPanel';
import { FabricTensionChart } from './FabricTensionChart';
import { Activity, Sparkles, ShieldCheck } from 'lucide-react';

interface AnalysisTabProps {
  pattern: PatternData;
  fabricWidthCm?: number;
  onChangeMachine?: (machine: MachineProfile) => void;
  onOpenSafetySettings?: () => void;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  pattern,
  fabricWidthCm = 410,
  onChangeMachine,
  onOpenSafetySettings,
}) => {
  return (
    <div className="w-full max-w-none px-1.5 sm:px-3 py-2 sm:py-3 space-y-3 sm:space-y-4 font-sans">
      {/* Top Banner Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 border border-blue-700/80 rounded-xl text-blue-400 shadow-md">
            <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <span>Desen & Üretim Analiz Raporu</span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-full font-bold">
                5. SAYFA (CAD ANALİZ)
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Desen yoğunluğu, iplik tüketim metrajı, örme zorluk derecesi ve kumaş gerilim yükü grafiği.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Desen: <strong className="text-white">{pattern.title}</strong></span>
          </span>
          <span className="px-3 py-1 bg-[#0B0F17] border border-slate-700 rounded-lg text-slate-300 flex items-center gap-1.5 hidden sm:flex">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fayn: <strong className="text-emerald-400">{pattern.machine?.gauge || 'E22'}</strong></span>
          </span>
        </div>
      </div>

      {/* 1. DESEN ÖZET PANOLARI (İğne Yoğunluğu, İplik Miktarı & Örme Zorluk Derecesi) */}
      <PatternSummaryPanel
        pattern={pattern}
        fabricWidthCm={fabricWidthCm}
        onOpenSafetySettings={onOpenSafetySettings}
      />

      {/* 2. KUMAŞ GERİLİM YÜKÜ & DİNAMİK YAN AL RAPORU (D3/RECHARTS GRAFİĞİ) */}
      <FabricTensionChart pattern={pattern} onChangeMachine={onChangeMachine} />
    </div>
  );
};
