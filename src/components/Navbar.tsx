import React from 'react';
import { ActiveTab, PatternData } from '../types';
import {
  Download,
  Upload,
  BookmarkPlus,
  Maximize2,
  Minimize2,
  Layers,
  Sliders,
  Grid,
  FolderKanban,
  Cloud,
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentPattern: PatternData;
  allPatterns?: PatternData[];
  onSelectPattern?: (pattern: PatternData) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenSafetySettings?: () => void;
  onOpenSaveToLibrary?: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  fabricWidthCm?: number;
  onChangeFabricWidth?: (widthCm: number) => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentPattern,
  allPatterns = [],
  onSelectPattern,
  onOpenExport,
  onOpenImport,
  onOpenSaveToLibrary,
  onToggleFullscreen,
  isFullscreen,
  fabricWidthCm = 410,
  onChangeFabricWidth,
  isSyncing = false,
}) => {
  const tabs: { id: ActiveTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'simulation', label: '01. Simülasyon', mobileLabel: 'Simülasyon', icon: <Layers className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'editor', label: '02. Editör', mobileLabel: 'Editör', icon: <Grid className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'library', label: '03. Kütüphane', mobileLabel: 'Kütüphane', icon: <FolderKanban className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'machine', label: '04. Makine', mobileLabel: 'Makine', icon: <Sliders className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <header className="bg-[#0F172A] border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-2 sm:px-2.5 py-1.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 lg:gap-2">
        {/* Left: Brand + Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('simulation')}
              className="text-xs sm:text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              WARPKNITT CAD
            </button>

            {/* Mobile-only quick top-right actions for zero wasted space */}
            <div className="flex sm:hidden items-center gap-1">
              {onOpenSaveToLibrary && (
                <button
                  type="button"
                  onClick={onOpenSaveToLibrary}
                  title="Deseni Kütüphaneye Kaydet"
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Kaydet</span>
                </button>
              )}

              <div
                className="flex items-center gap-1 bg-[#111827] px-1.5 py-1 rounded border border-slate-700 text-xs"
                title={isSyncing ? 'Desenler Senkronize Ediliyor...' : 'Bulut Kütüphanesi Çevrimiçi'}
              >
                <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
              </div>

              <button
                type="button"
                onClick={onOpenImport}
                title="Dosya Yükle (JSON)"
                className="p-1 bg-[#111827] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onOpenExport}
                title="Dosya İndir (JSON / CSV)"
                className="p-1 bg-[#111827] hover:bg-slate-800 text-blue-400 border border-slate-700 rounded transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              {onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
                  className={`p-1 rounded border transition-colors cursor-pointer ${
                    isFullscreen
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#111827] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
                  }`}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          <span className="text-slate-700 hidden sm:inline">|</span>

          <nav className="grid grid-cols-4 sm:flex items-center gap-1 w-full sm:w-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-1.5 sm:px-2.5 py-1 rounded text-[11px] sm:text-xs font-semibold transition-colors flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#111827] sm:bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden truncate">{tab.mobileLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick Pattern Selector + Compact Metrics + Save & Icon Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 min-w-0">
          {allPatterns.length > 0 && onSelectPattern && (
            <select
              id="quick-pattern-select"
              value={currentPattern.id}
              onChange={(e) => {
                const found = allPatterns.find((p) => p.id === e.target.value);
                if (found) onSelectPattern(found);
              }}
              title="Aktif Üretim Deseni"
              className="bg-[#111827] border border-slate-700 hover:border-slate-600 text-white text-xs font-semibold rounded px-2 py-1 focus:outline-none focus:border-blue-500 flex-1 sm:flex-initial max-w-none sm:max-w-[240px] truncate cursor-pointer"
            >
              {allPatterns.map((pat) => (
                <option key={pat.id} value={pat.id}>
                  {pat.title} ({pat.rows.length}K)
                </option>
              ))}
            </select>
          )}

          {/* Compact Fabric Width (Kumaş Eni cm) Input */}
          {onChangeFabricWidth && (
            <div className="flex items-center gap-1 bg-[#111827] px-1.5 py-0.5 rounded border border-slate-700 text-xs shrink-0">
              <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
                En (cm):
              </span>
              <input
                type="number"
                min="50"
                max="800"
                step="5"
                value={fabricWidthCm}
                onChange={(e) =>
                  onChangeFabricWidth(Math.max(10, Math.min(1000, parseInt(e.target.value, 10) || 410)))
                }
                className="w-12 sm:w-14 bg-[#0B0F17] border border-slate-700 rounded px-1 py-0.5 text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-blue-500 tabular-nums text-xs"
                title="Kumaş Eni (cm) - Taar ve İğne Limiti Hesaplayıcı"
              />
            </div>
          )}

          {/* Desktop / Tablet Actions */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {onOpenSaveToLibrary && (
              <button
                type="button"
                onClick={onOpenSaveToLibrary}
                title="Mevcut Deseni Kütüphaneye Kaydet"
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            )}

            {/* Cloud Community Sync Status / GitHub Version */}
            <div
              className="flex items-center gap-1.5 bg-[#111827] px-2 py-1 rounded border border-slate-700 text-xs"
              title={isSyncing ? 'Desenler Senkronize Ediliyor...' : 'GitHub Pages v2.4.1 Çevrimiçi'}
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
              <span className="text-[11px] text-slate-300 font-mono font-bold hidden md:inline">
                {isSyncing ? 'Eşitleniyor' : 'v2.4.1'}
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenImport}
              title="Dosya Yükle (JSON)"
              className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenExport}
              title="Dosya İndir (JSON / CSV)"
              className="p-1.5 bg-[#111827] hover:bg-slate-800 text-blue-400 border border-slate-700 rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
                className={`p-1.5 rounded border transition-colors cursor-pointer ${
                  isFullscreen
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-[#111827] text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700'
                }`}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'editor' && (
        <div
          id="editor-header-slot"
          className="border-t border-slate-800/80 px-1 sm:px-2 py-1 bg-[#0F172A] shadow-md transition-all"
        />
      )}
    </header>
  );
};
