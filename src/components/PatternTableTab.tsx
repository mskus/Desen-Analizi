import React, { useState } from 'react';
import { PatternRow, GuideBarConfig, GuideBarId, SafetyConfig } from '../types';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  Wand2,
  AlertTriangle,
  Undo2,
  Redo2,
  FileText,
  ArrowRightLeft,
  CheckCircle,
  HelpCircle,
  Info,
  Check,
  X,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

interface PatternTableTabProps {
  rows: PatternRow[];
  onChangeRows: (rows: PatternRow[]) => void;
  guideBars: Record<GuideBarId, GuideBarConfig>;
  safety: SafetyConfig;
  onOpenSafetySettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface PatternIssue {
  courseIndex: number;
  gbId: GuideBarId;
  prevVal: number;
  currVal: number;
  jump: number;
  type: 'jump_warning' | 'range_error' | 'inactive_used';
  message: string;
}

export const PatternTableTab: React.FC<PatternTableTabProps> = ({
  rows,
  onChangeRows,
  guideBars,
  safety,
  onOpenSafetySettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [quickInputText, setQuickInputText] = useState('');
  const [selectedGbForQuick, setSelectedGbForQuick] = useState<GuideBarId>('GB1');
  const [quickError, setQuickError] = useState<string | null>(null);

  // Copy Guide Bar feature: e.g. GB3 -> GB4
  const [copySourceGb, setCopySourceGb] = useState<GuideBarId>('GB3');
  const [copyTargetGb, setCopyTargetGb] = useState<GuideBarId>('GB4');
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  // Reset confirmation state (avoid window.confirm)
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Cell change
  const handleCellChange = (rowIndex: number, gb: GuideBarId, val: number) => {
    const updated = [...rows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [gb]: isNaN(val) ? 0 : val,
    };
    onChangeRows(updated);
  };

  const addRow = () => {
    const newCourseIndex = rows.length > 0 ? rows[rows.length - 1].courseIndex + 1 : 1;
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
    const newRow: PatternRow = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      courseIndex: newCourseIndex,
      GB1: lastRow.GB1,
      GB2: lastRow.GB2,
      GB3: lastRow.GB3,
      GB4: lastRow.GB4,
      GB5: lastRow.GB5,
      GB6: lastRow.GB6,
    };
    onChangeRows([...rows, newRow]);
  };

  const deleteRow = (index: number) => {
    if (rows.length <= 1) return;
    const updated = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, courseIndex: i + 1 }));
    onChangeRows(updated);
  };

  const mirrorRows = () => {
    const reversed = [...rows].reverse().map((r, i) => ({
      ...r,
      id: 'r-mir-' + i + '-' + Date.now(),
      courseIndex: i + 1,
    }));
    onChangeRows([...rows, ...reversed]);
  };

  const shiftRowsUp = () => {
    if (rows.length === 0) return;
    const first = rows[0];
    const rest = rows.slice(1);
    const shifted = [...rest, { ...first, id: 'r-shift-' + Date.now() }].map((r, i) => ({
      ...r,
      courseIndex: i + 1,
    }));
    onChangeRows(shifted);
  };

  // Safe table reset without window.confirm
  const handleClearTableConfirmed = () => {
    onChangeRows([
      { id: 'r1', courseIndex: 1, GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 },
    ]);
    setIsConfirmingClear(false);
  };

  // Direct guide bar copy: e.g. GB3 to GB4
  const handleCopyGuideBar = () => {
    if (copySourceGb === copyTargetGb) {
      setCopySuccessMsg('Kaynak ve hedef tarak aynı olamaz.');
      setTimeout(() => setCopySuccessMsg(null), 2500);
      return;
    }
    const updated = rows.map((r) => ({
      ...r,
      [copyTargetGb]: r[copySourceGb],
    }));
    onChangeRows(updated);
    setCopySuccessMsg(`${copySourceGb} verileri doğrudan ${copyTargetGb} tarağına kopyalandı (${rows.length} kurs).`);
    setTimeout(() => setCopySuccessMsg(null), 3000);
  };

  // Quick notation parse: e.g. "1-0, 0-1, 1-2, 2-1" or "0.1.0.1"
  const handleQuickNotationParse = () => {
    setQuickError(null);
    if (!quickInputText.trim()) return;

    const numbers = quickInputText
      .replace(/[-.,/]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n));

    if (numbers.length === 0) {
      setQuickError('Geçerli sayısal notasyon bulunamadı. Örnek: 1-0/1-2 veya 0 1 1 2');
      return;
    }

    const newRows: PatternRow[] = numbers.map((val, idx) => ({
      id: 'quick-' + idx + '-' + Date.now(),
      courseIndex: idx + 1,
      GB1: selectedGbForQuick === 'GB1' ? val : rows[idx]?.GB1 || 0,
      GB2: selectedGbForQuick === 'GB2' ? val : rows[idx]?.GB2 || 0,
      GB3: selectedGbForQuick === 'GB3' ? val : rows[idx]?.GB3 || 0,
      GB4: selectedGbForQuick === 'GB4' ? val : rows[idx]?.GB4 || 0,
      GB5: selectedGbForQuick === 'GB5' ? val : rows[idx]?.GB5 || 0,
      GB6: selectedGbForQuick === 'GB6' ? val : rows[idx]?.GB6 || 0,
    }));

    onChangeRows(newRows);
    setQuickInputText('');
  };

  // Calculate detailed errors / warnings across the table
  const issues: PatternIssue[] = [];
  const guideBarIds: GuideBarId[] = ['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'];

  rows.forEach((row, rIdx) => {
    guideBarIds.forEach((gbId) => {
      const val = row[gbId];
      const gb = guideBars[gbId];

      // Check range against configured safety limit
      if (val < 0 || val > safety.maxAllowedNeedleNumber) {
        issues.push({
          courseIndex: row.courseIndex,
          gbId,
          prevVal: val,
          currVal: val,
          jump: 0,
          type: 'range_error',
          message: `Kurs ${row.courseIndex}, ${gbId}: İğne değeri (${val}) güvenli çalışma alanı (0-${safety.maxAllowedNeedleNumber}) dışında.`,
        });
      }

      // Check jump if previous course exists
      if (rIdx > 0 && gb.active) {
        const prev = rows[rIdx - 1][gbId];
        const jump = Math.abs(val - prev);
        if (jump > safety.maxSafeShoggingJump) {
          issues.push({
            courseIndex: row.courseIndex,
            gbId,
            prevVal: prev,
            currVal: val,
            jump,
            type: 'jump_warning',
            message: `Kurs ${row.courseIndex}, ${gbId}: İğne ${prev} konumundan ${val} konumuna ${jump} adım atlıyor. Ayarlanan güvenli sınır ${safety.maxSafeShoggingJump} iğnedir. İplik kopması veya iğne çarpışma riski!`,
          });
        }
      }
    });
  });

  const getCellIssue = (courseIndex: number, gbId: GuideBarId) => {
    return issues.find((issue) => issue.courseIndex === courseIndex && issue.gbId === gbId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Quick Notation Parser */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 text-blue-400 p-2.5 rounded-xl border border-blue-500/30">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hızlı Notasyon & Kod Girişi</h3>
              <p className="text-xs text-slate-400">
                Örn: <code className="text-blue-400 bg-slate-950 px-1 py-0.5 rounded">1-0/1-2/2-1</code> veya{' '}
                <code className="text-blue-400 bg-slate-950 px-1 py-0.5 rounded">0 1 2 1 0</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 rounded-lg border border-slate-700 transition"
              title="Geri Al"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Geri Al</span>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 rounded-lg border border-slate-700 transition"
              title="Yinele"
            >
              <Redo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Yinele</span>
            </button>
          </div>
        </div>

        {quickError && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{quickError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <select
            value={selectedGbForQuick}
            onChange={(e) => setSelectedGbForQuick(e.target.value as GuideBarId)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-52"
          >
            {guideBarIds.map((id) => (
              <option key={id} value={id}>
                {id} - {guideBars[id].name.split('(')[1]?.replace(')', '') || guideBars[id].name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={quickInputText}
            onChange={(e) => {
              setQuickInputText(e.target.value);
              setQuickError(null);
            }}
            placeholder="Örn: 1-0 / 1-2 / 2-3 / 1-0 veya 1 0 2 1"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickNotationParse();
            }}
          />

          <button
            onClick={handleQuickNotationParse}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl shadow-md shadow-blue-600/30 transition whitespace-nowrap"
          >
            Hızlı Yükle
          </button>
        </div>
      </div>

      {/* 2. Direct Guide Bar Copy Tool (Örnek: GP3 to GP4) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600/20 text-indigo-400 p-2 rounded-xl border border-indigo-500/30">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Tarak Değerlerini Doğrudan Kopyala (Örn: GB3 → GB4)</h3>
            <p className="text-xs text-slate-400">Tüm kurslardaki tarak hareket dizisini tek tıkla başka bir tarağa aktarın.</p>
          </div>
        </div>

        {copySuccessMsg && (
          <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{copySuccessMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Kaynak Tarak:</span>
            <select
              value={copySourceGb}
              onChange={(e) => setCopySourceGb(e.target.value as GuideBarId)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-semibold"
            >
              {guideBarIds.map((id) => (
                <option key={id} value={id}>
                  {id} ({guideBars[id].yarnType})
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-500 text-xs font-bold">➔</span>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Hedef Tarak:</span>
            <select
              value={copyTargetGb}
              onChange={(e) => setCopyTargetGb(e.target.value as GuideBarId)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-semibold"
            >
              {guideBarIds.map((id) => (
                <option key={id} value={id}>
                  {id} ({guideBars[id].yarnType})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCopyGuideBar}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center space-x-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copySourceGb} → {copyTargetGb} Değerlerini Kopyala</span>
          </button>
        </div>
      </div>

      {/* 3. Action Buttons & Table Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Satır Ekle</span>
          </button>

          <button
            onClick={mirrorRows}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold transition"
            title="Deseni Ayna Yansıt (Mirror)"
          >
            <Copy className="w-4 h-4 text-blue-400" />
            <span>Aynala (Mirror)</span>
          </button>

          <button
            onClick={shiftRowsUp}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold transition"
            title="Yukarı Kaydır"
          >
            <ArrowUp className="w-4 h-4 text-indigo-400" />
            <span>Kaydır</span>
          </button>
        </div>

        {/* Fixed working clear / reset button without alert/confirm */}
        <div>
          {!isConfirmingClear ? (
            <button
              onClick={() => setIsConfirmingClear(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hepsini Sil / Sıfırla</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2 bg-rose-950/80 border border-rose-700 p-1.5 rounded-xl">
              <span className="text-xs text-rose-200 font-semibold pl-2">Tüm tablo silinsin mi?</span>
              <button
                onClick={handleClearTableConfirmed}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Evet, Sil</span>
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
              >
                Vazgeç
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Pattern Diagnostics & Error Explanations (Hata Açıklama Paneli) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {issues.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <h4 className="font-bold text-sm text-white">Desen Kontrol & Hata Açıklama Raporu</h4>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenSafetySettings}
              className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Güvenlik Sınırı: {safety.maxSafeShoggingJump} İğne</span>
            </button>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                issues.length > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {issues.length > 0 ? `${issues.length} Uyarı Bulundu` : 'Sıfır Hata'}
            </span>
          </div>
        </div>

        {issues.length === 0 ? (
          <p className="text-xs text-slate-400">
            ✓ Tüm tarak hareketleri ve iğne atlama mesafeleri endüstriyel standartlara ve makine sınırlarına (0-2 adım) uygundur.
          </p>
        ) : (
          <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-start space-x-3"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">
                    {issue.gbId} - Kurs #{issue.courseIndex} ({issue.prevVal} ➔ {issue.currVal})
                  </div>
                  <div className="text-amber-300/90 leading-relaxed mt-0.5">{issue.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Dynamic Code Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h4 className="font-bold text-sm text-white">Çözgülü Örme Zincir Tablosu (Chain Grid)</h4>
          </div>
          <span className="text-xs text-slate-400 font-medium">Toplam Kurs: {rows.length}</span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-950 z-10 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 text-center w-16">Kurs</th>
                {guideBarIds.map((gbId) => {
                  const gb = guideBars[gbId];
                  return (
                    <th
                      key={gbId}
                      className="py-3 px-3 text-center transition-all"
                      style={{
                        backgroundColor: gb.active ? `${gb.color}15` : 'transparent',
                        borderBottom: gb.active ? `3px solid ${gb.color}` : '1px solid #1e293b',
                      }}
                    >
                      <div className="flex flex-col items-center justify-center space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{ backgroundColor: gb.color }}
                          />
                          <span
                            className="font-bold text-sm tracking-wide"
                            style={{ color: gb.active ? gb.color : '#64748b' }}
                          >
                            {gbId}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {gb.active ? gb.yarnType : '(Pasif)'}
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-4 text-center w-20">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {rows.map((row, rIdx) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-4 text-center font-mono font-bold text-slate-300 bg-slate-950/60">
                    {row.courseIndex}
                  </td>
                  {guideBarIds.map((gbId) => {
                    const gb = guideBars[gbId];
                    const cellIssue = getCellIssue(row.courseIndex, gbId);

                    return (
                      <td
                        key={gbId}
                        className="py-2 px-3 text-center relative transition-colors"
                        style={{
                          backgroundColor: gb.active ? `${gb.color}08` : 'transparent',
                        }}
                      >
                        <div className="flex items-center justify-center space-x-1">
                          <input
                            type="number"
                            min="0"
                            max={safety.maxAllowedNeedleNumber}
                            disabled={!gb.active}
                            value={row[gbId]}
                            onChange={(e) => handleCellChange(rIdx, gbId, parseInt(e.target.value) || 0)}
                            className={`w-14 text-center font-mono font-bold rounded-lg py-1.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-25 transition shadow-inner ${
                              cellIssue
                                ? 'border-2 border-amber-500 bg-amber-500/20 text-amber-200 ring-2 ring-amber-500'
                                : 'border-2 text-white'
                            }`}
                            style={{
                              borderColor: cellIssue ? '#f59e0b' : gb.active ? gb.color : '#334155',
                              backgroundColor: cellIssue ? 'rgba(245, 158, 11, 0.2)' : gb.active ? `${gb.color}20` : '#020617',
                            }}
                          />
                          {cellIssue && (
                            <span title={cellIssue.message} className="cursor-help">
                              <AlertTriangle className="w-4 h-4 text-amber-400 inline" />
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-4 text-center">
                    <button
                      onClick={() => deleteRow(rIdx)}
                      disabled={rows.length <= 1}
                      className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-20 transition rounded-lg hover:bg-slate-800"
                      title="Satırı Sil"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
