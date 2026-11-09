import React, { useState, useEffect } from 'react';
import { ActiveTab, PatternData, PatternRow, GuideBarConfig, GuideBarId, MachineProfile, SafetyConfig } from './types';
import { patternLibrary, defaultSafetyConfig, createThreadingArray } from './data/patternLibrary';
import { Navbar } from './components/Navbar';
import { MachineSettingsTab } from './components/MachineSettingsTab';
import { SimulationTab } from './components/SimulationTab';
import { InteractiveEditorTab } from './components/InteractiveEditorTab';
import { AnalysisTab } from './components/AnalysisTab';
import { LibraryTab } from './components/LibraryTab';
import { AccessLogsTab } from './components/AccessLogsTab';
import { ExportImportModal } from './components/ExportImportModal';
import { SafetySettingsModal } from './components/SafetySettingsModal';
import { SavePatternModal } from './components/SavePatternModal';
import {
  savePatternToCloud,
  deletePatternFromCloud,
  subscribeToCloudPatterns,
  getClientAuthorId,
  seedDefaultPatternsIfNeeded,
  getCachedPatterns,
} from './services/patternSyncService';
import { logSiteVisit, logSiteExit, trackSharedLinkOpened, startPresencePing } from './services/loggingService';
import { Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = localStorage.getItem('warpknitt_active_tab');
    if (saved && ['simulation', 'editor', 'machine', 'library', 'analysis', 'logs'].includes(saved)) {
      return saved as ActiveTab;
    }
    return 'simulation';
  });

  useEffect(() => {
    localStorage.setItem('warpknitt_active_tab', activeTab);
  }, [activeTab]);

  const [customPatterns, setCustomPatterns] = useState<PatternData[]>(() => {
    const cached = getCachedPatterns();
    if (cached && cached.length > 0) return cached;
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

  const [history, setHistory] = useState<PatternRow[][]>([currentPattern.rows]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [modalMode, setModalMode] = useState<'export' | 'import' | null>(null);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [shareLoadedNotice, setShareLoadedNotice] = useState<string | null>(null);

  const [fabricWidthCm, setFabricWidthCm] = useState<number>(() => {
    const saved = localStorage.getItem('warpknitt_fabric_width_cm');
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val > 0) return val;
    }
    return 410; // Default: 410 cm
  });

  useEffect(() => {
    localStorage.setItem('warpknitt_fabric_width_cm', fabricWidthCm.toString());
  }, [fabricWidthCm]);

  useEffect(() => {
    localStorage.setItem('warpknitt_current_pattern', JSON.stringify(currentPattern));
  }, [currentPattern]);

  const [currentAuthorId] = useState<string>(() => getClientAuthorId());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('warpknitt_custom_patterns', JSON.stringify(customPatterns));
  }, [customPatterns]);

  // Log site visit & start real-time presence heartbeat on boot + track exits
  useEffect(() => {
    logSiteVisit().catch((err) => console.error('Site visit log error:', err));
    const stopPresence = startPresencePing();

    const handleExit = () => {
      logSiteExit().catch(() => {});
    };

    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      stopPresence();
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
    };
  }, []);

  // Real-time synchronization of universal shared community patterns
  useEffect(() => {
    setIsSyncing(true);
    // Seed default pattern library into shared cloud if empty
    seedDefaultPatternsIfNeeded(patternLibrary).catch(() => {});

    const unsub = subscribeToCloudPatterns((cloudPatterns) => {
      setIsSyncing(false);
      setCustomPatterns(cloudPatterns);
    });

    return () => {
      unsub();
    };
  }, []);

  // Universal shared patterns: All cloud patterns + any defaults not yet in cloud
  const cloudIds = new Set(customPatterns.map((p) => p.id));
  const missingDefaults = patternLibrary.filter((p) => !cloudIds.has(p.id));
  const allPatterns = [...customPatterns, ...missingDefaults];

  // Handle URL share parameters (?patId=xxx&stoken=yyy)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const patId = urlParams.get('patId');
    const stoken = urlParams.get('stoken');

    if (patId) {
      const found = allPatterns.find((p) => p.id === patId);
      if (found) {
        const safePat = {
          ...found,
          safety: found.safety || { ...defaultSafetyConfig },
        };
        setCurrentPattern(safePat);
        setHistory([safePat.rows]);
        setHistoryIndex(0);
        setActiveTab('simulation');
        setShareLoadedNotice(`Paylaşılan desen yüklendi: ${found.title}`);
        setTimeout(() => setShareLoadedNotice(null), 4000);
      }
      if (stoken) {
        trackSharedLinkOpened(stoken, patId, found?.title).catch((err) =>
          console.error('Track share opened error:', err)
        );
      }
    }
  }, [allPatterns.length]);

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
    setCurrentPattern(newPattern);
    setIsSyncing(true);
    savePatternToCloud(newPattern)
      .catch((err) => console.error('Cloud save error:', err))
      .finally(() => setIsSyncing(false));
  };

  const handleDeleteCustomPattern = (id: string) => {
    deletePatternFromCloud(id).catch((err) => {
      console.error('Cloud delete error:', err);
    });
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

  const handleUpdateGuideBar = (id: GuideBarId, updated: GuideBarConfig) => {
    setCurrentPattern((prev) => ({
      ...prev,
      guideBars: {
        ...prev.guideBars,
        [id]: updated,
      },
    }));
  };

  const handleUpdateMachine = (updatedMachine: MachineProfile) => {
    setCurrentPattern((prev) => ({
      ...prev,
      machine: updatedMachine,
    }));
  };

  const handleUpdateSafety = (updatedSafety: SafetyConfig) => {
    setCurrentPattern((prev) => ({
      ...prev,
      safety: updatedSafety,
    }));
  };

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false;
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleAppFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Fullscreen request failed', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Share Link Loaded Toast Banner */}
      {shareLoadedNotice && (
        <div className="bg-emerald-950/95 border border-emerald-700 text-emerald-100 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 fixed top-14 left-1/2 transform -translate-x-1/2 z-50 shadow-2xl">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{shareLoadedNotice}</span>
        </div>
      )}

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentPattern={currentPattern}
        allPatterns={allPatterns}
        onSelectPattern={(pat) => {
          const safePat: PatternData = {
            ...pat,
            safety: pat.safety || { ...defaultSafetyConfig },
          };
          setCurrentPattern(safePat);
          setHistory([safePat.rows]);
          setHistoryIndex(0);
        }}
        onOpenExport={() => setModalMode('export')}
        onOpenImport={() => setModalMode('import')}
        onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
        onOpenSaveToLibrary={() => setIsSaveModalOpen(true)}
        onToggleFullscreen={toggleAppFullscreen}
        isFullscreen={isFullscreen}
        fabricWidthCm={fabricWidthCm}
        onChangeFabricWidth={setFabricWidthCm}
        isSyncing={isSyncing}
      />

      <main className="flex-1 pb-2">
        {activeTab === 'machine' && (
          <MachineSettingsTab
            machine={currentPattern.machine}
            onChangeMachine={handleUpdateMachine}
            guideBars={currentPattern.guideBars}
            onChangeGuideBar={handleUpdateGuideBar}
            safety={currentPattern.safety}
            onChangeSafety={handleUpdateSafety}
            rows={currentPattern.rows}
            onChangeRows={handleUpdateRows}
            fabricWidthCm={fabricWidthCm}
            onChangeFabricWidth={setFabricWidthCm}
            onNavigateToLogs={() => setActiveTab('logs')}
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
            fabricWidthCm={fabricWidthCm}
            onChangeFabricWidth={setFabricWidthCm}
          />
        )}

        {activeTab === 'simulation' && (
          <SimulationTab
            pattern={currentPattern}
            onChangeGuideBar={handleUpdateGuideBar}
            onChangeRows={handleUpdateRows}
            onChangeSafety={handleUpdateSafety}
            onChangeMachine={handleUpdateMachine}
            onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggleFullscreen={toggleAppFullscreen}
            isFullscreen={isFullscreen}
            fabricWidthCm={fabricWidthCm}
            onChangeFabricWidth={setFabricWidthCm}
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

        {activeTab === 'analysis' && (
          <AnalysisTab
            pattern={currentPattern}
            fabricWidthCm={fabricWidthCm}
            onChangeMachine={handleUpdateMachine}
            onOpenSafetySettings={() => setIsSafetyModalOpen(true)}
          />
        )}

        {activeTab === 'logs' && (
          <AccessLogsTab
            onSelectPatternById={(patId) => {
              const found = allPatterns.find((p) => p.id === patId);
              if (found) handleSelectPattern(found);
            }}
          />
        )}
      </main>

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

      <SafetySettingsModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        safety={currentPattern.safety || defaultSafetyConfig}
        onChangeSafety={handleUpdateSafety}
        rows={currentPattern.rows}
        onChangeRows={handleUpdateRows}
        onNavigateToLogs={() => {
          setIsSafetyModalOpen(false);
          setActiveTab('logs');
        }}
      />

      <SavePatternModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        currentPattern={currentPattern}
        onSavePattern={handleSavePatternToLibrary}
      />
    </div>
  );
}
