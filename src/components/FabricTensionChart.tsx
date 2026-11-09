import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  PatternData,
  GuideBarId,
  GuideBarConfig,
  MachineProfile,
} from '../types';
import {
  Activity,
  Zap,
  Gauge,
  AlertTriangle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';

interface FabricTensionChartProps {
  pattern: PatternData;
  onChangeMachineRpm?: (newRpm: number) => void;
  onChangeMachine?: (machine: MachineProfile) => void;
}

export const FabricTensionChart: React.FC<FabricTensionChartProps> = ({
  pattern,
  onChangeMachineRpm,
  onChangeMachine,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'course' | 'speed' | 'bars'>('course');
  const [selectedBar, setSelectedBar] = useState<GuideBarId | 'ALL'>('ALL');
  const [customRpm, setCustomRpm] = useState<number>(pattern.machine?.rpm || 600);

  // Sync custom Rpm if pattern machine rpm changes externally
  const currentRpm = customRpm;

  const rows = pattern.rows || [];
  const guideBars = pattern.guideBars || {};
  const activeGbIds = (['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'] as GuideBarId[]).filter(
    (id) => guideBars[id]?.active
  );

  // Calculate course-by-course tension data
  const tensionData = useMemo(() => {
    if (rows.length === 0) return [];

    const data: Array<{
      courseLabel: string;
      courseIndex: number;
      totalTension: number;
      avgTension: number;
      safeLimit: number;
      [key: string]: any;
    }> = [];

    const safeLimitThreshold = 35 + (currentRpm / 1000) * 15;

    rows.forEach((row, rIdx) => {
      const prevRow = rows[rIdx === 0 ? rows.length - 1 : rIdx - 1];
      let sumTension = 0;
      const courseItem: any = {
        courseLabel: `${row.courseIndex}. Kurs`,
        courseIndex: row.courseIndex,
        safeLimit: Number(safeLimitThreshold.toFixed(1)),
      };

      activeGbIds.forEach((gbId) => {
        const gb = guideBars[gbId];
        const baseTension = gb?.tension || 16;
        const dtex = gb?.dtex || 167;
        const currentPos = row[gbId] || 0;
        const prevPos = prevRow[gbId] || 0;
        const jumpDelta = Math.abs(currentPos - prevPos);

        // Physics-based Warp Knitting Tension Formula
        // T_dynamic = T_base * (1 + 0.15 * (deltaN^1.4)) * (1 + 0.5 * (RPM/600)^1.2) * (1 + dtex/2000)
        const jumpFactor = 1 + 0.15 * Math.pow(jumpDelta, 1.4);
        const speedFactor = 1 + 0.5 * Math.pow(currentRpm / 600, 1.2);
        const dtexFactor = 1 + dtex / 2000;

        const gbTension = baseTension * jumpFactor * speedFactor * dtexFactor;
        const finalGbTension = Number(gbTension.toFixed(1));

        courseItem[gbId] = finalGbTension;
        courseItem[`${gbId}_jump`] = jumpDelta;
        sumTension += finalGbTension;
      });

      const totalComp = Number(sumTension.toFixed(1));
      const avgComp = Number((sumTension / Math.max(1, activeGbIds.length)).toFixed(1));

      courseItem.totalTension = totalComp;
      courseItem.avgTension = avgComp;

      data.push(courseItem);
    });

    return data;
  }, [rows, guideBars, activeGbIds, currentRpm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    if (tensionData.length === 0) {
      return {
        peakTension: 0,
        peakCourse: 0,
        avgTension: 0,
        riskLevel: 'Düşük',
        riskColor: 'text-emerald-400',
        exceedCount: 0,
      };
    }

    let maxT = 0;
    let peakC = 1;
    let sumT = 0;
    let exceedCnt = 0;
    const safeLimit = tensionData[0]?.safeLimit || 45;

    tensionData.forEach((d) => {
      if (d.totalTension > maxT) {
        maxT = d.totalTension;
        peakC = d.courseIndex;
      }
      sumT += d.totalTension;
      if (d.totalTension > safeLimit) {
        exceedCnt++;
      }
    });

    const avgT = sumT / tensionData.length;
    let riskLevel = 'Güvenli (Düşük Yük)';
    let riskColor = 'text-emerald-400';

    if (exceedCnt > 0 || maxT > safeLimit * 1.2) {
      riskLevel = 'Yüksek Risk (Aşırı Gerilim)';
      riskColor = 'text-rose-400 animate-pulse';
    } else if (maxT > safeLimit * 0.9) {
      riskLevel = 'Orta Risk (Sınıra Yakın)';
      riskColor = 'text-amber-400';
    }

    return {
      peakTension: Number(maxT.toFixed(1)),
      peakCourse: peakC,
      avgTension: Number(avgT.toFixed(1)),
      riskLevel,
      riskColor,
      exceedCount: exceedCnt,
    };
  }, [tensionData]);

  // Speed vs Tension Sensitivity Data (200 - 1400 RPM)
  const speedSensitivityData = useMemo(() => {
    if (rows.length === 0) return [];
    const speeds = [200, 400, 600, 800, 1000, 1200, 1400];

    return speeds.map((rpmVal) => {
      let sumTot = 0;
      rows.forEach((row, rIdx) => {
        const prevRow = rows[rIdx === 0 ? rows.length - 1 : rIdx - 1];
        activeGbIds.forEach((gbId) => {
          const gb = guideBars[gbId];
          const baseT = gb?.tension || 16;
          const dtex = gb?.dtex || 167;
          const jumpDelta = Math.abs((row[gbId] || 0) - (prevRow[gbId] || 0));

          const jumpFactor = 1 + 0.15 * Math.pow(jumpDelta, 1.4);
          const speedFactor = 1 + 0.5 * Math.pow(rpmVal / 600, 1.2);
          const dtexFactor = 1 + dtex / 2000;

          sumTot += baseT * jumpFactor * speedFactor * dtexFactor;
        });
      });

      const avgT = sumTot / (rows.length * Math.max(1, activeGbIds.length));
      const safeLim = 35 + (rpmVal / 1000) * 15;

      return {
        rpm: `${rpmVal} RPM`,
        rpmVal,
        avgTension: Number(avgT.toFixed(1)),
        safeLimit: Number(safeLim.toFixed(1)),
        isCurrent: Math.abs(rpmVal - currentRpm) <= 100,
      };
    });
  }, [rows, guideBars, activeGbIds, currentRpm]);

  // Bar Contribution Breakdown Data
  const barContributionData = useMemo(() => {
    if (tensionData.length === 0) return [];
    return activeGbIds.map((gbId) => {
      const gb = guideBars[gbId];
      let sumGb = 0;
      let maxGb = 0;
      tensionData.forEach((d) => {
        const val = d[gbId] || 0;
        sumGb += val;
        if (val > maxGb) maxGb = val;
      });
      const avgGb = sumGb / tensionData.length;
      return {
        name: gbId,
        fullName: gb?.name || gbId,
        avgTension: Number(avgGb.toFixed(1)),
        peakTension: Number(maxGb.toFixed(1)),
        color: gb?.color || '#3b82f6',
        yarnType: gb?.yarnType || 'Polyester',
        dtex: gb?.dtex || 167,
      };
    });
  }, [tensionData, activeGbIds, guideBars]);

  const handleRpmChange = (newRpm: number) => {
    const clamped = Math.max(100, Math.min(1800, newRpm));
    setCustomRpm(clamped);
    if (onChangeMachineRpm) {
      onChangeMachineRpm(clamped);
    }
    if (onChangeMachine && pattern.machine) {
      onChangeMachine({
        ...pattern.machine,
        rpm: clamped,
      });
    }
  };

  return (
    <section className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 sm:p-3.5 space-y-3 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-950/80 border border-blue-800 rounded-lg text-blue-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>Kumaş Gerilim & Dinamik Yük Analizi</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-full">
                D3 / Recharts Çizimi
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              İğne tarak travers atlamaları (shogging) ve makine devir hızına (RPM) göre kurs bazlı tahmini gerilim (cN).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Collapse/Expand button */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-2.5 py-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <span>{isExpanded ? 'Daralt' : 'Grafiği Göster'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Quick Metrics & Interactive RPM Control Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* RPM Speed Control Widget */}
            <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Makine Hızı:</span>
                </span>
                <span className="text-xs font-bold text-blue-400 font-mono tabular-nums">
                  {currentRpm} RPM
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={1500}
                step={50}
                value={currentRpm}
                onChange={(e) => handleRpmChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Peak Tension Card */}
            <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Maksimum Pik Yük</span>
                </span>
                <div className="flex items-baseline gap-1">
                  <strong className="text-sm font-bold text-amber-300 font-mono tabular-nums">
                    {metrics.peakTension} cN
                  </strong>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({metrics.peakCourse}. Kurs)
                  </span>
                </div>
              </div>
            </div>

            {/* Mean Tension Card */}
            <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Ortalama Gerilim</span>
                </span>
                <strong className="text-sm font-bold text-cyan-300 font-mono tabular-nums">
                  {metrics.avgTension} cN
                </strong>
              </div>
            </div>

            {/* Risk Status Card */}
            <div className="bg-[#0B0F17] p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Gerilim Güvenlik Durumu</span>
                </span>
                <span className={`text-xs font-bold ${metrics.riskColor} block truncate`}>
                  {metrics.riskLevel}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Selector for Chart Views */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B0F17] p-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('course')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'course'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Kurs Bazlı Gerilim Eğrisi
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('speed')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'speed'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Devir (RPM) Duyarlılığı
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bars')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'bars'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Tarak Bazlı Yük Dağılımı
              </button>
            </div>

            {activeTab === 'course' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Tarak Filtresi:</span>
                <button
                  type="button"
                  onClick={() => setSelectedBar('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                    selectedBar === 'ALL'
                      ? 'bg-slate-700 text-white'
                      : 'bg-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  Tümü (Toplam)
                </button>
                {activeGbIds.map((gbId) => {
                  const gb = guideBars[gbId];
                  return (
                    <button
                      key={gbId}
                      type="button"
                      onClick={() => setSelectedBar(gbId)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedBar === gbId
                          ? 'ring-1 ring-white text-white'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${gb?.color || '#3b82f6'}33`,
                        color: gb?.color || '#3b82f6',
                        borderColor: gb?.color || '#3b82f6',
                      }}
                    >
                      {gbId}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* MAIN RECHARTS GRAPH CONTAINER */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 h-72 sm:h-80 w-full relative">
            {activeTab === 'course' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tensionData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="courseLabel"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    unit=" cN"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                    formatter={(value: any, name: any) => [`${value} cN`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />

                  {/* Safety Limit Reference Line */}
                  <ReferenceLine
                    y={tensionData[0]?.safeLimit || 45}
                    label={{
                      value: `Maks Güvenli Limit (${tensionData[0]?.safeLimit || 45} cN)`,
                      fill: '#f43f5e',
                      fontSize: 10,
                      position: 'top',
                    }}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />

                  {selectedBar === 'ALL' ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="totalTension"
                        name="Toplam Kumaş Yükü"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                        strokeWidth={2}
                      />
                      {activeGbIds.map((gbId) => (
                        <Line
                          key={gbId}
                          type="monotone"
                          dataKey={gbId}
                          name={`${gbId} Gerilimi`}
                          stroke={guideBars[gbId]?.color || '#38bdf8'}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      ))}
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey={selectedBar}
                      name={`${selectedBar} Dinamik Yük`}
                      stroke={guideBars[selectedBar]?.color || '#3b82f6'}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: guideBars[selectedBar]?.color || '#3b82f6' }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'speed' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedSensitivityData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="rpm" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" cN" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="avgTension" name="Ortalama Gerilim (cN)" radius={[4, 4, 0, 0]}>
                    {speedSensitivityData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isCurrent ? '#3b82f6' : entry.avgTension > entry.safeLimit ? '#f43f5e' : '#0284c7'}
                      />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="safeLimit" name="Güvenli Eşik Limiti" stroke="#f43f5e" strokeWidth={2} strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeTab === 'bars' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barContributionData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" cN" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d16',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="avgTension" name="Ortalama Gerilim (cN)" radius={[4, 4, 0, 0]}>
                    {barContributionData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                  <Bar dataKey="peakTension" name="Pik Gerilim (cN)" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Dynamic Technical Guidance Note */}
          <div className="bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-white font-bold block">Tekstil Mühendisliği Gerilim Notu:</span>
              <p>
                Çözgülü örme tezgahlarında tarak atlamaları ($\Delta N$) arttıkça iplik ilmek çekim açısı dikleşir ve dynamic tension spike oluşur.
                Makine devrini ({currentRpm} RPM) artırmak lineer iplik besleme hızını yükseltir. Gerilim grafiğinde kırmızı çizginin üzerindeki pikler ilmek kopması riski taşır.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
