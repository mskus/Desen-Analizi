import React, { useState, useRef, useEffect } from 'react';
import { PatternData, GuideBarId, GuideBarConfig, SafetyConfig } from '../types';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Sun,
  Moon,
  Info
} from 'lucide-react';

interface SimulationTabProps {
  pattern: PatternData;
  onChangeGuideBar: (id: GuideBarId, updated: GuideBarConfig) => void;
  onOpenSafetySettings: () => void;
}

type SimulationDisplayMode = 'dual' | 'technical' | 'fabric';

export const SimulationTab: React.FC<SimulationTabProps> = ({
  pattern,
  onChangeGuideBar,
  onOpenSafetySettings,
}) => {
  const [displayMode, setDisplayMode] = useState<SimulationDisplayMode>('dual');

  // Maintain local guideBars state for 0ms instantaneous canvas reflection
  const [guideBarsState, setGuideBarsState] = useState<Record<GuideBarId, GuideBarConfig>>(pattern.guideBars);

  // Sync when pattern prop updates from parent
  useEffect(() => {
    setGuideBarsState(pattern.guideBars);
  }, [pattern.guideBars]);

  // Isolate active editing guide bar in simulation canvas
  const [isolateActiveBar, setIsolateActiveBar] = useState<boolean>(false);

  // Currently selected guide bar for in-simulation threading editor
  const [editingGbId, setEditingGbId] = useState<GuideBarId>('GB3');
  const [binaryThreadingInput, setBinaryThreadingInput] = useState<string>('');

  // Paper mode: 'dark' (CAD) or 'white' (Classical Karl Mayer point paper as in user image)
  const [paperTheme, setPaperTheme] = useState<'dark' | 'white'>('dark');

  // Layer switches
  const [showStepNumbers, setShowStepNumbers] = useState(true);
  const [showLoopCurves, setShowLoopCurves] = useState(true);
  const [showPoreMesh, setShowPoreMesh] = useState(true);

  // Repeat and dimension controls (2x 3x 4x tablo uzasın, yükseklik & zoom)
  const [repeatY, setRepeatY] = useState<number>(2);
  const [zoom, setZoom] = useState<number>(1);
  const [customCoursePitch, setCustomCoursePitch] = useState<number>(36);

  const technicalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // DYNAMIC NEEDLE COUNT: Tied directly to pattern.safety.maxAllowedNeedleNumber!
  const needleCols = Math.max(8, Math.min(48, pattern.safety?.maxAllowedNeedleNumber || 18));
  const needlePitch = 38;
  const coursePitch = customCoursePitch;

  const currentGuideBars = guideBarsState || pattern.guideBars;
  const activeBars = (Object.keys(currentGuideBars) as GuideBarId[]).filter(
    (id) => currentGuideBars[id]?.active
  );

  const rows = pattern.rows;
  const totalCourses = Math.max(1, rows.length * repeatY);

  // Auto calculate canvas heights and widths so table extends dynamically with 2x 3x 4x and needleCols!
  const canvasHeight = Math.max(620, totalCourses * coursePitch + 170);
  const techCanvasWidth = needleCols * needlePitch + 340;
  const fabricCanvasWidth = needleCols * needlePitch + 160;

  // Current editing guide bar config and threading array
  const currentGb = currentGuideBars[editingGbId] || currentGuideBars.GB3 || currentGuideBars.GB1;
  const currentThreading = Array.from({ length: needleCols }, (_, i) => {
    if (currentGb?.threadingArray && typeof currentGb.threadingArray[i] === 'boolean') {
      return currentGb.threadingArray[i];
    }
    return i % 2 === 0;
  });

  // Sync binary string when editingGbId or currentThreading changes
  useEffect(() => {
    const binStr = currentThreading.map((b) => (b ? '1' : '0')).join('');
    setBinaryThreadingInput(binStr);
  }, [editingGbId, currentGb?.threadingArray, needleCols]);

  // Toggle single needle threading directly inside simulation with instant redraw
  const handleToggleNeedle = (nIdx: number) => {
    const updatedArray = [...currentThreading];
    updatedArray[nIdx] = !updatedArray[nIdx];

    const binStr = updatedArray.map((b) => (b ? '1' : '0')).join('');
    setBinaryThreadingInput(binStr);

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: updatedArray,
      threading: 'Özel Dizim',
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);

    // Instant synchronous canvas repaint
    requestAnimationFrame(() => {
      drawTechnicalDiagram(newGuideBars);
      drawFabricSimulation(newGuideBars);
    });
  };

  // Guide bar visibility toggles (allows isolating GB3 or any specific bar)
  const [visibleBars, setVisibleBars] = useState<Record<GuideBarId, boolean>>({
    GB1: true,
    GB2: true,
    GB3: true,
    GB4: true,
    GB5: true,
    GB6: true,
  });

  // Apply predefined threading preset with instant redraw
  const handleApplyPreset = (preset: 'full' | 'clear' | '5-5' | '1-1' | '1-2' | '1-3' | '2-2' | 'invert') => {
    const newArr = Array.from({ length: needleCols }, (_, i) => {
      if (preset === 'full') return true;
      if (preset === 'clear') return false;
      if (preset === '5-5') return (i % 10) < 5;
      if (preset === '1-1') return i % 2 === 0;
      if (preset === '1-2') return i % 3 === 0;
      if (preset === '1-3') return i % 4 === 0;
      if (preset === '2-2') return Math.floor(i / 2) % 2 === 0;
      if (preset === 'invert') return !currentThreading[i];
      return true;
    });

    const labelMap: Record<string, string> = {
      full: 'Full (Tam Dolu)',
      clear: 'Tümü Boş (Temiz)',
      '5-5': '5 Dolu 5 Boş (5-in 5-out)',
      '1-1': '1-in 1-out (1 Dolu 1 Boş)',
      '1-2': '1-in 2-out (1 Dolu 2 Boş)',
      '1-3': '1-in 3-out (1 Dolu 3 Boş)',
      '2-2': '2-in 2-out (2 Dolu 2 Boş)',
      invert: 'Ters Dizim',
    };

    setBinaryThreadingInput(newArr.map((b) => (b ? '1' : '0')).join(''));

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: labelMap[preset] || 'Özel Dizim',
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);

    requestAnimationFrame(() => {
      drawTechnicalDiagram(newGuideBars);
      drawFabricSimulation(newGuideBars);
    });
  };

  // Binary text input change with instant redraw
  const handleBinaryInput = (val: string) => {
    const clean = val.replace(/[^01]/g, '').slice(0, needleCols);
    setBinaryThreadingInput(clean);

    const newArr = Array.from({ length: needleCols }, (_, i) => {
      if (i < clean.length) return clean[i] === '1';
      return false;
    });

    const updatedGb: GuideBarConfig = {
      ...currentGb,
      threadingArray: newArr,
      threading: 'Özel Dizim',
    };

    const newGuideBars: Record<GuideBarId, GuideBarConfig> = {
      ...currentGuideBars,
      [editingGbId]: updatedGb,
    };

    setGuideBarsState(newGuideBars);
    onChangeGuideBar(editingGbId, updatedGb);

    requestAnimationFrame(() => {
      drawTechnicalDiagram(newGuideBars);
      drawFabricSimulation(newGuideBars);
    });
  };

  // Safety checks calculation
  const safety = pattern.safety;
  const safetyWarnings: string[] = [];
  rows.forEach((r, rIdx) => {
    if (rIdx > 0) {
      activeBars.forEach((gbId) => {
        const jump = Math.abs(r[gbId] - rows[rIdx - 1][gbId]);
        if (jump > safety.maxSafeShoggingJump) {
          safetyWarnings.push(
            `Kurs ${r.courseIndex}, ${gbId}: Atlama ${jump} iğne (Sınır: ${safety.maxSafeShoggingJump})`
          );
        }
      });
    }
  });

  // 1. Draw Technical Warp Knitting Point Paper Diagram
  const drawTechnicalDiagram = (overrideGuideBars?: Record<GuideBarId, GuideBarConfig>) => {
    const canvas = technicalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gbMap = overrideGuideBars || guideBarsState || pattern.guideBars;
    const isWhite = paperTheme === 'white';

    // Background: Technical white paper or CAD dark blue
    ctx.fillStyle = isWhite ? '#ffffff' : '#080d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startX = 70;
    const startY = 85;

    // A. Needles Header & Vertical Wale Guide Lines
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';

    for (let n = 0; n < needleCols; n++) {
      const nx = startX + n * needlePitch;

      // Needle Number
      ctx.fillStyle = isWhite ? '#475569' : '#94a3b8';
      ctx.fillText(`İ${n}`, nx, startY - 42);

      // Threading status dots for each active bar directly atop each needle
      const barsToDisplay = isolateActiveBar ? [editingGbId] : activeBars;
      barsToDisplay.forEach((gbId, gbIdx) => {
        const gb = gbMap[gbId];
        if (!gb) return;
        const isThreaded = gb.threadingArray && typeof gb.threadingArray[n] === 'boolean'
          ? gb.threadingArray[n]
          : n % 2 === 0;
        const py = startY - 26 + gbIdx * 9;
        const isEdited = gbId === editingGbId;

        ctx.fillStyle = isThreaded ? gb.color : isWhite ? '#e2e8f0' : '#1e293b';
        ctx.beginPath();
        ctx.arc(nx, py, isEdited ? (isThreaded ? 4.5 : 3) : isThreaded ? 3 : 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (isThreaded) {
          ctx.strokeStyle = isEdited ? '#ffffff' : isWhite ? '#0f172a' : '#ffffff';
          ctx.lineWidth = isEdited ? 1.5 : 0.8;
          ctx.stroke();
        } else if (isEdited) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Needle wale vertical line (as seen in Karl Mayer attachment)
      ctx.strokeStyle = isWhite ? '#e2e8f0' : '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, startY - 5);
      ctx.lineTo(nx, startY + totalCourses * coursePitch + 15);
      ctx.stroke();
    }

    // B. Horizontal Course Grid Lines & Course Labels
    for (let c = 0; c <= totalCourses; c++) {
      const cy = startY + c * coursePitch;

      ctx.strokeStyle = c % rows.length === 0
        ? (isWhite ? '#94a3b8' : '#1e3a8a')
        : (isWhite ? '#f1f5f9' : '#0f172a');
      ctx.lineWidth = c % rows.length === 0 ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(startX - 20, cy);
      ctx.lineTo(startX + (needleCols - 1) * needlePitch + 20, cy);
      ctx.stroke();

      if (c < totalCourses) {
        const courseNum = c + 1;
        ctx.fillStyle = c % rows.length === 0
          ? (isWhite ? '#0284c7' : '#38bdf8')
          : (isWhite ? '#64748b' : '#64748b');
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`K${courseNum}`, startX - 26, cy + coursePitch / 2 + 4);
      }
    }

    // C. Needle Trick Points (Pins) at each (course, needle) intersection
    for (let c = 0; c < totalCourses; c++) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      for (let n = 0; n < needleCols; n++) {
        const nx = startX + n * needlePitch;
        ctx.fillStyle = isWhite ? '#94a3b8' : '#334155';
        ctx.beginPath();
        ctx.arc(nx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (activeBars.length === 0) {
      ctx.fillStyle = isWhite ? '#64748b' : '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lütfen en az bir tarak (GB) aktif edin.', canvas.width / 2, canvas.height / 2);
      return;
    }

    // D. Draw Accurate Warp Knitting Shogging Paths for Each Threaded Guide
    const barsToDraw = isolateActiveBar
      ? [editingGbId]
      : activeBars.filter((id) => visibleBars[id] !== false);

    barsToDraw.forEach((gbId, gbIdx) => {
      const gb = gbMap[gbId];
      if (!gb) return;
      const isEdited = gbId === editingGbId;
      const gbColor = gb.color;
      const offsetGbX = isolateActiveBar ? 0 : (gbIdx - (barsToDraw.length - 1) / 2) * 5;

      ctx.strokeStyle = gbColor;
      ctx.fillStyle = gbColor;
      ctx.lineWidth = isEdited ? 3.0 : 1.8;

      // Find all threaded needles for this guide bar directly from gb.threadingArray
      const threadedGuides: number[] = [];
      for (let n = 0; n < needleCols; n++) {
        const isThreaded = gb.threadingArray && typeof gb.threadingArray[n] === 'boolean'
          ? gb.threadingArray[n]
          : n % 2 === 0;
        if (isThreaded) threadedGuides.push(n);
      }

      // Draw continuous thread for each threaded guide across all repeated courses
      threadedGuides.forEach((g) => {
        ctx.beginPath();
        let hasStarted = false;

        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const targetNeedle = g + shift;

            if (targetNeedle >= 0 && targetNeedle < needleCols) {
              const px = startX + targetNeedle * needlePitch + offsetGbX;
              const py = startY + c * coursePitch + coursePitch / 2;

              if (!hasStarted) {
                ctx.moveTo(px, py);
                hasStarted = true;
              } else {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                const prevShift = prevRow[gbId] || 0;
                const prevNeedle = g + prevShift;
                const prevX = startX + prevNeedle * needlePitch + offsetGbX;
                const prevY = startY + (c - 1) * coursePitch + coursePitch / 2;

                if (showLoopCurves) {
                  const cpY = (prevY + py) / 2;
                  ctx.bezierCurveTo(prevX, cpY, px, cpY, px, py);
                } else {
                  ctx.lineTo(px, py);
                }
              }
            } else {
              hasStarted = false;
            }
          });
        }
        ctx.stroke();

        // Draw Loop Heads / Trick Points on active threaded needle nodes
        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const targetNeedle = g + shift;

            if (targetNeedle >= 0 && targetNeedle < needleCols) {
              const px = startX + targetNeedle * needlePitch + offsetGbX;
              const py = startY + c * coursePitch + coursePitch / 2;

              ctx.beginPath();
              ctx.arc(px, py, isEdited ? 4.5 : 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = isEdited ? '#ffffff' : isWhite ? '#ffffff' : '#0f172a';
              ctx.lineWidth = isEdited ? 1.5 : 1;
              ctx.stroke();
            }
          });
        }
      });

      // E. Step Numbers & Shogging Deltas (Adım Sayıları)
      for (let rep = 0; rep < repeatY; rep++) {
        rows.forEach((row, rIdx) => {
          const c = rep * rows.length + rIdx;
          const shift = row[gbId] || 0;

          let prevShift = shift;
          if (c > 0) {
            const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
            prevShift = prevRow[gbId] || 0;
          }
          const stepDiff = shift - prevShift;
          const stepText = stepDiff === 0 ? '0' : stepDiff > 0 ? `+${stepDiff}` : `${stepDiff}`;

          // On-graph Delta label
          if (showStepNumbers && threadedGuides.length > 0 && c > 0 && Math.abs(stepDiff) > 0) {
            const firstGuide = threadedGuides[0];
            const targetNeedle = firstGuide + shift;
            if (targetNeedle >= 0 && targetNeedle < needleCols) {
              const px = startX + targetNeedle * needlePitch + offsetGbX;
              const py = startY + c * coursePitch + coursePitch / 2;

              ctx.fillStyle = isWhite ? '#0f172a' : '#f8fafc';
              ctx.font = 'bold 9px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText(`Δ:${stepText}`, px + 6, py - 3);
            }
          }

          // Right-Hand Step Columns Log
          if (showStepNumbers) {
            const py = startY + c * coursePitch + coursePitch / 2;
            const sideX = startX + (needleCols - 1) * needlePitch + 35 + gbIdx * 52;

            ctx.fillStyle = isWhite ? '#f8fafc' : '#0f172a';
            ctx.fillRect(sideX - 4, py - 9, 46, 18);
            ctx.strokeStyle = gb.color;
            ctx.lineWidth = isEdited ? 2 : 1;
            ctx.strokeRect(sideX - 4, py - 9, 46, 18);

            ctx.fillStyle = isWhite ? '#0f172a' : gb.color;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${gbId}:${stepText}`, sideX + 19, py + 3.5);
          }
        });
      }
    });

    // Step Column Table Headers
    if (showStepNumbers) {
      barsToDraw.forEach((gbId, gbIdx) => {
        const gb = gbMap[gbId];
        if (!gb) return;
        const sideX = startX + (needleCols - 1) * needlePitch + 35 + gbIdx * 52;
        ctx.fillStyle = isWhite ? '#0f172a' : gb.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(gbId, sideX + 19, startY - 35);
        ctx.fillText('Adım Δ', sideX + 19, startY - 20);
      });
    }
  };

  // 2. Draw Realistic Fabric Simulation with Instant Real-Time Threading Feedback
  const drawFabricSimulation = (overrideGuideBars?: Record<GuideBarId, GuideBarConfig>) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gbMap = overrideGuideBars || guideBarsState || pattern.guideBars;

    // Textile background
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#0a0f1e');
    bgGradient.addColorStop(1, '#05070d');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeAndVisibleBars = isolateActiveBar
      ? [editingGbId]
      : activeBars.filter((id) => visibleBars[id] !== false);

    if (activeAndVisibleBars.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lütfen en az bir aktif tarak görünürlüğünü açın.', canvas.width / 2, canvas.height / 2);
      return;
    }

    const startX = 65;
    const startY = 85;

    // Threading array of the currently edited guide bar
    const currentGbConfig = gbMap[editingGbId] || gbMap.GB3 || gbMap.GB1;
    const editingBarThreading = Array.from({ length: needleCols }, (_, i) => {
      if (currentGbConfig?.threadingArray && typeof currentGbConfig.threadingArray[i] === 'boolean') {
        return currentGbConfig.threadingArray[i];
      }
      return i % 2 === 0;
    });

    // Needle Wales Header & Threading Indicators (Dolu / Boş Durumu)
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    for (let n = 0; n < needleCols; n++) {
      const nx = startX + n * needlePitch;

      // Needle Index
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`İ${n}`, nx, startY - 42);

      // Threading status of the selected guide bar (LIVE REFLECTION)
      const isCurrentGbThreaded = editingBarThreading[n] ?? false;

      ctx.save();
      if (isCurrentGbThreaded) {
        // DOLU: Glowing colored circle with white core
        ctx.fillStyle = currentGbConfig?.color || '#38bdf8';
        ctx.shadowColor = currentGbConfig?.color || '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(nx, startY - 20, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(nx, startY - 20, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('DOLU', nx, startY - 7);
      } else {
        // BOŞ: Distinct hollow ring with dashed border
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(nx, startY - 20, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText('BOŞ', nx, startY - 7);
      }
      ctx.restore();

      // Wale vertical baseline
      ctx.strokeStyle = isCurrentGbThreaded ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, startY + 5);
      ctx.lineTo(nx, startY + totalCourses * coursePitch + 10);
      ctx.stroke();
    }

    // Helper: Determine if needle 'needle' at course 'c' has yarn from visible bars
    const hasYarnAtNeedle = (c: number, needle: number) => {
      const rIdx = c % rows.length;
      const row = rows[rIdx];
      return activeAndVisibleBars.some((gbId) => {
        const gb = gbMap[gbId];
        if (!gb) return false;
        const shift = row[gbId] || 0;
        const guide = needle - shift;
        if (guide < 0 || guide >= needleCols) return false;
        const arr = gb.threadingArray || [];
        return arr[guide] === true;
      });
    };

    // Helper: Determine if current editing guide bar has yarn at needle
    const hasEditingBarYarnAtNeedle = (c: number, needle: number) => {
      const rIdx = c % rows.length;
      const row = rows[rIdx];
      const shift = row[editingGbId] || 0;
      const guide = needle - shift;
      if (guide < 0 || guide >= needleCols) return false;
      return editingBarThreading[guide] === true;
    };

    // Pore Mesh Background: Open pores & empty pile relief channels where yarn is absent
    if (showPoreMesh) {
      for (let c = 0; c < totalCourses; c++) {
        for (let n = 0; n < needleCols; n++) {
          const hasYarn = isolateActiveBar ? hasEditingBarYarnAtNeedle(c, n) : hasYarnAtNeedle(c, n);
          const hasEditingYarn = hasEditingBarYarnAtNeedle(c, n);

          if (!hasYarn || (!isolateActiveBar && !hasEditingYarn)) {
            // Open mesh pore (delik/boşluk/rölyef oluğu) where yarn is absent
            const poreCx = startX + n * needlePitch;
            const poreCy = startY + c * coursePitch + coursePitch / 2;

            ctx.save();
            ctx.fillStyle = !hasYarn ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.45)';
            ctx.beginPath();
            ctx.ellipse(
              poreCx,
              poreCy,
              needlePitch * 0.38,
              coursePitch * 0.35,
              0,
              0,
              Math.PI * 2
            );
            ctx.fill();

            ctx.strokeStyle = !hasYarn ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash(!hasYarn ? [3, 2] : []);
            ctx.stroke();

            // Pore center crosshair
            ctx.strokeStyle = !hasYarn ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.10)';
            ctx.beginPath();
            ctx.moveTo(poreCx - 4, poreCy);
            ctx.lineTo(poreCx + 4, poreCy);
            ctx.moveTo(poreCx, poreCy - 4);
            ctx.lineTo(poreCx, poreCy + 4);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // PROPER WARP KNITTING LAYER ORDER:
    // 1. Base / Ground Bars (GB6, GB5) - drawn in background
    // 2. Inlay / Weft Bars (GB4, GB2) - drawn in middle
    // 3. Pile / Face Bars (GB1, GB3) - drawn on surface
    // 4. Currently EDITED Bar (editingGbId) - ALWAYS drawn on top so threading changes are 100% visible!
    const sortedBars = [...activeAndVisibleBars].sort((a, b) => {
      if (a === editingGbId) return 1;
      if (b === editingGbId) return -1;
      const getLayerRank = (id: GuideBarId) => {
        if (id === 'GB6' || id === 'GB5') return 1; // Back/Ground
        if (id === 'GB4' || id === 'GB2') return 2; // Middle
        return 3; // Face
      };
      return getLayerRank(a) - getLayerRank(b);
    });

    sortedBars.forEach((gbId) => {
      const gb = gbMap[gbId];
      if (!gb) return;
      const isEdited = gbId === editingGbId;
      const yarnRadius = Math.max(2.5, Math.min(6.0, gb.dtex / 40 + (isEdited ? 1.8 : 1.0)));
      const threadingArr = gb.threadingArray || Array.from({ length: needleCols }, (_, i) => i % 2 === 0);

      // Iterate through guides: Only guides that are THREADED (Dolu) produce loops!
      for (let g = 0; g < needleCols; g++) {
        if (!threadingArr[g]) continue; // Boş ise iplik KESİNLİKLE YOK!

        for (let rep = 0; rep < repeatY; rep++) {
          rows.forEach((row, rIdx) => {
            const c = rep * rows.length + rIdx;
            const shift = row[gbId] || 0;
            const actualNeedle = g + shift;

            if (actualNeedle >= 0 && actualNeedle < needleCols) {
              const x = startX + actualNeedle * needlePitch;
              const y = startY + c * coursePitch + coursePitch / 2;

              // Draw Underlap strand connecting from previous course
              if (c > 0) {
                const prevRow = rIdx === 0 ? rows[rows.length - 1] : rows[rIdx - 1];
                const prevShift = prevRow[gbId] || 0;
                const prevNeedle = g + prevShift;

                if (prevNeedle >= 0 && prevNeedle < needleCols) {
                  const prevX = startX + prevNeedle * needlePitch;
                  const prevY = startY + (c - 1) * coursePitch + coursePitch / 2;

                  ctx.save();
                  ctx.strokeStyle = gb.color;
                  ctx.lineWidth = yarnRadius * 2;
                  ctx.lineCap = 'round';
                  ctx.globalAlpha = isEdited ? 1.0 : (gbId === 'GB5' || gbId === 'GB6') ? 0.65 : 0.85;
                  ctx.shadowColor = 'rgba(0,0,0,0.6)';
                  ctx.shadowBlur = isEdited ? 6 : 3;
                  ctx.shadowOffsetY = 2;

                  ctx.beginPath();
                  ctx.moveTo(prevX, prevY);
                  ctx.quadraticCurveTo((prevX + x) / 2, (prevY + y) / 2, x, y);
                  ctx.stroke();

                  // Specular highlight on active yarn
                  ctx.strokeStyle = isEdited ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.30)';
                  ctx.lineWidth = yarnRadius * 0.7;
                  ctx.beginPath();
                  ctx.moveTo(prevX, prevY);
                  ctx.quadraticCurveTo((prevX + x) / 2, (prevY + y) / 2, x, y);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              // Overlap Loop Crown (Knitted stitch head)
              ctx.save();
              ctx.fillStyle = gb.color;
              ctx.globalAlpha = isEdited ? 1.0 : (gbId === 'GB5' || gbId === 'GB6') ? 0.70 : 0.88;
              ctx.shadowColor = isEdited ? gb.color : 'rgba(0,0,0,0.7)';
              ctx.shadowBlur = isEdited ? 8 : 4;

              ctx.beginPath();
              ctx.arc(x, y, yarnRadius * (isEdited ? 1.9 : 1.6), 0, Math.PI * 2);
              ctx.fill();

              // Highlight outline for active editing bar
              if (isEdited) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.2;
                ctx.stroke();
              }

              // Specular sheen core
              ctx.fillStyle = isEdited ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.40)';
              ctx.beginPath();
              ctx.arc(x - yarnRadius * 0.35, y - yarnRadius * 0.35, yarnRadius * 0.75, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });
        }
      }
    });

    // Course indicators
    ctx.font = '10px monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    for (let c = 0; c < totalCourses; c += 2) {
      const cy = startY + c * coursePitch + coursePitch / 2;
      ctx.fillText(`K${c + 1}`, 15, cy + 3);
    }
  };

  // Immediate redraw on any state change
  useEffect(() => {
    drawTechnicalDiagram();
    drawFabricSimulation();
  });

  const downloadSimulationImage = (canvas: HTMLCanvasElement | null, fileName: string) => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* 1. Minimalist Threading & Guide Bar Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
        {/* Top bar: Guide bar selectors & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Active Guide Bar Selector */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs text-slate-400 font-medium mr-1 shrink-0">Tarak:</span>
            {activeBars.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setEditingGbId(id);
                  requestAnimationFrame(() => {
                    drawTechnicalDiagram();
                    drawFabricSimulation();
                  });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 border shrink-0 ${
                  editingGbId === id
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentGuideBars[id]?.color || '#3b82f6' }}
                />
                <span>{id}</span>
              </button>
            ))}
          </div>

          {/* Right Tools: Isolate button & bit notation input */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                setIsolateActiveBar((prev) => !prev);
                requestAnimationFrame(() => {
                  drawTechnicalDiagram();
                  drawFabricSimulation();
                });
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                isolateActiveBar
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              {isolateActiveBar ? `★ ${editingGbId} İzole` : `Sadece ${editingGbId}`}
            </button>

            <input
              type="text"
              value={binaryThreadingInput}
              onChange={(e) => handleBinaryInput(e.target.value)}
              placeholder="101010..."
              className="w-28 sm:w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-blue-400 text-center focus:outline-none focus:border-blue-500"
              title={`${needleCols} bit ikili dizim kodu`}
            />

            <button
              onClick={onOpenSafetySettings}
              className={`p-1 sm:px-2 sm:py-1 rounded-lg text-xs font-medium border transition ${
                safetyWarnings.length > 0
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Güvenli Tarak Ayarları"
            >
              {safetyWarnings.length > 0 ? (
                <span className="text-amber-400 font-bold">! {safetyWarnings.length} Uyarı</span>
              ) : (
                <span className="hidden sm:inline">Limit: {safety.maxSafeShoggingJump} İğne</span>
              )}
            </button>
          </div>
        </div>

        {/* Needle Button Strip (Mobile Touch Friendly) */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-0.5">
            <span className="font-medium text-slate-300">{editingGbId} İğne Dizimi:</span>
            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <span className="text-emerald-400">{currentThreading.filter(Boolean).length} Dolu</span>
              <span>/</span>
              <span className="text-slate-500">{needleCols - currentThreading.filter(Boolean).length} Boş</span>
            </div>
          </div>

          <div className="flex items-center overflow-x-auto py-1 gap-1.5 scrollbar-thin">
            {Array.from({ length: needleCols }).map((_, nIdx) => {
              const isThreaded = currentThreading[nIdx] ?? false;
              return (
                <button
                  key={nIdx}
                  onClick={() => handleToggleNeedle(nIdx)}
                  className={`flex-1 min-w-[38px] sm:min-w-[42px] h-12 flex flex-col items-center justify-center rounded-xl transition border touch-manipulation ${
                    isThreaded
                      ? 'bg-blue-950/60 border-blue-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                  title={`İğne ${nIdx}: ${isThreaded ? 'Dolu' : 'Boş'}`}
                >
                  <span className="text-[10px] font-mono text-slate-400 leading-none">İ{nIdx}</span>
                  <span
                    className={`w-3.5 h-3.5 rounded-full mt-1 flex items-center justify-center text-[9px] font-bold ${
                      isThreaded ? 'border border-white/80' : 'border border-slate-700'
                    }`}
                    style={{ backgroundColor: isThreaded ? currentGb.color : 'transparent' }}
                  >
                    {isThreaded ? '' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Presets Row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-400 font-medium mr-1">Şablon:</span>
            <button
              onClick={() => handleApplyPreset('5-5')}
              className="px-2 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-800 transition"
            >
              5 Dolu 5 Boş
            </button>
            <button
              onClick={() => handleApplyPreset('full')}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 transition"
            >
              Tam Dolu
            </button>
            <button
              onClick={() => handleApplyPreset('1-1')}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 transition"
            >
              1-1
            </button>
            <button
              onClick={() => handleApplyPreset('1-2')}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 transition hidden sm:inline-block"
            >
              1-2
            </button>
            <button
              onClick={() => handleApplyPreset('clear')}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 rounded-lg text-xs border border-rose-900 transition"
            >
              Tümü Boş
            </button>
            <button
              onClick={() => handleApplyPreset('invert')}
              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 transition"
            >
              Ters
            </button>
          </div>

          {/* Quick Visibility Filter */}
          <div className="flex items-center space-x-1 overflow-x-auto">
            {activeBars.map((id) => {
              const isVis = visibleBars[id] !== false;
              const gb = currentGuideBars[id];
              return (
                <button
                  key={id}
                  onClick={() =>
                    setVisibleBars((prev) => ({
                      ...prev,
                      [id]: !isVis,
                    }))
                  }
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition border ${
                    isVis
                      ? 'text-white border-transparent'
                      : 'bg-slate-950 text-slate-600 border-slate-800 line-through'
                  }`}
                  style={{ backgroundColor: isVis ? gb?.color : undefined }}
                  title={`${id} ${isVis ? 'gizle' : 'göster'}`}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Simulation Display Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Display Mode Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setDisplayMode('dual')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                displayMode === 'dual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              İkili
            </button>
            <button
              onClick={() => setDisplayMode('technical')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                displayMode === 'technical' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tarak Şeması
            </button>
            <button
              onClick={() => setDisplayMode('fabric')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                displayMode === 'fabric' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kumaş
            </button>
          </div>

          {/* Controls: Theme, Repeat, Zoom */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPaperTheme((prev) => (prev === 'dark' ? 'white' : 'dark'))}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-800 transition flex items-center space-x-1"
            >
              {paperTheme === 'dark' ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{paperTheme === 'dark' ? 'CAD Koyu' : 'Beyaz'}</span>
            </button>

            <div className="flex items-center space-x-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">Tekrar:</span>
              {[1, 2, 3, 4].map((rep) => (
                <button
                  key={rep}
                  onClick={() => setRepeatY(rep)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    repeatY === rep ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rep}x
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
                className="p-1 text-slate-400 hover:text-white rounded"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1 text-slate-300">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.15))}
                className="p-1 text-slate-400 hover:text-white rounded"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded"
                title="Sıfırla"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Checkbox Layers */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showStepNumbers}
              onChange={(e) => setShowStepNumbers(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Δ Adım Sayısı</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showLoopCurves}
              onChange={(e) => setShowLoopCurves(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>İlmek Eğrileri</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showPoreMesh}
              onChange={(e) => setShowPoreMesh(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
            />
            <span>Gözenek Analizi</span>
          </label>

          <span className="ml-auto text-[11px] text-slate-500 font-mono">
            {totalCourses} Kurs · {needleCols} İğne
          </span>
        </div>
      </div>

      {/* 3. Canvases Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Technical Diagram */}
        {(displayMode === 'dual' || displayMode === 'technical') && (
          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-200">
                Teknik Tarak Şeması (Point Paper)
              </span>
              <button
                onClick={() =>
                  downloadSimulationImage(technicalCanvasRef.current, `${pattern.title}_tarak_semasi.png`)
                }
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>

            <div className="p-3 overflow-auto max-h-[750px] bg-[#070b14] flex justify-center">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                <canvas
                  ref={technicalCanvasRef}
                  width={techCanvasWidth}
                  height={canvasHeight}
                  className="rounded-xl border border-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Fabric Simulation */}
        {(displayMode === 'dual' || displayMode === 'fabric') && (
          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-5' : 'lg:col-span-12'
            }`}
          >
            <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-200">
                Kumaş Yüzey Simülasyonu
              </span>
              <button
                onClick={() =>
                  downloadSimulationImage(fabricCanvasRef.current, `${pattern.title}_kumas_simulasyonu.png`)
                }
                className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>

            <div className="p-3 overflow-auto max-h-[750px] bg-[#05070d] flex justify-center">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                <canvas
                  ref={fabricCanvasRef}
                  width={fabricCanvasWidth}
                  height={canvasHeight}
                  className="rounded-xl border border-slate-800 bg-[#0a0f1e]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
