import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PatternData, GuideBarId, RackTensionRow } from '../types';
import {
  Table2,
  Download,
  Copy,
  Check,
  Layers,
  Info,
  RotateCcw,
  Plus,
  Trash2,
  Gauge,
  SlidersHorizontal,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  ALL_GB_IDS,
  ALL_DOUBLE_MODES,
  DEFAULT_HRD6_MODES,
  StitchLoopMode,
  SkipBehaviorMode,
  ComputedStepRow,
  buildExpandedFourStepRows,
  loadSavedTableSettings,
  saveTableSettings,
  loadPatternTableExtras,
  savePatternTableExtras,
  generateAutoRackTensionRows,
  computePatternDifficulty,
} from '../utils/patternTableCalc';
import { calculateGuideBarMetrics } from '../utils/fabricCalculator';

export type { StitchLoopMode, SkipBehaviorMode };

interface PatternTableTabProps {
  pattern: PatternData;
  fabricWidthCm?: number;
  onUpdateTableExtras?: (
    mayDensity: string,
    rackTensionRows: RackTensionRow[],
    isRackManualOverride: boolean
  ) => void;
}

const MODE_LABELS: Record<StitchLoopMode, string> = {
  double_bed: 'Çift Ray İlmek',
  front_bed: 'Ön Ray İlmek',
  back_bed: 'Arka Ray İlmek',
  inlay: 'Atkı / Sabit',
};

const MODE_SHORT_FORMULAS: Record<StitchLoopMode, string> = {
  double_bed: 'N · N+1 · N · N+1',
  front_bed: 'N · N+1 · N+1 · N+1',
  back_bed: 'N · N · N · N+1',
  inlay: 'N · N · N · N',
};

export const PatternTableTab: React.FC<PatternTableTabProps> = ({
  pattern,
  fabricWidthCm = 410,
  onUpdateTableExtras,
}) => {
  const initialSettings = useMemo(() => loadSavedTableSettings(), []);
  const [barModes, setBarModes] = useState<Record<GuideBarId, StitchLoopMode>>(initialSettings.barModes);
  const [skipBehavior, setSkipBehavior] = useState<SkipBehaviorMode>(initialSettings.skipBehavior);
  const [loopWidth, setLoopWidth] = useState<number>(initialSettings.loopWidth);
  const [showAllBars, setShowAllBars] = useState<boolean>(false);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(1);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Manual Kumaş Sıklığı (May) & Rack Tansiyon Tablosu (Auto from skips unless manually edited)
  const initialExtras = useMemo(() => loadPatternTableExtras(pattern), [pattern.id]);
  const [mayDensity, setMayDensity] = useState<string>(initialExtras.mayDensity);
  const [rackTensionRows, setRackTensionRows] = useState<RackTensionRow[]>(
    initialExtras.rackTensionRows
  );
  const [isRackManualOverride, setIsRackManualOverride] = useState<boolean>(
    initialExtras.isRackManualOverride
  );
  const lastLoadedPatternIdRef = useRef<string>(pattern.id);

  // Reload when pattern changes
  useEffect(() => {
    if (lastLoadedPatternIdRef.current !== pattern.id) {
      lastLoadedPatternIdRef.current = pattern.id;
      const next = loadPatternTableExtras(pattern);
      setMayDensity(next.mayDensity);
      setRackTensionRows(next.rackTensionRows);
      setIsRackManualOverride(next.isRackManualOverride);
    }
  }, [pattern]);

  // If NOT manually overridden, automatically keep Rack Tension Table synced to pattern skips
  useEffect(() => {
    if (!isRackManualOverride) {
      const autoRows = generateAutoRackTensionRows(pattern.rows, pattern.guideBars);
      setRackTensionRows(autoRows);
    }
  }, [pattern.rows, pattern.guideBars, isRackManualOverride]);

  useEffect(() => {
    saveTableSettings({ barModes, skipBehavior, loopWidth });
  }, [barModes, skipBehavior, loopWidth]);

  const persistExtras = (
    nextMay: string,
    nextRackRows: RackTensionRow[],
    nextManualOverride: boolean
  ) => {
    savePatternTableExtras(pattern.id, {
      mayDensity: nextMay,
      rackTensionRows: nextRackRows,
      isRackManualOverride: nextManualOverride,
    });
    onUpdateTableExtras?.(nextMay, nextRackRows, nextManualOverride);
  };

  const handleMayChange = (val: string) => {
    setMayDensity(val);
    persistExtras(val, rackTensionRows, isRackManualOverride);
  };

  const handleRackCourseChange = (rowIdx: number, val: string) => {
    const next = rackTensionRows.map((r, idx) =>
      idx === rowIdx ? { ...r, courseCount: val } : r
    );
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras(mayDensity, next, true);
  };

  const handleRackBarValueChange = (rowIdx: number, gbId: GuideBarId, val: string) => {
    const next = rackTensionRows.map((r, idx) =>
      idx === rowIdx
        ? {
            ...r,
            values: {
              ...r.values,
              [gbId]: val,
            },
          }
        : r
    );
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras(mayDensity, next, true);
  };

  const handleAddRackRow = () => {
    const defaultValues: Partial<Record<GuideBarId, string>> = {};
    ALL_GB_IDS.forEach((gbId) => {
      defaultValues[gbId] = '17500';
    });
    const next = [
      ...rackTensionRows,
      {
        id: `rack-row-${Date.now()}-${rackTensionRows.length}`,
        courseCount: '',
        values: defaultValues,
      },
    ];
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras(mayDensity, next, true);
  };

  const handleDeleteRackRow = (rowIdx: number) => {
    const next =
      rackTensionRows.length <= 1
        ? [
            {
              id: `rack-row-${Date.now()}-0`,
              courseCount: '',
              values: {},
            },
          ]
        : rackTensionRows.filter((_, idx) => idx !== rowIdx);
    setRackTensionRows(next);
    setIsRackManualOverride(true);
    persistExtras(mayDensity, next, true);
  };

  const handleRecalculateRackFromSkips = () => {
    const autoRows = generateAutoRackTensionRows(pattern.rows, pattern.guideBars);
    setRackTensionRows(autoRows);
    setIsRackManualOverride(false);
    persistExtras(mayDensity, autoRows, false);
  };

  const rows = pattern.rows || [];

  const activeGbIds = useMemo(
    () => ALL_GB_IDS.filter((id) => pattern.guideBars[id]?.active),
    [pattern.guideBars]
  );

  // Maksimum Tel Sayısı & Desen Zorluğu
  const maxTelCount = useMemo(() => {
    let total = 0;
    activeGbIds.forEach((id) => {
      const gb = pattern.guideBars[id];
      if (gb) {
        const calc = calculateGuideBarMetrics(
          id,
          gb,
          rows,
          pattern.machine,
          pattern.safety,
          fabricWidthCm
        );
        total += calc.requiredYarnCount;
      }
    });
    return total;
  }, [activeGbIds, pattern.guideBars, rows, pattern.machine, pattern.safety, fabricWidthCm]);

  const difficultyInfo = useMemo(
    () => computePatternDifficulty(rows, activeGbIds, pattern.machine?.rpm || 600),
    [rows, activeGbIds, pattern.machine?.rpm]
  );

  const totalSkipCount = useMemo(() => {
    let cnt = 0;
    rows.forEach((r) => {
      if (r.skips) {
        ALL_GB_IDS.forEach((id) => {
          if (r.skips?.[id]) cnt++;
        });
      }
    });
    return cnt;
  }, [rows]);

  const displayBars = useMemo(() => {
    if (showAllBars) return ALL_GB_IDS;
    return activeGbIds.length > 0 ? activeGbIds : ALL_GB_IDS;
  }, [showAllBars, activeGbIds]);

  // Expand every course row into 4 machine step rows without changing pattern
  const expandedRows = useMemo<ComputedStepRow[]>(() => {
    return buildExpandedFourStepRows(rows, barModes, loopWidth, skipBehavior);
  }, [rows, barModes, loopWidth, skipBehavior]);

  const handleExportCsv = () => {
    const header = ['Kurs', 'Adim', ...displayBars].join(',');
    const lines = expandedRows.map((item) => {
      const courseLabel = item.stepInCourse === 1 ? String(item.courseIndex) : '';
      return [
        courseLabel,
        String(item.stepInCourse),
        ...displayBars.map((gb) => String(item.values[gb])),
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([header, ...lines].join('\r\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute(
      'download',
      `${pattern.title.toLowerCase().replace(/\s+/g, '_')}_4adim_desen_tablosu.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCopyTable = async () => {
    const header = ['Kurs', ...displayBars].join('\t');
    const lines = expandedRows.map((item) => {
      const courseLabel = item.stepInCourse === 1 ? String(item.courseIndex) : '';
      return [courseLabel, ...displayBars.map((gb) => String(item.values[gb]))].join('\t');
    });
    try {
      await navigator.clipboard.writeText([header, ...lines].join('\n'));
      setCopyStatus('4 adımlı tablo panoya kopyalandı (Excel’e yapıştırabilirsiniz).');
      setTimeout(() => setCopyStatus(null), 2600);
    } catch {
      setCopyStatus('Kopyalama desteklenmiyor.');
      setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const selectedCourseSource = useMemo(() => {
    if (selectedCourse === null) return null;
    return rows.find((r, idx) => (r.courseIndex || idx + 1) === selectedCourse) || null;
  }, [rows, selectedCourse]);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-1.5 sm:px-3 py-2 sm:py-3 space-y-2.5 sm:space-y-3 font-sans">
      {/* Header Banner */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xl">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-900 to-indigo-950 border border-blue-700/80 rounded-xl text-blue-400 shrink-0 shadow-md">
            <Table2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white flex flex-wrap items-center gap-2">
              <span>Makine 4 Adımlı Desen Tablosu</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full">
                {rows.length} Kurs × 4 = {expandedRows.length} Adım
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-full">
                Maks Tel: {maxTelCount.toLocaleString('tr-TR')} Tel
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-full">
                Zorluk: {difficultyInfo.shortLabel} ({difficultyInfo.score}/100)
              </span>
              {totalSkipCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-700 rounded-full">
                  {totalSkipCount} Atlama Aktif
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Aktif desen (<strong>{pattern.title}</strong>) değiştirilmeden 4 adımlı tablo ve atlamaya bağlı Rack tansiyon tablosu hesaplanır.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowAllBars((prev) => !prev)}
            className="px-2.5 py-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>{showAllBars ? 'Tüm Taraklar (GB1-GB6)' : 'Sadece Aktif Taraklar'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyTable}
            className="px-2.5 py-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Kopyala</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV İndir (4 Adım)</span>
          </button>
        </div>
      </section>

      {copyStatus && (
        <div className="bg-emerald-950/90 border border-emerald-700 text-emerald-100 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{copyStatus}</span>
        </div>
      )}

      {/* Stitch Structure Configuration Strip (Without mutating pattern) */}
      <section className="bg-[#111827] border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-200">Tarak İlmek Yapısı Seçimi:</span>
            <button
              type="button"
              onClick={() => setBarModes({ ...DEFAULT_HRD6_MODES })}
              className="px-2 py-1 bg-blue-950/70 hover:bg-blue-900/70 text-blue-200 border border-blue-800 rounded text-[11px] font-semibold cursor-pointer transition-colors"
            >
              HRD6-EL Karma (Ön/Arka/Çift)
            </button>
            <button
              type="button"
              onClick={() => setBarModes({ ...ALL_DOUBLE_MODES })}
              className="px-2 py-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-[11px] font-semibold cursor-pointer transition-colors"
            >
              Tümü Çift Ray İlmek
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-[#0B0F17] px-2 py-1 rounded border border-slate-800">
              <span className="text-[11px] text-amber-300 font-semibold mr-1">Atlama (Skip):</span>
              {[
                { id: 'front_skip' as const, label: 'Ön Atla (a·a·a·b)', title: 'Ön iğne rayını atlar, arka rayda ilmek bağlar (0,0,0,1 / 1,1,1,0)' },
                { id: 'back_skip' as const, label: 'Arka Atla (a·b·b·b)', title: 'Ön rayda ilmek yapar, arka rayı atlar' },
                { id: 'full_skip' as const, label: 'Tam Atla (N·N·N·N)', title: 'Her iki rayda da ilmek yapmadan düz geçer' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSkipBehavior(opt.id)}
                  title={opt.title}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                    skipBehavior === opt.id
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-[#111827] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-semibold">İlmek Adımı:</span>
              {[1, 2].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setLoopWidth(w)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border cursor-pointer transition-colors ${
                    loopWidth === w
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#0B0F17] text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  +{w} İğne
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBarModes({ ...DEFAULT_HRD6_MODES });
                  setSkipBehavior('front_skip');
                  setLoopWidth(1);
                }}
                className="p-1 bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded cursor-pointer"
                title="Varsayılana Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Per-Bar Mode Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {displayBars.map((gbId) => {
            const gb = pattern.guideBars[gbId];
            const gbColor = gb?.color || '#3b82f6';
            const currentMode = barModes[gbId];
            const isActive = gb?.active ?? true;

            return (
              <div
                key={gbId}
                className={`bg-[#0B0F17] border rounded-lg p-2 space-y-1.5 ${
                  isActive ? 'border-slate-700' : 'border-slate-800/70 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-mono flex items-center gap-1.5" style={{ color: gbColor }}>
                    <span className="w-2 h-2 rounded-xs shrink-0" style={{ backgroundColor: gbColor }} />
                    <span>{gbId}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </div>

                <select
                  value={currentMode}
                  onChange={(e) =>
                    setBarModes((prev) => ({
                      ...prev,
                      [gbId]: e.target.value as StitchLoopMode,
                    }))
                  }
                  className="w-full bg-[#111827] border border-slate-700 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="double_bed">{MODE_LABELS.double_bed}</option>
                  <option value="front_bed">{MODE_LABELS.front_bed}</option>
                  <option value="back_bed">{MODE_LABELS.back_bed}</option>
                  <option value="inlay">{MODE_LABELS.inlay}</option>
                </select>

                <div className="text-[10px] font-mono text-slate-400 text-center bg-[#111827]/70 rounded py-0.5">
                  {MODE_SHORT_FORMULAS[currentMode]}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Content Grid: Left = 4-Step Table | Right = Kumaş Sıklığı (May) + Rack Tansiyon Tablosu */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* Main 4-Step Machine Pattern Table */}
        <section className="xl:col-span-7 rounded-xl border overflow-hidden shadow-2xl bg-[#0B0F17] border-slate-800">
          {/* Table Status Bar */}
          <div className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0F172A] border-slate-800 text-slate-200">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-sky-400 font-bold">
                Çalışma Düzeni: 4 Adımlı Makine Desen Zinciri
              </span>
              <span className="opacity-50">|</span>
              <span className="font-mono text-[11px]">
                {pattern.title} ({rows.length} Kurs)
              </span>
            </div>

            {selectedCourseSource && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-400 font-sans font-semibold">
                  Kurs {selectedCourse} Ham:
                </span>
                {displayBars.map((gbId) => {
                  const isBarSkipped = Boolean(selectedCourseSource.skips?.[gbId]);
                  return (
                    <span
                      key={gbId}
                      className={`px-1.5 py-0.5 rounded border font-bold ${
                        isBarSkipped
                          ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                          : 'bg-[#111827] border-slate-700 text-slate-100'
                      }`}
                    >
                      {gbId}:{selectedCourseSource[gbId] ?? 0}
                      {isBarSkipped ? ' (ATLA)' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scrollable High-Density 4-Step Table */}
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table className="w-full text-center font-mono text-xs sm:text-sm border-collapse tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#111827] text-slate-100 border-b border-slate-700">
                <tr>
                  <th className="py-2 px-2 sm:px-3 w-16 sm:w-20 border-r font-bold text-xs border-slate-800 text-slate-300">
                    Kurs
                  </th>
                  {displayBars.map((gbId) => {
                    const gb = pattern.guideBars[gbId];
                    const gbColor = gb?.color || '#3b82f6';
                    return (
                      <th
                        key={gbId}
                        className="py-2 px-2 sm:px-4 border-r font-bold border-slate-800"
                        style={{
                          color: gbColor,
                          borderBottom: `2px solid ${gbColor}`,
                        }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: gbColor }}
                          />
                          <span>{gbId}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {expandedRows.map((item) => {
                  const isCourseStart = item.stepInCourse === 1;
                  const isCourseEnd = item.stepInCourse === 4;
                  const isSelectedCourse = selectedCourse === item.courseIndex;
                  const isEvenStep = item.stepInCourse % 2 === 0;

                  let rowBgClass = '';
                  let rowTextClass = '';

                  if (isSelectedCourse && isCourseStart) {
                    rowBgClass = 'bg-blue-600/35';
                    rowTextClass = 'text-white font-extrabold';
                  } else if (isSelectedCourse) {
                    rowBgClass = isEvenStep ? 'bg-blue-950/35' : 'bg-blue-950/20';
                    rowTextClass = 'text-slate-100 font-semibold';
                  } else {
                    rowBgClass = isEvenStep ? 'bg-[#111827]/90' : 'bg-[#0B0F17]';
                    rowTextClass = 'text-slate-200 font-medium';
                  }

                  const borderBottomClass = isCourseEnd
                    ? 'border-b-2 border-slate-700'
                    : 'border-b border-slate-800/70';

                  const cellBorderRight = 'border-r border-slate-800/70';

                  return (
                    <tr
                      key={`${item.courseIndex}-${item.stepInCourse}`}
                      onClick={() => setSelectedCourse(item.courseIndex)}
                      className={`${rowBgClass} ${rowTextClass} ${borderBottomClass} cursor-pointer transition-colors hover:brightness-105`}
                    >
                      <td className={`py-1.5 px-2 sm:px-3 ${cellBorderRight}`}>
                        {isCourseStart ? (
                          <span className="inline-block font-bold text-sky-400">
                            {item.courseIndex}
                          </span>
                        ) : (
                          <span className="text-[10px] select-none text-slate-600">
                            ·{item.stepInCourse}
                          </span>
                        )}
                      </td>

                      {displayBars.map((gbId) => {
                        const val = item.values[gbId];
                        const isSkipped = Boolean(item.skippedBars[gbId]);
                        const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';

                        const skipCellClass = isSkipped
                          ? 'bg-amber-950/45 text-amber-300 font-bold'
                          : '';

                        return (
                          <td
                            key={gbId}
                            className={`py-1.5 px-2 sm:px-4 ${cellBorderRight} ${skipCellClass}`}
                            style={!isSkipped ? { color: isCourseStart ? gbColor : undefined } : undefined}
                            title={`Kurs ${item.courseIndex} · Adım ${item.stepInCourse} · ${gbId}: ${val}${
                              isSkipped ? ' (ATLAMA AKTİF)' : ''
                            }`}
                          >
                            <div className="inline-flex items-center justify-center gap-1">
                              <span>{val}</span>
                              {isSkipped && isCourseStart && (
                                <span className="text-[9px] px-1 rounded font-sans font-bold bg-amber-600/85 text-white">
                                  ATLA
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Info Note */}
          <div className="px-3 py-2 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 bg-[#0F172A] border-slate-800 text-slate-400">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 text-blue-400" />
              <span>
                Her kurs numarası altında 4 makine adımı listelenir. Desen verisi korunur.
              </span>
            </div>
            <span className="font-mono font-semibold">
              1 Kurs = 4 Adım
            </span>
          </div>
        </section>

        {/* Right Column: Manual Kumaş Sıklığı (May) + Auto/Manual Rack Tansiyon Tablosu */}
        <div className="xl:col-span-5 space-y-3">
          {/* Kumaş Sıklığı (May) Card */}
          <section className="bg-[#111827] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-950/80 border border-cyan-800 rounded-lg text-cyan-400">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-white">
                    Kumaş Sıklığı (May)
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    PNG dosya adına (Örn: 6,54M) ve rapor görseline eklenir.
                  </p>
                </div>
              </div>
              {mayDensity.trim() !== '' && (
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 font-mono text-xs font-bold">
                  {mayDensity.replace('.', ',')} May
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="may-density-input"
                className="text-xs font-semibold text-slate-300 whitespace-nowrap"
              >
                May Değeri:
              </label>
              <input
                id="may-density-input"
                type="text"
                inputMode="decimal"
                value={mayDensity}
                onChange={(e) => handleMayChange(e.target.value)}
                placeholder="Örn: 6,54"
                className="flex-1 bg-[#0B0F17] border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </section>

          {/* Rack Tansiyon Tablosu */}
          <section className="bg-[#0B0F17] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="px-3 py-2.5 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-extrabold text-white">
                      Rack Tansiyon Tablosu
                    </h2>
                    {isRackManualOverride ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 border border-amber-700 text-amber-300">
                        <Lock className="w-2.5 h-2.5" />
                        Elle Girildi (Sabit)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/90 border border-emerald-700 text-emerald-300">
                        <Sparkles className="w-2.5 h-2.5" />
                        Otomatik (Atlama)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Elle müdahale edilebilir; değişiklik desene yansımaz ve otomatik sıfırlanmaz.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddRackRow}
                  className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Satır Ekle</span>
                </button>
                <button
                  type="button"
                  onClick={handleRecalculateRackFromSkips}
                  title="Atlamalara göre otomatik yeniden hesapla"
                  className="px-2 py-1 bg-[#111827] hover:bg-slate-800 text-sky-300 hover:text-white border border-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Otomatik</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center font-mono text-xs border-collapse tabular-nums">
                <thead className="bg-[#111827] text-slate-100 border-b border-slate-700">
                  <tr>
                    <th className="py-2 px-2 w-12 border-r border-slate-800 font-bold text-[11px] text-slate-300">
                      Sayı
                    </th>
                    <th className="py-2 px-2 w-24 border-r border-slate-800 font-bold text-[11px] text-sky-300">
                      Kurs numarası
                    </th>
                    {displayBars.map((gbId) => {
                      const gbColor = pattern.guideBars[gbId]?.color || '#3b82f6';
                      return (
                        <th
                          key={gbId}
                          className="py-2 px-2 border-r border-slate-800 font-bold text-xs min-w-[78px]"
                          style={{
                            color: gbColor,
                            borderBottom: `2px solid ${gbColor}`,
                          }}
                        >
                          {gbId}
                        </th>
                      );
                    })}
                    <th className="py-2 px-1.5 w-9 text-[11px] text-slate-400">Sil</th>
                  </tr>
                </thead>
                <tbody>
                  {rackTensionRows.map((rRow, rIdx) => {
                    const isEven = rIdx % 2 === 1;
                    return (
                      <tr
                        key={rRow.id}
                        className={`${
                          isEven ? 'bg-[#111827]/90' : 'bg-[#0B0F17]'
                        } border-b border-slate-800/80`}
                      >
                        <td className="py-1.5 px-2 border-r border-slate-800/80 font-bold text-sky-400">
                          {rIdx}
                        </td>

                        <td className="p-1 border-r border-slate-800/80">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={rRow.courseCount}
                            onChange={(e) => handleRackCourseChange(rIdx, e.target.value)}
                            placeholder="29"
                            className="w-full bg-[#070B12] border border-slate-700/80 focus:border-sky-500 rounded px-1.5 py-1 text-center text-xs font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none"
                          />
                        </td>

                        {displayBars.map((gbId) => {
                          const cellVal = rRow.values[gbId] ?? '';
                          const numVal = parseFloat(cellVal);
                          const isSkipTension = !isNaN(numVal) && numVal > 0 && numVal <= 5000;
                          return (
                            <td key={gbId} className="p-1 border-r border-slate-800/80">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={cellVal}
                                onChange={(e) =>
                                  handleRackBarValueChange(rIdx, gbId, e.target.value)
                                }
                                placeholder="17500"
                                className={`w-full rounded px-1.5 py-1 text-center text-xs font-mono font-bold placeholder:text-slate-600 focus:outline-none border ${
                                  isSkipTension
                                    ? 'bg-amber-950/50 border-amber-600/80 text-amber-300 focus:border-amber-400'
                                    : 'bg-[#070B12] border-slate-700/80 text-emerald-300 focus:border-emerald-500'
                                }`}
                              />
                            </td>
                          );
                        })}

                        <td className="p-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteRackRow(rIdx)}
                            title="Satırı Sil"
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 bg-[#0F172A] border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Normal: <strong className="text-emerald-300">17500</strong> · Atlama:{' '}
                  <strong className="text-amber-300">3000</strong>
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Desen değiştirilmeden hesaplanır
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
