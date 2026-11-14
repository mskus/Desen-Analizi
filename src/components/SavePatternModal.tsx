import React, { useState, useEffect } from 'react';
import { PatternData } from '../types';
import { BookmarkPlus, X, Check, Users, AlertTriangle } from 'lucide-react';
import { generatePatternThumbnail } from '../utils/thumbnailGenerator';
import { loadPatternTableExtras, savePatternTableExtras } from '../utils/patternTableCalc';

interface SavePatternModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPattern: PatternData;
  allPatterns: PatternData[];
  onSavePattern: (newPattern: PatternData) => void;
}

export const SavePatternModal: React.FC<SavePatternModalProps> = ({
  isOpen,
  onClose,
  currentPattern,
  allPatterns,
  onSavePattern,
}) => {
  const [title, setTitle] = useState(currentPattern.title);
  const [category, setCategory] = useState<PatternData['category']>(
    currentPattern.category || 'Teknik'
  );
  const [description, setDescription] = useState(
    currentPattern.description || ''
  );
  const [difficulty, setDifficulty] = useState<PatternData['difficulty']>(
    currentPattern.difficulty || 'Orta'
  );
  const [successMode, setSuccessMode] = useState<'new' | 'overwrite' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(currentPattern.title || '');
      setCategory(currentPattern.category || 'Teknik');
      setDescription(currentPattern.description || '');
      setDifficulty(currentPattern.difficulty || 'Orta');
      setSuccessMode(null);
    }
  }, [isOpen, currentPattern]);

  if (!isOpen) return null;

  const normalizedInputTitle = title.trim().toLocaleLowerCase('tr-TR');
  const existingMatch = normalizedInputTitle
    ? (allPatterns || []).find(
        (p) => (p.title || '').trim().toLocaleLowerCase('tr-TR') === normalizedInputTitle
      )
    : undefined;

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

    const targetId = existingMatch
      ? existingMatch.id
      : 'pat-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

    const extras = loadPatternTableExtras(currentPattern);
    savePatternTableExtras(targetId, extras);

    const thumbnail = generatePatternThumbnail(currentPattern);

    const savedPattern: PatternData = {
      ...currentPattern,
      id: targetId,
      authorId: 'common_library',
      thumbnail,
      title: title.trim(),
      category,
      description: description.trim(),
      difficulty,
      createdAt: formattedDate,
      updatedAt: now.toISOString(),
      mayDensity: extras.mayDensity,
      isRackManualOverride: extras.isRackManualOverride,
      rackTensionRows: extras.rackTensionRows,
      rackNote: extras.rackNote,
      tableExtras: {
        isTableManualOverride: extras.isTableManualOverride,
        lockedTableRows: extras.lockedTableRows,
        manualTableOverrides: extras.manualTableOverrides,
        tableSkipOverrides: extras.tableSkipOverrides,
        deletedStepKeys: extras.deletedStepKeys,
        insertedStepsAfter: extras.insertedStepsAfter,
      },
    };

    const isOverwrite = Boolean(existingMatch);
    onSavePattern(savedPattern);
    setSuccessMode(isOverwrite ? 'overwrite' : 'new');
    setTimeout(() => {
      setSuccessMode(null);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="bg-[#111827] border border-slate-700 rounded-lg w-full max-w-sm p-4 shadow-2xl space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">Ortak Kütüphaneye Kaydet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded bg-[#0B0F17] border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Bu desen bulut veri tabanına kaydedilecek ve tüm kullanıcılar tarafından ortak kütüphanede anında görülebilecektir.
        </p>

        {successMode ? (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded text-center space-y-1">
            <Check className="w-5 h-5 text-emerald-400 mx-auto" />
            <div className="text-xs font-bold text-white">
              {successMode === 'overwrite'
                ? 'Mevcut Desenin Üzerine Yazıldı'
                : 'Ortak Kütüphaneye Eklendi'}
            </div>
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

            {existingMatch && (
              <div className="flex items-start gap-2 p-2 rounded bg-amber-950/60 border border-amber-700/80 text-amber-200 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Aynı isimde desen mevcut — kaydedildiğinde mevcut desenin üzerine yazılacak ve en üste taşınacak.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PatternData['category'])}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Halı & Zemin">Halı & Zemin</option>
                  <option value="Bukle & Havlı">Bukle & Havlı</option>
                  <option value="Pelüş / Kadife">Pelüş / Kadife</option>
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
                  onChange={(e) => setDifficulty(e.target.value as PatternData['difficulty'])}
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
                Açıklama / Not
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                placeholder="Desen hakkında teknik not..."
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
                className={`px-4 py-1.5 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                  existingMatch
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>{existingMatch ? 'Üzerine Yaz ve Kaydet' : 'Ortak Kaydet'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
