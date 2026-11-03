import React, { useState } from 'react';
import { GuideBarId, PatternRow } from '../types';
import { X, Sparkles, Wand2, Check, ArrowDown, HelpCircle, FileText, Zap } from 'lucide-react';
import { parseLoopNotation, LOOP_PRESETS } from '../utils/loopUtils';

interface QuickLoopFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: PatternRow[];
  onChangeRows: (rows: PatternRow[]) => void;
  activeGbIds: GuideBarId[];
  defaultGbId?: GuideBarId;
  maxAllowedNeedles: number;
}

export const QuickLoopFillModal: React.FC<QuickLoopFillModalProps> = ({
  isOpen,
  onClose,
  rows,
  onChangeRows,
  activeGbIds,
  defaultGbId = 'GB3',
  maxAllowedNeedles,
}) => {
  const [selectedGb, setSelectedGb] = useState<GuideBarId | 'ALL'>(defaultGbId);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('user_carpet');
  const [inputText, setInputText] = useState<string>(
    'K1: 9-10-9-10\nK2: 10-9-10-9\nK3: 10-11-10-11\nK4: 11-10-11-10'
  );
  const [expandMode, setExpandMode] = useState<'course_loops' | 'split_links'>('course_loops');

  if (!isOpen) return null;

  const parsed = parseLoopNotation(inputText);

  const applyNotationToPattern = (notationStr: string, mode: 'course_loops' | 'split_links' = expandMode) => {
    const coursesToApply = parseLoopNotation(notationStr);
    if (coursesToApply.length === 0) return;

    let targetGbs: GuideBarId[] = [];
    if (selectedGb === 'ALL') {
      targetGbs = activeGbIds;
    } else {
      targetGbs = [selectedGb];
    }

    if (mode === 'split_links') {
      const allFlatSteps: number[] = [];
      coursesToApply.forEach((c) => {
        c.steps.forEach((s) => allFlatSteps.push(s));
      });

      const newRows: PatternRow[] = allFlatSteps.map((val, idx) => {
        const rowId = 'loop-step-' + idx + '-' + Date.now();
        const baseRow = rows[idx] || rows[rows.length - 1] || { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
        const updatedRow: PatternRow = {
          id: rowId,
          courseIndex: idx + 1,
          GB1: baseRow.GB1 ?? 0,
          GB2: baseRow.GB2 ?? 0,
          GB3: baseRow.GB3 ?? 0,
          GB4: baseRow.GB4 ?? 0,
          GB5: baseRow.GB5 ?? 0,
          GB6: baseRow.GB6 ?? 0,
          notation: String(val),
        };

        targetGbs.forEach((gb) => {
          updatedRow[gb] = Math.max(0, Math.min(maxAllowedNeedles, val));
        });

        return updatedRow;
      });

      onChangeRows(newRows);
    } else {
      const newRows: PatternRow[] = coursesToApply.map((course, idx) => {
        const rowId = 'loop-course-' + idx + '-' + Date.now();
        const baseRow = rows[idx] || rows[rows.length - 1] || { GB1: 0, GB2: 0, GB3: 0, GB4: 0, GB5: 0, GB6: 0 };
        const mainVal = course.steps[0] ?? 0;

        const updatedRow: PatternRow = {
          id: rowId,
          courseIndex: course.courseNum || idx + 1,
          GB1: baseRow.GB1 ?? 0,
          GB2: baseRow.GB2 ?? 0,
          GB3: baseRow.GB3 ?? 0,
          GB4: baseRow.GB4 ?? 0,
          GB5: baseRow.GB5 ?? 0,
          GB6: baseRow.GB6 ?? 0,
          notation: course.rawNotation,
          loopSubSteps: {
            ...(baseRow.loopSubSteps || {}),
          },
        };

        targetGbs.forEach((gb) => {
          updatedRow[gb] = Math.max(0, Math.min(maxAllowedNeedles, mainVal));
          if (!updatedRow.loopSubSteps) updatedRow.loopSubSteps = {};
          updatedRow.loopSubSteps[gb] = course.steps.map((s) => Math.max(0, Math.min(maxAllowedNeedles, s)));
        });

        return updatedRow;
      });

      onChangeRows(newRows);
    }

    onClose();
  };

  const handleSelectPreset = (presetId: string, notation: string) => {
    setSelectedPresetId(presetId);
    const formatted = notation.replace(/\s+(K\d+:)/g, '\n$1');
    setInputText(formatted);
  };

  const handleApplyToPattern = () => {
    applyNotationToPattern(inputText, expandMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Hazır İlmek & Zincir Notasyon Doldurucu</h3>
              <p className="text-xs text-slate-400">Çok kurslu ilmek zincir dizilimini tek tıkla seçin ve uygulayın</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Target Guide Bar Selector */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Hangi Tarağa Uygulanacak?</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {activeGbIds.map((id) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setSelectedGb(id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    selectedGb === id
                      ? 'bg-blue-600 text-white border-blue-500 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {id}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedGb('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  selectedGb === 'ALL'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Tüm Aktif Taraklar
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold block">Hazır İlmek Şablonları (Tek Tıkla Seçin & Uygulayın):</span>
              <span className="text-emerald-400 text-[11px] font-medium">1 Dokunuşla Seçim</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LOOP_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id, preset.notation)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-950/50'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition ${
                              isSelected
                                ? 'bg-blue-500 border-blue-400 text-white'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {preset.title}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 shrink-0">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{preset.description}</p>
                      <code className="text-[10px] font-mono text-emerald-400 block mt-1.5 bg-slate-900/90 p-1.5 rounded-lg border border-slate-800/80 break-all">
                        {preset.notation}
                      </code>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {preset.notation.split('K').length - 1 || 4} Kurs
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPreset(preset.id, preset.notation);
                          applyNotationToPattern(preset.notation, expandMode);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow"
                        title="Bu şablonu desene doğrudan uygula"
                      >
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>Hemen Uygula</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Text Area for custom loop notation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-bold">İlmek Notasyonu (Kopyalayıp Yapıştırın):</label>
              <span className="text-slate-500 text-[11px]">Örn: K1: 9-10-9-10 K2: 10-9-10-9...</span>
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="K1: 9-10-9-10&#10;K2: 10-9-10-9&#10;K3: 10-11-10-11&#10;K4: 11-10-11-10"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-blue-500 leading-relaxed shadow-inner"
            />
          </div>

          {/* Expansion Mode Selection */}
          <div className="bg-slate-950/90 p-3 rounded-2xl border border-slate-800 space-y-2">
            <span className="font-bold text-slate-300 block">Tabloya Yazma Biçimi:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExpandMode('course_loops')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  expandMode === 'course_loops'
                    ? 'bg-blue-950/60 border-blue-500 text-white'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <span className="font-bold text-xs block text-blue-300">Kurs Başına ({parsed.length} Kurs)</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Her K bir satır olur, ilmek hareket döngüsü kaydedilir
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExpandMode('split_links')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  expandMode === 'split_links'
                    ? 'bg-blue-950/60 border-blue-500 text-white'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <span className="font-bold text-xs block text-blue-300">
                  Her Adımı Ayrı Satır Yap ({parsed.reduce((acc, c) => acc + c.steps.length, 0)} Satır)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Tüm bakla adımları ardışık sıralı kurslara bölünür
                </span>
              </button>
            </div>
          </div>

          {/* Live Preview Summary */}
          {parsed.length > 0 && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-emerald-300 flex items-center justify-between">
              <div>
                <span className="font-bold block">✓ {parsed.length} Kurs Başarıyla Ayrıştırıldı</span>
                <span className="text-[11px] text-emerald-400/80">
                  {selectedGb === 'ALL' ? 'Tüm Taraklar' : selectedGb} için {parsed.map((p) => `K${p.courseNum}(${p.rawNotation})`).join(', ')}
                </span>
              </div>
              <Wand2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            İptal
          </button>

          <button
            onClick={handleApplyToPattern}
            disabled={parsed.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>Tabloya ve Simülasyona İşle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
