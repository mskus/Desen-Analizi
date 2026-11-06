import React, { useState } from 'react';
import { GuideBarId, GuideBarConfig, PatternRow, MachineProfile, SafetyConfig } from '../types';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react';

export interface GuideBarCalculationResult {
  gbId: GuideBarId;
  fabricWidthCm: number;
  fabricWidthInch: number;
  gaugeNumber: number;
  needleLimit: number; // N_limit
  movementSpan: number; // 0'dan desende o tarağın ulaştığı en büyük iğneye kadar olan mesafe (Maks İğne)
  threadingInCount: number; // Dolu İğne
  threadingOutCount: number; // Boş İğne
  threadingRepeat: number; // Taar Genişliği (Dolu + Boş)
  patternRepeatNeedles: number; // Rapor İğne Genişliği = Hareket + Taar
  repeatCount: number; // Taar Tekrar Sayısı (küsuratlı)
  fullRepeats: number; // Tam Tekrar
  remainingNeedles: number; // Artan İğne
  requiredYarnCount: number; // Bu tarak için toplam gerekli iplik (bobin/çözgü teli) sayısı = Dolu İğne * Tekrar Sayısı
  isExceedingLimit: boolean;
  isExceedingSafety: boolean;
  hasWarning: boolean;
  warningMessage?: string;
}

/**
 * Makine faynından sayısal E değerini ayrıştırır (Örn: "E22" -> 22, "E28" -> 28, default 22)
 */
export function parseMachineGauge(gaugeStr?: string): number {
  if (!gaugeStr) return 22;
  const match = gaugeStr.match(/\d+/);
  if (match) {
    const val = parseInt(match[0], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 22;
}

/**
 * Bir tarak için Kumaş Eni, İğne Limiti, Taar Genişliği ve Tekrar Sayısı hesaplar
 */
export function calculateGuideBarMetrics(
  gbId: GuideBarId,
  gbConfig: GuideBarConfig,
  rows: PatternRow[],
  machine: MachineProfile,
  safety: SafetyConfig,
  fabricWidthCm: number
): GuideBarCalculationResult {
  const safeWidthCm = Math.max(1, fabricWidthCm || 410);
  const gaugeNumber = parseMachineGauge(machine?.gauge);
  
  // 1. İğne Limiti Hesabı:
  // Kumaş Eni (İnç) = Kumaş Eni (cm) / 2.54
  // İğne Limiti (N_limit) = Kumaş Eni (İnç) * Makine Faynı (E)
  const fabricWidthInch = safeWidthCm / 2.54;
  const needleLimit = Math.round((fabricWidthInch * gaugeNumber) * 100) / 100;

  // 2. Tarak Bazlı Hareket Mesafesi (Dinamik):
  // 0 noktasından desende o tarağın ulaştığı en büyük (en son) iğne numarasına kadar olan mesafe (Maks İğne)
  let maxNeedle = 0;
  if (rows && rows.length > 0) {
    for (const r of rows) {
      const val = r[gbId] ?? 0;
      if (val > maxNeedle) {
        maxNeedle = val;
      }
    }
  }
  const movementSpan = maxNeedle;

  // 3. Taar Genişliği (Threading Repeat):
  // Tarağın iğne dizilimindeki bir periyotluk toplam iğne sayısı (Dolu İğne Sayısı + Boş İğne Sayısı)
  // Threading diziliminden tespit et (dizilim veya threadingArray bazlı)
  let threadingIn = 0;
  let threadingOut = 0;

  if (gbConfig?.threadingArray && gbConfig.threadingArray.length > 0) {
    // Tüm dizilimdeki dolu/boş dağılımı
    threadingIn = gbConfig.threadingArray.filter(Boolean).length;
    threadingOut = gbConfig.threadingArray.length - threadingIn;
  } else {
    // Varsayılan
    threadingIn = 16;
    threadingOut = 0;
  }

  // Taar genişliği = Dolu + Boş
  const threadingRepeat = Math.max(1, threadingIn + threadingOut);

  // 4. Tek Rapor Genişliği:
  // Rapor İğne Genişliği = Desenin Hareket Mesafesi + Taar Genişliği
  const patternRepeatNeedles = movementSpan + threadingRepeat;

  // 5. Taar Tekrar Sayısı (Olduğu gibi küsuratlı):
  // Tekrar Sayısı = İğne Limiti / Rapor İğne Genişliği
  const repeatCount =
    patternRepeatNeedles > 0
      ? Math.round((needleLimit / patternRepeatNeedles) * 100) / 100
      : 0;

  const fullRepeats = Math.floor(repeatCount);
  const remainingNeedles = Math.max(
    0,
    Math.round(needleLimit - fullRepeats * patternRepeatNeedles)
  );

  // Toplam gerekli iplik sayısı: Her rapordaki dolu iğne sayısı * Tekrar sayısı
  const requiredYarnCount = Math.round(threadingIn * repeatCount);

  // 6. Uyarı kontrolleri:
  // Tek bir rapor genişliği toplam iğne limitini aşıyorsa veya hareket mesafesi makine güvenlik sınırını aşıyorsa
  const isExceedingLimit = patternRepeatNeedles > needleLimit;
  const isExceedingSafety =
    safety?.maxAllowedNeedleNumber !== undefined &&
    movementSpan > safety.maxAllowedNeedleNumber;

  const hasWarning = isExceedingLimit || isExceedingSafety;
  let warningMessage: string | undefined;
  if (isExceedingLimit) {
    warningMessage = `Rapor genişliği (${patternRepeatNeedles}İ) kumaş iğne limitini (${needleLimit.toFixed(1)}İ) aşıyor!`;
  } else if (isExceedingSafety) {
    warningMessage = `Tarak hareketi (${movementSpan}İ) makine sınırını (${safety.maxAllowedNeedleNumber}İ) aşıyor!`;
  }

  return {
    gbId,
    fabricWidthCm: safeWidthCm,
    fabricWidthInch: Math.round(fabricWidthInch * 100) / 100,
    gaugeNumber,
    needleLimit,
    movementSpan,
    threadingInCount: threadingIn,
    threadingOutCount: threadingOut,
    threadingRepeat,
    patternRepeatNeedles,
    repeatCount,
    fullRepeats,
    remainingNeedles,
    requiredYarnCount,
    isExceedingLimit,
    isExceedingSafety,
    hasWarning,
    warningMessage,
  };
}

interface GuideBarCalcBadgeProps {
  metrics: GuideBarCalculationResult;
  compact?: boolean;
  barColor?: string;
  showRequiredYarn?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

export const GuideBarCalcBadge: React.FC<GuideBarCalcBadgeProps> = ({
  metrics,
  compact = false,
  barColor,
  showRequiredYarn = true,
  onClick,
  isSelected = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const gbColor = barColor || '#3b82f6';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => {
          if (onClick) onClick();
          else setShowTooltip((prev) => !prev);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`px-3 py-1 rounded-md text-xs font-mono font-semibold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs tabular-nums whitespace-nowrap ${
          isSelected ? 'ring-2 ring-white/90 scale-[1.02]' : 'hover:scale-[1.01]'
        }`}
        style={{
          backgroundColor: metrics.hasWarning ? '#4c0519' : isSelected ? `${gbColor}44` : `${gbColor}22`,
          borderColor: metrics.hasWarning ? '#e11d48' : isSelected ? '#ffffff' : `${gbColor}77`,
          color: metrics.hasWarning ? '#fca5a5' : '#f1f5f9',
        }}
        title={`${metrics.gbId} Tarağını Seç ve Detayları Gör`}
      >
        {metrics.hasWarning ? (
          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 animate-pulse" />
        ) : (
          <span
            className="w-2 h-2 rounded-xs shrink-0"
            style={{ backgroundColor: gbColor }}
          />
        )}
        <span>
          <strong style={{ color: gbColor }}>{metrics.gbId}:</strong>{' '}
          <strong className="text-white">{metrics.repeatCount}</strong> |{' '}
          <span className="text-slate-200">{metrics.patternRepeatNeedles}İ</span>
          {showRequiredYarn && !compact && (
            <>
              {' '}| <strong style={{ color: gbColor }} className="font-bold">{metrics.requiredYarnCount}T</strong>
            </>
          )}
        </span>
      </button>

      {/* Tooltip Popup / Popover (Drops downward to prevent clipping at top of screen) */}
      {showTooltip && (
        <div
          role="tooltip"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="absolute left-0 top-full mt-1.5 z-50 w-76 p-2.5 bg-[#0F172A] border border-slate-700 rounded-lg shadow-2xl text-xs font-sans text-slate-200 pointer-events-auto"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/80 mb-2">
            <span className="font-bold text-white flex items-center gap-1">
              <span className="text-blue-400">{metrics.gbId}</span>
              <span>Taar & Rapor Analizi</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-950/60 border border-blue-800 text-blue-300 rounded">
              E{metrics.gaugeNumber} / {metrics.fabricWidthCm}cm
            </span>
          </div>

          {metrics.hasWarning && (
            <div className="mb-2 p-1.5 bg-rose-950/70 border border-rose-700 rounded text-[11px] text-rose-200 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{metrics.warningMessage}</span>
            </div>
          )}

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Kumaş İğne Limiti:</span>
              <span className="text-emerald-400 font-bold">
                {metrics.needleLimit} İğne ({metrics.fabricWidthCm} cm)
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Tarak Hareket Aralığı:</span>
              <span className="text-blue-400 font-bold">
                0 → {metrics.movementSpan} ({metrics.movementSpan} İğne)
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Taar Yapısı:</span>
              <span className="font-bold">
                <span className="text-emerald-400">{metrics.threadingInCount}</span>
                <span className="text-slate-500 font-normal"> + </span>
                <span className="text-rose-400">{metrics.threadingOutCount}</span>
                <span className="text-slate-400 font-normal"> ({metrics.threadingRepeat} İğne)</span>
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Birim Rapor:</span>
              <span className="text-amber-300 font-bold">
                {metrics.patternRepeatNeedles} İğne
              </span>
            </div>

            <div className="flex justify-between items-center py-0.5 border-b border-slate-800/60">
              <span className="text-slate-400 font-sans">Gerekli İplik (Tel):</span>
              <span className="text-cyan-300 font-bold">
                {metrics.requiredYarnCount} Tel (<span className="text-emerald-400">{metrics.threadingInCount}</span> × {metrics.repeatCount})
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 text-white">
              <span className="text-slate-300 font-sans">Net Tekrar:</span>
              <span className="font-bold text-emerald-300">
                {metrics.repeatCount} Tekrar
              </span>
            </div>

            <div className="text-[10px] text-slate-400 pt-0.5 flex justify-end">
              <span>(Tam: {metrics.fullRepeats}, Artan: {metrics.remainingNeedles} İğne)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
