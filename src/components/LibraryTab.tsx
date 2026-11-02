import React, { useState } from 'react';
import { PatternData, GuideBarId } from '../types';
import { Search, CheckCircle2, ArrowRight, BookmarkPlus, Trash2 } from 'lucide-react';

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

  const categories = ['Tümü', 'Bukle & Havlı', 'Peluş / Kadife', 'Rölyef & Jakar', 'Otomotiv Halısı', 'Özel'];

  const filteredPatterns = allPatterns.filter((pat) => {
    const isUserPattern = pat.id.startsWith('user-pat-');
    const matchesSearch =
      pat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pat.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'Tümü' ||
      (selectedCategory === 'Özel' && isUserPattern) ||
      pat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-3">
      {/* Search & Categories Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Desen ara..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={onSaveCurrentToLibrary}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1 shrink-0"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Mevcut Deseni Kaydet</span>
          </button>
        </div>

        {/* Filter categories */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredPatterns.map((pat) => {
          const isActive = pat.id === currentPatternId;
          const isUserCustom = pat.id.startsWith('user-pat-');

          return (
            <div
              key={pat.id}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition ${
                isActive
                  ? 'bg-slate-900 border-blue-500 shadow-md'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-slate-400">
                    <span className="font-semibold text-slate-300">{pat.category}</span>
                    {isUserCustom && <span className="text-emerald-400 font-bold">· Özel</span>}
                  </div>
                  {pat.createdAt && (
                    <span className="text-[11px] text-slate-500 font-mono">{pat.createdAt}</span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight">{pat.title}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{pat.description}</p>

                <div className="text-[11px] text-slate-500 font-mono pt-1">
                  Maks. 6 Atkı · GB3: 5D/5B · {pat.rows.length} Kurs
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {Object.keys(pat.guideBars).filter((k) => pat.guideBars[k as GuideBarId]?.active).length} Aktif Tarak
                </span>

                <div className="flex items-center space-x-1.5">
                  {isUserCustom && onDeletePattern && (
                    <button
                      onClick={() => onDeletePattern(pat.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectPattern(pat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <span>Yükle</span>
                        <ArrowRight className="w-3.5 h-3.5" />
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
