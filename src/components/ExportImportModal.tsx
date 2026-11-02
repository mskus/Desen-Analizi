import React, { useState } from 'react';
import { PatternData } from '../types';
import { X, Download, Upload, FileJson, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';

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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const exportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentPattern, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `${currentPattern.title.toLowerCase().replace(/\s+/g, '_')}_profile.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const exportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,Course,GB1,GB2,GB3,GB4,GB5,GB6\r\n";
    currentPattern.rows.forEach((r) => {
      csvContent += `${r.courseIndex},${r.GB1},${r.GB2},${r.GB3},${r.GB4},${r.GB5},${r.GB6}\r\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", encodedUri);
    dlAnchor.setAttribute("download", `${currentPattern.title.toLowerCase().replace(/\s+/g, '_')}_table.csv`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  };

  const handleImportJson = () => {
    setStatusMessage(null);
    try {
      if (!importJsonText.trim()) {
        setStatusMessage({ type: 'error', text: 'Lütfen içe aktarılacak JSON verisini yapıştırın.' });
        return;
      }
      const parsed = JSON.parse(importJsonText);
      if (parsed.id && parsed.title && parsed.rows) {
        onImportPattern(parsed);
        setStatusMessage({ type: 'success', text: 'Desen profili başarıyla yüklendi!' });
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setStatusMessage({ type: 'error', text: 'Geçersiz desen formatı: "title" ve "rows" alanları zorunludur.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'JSON ayrıştırma hatası: ' + err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">
            {mode === 'export' ? 'Desen ve Makine Profilini Dışa Aktar' : 'Desen Profilini İçe Aktar'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-950">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/60 border-rose-800 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {mode === 'export' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Mevcut <strong className="text-white">{currentPattern.title}</strong> desen şablonunuzu, tarak ayarlarınızı ve makine parametrelerinizi JSON veya CSV formatında indirebilirsiniz.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={exportJson}
                className="flex items-center justify-center space-x-2 p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-xl text-blue-400 font-semibold text-sm transition shadow"
              >
                <FileJson className="w-5 h-5" />
                <span>JSON Profili İndir</span>
              </button>

              <button
                onClick={exportCsv}
                className="flex items-center justify-center space-x-2 p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-emerald-400 font-semibold text-sm transition shadow"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span>CSV Tablo İndir</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Daha önce dışa aktardığınız desen JSON kodunu aşağıdaki alana yapıştırarak içe aktarın:
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="JSON verisini buraya yapıştırın..."
              className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700 transition"
              >
                İptal
              </button>
              <button
                onClick={handleImportJson}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition"
              >
                İçe Aktar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
