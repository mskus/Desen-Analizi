import React, { useState } from 'react';
import { PatternData } from '../types';
import { BookmarkPlus, X, Check } from 'lucide-react';
import { generatePatternThumbnail } from '../utils/thumbnailGenerator';
import { getClientAuthorId } from '../services/patternSyncService';

interface SavePatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPattern: PatternData;
  onSavePattern: (newPattern: PatternData) => void;
}

export const SavePatternModal: React.FC<SavePatternModalProps> = ({
  isOpen,
  onClose,
  currentPattern,
  onSavePattern,
}) => {
  const [title, setTitle] = useState(currentPattern.title + ' (Özel)');
  const [category, setCategory] = useState<PatternData['category']>(
    currentPattern.category || 'Teknik'
  );
  const [description, setDescription] = useState(
    currentPattern.description || ''
  );
  const [difficulty, setDifficulty] = useState<PatternData['difficulty']>(
    currentPattern.difficulty || 'Orta'
  );
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}.${now.getFullYear()} ${now
      .getHours()
      .toString()
      .padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const authorId = currentPattern.authorId || getClientAuthorId();
    const thumbnail = generatePatternThumbnail(currentPattern);

    const newPattern: PatternData = {
      ...currentPattern,
      id: 'user-pat-' + Date.now(),
      authorId,
      thumbnail,
      title: title.trim(),
      category,
      description: description.trim(),
      difficulty,
      createdAt: formattedDate,
    };

    onSavePattern(newPattern);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="bg-[#111827] border border-slate-700 rounded-lg w-full max-w-sm p-4 shadow-2xl space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <BookmarkPlus className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Deseni Kaydet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded bg-[#0B0F17] border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded text-center space-y-1">
            <Check className="w-5 h-5 text-emerald-400 mx-auto" />
            <div className="text-xs font-bold text-white">Kaydedildi</div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Desen Adı
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Halı & Zemin">Halı & Zemin</option>
                  <option value="Bukle & Havlı">Bukle & Havlı</option>
                  <option value="Peluş / Kadife">Peluş / Kadife</option>
                  <option value="Rölyef & Jakar">Rölyef & Jakar</option>
                  <option value="Otomotiv Halısı">Otomotiv Halısı</option>
                  <option value="Teknik">Teknik</option>
                  <option value="Geometrik">Geometrik</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Seviye
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Kolay">Kolay</option>
                  <option value="Orta">Orta</option>
                  <option value="İleri">İleri</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Not
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="Not..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-[#0B0F17] border border-slate-700 text-slate-300 rounded text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>Kaydet</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
