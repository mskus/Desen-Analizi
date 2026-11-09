import React, { useState, useMemo } from 'react';
import { PatternData, GuideBarId } from '../types';
import { calculateGuideBarMetrics, parseMachineGauge } from '../utils/fabricCalculator';
import {
  PieChart,
  Layers,
  Gauge,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  BarChart3,
  Sparkles,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

interface PatternSummaryPanelProps {
  pattern: PatternData;
  fabricWidthCm?: number;
  onOpenSafetySettings?: () => void;
}

export const PatternSummaryPanel: React.FC<PatternSummaryPanelProps> = ({
  pattern,
  fabricWidthCm = 410,
  onOpenSafetySettings,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const rows = pattern.rows || [];
  const guideBars = pattern.guideBars || {};
  const activeGbIds = (['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'] as GuideBarId[]).filter(
    (id) => guideBars[id]?.active
  );

  const gaugeNumber = parseMachineGauge(pattern.machine?.gauge);
  const currentRpm = pattern.machine?.rpm || 600;

  // 1. Calculate Guide Bar Metrics for all active guide bars
  const gbCalculations = useMemo(() => {
    const map: Partial<Record<GuideBarId, ReturnType<typeof calculateGuideBarMetrics>>> = {};
    activeGbIds.forEach((id) => {
      const gb = guideBars[id];
      if (gb) {
        map[id] = calculateGuideBarMetrics(
          id,
          gb,
          rows,
          pattern.machine,
          pattern.safety || { maxAllowedNeedleNumber: 128 },
          fabricWidthCm
        );
      }
    });
    return map;
  }, [activeGbIds, guideBars, rows, pattern.machine, pattern.safety, fabricWidthCm]);

  // 2. Compute Needle Density Metrics (İğne Yoğunluğu)
  const needleDensityMetrics = useMemo(() => {
    if (activeGbIds.length === 0) {
      return {
        totalFilledNeedles: 0,
        totalEmptyNeedles: 0,
        fillRatePercent: 0,
        avgBarDensityPerNeedle: 0,
        needleLimit: 0,
        densityLabel: 'Boş',
        densityColor: 'text-slate-400',
      };
    }

    let totalFilled = 0;
    let totalSlots = 0;
    let needleLimit = 0;

    activeGbIds.forEach((id) => {
      const calc = gbCalculations[id];
      if (calc) {
        totalFilled += calc.threadingInCount;
        totalSlots += calc.threadingRepeat;
        if (calc.needleLimit > needleLimit) {
          needleLimit = calc.needleLimit;
        }
      }
    });

    const totalEmpty = Math.max(0, totalSlots - totalFilled);
    const fillRatePercent = totalSlots > 0 ? Math.round((totalFilled / totalSlots) * 100) : 0;
    const avgBarDensityPerNeedle =
      totalSlots > 0 ? Number((totalFilled / (totalSlots / activeGbIds.length)).toFixed(2)) : 0;

    let densityLabel = 'Dengeli / Standart';
    let densityColor = 'text-emerald-400';

    if (fillRatePercent > 80) {
      densityLabel = 'Yüksek Yoğunluklu Dolu Örgü';
      densityColor = 'text-blue-400';
    } else if (fillRatePercent < 40) {
      densityLabel = 'Seyrek / Gözenekli Mesh Örgü';
      densityColor = 'text-amber-400';
    }

    return {
      totalFilledNeedles: totalFilled,
      totalEmptyNeedles: totalEmpty,
      fillRatePercent,
      avgBarDensityPerNeedle,
      needleLimit,
      densityLabel,
      densityColor,
    };
  }, [activeGbIds, gbCalculations]);

  // 3. Compute Yarn Consumption Metrics (Kullanılan İplik Miktarı & Detayları)
  const yarnConsumptionMetrics = useMemo(() => {
    let totalYarnEnds = 0;
    const barBreakdown: Array<{
      gbId: GuideBarId;
      name: string;
      color: string;
      yarnType: string;
      dtex: number;
      requiredYarnCount: number;
      repeatCount: number;
      patternRepeatNeedles: number;
    }> = [];

    activeGbIds.forEach((id) => {
      const gb = guideBars[id];
      const calc = gbCalculations[id];
      if (gb && calc) {
        totalYarnEnds += calc.requiredYarnCount;
        barBreakdown.push({
          gbId: id,
          name: gb.name || id,
          color: gb.color || '#3b82f6',
          yarnType: gb.yarnType || 'Polyester',
          dtex: gb.dtex || 167,
          requiredYarnCount: calc.requiredYarnCount,
          repeatCount: calc.repeatCount,
          patternRepeatNeedles: calc.patternRepeatNeedles,
        });
      }
    });

    // Estimate average runner length factor (rack yarn consumption coefficient)
    let maxJump = 0;
    rows.forEach((r) => {
      activeGbIds.forEach((id) => {
        const val = r[id] || 0;
        if (val > maxJump) maxJump = val;
      });
    });

    const estRunnerLengthMm = Math.round(480 + maxJump * 85 + (currentRpm / 600) * 40);

    return {
      totalYarnEnds,
      barBreakdown,
      estRunnerLengthMm,
      maxJump,
    };
  }, [activeGbIds, guideBars, gbCalculations, rows, currentRpm]);

  // 4. Compute Knitting Difficulty Level (Örme Zorluk Derecesi)
  const knittingDifficultyMetrics = useMemo(() => {
    if (rows.length === 0 || activeGbIds.length === 0) {
      return {
        score: 0,
        level: 'Bilinmiyor',
        levelColor: 'text-slate-400',
        badgeBg: 'bg-slate-900 border-slate-700 text-slate-300',
        reasons: ['Desen veya tarak verisi eksik.'],
        isExtremeRisk: false,
        maxShogJump: 0,
        avgShogJump: 0,
        maxGbGap: 0,
      };
    }

    let maxShogJump = 0;
    let totalShogJumps = 0;
    let jumpCount = 0;

    // Analyze row-by-row shogging jumps
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const r = rows[rIdx];
      const prevR = rows[rIdx === 0 ? rows.length - 1 : rIdx - 1];

      activeGbIds.forEach((id) => {
        const currentPos = r[id] || 0;
        const prevPos = prevR[id] || 0;
        const delta = Math.abs(currentPos - prevPos);
        if (delta > maxShogJump) maxShogJump = delta;
        totalShogJumps += delta;
        jumpCount++;
      });
    }

    const avgShogJump = jumpCount > 0 ? totalShogJumps / jumpCount : 0;

    // Check maximum lateral gap between guide bars (ΔGB)
    let maxGbGap = 0;
    if (activeGbIds.length >= 2) {
      rows.forEach((r) => {
        for (let i = 0; i < activeGbIds.length - 1; i++) {
          const shift1 = r[activeGbIds[i]] || 0;
          const shift2 = r[activeGbIds[i + 1]] || 0;
          const gap = Math.abs(shift1 - shift2);
          if (gap > maxGbGap) maxGbGap = gap;
        }
      });
    }

    // Difficulty score formula (0 - 100)
    let score =
      maxShogJump * 5.5 +
      avgShogJump * 8 +
      activeGbIds.length * 4 +
      (currentRpm / 600) * 10 +
      maxGbGap * 2.5;

    score = Math.min(100, Math.max(10, Math.round(score)));

    const reasons: string[] = [];

    if (maxShogJump > 6) {
      reasons.push(`Büyük travers atlama zirvesi (Maks ΔN: ${maxShogJump} İğne)`);
    } else if (maxShogJump > 3) {
      reasons.push(`Orta derece travers hareketi (Maks ΔN: ${maxShogJump} İğne)`);
    } else {
      reasons.push(`Standart düşük travers hareketi (Maks ΔN: ${maxShogJump} İğne)`);
    }

    if (activeGbIds.length >= 4) {
      reasons.push(`Çoklu tarak kullanımı (${activeGbIds.length} Aktif Tarak)`);
    }

    if (maxGbGap > 4) {
      reasons.push(`Yüksek yanal tarak açıklığı (Maks ΔGB: ${maxGbGap} İğne)`);
    }

    if (currentRpm > 900) {
      reasons.push(`Yüksek makine devri (${currentRpm} RPM)`);
    }

    let level = 'Kolay (Düşük Risk)';
    let levelColor = 'text-emerald-400';
    let badgeBg = 'bg-emerald-950/80 border-emerald-700 text-emerald-200';
    let isExtremeRisk = false;

    if (score >= 75 || maxShogJump >= 8) {
      level = 'Aşırı Zor (Yüksek İğne Kırılma Riski)';
      levelColor = 'text-rose-400 animate-pulse';
      badgeBg = 'bg-rose-950/90 border-rose-700 text-rose-200';
      isExtremeRisk = true;
    } else if (score >= 50 || maxShogJump >= 5) {
      level = 'Yüksek (Hassas Ayar Gerektirir)';
      levelColor = 'text-amber-400';
      badgeBg = 'bg-amber-950/80 border-amber-700 text-amber-200';
    } else if (score >= 30) {
      level = 'Orta (Normal Üretim)';
      levelColor = 'text-blue-400';
      badgeBg = 'bg-blue-950/80 border-blue-700 text-blue-200';
    }

    return {
      score,
      level,
      levelColor,
      badgeBg,
      reasons,
      maxShogJump,
      avgShogJump: Number(avgShogJump.toFixed(1)),
      maxGbGap,
      isExtremeRisk,
    };
  }, [rows, activeGbIds, currentRpm]);

  return (
    <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3.5 shadow-xl font-sans">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-700/70 rounded-xl text-blue-400 shadow-md">
            <PieChart className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Desen Özet Paneli</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-full">
                Tekstil CAD Analizi
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              İğne doluluk oranı, toplam iplik tüketimi ve örgü üretim zorluk endeksi özeti.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0B0F17] border border-slate-700 rounded-lg text-xs font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Fayn: <strong>E{gaugeNumber}</strong></span>
            <span className="text-slate-600">|</span>
            <span>En: <strong>{fabricWidthCm} cm</strong></span>
          </span>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2.5 py-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <span>{isExpanded ? 'Gizle' : 'Özeti Göster'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* TOP 3 SUMMARY CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* CARD 1: İĞNE YOĞUNLUĞU (Needle Density) */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>1. İğne Yoğunluğu</span>
                  </span>
                  <span className={`text-xs font-bold ${needleDensityMetrics.densityColor} font-mono`}>
                    %{needleDensityMetrics.fillRatePercent} Dolu
                  </span>
                </div>

                {/* Main Metric Stat */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
                      %{needleDensityMetrics.fillRatePercent}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {needleDensityMetrics.densityLabel}
                    </span>
                  </div>

                  {/* Visual Progress Meter Bar */}
                  <div className="w-24 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700 p-0.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${needleDensityMetrics.fillRatePercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sub-Details Breakdown */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Dolu İğne Dizilimi:</span>
                  <strong className="text-emerald-400 font-bold">{needleDensityMetrics.totalFilledNeedles} İğne</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Boş İğne Dizilimi:</span>
                  <strong className="text-rose-400 font-bold">{needleDensityMetrics.totalEmptyNeedles} İğne</strong>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 font-sans">Kumaş Toplam Limit:</span>
                  <strong className="text-blue-300 font-bold">{needleDensityMetrics.needleLimit} İğne</strong>
                </div>
              </div>
            </div>

            {/* CARD 2: KULLANILAN İPLİK MİKTARI (Yarn Consumption & Specifications) */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>2. İplik Miktarı & Tel</span>
                  </span>
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    {yarnConsumptionMetrics.totalYarnEnds.toLocaleString()} Tel
                  </span>
                </div>

                {/* Main Metric Stat */}
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-2xl font-extrabold text-cyan-300 font-mono tabular-nums">
                      {yarnConsumptionMetrics.totalYarnEnds.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Toplam Çözgü İplik Bobin Teli
                    </span>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    <span className="text-slate-300 font-bold">~{yarnConsumptionMetrics.estRunnerLengthMm} mm</span>
                    <span className="block text-[10px] text-slate-500">Rack Harcat</span>
                  </div>
                </div>
              </div>

              {/* Guide Bar Yarn Chips */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 font-medium block">Tarak Bazlı İplik Dağılımı:</span>
                <div className="flex flex-wrap gap-1">
                  {yarnConsumptionMetrics.barBreakdown.map((bar) => (
                    <span
                      key={bar.gbId}
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-bold flex items-center gap-1 border border-slate-700/80 bg-[#111827]"
                      style={{ color: bar.color }}
                      title={`${bar.name} (${bar.yarnType} ${bar.dtex} dtex): ${bar.requiredYarnCount} Tel`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bar.color }} />
                      <span>{bar.gbId}:</span>
                      <span className="text-white">{bar.requiredYarnCount}T</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* CARD 3: ÖRME ZORLUK DERECESİ (Knitting Difficulty Level) */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-lg">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>3. Örme Zorluk Derecesi</span>
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${knittingDifficultyMetrics.badgeBg}`}>
                    Puan: {knittingDifficultyMetrics.score}/100
                  </span>
                </div>

                {/* Main Metric Stat */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    {knittingDifficultyMetrics.isExtremeRisk ? (
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    <span className={`text-sm font-extrabold ${knittingDifficultyMetrics.levelColor}`}>
                      {knittingDifficultyMetrics.level}
                    </span>
                  </div>

                  {/* Difficulty Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        knittingDifficultyMetrics.score >= 75
                          ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                          : knittingDifficultyMetrics.score >= 50
                          ? 'bg-gradient-to-r from-blue-500 to-amber-400'
                          : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      }`}
                      style={{ width: `${knittingDifficultyMetrics.score}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Risk Reasons List */}
              <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Maks Travers Atlama ($\Delta N$):</span>
                  <strong className="text-white font-mono">{knittingDifficultyMetrics.maxShogJump} İğne</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Maks Tarak Açıklığı ($\Delta GB$):</span>
                  <strong className="text-white font-mono">{knittingDifficultyMetrics.maxGbGap} İğne</strong>
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED TECHNICAL BREAKDOWN & RECOMMENDATIONS */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Teknik Üretim & Mühendislik Rapor Özeti</span>
              </span>

              {onOpenSafetySettings && (
                <button
                  type="button"
                  onClick={onOpenSafetySettings}
                  className="px-2 py-0.5 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Güvenlik Ayarlarını Düzenle
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 text-[11px]">
              <div className="space-y-1 bg-[#0B0F17] p-2 rounded border border-slate-800">
                <span className="text-slate-400 font-semibold block flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dizilim & Tel Yoğunluğu Tespiti:</span>
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Deseniniz <strong>E{gaugeNumber}</strong> faynlı makinede <strong>{fabricWidthCm} cm</strong> en için hesaplanmıştır.
                  Toplam <strong>{yarnConsumptionMetrics.totalYarnEnds.toLocaleString()} tel çözgü ipliği</strong> kullanılacaktır.
                  Dolu iğne doluluk oranı <strong>%{needleDensityMetrics.fillRatePercent}</strong> seviyesindedir.
                </p>
              </div>

              <div className="space-y-1 bg-[#0B0F17] p-2 rounded border border-slate-800">
                <span className="text-slate-400 font-semibold block flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Örme Zorluk Derecesi & Risk Değerlendirmesi:</span>
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Örme zorluk endeksi <strong>{knittingDifficultyMetrics.score}/100</strong> seviyesindedir.
                  En yüksek travers hareketi <strong>{knittingDifficultyMetrics.maxShogJump} iğne</strong> atlama mesafesindedir.
                  {knittingDifficultyMetrics.isExtremeRisk
                    ? ' DİKKAT: Yüksek travers hareketi nedeniyle makine devrini düşürmeniz ve iplik gerilim yaylarını sık sık kontrol etmeniz önerilir.'
                    : ' Üretim parametreleri güvenli çalışma aralığındadır.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
