import React, { useState } from 'react';
import { PatternData, PatternRow, GuideBarId, GuideBarConfig, SafetyConfig } from '../types';
import {
  Sparkles,
  Flame,
  Check,
  Wand2,
  HelpCircle,
  ShieldCheck,
  Table as TableIcon,
  Palette,
  RotateCcw,
  Sliders,
  Layers,
  ArrowRight,
  Info,
  Wrench,
  AlertTriangle,
  X
} from 'lucide-react';
import {
  LOOP_DEFINITIONS,
  QUICK_LOOP_PRESETS,
  synthesizeAutoLoopsFromDraft,
  convert4StepsToDraftRows,
  appendLoopCoursesToRows,
  autoFixWarningInRows,
  LoopWarningItem
} from '../utils/loopEngine';

interface UnifiedLoopControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: PatternData;
  rows: PatternRow[];
  onChangeRows: (newRows: PatternRow[]) => void;
  requireLoopFormation: boolean;
  onToggleRequireLoop: () => void;
  isDraftMode: boolean;
  onToggleDraftMode: (isDraft: boolean) => void;
  activeGbId: GuideBarId;
  onSelectGb: (gbId: GuideBarId) => void;
  showLoopBadges: boolean;
  onToggleLoopBadges: () => void;
  isMachinePhotoTheme: boolean;
  onToggleMachineTheme: () => void;
  safety: SafetyConfig;
  onChangeSafety?: (newSafety: SafetyConfig) => void;
}

export const UnifiedLoopControlModal: React.FC<UnifiedLoopControlModalProps> = ({
  isOpen,
  onClose,
  pattern,
  rows,
  onChangeRows,
  requireLoopFormation,
  onToggleRequireLoop,
  isDraftMode,
  onToggleDraftMode,
  activeGbId,
  onSelectGb,
  showLoopBadges,
  onToggleLoopBadges,
  isMachinePhotoTheme,
  onToggleMachineTheme,
  safety,
  onChangeSafety,
}) => {
  const [activeTab, setActiveTab] = useState<'synthesize' | 'presets' | 'guide' | 'settings'>('synthesize');
  const [preferredAutoLoopType, setPreferredAutoLoopType] = useState<'open' | 'closed'>('open');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const showMsg = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const activeBars = (Object.keys(pattern.guideBars) as GuideBarId[]).filter(
    (id) => pattern.guideBars[id].active
  );

  // 1. Synthesize Auto-Loops from Draft
  const handleRunAutoSynthesis = () => {
    let draftInput = rows;
    if (!isDraftMode) {
      // If currently in 4-step mode, extract draft representations
      draftInput = convert4StepsToDraftRows(rows);
    }

    const synthesizedRows = synthesizeAutoLoopsFromDraft(
      draftInput,
      pattern.guideBars,
      pattern.safety?.maxAllowedNeedleNumber || 18,
      preferredAutoLoopType
    );

    onChangeRows(synthesizedRows);
    if (isDraftMode) {
      onToggleDraftMode(false); // Switch to 4-step machine table
    }
    showMsg(`İlmeksiz kodlar otomatik olarak ${preferredAutoLoopType === 'open' ? 'Açık İlmeğe (Ω)' : 'Kapalı İlmeğe (⋈)'} çevrildi!`);
  };

  // 2. Append Coordinated Loop Course
  const handleApplyPresetInModal = (presetId: string) => {
    const preset = QUICK_LOOP_PRESETS.find((p: any) => p.id === presetId);
    if (!preset) return;

    const baseNeedle = rows[rows.length - 1]?.[activeGbId] ?? 0;
    const result = appendLoopCoursesToRows(
      rows,
      activeGbId,
      preset,
      baseNeedle,
      pattern.safety?.maxAllowedNeedleNumber || 18,
      pattern.guideBars
    );

    onChangeRows(result.updatedRows);
    showMsg(`${preset.name} için ${result.coursesAdded} yeni 4 adımlı kurs eklendi! Mevcut kurslarınız korundu.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-950 text-blue-400 rounded-2xl border border-blue-800/80 shadow">
              <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>İlmek Yönetim & Ayar Merkezi</span>
              </h2>
              <p className="text-xs text-slate-400">
                Otomatik ilmekleme, ilmeksiz tablo girişi, ilmek şablonları ve tüm makine ayarları
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="bg-emerald-950/90 border border-emerald-800 text-emerald-200 px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-lg">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Unified Navigation Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('synthesize')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'synthesize'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Otomatik İlmekle</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'presets'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Kurs Ekle & Şablonlar</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'guide'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>İlmek Rehberi</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Makine & Tablo Ayarları</span>
          </button>
        </div>

        {/* TAB 1: OTOMATİK İLMEKLEME (AUTO-LOOP SYNTHESIZER) */}
        {activeTab === 'synthesize' && (
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/80 border border-blue-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Wand2 className="w-4 h-4 text-blue-400" />
                    <span>İlmeksiz Programı Otomatik İlmeklemeye Çevir</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tabloya ilmek detayları girmeden sadece basit iğne pozisyonları yazabilirsiniz. Bu araç, yazdığınız kodları pürüzsüz 4 adımlı çözgülü örme ilmek yapısına (ön swing, sarım, arka swing, alt yatırım) otomatik dönüştürür.
                  </p>
                </div>
                <button
                  onClick={() => onToggleDraftMode(!isDraftMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 transition ${
                    isDraftMode
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {isDraftMode ? 'İlmeksiz Kolay Giriş AÇIK' : 'İlmeksiz Moda Geç'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-3 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Tercih Edilen İlmek Tipi:</span>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="loopPref"
                      checked={preferredAutoLoopType === 'open'}
                      onChange={() => setPreferredAutoLoopType('open')}
                      className="text-sky-500 focus:ring-0"
                    />
                    <span className="text-sky-300 font-bold">Açık İlmek (Ω)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="loopPref"
                      checked={preferredAutoLoopType === 'closed'}
                      onChange={() => setPreferredAutoLoopType('closed')}
                      className="text-purple-500 focus:ring-0"
                    />
                    <span className="text-purple-300 font-bold">Kapalı İlmek (⋈)</span>
                  </label>
                </div>

                <button
                  onClick={handleRunAutoSynthesis}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-extrabold transition shadow-lg flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>⚡ Şimdi Otomatik İlmekle</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-3 space-y-1.5">
              <div className="text-xs font-bold text-slate-300">Önemli Avantaj:</div>
              <p className="text-[11px] text-slate-400">
                Otomatik ilmekleme, `GB1`'den `GB6`'ya kadar tüm aktif tarakların pozisyonlarını senkronize eder. Deseninizin simülasyonda veya makinede bozulmasını önler.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: KURS EKLEME & İLMEK ŞABLONLARI */}
        {activeTab === 'presets' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-300 font-bold">İlmek Eklenen Tarak:</span>
              <div className="flex items-center space-x-1.5">
                {activeBars.map((id) => (
                  <button
                    key={id}
                    onClick={() => onSelectGb(id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                      activeGbId === id
                        ? 'bg-blue-600 text-white border-blue-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {QUICK_LOOP_PRESETS.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-blue-500/60 rounded-2xl p-3 space-y-2 transition flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${p.loopType === 'open' ? 'bg-sky-400' : p.loopType === 'closed' ? 'bg-purple-500' : 'bg-amber-500'}`} />
                        <span>{p.name}</span>
                      </span>
                      <span className="text-[10px] bg-slate-900 text-blue-300 px-2 py-0.5 rounded-full border border-slate-800 font-mono">
                        +{p.coursesToAdd} Kurs
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      {p.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleApplyPresetInModal(p.id)}
                    className="w-full py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 shadow"
                  >
                    <span>+ Bu İlmek Kursunu Ekle</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-300 flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Garantili Güvenlik: Kurs eklendiğinde mevcut deseniniz bozulmaz, yeni 4 adımlı kurslar yumuşak geçişle arkasına eklenir.</span>
            </div>
          </div>
        )}

        {/* TAB 3: İLMEK REHBERİ */}
        {activeTab === 'guide' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-950/80 border border-sky-800/60 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                <span className="text-lg">Ω</span>
                <span>Açık İlmek (Open Lap)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                İlmek bacakları alt yatırım yönüyle kesişmez.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-2 rounded-xl">
                <div>✓ <b>4 Adım Döngüsü:</b> 1 (ön konum), 2 (sarım), 3 (arka konum), 4 (alt yatırım).</div>
                <div>✓ <b>Özellik:</b> Esneklik, gözenekli yapı, yumuşak tuşe.</div>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-purple-800/60 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm">
                <span className="text-lg">⋈</span>
                <span>Kapalı İlmek (Closed Lap)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                İlmek bacakları boğazda çapraz kesişerek birbirini kilitler.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/60 p-2 rounded-xl">
                <div>✓ <b>Özellik:</b> Sökülmezlik, sıfır dönme, boyutsal kararlılık.</div>
                <div>✓ <b>Kullanım:</b> Halı zeminleri, kord/franse zincirleri.</div>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-amber-800/60 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <span className="text-lg">═</span>
                <span>Atkı / Yatırım (Inlay)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                İğneye ilmek atılmaz (Overlap=0). İplik enine yatırılır.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-slate-400 font-bold text-sm">
                <span className="text-lg">—</span>
                <span>Askı / Boş (Miss)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                İğne boş geçilir veya ilmek atılmaz. Rölyef kanalları oluşturur.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: MAKİNE & TABLO AYARLARI */}
        {activeTab === 'settings' && (
          <div className="space-y-3.5 pt-1">
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Makinede İlmek Attırma Zorunluluğu:</div>
                  <p className="text-[11px] text-slate-400">İlmek atılmayan adımlarda makine ikaz verir.</p>
                </div>
                <button
                  onClick={onToggleRequireLoop}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    requireLoopFormation
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {requireLoopFormation ? 'AÇIK (İlmek Zorunlu)' : 'KAPALI (Serbest)'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">Program Tablo Görünüm Stili:</div>
                  <p className="text-[11px] text-slate-400">Gerçek makine ekran stili veya CAD stili.</p>
                </div>
                <button
                  onClick={onToggleMachineTheme}
                  className="px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-xl text-xs font-bold transition"
                >
                  {isMachinePhotoTheme ? 'Makine Ekran Stili (Fotoğraftaki)' : 'Açık CAD Stili'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">İlmek Türü Rozetleri (Ω/⋈/═):</div>
                  <p className="text-[11px] text-slate-400">Hücre içinde ilmek sembollerini gösterir.</p>
                </div>
                <button
                  onClick={onToggleLoopBadges}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    showLoopBadges
                      ? 'bg-blue-950 text-blue-300 border-blue-800'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                >
                  {showLoopBadges ? 'Gösteriliyor' : 'Gizli'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
