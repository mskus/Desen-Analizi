import React from 'react';
import { ActiveTab, PatternData } from '../types';
import {
  Settings,
  Table,
  Eye,
  BookOpen,
  Download,
  Upload,
  SlidersHorizontal,
  ShieldCheck,
  BookmarkPlus
} from 'lucide-react';

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
  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'simulation', label: 'Simülasyon', icon: Eye },
    { id: 'editor', label: 'Canlı Editör', icon: SlidersHorizontal },
    { id: 'table', label: 'Desen Tablosu', icon: Table },
    { id: 'library', label: 'Kütüphane', icon: BookOpen },
    { id: 'machine', label: 'Makine & Ayar', icon: Settings },
  ];

  return (
    <>
      {/* Top Header - Minimal & Compact */}
      <header className="bg-slate-900 border-b border-slate-800 text-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-13 sm:h-14">
            {/* Brand & Active Pattern */}
            <div className="flex items-center space-x-2.5 min-w-0">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight shrink-0">
                WarpKnitt
              </span>
              <span className="text-slate-600 text-xs hidden sm:inline">|</span>
              <div className="truncate text-xs text-slate-400">
                <span className="text-slate-200 font-medium truncate">{currentPattern.title}</span>
                {currentPattern.createdAt && (
                  <span className="text-slate-500 text-[10px] ml-1.5 hidden md:inline">
                    ({currentPattern.createdAt})
                  </span>
                )}
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Action Tools */}
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              {onOpenSaveToLibrary && (
                <button
                  onClick={onOpenSaveToLibrary}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-950/40 border border-transparent hover:border-emerald-800/60 transition flex items-center space-x-1"
                  title="Deseni Kütüphaneye Kaydet"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span className="hidden lg:inline">Kaydet</span>
                </button>
              )}
              {onOpenSafetySettings && (
                <button
                  onClick={onOpenSafetySettings}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-950/40 border border-transparent hover:border-amber-800/60 transition flex items-center space-x-1"
                  title="Güvenli Tarak Menüsü"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden lg:inline">Güvenlik</span>
                </button>
              )}
              <button
                onClick={onOpenImport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-800 transition flex items-center space-x-1"
                title="İçe Aktar (JSON / CSV)"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">İçe</span>
              </button>
              <button
                onClick={onOpenExport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition flex items-center space-x-1"
                title="Dışa Aktar (PNG / JSON / CSV)"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Dışa</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar (Thumb Friendly) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur pb-safe">
        <div className="grid grid-cols-5 h-14">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 transition ${
                  isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
