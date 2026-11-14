import React, { useState } from 'react';
import { PatternData, GuideBarId } from '../types';
import { Search, CheckCircle2, ArrowRight, BookmarkPlus, Trash2, Share2, Copy, Check, Users } from 'lucide-react';
import { PatternThumbnail } from './PatternThumbnail';
import { createSharedPatternLink } from '../services/loggingService';

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState<{ msg: string; link?: string } | null>(null);

  const categories = [
    'Tümü',
    'Halı & Zemin',
    'Bukle & Havlı',
    'Pelüş / Kadife',
    'Rölyef & Jakar',
    'Otomotiv Halısı',
    'Teknik',
    'Geometrik',
  ];

  const handleSharePattern = (pat: PatternData) => {
    try {
      const { url } = createSharedPatternLink(pat);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      setShareToast({
        msg: `"${pat.title}" paylaşım linki kopyalandı!`,
        link: url,
      });
      setTimeout(() => setShareToast(null), 4000);

      // Web Share API native share popup if mobile
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ url })) {
        navigator.share({
          title: pat.title,
          text: `Warp Knitting Tekstil Deseni: ${pat.title}`,
          url,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Share link generation failed', err);
    }
  };

  const handleConfirmDelete = (pat: PatternData) => {
    if (!onDeletePattern) return;
    onDeletePattern(pat.id);
    setConfirmDeleteId(null);
  };

  const filteredPatterns = (Array.isArray(allPatterns) ? allPatterns : []).filter((pat) => {
    if (!pat || !pat.id) return false;
    const titleText = (pat.title || '').toLowerCase();
    const descText = (pat.description || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch = titleText.includes(q) || descText.includes(q);
    const matchesCategory =
      selectedCategory === 'Tümü' ||
      pat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full px-1.5 sm:px-2 py-1.5 space-y-2">
      {/* Toast Notification */}
      {shareToast && (
        <div className="bg-emerald-950/95 border border-emerald-700 text-emerald-100 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 fixed top-14 right-4 z-50 shadow-2xl max-w-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{shareToast.msg}</span>
          </div>
          {shareToast.link && (
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(shareToast.link!);
              }}
              className="p-1 hover:bg-emerald-900 rounded text-emerald-300 hover:text-white shrink-0 cursor-pointer"
              title="Linki Tekrar Kopyala"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Merged Single-Row Filter, Search & Save Toolbar */}
      <section className="bg-[#111827] border border-slate-800 rounded-lg p-2 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-950/60 border border-blue-800 text-blue-300 rounded text-xs font-bold mr-1">
            <Users className="w-3.5 h-3.5" />
            <span>Ortak Kütüphane</span>
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 sm:px-2.5 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#0B0F17] text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ortak deseni ara..."
              className="w-full bg-[#0B0F17] border border-slate-700 rounded pl-8 pr-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={onSaveCurrentToLibrary}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Mevcut Çalışmayı Ortak Kütüphaneye Kaydet"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Ortak Kaydet</span>
          </button>
        </div>
      </section>

      {/* Pattern Catalog Grid with Fabric Thumbnails */}
      {filteredPatterns.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-6 text-center space-y-2">
          <p className="text-xs font-semibold text-slate-300">
            {allPatterns.length === 0
              ? 'Kütüphanede kayıtlı desen bulunmuyor.'
              : 'Arama kriterine uygun desen bulunamadı.'}
          </p>
          {(searchTerm !== '' || selectedCategory !== 'Tümü') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('Tümü');
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              Tümünü Göster
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredPatterns.map((pat) => {
            const isActive = pat.id === currentPatternId;
            const guideBars = pat.guideBars || {};
            const activeGbCount = Object.keys(guideBars).filter(
              (k) => guideBars[k as GuideBarId]?.active
            ).length;
            const courseCount = Array.isArray(pat.rows) ? pat.rows.length : 0;

            return (
              <div
                key={pat.id}
                className={`group rounded-lg border p-2.5 flex flex-col justify-between transition-colors ${
                  isActive
                    ? 'bg-[#111827] border-blue-500'
                    : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex gap-2.5 items-start">
                  {/* Pattern mini fabric preview thumbnail */}
                  <PatternThumbnail pattern={pat} />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300 truncate">{pat.category}</span>
                      <span
                        className="text-[10px] bg-blue-950/60 text-blue-400 border border-blue-800/60 px-1 py-0.2 rounded font-medium flex items-center gap-0.5 shrink-0"
                        title="Tüm kullanıcıların erişebildiği ortak desen"
                      >
                        <Users className="w-2.5 h-2.5" />
                        <span>Ortak</span>
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white tracking-tight truncate" title={pat.title}>
                      {pat.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono tabular-nums">
                      <span>{courseCount}K</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeGbCount}GB</span>
                      <span aria-hidden="true">·</span>
                      <span>{pat.machine?.gauge || 'E22'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="font-mono tabular-nums text-[10px] text-slate-500 truncate">
                    {pat.createdAt || ''}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Share Button */}
                    <button
                      type="button"
                      onClick={() => handleSharePattern(pat)}
                      className="p-1.5 text-slate-300 hover:text-white bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                      title="Deseni Paylaş"
                    >
                      <Share2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Paylaş</span>
                    </button>

                    {onDeletePattern && (
                      confirmDeleteId === pat.id ? (
                        <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-700 rounded px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(pat)}
                            className="text-[10px] font-bold text-rose-200 hover:text-white px-1 cursor-pointer"
                            title="Silmeyi Onayla"
                          >
                            Sil
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] font-semibold text-slate-300 hover:text-white px-1 border-l border-rose-800 cursor-pointer"
                            title="İptal"
                          >
                            Vazgeç
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(pat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 bg-[#0B0F17] border border-slate-800 rounded transition-colors cursor-pointer"
                          title="Ortak Kütüphaneden Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectPattern(pat)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <span>Yükle</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
