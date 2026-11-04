import React, { useState, useEffect } from 'react';
import { ActiveTab, PatternData, PatternRow, GuideBarConfig, GuideBarId, MachineProfile, SafetyConfig } from './types';
import { patternLibrary, defaultSafetyConfig, createThreadingArray } from './data/patternLibrary';
import { Navbar } from './components/Navbar';
import { MachineSettingsTab } from './components/MachineSettingsTab';
import { SimulationTab } from './components/SimulationTab';
import { InteractiveEditorTab } from './components/InteractiveEditorTab';
import { LibraryTab } from './components/LibraryTab';
import { ExportImportModal } from './components/ExportImportModal';
import { SafetySettingsModal } from './components/SafetySettingsModal';
import { SavePatternModal } from './components/SavePatternModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('warpknitt_active_tab');
    if (saved && ['simulation', 'editor', 'machine', 'library'].includes(saved)) {
      return saved as ActiveTab;
    }
    return 'simulation';
  });

  useEffect(() => {
    localStorage.setItem('warpknitt_active_tab', activeTab);
  }, [activeTab]);

  // Custom user patterns stored in localStorage
  const [customPatterns, setCustomPatterns] = useState<PatternData[]>(() => {
    const saved = localStorage.getItem('warpknitt_custom_patterns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse custom patterns', e);
      }
    }
    return [];
  });

  const [currentPattern, setCurrentPattern] = useState<PatternData>(() => {
    const saved = localStorage.getItem('warpknitt_current_pattern');
    if (saved) {
      try {
        const parsed: PatternData = JSON.parse(saved);
        if (!parsed.safety) parsed.safety = { ...defaultSafetyConfig };
        if (parsed.guideBars) {
          (Object.keys(parsed.guideBars) as GuideBarId[]).forEach((k) => {
            if (!parsed.guideBars[k].threadingArray || parsed.guideBars[k].threadingArray.length === 0) {
              parsed.guideBars[k].threadingArray = createThreadingArray(parsed.guideBars[k].threading || 'Full');
            }
          });
        }
        // If cached pattern is from the previous non-carpet library, refresh to the new carpet library
        if (parsed.id.startsWith('pat-')) {
          return patternLibrary[0];
        }
        if (!parsed.createdAt) {
          parsed.createdAt = '02.11.2026 10:14';
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved pattern', e);
      }
    }
    return patternLibrary[0];
  });

  // Undo / Redo history for rows
  const [history, setHistory] = useState<PatternRow[][]>([currentPattern.rows]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Modal states
  const [modalMode, setModalMode] = useState<'export' | 'import' | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  // Save current pattern to localStorage
  useEffect(() => {
    localStorage.setItem('warpknitt_current_pattern', JSON.stringify(currentPattern));
  }, [currentPattern]);

  // Save custom patterns to localStorage
  useEffect(() => {
    localStorage.setItem('warpknitt_custom_patterns', JSON.stringify(customPatterns));
  }, [customPatterns]);

  const handleSelectPattern = (pattern: PatternData) => {
    const safePat: PatternData = {
      ...pattern,
      safety: pattern.safety || { ...defaultSafetyConfig },
    };
    setCurrentPattern(safePat);
    setHistory([safePat.rows]);
    setHistoryIndex(0);
    setActiveTab('simulation');
  };

  const handleSavePatternToLibrary = (newPattern: PatternData) => {
    setCustomPatterns((prev) => [newPattern, ...prev]);
    setCurrentPattern(newPattern);
  };

  const handleDeleteCustomPattern = (id: string) => {
    setCustomPatterns((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpdateRows = (newRows: PatternRow[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newRows);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    setCurrentPattern((prev) => ({
      ...prev,
      rows: newRows,
    }));
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setCurrentPattern((prev) => ({
        ...prev,
        rows: history[newIdx],
      }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setCurrentPattern((prev) => ({
        ...prev,
        rows: history[newIdx],
      }));
    }
  };

  const handleUpdateMachine = (machine: MachineProfile) => {
    setCurrentPattern((prev) => ({
      ...prev,
      machine,
    }));
  };

  const handleUpdateGuideBar = (id: GuideBarId, gbConfig: GuideBarConfig) => {
    setCurrentPattern((prev) => ({
      ...prev,
      guideBars: {
        ...prev.guideBars,
        [id]: gbConfig,
      },
    }));
  };

  const handleUpdateSafety = (safety: SafetyConfig) => {
    setCurrentPattern((prev) => ({
      ...prev,
      safety,
    }));
  };

  const appRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      if (appRef.current) {
        appRef.current.requestFullscreen().catch((err) => console.error(err));
      } else {
        document.documentElement.requestFullscreen().catch((err) => console.error(err));
      }
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  };

  const allPatterns = [...customPatterns, ...patternLibrary];

  return (
    <div ref={appRef} className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentPattern={currentPattern}
        onOpenExport={() => setModalMode('export')}
        onOpenImport={() => setModalMode('import')}
        onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
        onOpenSaveToLibrary={() => setIsSaveModalOpen(true)}
        onToggleFullscreen={toggleAppFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-8">
        {activeTab === 'machine' && (
          <MachineSettingsTab
            machine={currentPattern.machine}
            onChangeMachine={handleUpdateMachine}
            guideBars={currentPattern.guideBars}
            onChangeGuideBar={handleUpdateGuideBar}
            onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
          />
        )}

        {activeTab === 'editor' && (
          <InteractiveEditorTab
            pattern={currentPattern}
            onChangeRows={handleUpdateRows}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggleFullscreen={toggleAppFullscreen}
            isFullscreen={isFullscreen}
          />
        )}

        {activeTab === 'simulation' && (
          <SimulationTab
            pattern={currentPattern}
            onChangeGuideBar={handleUpdateGuideBar}
            onChangeRows={handleUpdateRows}
            onChangeSafety={handleUpdateSafety}
            onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggleFullscreen={toggleAppFullscreen}
            isFullscreen={isFullscreen}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            currentPatternId={currentPattern.id}
            allPatterns={allPatterns}
            onSelectPattern={handleSelectPattern}
            onSaveCurrentToLibrary={() => setIsSaveModalOpen(true)}
            onDeletePattern={handleDeleteCustomPattern}
          />
        )}
      </main>

      {/* Export / Import Modal */}
      <ExportImportModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        mode={modalMode || 'export'}
        currentPattern={currentPattern}
        onImportPattern={(pat) => {
          const safePat = {
            ...pat,
            safety: pat.safety || { ...defaultSafetyConfig },
          };
          setCurrentPattern(safePat);
          setHistory([safePat.rows]);
          setHistoryIndex(0);
        }}
      />

      {/* Safe Guide Bar Settings Modal */}
      <SafetySettingsModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        safety={currentPattern.safety || defaultSafetyConfig}
        onChangeSafety={handleUpdateSafety}
        rows={currentPattern.rows}
        onChangeRows={handleUpdateRows}
      />

      {/* Save Pattern to Library Modal */}
      <SavePatternModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        currentPattern={currentPattern}
        onSavePattern={handleSavePatternToLibrary}
      />
    </div>
  );
}
