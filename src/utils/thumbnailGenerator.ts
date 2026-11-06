import { PatternData, GuideBarId } from '../types';

/**
 * Generates a lightweight, compact (160x100) base64 thumbnail of a warp knitted pattern.
 * Runs on an offscreen canvas in milliseconds without blocking the UI.
 */
export function generatePatternThumbnail(pattern: PatternData): string {
  if (typeof document === 'undefined') return '';

  const width = 160;
  const height = 100;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(1, '#05070f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const guideBars = pattern.guideBars;
  const rows = pattern.rows || [];
  if (rows.length === 0 || !guideBars) return canvas.toDataURL('image/jpeg', 0.65);

  const activeBars = (['GB1', 'GB2', 'GB3', 'GB4', 'GB5', 'GB6'] as GuideBarId[]).filter(
    (id) => guideBars[id]?.active
  );

  const totalCols = 16;
  const repeatCourses = Math.min(rows.length * 2, 12);
  const padX = 10;
  const padY = 8;
  const colPitch = (width - padX * 2) / (totalCols - 1);
  const rowPitch = (height - padY * 2) / (repeatCourses - 1 || 1);

  // Subtle needle grid dots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let c = 0; c < repeatCourses; c++) {
    const y = padY + c * rowPitch;
    for (let n = 0; n < totalCols; n++) {
      const x = padX + n * colPitch;
      ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
  }

  // Draw yarn paths for active guide bars
  activeBars.forEach((gbId) => {
    const gb = guideBars[gbId];
    if (!gb) return;
    const tArr = gb.threadingArray || [];
    const color = gb.color || '#38bdf8';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = gb.opacity ?? 0.85;

    // Simulate 4 yarn threads across the needles
    for (let needleIdx = 0; needleIdx < totalCols; needleIdx += 2) {
      const isThreaded = tArr[needleIdx % tArr.length] ?? true;
      if (!isThreaded) continue;

      ctx.beginPath();
      let started = false;

      for (let c = 0; c < repeatCourses; c++) {
        const row = rows[c % rows.length];
        const shog = row[gbId] || 0;
        const targetNeedle = Math.max(0, Math.min(totalCols - 1, needleIdx + (shog % 4)));

        const x = padX + targetNeedle * colPitch;
        const y = padY + c * rowPitch;

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          // Curved loop knitting path
          const prevY = padY + (c - 1) * rowPitch;
          const cpY = (y + prevY) / 2;
          ctx.quadraticCurveTo(x + (c % 2 === 0 ? 3 : -3), cpY, x, y);
        }
      }
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1.0;

  // Subtle border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toDataURL('image/jpeg', 0.65);
}
