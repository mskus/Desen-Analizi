import React, { useState } from 'react';
import { PatternData, GuideBarId } from '../types';
import { BookOpen, Search, CheckCircle2, ArrowRight, BookmarkPlus, Trash2, Sparkles, Calendar, Layers } from 'lucide-react';

interface LibraryTabProps {
  currentPatternId: string;
  allPatterns: PatternData[];
  onSelectPattern: (pattern: PatternData) => void;
  onSaveCurrentToLibrary: () => void;
  onDeletePattern?: (id: string) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  currentPatternId,
  allPatterns,
  onSelectPattern,
  onSaveCurrentToLibrary,
  onDeletePattern,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');

  const categories = ['Tümü', 'Halı & Zemin', 'Bukle & Havlı', 'Peluş / Kadife', 'Rölyef & Jakar', 'Otomotiv Halısı', 'Özel'];

  const filteredPatterns = allPatterns.filter((pat) => {
    const isUserPattern = pat.id.startsWith('user-pat-');
    const matchesSearch = pat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          pat.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Tümü' ||
      (selectedCategory === 'Özel' && isUserPattern) ||
      pat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/20 text-indigo-400 p-3 rounded-2xl border border-indigo-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Halı Desen Kütüphanesi</h2>
              <p className="text-xs text-slate-400">
                10 adet halıya özel desen (Tekte maks. 6 atlama, GB3 5 dolu 5 boş, GB5-6 Full zemin).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Desen ara..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={onSaveCurrentToLibrary}
              className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition whitespace-nowrap"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Deseni Kütüphaneye Ekle</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatterns.map((pat) => {
          const isActive = pat.id === currentPatternId;
          const isUserCustom = pat.id.startsWith('user-pat-');

          return (
            <div
              key={pat.id}
              className={`rounded-3xl border p-6 flex flex-col justify-between transition-all ${
                isActive
                  ? 'bg-gradient-to-b from-slate-900 to-blue-950/40 border-blue-500/80 shadow-2xl shadow-blue-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-950 text-blue-400 border border-slate-800">
                      {pat.category}
                    </span>
                    {isUserCustom && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Özel Desen
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      pat.difficulty === 'Kolay'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : pat.difficulty === 'Orta'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {pat.difficulty}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white">{pat.title}</h3>
                </div>

                {/* Kaydetme Tarihi */}
                <div className="flex items-center space-x-1.5 text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 px-2.5 py-1 rounded-lg w-fit">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kayıt Tarihi: <strong className="text-white font-medium">{pat.createdAt || '02.11.2026 10:15'}</strong></span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{pat.description}</p>

                {/* Halı Teknik Özellikleri */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-950 text-slate-300 border border-slate-800">
                    Maks. 6 İğne Atlama
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    GB3: 5D / 5B
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
                    GB5-GB6: Zemin Full
                  </span>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-mono">
                  {pat.rows.length} Kurs | {Object.keys(pat.guideBars).filter((k) => pat.guideBars[k as GuideBarId]?.active).length} Tarak
                </div>

                <div className="flex items-center space-x-2">
                  {isUserCustom && onDeletePattern && (
                    <button
                      onClick={() => onDeletePattern(pat.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
                      title="Özel Deseni Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectPattern(pat)}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aktif Desen</span>
                      </>
                    ) : (
                      <>
                        <span>Deseni Yükle</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
