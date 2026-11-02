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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Integrated Threading Editor Header (Dolu / Boş İğne Düzenleme) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>İğne Threading (Dolu / Boş Dizim) Editörü</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {editingGbId} Düzenleniyor
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {needleCols} İğne Koordinat Aralığı
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Aşağıdaki iğnelere dokunarak Dolu (●) veya Boş (○) yapın; tüm simülasyon ve kumaş anında güncellenir.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenSafetySettings}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                safetyWarnings.length > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
              }`}
            >
              {safetyWarnings.length > 0 ? (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span>Güvenli Tarak Menüsü ({safety.maxSafeShoggingJump} İğne / {needleCols} Genişlik)</span>
            </button>
          </div>
        </div>

        {/* Tarak Seçimi ve İnteraktif İğneler */}
        <div className="space-y-3 bg-slate-950/90 p-4 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-bold">Aktif Tarak:</span>
              <div className="flex space-x-1.5">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                      editingGbId === id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md ring-2 ring-blue-400/30'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: currentGuideBars[id]?.color || '#3b82f6' }}
                    />
                    <span>{id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* İzole İnceleme & İkili Metin Girişi */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setIsolateActiveBar((prev) => !prev);
                  requestAnimationFrame(() => {
                    drawTechnicalDiagram();
                    drawFabricSimulation();
                  });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 ${
                  isolateActiveBar
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25 font-extrabold'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
                title="Sadece seçili tarağın iplik ve ilmeklerini ekranda gösterir, zemin örtülerini ayıklar"
              >
                <span>{isolateActiveBar ? `★ ${editingGbId} İzole Edildi` : `Sadece ${editingGbId}'yi Göster (İzole)`}</span>
              </button>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-mono">Dizim Kodu ({needleCols} Bit):</span>
                <input
                  type="text"
                  value={binaryThreadingInput}
                  onChange={(e) => handleBinaryInput(e.target.value)}
                  placeholder="10101010..."
                  className="w-44 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1 text-xs font-mono font-bold text-blue-400 tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* İ0'dan İ(N-1)'e İnteraktif İğne Düğmeleri */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">
                {editingGbId} İğne Dizimi:
              </span>
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="text-emerald-400 font-bold">{currentThreading.filter(Boolean).length} Dolu</span>
                <span className="text-slate-500">/</span>
                <span className="text-slate-400">{needleCols - currentThreading.filter(Boolean).length} Boş</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  %{((currentThreading.filter(Boolean).length / needleCols) * 100).toFixed(0)} Doluluk
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between overflow-x-auto py-2 gap-1.5 scrollbar-thin">
              {Array.from({ length: needleCols }).map((_, nIdx) => {
                const isThreaded = currentThreading[nIdx] ?? false;
                return (
                  <button
                    key={nIdx}
                    onClick={() => handleToggleNeedle(nIdx)}
                    className={`flex-1 min-w-[44px] flex flex-col items-center justify-center p-2 rounded-xl transition-all border ${
                      isThreaded
                        ? 'bg-blue-950/70 border-blue-500 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                    title={`İğne ${nIdx}: ${isThreaded ? 'Dolu (Thread In)' : 'Boş (Thread Out)'} - Tıklayarak Değiştir`}
                  >
                    <span className="text-[10px] font-mono font-bold text-slate-400 mb-1">İ{nIdx}</span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-transform ${
                        isThreaded
                          ? 'border-2 border-white scale-110 shadow'
                          : 'border border-slate-700 bg-slate-950'
                      }`}
                      style={{ backgroundColor: isThreaded ? currentGb.color : 'transparent' }}
                    >
                      {isThreaded ? '●' : '○'}
                    </span>
                    <span
                      className={`text-[9px] font-bold mt-1 uppercase ${
                        isThreaded ? 'text-blue-300' : 'text-slate-500'
                      }`}
                    >
                      {isThreaded ? 'Dolu' : 'Boş'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hızlı Şablonlar & Tarak İzolasyonu */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 font-semibold mr-1">Hızlı Şablonlar:</span>
              <button
                onClick={() => handleApplyPreset('5-5')}
                className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/40 transition shadow-sm"
                title="GB3 için 5 Dolu 5 Boş (5-in 5-out) düzeni"
              >
                ★ 5 Dolu 5 Boş (5x5)
              </button>
              <button
                onClick={() => handleApplyPreset('full')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-800 transition"
              >
                Tam Dolu (Full)
              </button>
              <button
                onClick={() => handleApplyPreset('1-1')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-800 transition"
              >
                1 Dolu 1 Boş
              </button>
              <button
                onClick={() => handleApplyPreset('1-2')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-medium border border-slate-800 transition"
              >
                1 Dolu 2 Boş
              </button>
              <button
                onClick={() => handleApplyPreset('clear')}
                className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 rounded-lg text-xs font-medium border border-rose-800/60 transition"
              >
                Tümü Boş
              </button>
              <button
                onClick={() => handleApplyPreset('invert')}
                className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 rounded-lg text-xs font-bold border border-indigo-800 transition"
              >
                Tersine Çevir
              </button>
            </div>

            {/* Simülasyonda Tarak Görünürlüğü (Zemin taraklarını gizleyip GB3'ü incelemek için) */}
            <div className="flex items-center space-x-2 pt-1 sm:pt-0">
              <span className="text-xs text-slate-400 font-semibold">Tarak Görünürlüğü:</span>
              <div className="flex items-center space-x-1">
                {activeBars.map((id) => {
                  const isVis = visibleBars[id] !== false;
                  const gb = pattern.guideBars[id];
                  return (
                    <button
                      key={id}
                      onClick={() =>
                        setVisibleBars((prev) => ({
                          ...prev,
                          [id]: !isVis,
                        }))
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                        isVis
                          ? 'text-white border-transparent'
                          : 'bg-slate-950 text-slate-600 border-slate-800 line-through'
                      }`}
                      style={{ backgroundColor: isVis ? gb.color : undefined }}
                      title={`${id} ${isVis ? 'görünür (gizlemek için tıklayın)' : 'gizli (göstermek için tıklayın)'}`}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Simulation Toolbar (Mode Switcher, Theme, Repeat, Height & Zoom) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Display Mode */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setDisplayMode('dual')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                displayMode === 'dual' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              İkili Görünüm (Tarak Şeması + Kumaş)
            </button>
            <button
              onClick={() => setDisplayMode('technical')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                displayMode === 'technical' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Teknik Tarak Şeması
            </button>
            <button
              onClick={() => setDisplayMode('fabric')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                displayMode === 'fabric' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kumaş Simülasyonu
            </button>
          </div>

          {/* Theme & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Paper Theme Toggle: Dark vs White */}
            <button
              onClick={() => setPaperTheme((prev) => (prev === 'dark' ? 'white' : 'dark'))}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-2xl text-xs font-bold transition"
              title="Teknik Kağıt Teması"
            >
              {paperTheme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <span>{paperTheme === 'dark' ? 'Koyu CAD' : 'Beyaz Kağıt'}</span>
            </button>

            {/* Repeat Selector (2x, 3x, 4x) */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-bold">Tekrar:</span>
              {[1, 2, 3, 4, 6].map((rep) => (
                <button
                  key={rep}
                  onClick={() => setRepeatY(rep)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    repeatY === rep
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                  }`}
                >
                  {rep}x
                </button>
              ))}
            </div>

            {/* Height Pitch */}
            <div className="flex items-center space-x-1.5 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400 font-bold">Yükseklik:</span>
              <select
                value={customCoursePitch}
                onChange={(e) => setCustomCoursePitch(parseInt(e.target.value))}
                className="bg-transparent text-xs text-slate-200 font-bold focus:outline-none"
              >
                <option value={28}>Kompakt (28px)</option>
                <option value={36}>Standart 1:1 (36px)</option>
                <option value={44}>Geniş (44px)</option>
                <option value={52}>Ultra Uzun (52px)</option>
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.15))}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2 text-slate-300 font-bold">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((prev) => Math.min(2.0, prev + 0.15))}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg"
                title="Sıfırla"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Checkbox Layers */}
        <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-slate-800 text-xs text-slate-200 font-semibold">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStepNumbers}
              onChange={(e) => setShowStepNumbers(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>Haraketin Yanında Adım Sayısı (Δ Adım)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showLoopCurves}
              onChange={(e) => setShowLoopCurves(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>İlmek Altı & Üstü Eğrisi (Underlap & Overlap)</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPoreMesh}
              onChange={(e) => setShowPoreMesh(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500"
            />
            <span>Gözenek & Delik Analiz Ağı</span>
          </label>

          <div className="ml-auto text-xs text-slate-400 font-mono">
            Toplam Kurs: <strong className="text-white">{totalCourses}</strong> | İğne Eni: {needleCols} İğne
          </div>
        </div>
      </div>

      {/* 3. Visualization Viewport (Dynamic canvas height, zoom, scrollable) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Technical Diagram Panel */}
        {(displayMode === 'dual' || displayMode === 'technical') && (
          <div
            className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-sm text-white">
                  Teknik Tarak Şeması (Point Paper & Adım Sayıları)
                </h4>
              </div>

              <button
                onClick={() =>
                  downloadSimulationImage(technicalCanvasRef.current, `${pattern.title}_tarak_semasi.png`)
                }
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG İndir</span>
              </button>
            </div>

            {/* Scrollable Viewport with dynamic height */}
            <div className="p-4 overflow-auto max-h-[820px] bg-[#070b14] flex justify-center">
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
                  className="rounded-2xl border border-slate-800 shadow-2xl transition-colors duration-200"
                />
              </div>
            </div>
          </div>
        )}

        {/* Realistic Fabric Simulation Panel */}
        {(displayMode === 'dual' || displayMode === 'fabric') && (
          <div
            className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${
              displayMode === 'dual' ? 'lg:col-span-5' : 'lg:col-span-12'
            }`}
          >
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h4 className="font-bold text-sm text-white">Kumaş Yüzey Simülasyonu & Threading</h4>
              </div>

              <button
                onClick={() =>
                  downloadSimulationImage(fabricCanvasRef.current, `${pattern.title}_kumas_simulasyonu.png`)
                }
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG İndir</span>
              </button>
            </div>

            {/* Scrollable Fabric Viewport */}
            <div className="p-4 overflow-auto max-h-[820px] bg-[#05070d] flex justify-center">
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
                  className="rounded-2xl border border-slate-800 shadow-2xl bg-[#0a0f1e]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
