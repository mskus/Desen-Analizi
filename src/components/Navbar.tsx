import React from 'react';
import { ActiveTab, PatternData } from '../types';
import { Settings, Table, Eye, BookOpen, Download, Upload, Cpu, Layers, ShieldCheck, BookmarkPlus, SlidersHorizontal } from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentPattern: PatternData;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onOpenSafetySettings?: () => void;
  onOpenSaveToLibrary?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentPattern,
  onOpenExport,
  onOpenImport,
  onOpenSafetySettings,
  onOpenSaveToLibrary,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-white bg-clip-text text-transparent">
                  WarpKnitt Pro
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                  {currentPattern.machine.brandModel}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400 truncate max-w-[240px] sm:max-w-md">
                <span className="truncate">Aktif: <span className="text-slate-200 font-medium">{currentPattern.title}</span></span>
                {currentPattern.createdAt && (
                  <span className="shrink-0 text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
                    {currentPattern.createdAt}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (Save to Library / Safety / Export / Import) */}
          <div className="flex items-center space-x-2">
            {onOpenSaveToLibrary && (
              <button
                onClick={onOpenSaveToLibrary}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/70 rounded-xl border border-emerald-800/80 transition shadow-sm"
                title="Yaptığım Deseni Kütüphaneye Hızlı Ekle"
              >
                <BookmarkPlus className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Kütüphaneye Ekle</span>
              </button>
            )}
            {onOpenSafetySettings && (
              <button
                onClick={onOpenSafetySettings}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 rounded-xl border border-amber-800/80 transition"
                title="Güvenli Tarak Ayarları Menüsü"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Güvenli Tarak Menüsü</span>
              </button>
            )}
            <button
              onClick={onOpenImport}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
              title="İçe Aktar (JSON / CSV)"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">İçe Aktar</span>
            </button>
            <button
              onClick={onOpenExport}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm shadow-blue-600/30 transition"
              title="Dışa Aktar (PNG / JSON / CSV)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Dışa Aktar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="bg-slate-950/80 backdrop-blur border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('machine')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'machine'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Makine & Ayarlar</span>
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'table'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Desen Kod Tablosu</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'editor'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <span>Canlı Tarak Editörü</span>
            <span className="hidden lg:inline-block px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] rounded font-semibold border border-emerald-500/30">Sürükle-Bırak</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'simulation'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Önizleme & Simülasyon</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'library'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Desen Kütüphanesi</span>
          </button>
        </div>
      </div>
    </header>
  );
};
