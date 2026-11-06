import React, { useState } from 'react';
import { PatternData } from '../types';
import { X, FileJson, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'export' | 'import';
  currentPattern: PatternData;
  onImportPattern: (pattern: PatternData) => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  mode,
  currentPattern,
  onImportPattern,
}) => {
  const [importJsonText, setImportJsonText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const exportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(currentPattern, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute(
      'download',
      `${currentPattern.title.toLowerCase().replace(/\s+/g, '_')}_profil.json`
    );
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const exportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Course,GB1,GB2,GB3,GB4,GB5,GB6\r\n';
    currentPattern.rows.forEach((r) => {
      csvContent += `${r.courseIndex},${r.GB1},${r.GB2},${r.GB3},${r.GB4},${r.GB5},${r.GB6}\r\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', encodedUri);
    dlAnchor.setAttribute(
      'download',
      `${currentPattern.title.toLowerCase().replace(/\s+/g, '_')}_tablo.csv`
    );
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportJson = () => {
    setStatusMessage(null);
    try {
      if (!importJsonText.trim()) {
        setStatusMessage({
          type: 'error',
          text: 'JSON verisini yapıştırın.',
        });
        return;
      }
      const parsed = JSON.parse(importJsonText);
      if (parsed.id && parsed.title && parsed.rows) {
        onImportPattern(parsed);
        setStatusMessage({
          type: 'success',
          text: 'Desen yüklendi.',
        });
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Geçersiz JSON formatı.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Hata: ' + err.message,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
      <div className="bg-[#111827] border border-slate-700 rounded-lg w-full max-w-md p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">
            {mode === 'export' ? 'Dosya İndir' : 'Dosya Yükle (JSON)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded bg-[#0B0F17] border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-2 rounded text-xs font-semibold flex items-center gap-1.5 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                : 'bg-rose-950/80 border-rose-700 text-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {mode === 'export' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="flex items-center justify-center gap-1.5 p-3 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 rounded-lg text-blue-400 font-semibold text-xs transition-colors cursor-pointer"
            >
              <FileJson className="w-4 h-4" />
              <span>JSON İndir</span>
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center justify-center gap-1.5 p-3 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 font-semibold text-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>CSV İndir</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="JSON verisini yapıştırın..."
              className="w-full h-32 bg-[#0B0F17] border border-slate-700 rounded p-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-[#0B0F17] border border-slate-700 text-slate-300 rounded text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                Yükle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
