import React, { useState } from 'react';
import { PatternData } from '../types';
import { BookmarkPlus, X, Check, Sparkles } from 'lucide-react';

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
  const [category, setCategory] = useState<PatternData['category']>(currentPattern.category || 'Teknik');
  const [description, setDescription] = useState(currentPattern.description || 'Kullanıcı tarafından oluşturulan özel desen.');
  const [difficulty, setDifficulty] = useState<PatternData['difficulty']>(currentPattern.difficulty || 'Orta');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newPattern: PatternData = {
      ...currentPattern,
      id: 'user-pat-' + Date.now(),
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
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Deseni Kütüphaneye Ekle</h3>
              <p className="text-xs text-slate-400">Mevcut deseni şablon olarak saklayın ve istediğiniz zaman yükleyin.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-950">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-950/70 border border-emerald-700 rounded-2xl text-center space-y-2">
            <Check className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">Desen Başarıyla Eklendi!</div>
            <p className="text-xs text-emerald-300">Desen Kütüphanesi sekmesinden bu desene dilediğiniz zaman ulaşabilirsiniz.</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Desen Adı</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Örn: Özel 3-Needle Satin"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-xs font-bold text-slate-300 mb-1">Zorluk</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Kolay">Kolay</option>
                  <option value="Orta">Orta</option>
                  <option value="İleri">İleri</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Açıklama</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Desen teknik detayları ve kullanım amacı..."
              />
            </div>

            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center space-x-1.5"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Kütüphaneye Kaydet</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
