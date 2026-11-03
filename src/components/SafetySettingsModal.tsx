import React from 'react';
import { SafetyConfig, PatternRow, GuideBarId } from '../types';
import { ShieldCheck, ShieldAlert, X, AlertTriangle, Zap, Check, Sliders, RefreshCw } from 'lucide-react';

interface SafetySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  safety: SafetyConfig;
  onChangeSafety: (updated: SafetyConfig) => void;
  rows: PatternRow[];
  onChangeRows: (rows: PatternRow[]) => void;
}

export const SafetySettingsModal: React.FC<SafetySettingsModalProps> = ({
  isOpen,
  onClose,
  safety,
  onChangeSafety,
  rows,
  onChangeRows,
}) => {
  if (!isOpen) return null;

  const handleFieldChange = (field: keyof SafetyConfig, value: any) => {
    onChangeSafety({
      ...safety,
      [field]: value,
    });
  };

  // Auto-clamp jumps across all rows: if jump > maxSafeShoggingJump, clamp it
  const handleAutoClampJumps = () => {
    const gbIds: GuideBarId[] = ['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'];
    const updated = rows.map((r, rIdx) => {
      if (rIdx === 0) return r;
      const prev = rows[rIdx - 1];
      const newRow = { ...r };

      gbIds.forEach((gbId) => {
        const diff = newRow[gbId] - prev[gbId];
        if (Math.abs(diff) > safety.maxSafeShoggingJump) {
          const clampedDiff = diff > 0 ? safety.maxSafeShoggingJump : -safety.maxSafeShoggingJump;
          newRow[gbId] = Math.max(0, Math.min(safety.maxAllowedNeedleNumber, prev[gbId] + clampedDiff));
        }
      });
      return newRow;
    });

    onChangeRows(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-2xl border border-amber-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Güvenli Tarak Ayarları & Makine Limitleri</h3>
              <p className="text-xs text-slate-400">Çözgülü örme tarak salınım sınırları, iğne çarpışma ve iplik kopma koruması.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-950">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Parameters Form */}
        <div className="space-y-4">
          {/* Max Shogging Jump */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-white block">Maksimum Güvenli Atlama Sınırı</label>
                <p className="text-xs text-slate-400">
                  Bir kurstan diğerine geçerken izin verilen maksimum iğne atlama adımı (Shogging Jump). İstediğiniz sayıyı serbestçe girin:
                </p>
              </div>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={safety.maxSafeShoggingJump}
                  onChange={(e) => handleFieldChange('maxSafeShoggingJump', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-slate-900 border border-blue-500 rounded-xl px-2.5 py-1.5 text-center text-blue-300 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-xs text-slate-400 font-bold">İğne</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <button
                  key={step}
                  onClick={() => handleFieldChange('maxSafeShoggingJump', step)}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold transition border ${
                    safety.maxSafeShoggingJump === step
                      ? 'bg-blue-600 text-white border-blue-500 shadow'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {step} İğne {step === 2 ? '(Standart)' : step === 3 ? '(Saten/Sharkskin)' : ''}
                </button>
              ))}
            </div>
          </div>

           {/* Maximum Allowed Needle Span */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-white block">Maksimum İğne Koordinat Aralığı</label>
              <p className="text-xs text-slate-400">
                Tarakların hareket edebileceği maksimum iğne koordinatı sınırı (0 ile 128 arası).
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="4"
                max="128"
                value={safety.maxAllowedNeedleNumber}
                onChange={(e) => handleFieldChange('maxAllowedNeedleNumber', Math.max(4, Math.min(128, parseInt(e.target.value) || 32)))}
                className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center text-slate-200 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400 font-bold">İğne</span>
            </div>
          </div>

          {/* Clash & Collision Detection */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-white block">Tarak Çarpışma & Zıt Salınım Uyarısı</label>
              <p className="text-xs text-slate-400">
                Ön ve arka tarakların ani zıt yönlü atlamalarında iplik gerginlik uyarısı ver.
              </p>
            </div>
            <input
              type="checkbox"
              checked={safety.enableClashDetection}
              onChange={(e) => handleFieldChange('enableClashDetection', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Empty Needle Knitting Warning */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-white block">Boş İğne (Threading Out) Uyarısı</label>
              <p className="text-xs text-slate-400">
                İğne diziminde iplik olmayan (boş) iğnelerde ilmek oluşturulmaya çalışıldığında bildir.
              </p>
            </div>
            <input
              type="checkbox"
              checked={safety.warnOnEmptyNeedleKnitting}
              onChange={(e) => handleFieldChange('warnOnEmptyNeedleKnitting', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Loop Formation Required Option ("Makinede İlmek Attırmak Gerekiyor mu?") */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-white block">Makinede İlmek Attırma Zorunlu mu?</label>
              <p className="text-xs text-slate-400">
                Kullandığınız makinede her kursta ilmek oluşturma (overlap/underlap) şartı varsa sistemi uyarır. İlmek oluşmadığında (hareketsiz veya sıfır atlamada) kırmızı uyarı verir.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0 ml-3">
              <button
                type="button"
                onClick={() => handleFieldChange('loopFormationRequired', false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  !safety.loopFormationRequired
                    ? 'bg-slate-800 text-white border-slate-600'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                Hayır
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('loopFormationRequired', true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  safety.loopFormationRequired
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                Evet
              </button>
            </div>
          </div>

          {/* Detect Wrong Loops */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-white block">Yanlış İlmek Denetimi & İkazı</label>
              <p className="text-xs text-slate-400">
                Açık/kapalı ilmek, düşen ilmek veya iplik kopma riski olan hatalı ilmeklerde canlı uyarı ve kırmızı çerçeve gösterir.
              </p>
            </div>
            <input
              type="checkbox"
              checked={safety.detectWrongLoops ?? true}
              onChange={(e) => handleFieldChange('detectWrongLoops', e.target.checked)}
              className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 ml-3"
            />
          </div>

          {/* Auto Fix / Clamp Unsafe Jumps Action */}
          <div className="p-4 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-900/60 rounded-2xl flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Otomatik Güvenli Düzeltme (Auto-Fix)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mevcut desendeki {safety.maxSafeShoggingJump} iğneyi aşan tüm hatalı atlamaları tek tıkla güvenli sınıra kelepçeler.
              </p>
            </div>

            <button
              onClick={handleAutoClampJumps}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md whitespace-nowrap ml-3"
            >
              Hataları Düzelt
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition"
          >
            Tamam / Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
