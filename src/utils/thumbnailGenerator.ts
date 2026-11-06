import { PatternData, GuideBarId } from '../types';

/**
 * Generates an accurate, high-fidelity (220x135) base64 thumbnail of a warp knitted pattern.
 * Uses exact warp knitting lapping movement & threading math matching the simulation canvas.
 */
export function generatePatternThumbnail(pattern: PatternData): string {
  if (typeof document === 'undefined') return '';

  const width = 220;
  const height = 135;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background - Dark studio background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(1, '#05070f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const guideBars = pattern.guideBars;
  const rows = pattern.rows || [];
  if (rows.length === 0 || !guideBars) return canvas.toDataURL('image/png');

  // Filter active guide bars sorted by zIndex
  const activeGbIds = (['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'] as GuideBarId[])
    .filter((id) => guideBars[id]?.active)
    .sort((a, b) => (guideBars[a]?.zIndex ?? 1) - (guideBars[b]?.zIndex ?? 1));

  if (activeGbIds.length === 0) return canvas.toDataURL('image/png');

  const needleCols = 24; // Represent 24 needles across thumbnail
  const padX = 12;
  const padY = 12;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;

  const needlePitch = usableWidth / (needleCols - 1);

  // We tile rows to fill thumbnail vertically
  const targetCourses = Math.max(12, Math.min(24, rows.length * 2));
  const coursePitch = usableHeight / (targetCourses - 1 || 1);

  // Draw subtle needle point grid
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  for (let c = 0; c < targetCourses; c++) {
    const cy = padY + c * coursePitch;
    for (let n = 0; n < needleCols; n++) {
      const nx = padX + n * needlePitch;
      ctx.fillRect(nx - 0.75, cy - 0.75, 1.5, 1.5);
    }
  }

  // Draw yarns for each active guidebar
  activeGbIds.forEach((gbId) => {
    const gb = guideBars[gbId];
    if (!gb) return;

    const tArr = gb.threadingArray && gb.threadingArray.length > 0
      ? gb.threadingArray
      : [true];
    const gbColor = gb.color || '#38bdf8';
    const barOpacity = gb.opacity ?? 0.85;

    // Find all threaded needle positions across the 24 columns
    const threadedGuides: number[] = [];
    for (let n = 0; n < needleCols; n++) {
      const isThreaded = tArr[n % tArr.length] ?? true;
      if (isThreaded) {
        threadedGuides.push(n);
      }
    }

    ctx.save();
    ctx.strokeStyle = gbColor;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = barOpacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    threadedGuides.forEach((g) => {
      ctx.beginPath();
      let started = false;

      for (let c = 0; c < targetCourses; c++) {
        const rIdx = c % rows.length;
        const row = rows[rIdx];
        const shift = row[gbId] || 0;
        const targetNeedle = g + shift;

        const x = padX + Math.max(0, Math.min(needleCols - 1, targetNeedle)) * needlePitch;
        const y = padY + c * coursePitch;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          // Curve path for realistic warp knitting loop
          const prevCourse = c - 1;
          const prevRow = rows[prevCourse % rows.length];
          const prevShift = prevRow[gbId] || 0;
          const prevNeedle = g + prevShift;
          const prevX = padX + Math.max(0, Math.min(needleCols - 1, prevNeedle)) * needlePitch;
          const prevY = padY + prevCourse * coursePitch;

          const cpY = (y + prevY) / 2;
          ctx.bezierCurveTo(prevX, cpY, x, cpY, x, y);
        }
      }
      ctx.stroke();

      // Draw stitch loop nodes
      ctx.fillStyle = gbColor;
      for (let c = 0; c < targetCourses; c++) {
        const rIdx = c % rows.length;
        const row = rows[rIdx];
        const shift = row[gbId] || 0;
        const targetNeedle = g + shift;
        if (targetNeedle >= 0 && targetNeedle < needleCols) {
          const x = padX + targetNeedle * needlePitch;
          const y = padY + c * coursePitch;
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.restore();
  });

  // Subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toDataURL('image/png');
}
